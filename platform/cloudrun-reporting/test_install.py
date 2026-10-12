import hashlib
import importlib.util
import json
from pathlib import Path
import zipfile

import pytest

spec = importlib.util.spec_from_file_location('reporting_installer', Path(__file__).with_name('install.py'))
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)


def test_secret_reference_and_alias_are_not_printed(monkeypatch, capsys):
    expected = 'synthetic-private-token'
    calls = []
    def gcloud(*args, **kwargs):
        calls.append(args)
        return expected
    monkeypatch.setattr(installer, 'gcloud', gcloud)
    service = {'spec': {'template': {'metadata': {'annotations': {'run.googleapis.com/secrets': 'schedule-secret:projects/123/secrets/actual-name'}}, 'spec': {'containers': [{'env': [{'name': 'SCHEDULE_AUTH_TOKEN', 'valueFrom': {'secretKeyRef': {'name': 'schedule-secret', 'key': '2'}}}]}]}}}}
    assert installer.schedule_token(service) == expected
    assert calls[0] == ('secrets', 'versions', 'access', '2', '--secret=projects/123/secrets/actual-name')
    assert expected not in capsys.readouterr().out


def test_full_install_sequence_preserves_traffic_until_validation(tmp_path, monkeypatch):
    source_zip = tmp_path/'original.zip'
    with zipfile.ZipFile(source_zip, 'w') as z:
        z.writestr('src/toys_meta_buyer_cloud/server.py', '# synthetic source')
    original = {'spec': {'template': {'spec': {'serviceAccountName': installer.EMAIL, 'containers': [{'image': 'registry/image@'+installer.BASE_IMAGE, 'env': [{'name': 'SCHEDULE_AUTH_TOKEN', 'value': 'synthetic-private-token'}]}]}}}, 'status': {'traffic': [{'revisionName': 'old', 'percent': 100}], 'latestReadyRevisionName': 'old'}}
    candidate = json.loads(json.dumps(original))
    candidate['status'] = {'latestReadyRevisionName': 'new', 'traffic': [{'revisionName': 'old', 'percent': 100}, {'revisionName': 'new', 'tag': installer.TAG, 'url': 'https://candidate.run.app'}]}
    states = iter([original, candidate, candidate])
    monkeypatch.setattr(installer, 'service', lambda: next(states))
    monkeypatch.setattr(installer, 'SOURCE_SHA', hashlib.sha256(source_zip.read_bytes()).hexdigest())
    monkeypatch.setattr(Path, 'home', lambda: tmp_path)
    monkeypatch.setattr(installer.subprocess, 'run', lambda *a, **kw: None)
    steps = []
    def gcloud(*args, **kwargs):
        steps.append(args)
        if args[:2] == ('storage', 'cp'):
            Path(args[3]).write_bytes(source_zip.read_bytes())
        if args[:3] == ('scheduler', 'jobs', 'list'):
            return '[]'
        return ''
    def invoke(url, token, body):
        assert token == 'synthetic-private-token'
        steps.append(('validated', url))
        return {'ok': True}
    monkeypatch.setattr(installer, 'gcloud', gcloud)
    monkeypatch.setattr(installer, 'invoke', invoke)
    installer.main()
    deploy = next(i for i, s in enumerate(steps) if s[:2] == ('run', 'deploy'))
    validated = next(i for i, s in enumerate(steps) if s[0] == 'validated')
    promote = next(i for i, s in enumerate(steps) if s[:3] == ('run', 'services', 'update-traffic'))
    assert deploy < validated < promote
    assert '--no-traffic' in steps[deploy]
    assert not any('set-env-vars' in arg or 'set-secrets' in arg for arg in steps[deploy])
    job = next(s for s in steps if s[:3] == ('scheduler', 'jobs', 'create'))
    assert '--schedule=*/20 * * * *' in job
    assert '--oidc-service-account-email='+installer.EMAIL in job
    assert all('synthetic-private-token' not in str(s) for s in steps)


def test_newer_service_is_not_overwritten(monkeypatch):
    monkeypatch.setattr(installer, 'service', lambda: {'spec': {'template': {'spec': {'containers': [{'image': 'newer/image@sha256:new'}]}}}})
    monkeypatch.setattr(installer, 'gcloud', lambda *a, **kw: pytest.fail('must not modify cloud'))
    with pytest.raises(RuntimeError, match='changed since'):
        installer.main()
