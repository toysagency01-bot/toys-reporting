# Profkit USA 2.0 switch completed

After the user granted access, Meta verified account 1736244500266269 at
10:44 UTC. Currency USD and timezone Europe/Kiev match the prior account.
Account creation is 2025-03-19, so initial history was requested for the full
project period, 2026-03-25 through 2026-11-02, rather than assuming older days
had zero spend.

The guarded, single-statement switch completed at 10:49:12 UTC. The old
integration native-meta-profkit-instashop-r4vk is disabled with readOnlyArchive;
new native-meta-profkit-usa-2 is active. Its first import completed successfully
at 10:50:36 UTC and stored 223 daily snapshots. Independent account-level Meta
reconciliation matched every one of 222 completed days through November 1.
Today's activity remains live and is outside the closed-day audit.

Readback verified all 81 old snapshot records against the frozen post-switch
capture, with identical payloads/content hashes. Earlier published advertising
history (1,636 baseline rows) remains available. The report model preserves that
baseline where archived API history is absent, while independently adding the
new account's covered rows. This prevents both dropped new early-period expenses
and duplicate legacy/API spend. Per-account campaign totals also reconcile with
stored account daily totals. The 28–30 October overlapping account dates are
included as two actual account contributions, not duplicate observations.

Initial full history is imported only once. Subsequent scheduled imports use the
rolling window while retaining older stored days. Source sales, leads, historical
FX, roles, credentials and finance records were not rewritten. Existing per-day
USD/UAH conversion rules remain in place. Public and private reports retain the
account/archive coverage metadata and scope separation.

Validation: 339 recovery tests passed, followed by 17 focused import/archive
checks after the public response change. The atomic SQL switch guard also passed
its SQLite lease test. No browser layout changes were made. Verification scripts
and private captures are documented in ../PROFKIT-ACCOUNT-SWITCH.md.

Final implementation commit: 70ca880 (with 7ed7f84 initial-history coverage).
Final Worker e40c6558-3d95-4980-8b57-504b4849a398 was confirmed at 100%, and the
downloaded module matches the tested bundle, SHA-256
95365c5633420fafac1309099e784e963b22f8e41d7763a120c0934e10277b32.
Prior Worker 6ccf5e72-1024-498d-a3b2-085b26dee80e remains a rollback reference.
This receipt supersedes the earlier pending-access release note.
