#!/usr/bin/env python3
"""Check instance art indexing, authentication, deduplication and share retention."""
import argparse
import base64
import http.client
import importlib.util
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import threading

ROOT = Path(__file__).resolve().parent.parent
PNG = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=')
CARD = '11111111-1111-4111-8111-111111111111'
OTHER = '22222222-2222-4222-8222-222222222222'
DFC = '33333333-3333-4333-8333-333333333333'


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--browser',action='store_true');parser.add_argument('--mobile',action='store_true');parser.add_argument('--server-root',type=Path,default=ROOT);args=parser.parse_args()
    with tempfile.TemporaryDirectory(prefix='pp-art-') as cache:
        os.environ.update(CACHE=cache, PASSWORD='art-check', PUBLIC_URL='', SHARE_STORAGE_MB='2', SHARE_DECK_MB='1')
        spec = importlib.util.spec_from_file_location('proxypress_art_check', args.server_root/'proxy-press-server.py')
        app = importlib.util.module_from_spec(spec)
        old_args = sys.argv; sys.argv = [str(ROOT/'proxy-press-server.py'), '0']
        try:
            spec.loader.exec_module(app)
        finally:
            sys.argv = old_args
        cards = {CARD:{'id':CARD, 'oracle_id':OTHER, 'name':'Lightning Bolt', 'layout':'normal', 'image_uris':{'png':'test'}},
                 OTHER:{'id':OTHER, 'oracle_id':OTHER, 'name':'Lightning Bolt', 'layout':'normal', 'image_uris':{'png':'test'}},
                 DFC:{'id':DFC, 'oracle_id':DFC, 'name':'Front // Back', 'layout':'transform', 'card_faces':[{'name':'Front', 'image_uris':{'png':'test'}}, {'name':'Back', 'image_uris':{'png':'test'}}]}}
        app.scryfall = lambda path, body=None: (200, cards[path.rsplit('/',1)[-1]]) if path.rsplit('/',1)[-1] in cards else (404, {})
        app.Handler.log_message = lambda *args: None
        server = app.Server(('127.0.0.1',0),app.Handler)
        thread = threading.Thread(target=server.serve_forever,daemon=True); thread.start()
        checks = 0
        def check(ok, name):
            nonlocal checks
            checks += 1
            assert ok, name
        def request(path, body=None, auth=True, mime='image/png', headers=None):
            h=dict(headers or {})
            if auth:h['Cookie']=app.COOKIE+'='+app.make_session()
            if body is not None:
                h['Content-Type']=mime
                if not isinstance(body,bytes):body=json.dumps(body).encode()
            conn=http.client.HTTPConnection('127.0.0.1',server.server_port,timeout=10)
            conn.request('GET' if body is None else 'POST',path,body,h)
            r=conn.getresponse(); result=r.status,dict(r.getheaders()),r.read();conn.close();return result
        def search(q='lightning%20bolt'):
            return json.loads(request('/art?q='+q)[2])['art']
        try:
            check(request('/art?q=bolt',auth=False)[0]==401,'search requires sign-in')
            check(request('/art?card='+CARD,PNG,auth=False)[0]==401,'uploads require sign-in')
            check(request('/art?card='+CARD,PNG,headers={'Origin':'https://elsewhere.example'})[0]==403,'cross-origin upload blocked')
            check(request('/art?card=not-a-card',PNG)[0]==400,'invalid card id rejected')
            check(request('/art?card=44444444-4444-4444-8444-444444444444',PNG)[0]==400,'unknown card match rejected')
            check(request('/art?card='+CARD+'&face=1',PNG)[0]==400,'nonexistent face rejected')
            check(request('/art?card='+CARD+'&bleed=nan',PNG)[0]==400,'non-finite bleed rejected')
            check(request('/art?card='+CARD,b'wrong',mime='text/plain')[0]==400,'non-image body rejected')
            check(request('/art?card='+CARD,b'wrong',mime='image/png')[0]==400,'image content type cannot disguise invalid data')
            status,_,raw=request('/art?card='+CARD+'&bleed=3.048',PNG)
            check(status==200,'matched art added')
            id=json.loads(raw)['id']
            item=search()[0]
            check(item['name']=='Lightning Bolt' and item['face']=='Lightning Bolt','canonical card identity stored')
            check(item['bleed']==3.048 and item['size']==len(PNG),'print bleed and size retained')
            check(len(search('LIGHTNING%20BOLT'))==1,'search is case insensitive')
            check(len(search('lightning%20b%C3%B3lt'))==1,'search normalizes accents')
            check(json.loads(request('/art?q=bolt&kind=TOKEN')[2])['art']==[],'card and token searches are separate')
            check(request('/art/'+str(id)+'/image',auth=False)[0]==401,'full images require sign-in')
            check(request('/art/'+str(id)+'/image')[2]==PNG,'full original is available')
            check(request('/art/'+str(id)+'/thumb')[2]==PNG,'missing thumbnail falls back to original')
            check(json.loads(request('/art?card='+OTHER,PNG)[2])['id']==id,'same art and oracle deduplicate across printings')
            check(len(search())==1,'duplicate upload creates no duplicate search result')
            check(request('/art/'+str(id)+'/thumb',PNG)[0]==200,'thumbnail can be stored')
            check(request('/art/'+str(id)+'/thumb')[2]==PNG,'thumbnail bytes available')
            status,_,raw=request('/art?card='+DFC+'&face=1',PNG)
            check(status==200,'back face can be matched')
            back=json.loads(raw)['id']; check(search('back')[0]['face']=='Back','back face identity retained')
            check(not search('front'),'back art does not appear as front art')
            token=json.loads(request('/shares',{},mime='application/json')[2])['id']
            digest=json.loads(request('/shares/'+token+'/images',PNG)[2])['hash']
            doc={'app':'proxy-press','type':'linked-deck','version':1,'deck':{'name':'Retained art','entries':[{'qty':1,'faces':[{'custom':'img-test'}]}]},'settings':{},'images':{'img-test':digest}}
            check(request('/shares/'+token,doc,mime='application/json')[0]==200,'library artwork can also belong to a shared deck')
            check(request('/shares/'+token+'/delete',{},mime='application/json')[0]==200,'share can be revoked')
            check(request('/art/'+str(id)+'/image')[2]==PNG,'revoking a share retains indexed artwork')
            check(request('/art/'+str(id)+'/delete',{},auth=False,mime='application/json')[0]==401,'deletion requires sign-in')
            check(request('/art/'+str(id)+'/delete',{},mime='application/json')[0]==200,'upload can be removed')
            check(search()==[],'removed upload disappears from search')
            check(request('/art/'+str(back)+'/image')[2]==PNG,'other indexed face retains deduplicated image')
            check(request('/art/'+str(back)+'/delete',{},mime='application/json')[0]==200,'last index entry removed')
            with sqlite3.connect(Path(cache)/'shares.sqlite3') as db:
                check(db.execute('SELECT COUNT(*) FROM share_images').fetchone()[0]==0,'unreferenced library images reclaimed')
            check(request('/art?card='+CARD,PNG+b'x'*(2*1048576))[0]==507,'shared storage quota is enforced')
            if args.browser:
                subprocess.run(['node','tools/console-check.js','--url',f'http://127.0.0.1:{server.server_port}','--password','art-check','--probe','tools/instance-art-probe.js','--width','390' if args.mobile else '1440','--height','844' if args.mobile else '1000'],cwd=ROOT,check=True,timeout=170)
        finally:
            server.shutdown();server.server_close();thread.join(timeout=5)
        print(f'PASS - {checks} instance art checks')


if __name__=='__main__':
    main()
