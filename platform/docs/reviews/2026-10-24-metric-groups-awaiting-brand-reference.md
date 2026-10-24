# Metric grouping — prior icon review (superseded)

The user subsequently chose no metric icons and requested rounded inner cards
inside each group. Website artwork is no longer required. This note records the
rejected design only; follow the newer implementation/release record.

Commit 7991b16 implements the requested grouped metric panels. The demo displays
three panels of four values: advertising, leads/qualification, and CRM sales.
Original native metric IDs, values and parents remain intact; CSS grid assigns
positions across the source containers. Instashop/project results and CRM results
remain separately labelled. Commerce mirrors the current native funnel only while
that native panel is available, preventing stale results across period changes.

Validation passed: 232 automated checks and 83 browser scenarios (55 main,
4 grouping/palette, 5 demo, 2 cohort, 3 monthly, 3 section links, 3 roles,
8 campaign-control/audit). Desktop/mobile screenshots in both themes were reviewed.

The user rejected the icon treatment in 7991b16 as stock-looking, monotonous and
outside the brand style, and asked to use the main website as the reference.
Do not activate uploaded Worker 379459cb-04eb-472e-acf1-2c7f2fb9a02d: it includes
those rejected icons. The active Worker remains
924634d0-7fba-4950-8c5c-d58a97c4892e.

Reference: https://toys-agency.com/ — service illustrations in “Чем можем помочь”:
- /wp-content/themes/toys/assets/services-doodle/motion-20261006/audit-rest.webp
- /wp-content/themes/toys/assets/services-doodle/motion-20261006/advertising-rest.webp
- /wp-content/themes/toys/assets/services-doodle/motion-20261006/marketing-rest-v2.webp

The web connector can read the page text and discover these URLs, but returns
only an ImageDisplayed marker, not pixel data. Its screenshot function does not
support HTML/images. Direct HTTPS requests to toys-agency.com return a proxy
CONNECT 403 because the environment only permits the custom host api.cloudflare.com
(and package-manager presets). No site images exist in this workspace. A screenshot
or one reference illustration is needed for a faithful visual revision, or the
supported environment configuration workflow must grant normal access to the site.
Do not bypass the network policy. The user has not approved the rejected icons.

Next: inspect an actual reference image, replace icon artwork with brand-matching
assets and varied treatments, repeat relevant usability checks, and deploy the
complete change using the currently active version as the compare-and-swap guard.
Keep metric grouping, visibility, business values and the current light palette.
Avoid middle-dot separators in the new UI.
