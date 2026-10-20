# NOVA funnel and campaigns through CRM sales — 2026-10-20

Implementation: `62a902f`; Worker `9fb7eab6-ab2f-4124-bf16-90b979ba9562`
serves 100%. Previous Worker: `fb3add46-6cb0-46b8-8da8-c3bb3ed91b4b`.
Pages registry is unchanged, so no gateway deployment was needed.

- Removed only `tab_nova_demo_project_sales-tour` from synthetic project
  `prj_nova_sales_demo`; 8 project tabs remain. Generator/importer now expect 8.
  The demo's tabs request uses a new cache key to retire the old menu immediately.
- Demo funnel: impressions → clicks → CRM leads → first qualifications → sales.
  Every step shows conversion from the previous step and from impressions. Also
  shows lead-to-sale, qualification-to-sale and CRM revenue.
- Demo campaign cards add qualifications, sales, the corresponding conversion
  rates, revenue, CPQL, advertising cost per sale and CRM ROAS. Desktop and mobile
  cards show all metrics without horizontal page scrolling.
- One D1 aggregation supplies the funnel and campaign results. CRM cohorts use lead
  creation date in Tbilisi and all recorded milestone outcomes as of the current
  read; later outcomes remain assigned to their original lead cohort. Deleted
  contacts are excluded; current lost/rejected columns do not erase milestones.
  Campaign matching uses provider and stored campaign identity, never name.
- Ratios are computed from aggregate counts. Zero sales display 0% and zero
  revenue, cost per sale with zero denominator is unavailable. Mismatched revenue
  currencies fail closed. Unmatched CRM leads are disclosed in the funnel.
- Filtered overview CRM cards use the same cohort totals. CRM writes invalidate
  the demo funnel/campaign cache, and the existing scheduled refresh refreshes the
  analytics. No live advertising API requests were added.

## Validation

194 unified tests passed. Direct sales analytics tests additionally verify totals,
weighted ratios, channel partitions, five campaign totals, zero denominators,
Tbilisi date boundaries, delayed outcomes, deleted contacts and no contact data in
responses. Administrator-only checks include the new endpoint.

Browser QA passed at 1440 and 390 px: full funnel, campaigns, existing reports and
CRM, removed menu item, Meta/Google filter consistency and overflow. An additional
browser scenario changed a synthetic CRM lead to qualified and verified that the
cached dashboard updated from 822 to 823 without reloading the page. These writes
were local fixtures only.

Production D1 readback reconciled 1,416 leads, 822 qualifications, 203 sales and
EUR 313,930 revenue; the five campaign sale counts sum to 203. Google has 23
sales and both channels together 203. Conversion lead-to-sale is
14.336158192090394%, shown as 14.34%; qualification-to-sale is 24.70%.

After release, verified active version, 8 remaining tabs, zero removed-tab rows
and zero demo CAPI delivery jobs. Hosted configuration and data checks use the
Cloudflare API; browser QA ran against the built Worker and Pages gateway locally
because the execution network does not permit direct hosted-site navigation.
