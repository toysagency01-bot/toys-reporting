#!/usr/bin/env python3
"""Migrate, enable/disable or inspect the authorized TOYS Telegram review destination.

The bot token stays in Worker secrets. This script never reads it or contacts Telegram.
Enable only after deploying the Telegram Worker code; the scheduled Worker verifies
the exact bot and group before delivering its setup notice and today's review.
"""
import importlib.util, json, pathlib, sys

spec = importlib.util.spec_from_file_location('cf', pathlib.Path(__file__).with_name('configure-client-access.py'))
cf = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cf)
ORG = 'org_toys_agency'

def query(sql, params=None):
    return cf.api('/d1/database/' + cf.DB + '/query', 'POST', {'sql': sql, 'params': params or []})[0]['results']

if __name__ == '__main__':
    action = sys.argv[1] if len(sys.argv) > 1 else 'status'
    if action == 'migrate':
        cf.query(pathlib.Path('migrations/0027_telegram_reviews.sql').read_text())
        print(json.dumps({'migration': '0027_telegram_reviews', 'ready': True}))
    elif action == 'enable':
        # User's screenshot confirms a forum supergroup, Web peer ID 2433853808.
        # Bot API uses its canonical supergroup ID; the Worker verifies it before sending.
        chat, bot = '-1002433853808', 'agencytoys_bot'
        old = query('SELECT chat_id,bot_username FROM agency_telegram_config WHERE organization_id=?', [ORG])
        assert not old or old[0] == {'chat_id': chat, 'bot_username': bot}, 'Destination changed; reconcile before enabling.'
        query("INSERT INTO agency_telegram_config(organization_id,chat_id,bot_username,enabled,state,updated_at) VALUES(?,?,?,1,'pending',strftime('%Y-%m-%dT%H:%M:%fZ','now')) ON CONFLICT(organization_id) DO UPDATE SET enabled=1,state='pending',error_code=NULL,updated_at=excluded.updated_at", [ORG, chat, bot])
        print(json.dumps({'enabled': True, 'chatId': chat, 'botUsername': bot, 'verification': 'pending'}))
    elif action == 'disable':
        query('UPDATE agency_telegram_config SET enabled=0 WHERE organization_id=?', [ORG])
        print(json.dumps({'enabled': False}))
    elif action == 'status':
        print(json.dumps({
            'config': query('SELECT chat_id,bot_username,enabled,state,chat_title,verified_at,error_code FROM agency_telegram_config WHERE organization_id=?', [ORG]),
            'deliveries': query('SELECT delivery_key,state,next_part,json_array_length(messages_json) AS total_parts,message_ids_json,error_code,next_attempt_at,sent_at FROM agency_telegram_deliveries WHERE organization_id=? ORDER BY created_at DESC LIMIT 10', [ORG])
        }, ensure_ascii=False))
    else:
        raise SystemExit(__doc__)
