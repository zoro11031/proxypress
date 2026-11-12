// Card matching, suggestions and shared preview/PDF guide geometry.
(async () => {
  const failed = [], original = JSON.parse(JSON.stringify(S)), oldSf = sf, oldAuto = mpcAutofill, oldDoc = newDoc, oldRecommendations = typeof cardRecommendations === 'function' ? cardRecommendations : null;
  const oldInput = $('#listIn').value, images = [], artifacts = [];
  const eq = (name, got, want) => { if (got !== want) failed.push(`${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); };
  const near = (name, got, want) => { if (!Number.isFinite(got) || Math.abs(got-want) > 0.001) failed.push(`${name}: ${got} != ${want}`); };
  const wait = async fn => { for (let i = 0; i < 100; i++) { if (fn()) return; await sleep(20); } throw Error('Timed out waiting for UI'); };
  try {
    if (typeof applyCardMatch !== 'function' || typeof collectSuggestions !== 'function') return {failed:['Card-match correction and deck suggestions are missing']};
    cardRecommendations = async () => [];
    closeModal(true); S.mode = 'print'; applyMode(); switchTab('cards');
    const canvas = document.createElement('canvas'); canvas.width = 252; canvas.height = 352;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#182b43'; ctx.fillRect(0,0,252,352);
    ctx.fillStyle = '#bc8a4f'; ctx.fillRect(8,8,236,336); ctx.fillStyle = '#1b3747'; ctx.fillRect(16,42,220,174);
    ctx.fillStyle = '#f7edd9'; ctx.fillRect(16,224,220,104); ctx.font = 'bold 18px Georgia'; ctx.fillText('Preview card',22,31);
    ctx.fillStyle = '#152334'; ctx.font = '14px Georgia'; ctx.fillText('Print at actual size.',24,250);
    const blob = await new Promise(r => canvas.toBlob(r)), image = await storeImage(blob); images.push(image);
    const art = canvas.toDataURL(), tokenId = '22222222-2222-2222-2222-222222222222';
    const card = {id:'11111111-1111-1111-1111-111111111111',name:'Correct <card> & name',set:'tst',set_name:'Test set',collector_number:'7',layout:'normal',lang:'en',image_uris:{png:art,normal:art},all_parts:[{id:tokenId,name:'Linked token',component:'token',type_line:'Token Creature'}]};
    const d = {id:uid(),name:'Quality check',entries:[{uid:uid(),qty:3,name:'Wrong match',faces:[{name:'Wrong match',custom:image}],tokens:[]}],updated:Date.now()};
    S.decks.push(d); S.deckId = d.id; S.settings = {...DEFAULTS}; renderAll();
    openCtx(20,20,d.entries[0],0,1); eq('right-click offers match correction', !!$('[data-c="match"]'), true); closeCtx();
    await applyCardMatch({e:d.entries[0],copy:1,deckId:d.id},card,true);
    eq('only selected copy changes', d.entries.map(e => `${e.qty}:${e.name}`).join('|'), `1:Wrong match|1:${card.name}|1:Wrong match`);
    eq('quantity preserved', d.entries.reduce((n,e) => n+e.qty,0),3);
    eq('chosen artwork retained', d.entries[1].faces[0].custom,image);
    eq('correct identity stored', d.entries[1].scryId,card.id);
    eq('token links corrected', d.entries[1].tokens[0],tokenId);
    eq('split copies do not share face objects', d.entries[0].faces === d.entries[2].faces,false);
    await applyCardMatch({e:d.entries[0],deckId:d.id},card,false);
    eq('replacement artwork uses chosen printing',d.entries[0].faces[0].png,art);
    eq('replacement clears uploaded artwork',d.entries[0].faces[0].custom,undefined);
    try { await applyCardMatch({e:d.entries[2],deckId:'other-deck'},card,false); failed.push('cross-deck match accepted'); } catch {}
    const dfc = {...card,image_uris:undefined,card_faces:[{name:'Front',image_uris:card.image_uris},{name:'Back',image_uris:card.image_uris}]};
    try { await applyCardMatch({e:d.entries[2],deckId:d.id},dfc,true); failed.push('incompatible retained faces accepted'); } catch {}
    eq('failed correction keeps original card',d.entries[2].name,'Wrong match');
    sf = async () => ({data:[card],has_more:false}); openCardMatch(d.entries[2]);
    await wait(() => !!$('[data-match]')); eq('match result escapes names',$('[data-match] figcaption').textContent.includes(card.name),true);
    eq('match result does not inject HTML',!!$('[data-match] card'),false); closeModal(true);
    d.entries=[{...toEntry({...card,name:'Snapcaster Mage',type_line:'Creature — Human Wizard',color_identity:['U']},1),faces:[{name:'Snapcaster Mage',custom:image}]},
      {...toEntry({...card,id:tokenId,name:'Counterspell',color_identity:['U']},1),faces:[{name:'Counterspell',custom:image}]}];
    const mission={...card,id:'33333333-3333-3333-3333-333333333333',name:'Mission Briefing',color_identity:['U']};
    const gearhulk={...card,id:'44444444-4444-4444-4444-444444444444',name:'Torrential Gearhulk',color_identity:['U']};
    const offColor={...card,id:'55555555-5555-5555-5555-555555555555',name:'Off-color card',color_identity:['G']};
    cardRecommendations=async name=>[{name:'Mission Briefing',score:70,kind:'Similar card'},{name:'Counterspell',score:100,kind:'Similar card'},
      ...(name==='Snapcaster Mage'?[{name:'Torrential Gearhulk',score:80,kind:'Often played together'},{name:'Off-color card',score:90,kind:'Similar card'}]:[])];
    sf=async()=>({data:[mission,gearhulk,offColor]}); mpcAutofill=async()=>({});
    suggestionsWanted = true; renderSuggestions(true); clearTimeout(suggestionTimer);
    await collectSuggestions(d,suggestionState.key,suggestionRun,suggestionSeeds(d));
    eq('suggestions exclude existing cards and off-color cards',currentSuggestions().length,2);
    eq('cards supported by multiple deck cards rank first',currentSuggestions()[0].card.name,'Mission Briefing');
    eq('quick suggestions have add buttons',$$('#suggestionList [data-suggest-add]').length,2);
    eq('card colors survive backup',cleanDeck(d).entries[0].colorIdentity.join(''),'U');
    $('#suggestionExplore').click(); eq('explore shows card suggestions',$$('.suggestion-tile').length,2);
    $('[data-suggest-add="'+mission.id+'"]',$('#modal')).click();
    await wait(()=>d.entries.some(e=>e.scryId===mission.id));
    eq('added suggestion disappears from quick list',currentSuggestions().length,1);
    eq('adding a suggestion adds one copy',d.entries.at(-1).qty,1);
    await addDeckSuggestion(mission.id);eq('added suggestion cannot be duplicated',d.entries.filter(e=>e.scryId===mission.id).length,1);
    closeModal(true); clearTimeout(suggestionTimer);
    const held=d.entries;d.entries=[];renderSuggestions();eq('clearing the deck clears its suggestions',currentSuggestions().length,0);d.entries=held;
    const pendingResults=[];cardRecommendations=()=>new Promise(r=>pendingResults.push(r));
    renderSuggestions(true);clearTimeout(suggestionTimer);
    const pending=collectSuggestions(d,suggestionState.key,suggestionRun,suggestionSeeds(d));
    const other={id:uid(),name:'Other deck',entries:[],updated:Date.now()};S.decks.push(other);S.deckId=other.id;renderSuggestions();
    pendingResults.forEach(r=>r([{name:'Stale card',score:100}]));await pending;
    eq('late suggestions never leak into another deck',currentSuggestions().length,0);
    S.deckId=d.id;cardRecommendations=async()=>[];
    d.entries = [{uid:uid(),name:'Preview card',qty:9,faces:[{name:'Preview card',custom:image}],tokens:[]}];
    for (const orientation of ['portrait','landscape']) {
      S.settings = {...DEFAULTS,pageSize:'letter',orientation,cardRotation:'upright',bleed:orientation==='portrait'?0.75:2,dpi:72,guides:'corners',guideShape:'brackets',guideStyle:'solid',guidePlacement:'outside',guideHalo:false};
      const L = layout(), lines = paginate(buildSlots(),L.per).flatMap(page=>guideLines(L,page.length)), p = slotPos(L,0,false), T=makeT(L,false), drawn=[];
      eq(`${orientation} eight bracket segments per card`,lines.length,72);
      eq(`${orientation} brackets outside trim`,lines[0][0]<p.x+S.settings.bleed,true);
      near(`${orientation} full bracket length`,lines[0][2]-lines[0][0],6);
      for (const [a,b,c,e] of lines) eq(`${orientation} marks within paper`,a>=0&&b>=0&&c<=L.W&&e<=L.H,true);
      eq('partial sheet has no extra guides',guideLines(L,2).length,16);
      S.settings.guidePlacement='inside'; near('inside bracket starts at trim',guideLines(L,1)[0][0],p.x+S.settings.bleed); S.settings.guidePlacement='outside';
      S.settings.guideStyle='dashed'; eq('all guide segments dashed',guideLines(L,1).every(l=>l[4]),true); S.settings.guideStyle='solid';
      S.settings.guides='outline'; eq('full outline uses four sides',guideLines(L,2).length,8); S.settings.guides='corners';
      let pdf;
      newDoc = (...args) => { const doc=oldDoc(...args), line=doc.line; doc.line=function(...coords){drawn.push(coords);return line.apply(this,coords);};doc.save=()=>{pdf=doc.output('datauristring').split(',')[1];};return doc; };
      await exportPDF(true); closeModal(true);
      eq(`${orientation} PDF draws same number of guides`,drawn.length,lines.length);
      lines.forEach(([a,b,c,e],i)=>[T.x(a),T.y(b),T.x(c),T.y(e)].forEach((v,k)=>near('PDF guide coordinate',drawn[i]?.[k] ?? NaN,v)));
      artifacts.push({orientation,pdf});
    }
    const settings=cleanSettings({...S.settings,guides:'outline',guideStyle:'dashed',guidePlacement:'inside'});
    eq('new guide options survive saved settings',`${settings.guides}/${settings.guideStyle}/${settings.guidePlacement}`,'outline/dashed/inside');
    window.__probeArtifacts=artifacts;
  } catch (err) { failed.push(err.stack || err.message); }
  finally {
    sf=oldSf; mpcAutofill=oldAuto; newDoc=oldDoc; closeModal(true); closeCtx();
    if (typeof suggestionTimer!=='undefined') clearTimeout(suggestionTimer);
    if (oldRecommendations) cardRecommendations=oldRecommendations;
    Object.assign(S,original); $('#listIn').value=oldInput;
    for (const key of images) await removeImageIfUnused(key);
    applyMode(); renderAll();
  }
  return failed.length ? {failed} : true;
})();
