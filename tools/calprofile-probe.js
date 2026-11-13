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
  } catch (e) { fails.push(`threw: ${e && e.message}`); }
  finally { S.calibrationProfiles = savedList; S.settings = savedS; S.printer = savedP; renderAll(); }
  return fails.length ? {fails} : true;
})()
