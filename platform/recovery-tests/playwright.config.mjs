import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'.',testMatch:'browser.spec.mjs',workers:1,use:{baseURL:'http://127.0.0.1:4173',launchOptions:{executablePath:'/usr/bin/chromium',args:['--no-sandbox']}},webServer:{cwd:new URL('..',import.meta.url).pathname,command:'node recovery-tests/server.mjs',port:4173,reuseExistingServer:false},reporter:'list'});
