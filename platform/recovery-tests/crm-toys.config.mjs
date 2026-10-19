import config from './crm-admin.config.mjs';
export default {...config,testMatch:'crm-toys.spec.mjs',webServer:{...config.webServer,env:{...config.webServer.env,TOYS_TEST_CRM_TEMPLATE:'toys_agency'}}};
