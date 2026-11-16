(async () => {
  const saved={decks:S.decks,deckId:S.deckId,settings:S.settings};
  const Real=window.jspdf.jsPDF, outputs=[];
  window.jspdf={...window.jspdf,jsPDF:function(...args){const doc=new Real(...args);doc.save=name=>outputs.push({name,pdf:btoa(Array.from(new Uint8Array(doc.output('arraybuffer')),b=>String.fromCharCode(b)).join('')),pages:doc.internal.pages.slice(1).map(p=>p.join('\n'))});return doc;}};
  try {
    S.welcomed=true;closeModal(true);
    const canvas=document.createElement('canvas');canvas.width=630;canvas.height=880;canvas.getContext('2d').fillRect(0,0,630,880);
    const key='sheet-export-fixture';await store.set('images',key,await new Promise(r=>canvas.toBlob(r)));
    const d={id:'sheet-fixture',name:'Replacement fixture',entries:[{uid:'repeated',name:'Repeated card',qty:19,faces:[{name:'Front',custom:key}]}]};
    S.decks=[d];S.deckId=d.id;S.settings=cleanSettings({...DEFAULTS,pageSize:'letter',orientation:'landscape',cols:4,rows:2,backs:false,dpi:100});
    $('#exportScope').value='all';await exportPDF(true);
    if(outputs.length!==1||outputs[0].pages.length!==3)return {failed:['Full export must contain three pages']};
    for(let index=0;index<3;index++){
      S.activeSheet=index;$('#exportScope').value='current';await exportPDF(true);
      const part=outputs.at(-1);
      if(part.pages.length!==1||part.pages[0].split('\n').slice(2).join('\n')!==outputs[0].pages[index].split('\n').slice(2).join('\n'))return {failed:['Replacement page differs from full page '+(index+1)]};
      if(!part.name.endsWith('-sheet-'+(index+1)+'.pdf'))return {failed:['Original sheet number absent from filename']};
    }
    // A DFC on the first sheet requires blank matching back pages on later sheets.
    d.entries=[{uid:'double',name:'Double face',qty:1,faces:[{name:'Front',custom:key},{name:'Back',custom:key}]},{uid:'single',name:'Single face',qty:18,faces:[{name:'Front',custom:key}]}];
    S.settings.dfcMode='duplex';$('#exportScope').value='all';
    await exportPDF(true);const fullDuplex=outputs.at(-1);
    if(fullDuplex.pages.length!==6)return {failed:['Mixed DFC job must retain six PDF pages']};
    for(let index=0;index<3;index++){
      S.activeSheet=index;$('#exportScope').value='current';await exportPDF(true);const part=outputs.at(-1);
      if(part.pages.length!==2)return {failed:['Replacement sheet must keep a matching blank back']};
      for(let side=0;side<2;side++) if(part.pages[side].split('\n').slice(2).join('\n')!==fullDuplex.pages[index*2+side].split('\n').slice(2).join('\n'))return {failed:['Duplex replacement differs at sheet '+(index+1)+' side '+side]};
    }
    window.__probeArtifacts=outputs;
    return true;
  } finally {window.jspdf={...window.jspdf,jsPDF:Real};Object.assign(S,saved);$('#exportScope').value='all';renderAll();}
})();
