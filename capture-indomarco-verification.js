// capture-indomarco-verification.js
// Playwright script to capture screenshots for PT Indomarco Prismatama after data entry

const { chromium } = require('playwright');
require('dotenv').config();

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Login as admin
  await page.goto(`${process.env.APP_URL}/login`);
  await page.fill('input[name="email"]', process.env.ADMIN_EMAIL);
  await page.fill('input[name="password"]', process.env.ADMIN_PASS);
  await page.click('button:has-text("Login")');
  await page.waitForNavigation();

  // Monitoring page - verify customer appears in active table
  await page.goto(`${process.env.APP_URL}/monitoring`);
  await page.waitForSelector('text=PT Indomarco Prismatama (Kima 10)');
  await page.screenshot({ path: 'indomarco_monitoring.png', fullPage: true });

  // Open tenant detail page
  // Assuming link contains customer name and navigates to /customers/[id]?tab=invoices
  await page.click('a:has-text("PT Indomarco Prismatama (Kima 10)")');
  await page.waitForSelector('text=Invoices');
  await page.screenshot({ path: 'indomarco_tenant_detail.png', fullPage: true });

  await browser.close();
})();
