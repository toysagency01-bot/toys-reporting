import base from './playwright.config.mjs';
export default {...base,testMatch:'onboarding.browser.spec.mjs',outputDir:new URL('../dist/onboarding-browser-results',import.meta.url).pathname,webServer:{...base.webServer,env:{TOYS_TEST_PLATFORM_ROLES:'true',TOYS_TEST_ONBOARDING:'true'}}};
