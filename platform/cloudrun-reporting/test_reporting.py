import asyncio
import copy
import json
import subprocess
from pathlib import Path
from types import SimpleNamespace

import httpx
import pytest

from toys_meta_buyer_cloud import reporting as r
from toys_meta_buyer_cloud.google_ads import GoogleAdsError

ACCOUNT = {'id': '2662445825', 'currency': 'CZK', 'time_zone': 'Europe/Prague', 'manager': False, 'status': 'ENABLED'}

class Client:
    def __init__(self, fail_level=None, count=1):
        self.queries = []
        self.fail_level = fail_level
        self.count = count
    async def _request(self, method, path, payload):
        query = payload['query']
        self.queries.append(query)
        assert method == 'POST' and path.endswith('/googleAds:searchStream')
        assert 'LIMIT' not in query and "REMOVED" not in query
        level = 'ad' if 'FROM ad_group_ad ' in query else 'ad_group' if 'FROM ad_group ' in query else 'campaign'
        if level == self.fail_level:
            return {'error': 'upstream failure'}
        return [{'results': [dict(segments={'date': '2026-10-11'}, campaign={'id': str(i), 'name': 'Historical', 'status': 'REMOVED'}, adGroup={'id': str(i+500), 'name': 'Group', 'status': 'PAUSED'}, adGroupAd={'status': 'PAUSED', 'ad': {'id': str(i+1000), 'name': '', 'type': 'RESPONSIVE_SEARCH_AD', 'finalUrls': ['https://example.com/']}}, metrics={'impressions': '9007199254740993', 'clicks': '7', 'costMicros': '1000001', 'conversions': 0.5, 'conversionsValue': 12.25}) for i in range(1, self.count+1)]}]

def snapshot(count=1):
    return asyncio.run(r.hierarchy(Client(count=count), ACCOUNT, '2026-10-11', '2026-10-11'))

def test_complete_daily_hierarchy_has_exact_metrics_and_all_grains():
    result = snapshot()
    assert [x['level'] for x in result['rows']] == list(r.LEVELS)
    assert result['rows'][0]['metrics']['impressions'] == '9007199254740993'
    assert result['rows'][0]['metrics']['conversions'] == '0.5'
    assert result['rows'][2]['creative']['ref'] == 'google-ad:1001'
    assert result['writesEnabled'] is False
    assert result == snapshot()

@pytest.mark.parametrize('level', r.LEVELS)
def test_partial_provider_failure_never_becomes_complete_snapshot(level):
    with pytest.raises(GoogleAdsError, match='Incomplete'):
        asyncio.run(r.hierarchy(Client(fail_level=level), ACCOUNT, '2026-10-11', '2026-10-11'))

@pytest.mark.parametrize('value', ['NaN', 'Infinity', '-1', 'invalid'])
def test_invalid_metrics_fail(value):
    with pytest.raises(GoogleAdsError):
        r.decimal_text(value)

def test_pages_empty_and_multiple():
    data = snapshot(100)
    parts = list(r.pages(data))
    assert [p['page']['returnedRows'] for p in parts] == [200, 100]
    assert parts[0]['page']['nextCursor'] == '200'
    assert parts[1]['page']['nextCursor'] is None
    empty = snapshot(0)
    assert list(r.pages(empty))[0]['page']['returnedRows'] == 0
    assert all(x['complete'] and x['totalRows'] == 0 for x in empty['coverage'].values())

def test_delivery_requires_final_acceptance_and_handles_replay():
    data = snapshot(100)
    calls = []
    def handler(request):
        body = json.loads(request.content)
        calls.append(body['page']['offset'])
        assert request.headers['authorization'] == 'Bearer synthetic-id-token'
        # Replay of an already completed batch returns the final offset on every page.
        return httpx.Response(200, json={'accepted': True, 'snapshotId': data['snapshotId'], 'customerId': ACCOUNT['id'], 'nextExpectedOffset': 300, 'persistedRows': 300})
    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as transport:
            return await r.deliver(data, transport, 'synthetic-id-token')
    assert asyncio.run(run())['accepted'] is True
    assert calls == [0, 200]

