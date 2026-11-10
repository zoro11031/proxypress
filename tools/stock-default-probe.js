// Order cardstock defaults and one-time saved-choice migration.
(async () => {
  const original = JSON.parse(JSON.stringify(S)), get = store.get, set = store.set, fails = [];
  const eq = (name, got, want) => { if (JSON.stringify(got) !== JSON.stringify(want)) fails.push(`${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); };
  const d = {id:'stock-probe', name:'Saved deck', entries:[], updated:1}, kv = {decks:[d], presets:[]};
  store.get = async (_, key) => kv[key];
  store.set = async (_, key, value) => { kv[key] = JSON.parse(JSON.stringify(value)); };
  try {
    eq('new stock default', MPC_DEFAULTS.stock, '(S33) Superior Smooth');
    for (const stock of MPC_STOCKS) {
      kv.ui = {deckId:d.id, settings:{...DEFAULTS, offsetX:2.5}, printer:'mf753', mode:'order', mpc:{...MPC_DEFAULTS, stock, minDpi:600}};
      await load();
      eq(`${stock} overwritten on upgrade`, S.mpc.stock, '(S33) Superior Smooth');
      eq(`${stock} migration persisted`, kv.ui.mpc.stock, '(S33) Superior Smooth');
      eq(`${stock} migration recorded`, kv.ui.orderStockVersion, 1);
      eq('alignment preserved', S.settings.offsetX, 2.5);
      eq('search settings preserved', S.mpc.minDpi, 600);
      eq('printer preserved', S.printer, 'mf753');
      eq('deck preserved', S.decks[0].id, d.id);
    }
    renderOrder();
    eq('selector shows S33 after upgrade', $('#oStock').value, '(S33) Superior Smooth');
    $('#oStock').value = '(S30) Standard Smooth'; $('#oStock').dispatchEvent(new Event('change'));
    await sleep(350); await load();
    eq('later deliberate stock choice saves normally', S.mpc.stock, '(S30) Standard Smooth');
    kv.ui = undefined; await load();
    eq('fresh settings use S33', S.mpc.stock, '(S33) Superior Smooth');
  } catch (err) { fails.push(`${err.message}\n${err.stack}`); }
  finally {
    clearTimeout(saveTimer); store.get = get; store.set = set; Object.assign(S, original); renderAll();
  }
  return fails.length ? {failed:fails} : true;
})();
