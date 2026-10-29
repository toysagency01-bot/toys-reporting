import base from './playwright.config.mjs';
export default {...base,testMatch:'product-funnel.browser.spec.mjs',webServer:{...base.webServer,env:{TOYS_TEST_PLATFORM_ROLES:'true',TOYS_TEST_PRODUCT_FUNNEL:'true'}}};
