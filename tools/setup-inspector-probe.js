(async () => {
  const original = structuredClone(S), failed = [];
  const classes = ['inspector-collapsed', 'inspector-open', 'preview-focus'];
  const originalClasses = classes.map(name => document.body.classList.contains(name));
  const check = (label, pass) => { if (!pass) failed.push(label); };
  const visible = el => !!el?.getClientRects().length;
  const settings = $('#printSettingsView'), proof = $('#stage'), popover = $('#quickSetup');
  const fullWidth = () => visible(settings) && Math.abs(settings.getBoundingClientRect().width - settings.parentElement.clientWidth) <= 1;
  const change = (selector, value) => {
    const el = $(selector);
    if (el.type === 'checkbox') el.checked = value;
    else el.value = value;
    el.dispatchEvent(new Event('change',{bubbles:true}));
  };
  try {
    S.welcomed = true; closeModal(true); S.mode = 'print'; applyMode();
    S.settings = cleanSettings({...DEFAULTS, pageSize:'letter', orientation:'landscape', cols:4, rows:2});
    const canvas = document.createElement('canvas'); canvas.width = 630; canvas.height = 880;
    const image = await storeImage(await new Promise(resolve=>canvas.toBlob(resolve)));
    deck().entries = [{uid:uid(), name:'Print settings fixture', qty:20, faces:[{name:'Front', custom:image}]}];
    S.activeSheet = 1; S.showBacks = false; S.zoomMode = 'manual';
    renderAll(); setWorkspaceView('proof'); await drawPreview();
    const opener = innerWidth <= 820 ? $('[data-mview=setup]') : $('#toggleInspector');

    for (const collapsed of innerWidth <= 820 ? [false] : [true, false]) {
      if (innerWidth > 820) toggleInspector(!collapsed);
      opener.focus(); opener.click(); await sleep(220);
      check('Print settings has its full width with setup ' + (collapsed ? 'hidden' : 'visible'), fullWidth());
      check('Settings hides the proof and queue', !visible(proof) && !visible($('#workspaceInspector')));
      check('Settings has no horizontal scroll', settings.scrollWidth <= settings.clientWidth + 1);
      const preset = $('#presetGrid [data-preset="b-letter"]');
      check('Layout preset has room for readable words', preset.getBoundingClientRect().width >= 160);
      $('#btnBackToProof').click();
      check('Back restores proof and opener', visible(proof) && !visible(settings) && document.activeElement === opener);
      check('Back preserves sheet and zoom mode', S.activeSheet === 1 && S.zoomMode === 'manual');
    }

    if (innerWidth > 820) {
      for (const key of ['paper','layout','sides','cutting','alignment','color']) {
        const button = $(`[data-quick-setup="${key}"]`);
        button.scrollIntoView({block:'nearest'}); button.focus(); button.click(); await sleep(220);
        check(`${key} opens only a quick menu`, popover.matches(':popover-open') && visible(proof) && !visible(settings));
        check(`${key} announces the open menu`, button.getAttribute('aria-expanded') === 'true');
        const rect = popover.getBoundingClientRect();
        check(`${key} menu fits on-screen`, rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight + 1);
        if (key === 'paper') {
          change('#quickSetting-pageSize', 'a4');
          check('Paper edits the real setup', S.settings.pageSize === 'a4' && $('#inspPaper').textContent.includes('A4'));
        }
        if (key === 'layout') {
          change('#quickSetting-cols', 4);
          check('Layout edits the real grid', S.settings.cols === 4);
        }
        if (key === 'sides') {
          change('#quickSetting-backs', true);
          check('Sides updates the real setup and exposes duplex controls', S.settings.backs && !!$('#quickSetting-duplexMethod'));
        }
        if (key === 'cutting') {
          change('#quickCutTool', 'cameo');
          check('Cutting uses the existing Cameo layout', S.settings.silhouette);
          change('#quickCutTool', 'rotary');
        }
        if (key === 'alignment') {
          check('Quick Alignment offers profiles and a test sheet', !!$('#quickAlignmentProfile') && !!$('[data-quick-action="btnCal"]'));
          $('#quickSetupMore').click();
          check('Advanced link opens the matching full page', !popover.matches(':popover-open') && fullWidth() && settings.dataset.page === 'alignment');
          $('#btnBackToProof').click();
          check('Backing out returns focus to the Alignment row', document.activeElement === button && !visible(settings) && visible(proof));
          continue;
        }
        if (key === 'color') {
          change('#quickSetting-brightness', 110);
          check('Color uses the same brightness as full settings', S.settings.brightness === 110 && $('#num-brightness').value === '110');
          button.click();
          check('The same button toggles the quick menu closed', !popover.matches(':popover-open') && button.getAttribute('aria-expanded') === 'false');
          button.click();
        }
        $('#quickSetupClose').click();
        check(`${key} closes and restores focus`, !popover.matches(':popover-open') && document.activeElement === button && button.getAttribute('aria-expanded') === 'false');
      }
      $('#btnCloseSetup').click();
      check('Hidden setup can be reopened', visible($('#btnShowPrintSetup')));
      $('#btnShowPrintSetup').click();
      check('Show setup restores the sidebar', visible($('#workspaceInspector')) && !visible(settings));
    }

    return failed.length ? {failed} : true;
  } finally {
    closeQuickSetup();
    document.body.classList.remove('print-settings-active');
    classes.forEach((name, i)=>document.body.classList.toggle(name, originalClasses[i]));
    Object.assign(S, original); applyMode(); renderAll();
  }
})();
