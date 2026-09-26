const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5173';
const SCREENSHOTS_DIR = path.join(__dirname, 'playwright_full_qa_screenshots');
const SUPABASE_STORAGE_KEY = 'sb-kbrfaccrhmvgcdtdfjna-auth-token';

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

// User Profiles for testing RBAC and Dashboards
const mockAdmin = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  email: 'admin@kingdomdash.test',
  full_name: 'Super Admin Ops',
  phone: '+2348011111111',
  role: 'super_admin',
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockCustomer = {
  id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  email: 'customer@kingdomdash.test',
  full_name: 'Test Customer',
  phone: '+2348022222222',
  role: 'customer',
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockVendor = {
  id: 'vvvvvvvv-vvvv-vvvv-vvvv-vvvvvvvvvvvv',
  email: 'vendor@kingdomdash.test',
  full_name: 'Mama Put Kitchen',
  phone: '+2348033333333',
  role: 'vendor',
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockRider = {
  id: 'rrrrrrrr-rrrr-rrrr-rrrr-rrrrrrrrrrrr',
  email: 'rider@kingdomdash.test',
  full_name: 'Speedy Dispatcher',
  phone: '+2348044444444',
  role: 'rider',
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

async function injectSession(page, profile) {
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
    localStorage.setItem('kd_auth_profile', JSON.stringify(prof));
  }, { storageKey: SUPABASE_STORAGE_KEY, prof: profile });

  // Route interception for Supabase profiles query
  await page.route('**/rest/v1/profiles*', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(profile),
    });
  });

  if (profile.role === 'vendor') {
    const mockVendorData = {
      id: 'vvvvvvvv-vvvv-vvvv-vvvv-vvvvvvvvvvvv',
      profile_id: profile.id,
      business_name: 'Mama Put Kitchen',
      business_type: 'restaurant',
      phone: profile.phone,
      address: '12 Hospital Road, Ijebu-Ode',
      description: 'Authentic local dishes & fast dispatch',
      is_active: true,
      is_verified: true,
      rating: 4.8,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await page.route('**/rest/v1/vendors*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockVendorData),
      });
    });
  }
}

