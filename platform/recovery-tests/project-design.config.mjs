import base from './playwright.config.mjs';
export default {
 ...base,
 testMatch:['sales-demo.browser.spec.mjs','nova-design.browser.spec.mjs','nova-loading.browser.spec.mjs','nova-mobile.browser.spec.mjs','client-compact.browser.spec.mjs','project-rollout.browser.spec.mjs','monthly.browser.spec.mjs','campaign-controls.browser.spec.mjs','section-navigation.browser.spec.mjs','keycrm-cost.browser.spec.mjs'],
 outputDir:new URL('../dist/project-design-results',import.meta.url).pathname,
 webServer:{...base.webServer,env:{TOYS_TEST_PLATFORM_ROLES:'true',TOYS_TEST_SALES_DEMO:'true',TOYS_TEST_MONTHLY:'true',TOYS_TEST_PROJECT_DESIGN:'true'}}
};
