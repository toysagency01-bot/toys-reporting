# Direct Meta Lead Ads intake

The master cabinet's CRM connection settings now offer **Meta Lead Ads → CRM
напрямую**. This is a separate integration from advertising-statistics imports.
Website forms continue to use the project's authenticated website endpoint.

## Setup

1. Select the correct client project and Facebook page. Discovery uses the
   existing TOYS Media-Buyer access. If the page is absent from the saved list,
   enter its Page ID: the server requests that exact page through the agent,
   validates its returned identity, token issuer and lead-read permission.
   No page or token is persisted during **Проверить доступ**. A successful
   **Подключить напрямую** stores the verified page token encrypted. If Meta
   refuses access, assign the page to the agent and check Leads Access.
2. Enter the **App ID** from Meta for Developers → App settings → Basic.
   The existing encrypted/runtime App Secret is used; a replacement can be
   entered in the password field and is encrypted on the server.
3. **Проверить доступ** checks app credentials, the issuing app of the page token,
   page identity, forms and permission to read lead IDs. It does not subscribe.
4. **Подключить напрямую** configures the app's Page webhook, then its page-level
   `leadgen` subscription, and reads both back from Meta. The callback is
   `https://reports.toys-agency.com/api/crm/meta`.
5. Submit a test lead through Meta and confirm that its contact appears in this
   project's CRM. A confirmed subscription shows **awaiting_lead**, not a claim
   that end-to-end delivery has been tested. Settings show the latest successful
   direct delivery timestamp once one exists.

The app must have the appropriate Meta Lead Ads permissions and Leads Access
for the page. Meta can require production/advanced access for client assets.
The connection checks use live API responses rather than assuming advertising
read access also permits retrieving contacts.

An existing Page webhook pointing to a different callback produces
`app_callback_conflict` and remains unchanged. Existing subscription fields are
preserved. A page already mapped to another project is rejected before any Meta
request. Tokens, App Secret and contact data are excluded from setup responses.

## Delivery and retry behavior

Signed webhooks are durably queued before acknowledgement. The handler validates
page/form identity, retrieves contact fields, preserves custom form answers in
private metadata, and links advertising IDs only to the project's known account.
Transient attribution failures do not discard contacts: the lead is stored and
the queue retries enrichment. The existing two-minute queue cron remains in use.
Its bounded retry/backoff and visible error queue are preserved.

Provider retries reuse the same card. Exact Meta lead IDs from historical
`legacy_project_sheet`/`legacy_meta_sheet` imports also reuse the imported card,
preserving status, history and deletion. Names or phone numbers are never used
to merge potentially different submissions. HOUSEVIP's imported source has no
native lead IDs; this release does not initiate a historical bulk re-import.
Existing Meta IDs are available for 26 AMKLINIKA imported contacts.

Qualification/sale CAPI activation is a separate setting and is unchanged by
connecting inbound leads. No historical conversion events are manufactured.

## State before activation, 2026-10-14

- HOUSEVIP: page `1342968218898825` (House VIP) is mapped; page token exists;
  subscription is disabled. The owner supplied App ID `1933678520679141`.
- AMKLINIKA: the owner identified page `1069830429555541`; it is absent from
  the saved discovery list and remains unverified/unmapped.
  Its 63 historical contacts include 26 Meta leads and 37 website leads.
- The Worker already has CRM encryption, verification and Meta App Secret
  bindings. This confirms presence, not the correctness of the app credentials.
- No direct Meta delivery has yet been confirmed for either project.

The owner-supplied App ID and page IDs are prefilled from each project's
`settings_json.directMetaSetup`. These are draft identifiers, not verification
of access or activation. They do not enable subscriptions or modify advertising
imports. The current Codex executor permits Cloudflare API access but not Graph
API or the reporting host, so live Meta setup must be initiated by the owner
through the master cabinet. Deployment of this UI is not evidence of live lead
delivery.

## Checks and references

`recovery-tests/direct-leads.test.mjs` checks setup/readback, retained fields,
callback conflicts, app/token mismatch, project permissions, signed delivery,
attribution retry, exact historical deduplication and deletion preservation.
Browser coverage verifies the master form's read-check/connect actions and honest
pending/error messages. These checks use synthetic data and mocked Meta replies.

Protocol references: Meta's [Leads Retrieval Set-up & Checker](https://github.com/facebookincubator/catalogue-of-api-solutions/blob/main/solutions/leads/leads-retrieval-set-up-checker.md)
and [Lead Ads webhook sample](https://github.com/fbsamples/lead-ads-webhook-sample).
