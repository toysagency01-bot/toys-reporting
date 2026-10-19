import config from './playwright.config.mjs';
export default {...config,testMatch:'crm-admin.spec.mjs',webServer:{...config.webServer,env:{TOYS_TEST_PLATFORM_ROLES:'true',TOYS_TEST_ADMIN_CRM:'true'}}};
