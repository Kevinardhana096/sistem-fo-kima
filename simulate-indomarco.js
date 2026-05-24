// simulate-indomarco.js
// Playwright script to simulate admin UI data entry for PT Indomarco Prismatama (Kima 10)

const { chromium } = require('playwright');
const dotenv = require('dotenv');
dotenv.config();

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Login as admin (assumes login page at /login and env vars ADMIN_EMAIL, ADMIN_PASS)
  await page.goto(`${process.env.APP_URL}/login`);
  await page.fill('input[name="email"]', process.env.ADMIN_EMAIL);
  await page.fill('input[name="password"]', process.env.ADMIN_PASS);
  await page.click('button:has-text("Login")');
  await page.waitForNavigation();

  // Navigate to Add Customer page
  await page.goto(`${process.env.APP_URL}/customers/new`);

  // Fill customer form
  await page.fill('input[name="customerName"]', 'PT Indomarco Prismatama (Kima 10)');
  await page.selectOption('select[name="parentCustomer"]', 'PT Cendikia Global Solusi');
  await page.selectOption('select[name="package"]', 'SHARING_CORE'); // Assuming value
  await page.fill('input[name="ratio"]', '1/32');

  // Contract 1 (2022-10-22 to 2023-10-21)
  await page.click('button:has-text("Add Contract")');
  await page.fill('input[name="contractStart"]:nth-of-type(1)', '2022-10-22');
  await page.fill('input[name="contractEnd"]:nth-of-type(1)', '2023-10-21');
  await page.fill('input[name="contractCode"]:nth-of-type(1)', 'KIMA.BAK-10/DBO/FO/XII/2022');
  await page.fill('input[name="invoiceCode"]:nth-of-type(1)', '079/INV.FO/XII/2022');

  // Contract 2 (2023-10-22 to 2024-10-21)
  await page.click('button:has-text("Add Contract")');
  await page.fill('input[name="contractStart"]:nth-of-type(2)', '2023-10-22');
  await page.fill('input[name="contractEnd"]:nth-of-type(2)', '2024-10-21');
  await page.fill('input[name="contractCode"]:nth-of-type(2)', 'KIMA.BAK-49/DBO/FO/X/2023');
  await page.fill('input[name="invoiceCode"]:nth-of-type(2)', 'INV-020/KIMA/FO/VI/2024');

  // Contract 3 (2024-10-22 to 2025-10-21)
  await page.click('button:has-text("Add Contract")');
  await page.fill('input[name="contractStart"]:nth-of-type(3)', '2024-10-22');
  await page.fill('input[name="contractEnd"]:nth-of-type(3)', '2025-10-21');
  await page.fill('input[name="contractCode"]:nth-of-type(3)', 'KIMA.BAK-64/DBO/FO/X/2024');
  await page.fill('input[name="invoiceCode"]:nth-of-type(3)', 'INV-021/KIMA/FO/I/2025');

  // Contract 4 (2025-10-22 to 2026-10-21)
  await page.click('button:has-text("Add Contract")');
  await page.fill('input[name="contractStart"]:nth-of-type(4)', '2025-10-22');
  await page.fill('input[name="contractEnd"]:nth-of-type(4)', '2026-10-21');
  await page.fill('input[name="contractCode"]:nth-of-type(4)', 'KIMA.BAK-52/DBO/FO/XI/2025');
  await page.fill('input[name="invoiceCode"]:nth-of-type(4)', '106/FO/11/25');

  // Submit form
  await page.click('button:has-text("Save")');
  await page.waitForSelector('text=Customer created successfully');

  await browser.close();
})();
