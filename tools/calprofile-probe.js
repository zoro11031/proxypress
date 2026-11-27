// Probe for tools/console-check.js --probe. Runs inside the page.
//
// The calibration profile row: the name box has to be legible, and a profile has
// to be editable. The styling rule keys off input[type=...], so an input with no
// type attribute silently gets none of the theme and its text disappears into the
// background -- invisible to any test that only checks behaviour, hence the
// computed-style check here.
(() => {
  const fails = [];
  const eq = (n, got, want) => { if (got !== want) fails.push(`${n}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); };
  const savedList = S.calibrationProfiles, savedS = S.settings, savedP = S.printer;
  try {
    const box = document.querySelector('#calProfileName');
    const sel = document.querySelector('#calProfileSel');
    eq('name box exists', !!box, true);
    eq('name box is typed', box.getAttribute('type'), 'text');
    // The real failure mode is contrast, not equality: `button,input,select,
    // textarea{color:inherit}` gives every input the light theme text colour,
    // while the dark field background is only applied to input[type=...]. An
    // untyped input is therefore light text on the browser's default white, which
    // two unequal colour strings do not reveal. Compare luminance instead.
    const lum = c => {
      const [r, g, b] = (c.match(/[\d.]+/g) || [0, 0, 0]).slice(0, 3).map(Number).map(v => {
        const x = v / 255;
        return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const cs = getComputedStyle(box);
    const contrast = (Math.max(lum(cs.color), lum(cs.backgroundColor)) + 0.05) /
                     (Math.min(lum(cs.color), lum(cs.backgroundColor)) + 0.05);
    eq(`name box is legible (contrast ${contrast.toFixed(1)}:1 of ${cs.color} on ${cs.backgroundColor})`, contrast >= 4.5, true);

    S.calibrationProfiles = []; S.settings = {...DEFAULTS, backOffsetX: 2, backOffsetY: 3};
    renderCalibrationProfiles();

    // Save a profile.
    box.value = 'Mine';
    document.querySelector('#calProfileSave').click();
    eq('saved one', S.calibrationProfiles.length, 1);
    eq('saved name', S.calibrationProfiles[0].name, 'Mine');
    eq('selection follows the save', sel.value, S.calibrationProfiles[0].id);

    // Selecting it must put its name back in the box, or it cannot be edited.
    box.value = '';
    sel.value = S.calibrationProfiles[0].id;
    sel.dispatchEvent(new Event('change'));
    eq('name box follows selection', box.value, 'Mine');

    // Renaming edits in place rather than leaving the old name behind.
    box.value = 'Renamed';
    document.querySelector('#calProfileSave').click();
    eq('rename did not duplicate', S.calibrationProfiles.length, 1);
    eq('renamed', S.calibrationProfiles[0].name, 'Renamed');

    // A built-in leaves the box empty: it cannot be edited.
    sel.value = BUILTIN_CAL_PROFILES[0].id;
    sel.dispatchEvent(new Event('change'));
    eq('built-in clears the box', box.value, '');

    // And its name cannot be taken.
    box.value = BUILTIN_CAL_PROFILES[0].name;
    document.querySelector('#calProfileSave').click();
    eq('built-in name refused', S.calibrationProfiles.length, 1);

    // One set per sheet size and orientation. Every number in a set is in the
    // printed page's own axes, so the layout it was measured on is part of the
    // measurement, and a profile has to be able to hold both of them at once.
    const ori = () => document.querySelector('#setting-orientation');
    const size = () => document.querySelector('#setting-pageSize');
    const pick = el => { el.dispatchEvent(new Event('change', {bubbles: true})); };
    const four = () => [S.settings.offsetX, S.settings.offsetY,
                        S.settings.backOffsetX, S.settings.backOffsetY].join(',');
    const prof = () => S.calibrationProfiles[0];
    const realConfirm = window.confirm;
    try {
      S.calibrationProfiles = [];
      S.settings = cleanSettings({...DEFAULTS, pageSize:'letter', orientation:'landscape',
        cardRotation:'upright', offsetX:1, offsetY:0, backOffsetX:-2.8, backOffsetY:-2.2,
        printRotate:-0.21, backRotate:-0.62});
      renderAll();
      box.value = 'Foil';
      document.querySelector('#calProfileSave').click();
      eq('first save scopes the set', Object.keys(prof().settings).join(','), 'letter/landscape');
      eq('the whole alignment block is in it',
        CAL_SLOT_KEYS.every(k => k in prof().settings['letter/landscape']), true);
      eq('the list names the layout',
        [...sel.options].find(o => o.value === prof().id).textContent, 'Foil \u00b7 Letter landscape');
      eq('a legacy profile names none',
        [...sel.options].find(o => o.value === BUILTIN_CAL_PROFILES[0].id).textContent,
        BUILTIN_CAL_PROFILES[0].name);

      // No portrait set yet, so the switch offers the turn.
      window.confirm = () => true;
      ori().value = 'portrait'; pick(ori());
      eq('the switch turned the numbers', four(), '0,1,2.2,-2.8');

      // Saved under the same name, the profile now holds both.
      box.value = 'Foil';
      document.querySelector('#calProfileSave').click();
      eq('still one profile', S.calibrationProfiles.length, 1);
      eq('two sets now', Object.keys(prof().settings).sort().join(','),
        'letter/landscape,letter/portrait');
      eq('the list names both',
        [...sel.options].find(o => o.value === prof().id).textContent,
        'Foil \u00b7 Letter landscape + Letter portrait');

      // And with an answer in hand it stops asking: the measured set is loaded.
      // Counted rather than thrown: the change handler is async, so an exception
      // inside it never reaches this try and would only look like a value that
      // failed to change.
      let asked = 0;
      window.confirm = () => { asked++; return true; };
      ori().value = 'landscape'; pick(ori());
      eq('the measured landscape set came back', four(), '1,0,-2.8,-2.2');
      eq('it did not ask when it had the answer', asked, 0);
      eq('loading a set does not move the cards',
        [S.settings.pageSize, S.settings.orientation, S.settings.cardRotation].join(','),
        'letter,landscape,upright');
      // A different sheet, same way round: the axes still match, so nothing is
      // turned and nothing is asked.
      size().value = 'a4'; pick(size());
      eq('a sheet change asks nothing', `${four()} asked ${asked}`, '1,0,-2.8,-2.2 asked 0');

      // The fallbacks, in order.
      const at = (pageSize, orientation) => ({...DEFAULTS, pageSize, orientation});
      const g1 = calSlotFor(prof(), at('a4', 'portrait'));
      eq('same way round on another sheet is used as measured', `${g1.from} ${g1.key}`,
        'size letter/portrait');
      const oneWay = {id:'x', name:'One way', printer:'mf753', settings:{'letter/landscape':
        {offsetX:1, offsetY:0, backOffsetX:-2.8, backOffsetY:-2.2, scaleX:100.25, scaleY:100}}};
      const g2 = calSlotFor(oneWay, at('a4', 'portrait'));
      eq('the other way round is turned to fit', `${g2.from} ${[g2.set.offsetX, g2.set.offsetY,
        g2.set.backOffsetX, g2.set.backOffsetY, g2.set.scaleX, g2.set.scaleY].join(',')}`,
        'turned 0,1,2.2,-2.8,100,100.25');
      const legacy = {id:'y', name:'Old', printer:'mf753',
        settings:{duplexFlip:'short', backOffsetX:0, backOffsetY:1}};
      const g3 = calSlotFor(legacy, at('a4', 'portrait'));
      eq('an old flat set stays unscoped', `${g3.from} ${g3.set.backOffsetY}`, 'any 1');
      eq('and is applied as it always was', JSON.stringify(calSlots(legacy)),
        '{"any":{"duplexFlip":"short","backOffsetX":0,"backOffsetY":1}}');

      // Regression: typing values into Alignment inputs and clicking Save profile without clicking Apply first
      // must commit those typed values into the saved profile (not save stale zeros).
      openPrintSettings('alignment');
      S.calibrationProfiles = []; S.calibrationProfileId = null;
      S.settings = cleanSettings({...DEFAULTS, pageSize:'letter', orientation:'landscape', duplexMethod:'auto', duplexFlip:'long',
        backOffsetX:0, backOffsetY:0, backScaleX:100, backScaleY:100, backRotate:0});
      refreshAlignmentPage();
      const setAlign = (id, val) => { const el = document.getElementById(id); el.value = String(val); el.dispatchEvent(new Event('input', {bubbles:true})); };
      setAlign('input-backOffsetX', '-2.61');
      setAlign('input-backOffsetY', '-1.26');
      setAlign('input-backScaleX', '100.55');
      setAlign('input-backScaleY', '100.08');
      setAlign('input-backRotate', '-0.61');
      box.value = 'Canon Auto Cardstock';
      document.querySelector('#calProfileSave').click();
      eq('save profile committed unapplied backOffsetX', S.settings.backOffsetX, -2.61);
      eq('save profile committed unapplied backScaleX', S.settings.backScaleX, 100.55);
      eq('save profile committed unapplied backRotate', S.settings.backRotate, -0.61);
      const savedCard = document.querySelector('#calProfileCards [data-cal-profile]');
      eq('saved profile card shows actual saved values', savedCard && document.querySelector('#calProfileCards').textContent.includes('-2.61'), true);

      // Regression: loading an auto/long profile from a manual/long setup must load its saved offsets & duplexMethod,
      // AND clear any unapplied draft in the alignment inputs!
      S.settings = cleanSettings({...DEFAULTS, pageSize:'letter', orientation:'landscape', duplexMethod:'manual', duplexFlip:'long',
        backOffsetX:0, backOffsetY:0, backScaleX:100, backScaleY:100, backRotate:0});
      S.calibrationProfileId = null;
      refreshAlignmentPage();
      setAlign('input-backOffsetX', '9.99'); // unapplied draft that must be cleared when loading profile
      document.querySelector(`#calProfileCards [data-cal-profile="${prof().id}"]`).click();
      eq('clicking auto/long profile from manual setup loads backOffsetX', S.settings.backOffsetX, -2.61);
      eq('clicking auto/long profile from manual setup loads backScaleX', S.settings.backScaleX, 100.55);
      eq('clicking auto/long profile from manual setup loads backRotate', S.settings.backRotate, -0.61);
      eq('clicking auto/long profile switches duplexMethod to auto', S.settings.duplexMethod, 'auto');
      eq('clicking profile clears stale input draft in UI', document.getElementById('input-backOffsetX').value, '-2.61');
      backToProof();
    } finally { window.confirm = realConfirm; }
  } catch (e) { fails.push(`threw: ${e && e.message}`); }
  finally { S.calibrationProfiles = savedList; S.settings = savedS; S.printer = savedP; renderAll(); }
  return fails.length ? {fails} : true;
})()
