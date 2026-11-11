// Run through shares-check.py --browser against a public, password-free link.
(async()=>{
  const failed=[],eq=(name,a,b)=>{if(a!==b)failed.push(`${name}: got ${JSON.stringify(a)} want ${JSON.stringify(b)}`);};
  eq('public URL sets capability token',/^[A-Za-z0-9_-]{32}$/.test(SHARE_TOKEN||''),true);
  eq('public URL has no login form',!!$('input[type="password"]'),false);
  eq('opening shared deck asks before importing',!!$('#serverShareOpen'),true);
  if($('#serverShareOpen'))await $('#serverShareOpen').onclick();
  eq('shared 100-card deck opens',deck().entries.reduce((n,e)=>n+e.qty,0),100);
  eq('copied artwork is stored locally',!!(await store.get('images',deck().entries[0].faces[0].custom)),true);
  eq('share management unavailable to guests',$('#manageShares').hidden,true);
  eq('guest cannot create share links',$('#shareDeckLink').hidden,true);
  eq('guest server routes stay within shared namespace',serverPath('/assets/manifest.json'),'/share/'+SHARE_TOKEN+'/assets/manifest.json');
  await drawPreview();
  eq('shared deck produces sheets',$$('#pages .pg').length>0,true);
  return failed.length?{failed}:true;
})()
