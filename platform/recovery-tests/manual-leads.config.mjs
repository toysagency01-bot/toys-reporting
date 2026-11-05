import base from './playwright.config.mjs';
export default {...base,testMatch:'manual-leads.browser.spec.mjs',webServer:{...base.webServer,env:{TOYS_TEST_PLATFORM_ROLES:'true',TOYS_TEST_MANUAL_LEADS:'true'}}};
