(async()=>{
  const saved=structuredClone(S),oldDownload=download,outputs=[],failed=[];
  const check=(name,value)=>{if(!value)failed.push(name);};
  try{
    S.welcomed=true;closeModal(true);const c=document.createElement('canvas');c.width=630;c.height=880;c.getContext('2d').fillRect(0,0,630,880);
    const key=await storeImage(await new Promise(r=>c.toBlob(r)));
    download=(blob,name)=>outputs.push({blob,name});
    for(const pageSize of ['letter','a4'])for(const orientation of ['landscape','portrait']){
      S.settings=cleanSettings({...DEFAULTS,pageSize,orientation,...cameoPaperLayout(orientation),silhouette:true,guides:'none',backs:false});
      deck().entries=[{uid:uid(),name:'Cut parity',qty:layout().per*2+3,faces:[{name:'Front',custom:key}]}];
      const job=buildPrintJob();$('#exportScope').value='current';
      for(let sheet=0;sheet<3;sheet++)for(const fmt of ['svg','dxf','studio3']){
        S.activeSheet=sheet;const full=CUT_FORMATS[fmt].build(sheet,job);await downloadCutFile(fmt);
        const out=outputs.at(-1),expected=new Uint8Array(await new Blob([await full]).arrayBuffer()),actual=new Uint8Array(await out.blob.arrayBuffer());
        check(`${pageSize}/${orientation}/${fmt}/sheet ${sheet+1} bytes match`,expected.length===actual.length&&expected.every((v,i)=>v===actual[i]));
        check('cut filename retains sheet '+(sheet+1),out.name.endsWith('-sheet-'+(sheet+1)+'.'+fmt));
      }
    }
    const count=outputs.length;S.settings.offsetX=500;await downloadCutFile('svg',0);
    check('cut download uses the same blocking geometry validation',outputs.length===count&&$('#overlay').classList.contains('on'));
    closeModal(true);const originalPreflight=runPreflight;let resume;
    const waiting=new Promise(resolve=>resume=resolve);
    try {
      runPreflight=async()=>{await waiting;return {valid:false,errors:[{message:'Old job failed'}],warnings:[]};};
      const cutPending=downloadCutFile('svg',0),pdfPending=exportPDF(true);
      deck().name+=' changed';resume();await Promise.all([cutPending,pdfPending]);
      check('stale export validation cannot open another project review',outputs.length===count&&!$('#overlay').classList.contains('on'));
    } finally {runPreflight=originalPreflight;}
    window.__probeArtifacts={files:outputs.map(o=>({name:o.name,bytes:o.blob.size})),checks:failed.length===0};
    return failed.length?{failed}:true;
  }finally{download=oldDownload;closeModal(true);Object.assign(S,saved);$('#exportScope').value='all';renderAll();}
})();
