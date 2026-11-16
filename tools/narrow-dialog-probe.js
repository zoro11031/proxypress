(async()=>{
  const original=structuredClone(S),oldSf=sf,oldApi=mpcApi,oldSearch=mpcSearch,oldCards=mpcCards,failed=[];
  const check=(name,value)=>{if(!value)failed.push(name);};
  try{
    S.welcomed=true;closeModal(true);sf=async()=>({data:[]});mpcApi=async()=>({results:[],data:[]});mpcSearch=async()=>new Map();mpcCards=async()=>[];
    const c=document.createElement('canvas');c.width=630;c.height=880;const key=await storeImage(await new Promise(r=>c.toBlob(r)));
    const e={uid:uid(),name:'A long card name with a long face label and 100 physical copies',qty:100,faces:[{name:'A long face name for the artwork comparison',custom:key}]};deck().entries=[e];renderAll();
    await openMpcPicker({e,i:0,copies:[{uid:e.uid,copies:[99]}],defaultTab:'local'});await sleep(100);
    const bd=$('#modal .bd');check('art dialog has no sideways overflow',bd.scrollWidth<=bd.clientWidth+1);
    for(const button of $$('.source-nav-tabs button')){const r=button.getBoundingClientRect(),b=bd.getBoundingClientRect();check('source tab stays inside dialog',r.left>=b.left&&r.right<=b.right);}
    $('#btnCmpCurrent').click();check('Current view is selectable',$('#cmpGrid').classList.contains('show-current'));
    $('#btnCmpCandidate').click();check('Candidate view is selectable',$('#cmpGrid').classList.contains('show-candidate'));
    const first=modalFocusable()[0],last=modalFocusable().at(-1);last.focus();last.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));check('modal keyboard focus wraps',document.activeElement===first);
    closeModal(true);setWorkspaceView('cards');const more=$('#cardList [data-act=more]') || $('#cardList .more');more.focus();
    openCtx(innerWidth-1,innerHeight-1,e,0,99);const r=$('#ctx').getBoundingClientRect();check('corner menu stays on screen',r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight);
    const buttons=$$('#ctx button');check('menu opens with keyboard focus',document.activeElement===buttons[0]);buttons[0].dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));check('menu arrow navigation works',document.activeElement===buttons[1]);
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));check('Escape restores row focus',document.activeElement===more&&!$('#ctx').classList.contains('on'));
    return failed.length?{failed}:true;
  }finally{closeModal(true);closeCtx();sf=oldSf;mpcApi=oldApi;mpcSearch=oldSearch;mpcCards=oldCards;Object.assign(S,original);renderAll();}
})();
