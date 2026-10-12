"""Discover agent-accessible assets and deliver credentials only to the TOYS receiver.

Read-only Meta calls use the existing guarded client's transport. No ads are changed.
Returned and logged results contain counts and permission error codes only.
"""
from __future__ import annotations
import asyncio
import httpx
from google.auth.transport.requests import Request
from google.oauth2 import id_token
from .service import _client

RECEIVER = 'https://toys-agency-platform-staging.denys-shpodaris.workers.dev/api/internal/crm/v1/pages'

async def paginate(client, path, fields):
    rows, cursor, seen = [], None, set()
    for _ in range(100):
        params = {'fields': fields, 'limit': 100}
        if cursor:
            params['after'] = cursor
        data = await client._request('GET', path, params=params)
        if not isinstance(data.get('data'), list):
            raise ValueError('Invalid discovery response')
        rows.extend(data['data'])
        if not data.get('paging', {}).get('next'):
            return rows
        cursor = data.get('paging', {}).get('cursors', {}).get('after')
        if not cursor or cursor in seen:
            raise ValueError('Incomplete asset pagination')
        seen.add(cursor)
    raise ValueError('Asset pagination limit reached')

async def run_crm_bridge(settings):
    pages, accounts, warnings, channels = {}, [], [], {}
    client = _client(settings)
    try:
        async def optional(path, fields):
            try:
                return await paginate(client, path, fields)
            except Exception as exc:
                warnings.append({'edge': path, 'code': getattr(exc, 'code', None) or type(exc).__name__})
                return []
        def merge(items):
            for page in items:
                identity = str(page.get('id', ''))
                if not identity.isdigit():
                    continue
                previous = pages.get(identity, {})
                pages[identity] = {'id': identity, 'name': str(page.get('name') or previous.get('name') or identity)[:250], 'token': page.get('access_token') or previous.get('token')}
        merge(await optional('me/accounts', 'id,name,access_token'))
        ad_accounts = await paginate(client, 'me/adaccounts', 'id,account_id,name,business')
        businesses = {str(a['business']['id']) for a in ad_accounts if a.get('business', {}).get('id')}
        businesses.update(str(b['id']) for b in await optional('me/businesses', 'id') if b.get('id'))
        for account in ad_accounts:
            aid = str(account.get('account_id') or account['id'].removeprefix('act_'))
            merge(await optional('act_'+aid+'/promote_pages', 'id,name'))
            pixels = await optional('act_'+aid+'/adspixels', 'id,name')
            accounts.append({'id': aid, 'name': str(account.get('name') or aid), 'pixels': pixels})
        for business in sorted(businesses):
            for edge in ('owned_pages', 'client_pages'):
                merge(await optional(business+'/'+edge, 'id,name'))
        for page in pages.values():
            if page['token']:
                continue
            try:
                detail = await client._request('GET', page['id'], params={'fields': 'access_token'})
                page['token'] = detail.get('access_token')
            except Exception as exc:
                warnings.append({'edge': page['id']+'/access_token', 'code': getattr(exc, 'code', None) or type(exc).__name__})
    finally:
        await client.close()
    token = await asyncio.to_thread(id_token.fetch_id_token, Request(), RECEIVER)
    page_rows = list(pages.values())
    channel_rows = list(channels.values())
    async with httpx.AsyncClient(timeout=60, follow_redirects=False) as http:
        for offset in range(0, max(len(page_rows), len(accounts), len(channel_rows), 1), 100):
            payload = {'channels':channel_rows[offset:offset+100], 'pages': page_rows[offset:offset+100], 'accounts': accounts[offset:offset+100], 'metaToken': settings.meta_access_token}
            if settings.meta_app_secret:
                payload['appSecret'] = settings.meta_app_secret
            response = await http.post(RECEIVER, json=payload, headers={'Authorization': 'Bearer '+token})
            if response.status_code != 200 or response.json().get('ok') is not True:
                raise RuntimeError('CRM receiver did not acknowledge discovery')
    return {'ok': True, 'pages': len(pages), 'pagesWithToken': sum(bool(p['token']) for p in page_rows), 'accounts': len(accounts), 'channels':len(channels), 'warnings': warnings}
