(async () => {
  const commit=store.commit;
  const pause=()=>new Promise(r=>setTimeout(r,500));
  try {
    save();await pause();
    if($('#saveStatus').textContent!=='Saved')return {failed:['Durable transaction did not report Saved']};
    store.commit=async()=>{throw new Error('Injected quota failure');};
    save();await pause();
    if(!$('#saveStatus').textContent.startsWith('Save failed'))return {failed:['Storage failure reported as saved']};
    store.commit=commit;save();await pause();
    if($('#saveStatus').textContent!=='Saved')return {failed:['Retry did not recover']};
    const data=await store.get('kv','decks');
    if(JSON.stringify(data)!==JSON.stringify(S.decks))return {failed:['Durable project differs from current project']};
    return true;
  } finally {store.commit=commit;}
})();
