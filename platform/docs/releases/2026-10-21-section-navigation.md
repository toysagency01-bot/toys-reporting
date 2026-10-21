# Dashboard section menu: native new-tab navigation

Changed only the dashboard section menu (Overview, Campaigns, Funnel, Results and comments, Project, plus existing variant-specific sections). Section controls now render as real links. Normal clicks retain existing in-page navigation; right-click, middle-click and Ctrl/Cmd-click use browser navigation. Opening Project directly restores that section in generic and Instashop dashboards. Styling and original icons are preserved.

No changes to CRM cards, boards, reports, campaign entities, data access, permissions, integrations or database schema. Earlier broader uncommitted navigation work was discarded after the user clarified scope.

Validation: build passed; 194 backend/asset tests passed; three browser scenarios cover HOUSEVIP, BSCLINIC and PROFKIT Instashop, every section URL in a fresh tab, native middle/Ctrl-click, uncancelled context menus, retained current tab, and ordinary desktop/mobile navigation. Six existing browser regressions passed for material tabs, weekly editing/publication, original board variants, cached CRM navigation and legacy Leads routes. Desktop/mobile screenshots reviewed locally. Production-site browser access is restricted by this environment; browser QA used the built Worker through the Pages test gateway.

Implementation commit: e6275fc.

Released existing Worker toys-agency-platform-staging at 100%: a648dd1a-9b51-4144-aa39-4e03b50a8095. Active deployment confirmed through the Cloudflare API. Rollback: 9fb7eab6-ab2f-4124-bf16-90b979ba9562. Pages registry verified; no gateway change needed.
