#!/usr/bin/env python3
"""Guarded CRM discovery bridge installation, run only in Google Cloud Shell."""
import hashlib,json,subprocess,sys,urllib.request,urllib.error,zipfile,shutil
from pathlib import Path
from datetime import datetime,timezone
PROJECT='toys-codex-media-buyer'
REGION='europe-west1'
SERVICE='toys-meta-media-buyer'
EMAIL='toys-meta-buyer-runtime@toys-codex-media-buyer.iam.gserviceaccount.com'
SERVER_SHA='c812cc0919f81afbbe7463086770eef7c386cc38464582d71f9c526c0f855b97'
TAG='toys-crm-check'

def gcloud(*args, capture=True):
    result = subprocess.run(['gcloud', *args, '--project='+PROJECT, '--quiet'], text=True, stdout=subprocess.PIPE if capture else None, check=True)
    return result.stdout.strip() if capture else ''

def service():
    return json.loads(gcloud('run', 'services', 'describe', SERVICE, '--region='+REGION, '--format=json'))

def traffic(s):
    return {x['revisionName']: x['percent'] for x in s['status'].get('traffic', []) if x.get('percent', 0) > 0}

def schedule_token(s):
    entries = s['spec']['template']['spec']['containers'][0].get('env', [])
    entry = next((x for x in entries if x['name'] == 'SCHEDULE_AUTH_TOKEN'), {})
    if entry.get('value'):
        return entry['value']
    ref = entry.get('valueFrom', {}).get('secretKeyRef', {})
    if not ref:
        raise RuntimeError('Existing SCHEDULE_AUTH_TOKEN is not configured.')
    secret = ref['name']
    aliases = s['spec']['template'].get('metadata', {}).get('annotations', {}).get('run.googleapis.com/secrets', '')
    for item in aliases.split(','):
        if ':' in item:
            alias, full = item.split(':', 1)
            if alias == secret:
                secret = full
    # gcloud accepts a fully qualified secret resource as --secret too.
    return gcloud('secrets', 'versions', 'access', ref.get('key', 'latest'), '--secret='+secret)

def patch_server(text):
    if hashlib.sha256(text.encode()).hexdigest()!=SERVER_SHA:
        raise RuntimeError('Server source changed. No deployment performed; send the source revision for reconciliation.')
    text=text.replace('from .reporting import DELIVERY_LOCK, run_reporting, scheduler_authorized','from .reporting import DELIVERY_LOCK, run_reporting, scheduler_authorized\nfrom .crm_bridge import run_crm_bridge',1)
    text=text.replace('        if self.path == "/scheduled/google-reporting":','        if self.path == "/scheduled/crm-connect":\n            self._handle_crm_connect()\n            return\n        if self.path == "/scheduled/google-reporting":',1)
    method='''    def _handle_crm_connect(self) -> None:
        if not self._authorized(scheduled=True) and not scheduler_authorized(self.headers.get("Authorization", "")):
            self._write_json(HTTPStatus.UNAUTHORIZED, {"ok": False, "error": "Unauthorized"})
            return
        if not DELIVERY_LOCK.acquire(blocking=False):
            self._write_json(HTTPStatus.CONFLICT, {"ok": False, "error": "Delivery already running"})
            return
        try:
            result = asyncio.run(run_crm_bridge(CloudSettings()))
            self._write_json(HTTPStatus.OK, result)
        except Exception:
            self._write_json(HTTPStatus.BAD_GATEWAY, {"ok": False, "error": "CRM discovery failed"})
        finally:
            DELIVERY_LOCK.release()

'''
    return text.replace('    def _handle_google_reporting(self) -> None:',method+'    def _handle_google_reporting(self) -> None:',1)

def main():
    package=Path(__file__).resolve().parent
    original=service();baseline=traffic(original)
    if not baseline or original['spec']['template']['spec']['serviceAccountName']!=EMAIL:
        raise RuntimeError('Cloud Run identity or traffic changed; nothing deployed.')
    annotations={**original.get('metadata',{}).get('annotations',{}),**original['spec']['template'].get('metadata',{}).get('annotations',{})}
    source=annotations.get('run.googleapis.com/build-source-location','')
    if not source.startswith('gs://run-sources-'+PROJECT+'-'+REGION+'/'):
        raise RuntimeError('Current deployment source location is unavailable; nothing deployed.')
    workspace=Path.home()/('toys-crm-'+datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S'));workspace.mkdir(mode=0o700)
    archive=workspace/'source.zip';gcloud('storage','cp',source,str(archive),capture=False)
    root=workspace/'source';root.mkdir()
    with zipfile.ZipFile(archive) as z:
        if any(not (root/i.filename).resolve().is_relative_to(root.resolve()) for i in z.infolist()):
            raise RuntimeError('Invalid source archive path')
        z.extractall(root)
    server=root/'src/toys_meta_buyer_cloud/server.py'
    server.write_text(patch_server(server.read_text()))
    shutil.copyfile(package/'crm_bridge.py',server.parent/'crm_bridge.py')
    subprocess.run([sys.executable,'-m','compileall','-q',str(root/'src')],check=True)
    secret=schedule_token(original)
    rollback='gcloud run services update-traffic '+SERVICE+' --project='+PROJECT+' --region='+REGION+' --to-revisions='+','.join(r+'='+str(p) for r,p in baseline.items())
    (workspace/'rollback.txt').write_text(rollback+'\n')
    gcloud('run','deploy',SERVICE,'--region='+REGION,'--source='+str(root),'--no-traffic','--tag='+TAG,capture=False)
    candidate=service();revision=candidate['status']['latestReadyRevisionName']
    tag=next((t for t in candidate['status'].get('traffic',[]) if t.get('tag')==TAG and t.get('revisionName')==revision),None)
    if not tag or traffic(candidate)!=baseline:raise RuntimeError('Traffic changed; no promotion performed')
    url=tag['url']
    if not url.startswith('https://') or not url.endswith('.run.app'):raise RuntimeError('Unexpected candidate host')
    identity=gcloud('auth','print-identity-token')
    request=urllib.request.Request(url+'/scheduled/crm-connect',data=b'{}',headers={'Authorization':'Bearer '+identity,'X-Schedule-Token':secret,'Content-Type':'application/json'})
    with urllib.request.urlopen(request,timeout=900) as response: result=json.load(response)
    if result.get('ok') is not True:raise RuntimeError('Discovery was not acknowledged; no promotion performed')
    current=service()
    if traffic(current)!=baseline or current['status']['latestReadyRevisionName']!=revision:raise RuntimeError('Concurrent deployment; no promotion performed')
    gcloud('run','services','update-traffic',SERVICE,'--region='+REGION,'--to-revisions='+revision+'=100',capture=False)
    print(json.dumps({k:result.get(k) for k in ['ok','pages','pagesWithToken','accounts','warnings']},ensure_ascii=False))
    print('CRM discovery complete. Match pages to projects in the agency CRM settings.')
    print('Rollback saved:',workspace/'rollback.txt')

if __name__=='__main__':
    try:main()
    except Exception as error:
        print('STOP:',str(error) if isinstance(error,RuntimeError) else type(error).__name__,file=sys.stderr)
        sys.exit(1)
