# Mobile cabinet back navigation — 2026-10-26

The client and master cabinets now provide a phone-only “Назад” button when an in-app return destination exists. It follows a bounded in-memory trail of sections, retains project channels and restores scroll position. It uses existing authorized navigation handlers rather than browser history, since legacy section links replace the current URL. Direct links fall back to the cabinet overview/home without navigating outside the application. The control is hidden on desktop and at a root with no prior destination.

In the client shell the button remains accessible in CRM and returns to the prior dashboard section. Nested campaign navigation consumes back presses one level at a time before leaving campaigns. A visible report editor consumes back presses to return to its list: unsaved report/comment text requires confirmation, and saves, uploads, deletions or comment submission block premature departure. Cancelling leaves the form intact. Master navigation retains invoice leave guards and keeps the return destination when a departure is cancelled. Embedded CRM does not receive a duplicate master button.

The project presentation now hides explanatory heading placeholders rather than deleting them. The existing HOUSEVIP channel handler still writes to those nodes; deleting them caused project navigation to stop before updating the active section. Keeping hidden nodes fixes that exception and enables reliable return to project channels. Master bundling explicitly treats the shared navigation stylesheet as text.

The requested follow-up also removes colored rails beside report channel names. Channel logos and the main-result/section heading accents remain.

## Validation

- Automated recovery run: 258 passed. Build, syntax and whitespace checks passed.
- 28 distinct browser scenarios passed across seven new mobile navigation scenarios, five report lifecycle scenarios, five report UX scenarios and eleven existing mobile/design/section-navigation scenarios.
- Coverage includes section order, CRM round trips and direct links, master navigation, campaign drill-out, project channel restoration, desktop visibility, unsaved invoice cancellation/retry, report draft protection and busy blocking, no overflow, phone rotation, both themes, touch controls and native modified-link behavior. Existing first-screen layouts retain their space because the control is hidden at a root with no return target.
- Synthetic Chromium screenshots reviewed. No physical Safari or authenticated production browser verification; trail persistence across a full reload is intentionally not added.

## Deployment

- Active Worker `toys-agency-platform-staging`, 100%: `9dab35f1-c4c2-4322-ba8a-310c6c805231`.
- Rollback: `9e3b7093-0a54-4bd7-9680-66b585a1549f`.
- Downloaded deployed source matches the tested bundle, SHA-256 `bd8376b5d7da9c89ac32e9e5011885de41140fe362997e6129571e6abc2ea311`.
- All 27 binding names/types, compatibility settings, both schedules and Pages deployment `2cb3c127-4941-4c28-898d-225aed0666a0` preserved. No database migration or configuration change.
- Ignored verification evidence: `dist/mobile-back-release-before.json`, `dist/mobile-back-release-verified.json`.
