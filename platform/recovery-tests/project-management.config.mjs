import base from './playwright.config.mjs';
export default {...base,testMatch:'project-management.browser.spec.mjs',webServer:{...base.webServer,env:{TOYS_TEST_PLATFORM_ROLES:'true',TOYS_TEST_PROJECT_MANAGEMENT:'true'}}};
