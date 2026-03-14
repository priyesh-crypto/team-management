const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('http://localhost:3000');
  
  // Fill the signup form (second form on the page)
  await page.fill('form:nth-of-type(2) input[name="name"]', 'Debug User');
  await page.fill('form:nth-of-type(2) input[name="email"]', `debug_${Date.now()}@example.com`);
  await page.fill('form:nth-of-type(2) input[name="password"]', 'password123');
  
  console.log("Submitting form...");
  await Promise.all([
    page.waitForNavigation(),
    page.click('form:nth-of-type(2) button[type="submit"]')
  ]);
  
  console.log("Redirected to URL:", page.url());
  
  await browser.close();
})();
