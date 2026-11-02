# Profkit account replacement

Requested new Meta account: Profkit USA 2.0 / 1736244500266269.
Existing working dashboard: profkit-instashop-r4vk. Previous account:
394051718160331. The unrelated draft profkit-yg2a is not modified.

The new source is registered as pending. The existing scheduler can verify its
account metadata without importing advertising or making it visible in reports.
Only after verification, one scoped SQL update disables the old integration and
activates the new one. Old snapshots remain in place with a read-only archive
flag. Archive reads never call the old API. In-flight imports are guarded against
writing snapshots after an integration is disabled or its configuration changes.

The reporting model adds different accounts on the same day, without adding the
account/campaign/ad alternative hierarchy levels together. Legacy facts remain
for dates that API snapshots do not cover. Snapshots in an earlier timezone stay
stored; a scope reads only its verified current account timezone, so two versions
of a day are not added. A verified Meta account creation date can establish that
the new account did not exist earlier; missing days are not invented as zero rows.

Source currency and timezone come from Meta. USD/UAH conversions retain the
existing confirmed per-day rates and Instashop business sales source. Sales,
leads, financial records, secrets and original Google Sheets are not rewritten.
Private before/frozen captures are outside Git under /workspace/profkit-account-switch.

Operations: `scripts/switch-profkit-account.py prepare EXPECTED_VERSION`, then
`switch EXPECTED_VERSION` after metadata verification; `verify` compares the
complete frozen old snapshot capture with the current rows. Each modifying step
is gated to the expected deployed Worker and exact project/account identities.
