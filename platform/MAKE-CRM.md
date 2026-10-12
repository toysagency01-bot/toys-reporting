# Make → TOYS CRM

The agency settings are at https://reports.toys-agency.com/mvp/api/v2/master/view.
Select a project, open CRM → Источники и CAPI, bind its Facebook page and create
the project intake key. Only the agency master can view connection settings.
Creating another key replaces the old key for both website and Meta API intake.

## Meta Lead Ads

Use Make's standard **Facebook Lead Ads → New Lead** instant trigger. If its output
does not include contact fields, add **Get Lead Details**, then **HTTP → Make a request**.
Authorize Make for the Facebook page and assign Make in Meta Business Settings →
Integrations → Leads Access. This route does not require configuring our application's
Meta callback, verify token or App Secret.

HTTP settings:

- URL: `https://reports.toys-agency.com/mvp/api/crm/ingest/PROJECT_SLUG/meta-lead`
- Method: POST; body type: JSON; use a data structure for escaping mapped values.
- HTTP v4 Credentials: API key in header `Authorization`, value `Bearer PROJECT_KEY`.
  Store the real key only in Credentials, never in the scenario URL or browser code.
- Return error on HTTP failure; retain failed executions for retry. A successful
  response is HTTP 201 with `{"ok":true,"id":"crm_…"}`.

Map these fields from the native lead. IDs must be strings, not floating-point numbers:

```json
{
  "leadgenId": "native Meta lead ID",
  "pageId": "native Facebook page ID",
  "name": "full name",
  "email": "contact email",
  "phone": "contact phone",
  "createdAt": "ISO creation timestamp",
  "formId": "native form ID",
  "adAttribution": {
    "provider": "meta_ads",
    "accountId": "ad account ID",
    "adId": "ad ID",
    "campaignId": "campaign ID",
    "adsetId": "ad set ID"
  }
}
```

`leadgenId`, `pageId` and either email or phone are required. The page must be
bound to that project. Ad attribution is optional: omit the object if the source
does not supply verified advertising IDs. The account must match an active project
integration; unknown accounts never contribute to ad-level qualifications.
The CRM can still match CAPI events using the native lead ID without ad attribution.

If Make's lead detail output lacks the ad account ID, retrieve ad details using
Make's Meta advertising connection rather than guessing an account from its name.
Organic/test leads may have no associated ad.

Retries use the native lead ID and do not replace existing lead status or create
duplicate contacts. Direct Meta delivery and Make share the same deduplication key.
After qualification/sale in CRM, the platform queues CAPI itself; do not create
a second Make conversion scenario for the same milestones.

## Website forms

Tilda / WordPress / Lovable / Wix → native Make trigger or Make Custom webhook → HTTP.
Send to the same project prefix ending in `/website`, using the same Credentials.
Map `submissionId` (stable form submission ID), `name`, `email`, `phone`; optionally
`description`, `utm`, `fbp`, `fbc`, `eventSourceUrl`, `adAttribution`.
Keep the same submissionId when retrying. At least email or phone is required.
Check incoming form authentication in Make or the site's server adapter where supported.

## Verification

After configuring the real scenario, run one lead through Make and verify that it
appears only in the intended client's CRM. Replay the same input: the returned ID
must stay the same and the CRM must still contain one record. Configure the correct
project dataset and CAPI credentials before qualifying a real lead. Confirm Meta's
acknowledgement in the lead's delivery status. Local tests cover this flow with
synthetic inputs; no production lead or conversion was generated for testing.

References: [Make Facebook Lead Ads](https://apps.make.com/facebook-lead-ads),
[Make HTTP](https://apps.make.com/http).