@pytest.mark.parametrize('bad', [{'accepted': False}, {'persistedRows': 2}, {'customerId': '9632942627'}, {'nextExpectedOffset': 0}])
def test_delivery_rejects_false_acknowledgement(bad):
    data = snapshot()
    def handler(request):
        return httpx.Response(200, json={'accepted': True, 'snapshotId': data['snapshotId'], 'customerId': ACCOUNT['id'], 'nextExpectedOffset': 3, 'persistedRows': 3, **bad})
    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as transport:
            return await r.deliver(data, transport, 'synthetic')
    with pytest.raises(GoogleAdsError):
        asyncio.run(run())

def test_scheduler_checks_verified_identity_and_exact_audience(monkeypatch):
    def verify(token, request, audience):
        assert audience == r.AUDIENCE
        return {'email': r.RUNTIME_EMAIL, 'email_verified': True}
    monkeypatch.setattr(r.id_token, 'verify_oauth2_token', verify)
    assert r.scheduler_authorized('Bearer synthetic')
    assert not r.scheduler_authorized('Basic synthetic')
    monkeypatch.setattr(r.id_token, 'verify_oauth2_token', lambda *a, **kw: {'email': 'other', 'email_verified': True})
    assert not r.scheduler_authorized('Bearer synthetic')
    monkeypatch.setattr(r.id_token, 'verify_oauth2_token', lambda *a, **kw: {'email': r.RUNTIME_EMAIL, 'email_verified': False})
    assert not r.scheduler_authorized('Bearer synthetic')

def test_period_validation_and_account_timezone():
    assert r.period(ACCOUNT, {'from': '2026-01-01', 'to': '2026-01-31'}) == ('2026-01-01', '2026-01-31')
    for params in ({'from': '2026-01-01'}, {'from': '2026-01-01', 'to': '2026-05-01'}, {'customer': 'other'}, {'from': '2099-01-01', 'to': '2099-01-02'}):
        with pytest.raises((GoogleAdsError, ValueError)):
            r.period(ACCOUNT, params)

def test_pages_pass_actual_platform_validator():
    backend = Path('/workspace/toys-unified/platform/runtime/backend.js')
    if not backend.exists():
        pytest.skip('Platform checkout needed for cross-language contract test')
    js = '''const fs=require('fs');const code=fs.readFileSync(process.argv[1],'utf8');const source=code.split('// src/google-ads-cloudrun-adapter.js')[1].split('// src/google-cloudrun-oidc-receiver.js')[0];eval('function __name(){};'+source+';globalThis.validate=validateGoogleAdsHierarchyPage');const pages=JSON.parse(fs.readFileSync(0,'utf8'));for(const p of pages)validate(p,{customerId:p.customer.id,from:p.range.from,to:p.range.to,pageSize:p.page.pageSize});'''
    subprocess.run(['node', '-e', js, str(backend)], input=json.dumps(list(r.pages(snapshot(100)))+list(r.pages(snapshot(0)))), text=True, check=True, capture_output=True)


def test_default_period_uses_customer_timezone(monkeypatch):
    from datetime import datetime
    class Clock:
        @staticmethod
        def now(zone):
            assert str(zone) == 'Europe/Prague'
            return datetime(2026, 10, 12, 0, 10, tzinfo=zone)
    monkeypatch.setattr(r, 'datetime', Clock)
    assert r.period(ACCOUNT, {}) == ('2026-07-15', '2026-10-12')


def test_http_endpoint_denies_unauthorized_and_releases_lock(monkeypatch):
    from toys_meta_buyer_cloud import server
    responses = []
    fake = SimpleNamespace(headers={}, _authorized=lambda **kw: False, _write_json=lambda status, body: responses.append((status, body)), _read_json=lambda: {})
    monkeypatch.setattr(server, 'scheduler_authorized', lambda token: False)
    server.Handler._handle_google_reporting(fake)
    assert responses[-1][0] == 401
    fake._authorized = lambda **kw: True
    async def failure(*args):
        raise RuntimeError('synthetic-private-token')
    monkeypatch.setattr(server, 'run_reporting', failure)
    monkeypatch.setattr(server, 'CloudSettings', lambda: object())
    server.Handler._handle_google_reporting(fake)
    assert responses[-1][0] == 502
    assert 'synthetic-private-token' not in json.dumps(responses)
    assert server.DELIVERY_LOCK.acquire(blocking=False)
    server.DELIVERY_LOCK.release()
