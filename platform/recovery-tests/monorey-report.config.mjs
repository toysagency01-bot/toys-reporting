import base from './playwright.config.mjs';
export default {...base,testMatch:'monorey-report.browser.spec.mjs',webServer:{...base.webServer,env:{TOYS_TEST_PROJECT_DESIGN:'true'}}};
