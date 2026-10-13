#!/usr/bin/env python3
"""Release only the existing staging Worker; never migrates data or replaces assets.

Usage: python scripts/release-unified.py upload
       python scripts/release-unified.py deploy VERSION EXPECTED_CURRENT_VERSION
"""
import json, os, pathlib, sys, urllib.request, urllib.error, uuid, hashlib, re, time
ACCOUNT='6e1e68500c0dc88e70dde2da4117c79d'
SCRIPT='toys-agency-platform-staging'
BASE=f'https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/workers/scripts/{SCRIPT}'

def api(suffix, method='GET', payload=None, content_type='application/json'):
    data=payload if isinstance(payload,bytes) else json.dumps(payload).encode() if payload is not None else None
    req=urllib.request.Request(BASE+suffix,data=data,method=method,headers={'Authorization':'Bearer '+os.environ['CLOUDFLARE_API_TOKEN'],'Content-Type':content_type,'Accept-Encoding':'identity','Connection':'close'})
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
        if not any(b['name']=='MVP_MASTER_EMAILS' for b in bindings):
            owners=next(b['text'] for b in bindings if b['name']=='MVP_ALLOWED_EMAILS')
            bindings.append({'name':'MVP_MASTER_EMAILS','type':'plain_text','text':owners.lower()})
        if '--add-owner-email' in sys.argv:
            email=sys.argv[sys.argv.index('--add-owner-email')+1].strip().lower()
            assert len(email)<=254 and re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',email), 'Invalid owner email'
            for name in ['MVP_ALLOWED_EMAILS','MVP_MASTER_EMAILS']:
                binding=next(b for b in bindings if b['name']==name)
                owners=[value.strip().lower() for value in binding['text'].split(',') if value.strip()]
                binding['text']=','.join(dict.fromkeys([*owners,email]))
        for option,binding_name in [('--direct-import','DIRECT_ADS_IMPORT_ENABLED'),('--direct-read','DIRECT_ADS_READ_ENABLED'),('--password-auth','PASSWORD_AUTH_ENABLED')]:
            if option in sys.argv:
                bindings=[b for b in bindings if b['name']!=binding_name]
                bindings.append({'name':binding_name,'type':'plain_text','text':'true'})
        registry=json.loads(pathlib.Path('projects.json').read_text())
        if '--publish-project' in sys.argv:
            project=sys.argv[sys.argv.index('--publish-project')+1]
            assert project in registry
            for b in bindings:
                if b['name'] in ['MVP_VIEW_PROJECTS','MVP_EDITOR_PROJECTS','MVP_PUBLIC_VIEW_PROJECTS','MVP_PUBLIC_PROJECT_MATERIALS']:
                    values=[v.strip() for v in b['text'].split(',') if v.strip()]
                    if project not in values: values.append(project)
                    b['text']=','.join(values)
        routes=['/login','/login/','/master','/master/','/api/*']+[route for slug in registry for route in ['/'+slug,'/'+slug+'/*']]
        metadata={'main_module':'unified-worker.js','compatibility_date':settings['compatibility_date'],'compatibility_flags':settings['compatibility_flags'],'bindings':bindings,'keep_bindings':['secret_text'],'keep_assets':True,'assets':{'config':{'run_worker_first':routes}},'annotations':{'workers/message':'Direct advertising import '+hashlib.sha256(pathlib.Path('dist/unified-worker.js').read_bytes()).hexdigest()[:16]}}
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
        # Deployment readback may briefly return the previous version after a successful POST.
        target=[{'version_id':version,'percentage':100}]
        for attempt in range(6):
            active=current()
            if active==target:break
            if active!=[{'version_id':expected,'percentage':100}]:raise SystemExit('A different deployment became active. Reconcile before continuing.')
            if attempt<5:time.sleep(1)
        else:raise SystemExit('Deployment accepted but not yet confirmed. Read active deployments before retrying any write.')
        print(json.dumps({'active_versions':active,'rollback_version':expected}))
    else:raise SystemExit(__doc__)
