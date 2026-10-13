import {defineConfig} from '@playwright/test';
import base from './playwright.config.mjs';
export default defineConfig({...base,testMatch:'crm-real-estate.spec.mjs',webServer:{...base.webServer,env:{TOYS_TEST_CRM_INDUSTRY:'real_estate'}}});
