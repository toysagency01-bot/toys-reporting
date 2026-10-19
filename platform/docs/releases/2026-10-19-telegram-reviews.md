# Morning reviews in Telegram

The existing morning review is delivered to the explicitly authorized work group
`-1002433853808` through `@agencytoys_bot`. `TELEGRAM_BOT_TOKEN` stays in Worker secrets.
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
- HTML messages are split at project boundaries below 4096 UTF-16 units;
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

## Production activation check

Worker `66b9b117-653b-423e-8b83-512c1a152748` is deployed with migration 0027.
Telegram accepted the token and confirmed the expected bot username. The next
`getChat(-2349758299)` returned `chat_not_found`. Configuration is therefore
`blocked`; no setup notice or review was enqueued or sent. Resolve group membership
and the actual Bot API chat ID before retrying activation. Do not claim delivery
or silently prepend a supergroup prefix to this destination.

The additional multipart recovery test also passed: after an explicit rate-limit
rejection, only the rejected part is retried; already acknowledged parts and the
original saved digest remain unchanged.

The user subsequently corrected the destination to `-2433853808`. Configuration
was changed with a compare-and-swap requiring the prior blocked destination and
an empty delivery queue. The next scheduled verification again returned
`chat_not_found`; the current configuration remains blocked and the queue empty.
The bot must be added to the intended group and the Bot API ID confirmed before
retrying. No code redeployment was needed for this configuration correction.

The user's next screenshot establishes that this is a forum supergroup named
`TOYS / Project Management`, with Web peer ID `2433853808`; it also shows messages
from the configured bot in General. The Bot API destination was corrected to
`-1002433853808`, retaining the same bot and targeting General (no topic override).
This correction resolves the earlier confusion between Telegram Web peer IDs and
canonical Bot API supergroup IDs; the scheduled Worker verifies the destination.

Production verification succeeded at `2026-10-19T12:36:20.379Z`: Telegram returned
the exact canonical ID and title `TOYS / Project Management`. Setup notice 33220
and all three review parts 33221–33223 were acknowledged, with the review delivery
marked `sent` at `2026-10-19T12:36:28.694Z`. No error or remaining part is pending.
The 09:30 Asia/Tbilisi daily schedule remains enabled.

## Client-only scope and message layout update

TOYS AGENCY (`prj_toys_agency_ctft` / `toys-agency-ctft`) is excluded by a shared
review policy before analysis and from historical API responses, Telegram
formatting and cached browser rendering. Project status, advertising imports,
CRM and normal dashboard access are unchanged. Priority counts include clients
only; the current digest contains 11 projects.

Messages use escaped Telegram HTML: bold project names, priorities, key metrics,
and action headings; italic context; linked dashboard labels; plain separators.
Project cards contain no decorative emoji. HTML tags/entities remain intact at
message boundaries, including extreme-length untrusted text. New outbox entries
record their HTML parse mode; legacy string entries remain plain text.

Explicit edit jobs can update an acknowledged message in the same group and bot
scope. A target must already exist in a completed delivery's message IDs. These
jobs use `editMessageText`, handle Telegram's “message is not modified” response,
and never reset the daily send record. Today's three original messages are the
targets for the `2026-10-19:layout-v2` job, avoiding a duplicate digest.

Validation: 180 recovery tests passed, plus the two added HTML-boundary and
owned-message-edit tests (13 delivery tests passed together). Three browser QA
scenarios passed for desktop, mobile, cache/reload and history, with an old
payload still containing TOYS AGENCY. A 390px message rendering preview had no
horizontal overflow; all 11 project links fit into three messages.

Telegram rejected the first in-place update with `message to edit not found`
(`telegram_edit_not_found`). No edit was acknowledged. The error is retained on
the blocked edit job. A separate `2026-10-19:layout-v2:replacement` delivery was
queued with the new HTML digest, without resetting or replaying the original daily
send. Explicit Telegram errors now distinguish missing/forbidden edit targets,
invalid HTML, excessive length and insufficient rights, without storing raw errors.

Telegram acknowledged all three replacement HTML messages (33224–33226) at
`2026-10-19T12:52:23.446Z`; the replacement job is `sent`, 3/3 parts, no error.
The new 11-project layout is therefore verified through the actual Telegram API.
