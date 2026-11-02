# AM Klinika qualified-lead CAPI

User requested QualifiedLead events from platform CRM to the project's Meta
account 1830858661278666. The connected Page is 1069830429555541.

Only new qualification transitions after the activation cutoff are eligible.
Automotive qualification stages: Квалифицирован, Диагностика назначена,
Автомобиль принят, Смета отправлена, Согласовано, В работе, Готов к выдаче.
A first move into any such stage records a single stable milestone/event ID.
Moving between these stages or editing a historical qualified card's note does
not create a new qualification. Sale events are outside the requested scope.
Historical source-sheet qualifications are not backfilled or replayed by setup.

The ordinary source scheduler queries the account's datasets. If no Dataset was
selected, it can select only one unique account Dataset. Multiple candidates
require an explicit choice. Account membership and Dataset identity are verified
before enabling CAPI; tokens use the existing encryption key. Configuration
sends no synthetic conversion and is not proof of event-delivery permission.

Activation uses `scripts/configure-amklinika-capi.py prepare EXPECTED_VERSION`.
The script requires the exact active Worker version, ready source and blank prior
CAPI settings. It sets the QualifiedLead-only scope and activation cutoff. The
normal scheduler then verifies the source and encrypts the credential. Setup
retries events blocked during the configuration interval only after the cutoff.
No unrelated credentials, roles, project records or advertising facts change.

Successful real delivery requires a Meta acknowledgment of `events_received: 1`.
Until then status is configured, rather than delivery confirmed. There is no
production test lead or historical replay to simulate success.
