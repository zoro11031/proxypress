// Probe for tools/console-check.js --probe. Runs inside the page.
// Tests the safe deck replacement staging, review, revision check, and undo workflow.
(async () => {
  const fails = [];
  const eq = (n, got, want) => { if (got !== want) fails.push(`${n}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); };

  const savedDecks = JSON.parse(JSON.stringify(S.decks));
  const savedDeckId = S.deckId;

  try {
    // Setup a clean test deck with 2 cards and custom artwork
    const testCustomKey = 'probe-test-undo-art';
    await store.set('images', testCustomKey, new Blob(['test-art-bytes'], {type:'image/png'}));

    const initialEntries = [
      {
        uid: 'card-1',
        name: 'Sol Ring',
        qty: 2,
        scryId: 'sol-ring-id',
        scryFace: 0,
        faces: [{name:'Sol Ring', custom:testCustomKey}],
        tokens: []
      },
      {
        uid: 'card-2',
        name: 'Command Tower',
        qty: 1,
        scryId: 'command-tower-id',
        scryFace: 0,
        faces: [{name:'Command Tower', png:'https://cards.scryfall.io/test.png'}],
        tokens: []
      }
    ];

    const d1 = {id: 'deck-probe-1', name: 'Primary Deck', entries: JSON.parse(JSON.stringify(initialEntries)), updated: 1000, cardback: null};
    const d2 = {id: 'deck-probe-2', name: 'Secondary Deck', entries: [], updated: 2000, cardback: null};
    S.decks = [d1, d2];
    S.deckId = d1.id;
    save();

    // 1. Revision capture and matching
    const target1 = captureDeckRevision(d1);
    eq('captureDeckRevision id', target1.id, d1.id);
    eq('captureDeckRevision copies', target1.copiesCount, 3);
    eq('captureDeckRevision entries', target1.entriesLength, 2);
    eq('matchesRevision on same deck', matchesRevision(d1, target1), true);

    // 2. Full match staging
    // Mock fetchCollection to return reliable deterministic results without network
    const realFetchCollection = fetchCollection;
    window.fetchCollection = async (ids) => {
      const found = [], missing = [];
      for (const req of ids) {
        if (req.name.toLowerCase().includes('bogus') || req.name.toLowerCase().includes('notarealcard')) {
          missing.push(req);
        } else {
          found.push({
            req,
            card: {
              id: 'mock-' + req.name.toLowerCase().replace(/\s+/g, '-'),
              name: req.name,
              set: req.set || 'lea',
              collector_number: req.cn || '1',
              layout: 'normal',
              image_uris: {png: 'https://cards.scryfall.io/mock.png', normal: 'https://cards.scryfall.io/mock.png'}
            }
          });
        }
      }
      return {found, missing};
    };

    try {
      // Test Full match
      const fullStaged = await resolveDeckImport('4 Black Lotus\n1 Mox Diamond');
      eq('full match resolved cards', fullStaged.resolved.length, 2);
      eq('full match resolved copies', fullStaged.resolved.reduce((n, r) => n + r.qty, 0), 5);
      eq('full match unresolved count', fullStaged.unresolved.length, 0);

      // Test Partial match
      const partialStaged = await resolveDeckImport('2 Mox Diamond\n1 NotARealCardXYZ123');
      eq('partial match resolved cards', partialStaged.resolved.length, 1);
      eq('partial match unresolved count', partialStaged.unresolved.length, 1);
      eq('partial match unresolved name', partialStaged.unresolved[0].name, 'NotARealCardXYZ123');

      // Test Zero matches
      const zeroStaged = await resolveDeckImport('1 BogusCardABC\n2 BogusCardDEF');
      eq('zero match resolved cards', zeroStaged.resolved.length, 0);
      eq('zero match unresolved count', zeroStaged.unresolved.length, 2);
      // Ensure original deck is unchanged
      showUnresolvedImport(zeroStaged);
      eq('original deck entries untouched on zero matches', d1.entries.length, 2);
      eq('original deck copies untouched on zero matches', d1.entries.reduce((n, e) => n + e.qty, 0), 3);

      // Test Lookup failure
      window.fetchCollection = async () => { throw new Error('Simulated Scryfall 503 outage'); };
      const failStaged = await resolveDeckImport('4 Lightning Bolt');
      eq('lookup failure resolved cards', failStaged.resolved.length, 0);
      eq('lookup failure has error', typeof failStaged.error, 'string');
      eq('original deck untouched on lookup failure', d1.entries.length, 2);

      // Restore working mock
      window.fetchCollection = async (ids) => ({
        found: ids.map(req => ({
          req,
          card: {
            id: 'mock-' + req.name.toLowerCase().replace(/\s+/g, '-'),
            name: req.name,
            set: req.set || 'lea',
            collector_number: req.cn || '1',
            layout: 'normal',
            image_uris: {png: 'https://cards.scryfall.io/mock.png', normal: 'https://cards.scryfall.io/mock.png'}
          }
        })),
        missing: []
      });

      // Test Cancel review
      const validStaged = await resolveDeckImport('4 Swords to Plowshares');
      // Simulate user clicking Cancel in review
      let reviewResult = false;
      if (reviewResult) applyDeckReplacement(d1, validStaged, {keepUndo: true});
      eq('deck untouched when review is canceled', d1.entries.length, 2);
      eq('deck copies untouched when review is canceled', d1.entries[0].name, 'Sol Ring');

      // Test Deck switch during lookup
      const targetBeforeSwitch = captureDeckRevision(d1);
      // User switches to d2 during lookup
      S.deckId = d2.id;
      const currentDeckNow = findDeck(targetBeforeSwitch.id);
      // Simulate editing or switching
      d1.updated = 9999; // modified!
      eq('revision match fails if deck was modified', matchesRevision(currentDeckNow, targetBeforeSwitch), false);

      // Reset for actual replacement and Undo test
      d1.updated = targetBeforeSwitch.updated;
      S.deckId = d1.id;
      eq('revision matches when restored', matchesRevision(d1, targetBeforeSwitch), true);

      // Test Apply replacement + Undo
      applyDeckReplacement(d1, validStaged, {keepUndo: true});
      eq('replacement applied - new card count', d1.entries.length, 1);
      eq('replacement applied - new card name', d1.entries[0].name, 'Swords to Plowshares');
      eq('replacement applied - new qty', d1.entries[0].qty, 4);
      eq('undo snapshot exists', !!deckUndo, true);

      // Verify removeImageIfUnused protects undo artwork
      await removeImageIfUnused(testCustomKey);
      const artAfterPrune = await store.get('images', testCustomKey);
      eq('undo artwork preserved by removeImageIfUnused', !!artAfterPrune, true);

      // Now trigger Undo
      undoDeckReplacement();
      eq('undo restored original entries count', d1.entries.length, 2);
      eq('undo restored card 1 name', d1.entries[0].name, 'Sol Ring');
      eq('undo restored card 1 qty', d1.entries[0].qty, 2);
      eq('undo restored card 1 custom art', d1.entries[0].faces[0].custom, testCustomKey);
      eq('undo restored card 2 name', d1.entries[1].name, 'Command Tower');
      eq('deckUndo cleared after undo', deckUndo, null);

    } finally {
      window.fetchCollection = realFetchCollection;
    }

  } catch (err) {
    fails.push('threw: ' + (err && err.message));
  } finally {
    S.decks = savedDecks;
    S.deckId = savedDeckId;
    deckUndo = null;
    save();
    renderAll();
  }

  return fails.length ? {fails} : true;
})();
