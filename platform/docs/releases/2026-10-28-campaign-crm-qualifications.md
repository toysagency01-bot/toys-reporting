# Campaign-level CRM qualifications and cost

Connecting CRM now adds `Квал-лиды CRM` and `Стоимость квала` to the campaign
browser, including its cached dataset, search, sorting, mobile cards and desktop
table. This is a response capability, not a project slug or demo-only setting.
Count sorting puts the highest totals first; cost sorting puts the lowest known
cost first and unknown prices last. Existing CRM access restrictions also apply.

Native CRM qualifications use the deduplicated intake cohort already used on
the overview. Provider, account and ad identity must match exactly inside the
project's advertising tree, then counts roll up to groups and campaigns once at
each alternative level. Campaign cost is its own spend divided by its matched
CRM qualifications. Zero qualifications, unknown spend and partial advertising
coverage have no calculated price. Unmatched qualifications are disclosed and
are never allocated proportionally. If attribution is incomplete, an unmatched
campaign shows unknown rather than a fabricated zero.

VISA KeyCRM still requires exact `utm_source=toys`. The read-only adapter now
matches `utm_campaign` against an exact campaign ID or exact unique campaign
name in snapshots belonging to configured ad accounts of the same project.
Ambiguous names/accounts, missing or unknown tags remain unmatched. Arbitrary
UTM values and contacts are never persisted; only verified IDs and a reason enum
are stored. Matching does not infer an ad or group from a campaign-only tag.

Additive migration `0038_keycrm_campaigns.sql` stores the verified identity and
scan revision. A scan freezes its owned campaign catalogue, checkpoints it with
pagination, and publishes attribution only after every page passes existing
scope and completeness checks. Legacy/partial generations cannot masquerade as
verified attribution. Source-verified overview totals stay readable meanwhile.
Absent previously verified cards retain their qualification and attribution;
observed source/tag changes replace that attribution in later scans.

Adapter contract: `available`, integer `qualified`, and deduplicated `byAd`
facts with provider/account/ad/qualified, or authoritative `byCampaign` facts
with provider/account/campaign/qualified. KeyCRM additionally supplies
`campaignAttributionAvailable` to gate its revision. No account IDs or lead
records are returned in campaign presentation responses.

Rollout from `platform`:

```sh
python scripts/rollout-keycrm.py schema
# Build, validate and deploy the Worker before requesting the new scan.
python scripts/rollout-keycrm.py campaigns
python scripts/rollout-keycrm.py status
node scripts/verify-campaign-crm-readback.mjs
```

## Working readback, 28 October 2026

The completed revision published successfully against an owned catalogue of 11
campaigns. For 20–26 October, the seven source-filtered qualifications reconcile
as follows: one exact campaign match, four unknown campaign tags and two retained
historical cards without a newly verified campaign tag. No unknown values were
stored or assigned by similarity. The matched campaign is
`Toys / TOF / Schengen / ru / Website / 16.10.2026`: one CRM qualification,
PLN 167.53 spend and **PLN 167.53 per qualification**. The other six qualifications
remain in the project total and are disclosed as unmatched in Campaigns.

SELECT-only verification ran the real summary, advertising snapshot, campaign
metrics, sorting and browser-dataset calculation against the working D1. All
310 recovery tests passed; six Chromium tests covered existing project designs,
overview qualification cost, new campaign columns, sorting and mobile layouts.

Published Worker: `83c723f2-a774-4df3-97b5-4a9000821605` (100%).
Prior Worker: `521b67a2-efb0-4969-aeb8-41f78756a3d7`.
