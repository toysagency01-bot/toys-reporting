#!/usr/bin/env python3
"""Run in the owner's Google Cloud Shell. Credentials never leave Cloud Shell."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
import zipfile
from datetime import datetime, timedelta, timezone

PROJECT = 'toys-codex-media-buyer'
REGION = 'europe-west1'
SERVICE = 'toys-meta-media-buyer'
SERVICE_URL = 'https://toys-meta-media-buyer-ir6ahhggha-ew.a.run.app'
EMAIL = 'toys-meta-buyer-runtime@toys-codex-media-buyer.iam.gserviceaccount.com'
SOURCE = 'gs://run-sources-toys-codex-media-buyer-europe-west1/services/toys-meta-media-buyer/1791800206.969604-29803a0174ff496ea3734f2e23118362.zip#1791799913319879'
SOURCE_SHA = '6d78be61c5248470fe70da1b6705d71df695878e8de02745841ed7a71135f9d5'
BASE_IMAGE = 'sha256:6b00cde279ecb22efdd75b6a4b09eacb10547a8bb9ef783482214a4bb70ef6a9'
JOB = 'toys-google-reporting'
TAG = 'toys-reporting-check'


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


def invoke(url, token, body):
    identity = gcloud('auth', 'print-identity-token')
    request = urllib.request.Request(url+'/scheduled/google-reporting', data=json.dumps(body).encode(), headers={'Content-Type': 'application/json', 'Authorization': 'Bearer '+identity, 'X-Schedule-Token': token}, method='POST')
    try:
        with urllib.request.urlopen(request, timeout=930) as response:
            result = json.load(response)
    except urllib.error.HTTPError as error:
        # Only our structured, sanitized reporting result is printed.
        try:
            detail = json.load(error)
        except Exception:
            detail = {}
        if isinstance(detail, dict) and isinstance(detail.get('customers'), list):
            print(json.dumps({'customers': detail['customers']}, ensure_ascii=False), flush=True)
        raise RuntimeError(f'Reporting check returned HTTP {error.code}; traffic has not been automatically changed by this check.') from None
    if result.get('ok') is not True:
        raise RuntimeError('Reporting did not confirm both customer snapshots.')
    print(json.dumps(result, ensure_ascii=False), flush=True)
    return result


def main():
    package = Path(__file__).resolve().parent
    original = service()
    image = original['spec']['template']['spec']['containers'][0]['image']
    if not image.endswith('@'+BASE_IMAGE):
        raise RuntimeError('Cloud Run image changed since the provided archive. Stop to avoid overwriting newer work.')
    if original['spec']['template']['spec']['serviceAccountName'] != EMAIL:
        raise RuntimeError('Cloud Run service account changed. No deployment performed.')
    baseline = traffic(original)
    if not baseline:
        raise RuntimeError('Cannot determine current traffic for rollback.')
    token = schedule_token(original)  # Verify access before deployment; keep in memory only.
    if not token:
        raise RuntimeError('Empty schedule token; no deployment performed.')
    workspace = Path.home() / ('toys-google-reporting-'+datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S'))
    workspace.mkdir(mode=0o700)
    archive = workspace/'source.zip'
    cached = Path.home()/'toys-cloudrun-source.zip'
    if cached.is_file() and hashlib.sha256(cached.read_bytes()).hexdigest() == SOURCE_SHA:
        shutil.copyfile(cached, archive)
    else:
        gcloud('storage', 'cp', SOURCE, str(archive), capture=False)
    if hashlib.sha256(archive.read_bytes()).hexdigest() != SOURCE_SHA:
        raise RuntimeError('Source archive checksum mismatch; no deployment performed.')
    source_dir = workspace/'source'
    source_dir.mkdir()
    with zipfile.ZipFile(archive) as source:
        for entry in source.infolist():
            if not (source_dir/entry.filename).resolve().is_relative_to(source_dir.resolve()):
                raise RuntimeError('Invalid archive path.')
        source.extractall(source_dir)
    subprocess.run(['patch', '-p1', '--batch', '--forward', '-i', str(package/'server.patch')], cwd=source_dir, check=True)
    shutil.copyfile(package/'reporting.py', source_dir/'src/toys_meta_buyer_cloud/reporting.py')
    subprocess.run([sys.executable, '-m', 'compileall', '-q', str(source_dir/'src')], check=True)
    rollback = 'gcloud run services update-traffic '+SERVICE+' --region='+REGION+' --project='+PROJECT+' --to-revisions='+','.join(f'{r}={p}' for r,p in baseline.items())
    (workspace/'rollback.txt').write_text('gcloud scheduler jobs pause '+JOB+' --location='+REGION+' --project='+PROJECT+'\n'+rollback+'\n')
    print('Rollback command saved:', workspace/'rollback.txt', flush=True)
    gcloud('services', 'enable', 'cloudscheduler.googleapis.com', capture=False)
    print('Building candidate; existing traffic stays on its current revision.', flush=True)
    gcloud('run', 'deploy', SERVICE, '--region='+REGION, '--source='+str(source_dir), '--no-traffic', '--tag='+TAG, '--timeout=900', capture=False)
    candidate = service()
    revision = candidate['status']['latestReadyRevisionName']
    tagged = next((x for x in candidate['status'].get('traffic', []) if x.get('tag') == TAG and x.get('revisionName') == revision), None)
    if not tagged or traffic(candidate) != baseline:
        raise RuntimeError('Candidate tag or traffic changed unexpectedly; no promotion performed.')
    candidate_url = tagged['url']
    if not candidate_url.startswith('https://') or not candidate_url.endswith('.run.app'):
        raise RuntimeError('Unexpected candidate endpoint; credentials were not sent.')
    invoke(candidate_url, token, {})
    current = service()
    if traffic(current) != baseline or current['status']['latestReadyRevisionName'] != revision:
        raise RuntimeError('Another deployment occurred during validation; no promotion performed.')
    gcloud('run', 'services', 'update-traffic', SERVICE, '--region='+REGION, '--to-revisions='+revision+'=100', capture=False)
    print('Candidate verified and promoted:', revision, flush=True)
    # Dedicated job uses Google OIDC, never a shared secret in Scheduler headers.
    gcloud('run', 'services', 'add-iam-policy-binding', SERVICE, '--region='+REGION, '--member=serviceAccount:'+EMAIL, '--role=roles/run.invoker', capture=False)
    jobs = json.loads(gcloud('scheduler', 'jobs', 'list', '--location='+REGION, '--format=json'))
    existing = next((j for j in jobs if j['name'].split('/')[-1] == JOB), None)
    if existing and existing.get('httpTarget', {}).get('uri') != SERVICE_URL+'/scheduled/google-reporting':
        raise RuntimeError('The reporting Scheduler job name is already used by another endpoint; it was not overwritten.')
    exists = existing is not None
    gcloud('scheduler', 'jobs', 'update' if exists else 'create', 'http', JOB, '--location='+REGION, '--schedule=*/20 * * * *', '--time-zone=Etc/UTC', '--uri='+SERVICE_URL+'/scheduled/google-reporting', '--http-method=POST', '--oidc-service-account-email='+EMAIL, '--oidc-token-audience='+SERVICE_URL, '--message-body={}', '--update-headers=Content-Type=application/json' if exists else '--headers=Content-Type=application/json', '--attempt-deadline=900s', capture=False)
    print('Refresh scheduled every 20 minutes. Backfilling 2026 history in monthly windows.', flush=True)
    # Re-fetch recent weeks on each scheduled run; initial backfill covers the boards' 2026 history.
    yesterday = datetime.now(timezone.utc).date()-timedelta(days=1)
    start = yesterday.replace(month=1, day=1)
    while start <= yesterday:
        following = (start.replace(day=28)+timedelta(days=4)).replace(day=1)
        end = min(following-timedelta(days=1), yesterday)
        invoke(SERVICE_URL, token, {'from': start.isoformat(), 'to': end.isoformat()})
        start = following
    # Restore freshest current-day slice after backfill.
    invoke(SERVICE_URL, token, {})
    print('DONE: Google snapshots accepted, current period refreshed, 20-minute schedule configured.', flush=True)
    print('Rollback:', rollback, flush=True)


if __name__ == '__main__':
    try:
        main()
    except (Exception, KeyboardInterrupt) as error:
        # Never dump subprocess output containing credentials or raw API bodies.
        print('STOP:', str(error) if isinstance(error, RuntimeError) else type(error).__name__, file=sys.stderr)
        sys.exit(1)
