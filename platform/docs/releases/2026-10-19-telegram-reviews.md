# Morning reviews in Telegram

The existing morning review is delivered to the explicitly authorized work group
`-2349758299` through `@agencytoys_bot`. `TELEGRAM_BOT_TOKEN` stays in Worker secrets.
No Telegram token, lead contact data, or additional advertising API calls are used
by the formatter. Only saved project reviews for currently active projects are sent.

## Schedule and messages

- Existing 09:30 Asia/Tbilisi generation is unchanged. Delivery follows generation.
- A partial review waits for the existing four generation attempts (normally until
  10:00) before sending its explicit incomplete-data warning. An error without a
  finalized review is not presented as a successful analysis.
- Activation verifies `getMe` and the exact `getChat` ID/type, then sends one setup
  notice and today's review if available. A prior day's report never substitutes
  for today's missing report. Supergroup prefixes are not guessed.
- Plain-text messages are split at project boundaries below 4096 UTF-16 units;
  Telegram link previews are disabled. Priority, account-local dates, currencies,
  aggregate account metrics, the leading finding's scope/evidence/action, CRM
  milestones and project links are included. Long details remain in the master.
- CRM contacts and unrestricted message history are not read. Existing dashboard
  and CRM authorization is unchanged. Telegram group members can read the digest;
  dashboard links still require their normal platform access.

## Durability and failure handling

Migration `0027_telegram_reviews.sql` adds opt-in configuration and durable delivery
records. A unique organization/date key freezes the first finalized digest. Each
part advances only after an acknowledged Telegram message ID, under a D1 lease.
Concurrent/repeated cron invocations do not duplicate acknowledged parts.

Telegram does not support sendMessage idempotency keys. A timeout, unknown server
response, expired send lease, or lost database acknowledgement is `uncertain` and
is **not automatically resent**. An operator must check the group before repairing
that record. Explicit 429 responses retry after Telegram's `retry_after`; explicit
400/401/403 responses block the delivery. A migration response does not silently
change the approved recipient. Provider errors are stored as sanitized codes only.

Admin-only `GET /api/v2/master/daily-review/telegram` exposes configuration and the
last ten delivery statuses, never tokens or message bodies. There is no public
configuration or send endpoint. Operational commands:

```
python scripts/configure-telegram-reviews.py migrate
python scripts/configure-telegram-reviews.py enable
python scripts/configure-telegram-reviews.py status
python scripts/configure-telegram-reviews.py disable
```

Deploy the tested Worker before enabling. Disabling prevents subsequent scheduled
sends; an already in-flight request may complete. Preserve the additive tables on
rollback. Never reset an uncertain record to pending without checking the actual chat.

## Validation

- 178 recovery tests passed, including delivery/formatting/failure tests and
  admin/team/client checks for the status API.
- Browser QA passed for independent CRM boards, transfers, reload persistence and
  mobile controls after the shared Worker change.
- Today's 12-project digest was inspected before delivery: three messages, all
  project links present, currencies separate, unavailable metrics not shown as zero.
- A real workerd/Miniflare test verifies Telegram requests and D1 acknowledgement,
  including blocked redirects, malformed responses and invalid token format. This
  catches the Worker limitation that `redirect: 'error'` is unsupported; production
  uses `manual` and explicitly rejects redirects without following them.
