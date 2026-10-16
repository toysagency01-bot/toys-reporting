import config from './playwright.config.mjs';
export default {...config,testMatch:'weekly-first-report.spec.mjs',webServer:{...config.webServer,env:{TOYS_TEST_EMPTY_WEEKLY:'true',TOYS_TEST_REPORT_STORAGE:'true'}}};