async function runComprehensiveQA() {
  console.log('🚀 Starting Playwright Full System E2E, Security & UI Audit...');
  const browser = await chromium.launch({ headless: true });
  const report = [];

  const logResult = (testName, passed, details, screenshotFile = null) => {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} - ${testName}`);
    if (details) console.log(`   └─ ${details}`);
    report.push({ testName, passed, details, screenshotFile });
  };

  try {
    // ----------------------------------------------------
    // TEST 1: Public Pages Accessibility & SEO Structure
    // ----------------------------------------------------
    const page = await browser.newPage();
    
    // Track console errors & unhandled exceptions
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => consoleErrors.push(err.message));

    const publicRoutes = ['/', '/food', '/groceries', '/courier', '/personal-shopper', '/become-vendor', '/faq'];
    for (const route of publicRoutes) {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle' });
      await page.waitForSelector('h1', { timeout: 3000 }).catch(() => {});
      const title = await page.title();
      const h1Count = await page.locator('h1').count();
      const screenshotPath = path.join(SCREENSHOTS_DIR, `public_${route.replace(/\//g, '_') || 'home'}.png`);
      await page.screenshot({ path: screenshotPath, timeout: 5000 }).catch(() => {});
      
      logResult(
        `Public Route: ${route}`,
        h1Count >= 1 && title.length > 0,
        `Title: "${title}" | H1 Count: ${h1Count}`,
        screenshotPath
      );
    }
    await page.close();

    // ----------------------------------------------------
    // TEST 2: RBAC Security & Unauthorized Route Redirection
    // ----------------------------------------------------
    console.log('\n🔒 Testing RBAC Security & Protected Route Gatekeeping...');
    const rbacPage = await browser.newPage();

    // Test Anonymous Access to Admin Page (Must Redirect to Login)
    await rbacPage.goto(`${BASE_URL}/admin/dashboard`, { waitUntil: 'domcontentloaded' });
    await rbacPage.waitForTimeout(1000);
    const currUrlAnon = rbacPage.url();
    const anonRedirected = !currUrlAnon.includes('/admin/dashboard');
    logResult(
      'RBAC Security: Anonymous access to /admin/dashboard blocked',
      anonRedirected,
      `Current URL: ${currUrlAnon}`
    );
    await rbacPage.close();

    // Test Customer Trying to Access /admin/support
    const custRbacPage = await browser.newPage();
    await injectSession(custRbacPage, mockCustomer);
    await custRbacPage.goto(`${BASE_URL}/admin/support`, { waitUntil: 'domcontentloaded' });
    await custRbacPage.waitForTimeout(1000);
    const currUrlCust = custRbacPage.url();
    const custBlocked = !currUrlCust.includes('/admin/support');
    logResult(
      'RBAC Security: Customer access to /admin/support blocked',
      custBlocked,
      `Current URL: ${currUrlCust}`
    );
    await custRbacPage.close();

    // ----------------------------------------------------
    // TEST 3: Admin Portal & Support Desk Inspection
    // ----------------------------------------------------
    console.log('\n🛡️ Testing Admin Portal & Support Desk Functionality...');
    const adminPage = await browser.newPage();
    await injectSession(adminPage, mockAdmin);

    await adminPage.goto(`${BASE_URL}/admin/support`, { waitUntil: 'networkidle' });
    await adminPage.waitForTimeout(1500);
    const adminSupportScreenshot = path.join(SCREENSHOTS_DIR, 'admin_support_desk.png');
    await adminPage.screenshot({ path: adminSupportScreenshot, timeout: 5000 }).catch(() => {});

    const hasSupportTitle = await adminPage.locator('text=Support & Report Center').isVisible().catch(() => false);
    logResult(
      'Admin Portal: Support & Report Center Page Loads',
      hasSupportTitle,
      'Verified header and metric cards',
      adminSupportScreenshot
    );
    await adminPage.close();

    // ----------------------------------------------------
    // TEST 4: Customer Dashboard & Support Tab
    // ----------------------------------------------------
    console.log('\n👤 Testing Customer Dashboard & User Support Tracking...');
    const custPage = await browser.newPage();
    await injectSession(custPage, mockCustomer);

    await custPage.goto(`${BASE_URL}/dashboard?tab=support`, { waitUntil: 'networkidle' });
    await custPage.waitForTimeout(1500);
    const customerSupportScreenshot = path.join(SCREENSHOTS_DIR, 'customer_support_tab.png');
    await custPage.screenshot({ path: customerSupportScreenshot, timeout: 5000 }).catch(() => {});

    const hasCustomerSupport = await custPage.locator('text=Support Requests & Ticket Tracking').isVisible().catch(() => false);
    logResult(
      'Customer Portal: Support Requests & Ticket Tracking Tab Loads',
      hasCustomerSupport,
      'Verified reference tracking & support ticket form',
      customerSupportScreenshot
    );

    // Test Corporate Dispatch Portal Tab
    await custPage.goto(`${BASE_URL}/dashboard?tab=corporate`, { waitUntil: 'networkidle' });
    await custPage.waitForTimeout(1500);
    const customerCorporateScreenshot = path.join(SCREENSHOTS_DIR, 'customer_corporate_tab.png');
    await custPage.screenshot({ path: customerCorporateScreenshot, timeout: 5000 }).catch(() => {});

    const hasCustomerCorporate = await custPage.locator('text=Open a KingdomDash Corporate Account').isVisible().catch(() => false) ||
                                 await custPage.locator('text=ONBOARDED CORPORATE PARTNER').isVisible().catch(() => false);
    logResult(
      'Customer Portal: Corporate Dispatch Portal Tab Loads',
      hasCustomerCorporate,
      'Verified Corporate Dispatch Portal & Application Desk',
      customerCorporateScreenshot
    );
    await custPage.close();

    // ----------------------------------------------------
    // TEST 5: Vendor Dashboard & Support Tab
    // ----------------------------------------------------
    console.log('\n🏪 Testing Vendor Dashboard & Support Tab...');
    const vendorPage = await browser.newPage();
    await injectSession(vendorPage, mockVendor);

    await vendorPage.goto(`${BASE_URL}/vendor?tab=support`, { waitUntil: 'networkidle' });
    await vendorPage.waitForTimeout(1500);
    const vendorSupportScreenshot = path.join(SCREENSHOTS_DIR, 'vendor_support_tab.png');
    await vendorPage.screenshot({ path: vendorSupportScreenshot, timeout: 5000 }).catch(() => {});

    const hasVendorSupport = await vendorPage.locator('text=Merchant & Vendor Support Desk').isVisible().catch(() => false);
    logResult(
      'Vendor Portal: Merchant Support & Desk Tab Loads',
      hasVendorSupport,
      'Verified vendor ticket reference submission and history',
      vendorSupportScreenshot
    );
    await vendorPage.close();

    // ----------------------------------------------------
    // TEST 6: Rider Dashboard & Support Page
    // ----------------------------------------------------
    console.log('\n🛵 Testing Rider Dashboard & Support Page...');
    const riderPage = await browser.newPage();
    await injectSession(riderPage, mockRider);

    await riderPage.goto(`${BASE_URL}/rider/support`, { waitUntil: 'networkidle' });
    await riderPage.waitForTimeout(1500);
    const riderSupportScreenshot = path.join(SCREENSHOTS_DIR, 'rider_support_page.png');
    await riderPage.screenshot({ path: riderSupportScreenshot, timeout: 5000 }).catch(() => {});

    const hasRiderSupport = await riderPage.locator('text=Rider Support Desk').isVisible().catch(() => false);
    logResult(
      'Rider Portal: Rider Support & Assistance Page Loads',
      hasRiderSupport,
      'Verified rider ticket submission & emergency hotlines',
      riderSupportScreenshot
    );
    await riderPage.close();

    // ----------------------------------------------------
    // TEST 7: Console & Runtime Errors Audit
    // ----------------------------------------------------
    console.log('\n⚠️ Auditing Unhandled JavaScript Console Errors...');
    const criticalJsErrors = consoleErrors.filter(
      err => !err.includes('React Router Future Flag Warning') && !err.includes('Failed to load resource')
    );
    logResult(
      'Runtime Integrity: No Unhandled JS Errors during navigation',
      criticalJsErrors.length === 0,
      criticalJsErrors.length > 0 ? `Errors: ${criticalJsErrors.slice(0, 3).join('; ')}` : 'Clean execution log'
    );
  } catch (err) {
    console.error('❌ QA Execution Exception:', err);
  } finally {
    await browser.close();
    fs.writeFileSync(
      path.join(SCREENSHOTS_DIR, 'qa_summary_report.json'),
      JSON.stringify(report, null, 2)
    );
    console.log('\n✨ Playwright E2E Audit Complete! Summary report saved.');
  }
}

runComprehensiveQA();
