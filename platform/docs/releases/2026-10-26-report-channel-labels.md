# Report hover and channel logos — 2026-10-26

The shared theme's `.campaign:hover` rule changed the report background and border despite the existing section accents. Report cards now retain their neutral background, border and shadow on hover. Keyboard focus styles and interactive buttons remain available.

Report channel labels reuse the existing theme's Meta, Google Ads and SMM/Instagram SVG marks, including archived reports and revision labels. Unknown channels receive no invented logo. Decoration is idempotent and requires no external image requests. Both theme source copies are synchronized.

Validation: build, syntax and whitespace checks passed. All five report UX browser scenarios passed, including added assertions for unchanged hover colors/shadows and channel logos in both themes and archived history. Existing mobile, filter, draft and access checks passed in the same run.

Active Worker `toys-agency-platform-staging`, 100%: `9e3b7093-0a54-4bd7-9680-66b585a1549f`. Rollback: `62627b6d-1f05-4e81-b5be-a8b3b1b3fa81`.

Downloaded active source matches the tested bundle: SHA-256 `61917bcd85c91d26d0aaf8f602d73e16d85921d75d9ab08629666c89a7a2784f`. All 27 binding names/types, compatibility settings, both schedules and Pages deployment `2cb3c127-4941-4c28-898d-225aed0666a0` are preserved. No database or configuration changes. Browser verification uses local Chromium fixtures.
