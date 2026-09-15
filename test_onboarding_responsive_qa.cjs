const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5174';
const SCREENSHOTS_DIR = path.resolve('C:/Users/USER/.gemini/antigravity-ide/brain/785e3ec8-c01f-497c-98fa-bef2da6d7431/screenshots');
const SUPABASE_STORAGE_KEY = 'sb-kbrfaccrhmvgcdtdfjna-auth-token';

const mockAdmin = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  email: 'admin@kingdomdash.test',
  full_name: 'Standard Ops Admin',
  phone: '+2348011111111',
  role: 'admin',
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

async function setupPageRoutes(page) {
  // Mock auth token
  await page.addInitScript(({ storageKey, prof }) => {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({
      sub: prof.id,
      email: prof.email,
      role: 'authenticated',
      aud: 'authenticated',
      exp: Math.floor(Date.now() / 1000) + 7200
    }));
    const fakeJwt = `${header}.${payload}.${btoa('signature')}`;
    const sessionData = {
      access_token: fakeJwt,
      token_type: 'bearer',
      expires_in: 7200,
      expires_at: Math.floor(Date.now() / 1000) + 7200,
      refresh_token: 'fake-refresh-token',
      user: {
        id: prof.id,
        aud: 'authenticated',
        role: 'authenticated',
        email: prof.email,
        email_confirmed_at: new Date().toISOString(),
        user_metadata: { full_name: prof.full_name },
        app_metadata: { provider: 'email' },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    };
    localStorage.setItem(storageKey, JSON.stringify(sessionData));
    localStorage.setItem('sb-placeholder-auth-token', JSON.stringify(sessionData));
  }, { storageKey: SUPABASE_STORAGE_KEY, prof: mockAdmin });

  // Auth user endpoint
  await page.route('**/auth/v1/user*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: mockAdmin.id,
        email: mockAdmin.email,
        app_metadata: { provider: 'email' },
        user_metadata: { full_name: mockAdmin.full_name },
        aud: 'authenticated',
        role: 'authenticated'
      })
    });
  });

  // Profiles endpoint
  await page.route('**/rest/v1/profiles*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'content-range': '0-0/1' },
      body: JSON.stringify(mockAdmin)
    });
  });

  // Admin analytics endpoint
  await page.route('**/rest/v1/rpc/get_admin_analytics*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        summary: {
          total_orders: 124,
          completed_orders: 110,
          cancelled_orders: 5,
          total_revenue: 450000,
          active_vendors_count: 18,
          active_riders_count: 22,
          pending_vendor_applications: 3,
          pending_rider_applications: 4
        },
        live_metrics: {
          pending_orders_live: 3,
          active_deliveries_live: 8,
          unassigned_deliveries_live: 2,
          available_riders_live: 6
        },
        orders_by_service: [{ service_type: 'food', count: 80 }, { service_type: 'grocery', count: 44 }],
        completion_trends: [],
        order_status_distribution: [],
        delivery_status_distribution: []
      })
    });
  });

  // User profiles list for linking
  await page.route('**/rest/v1/rpc/get_eligible_user_profiles*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 'u-1', full_name: 'Oluwaseun Ade', email: 'oluwaseun@test.ng', phone: '08012345678', role: 'customer' },
        { id: 'u-2', full_name: 'Chioma Okeke', email: 'chioma@test.ng', phone: '08023456789', role: 'customer' }
      ])
    });
  });
}

async function run() {
  const browser = await chromium.launch({ headless: true });

  const viewports = [
    { name: 'iphone_se_320', width: 320, height: 568 },
    { name: 'iphone_14_390', width: 390, height: 844 },
    { name: 'desktop_1440', width: 1440, height: 900 }
  ];

  for (const vp of viewports) {
    console.log(`\n=== Testing Viewport: ${vp.name} (${vp.width}x${vp.height}) ===`);
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2
    });
    const page = await context.newPage();
    await setupPageRoutes(page);

    await page.goto(`${BASE_URL}/admin/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Verify Onboard Vendors button is visible
    const vendorBtn = page.getByRole('button', { name: 'Onboard Vendors' });
    await vendorBtn.scrollIntoViewIfNeeded();
    await vendorBtn.click();
    await page.waitForTimeout(500);

    // Capture Vendor modal top
    const vendorTopPath = path.join(SCREENSHOTS_DIR, `onboard_vendor_${vp.name}_top.png`);
    await page.screenshot({ path: vendorTopPath });
    console.log(`Captured: ${vendorTopPath}`);

    // Check overflow inside modal
    const overflow = await page.evaluate(() => {
      const modal = document.querySelector('div[role="dialog"]');
      if (!modal) return { error: 'No dialog' };
      const form = modal.querySelector('form');
      return {
        modalScrollWidth: modal.scrollWidth,
        modalClientWidth: modal.clientWidth,
        formScrollWidth: form ? form.scrollWidth : 0,
        formClientWidth: form ? form.clientWidth : 0,
        hasHorizontalOverflow: form ? form.scrollWidth > form.clientWidth : false
      };
    });
    console.log(`[${vp.name}] Vendor modal overflow check:`, overflow);

    // Scroll down modal to view inputs and sticky footer
    const formLocator = page.locator('div[role="dialog"] form');
    if (await formLocator.isVisible()) {
      await formLocator.evaluate(el => el.scrollTo({ top: el.scrollHeight, behavior: 'instant' }));
      await page.waitForTimeout(300);
      const vendorBottomPath = path.join(SCREENSHOTS_DIR, `onboard_vendor_${vp.name}_bottom.png`);
      await page.screenshot({ path: vendorBottomPath });
      console.log(`Captured: ${vendorBottomPath}`);
    }

    // Close vendor modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);

    // Open Rider modal
    const riderBtn = page.getByRole('button', { name: 'Onboard Riders' });
    await riderBtn.scrollIntoViewIfNeeded();
    await riderBtn.click();
    await page.waitForTimeout(500);

    // Capture Rider modal top
    const riderTopPath = path.join(SCREENSHOTS_DIR, `onboard_rider_${vp.name}_top.png`);
    await page.screenshot({ path: riderTopPath });
    console.log(`Captured: ${riderTopPath}`);

    // Scroll down rider modal
    if (await formLocator.isVisible()) {
      await formLocator.evaluate(el => el.scrollTo({ top: el.scrollHeight, behavior: 'instant' }));
      await page.waitForTimeout(300);
      const riderBottomPath = path.join(SCREENSHOTS_DIR, `onboard_rider_${vp.name}_bottom.png`);
      await page.screenshot({ path: riderBottomPath });
      console.log(`Captured: ${riderBottomPath}`);
    }

    // Close rider modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);

    await context.close();
  }

  await browser.close();
  console.log('\n✅ All responsive screenshots successfully captured!');
}

run().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
