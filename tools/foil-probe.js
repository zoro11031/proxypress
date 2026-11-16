// Saturation setting: persistence, cache key, and filter composition.
(async () => {
  const original = JSON.parse(JSON.stringify(S)), fails = [];
  const eq = (name, got, want) => { if (JSON.stringify(got) !== JSON.stringify(want)) fails.push(`${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); };
  try {
    eq('saturation default', DEFAULTS.saturation, 100);
    eq('saturation survives cleanSettings', cleanSettings({...DEFAULTS, saturation:120}).saturation, 120);
    eq('saturation is a preset key', PRESET_KEYS.includes('saturation'), true);
    eq('saturation is in the settings form', FIELDS.some(f => f.k === 'saturation'), true);
    S.settings = {...DEFAULTS, saturation:100}; const sigA = settingsSig();
    S.settings = {...DEFAULTS, saturation:120}; const sigB = settingsSig();
    eq('saturation invalidates the preview cache', sigA !== sigB, true);
    eq('both filters compose', filterFor({...DEFAULTS, brightness:95, saturation:120}), 'brightness(95%) saturate(120%)');
    eq('neither when both default', filterFor(DEFAULTS), '');
    eq('saturation alone', filterFor({...DEFAULTS, saturation:120}), 'saturate(120%)');

    const foil = BUILTIN_PRESETS.find(p => p.id === 'b-foil-port');
    eq('foil preset exists', !!foil, true);
    eq('foil preset is A4', foil?.settings.pageSize, 'a4');
    eq('foil preset saturation', foil?.settings.saturation, 150);
    eq('foil preset brightness', foil?.settings.brightness, 105);
    eq('foil preset counts as Laser', foil?.kind, 'Laser');
    eq('both orientations ship', FOIL_IDS.length, 2);
    eq('every foil id is a preset', FOIL_IDS.every(id => BUILTIN_PRESETS.some(p => p.id === id)), true);

    // No dormant keys: presetSettings cannot reach margin, dpi, jpeg or the card size.
    eq('foil presets declare only keys that apply',
       FOIL_IDS.map(id => Object.keys(BUILTIN_PRESETS.find(p => p.id === id).settings).sort().join(',')),
       ['brightness,contrast,foilTint,orientation,pageSize,saturation', 'brightness,contrast,foilTint,orientation,pageSize,saturation']);

    // The repair: declared image keys must actually apply.
    S.settings = {...DEFAULTS, saturation:100, contrast:100, foilTint:0};
    eq('applying the foil preset sets brightness', foil && presetSettings(foil).brightness, 105);
    eq('applying the foil preset sets saturation', foil && presetSettings(foil).saturation, 150);
    eq('applying the foil preset sets contrast', foil && presetSettings(foil).contrast, 110);
    eq('applying the foil preset sets foilTint', foil && presetSettings(foil).foilTint, 4);
    eq('applying the foil preset sets A4', foil && presetSettings(foil).pageSize, 'a4');

    // The accepted behaviour change, pinned: a laser preset resets a customised brightness.
    S.settings = {...DEFAULTS, brightness:110};
    eq('a laser preset now resets a customised brightness',
       presetSettings(BUILTIN_PRESETS.find(p => p.id === 'b-laser-port')).brightness, 100);

    // The allowlist must stay an allowlist, not become a spread.
    S.settings = {...DEFAULTS, margin:9};
    eq('a builtin preset still does not force its dormant margin',
       presetSettings(BUILTIN_PRESETS.find(p => p.id === 'b-laser-port')).margin, 9);

    for (const id of ['mf753', 'laser'])
      eq(`foil presets are offered for ${id}`, PRINTERS.find(p => p.id === id).presets.includes('b-foil-port'), true);
    eq('foil tips exist and are not the laser tips', typeof FOIL_TIPS !== 'undefined' && FOIL_TIPS.length > 0 && FOIL_TIPS !== LASER_TIPS, true);
    eq('foil tips reach the mf753 guide', typeof FOIL_TIPS !== 'undefined' && FOIL_TIPS.every(t => PRINTERS.find(p => p.id === 'mf753').tips.includes(t)), true);

    // Wiring: presets in the printer guide render and actually apply on click.
    S.printer = 'mf753'; S.settings = {...DEFAULTS}; renderPrinter();
    const btn = document.querySelector('#printerGuide [data-preset="b-foil-port"]');
    eq('foil preset button renders in the printer guide', !!btn, true);
    const guideLabel = id => document.querySelector(`#printerGuide [data-preset="${id}"] b`)?.textContent;
    eq('the foil guide button keeps its sheet, not just the orientation',
       guideLabel('b-foil-port'), 'A4 foil · Portrait');
    eq('the landscape foil guide button keeps its sheet too',
       guideLabel('b-foil-land'), 'A4 foil · Landscape');
    eq('a cardstock guide button still drops its kind',
       guideLabel('b-laser-port'), 'Black-core cardstock · Portrait');
    eq('no guide button is labelled by orientation alone',
       PRINTERS.find(p => p.id === 'mf753').presets.map(guideLabel).filter(l => /^(Landscape|Portrait)/.test(l)), []);
    btn?.click();
    eq('clicking it in the printer guide applies brightness', S.settings.brightness, 105);
    eq('clicking it in the printer guide applies saturation', S.settings.saturation, 150);
    eq('clicking it in the printer guide applies contrast', S.settings.contrast, 110);
    eq('clicking it in the printer guide applies foilTint', S.settings.foilTint, 4);
    eq('clicking it in the printer guide applies A4', S.settings.pageSize, 'a4');

    // Discoverability: the foil presets are in the main grid too, titled by sheet, not by vendor.
    S.settings = {...DEFAULTS, pageSize:'a4', orientation:'portrait', brightness:100, saturation:100}; renderPresets();
    const gridBtn = id => document.querySelector(`#presetGrid [data-preset="${id}"]`);
    eq('foil presets are in the paper grid', FOIL_IDS.map(id => !!gridBtn(id)), [true, true]);
    eq('landscape foil preset renders a landscape title', gridBtn('b-foil-land')?.querySelector('b').textContent.includes('(Landscape)'), true);
    eq('portrait foil preset renders a portrait title', gridBtn('b-foil-port')?.querySelector('b').textContent.includes('(Portrait)'), true);
    eq('foil preset title leads with the sheet', gridBtn('b-foil-land')?.querySelector('b').textContent.startsWith('A4 foil'), true);
    eq('foil portrait is not active at saturation 100', gridBtn('b-foil-port')?.getAttribute('aria-pressed'), 'false');
    eq('plain A4 portrait is active at saturation 100', gridBtn('b-a4')?.getAttribute('aria-pressed'), 'true');
    S.settings = {...DEFAULTS, pageSize:'a4', orientation:'portrait', brightness:105, saturation:150, contrast:110, foilTint:4}; renderPresets();
    eq('foil portrait is active at saturation 150', gridBtn('b-foil-port')?.getAttribute('aria-pressed'), 'true');
    eq('foil landscape is not active on a portrait sheet', gridBtn('b-foil-land')?.getAttribute('aria-pressed'), 'false');
    eq('the A3 tip says the vendor cuts to A4', FOIL_TIPS.some(t => /ProxyJak/.test(t) && /40\s*[×x]\s*A4/.test(t) && /A3/.test(t)), true);
    eq('the A3 tip keeps the printer-feed clause', FOIL_TIPS.some(t => /can feed A3/.test(t)), true);
    // Curl correction is panel-only: no profile can apply it, so the tip must say so.
    eq('a tip sends the user to the panel for Paper Curl Correction',
       FOIL_TIPS.some(t => /Paper Curl Correction/.test(t) && /panel/.test(t)
                           && /Special Paper Processing/.test(t)), true);
    // ...and it must say to leave it OFF. The tip used to say to switch it on
    // before a foil run, which the owner rejected: it costs print quality on
    // this printer and Canon's own manual warns it may fade the print. The
    // advice was reasoned from the manual and shipped because nothing could
    // contradict it, so the corrected version is pinned here rather than left
    // to be re-reasoned back the other way.
    const curlTip = FOIL_TIPS.find(t => /Paper Curl Correction/.test(t)) || '';
    eq('the curl tip says to leave it off', /leave\b[^.]*\boff\b/i.test(curlTip), true);
    eq('the curl tip does not tell anyone to switch it on',
       /switch\s+(<[^>]+>\s*)*Paper Curl Correction(\s*<[^>]+>)*\s+on\b/i.test(curlTip), false);
    eq('the curl tip gives a reason not to use it',
       /fade|print quality/i.test(curlTip), true);
    eq('the paper-type tip no longer names a Canon-only type generically',
       FOIL_TIPS.some(t => /Coated 2/.test(t)), false);
    eq('the Canon paper type is named on the mf753 entry',
       PRINTERS.find(p => p.id === 'mf753').tips.some(t => /Coated 2/.test(t)), true);

    // Clicking a foil preset in the paper grid switches printer; the toast must say so.
    S.printer = 'et2800'; S.printerByKind = {}; S.settings = {...DEFAULTS, pageSize:'a4', orientation:'portrait'};
    renderPresets(); gridBtn('b-foil-port')?.click();
    eq('clicking a foil preset moves to a laser printer', printerOf(S.printer).kind, 'Laser');
    eq('the toast says the printer switched', /Printer switched to /.test($('#toast').textContent), true);
  } catch (err) { fails.push(`${err.message}\n${err.stack}`); }
  finally { Object.assign(S, original); }
  return fails.length ? {failed:fails} : true;
})();
