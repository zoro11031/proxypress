(async()=>{
  const saved=structuredClone(S),failed=[];const check=(n,v)=>{if(!v)failed.push(n);};const wait=async fn=>{for(let i=0;i<150;i++){if(fn())return;await sleep(20);}throw Error('Order review did not open');};
  try{
    S.welcomed=true;closeModal(true);const origin=deck(),count=S.decks.length;
    const xml='<order><details><quantity>3</quantity></details><fronts><card><id>local-front.png</id><slots>0-2</slots><name>Local front.png</name></card></fronts></order>';
    const cancelled=importMpcXml(xml,'Order fixture.xml',{review:true});await wait(()=>!!$('#btnReviewConfirm'));
    check('order intake stages before creating project',S.decks.length===count&&$('#btnReviewConfirm').textContent==='Create project');
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await cancelled;
    check('cancel preserves origin and recoverable XML',S.deckId===origin.id&&S.decks.length===count&&origin.importDraft.format==='order-xml'&&origin.importDraft.text===xml);
    $('#btnResumeImport').click();await wait(()=>!!$('#btnReviewConfirm'));$('#btnReviewConfirm').click();await wait(()=>S.decks.length===count+1);
    check('resume commits new project with correct copy count',deck().name==='Order fixture'&&deck().entries.reduce((n,e)=>n+e.qty,0)===3);
    check('order keeps file attachment identity',deck().entries[0].faces[0].file==='local-front.png');
    check('successful order intake clears only its source draft',!origin.importDraft);
    const before=S.decks.length;const bad=xml.replace('0-2','0-999999999');
    check('damaged huge range is rejected without creating project',await importMpcXml(bad,'Damaged.xml',{review:true})===false&&S.decks.length===before);
    return failed.length?{failed}:true;
  }catch(err){return {failed:[...failed,err.stack||err.message]};}finally{closeModal(true);Object.assign(S,saved);save();renderAll();}
})();
