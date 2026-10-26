import base from './playwright.config.mjs';
export default {...base,testMatch:'mobile-back.browser.spec.mjs',webServer:{...base.webServer,env:{TOYS_TEST_PLATFORM_ROLES:'true'}}};
