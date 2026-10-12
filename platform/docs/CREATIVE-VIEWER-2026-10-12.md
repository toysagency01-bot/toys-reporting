# Meta creative viewer — 12 October 2026

The top-three cards previously exposed only `image_url` or the small default
`thumbnail_url`, which looked blurry when stretched. They did not fetch the
creative's text or playable video.

The cards now have an **Открыть креатив** action. It opens a native, responsive
modal with the available image/video, full primary copy, headline, description,
destination link and original post link when Meta supplies it. Carousels and
multiple dynamic assets can be browsed. Dynamic text alternatives are labeled
as alternatives rather than claiming a single delivered combination.

The backend verifies the project's selected top-three entry, active integration
and the ad's account before requesting creative data. An opaque project-scoped
key addresses the detail endpoint; raw integration configuration, credentials and
private hierarchy are excluded from the response. Media references are derived
from the verified ad, never from arbitrary user-provided Graph node IDs. Optional
post/video/image denials retain the other available content.

Original images are resolved from account image hashes; videos use their source
URL and the largest returned poster. The regular card enrichment also requests
1080px thumbnails, retaining the old preview if that request fails. Missing video
sources and thumbnail-only results are labeled explicitly, with no claim of HD
when Meta does not provide it. Existing-post access, video permissions, dynamic
formats and signed CDN expiration can limit what Meta returns.

Detail fetches happen only on click. Browser memory and Worker Cache API retain
sanitized detail results for five minutes; there is no new D1 media storage or
migration. Browser requests are shared and bounded; the UI supports retry after
an error. Video does not autoplay and releases its source on close. Escape,
keyboard focus return, page scroll restoration, responsive layout and HTML
escaping are covered by browser checks.

Updated published boards:

- https://reports.toys-agency.com/housevip-cxp7/
- https://reports.toys-agency.com/karlovarska-sul-k4rm/
- https://reports.toys-agency.com/profkit-instashop-r4vk/

Google asset previews and agency creative-approval uploads are separate features
and were not changed by this release.

Validation: 51 API/model tests passed; 24 existing Chromium scenarios passed, and
the two new viewer scenarios passed after fixing synchronous close cleanup and
the hidden-video test selector. Relevant API tests were rerun after final changes.
Desktop/mobile screenshots were inspected locally. Real Meta media responses
were not checked from this environment because live report/Meta domains are not
permitted; Graph responses in tests are synthetic.

Active Worker: `de84a872-b68c-45d7-b4bf-417aa1811412`, 100% traffic, confirmed by
Cloudflare API. Downloaded deployed module exactly matches the tested bundle:
`1d5013177781db2e8926b69bba396d33d52b91b6e419c4cbf5acb85ca4fa4952`.
Rollback Worker: `a9ac5985-bdb8-406e-8a34-f0b3b02577f2`.
Pages routing and database schema are unchanged.
