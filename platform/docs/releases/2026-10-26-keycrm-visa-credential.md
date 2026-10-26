# VISA Agency KeyCRM credential preparation — 2026-10-26

The user supplied a KeyCRM API credential and identified VISA Agency as its project. It is stored only as the encrypted Worker secret `KEYCRM_VISA_API_TOKEN`; no credential value is included in repository files or verification receipts. Existing binding names/types and compatibility settings were preserved.

Cloudflare secret storage activated Worker version `b47756c4-3648-4c57-adb4-2e19fc55bf75`, replacing `9dab35f1-c4c2-4322-ba8a-310c6c805231`. Downloaded source is unchanged: SHA-256 `bd8376b5d7da9c89ac32e9e5011885de41140fe362997e6129571e6abc2ea311`. No application or database change was made.

This prepares credentials only. KeyCRM access is not yet verified, and no KeyCRM connector, qualification mapping or automatic import is enabled. The client's intended pipeline and business qualification statuses still need confirmation. Do not infer qualifications from stage order or send historical qualifications to Meta automatically.

## Qualification statuses subsequently confirmed by the user

For VISA Agency, the user identified exactly these KeyCRM columns as qualified: `Прогріті`, `Жовтий`, `Зелені`. Preserve the Ukrainian labels when resolving API status IDs. A card moving between these columns must not create another qualification. The screenshot's card counts are not an imported historical ledger or proof of a selected reporting period. Qualification analytics retain the lead-intake date basis.

Status IDs and the pipeline are not yet resolved. The current managed executor does not allow `openapi.keycrm.app`; a credential-free API connectivity probe failed with `Tunnel connection failed: 403 Forbidden`. Add that host through the supported environment network configuration before API verification. Do not bypass the proxy or create an arbitrary remote proxy. No live import or status mapping has been activated.

Read-only advertising diagnosis for VISA found an active Meta integration whose result mapping is `lead`, with a successful import at `2026-10-26T12:21:12.793Z`. Saved campaign totals for 2026-10-19 through 2026-10-25 sum to 11 conversions under that mapping. The user has not yet provided the exact Ads Manager comparison period, column and values, so the cause of the reported discrepancy remains unconfirmed.

Ignored receipt: `platform/dist/keycrm-visa-secret-receipt.json` contains metadata only.
