// Run through shares-check.py --browser against a public, password-free link.
(async()=>{
  const failed=[],eq=(name,a,b)=>{if(a!==b)failed.push(`${name}: got ${JSON.stringify(a)} want ${JSON.stringify(b)}`);};
  eq('public URL sets capability token',/^[A-Za-z0-9_-]{32}$/.test(SHARE_TOKEN||''),true);
  eq('public URL has no login form',!!$('input[type="password"]'),false);
  eq('opening shared deck asks before importing',!!$('#serverShareOpen'),true);
  eq('saving a local copy is explicit',$('#serverShareOpen')?.textContent,'Save to my decks');
  eq('shared print settings are opt-in',$('#serverShareLayout')?.checked,false);
  const existing=S.decks.map(d=>d.id);
  S.settings={...S.settings,pageSize:'a4',orientation:'landscape',offsetX:2,scaleX:99};S.printer='mf753';
  if($('#serverShareOpen'))await $('#serverShareOpen').onclick();
  eq('shared 100-card deck opens',deck().entries.reduce((n,e)=>n+e.qty,0),100);
  eq('copied artwork is stored locally',!!(await store.get('images',deck().entries[0].faces[0].custom)),true);
  eq('existing local decks remain',existing.every(id=>S.decks.some(d=>d.id===id)),true);
  eq('saved copy has its own card ids',deck().entries[0].uid!=='test',true);
  eq('saved copy keeps paper size',S.settings.pageSize,'a4');
  eq('saved copy keeps orientation',S.settings.orientation,'landscape');
  eq('saved copy keeps printer',S.printer,'mf753');
  eq('saved copy keeps calibration',S.settings.offsetX,2);
  await sleep(400);
  eq('copy persists in local decks',(await store.get('kv','decks')).some(d=>d.id===S.deckId),true);
  const face=deck().entries[0].faces[0], image=await store.get('images',face.custom);
  const data={app:'proxy-press',type:'print-deck',version:1,deck:deck(),settings:{pageSize:'letter'},images:{[face.custom]:await blobToData(image)}};
  await openPrintDeckFile(new File([JSON.stringify(data)],'shared-deck.json',{type:'application/json'}));
  eq('offline shared settings are also opt-in',$('#printDeckLayout')?.checked,false);
  eq('offline copy action is explicit',$('#printDeckConfirm')?.textContent,'Save to my decks');
  closeModal(true);
  eq('share management unavailable to guests',$('#manageShares').hidden,true);
  eq('guest cannot create share links',$('#shareDeckLink').hidden,true);
  eq('guest server routes stay within shared namespace',serverPath('/assets/manifest.json'),'/share/'+SHARE_TOKEN+'/assets/manifest.json');
  await drawPreview();
  eq('shared deck produces sheets',$$('#pages .pg').length>0,true);
  return failed.length?{failed}:true;
})()
