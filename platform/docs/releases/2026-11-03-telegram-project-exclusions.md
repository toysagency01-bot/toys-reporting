# Telegram project exclusions

VISA Agency (`visa-agency-qa3b`) and Karlovarska Sul (`karlovarska-sul-k4rm`)
are excluded from Telegram morning reviews at the owner's request.
Both project IDs and slugs are checked, including older review payloads with
only one identifier. Header project and priority counts use the same scope.
Platform reviews, CRM and advertising imports remain in their existing scope.

Validation: Telegram delivery and daily-review test files passed; unified build
and `git diff --check` passed. No live Telegram test messages were sent.

Released 2026-11-03 around 07:15 UTC:

- Worker version: `27f75e65-81e8-4869-ae54-b142295e2fba`, confirmed at 100%.
- Active Worker bytes match the local build, SHA-256
  `b81a83eb6da6b44d656aa2a34445ec2b6f8c81c05d6748ecf9a65dd67a34d5ea`.
- Previous version: `e40c6558-3d95-4980-8b57-504b4849a398`.
- Delivery queue checked before and after release: no outstanding deliveries.
- Telegram integration remains enabled and ready for the other projects.
- Existing sent-message history was not changed.
