import base from './playwright.config.mjs';
export default {...base,testMatch:'competitor-analysis.browser.spec.mjs',webServer:{...base.webServer,env:{TOYS_TEST_REVIEWS_PLUS:'true',TOYS_TEST_COMPETITOR_ANALYSIS:'true'}}};
