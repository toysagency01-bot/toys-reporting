export async function selectNovaSection(page,view){
 await page.locator('#novaSectionToggle').click();
 await page.locator(`#novaSectionMenu [data-nova-view="${view}"]`).click();
}
