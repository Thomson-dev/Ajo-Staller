import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', (err) => errors.push(String(err)));

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.screenshot({ path: 'C:/Users/Thomson/AppData/Local/Temp/claude/c--Users-Thomson-ajo-stellar/1cef22d2-8414-4260-bd96-05f8846b3b7c/scratchpad/landing.png', fullPage: true });
console.log('Landing body text:', (await page.locator('body').innerText()).slice(0, 500));

await page.click('text=Launch App >> nth=0');
await page.waitForURL('**/app');
await page.screenshot({ path: 'C:/Users/Thomson/AppData/Local/Temp/claude/c--Users-Thomson-ajo-stellar/1cef22d2-8414-4260-bd96-05f8846b3b7c/scratchpad/app-page.png', fullPage: true });
console.log('App page body text:', (await page.locator('body').innerText()).slice(0, 500));

console.log('Console errors:', errors);
await browser.close();
