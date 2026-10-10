#!/usr/bin/env python3
"""Release only the existing staging Worker; never migrates data or replaces assets.

Usage: python scripts/release-unified.py upload
       python scripts/release-unified.py deploy VERSION EXPECTED_CURRENT_VERSION
"""
import json, os, pathlib, sys, urllib.request, urllib.error, uuid
ACCOUNT='6e1e68500c0dc88e70dde2da4117c79d'
SCRIPT='toys-agency-platform-staging'
BASE=f'https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/workers/scripts/{SCRIPT}'

def api(suffix, method='GET', payload=None, content_type='application/json'):
    data=payload if isinstance(payload,bytes) else json.dumps(payload).encode() if payload is not None else None
    req=urllib.request.Request(BASE+suffix,data=data,method=method,headers={'Authorization':'Bearer '+os.environ['CLOUDFLARE_API_TOKEN'],'Content-Type':content_type})
    try:
        with urllib.request.urlopen(req,timeout=60) as response: result=json.load(response)
    except urllib.error.HTTPError as error:
        raise SystemExit(f'Cloudflare HTTP {error.code}: {error.read().decode()[:1600]}')
    if not result.get('success'): raise SystemExit(json.dumps(result.get('errors')))
    return result['result']

def current(): return api('/deployments')['deployments'][0]['versions']

if __name__=='__main__':
    action=sys.argv[1] if len(sys.argv)>1 else 'help'
    if action=='upload':
        settings=api('/settings')
        assert next(b for b in settings['bindings'] if b['name']=='ENVIRONMENT')['text']=='staging'
        assert next(b for b in settings['bindings'] if b['name']=='TOYS_DB').get('database_id')=='0539d3d9-844e-470e-af6e-ae256fe4c81f'
        bindings=[]
        for binding in settings['bindings']:
            b=dict(binding)
            if b['type']=='secret_text':continue
            if b['type']=='d1':b.pop('id',None)
            bindings.append(b)
        metadata={'main_module':'unified-worker.js','compatibility_date':settings['compatibility_date'],'compatibility_flags':settings['compatibility_flags'],'bindings':bindings,'keep_bindings':['secret_text'],'keep_assets':True,'annotations':{'workers/message':'Unified project dashboard; existing backend, assets and data preserved'}}
        boundary='toys-'+uuid.uuid4().hex
        parts=[]
        for name,filename,kind,body in [('metadata',None,'application/json',json.dumps(metadata).encode()),('unified-worker.js','unified-worker.js','application/javascript+module',pathlib.Path('dist/unified-worker.js').read_bytes())]:
            disposition=f'form-data; name="{name}"'+(f'; filename="{filename}"' if filename else '')
            parts.append(f'--{boundary}\r\nContent-Disposition: {disposition}\r\nContent-Type: {kind}\r\n\r\n'.encode()+body+b'\r\n')
        result=api('/versions','POST',b''.join(parts)+f'--{boundary}--\r\n'.encode(),f'multipart/form-data; boundary={boundary}')
        pathlib.Path('dist/uploaded-version.json').write_text(json.dumps(result,indent=2))
        print(json.dumps({'uploaded_version':result['id'],'active_versions':current()}))
    elif action=='deploy' and len(sys.argv)==4:
        version,expected=sys.argv[2:]
        if current()!=[{'version_id':expected,'percentage':100}]:raise SystemExit('Current deployment changed. Reconcile before release.')
        api('/versions/'+version)
        result=api('/deployments','POST',{'strategy':'percentage','versions':[{'version_id':version,'percentage':100}],'annotations':{'workers/message':'Unified project dashboard'}})
        pathlib.Path('dist/deployment.json').write_text(json.dumps(result,indent=2))
        assert current()==[{'version_id':version,'percentage':100}]
        print(json.dumps({'active_versions':current(),'rollback_version':expected}))
    else:raise SystemExit(__doc__)
