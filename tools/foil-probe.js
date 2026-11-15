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
  } catch (err) { fails.push(`${err.message}\n${err.stack}`); }
  finally { Object.assign(S, original); }
  return fails.length ? {failed:fails} : true;
})();
