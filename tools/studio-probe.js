// Preview shortcuts must preserve paper presets, calibration and keyboard actions.
(async () => {
  const original=JSON.parse(JSON.stringify(S)), oldPicker=openMpcPicker, oldRecommendations=cardRecommendations;
  const fails=[], keys=[], eq=(name,got,want)=>{if(got!==want)fails.push(`${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);};
  try {
    if(typeof syncPreviewControls!=='function')return {failed:['Preview shortcuts are missing']};
    closeModal(true);cardRecommendations=async()=>[];S.mode='print';applyMode();
    for(const printer of ['et2800','mf753']) for(const cameo of [false,true]) {
      S.printer=printer;S.settings={...DEFAULTS,silhouette:cameo,guides:cameo?'none':'corners',scaleX:99.5,offsetX:1.2,backOffsetX:2.25};renderAll();
      for(const paper of ['letter','a4']) for(const orientation of ['portrait','landscape']) {
        $('#quickPaper').value=paper;$('#quickPaper').dispatchEvent(new Event('change',{bubbles:true}));
        $(`[data-orientation="${orientation}"]`).click();syncPreviewControls();
        const label=`${printer}/${cameo?'cameo':'rotary'}/${paper}/${orientation}`, L=layout();
        eq(label+' paper',S.settings.pageSize,paper);eq(label+' orientation',S.settings.orientation,orientation);
        eq(label+' capacity',L.per,orientation==='portrait'?9:8);eq(label+' fits',L.fits,true);
        if(cameo)eq(label+' marks clear',regConflict(L),false);
        eq(label+' scale preserved',S.settings.scaleX,99.5);eq(label+' calibration preserved',S.settings.offsetX,1.2);eq(label+' back alignment preserved',S.settings.backOffsetX,2.25);
        eq(label+' selected control',$(`[data-orientation="${orientation}"]`).getAttribute('aria-pressed'),'true');
      }
    }
    S.settings={...DEFAULTS,pageSize:'custom',pageW:240,pageH:320,orientation:'portrait'};renderAll();syncPreviewControls();
    eq('custom paper remains available',$('#quickPaper').value,'custom');
    $('[data-orientation="landscape"]').click();eq('custom orientation keeps width',S.settings.pageW,240);eq('custom orientation keeps height',S.settings.pageH,320);
    const canvas=document.createElement('canvas');canvas.width=63;canvas.height=88;canvas.getContext('2d').fillRect(0,0,63,88);
    const key=await storeImage(await new Promise(r=>canvas.toBlob(r)));keys.push(key);
    const d={id:uid(),name:'Studio <deck> & art',entries:[{uid:uid(),name:'Keyboard card',qty:9,faces:[{name:'Keyboard card',custom:key}],tokens:[]}],updated:Date.now()};
    S.decks.push(d);S.deckId=d.id;S.settings={...DEFAULTS,pageSize:'letter',orientation:'portrait',bleed:0.75,cardRotation:'upright'};renderAll();switchTab('cards');await drawPreview();
    const before=JSON.stringify(S.settings), stage=$('#stage');
    setPreviewFocus(true);eq('focus hides sidebar',getComputedStyle($('main>aside')).display,'none');eq('focus keeps settings',JSON.stringify(S.settings),before);
    await drawPreview();eq('page label clears sticky controls',$('.pg .lbl').getBoundingClientRect().top>=$('.stage-controls').getBoundingClientRect().bottom,true);
    eq('focus button can restore sidebar',$('#toggleSidebar').textContent,'Show sidebar');
    const available=stage.clientHeight-$('.stage-controls').offsetHeight-56;
    eq('fit keeps portrait page within available height',layout().H*S.zoom<=available+1,true);
    eq('fit keeps portrait page within available width',layout().W*S.zoom<=stage.clientWidth-56,true);
    await $('#btnPdf').onclick();eq('export restores sidebar',document.body.classList.contains('preview-focus'),false);eq('export opens review',$('#tab-guide').classList.contains('on'),true);
    switchTab('cards');let picks=0;openMpcPicker=async()=>{picks++;};
    const thumb=$('#cardList img[data-act="art"]');eq('artwork thumbnail is keyboard reachable',thumb.tabIndex,0);
    for(const key of ['Enter',' ']){const count=picks;thumb.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));eq(key+' opens art once',picks-count,1);}
  } catch(err){fails.push(err.stack || err.message);}
  finally {
    document.body.classList.remove('preview-focus');const toggle=$('#toggleSidebar');if(toggle){toggle.textContent='Hide sidebar';toggle.setAttribute('aria-pressed','false');}
    openMpcPicker=oldPicker;cardRecommendations=oldRecommendations;Object.assign(S,original);
    for(const key of keys)await removeImageIfUnused(key);
    applyMode();renderAll();
  }
  return fails.length?{failed:fails}:true;
})();
