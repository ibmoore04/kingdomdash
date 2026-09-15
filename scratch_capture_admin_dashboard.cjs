const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Set auth state in localStorage for Super Admin
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

  let url = 'http://localhost:5174/admin/dashboard';
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.waitForTimeout(2500);

  const outDir = path.resolve('C:/Users/USER/.gemini/antigravity-ide/brain/785e3ec8-c01f-497c-98fa-bef2da6d7431/screenshots');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const outPath = path.join(outDir, 'admin_dashboard_onboarding.png');
  await page.screenshot({ path: outPath });
  console.log('Saved screenshot to:', outPath);

  await browser.close();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
