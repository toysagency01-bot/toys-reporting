# AM Klinika QualifiedLead CAPI activation

The user explicitly requested sending qualified-lead CRM events to Meta.
Only project `prj_amklinika_k8m2`, account `1830858661278666` and its connected
Page `1069830429555541` were configured. Dataset discovery found exactly one
account Dataset, `963055329465667` / AMKlinik_Pixel. The worker verified account
membership and Dataset identity before enabling CAPI and encrypting its token.

Readback: capi_enabled=1, capi_kinds=qualified, qualified_event=QualifiedLead,
capi_setup_state=configured, capi_setup_error=null, encrypted token present.
Cutoff is 2026-11-02T09:05:07.902Z (13:05:07 Tbilisi). Source lead intake remains
ready, with no error. No historical qualification milestone was modified and no
synthetic conversion was sent. At verification there were no CAPI deliveries or
new qualification milestones; real delivery still requires the first actual
qualification and a Meta acknowledgment. Sales are not enabled for CAPI.

The change also prevents note edits and moves between qualified stages from
inventing new qualifications on historical cards. A stable milestone/event ID
deduplicates repeated transitions. Setup resumes events blocked during its
configuration interval only when their occurrence is after the cutoff. CAS on
project configuration prevents a delayed verification overwriting newer edits.

Validation: 334 recovery checks passed, followed by 16 focused Meta-sync checks
including single/ambiguous/empty Dataset discovery, no setup conversions, legacy
qualified-card edits, repeated qualification and safe blocked-event resumption.
No browser changes were made. Existing roles, unrelated projects, environment
secrets and financial records were untouched.

Code: `61b65ea`. Worker `5e76f9a0-ca7a-4302-9478-908d70364807` confirmed at 100%.
Rollback reference: `d42d13d1-6436-4ecd-ad88-5cad2c07c4e2`.
Downloaded deployed module matches the tested build, SHA-256
`693da66bdd76f7d2f6e9cafada76908d256f975366cc9d4372c82c7b2d44959d`.
