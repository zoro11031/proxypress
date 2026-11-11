// Cut-guide persistence, bounds, controls, and shared preview/PDF layering.
(async () => {
  const original = JSON.parse(JSON.stringify(S)), oldDoc = newDoc, failed = [], artifacts = [];
  let image;
  const eq = (name, got, want) => { if (got !== want) failed.push(`${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); };
  const near = (a,b) => Math.abs(a-b) < 0.001;
  try {
    let settings = cleanSettings({guidePlacement:'outside'});
    eq('old default migrates inside', settings.guidePlacement, 'inside');
    settings = cleanSettings({guidePlacement:'outside',guidePlacementSet:true});
    for (let i=0;i<3;i++) settings=cleanSettings(JSON.parse(JSON.stringify(settings)));
    eq('explicit outside survives repeated loads', settings.guidePlacement, 'outside');
    eq('untrusted string does not bypass migration', cleanSettings({guidePlacement:'outside',guidePlacementSet:'false'}).guidePlacement, 'inside');
    S.mode='print'; applyMode(); S.showCuts=false;
    S.settings={...DEFAULTS,guideShape:'ticks',guidePlacement:'outside'};
    renderAll();
    $('#rotaryGuidePlacement').value='inside'; $('#rotaryGuidePlacement').dispatchEvent(new Event('change'));
    $('#rotaryGuidePlacement').value='outside'; $('#rotaryGuidePlacement').dispatchEvent(new Event('change'));
    eq('UI placement survives reload', cleanSettings(cleanSettings(S.settings)).guidePlacement, 'outside');
    $('#rotarySection [data-guide="all"]').click();
    eq('preset keeps shape',S.settings.guideShape,'ticks');
    eq('preset keeps placement',S.settings.guidePlacement,'outside');
    for (const bleed of [0,0.5,1,2]) for (const gap of [0,1,4]) for (const guideShape of ['ticks','brackets']) {
      S.settings={...DEFAULTS,cardRotation:'upright',bleed,gap,guides:'corners',guideShape,guidePlacement:'outside'};
      const L=layout(), n=L.per, lines=guideLines(L,n);
      for (const [a,b,c,d] of lines) {
        if (Math.min(a,c)<GUIDE_EDGE-0.001 || Math.min(b,d)<GUIDE_EDGE-0.001 || Math.max(a,c)>L.W-GUIDE_EDGE+0.001 || Math.max(b,d)>L.H-GUIDE_EDGE+0.001) failed.push(`outside ${guideShape} leaves paper: bleed ${bleed}, gap ${gap}`);
        for (let i=0;i<n;i++) {
          const p=slotPos(L,i,false), x=p.x+bleed, y=p.y+bleed;
          const crosses = near(b,d)
            ? b>=y-0.001 && b<=y+L.ch+0.001 && Math.min(c,a)<x+L.cw-0.001 && Math.max(c,a)>x+0.001
            : a>=x-0.001 && a<=x+L.cw+0.001 && Math.min(b,d)<y+L.ch-0.001 && Math.max(b,d)>y+0.001;
          if (crosses) failed.push(`outside ${guideShape} crosses trim: bleed ${bleed}, gap ${gap}, card ${i}`);
        }
      }
    }
    S.settings={...DEFAULTS,cardW:4,cardH:4,cols:1,rows:1,guides:'corners',guideShape:'ticks',guidePlacement:'inside'};
    const small=layout(), p=slotPos(small,0,false), x=p.x+S.settings.bleed, y=p.y+S.settings.bleed;
    eq('small-card ticks stay within trim',guideLines(small,1).every(([a,b,c,d])=>Math.min(a,c)>=x && Math.max(a,c)<=x+small.cw && Math.min(b,d)>=y && Math.max(b,d)<=y+small.ch),true);
    const canvas=document.createElement('canvas');canvas.width=126;canvas.height=176;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#efc87b';ctx.fillRect(0,0,126,176);
    ctx.fillStyle='#254b67';ctx.fillRect(10,14,106,100);ctx.fillStyle='#fff';ctx.fillRect(10,124,106,40);
    ctx.fillStyle='#142c40';ctx.font='12px sans-serif';ctx.fillText('Guide review',18,145);
    image=await storeImage(await new Promise(r=>canvas.toBlob(r)));
    const deckData={id:uid(),name:'Guide review',entries:[{uid:uid(),qty:9,name:'Guide card',faces:[{name:'Guide card',custom:image}],tokens:[]}],updated:Date.now()};
    S.decks.push(deckData);S.deckId=deckData.id;
    for (const orientation of ['portrait','landscape']) for (const guideShape of ['brackets','ticks']) for (const guidePlacement of ['inside','outside']) {
      const label=`${orientation}/${guideShape}/${guidePlacement}`;
      S.settings={...DEFAULTS,orientation,cardRotation:'upright',guides:'all',guideShape,guidePlacement,bleed:2,dpi:72};
      const L=layout(), pages=paginate(buildSlots(),L.per), T=makeT(L,false);
      await drawPreview();
      const preview=$('#pages .pg'), lines=guideLines(L,pages[0].length), under=lines.filter(l=>!l[6]), over=lines.filter(l=>l[6]);
      const p0=slotPos(L,0,false), trimX=p0.x+S.settings.bleed, tickGap=guideShape==='ticks'?1.5:0;
      eq(`${label} shape and placement`,guidePlacement==='inside' ? near(over[0][0],trimX+tickGap) && near(over[0][2],trimX+tickGap+6) : near(over[0][2],trimX-tickGap) && over[0][0]<over[0][2] && over[0][2]-over[0][0]<=6.001,true);
      eq(`${label} preview under count`,preview.querySelectorAll('.pg-under line').length,under.length);
      eq(`${label} preview over count`,preview.querySelectorAll('.pg-over line').length,over.length);
      eq(`${label} DOM layer order`,!!(preview.querySelector('.pg-under').compareDocumentPosition(preview.querySelector('img')) & Node.DOCUMENT_POSITION_FOLLOWING) && !!(preview.querySelector('img').compareDocumentPosition(preview.querySelector('.pg-over')) & Node.DOCUMENT_POSITION_FOLLOWING),true);
      preview.querySelectorAll('.pg-over line').forEach((el,i)=>eq(`${label} preview coordinates`,['x1','y1','x2','y2'].every((key,k)=>near(+el.getAttribute(key),[T.x(over[i][0]),T.y(over[i][1]),T.x(over[i][2]),T.y(over[i][3])][k]*S.zoom)),true));
      let pdf,events=[];
      newDoc=(...args)=>{const doc=oldDoc(...args), line=doc.line, add=doc.addImage;
        doc.line=function(...coords){events.push({type:'line',coords});return line.apply(this,coords);};
        doc.addImage=function(...args){events.push({type:'image'});return add.apply(this,args);};
        doc.save=()=>{pdf=doc.output('datauristring').split(',')[1];};return doc;};
      await exportPDF(true);closeModal(true);
      eq(`${label} PDF exported`,!!pdf,true);
      const expected=pages.flatMap(page=>{const g=guideLines(L,page.length);return [...g.filter(l=>!l[6]).map(l=>({type:'line',coords:[T.x(l[0]),T.y(l[1]),T.x(l[2]),T.y(l[3])]})),...page.map(()=>({type:'image'})),...g.filter(l=>l[6]).map(l=>({type:'line',coords:[T.x(l[0]),T.y(l[1]),T.x(l[2]),T.y(l[3])]}))];});
      eq(`${label} PDF drawing order and geometry`,events.length===expected.length && events.every((e,i)=>e.type===expected[i].type && (!e.coords || e.coords.every((v,k)=>near(v,expected[i].coords[k])))),true);
      eq(`${label} only corners above artwork`,over.length,pages[0].length*8);
      eq(`${label} all outlines below artwork`,under.length>pages[0].length*4,true);
      artifacts.push({label,pdf});
    }
    window.__probeArtifacts=artifacts;
  } catch (e) { failed.push(e.stack || e.message); }
  finally { newDoc=oldDoc;closeModal(true);Object.assign(S,original);if(image)await removeImageIfUnused(image);applyMode();renderAll(); }
  return failed.length ? {failed:failed.slice(0,30),count:failed.length} : true;
})()
