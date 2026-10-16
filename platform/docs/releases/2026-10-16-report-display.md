# Report display

Expanded reports now show the complete summary, including paragraph breaks and long unbroken text. Their summary no longer inherits the legacy single-line `.weekly-preview` truncation. Collapsed cards keep a two-line preview.

Unfilled fields (including whitespace and dash placeholders) are omitted from published/draft cards, imported previous reports and revision history. The editor retains every field. No report content or permissions are changed.

Validation: three browser scenarios covering report creation, publication, comments, screenshot dialogs, deletion, full multiline rendering and omitted fields passed. Full-text rendering was measured at 1440px and 390px; screenshots were inspected. Editor/viewer behavior and revision history were checked. Existing backend code and data are unchanged.

Rollback Worker version: `006f8cce-81cb-4e8d-acc2-36dcd50c82db`.
