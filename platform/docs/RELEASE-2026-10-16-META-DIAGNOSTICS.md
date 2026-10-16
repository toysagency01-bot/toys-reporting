# Meta import diagnostics and WeDoProfi account correction

Meta imports previously reduced HTTP authorization failures to `provider_unauthorized`, losing the numeric provider code and subcode already parsed by the adapter. Scheduled failures now record those numeric fields in `sync_runs` under `meta-import-diagnostic`. Raw error messages, request URLs and credentials are excluded. Diagnostic persistence does not change retry timing or publish partial advertising data.

The user confirmed `1634287341592816` is the only current WeDoProfi account. Its existing integration was updated from `887536285814184`, with prior snapshots retained under their original account scope. Currency and timezone verification was reset so the new account must supply its own metadata before import. The old integration and import status were backed up outside the repository.

The 14:20 Asia/Tbilisi import on 2026-10-16 succeeded for Karlovarska Sul and Visa. The other nine active Meta integrations still returned `provider_unauthorized`; this run preceded deployment of the additional diagnostics. TOYS Agency remains a draft without an advertising integration. These checks do not establish that the remaining account permissions are resolved.

Validation: unified bundles built, recovery tests passed with network permission for the local Worker runtime, and whitespace checks passed. The added regression test verifies numeric-only diagnostics, exclusion of sensitive error fields, and unchanged scheduled retry behavior.

Worker version: `b2266acf-c86c-48df-ab8f-b790b75ac5f1`.
Rollback: `c4aa6452-c5ee-4eb8-8a3c-4732df6cdc85` (retains the media-buyer credential pair).
