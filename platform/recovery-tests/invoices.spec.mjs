import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {PDFDocument} from 'pdf-lib';
const route='/master/#documents?project=housevip-cxp7';
test('desktop invoice workflow saves requisites, previews exact totals, downloads PDF and duplicates independently',async({page})=>{
 await page.setViewportSize({width:1536,height:1100});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(route);await expect(page.locator('#documents')).toBeVisible();await expect(page.locator('#channels')).toBeHidden();await expect(page.locator('#periodSeg')).toBeHidden();
 await page.locator('[data-doc-new]').first().click();await page.locator('[name=issuer]').fill('TOYS Agency\nИван Иванов\nPraha, Česká republika');await page.locator('[name=customer]').fill('Test client s.r.o.\nhello@example.test');await page.locator('[name=payment]').fill('Test Bank\nIBAN TEST123\nSWIFT TEST');
 await page.locator('[name=currency]').selectOption('USD');await page.locator('[name=description]').fill('Ведение Meta Ads / Správa reklamy');await page.locator('[name=price]').fill('1000.25');await page.locator('[name=discount]').fill('10');await page.locator('[name=tax]').fill('20');await page.locator('[name=status]').selectOption('issued');
 await expect(page.locator('.invoice-paper-total')).toContainText('1080.26 USD');
 await page.locator('[data-doc-defaults]').click();await expect(page.locator('[data-doc-message]')).toContainText('Реквизиты сохранены');await page.getByRole('button',{name:'Сохранить инвойс',exact:true}).click();await expect(page.locator('[data-doc-message]')).toHaveText('Инвойс сохранён.');await expect(page.locator('[name=number]')).toHaveValue('INV-2026-0001');
 const downloadPromise=page.waitForEvent('download');await page.locator('[data-doc-pdf]').click();const download=await downloadPromise;expect(download.suggestedFilename()).toBe('INV-2026-0001.pdf');await download.saveAs('/tmp/toys-invoice-desktop.pdf');const pdf=await PDFDocument.load(readFileSync('/tmp/toys-invoice-desktop.pdf'));expect(pdf.getPageCount()).toBe(1);
 await expect(page.locator('[data-doc-message]')).toContainText('PDF готов');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'/tmp/toys-invoice-editor-desktop.png',fullPage:true});
 await page.locator('[data-doc-copy-current]').click();await expect(page.locator('[name=number]')).toHaveValue('INV-2026-0002');await expect(page.locator('[name=status]')).toHaveValue('draft');await expect(page.locator('[name=issuer]')).toContainText('TOYS Agency');
 await page.locator('[name=price]').fill('250');await page.getByRole('button',{name:'Сохранить инвойс',exact:true}).click();await expect(page.locator('[data-doc-message]')).toHaveText('Инвойс сохранён.');await page.locator('[data-doc-back]').click();await expect(page.locator('.invoice-list tbody tr')).toHaveCount(2);
 await page.getByRole('button',{name:'INV-2026-0001',exact:true}).click();await expect(page.locator('[name=price]')).toHaveValue('1000.25');await page.locator('[data-doc-back]').click();await page.locator('[data-doc-new]').first().click();await expect(page.locator('[name=customer]')).toContainText('Test client');await expect(page.locator('[name=number]')).toHaveValue('');
 await page.locator('[data-doc-back]').click();await page.reload();await expect(page.locator('#projectSelect')).toHaveValue('housevip-cxp7');await expect(page.locator('.invoice-list tbody tr')).toHaveCount(2);expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'/tmp/toys-invoice-list-desktop.png',fullPage:true});
});
test('team documents are scoped to assigned projects; unsaved changes survive cancelled navigation and incomplete PDF errors',async({page})=>{
 await page.setExtraHTTPHeaders({'x-test-role':'team'});await page.goto(route);await page.locator('[data-doc-new]').first().click();await page.locator('[name=issuer]').fill('Unsaved team invoice');
 page.once('dialog',d=>d.dismiss());await page.locator('[data-view=home]').click();await expect(page.locator('#documents')).toBeVisible();await expect(page.locator('[name=issuer]')).toHaveValue('Unsaved team invoice');
 await page.locator('[data-doc-pdf]').click();await expect(page.locator('[data-doc-message]')).toContainText('Для PDF');await expect(page.locator('[name=issuer]')).toHaveValue('Unsaved team invoice');
 await page.setExtraHTTPHeaders({'x-test-role':'client'});await page.reload();await expect(page.locator('[data-doc-new]')).toHaveCount(0);
});
