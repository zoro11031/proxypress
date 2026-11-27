// Regression probe: foil saturation (>100%) must boost fronts and DFC backs,
// but MUST NOT boost shared cardbacks (slot.bi == null).
(async () => {
  const fails = [];
  const check = (name, ok, detail = '') => { if (!ok) fails.push(detail ? `${name}: ${detail}` : name); };
  const origSettings = structuredClone(S.settings);
  const origDecks = structuredClone(S.decks);
  const origDeckId = S.deckId;
  const origShowBacks = S.showBacks;
  try {
    const hiSat = {...DEFAULTS, brightness: 100, contrast: 100, saturation: 160, foilTint: 0};
    const loSat = {...DEFAULTS, brightness: 100, contrast: 100, saturation: 80, foilTint: 0};

    check('filterFor boosts front/DFC saturation above 100%', filterFor(hiSat) === 'saturate(160%)', filterFor(hiSat));
    check('filterFor caps shared cardback saturation at 100% when boosted', filterFor(hiSat, {sharedCardback: true}) === '', filterFor(hiSat, {sharedCardback: true}));
    check('filterFor still allows desaturating shared cardback below 100%', filterFor(loSat, {sharedCardback: true}) === 'saturate(80%)', filterFor(loSat, {sharedCardback: true}));

    const sharedSlot = {front: {name: 'Front'}, back: {name: 'SharedBack'}, bi: null};
    const dfcSlot = {front: {name: 'Front'}, back: {name: 'DFCBack'}, bi: 1};
    check('front slot is never shared cardback', isSharedBackSlot(sharedSlot, false) === false);
    check('single-faced back slot is shared cardback', isSharedBackSlot(sharedSlot, true) === true);
    check('DFC back slot is not shared cardback', isSharedBackSlot(dfcSlot, true) === false);

    // Create a moderately saturated test swatch (RGB 180, 110, 90).
    const sw = document.createElement('canvas'); sw.width = 120; sw.height = 168;
    const swCtx = sw.getContext('2d'); swCtx.fillStyle = 'rgb(180, 110, 90)'; swCtx.fillRect(0, 0, 120, 168);
    const swatchUrl = sw.toDataURL('image/png');
    const face = {name: 'TestSwatch', png: swatchUrl};
    const centerChroma = cvs => {
      const px = cvs.getContext('2d').getImageData(Math.floor(cvs.width / 2), Math.floor(cvs.height / 2), 1, 1).data;
      return Math.max(px[0], px[1], px[2]) - Math.min(px[0], px[1], px[2]);
    };

    const baseCvs = await renderFace(face, 72, false, 0, {...hiSat, saturation: 100}, true, false);
    const frontCvs = await renderFace(face, 72, false, 0, hiSat, false, false);
    const dfcBackCvs = await renderFace(face, 72, false, 0, hiSat, true, false);
    const sharedBackCvs = await renderFace(face, 72, false, 0, hiSat, true, true);
    const baseChroma = centerChroma(baseCvs);
    const frontChroma = centerChroma(frontCvs);
    const dfcChroma = centerChroma(dfcBackCvs);
    const sharedChroma = centerChroma(sharedBackCvs);

    check('front gets boosted chroma at 160% saturation', frontChroma > baseChroma + 25, `front=${frontChroma} base=${baseChroma}`);
    check('DFC back gets boosted chroma at 160% saturation', dfcChroma > baseChroma + 25, `dfc=${dfcChroma} base=${baseChroma}`);
    check('shared cardback stays unboosted at 160% saturation', Math.abs(sharedChroma - baseChroma) <= 2, `shared=${sharedChroma} base=${baseChroma}`);

    // previewUrl cache must separate shared cardback from DFC/front even for the identical image.
    const pDfc = await previewUrl(face, 0, hiSat, true, false);
    const pShared = await previewUrl(face, 0, hiSat, true, true);
    check('previewUrl caches DFC back and shared cardback separately', pDfc !== pShared);
  } catch (err) {
    fails.push('threw: ' + (err.stack || err));
  } finally {
    S.settings = origSettings;
    S.decks = origDecks;
    S.deckId = origDeckId;
    S.showBacks = origShowBacks;
    renderAll();
  }
  return fails.length ? {fails} : true;
})();
