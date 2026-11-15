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
    eq('foil preset saturation', foil?.settings.saturation, 120);
    eq('foil preset brightness', foil?.settings.brightness, 100);
    eq('foil preset counts as Laser', foil?.kind, 'Laser');
    eq('both orientations ship', BUILTIN_PRESETS.filter(p => p.id.startsWith('b-foil')).length, 2);

    // The repair: declared image keys must actually apply.
    S.settings = {...DEFAULTS, saturation:100};
    eq('applying the foil preset sets saturation', foil && presetSettings(foil).saturation, 120);
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
    btn?.click();
    eq('clicking it in the printer guide applies saturation', S.settings.saturation, 120);
    eq('clicking it in the printer guide applies A4', S.settings.pageSize, 'a4');
    eq('foil presets stay out of the paper grid', !!document.querySelector('#presetGrid [data-preset="b-foil-port"]'), false);
  } catch (err) { fails.push(`${err.message}\n${err.stack}`); }
  finally { Object.assign(S, original); }
  return fails.length ? {failed:fails} : true;
})();
