import base from './playwright.config.mjs';
export default {...base,testMatch:'finance.browser.spec.mjs',outputDir:new URL('../dist/finance-browser-results',import.meta.url).pathname,webServer:{...base.webServer,env:{TOYS_TEST_PLATFORM_ROLES:'true'}}};
