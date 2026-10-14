# Recover missing creative previews — 14 October 2026

Ranking cards incorrectly reported that an ad had no image when only the saved
thumbnail was missing. Opening the same ad could return its original media, but
the viewer updated an existing `img` only, leaving placeholder cards unchanged.

Visible cards with missing or failed thumbnails now reuse the existing full
creative endpoint and its client cache. At most two background detail requests
run at once; images and video posters populate the cards without preloading
video. Opening the viewer shares in-flight reads and replaces a placeholder when
media becomes available. Ranking changes reuse resolved details. Actual preview
failures use preview-specific wording without claiming the ad has no image.

Validation: 11 browser scenarios and four creative-related recovery test files
passed. Regression coverage includes missing thumbnails, expired thumbnail URLs,
video posters, shared requests, ranking changes, and successful modal recovery
after a failed background preview. Browser checks used local controlled media;
the reports host is not directly reachable under this environment's policy.

Active Worker: `def0cd4d-7c8e-40a6-ba06-ce408aef5db6` (100%).
Rollback Worker: `9c4c0016-fdbd-49a3-a9e9-cb08db1d71a5`.
No advertising import, database, access policy, or project setting changed.
