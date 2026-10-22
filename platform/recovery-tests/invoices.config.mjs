import config from './playwright.config.mjs';
export default {...config,testMatch:'invoices.spec.mjs',webServer:{...config.webServer,env:{TOYS_TEST_PLATFORM_ROLES:'true',TOYS_TEST_REPORT_STORAGE:'true'}}};
