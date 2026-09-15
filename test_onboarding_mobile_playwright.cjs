const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function main() {
  const outDir = path.resolve('C:/Users/USER/.gemini/antigravity-ide/brain/785e3ec8-c01f-497c-98fa-bef2da6d7431/screenshots');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });

  const viewports = [
    { name: 'iphone_se_320', width: 320, height: 568 },
    { name: 'iphone_14_390', width: 390, height: 844 },
    { name: 'desktop_1440', width: 1440, height: 900 },
  ];

  for (const vp of viewports) {
    console.log(`\nTesting viewport: ${vp.name} (${vp.width}x${vp.height})`);
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();

    // Set auth state before any page load
    await page.addInitScript(() => {
      const superAdminSession = {
        access_token: 'fake-jwt-token-superadmin',
        token_type: 'bearer',
        user: {
          id: '00000000-0000-0000-0000-000000000001',
          email: 'superadmin@kingdomdash.com',
          user_metadata: { role: 'super_admin' },
        },
      };
      localStorage.setItem('sb-kbrfaccrhmvgcdtdfjna-auth-token', JSON.stringify(superAdminSession));
    });

    const url = 'http://localhost:5174/admin/dashboard';
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(2000);

    console.log(`[${vp.name}] Current URL: ${page.url()}`);
    await page.screenshot({ path: path.join(outDir, `page_state_${vp.name}.png`) });

    // Click "Onboard Vendors"
    console.log(`[${vp.name}] Finding Onboard Vendors button...`);
    const vendorBtn = page.getByRole('button', { name: 'Onboard Vendors' });
    const count = await vendorBtn.count();
    console.log(`[${vp.name}] Onboard Vendors count: ${count}`);
    if (count > 0) {
      await vendorBtn.first().scrollIntoViewIfNeeded();
      await vendorBtn.first().click();
      await page.waitForTimeout(600);

    // Vendor modal screenshot - top
    const vendorTopPath = path.join(outDir, `modal_vendor_${vp.name}_top.png`);
    await page.screenshot({ path: vendorTopPath });
    console.log(`Saved: ${vendorTopPath}`);

    // Scroll vendor modal form
    const modalForm = page.locator('div[role="dialog"] form');
    if (await modalForm.isVisible()) {
      await modalForm.evaluate((el) => el.scrollTo({ top: 300, behavior: 'instant' }));
      await page.waitForTimeout(300);
      const vendorScrollPath = path.join(outDir, `modal_vendor_${vp.name}_scroll.png`);
      await page.screenshot({ path: vendorScrollPath });
      console.log(`Saved: ${vendorScrollPath}`);
    }

    // Close vendor modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    }

    // Click "Onboard Riders"
    console.log(`[${vp.name}] Clicking Onboard Riders...`);
    const riderBtn = page.getByRole('button', { name: 'Onboard Riders' });
    const riderCount = await riderBtn.count();
    console.log(`[${vp.name}] Onboard Riders count: ${riderCount}`);
    if (riderCount > 0) {
      await riderBtn.first().scrollIntoViewIfNeeded();
      await riderBtn.first().click();
      await page.waitForTimeout(600);

      // Rider modal screenshot - top
      const riderTopPath = path.join(outDir, `modal_rider_${vp.name}_top.png`);
      await page.screenshot({ path: riderTopPath });
      console.log(`Saved: ${riderTopPath}`);

      // Scroll rider modal form
      const modalForm = page.locator('div[role="dialog"] form');
      if (await modalForm.isVisible()) {
        await modalForm.evaluate((el) => el.scrollTo({ top: 300, behavior: 'instant' }));
        await page.waitForTimeout(300);
        const riderScrollPath = path.join(outDir, `modal_rider_${vp.name}_scroll.png`);
        await page.screenshot({ path: riderScrollPath });
        console.log(`Saved: ${riderScrollPath}`);
      }

      // Close rider modal
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    }

    await context.close();
  }

  await browser.close();
  console.log('\nAll Playwright screenshots finished successfully!');
}

main().catch((err) => {
  console.error('Playwright execution error:', err);
  process.exit(1);
});
