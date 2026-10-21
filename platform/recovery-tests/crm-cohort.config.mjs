import config from './playwright.config.mjs';
export default {...config,testMatch:'crm-cohort.spec.mjs',webServer:{...config.webServer,env:{TOYS_TEST_COHORT:'true'}}};
