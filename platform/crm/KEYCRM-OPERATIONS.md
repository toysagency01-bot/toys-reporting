# VISA Agency: KeyCRM qualification import preparation

Approved project: `visa-agency-qa3b` / `prj_visa_agency_qa3b`.
Approved qualification labels: `Прогріті`, `Жовтий`, `Зелені`.
The credential is already stored as the encrypted Worker secret
`KEYCRM_VISA_API_TOKEN`. Never put its value in this document or diagnostics.

On 2026-10-27 the user requested saving the key reference and qualification
labels directly on the project. `scripts/configure-visa-keycrm.py apply` persisted
them in the production project's `settings_json.crmKeyCRM` with compare-and-swap
and readback verification. Other project settings were preserved. The config
records `pending_verification` and `syncEnabled: false`: saving configuration is
not an active connector. The current Worker does not consume this config yet.
Use `python scripts/configure-visa-keycrm.py status` to inspect only these
non-secret settings and confirm the Worker secret binding exists.

## Current state

`crm/keycrm.js` is a tested, read-only adapter and in-memory reconciliation
implementation. It is **not** connected to production routes, persistent storage,
dashboard summaries or the scheduler. There is no active KeyCRM import, database
migration, external qualification ledger or new production deployment in this
change. `visaKeyCRM.state` explicitly remains `pending_verification`.

Live verification is blocked: the task's managed executor does not permit
`openapi.keycrm.app`, and the available environment tools cannot change policy.
The environment status was rechecked on 2026-10-26. Do not deploy a remote proxy,
run a remote API probe to work around this restriction, or claim a generic Codex
settings link controls this managed plugin environment.

## Prepared behavior

- Requests use only GET on the fixed KeyCRM API host, with redirects disabled.
  No customer CRM mutation or Meta conversion delivery is implemented.
- Resolve a unique pipeline containing all three approved status names; refuse
  absent/ambiguous matches instead of guessing a pipeline or status IDs.
- Throttle requests to below 20/minute, use bounded pagination, reject changing,
  duplicate or incomplete responses, and discard contacts from normalized output.
- Keep one first-observed qualification per KeyCRM card, regardless of moves among
  the approved stages or re-entry. Observation time is not historical event time.
- Attribute qualification counts to the intake date in an explicitly configured
  project timezone. Missing/invalid dates fail the snapshot.
- Do not infer deletion from absence alone. A card can move to another pipeline.
- Do not infer advertising attribution from names or arbitrary numeric UTM values.

The API contracts used for preparation come from the
[official KeyCRM documentation](https://docs.keycrm.app/): Bearer authorization,
UTC timestamps, 20 requests/minute, pipeline/status/card GET endpoints and
`filter[field]` query syntax. Real response shapes still require verification.

## Remaining activation work

Once supported network configuration permits the API, verify the credential and
actual pipeline/status/card fields. Check which source fields identify original
lead intake and advertising campaign/ad/account, and inspect any available status
history. A current-status scan cannot establish every historical qualification:
cards that left these stages before the first scan will otherwise be missing.
Report that limitation explicitly if historical events are unavailable.

Then implement durable scoped storage and transactional scan publication with a
lease/checkpoint and retry policy. Reconcile exact external identities against
existing native/legacy VISA contacts before choosing the dashboard source; never
sum duplicate native and KeyCRM records. Define deletion handling from verified
API evidence. Integrate qualification-only coverage/freshness into dashboard and
creative attribution without inventing sales, revenue or zero ad-level totals for
unmapped cards. Validate live aggregate counts and selected reporting periods,
then deploy and enable scheduled reads. Keep CAPI disabled for this connector.

## Validation

`node recovery-tests/keycrm.test.mjs`: eight synthetic cases passed. These cover
mapping ambiguity, pagination completeness, response changes, safe errors,
privacy normalization, repeated qualification, intake timezone boundaries,
pipeline absence, project scope and malformed dates. No real CRM records or
credentials are used in these tests. This is preparation, not live verification.
