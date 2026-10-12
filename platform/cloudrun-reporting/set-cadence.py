#!/usr/bin/env python3
"""Run in the owner's Cloud Shell; changes only Google reporting Scheduler jobs."""
import copy
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import subprocess
import urllib.error
import urllib.request

PARENT = 'projects/toys-codex-media-buyer/locations/europe-west1'
BASE = PARENT + '/jobs/toys-google-reporting'
DAY = BASE + '-daytime'
URL = 'https://toys-meta-media-buyer-ir6ahhggha-ew.a.run.app'
EMAIL = 'toys-meta-buyer-runtime@toys-codex-media-buyer.iam.gserviceaccount.com'
ZONE = 'Asia/Tbilisi'
MARKER = 'TOYS additional daytime reporting runs; managed by set-cadence.py'


def apply(api, backup):
    original = api(BASE)
    existing = api(DAY, missing=True)
    target = original.get('httpTarget', {})
    expected_oidc = {'serviceAccountEmail': EMAIL, 'audience': URL}
    if (original.get('state') != 'ENABLED' or
            target.get('uri') != URL + '/scheduled/google-reporting' or
            target.get('httpMethod') != 'POST' or
            target.get('oidcToken') != expected_oidc or
            original.get('schedule') not in ('*/20 * * * *', '0 * * * *')):
        raise RuntimeError('Existing reporting job changed; no updates made.')
    if existing and (existing.get('description') != MARKER or
                     existing.get('httpTarget') != target or existing.get('state') != 'ENABLED'):
        raise RuntimeError('Daytime job name is already in use; no updates made.')
    backup({'original': original, 'daytime': existing})
    extra = {k: copy.deepcopy(original[k]) for k in ('httpTarget', 'retryConfig', 'attemptDeadline') if k in original}
    extra.update(name=DAY, description=MARKER, schedule='20,40 9-23 * * *', timeZone=ZONE)
    if existing:
        api(DAY + '?updateMask=schedule,timeZone', 'PATCH', {'schedule': extra['schedule'], 'timeZone': ZONE})
    else:
        api(PARENT + '/jobs', 'POST', extra)
    try:
        # Preserve endpoint, body, OIDC identity, retry settings and Cloud Run.
        api(BASE + '?updateMask=schedule,timeZone', 'PATCH', {'schedule': '0 * * * *', 'timeZone': ZONE})
        for name, schedule in ((BASE, '0 * * * *'), (DAY, extra['schedule'])):
            current = api(name)
            if (current.get('schedule') != schedule or current.get('timeZone') != ZONE or
                    current.get('httpTarget') != target or current.get('state') != 'ENABLED'):
                raise RuntimeError('Scheduler readback differs; inspect jobs before retrying.')
    except Exception:
        # Restore the old base cadence before removing our extra runs.
        api(BASE + '?updateMask=schedule,timeZone', 'PATCH',
            {'schedule': original['schedule'], 'timeZone': original.get('timeZone', 'Etc/UTC')})
        if existing:
            api(DAY + '?updateMask=schedule,timeZone', 'PATCH',
                {'schedule': existing['schedule'], 'timeZone': existing['timeZone']})
        else:
            api(DAY, 'DELETE')
        raise


def main():
    # The access token stays in this Cloud Shell process and is never printed.
    token = subprocess.run(['gcloud', 'auth', 'print-access-token'],
                           text=True, capture_output=True, check=True).stdout.strip()
    def api(path, method='GET', body=None, missing=False):
        request = urllib.request.Request('https://cloudscheduler.googleapis.com/v1/' + path,
            data=json.dumps(body).encode() if body is not None else None, method=method,
            headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            if missing and error.code == 404:
                return None
            raise RuntimeError(f'Cloud Scheduler HTTP {error.code}; credentials not printed.') from None
    folder = Path.home() / ('toys-reporting-cadence-' + datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S'))
    def backup(value):
        folder.mkdir(mode=0o700)
        path = folder / 'before.json'
        with open(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'w') as file:
            json.dump(value, file, indent=2)
        print('Previous Scheduler settings:', path, flush=True)
    apply(api, backup)
    print('DONE: Google Ads — 00:00–09:00 hourly; 09:00–24:00 every 20 minutes. Timezone: Asia/Tbilisi.')


if __name__ == '__main__':
    main()
