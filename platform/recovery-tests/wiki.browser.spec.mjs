import {test,expect} from '@playwright/test';

for(const width of [1440,390])test(`team reads and searches WIKI safely at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:950});await page.setExtraHTTPHeaders({'x-test-role':'team'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/master/#wiki?page=testing');await expect(page.locator('#heading')).toHaveText('TOYS WIKI');
 await expect(page.locator('.wiki-prose')).toContainText('Уникальная методика');await expect(page.locator('.wiki-prose table')).toBeVisible();await expect(page.locator('[data-wiki-edit]')).toHaveCount(0);
 expect(await page.evaluate(()=>window.wikiXss)).toBeUndefined();await expect(page.locator('.wiki-prose a[href^="javascript:"]')).toHaveCount(0);
 await expect(page.getByRole('link',{name:'Внешняя инструкция'})).toHaveAttribute('rel','noopener noreferrer');
 if(width<900){await page.getByRole('button',{name:'Разделы',exact:true}).click();await expect(page.locator('.wiki-navigation')).toBeVisible();await page.locator('.wiki-navigation [data-wiki-page="handbook"]').click();await expect(page.locator('.wiki-navigation')).not.toBeVisible();await expect(page.locator('[data-wiki-heading]')).toHaveText('Работа команды');}
 await page.getByRole('searchbox',{name:'Поиск в WIKI'}).fill('уНИКАЛЬНАЯ');await expect(page.locator('.wiki-results')).toContainText('Тестирование кампаний');
 await page.locator('.wiki-results a').click();await expect(page.locator('.wiki-prose')).toContainText('Уникальная методика');
 await page.screenshot({path:`/tmp/toys-wiki-team-${width}.png`,fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});

for(const width of [1440,390])test(`admin edits directly, autosaves and restores history at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:950});await page.setExtraHTTPHeaders({'x-test-role':'admin'});await page.goto('/master/#wiki?page=tools');
 const title=page.getByRole('textbox',{name:'Название раздела',exact:true}),body=page.getByRole('textbox',{name:'Текст раздела',exact:true});
 await expect(body).toBeEditable();await expect(page.getByRole('button',{name:'Сохранить',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Редактировать',exact:true})).toHaveCount(0);
 await title.fill('Сервисы команды');await body.fill('Текст для всей команды.');await body.press('Control+a');await expect(page.locator('[data-wiki-bubble]')).toBeVisible();await page.locator('[data-wiki-bubble]').getByRole('button',{name:'Жирный',exact:true}).click();await expect(body.locator('strong')).toHaveText('Текст для всей команды.');
 await expect(page.locator('.wiki-status')).toHaveText('Сохранено');await page.reload();await expect(body.locator('strong')).toHaveText('Текст для всей команды.');await expect(title).toHaveText('Сервисы команды');
 await body.fill('Самый новый текст перед переходом');await page.getByRole('button',{name:'Все разделы',exact:true}).click();await expect(page.locator('.wiki-categories')).toBeVisible();
 const saved=await(await page.request.get('/api/v2/master/wiki/pages/tools')).json();expect(saved.page.body).toContain('Самый новый текст');await page.goto('/master/#wiki?page=tools');
 await page.getByRole('button',{name:'История',exact:true}).click();await page.locator('[data-wiki-version="1"]').click();await page.getByRole('button',{name:'Восстановить эту версию'}).click();await expect(title).toHaveText('Инструменты');await expect(page.locator('.wiki-status')).toHaveText('Сохранено');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`/tmp/toys-wiki-inline-${width}.png`,fullPage:true});
 await page.setExtraHTTPHeaders({'x-test-role':'team'});await page.reload();await expect(page.locator('.wiki-prose')).toContainText('Полезные ссылки');await expect(page.locator('#wiki [contenteditable=true],#wiki [contenteditable="plaintext-only"]')).toHaveCount(0);
});

test('conflict keeps the inline draft and never overwrites another administrator',async({page})=>{
 await page.setExtraHTTPHeaders({'x-test-role':'admin'});await page.goto('/master/#wiki?page=testing');const body=page.getByRole('textbox',{name:'Текст раздела',exact:true});
 await body.fill('Мой несохранённый черновик');const current=await(await page.request.get('/api/v2/master/wiki/pages/testing')).json();
 await page.request.put('/api/v2/master/wiki/pages/testing',{headers:{origin:'http://127.0.0.1:4173'},data:{version:current.page.version,title:current.page.title,body:'Изменение другого администратора'}});
 await expect(page.locator('.wiki-status')).toContainText('другой администратор');await expect(body).toHaveText('Мой несохранённый черновик');
 await body.fill('Мой новый черновик');await page.waitForTimeout(1100);const remote=await(await page.request.get('/api/v2/master/wiki/pages/testing')).json();expect(remote.page.body).toBe('Изменение другого администратора');
 await expect(page.getByRole('button',{name:'Скачать мой черновик'})).toBeVisible();
});

test('network failure retains the draft and retries without a save button',async({page})=>{
 await page.setExtraHTTPHeaders({'x-test-role':'admin'});await page.goto('/master/#wiki?page=handbook');const body=page.getByRole('textbox',{name:'Текст раздела',exact:true});
 await page.route('**/api/v2/master/wiki/pages/handbook',route=>route.request().method()==='PUT'?route.abort('connectionfailed'):route.continue());
 await body.fill('Черновик при отключённой сети');await expect(page.locator('.wiki-status')).toContainText('Не удалось сохранить');await expect(body).toHaveText('Черновик при отключённой сети');
 await page.unroute('**/api/v2/master/wiki/pages/handbook');await page.getByRole('button',{name:'Повторить',exact:true}).click();await expect(page.locator('.wiki-status')).toHaveText('Сохранено');await page.reload();await expect(body).toHaveText('Черновик при отключённой сети');
});

test('rich editing preserves imported literal prefixes, attachment links and tables',async({page})=>{
 await page.setExtraHTTPHeaders({'x-test-role':'admin'});await page.goto('/master/#wiki?page=preserve');const body=page.getByRole('textbox',{name:'Текст раздела',exact:true});
 await expect(body.getByRole('link',{name:'Открыть материал'})).toHaveAttribute('href','https://example.com/attachment');
 await body.click();await body.press('Control+End');await body.press('ArrowDown');await body.press('Enter');await body.pressSequentially('Дополнение к материалу');
 await expect(page.locator('.wiki-status')).toHaveText('Сохранено');await page.reload();
 await expect(body).toContainText('1. Это нумерация внутри текста.');await expect(body).toContainText('- Это дефис внутри текста.');
 await expect(body.getByRole('link',{name:'Открыть материал'})).toHaveAttribute('href','https://example.com/attachment');await expect(body.locator('table')).toBeVisible();await expect(body).toContainText('Дополнение к материалу');
});
