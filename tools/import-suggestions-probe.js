// Probe for tools/console-check.js --probe tools/import-suggestions-probe.js. Runs inside the page.
(async () => {
  const fails = [];
  const eq = (name, got, want) => { if (JSON.stringify(got) !== JSON.stringify(want)) fails.push(`${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); };
  try {
    // 1. Test replaceInListIn and removeFromListIn
    $('#listIn').value = '1 Rhystic Stud (PCY)\n4 Ligntning Bolt';
    replaceInListIn('Rhystic Stud', 'Rhystic Study');
    eq('replaceInListIn updates line preserving set', $('#listIn').value, '1 Rhystic Study (PCY)\n4 Ligntning Bolt');

    removeFromListIn('Ligntning Bolt');
    eq('removeFromListIn removes line', $('#listIn').value, '1 Rhystic Study (PCY)');

    // 2. Test suggestMissingCards with 1 missing card
    const d = deck();
    d.entries = [];
    $('#listIn').value = '1 Rhystic Stud';
    const missing = [{qty: 1, name: 'Rhystic Stud', idx: 0}];
    $('#importNote').innerHTML = `<div class="warn">Couldn't find 1 card. It's left in the box above: check the spelling and press <b>Add to deck</b> again.</div>`;
    await suggestMissingCards(missing, true);

    const warn = $('#importNote .warn');
    if (!warn) fails.push('missing warn banner');
    else {
      eq('contains error message', warn.innerHTML.includes("Couldn't find 1 card. It's left in the box above: check the spelling and press <b>Add to deck</b> again."), true);
      eq('contains suggestion for Rhystic Study', warn.innerHTML.includes('Rhystic Study'), true);
      eq('has Use button', !!$('[data-suggest-replace]', warn), true);
      eq('has Add button', !!$('[data-suggest-add]', warn), true);
    }

    // 3. Test clicking Use button
    const useBtn = $('[data-suggest-replace]', $('#importNote'));
    if (useBtn) {
      useBtn.click();
      eq('Use button disabled', useBtn.disabled, true);
      eq('Use button text', useBtn.textContent, '✓ Used');
      eq('listIn updated with Rhystic Study', $('#listIn').value.trim(), '1 Rhystic Study');
    }

    // 4. Test clicking Add button
    const addBtn = $('[data-suggest-add]', $('#importNote'));
    if (addBtn) {
      addBtn.click();
      let waited = 0;
      while (d.entries.length === 0 && waited < 50) {
        await new Promise(r => setTimeout(r, 100));
        waited++;
      }
      eq('card added to deck', d.entries.some(e => e.name === 'Rhystic Study'), true);
      eq('card removed from listIn', $('#listIn').value.trim(), '');
      eq('importNote cleared after card added', $('#importNote').innerHTML.trim(), '');
    }

    // 5. Test multiple missing cards with suggestions
    $('#listIn').value = '1 Rhystic Stud\n4 Ligntning Bolt';
    const missing2 = [
      {qty: 1, name: 'Rhystic Stud', idx: 0},
      {qty: 4, name: 'Ligntning Bolt', idx: 1}
    ];
    $('#importNote').innerHTML = `<div class="warn">Couldn't find 2 cards. They're left in the box above: check the spelling and press <b>Add to deck</b> again.</div>`;
    await suggestMissingCards(missing2, true);
    const warn2 = $('#importNote .warn');
    eq('multiple cards list suggestions', $$('li', warn2).length >= 2, true);

    // 6. End-to-end importList call with misspelled card
    $('#listIn').value = '1 Rhystic Stud';
    await importList('1 Rhystic Stud', false);
    let waitE2e = 0;
    while (!activeMissingSuggestions.length && waitE2e < 50) {
      await new Promise(r => setTimeout(r, 100));
      waitE2e++;
    }
    const e2eWarn = $('#importNote .warn');
    eq('e2e importNote has error banner', !!e2eWarn, true);
    eq('e2e importNote has suggestion', e2eWarn?.innerHTML.includes('Rhystic Study'), true);
    eq('e2e importNote has Use button', !!$('[data-suggest-replace]', e2eWarn), true);
  } catch (err) {
    fails.push('exception: ' + err.message);
  }
  return fails.length ? {fails} : true;
})();
