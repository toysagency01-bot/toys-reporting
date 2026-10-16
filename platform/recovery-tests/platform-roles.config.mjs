import config from './playwright.config.mjs';
export default {...config,testMatch:'platform-roles.spec.mjs',webServer:{...config.webServer,env:{TOYS_TEST_PLATFORM_ROLES:'true'}}};
