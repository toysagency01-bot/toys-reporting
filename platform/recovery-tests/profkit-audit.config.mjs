import base from './playwright.config.mjs';
export default {...base,testMatch:'profkit-audit.browser.spec.mjs',webServer:{...base.webServer,env:{TOYS_TEST_PROJECT_DESIGN:'true'}}};
