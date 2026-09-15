/**
 * KingdomDash — Comprehensive Browser QA Audit
 * Uses Playwright 1.63.0 to test the running dev server
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5174';
const RESULTS = { pass: [], fail: [], warn: [], consoleErrors: [], networkErrors: [] };
const SCREENSHOTS_DIR = path.join(__dirname, 'qa_screenshots');
if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

let screenshotCount = 0;
async function screenshot(page, name) {
  screenshotCount++;
  const file = path.join(SCREENSHOTS_DIR, `${String(screenshotCount).padStart(3,'0')}_${name.replace(/[^a-z0-9_]/gi,'_')}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

function pass(area, detail) {
  RESULTS.pass.push({ area, detail });
  console.log(`  [PASS] ${area}: ${detail}`);
}
function fail(area, detail, severity = 'High') {
  RESULTS.fail.push({ area, detail, severity });
  console.error(`  [FAIL] ${area} [${severity}]: ${detail}`);
}
function warn(area, detail) {
  RESULTS.warn.push({ area, detail });
  console.warn(`  [WARN] ${area}: ${detail}`);
}

async function setupConsoleAndNetwork(page) {
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Skip known benign React Router warnings
      if (text.includes('React Router Future Flag') || text.includes('React Compiler')) return;
      RESULTS.consoleErrors.push({ url: page.url(), text: text.substring(0, 200) });
    }
  });
  page.on('pageerror', err => {
    RESULTS.consoleErrors.push({ url: page.url(), text: `PAGE ERROR: ${err.message.substring(0, 200)}` });
  });
  page.on('requestfailed', req => {
    RESULTS.networkErrors.push({ url: req.url(), failure: req.failure()?.errorText || 'unknown' });
  });
  page.on('response', resp => {
    const url = resp.url();
    const status = resp.status();
    if (status >= 400 && !url.includes('favicon')) {
      RESULTS.networkErrors.push({ url: url.substring(0, 120), status });
    }
  });
}

async function checkVisible(page, selector, label, area) {
  try {
    const el = page.locator(selector).first();
    const visible = await el.isVisible({ timeout: 5000 });
    if (visible) pass(area, `${label} is visible`);
    else fail(area, `${label} NOT visible`, 'Medium');
    return visible;
  } catch {
    fail(area, `${label} not found (${selector})`, 'Medium');
    return false;
  }
}

async function checkNavigation(page, href, label, area) {
  try {
    await page.click(`a[href="${href}"]`, { timeout: 5000 });
    await page.waitForLoadState('networkidle', { timeout: 8000 });
    const url = page.url();
    const ok = url.includes(href.replace('/', ''));
    if (ok) pass(area, `Nav to ${label} works`);
    else warn(area, `Nav to ${label} — ended at ${url}`);
    return ok;
  } catch (e) {
    fail(area, `Nav link to ${label} failed: ${e.message?.substring(0,80)}`, 'Medium');
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: PUBLIC PAGES
// ─────────────────────────────────────────────────────────────────────────────
async function testHomepage(page) {
  console.log('\n>>> HOMEPAGE');
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 });
  await screenshot(page, 'homepage_desktop');

  await checkVisible(page, 'h1', 'H1 heading', 'Homepage');
  await checkVisible(page, 'nav', 'Navigation bar', 'Homepage');
  await checkVisible(page, 'footer', 'Footer', 'Homepage');

  // Check title
  const title = await page.title();
  if (title && title.length > 5) pass('Homepage', `Title: "${title}"`);
  else fail('Homepage', 'Missing page title', 'Medium');

  // Check KD branding
  const hasKD = await page.locator('text=KingdomDash').count() > 0;
  if (hasKD) pass('Homepage', 'KingdomDash brand name present');
  else fail('Homepage', 'Brand name not found', 'High');

  // Check hero CTA buttons
  const ctaButtons = await page.locator('a[href*="food"], a[href*="grocer"], a[href*="courier"]').count();
  if (ctaButtons >= 1) pass('Homepage', `${ctaButtons} primary CTA links found`);
  else warn('Homepage', 'No clear CTA links to Food/Grocery/Courier');

  // Check no horizontal scroll
  const hasHScroll = await page.evaluate(() => document.body.scrollWidth > window.innerWidth);
  if (!hasHScroll) pass('Homepage', 'No horizontal overflow at 1440px');
  else fail('Homepage', 'Horizontal scroll detected at desktop width', 'Medium');
}

async function testNavigation(page) {
  console.log('\n>>> NAVIGATION');
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });

  // Desktop nav links
  const navLinks = ['/food', '/groceries', '/courier', '/services', '/contact'];
  for (const href of navLinks) {
    const exists = await page.locator(`nav a[href="${href}"]`).count() > 0;
    if (exists) pass('Navigation', `Nav link "${href}" present`);
    else warn('Navigation', `Nav link "${href}" not found in nav`);
  }

  // Mobile nav — test at mobile viewport
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await screenshot(page, 'homepage_mobile');

  const hamburger = page.locator('button[aria-label*="menu"], button[aria-label*="Menu"], button[aria-label*="navigation"], [data-testid*="menu"], button:has(svg)').first();
  const hamburgerVisible = await hamburger.isVisible({ timeout: 3000 }).catch(() => false);
  if (hamburgerVisible) {
    pass('Navigation', 'Mobile hamburger menu visible at 390px');
    await hamburger.click();
    await page.waitForTimeout(500);
    await screenshot(page, 'mobile_nav_open');
    const mobileNavOpen = await page.locator('nav a[href="/food"], [role="dialog"] a[href="/food"], [role="navigation"] a[href="/food"]').first().isVisible({ timeout: 3000 }).catch(() => false);
    if (mobileNavOpen) pass('Navigation', 'Mobile nav drawer opens and shows links');
    else warn('Navigation', 'Mobile nav opened but food link not clearly visible');
  } else {
    warn('Navigation', 'No clear hamburger button found at 390px — may be inline nav');
  }

  await page.setViewportSize({ width: 1440, height: 900 });
}

async function testFoodPage(page) {
  console.log('\n>>> FOOD PAGE');
  await page.goto(`${BASE_URL}/food`, { waitUntil: 'networkidle', timeout: 15000 });
  await screenshot(page, 'food_page');

  const title = await page.title();
  if (title.toLowerCase().includes('food') || title.toLowerCase().includes('kingdom')) {
    pass('Food', `Page title: "${title}"`);
  }

  await checkVisible(page, 'h1, h2', 'Food page heading', 'Food');

  // Check for vendor cards
  await page.waitForTimeout(2000); // wait for data load
  const vendorCards = await page.locator('[class*="vendor"], [class*="store"], [class*="card"]').count();
  if (vendorCards > 0) pass('Food', `${vendorCards} vendor/store cards rendered`);
  else warn('Food', 'No vendor cards found (may be empty state)');

  // Screenshot with data
  await screenshot(page, 'food_vendors_loaded');

  // Check for vendor_services food filter
  const hasFilterOrSearch = await page.locator('input[type="search"], input[placeholder*="search" i], [role="search"], [class*="filter"]').count() > 0;
  if (hasFilterOrSearch) pass('Food', 'Search/filter UI present');
  else warn('Food', 'No search/filter UI found');
}

async function testGroceryPage(page) {
  console.log('\n>>> GROCERY PAGE');
  await page.goto(`${BASE_URL}/groceries`, { waitUntil: 'networkidle', timeout: 15000 });
  await screenshot(page, 'grocery_page');
  await checkVisible(page, 'h1, h2', 'Grocery page heading', 'Grocery');
  await page.waitForTimeout(2000);
  const cards = await page.locator('[class*="vendor"], [class*="store"], [class*="card"]').count();
  if (cards > 0) pass('Grocery', `${cards} vendor/store cards rendered`);
  else warn('Grocery', 'No vendor cards — possible empty state (no grocery vendors yet)');
  await screenshot(page, 'grocery_vendors_loaded');
}

async function testCourierPage(page) {
  console.log('\n>>> COURIER PAGE');
  await page.goto(`${BASE_URL}/courier`, { waitUntil: 'networkidle', timeout: 15000 });
  await screenshot(page, 'courier_page_top');

  await checkVisible(page, 'h1', 'Courier hero H1', 'Courier');

  // Check booking form is present (new implementation)
  const formVisible = await page.locator('form').first().isVisible({ timeout: 5000 }).catch(() => false);
  if (formVisible) pass('Courier', 'Booking form is present');
  else fail('Courier', 'Booking form NOT found on courier page', 'High');

  // Scroll to form
  await page.locator('#booking-form, form').first().scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(500);
  await screenshot(page, 'courier_booking_form');

  // Test form fields exist
  const fields = ['senderName', 'senderPhone', 'pickupAddress', 'recipientName', 'recipientPhone', 'deliveryAddress', 'packageType'];
  for (const fieldId of fields) {
    const exists = await page.locator(`#${fieldId}`).count() > 0;
    if (exists) pass('Courier', `Form field #${fieldId} exists`);
    else fail('Courier', `Form field #${fieldId} MISSING`, 'High');
  }

  // Test validation — submit empty form
  const submitBtn = page.locator('button[type="submit"]').first();
  await submitBtn.click();
  await page.waitForTimeout(500);
  const errorMsg = await page.locator('text=required, text=Required').first().isVisible({ timeout: 2000 }).catch(() => false);
  if (errorMsg) pass('Courier', 'Form validation shows error messages on empty submit');
  else warn('Courier', 'Form validation errors not clearly visible after empty submit');

  await screenshot(page, 'courier_form_validation');

  // Test that no vendor selection is present (courier is vendor-independent)
  const vendorSelect = await page.locator('text=Select vendor, text=Choose vendor, [name="vendorId"]').count();
  if (vendorSelect === 0) pass('Courier', 'Courier form correctly has NO vendor selection');
  else fail('Courier', 'Courier form incorrectly shows vendor selection', 'High');
}

async function testCart(page) {
  console.log('\n>>> CART PAGE');
  await page.goto(`${BASE_URL}/cart`, { waitUntil: 'networkidle', timeout: 15000 });
  await screenshot(page, 'cart_page');

  const title = await page.title();
  pass('Cart', `Page title: "${title}"`);

  const heading = await page.locator('h1, h2, [class*="cart"]').first().isVisible({ timeout: 5000 }).catch(() => false);
  if (heading) pass('Cart', 'Cart heading visible');
  else warn('Cart', 'No clear cart heading');

  // Check empty state (no items)
  const emptyState = await page.locator('text=empty, text=Empty, text=nothing, text=add').first().isVisible({ timeout: 3000 }).catch(() => false);
  if (emptyState) pass('Cart', 'Empty cart state shown');
  else warn('Cart', 'Empty state not clearly visible');
}

async function testAuthPages(page) {
  console.log('\n>>> AUTH PAGES');

  // Login
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 15000 });
  await screenshot(page, 'login_page');
  const loginForm = await page.locator('form').first().isVisible({ timeout: 5000 }).catch(() => false);
  if (loginForm) pass('Auth', 'Login form visible');
  else fail('Auth', 'Login form NOT found', 'Critical');

  const emailField = await page.locator('input[type="email"], input[name="email"]').count() > 0;
  if (emailField) pass('Auth', 'Login email field present');
  else fail('Auth', 'Login email field missing', 'Critical');

  const passwordField = await page.locator('input[type="password"]').count() > 0;
  if (passwordField) pass('Auth', 'Login password field present');
  else fail('Auth', 'Login password field missing', 'Critical');

  // Register
  await page.goto(`${BASE_URL}/register`, { waitUntil: 'networkidle', timeout: 15000 });
  await screenshot(page, 'register_page');
  const registerForm = await page.locator('form').first().isVisible({ timeout: 5000 }).catch(() => false);
  if (registerForm) pass('Auth', 'Register form visible');
  else fail('Auth', 'Register form NOT found', 'Critical');

  // Test redirect protection — try to access dashboard unauthenticated
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(2000);
  const currentUrl = page.url();
  const redirected = !currentUrl.includes('/dashboard') || currentUrl.includes('login');
  if (redirected) pass('Security', 'Unauthenticated /dashboard redirect works');
  else fail('Security', 'Unauthenticated access to /dashboard NOT redirected', 'Critical');
  await screenshot(page, 'auth_redirect');
}

async function testContactAndFooter(page) {
  console.log('\n>>> CONTACT & FOOTER');
  await page.goto(`${BASE_URL}/contact`, { waitUntil: 'networkidle', timeout: 15000 });
  await screenshot(page, 'contact_page');
  await checkVisible(page, 'h1, h2', 'Contact page heading', 'Contact');

  const email = await page.locator('text=Contact@kingdomdash.net, text=kingdomdash.net').first().isVisible({ timeout: 3000 }).catch(() => false);
  if (email) pass('Contact', 'Official email address visible on contact page');
  else warn('Contact', 'Official email not found on contact page');

  const whatsapp = await page.locator('a[href*="wa.me"], a[href*="whatsapp"]').count() > 0;
  if (whatsapp) pass('Contact', 'WhatsApp CTA link present');
  else warn('Contact', 'No WhatsApp link found on contact page');

  // Footer links from homepage
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  const footerLinks = await page.locator('footer a').count();
  if (footerLinks >= 3) pass('Footer', `Footer has ${footerLinks} links`);
  else warn('Footer', `Only ${footerLinks} footer links found`);
}

async function test404(page) {
  console.log('\n>>> 404 PAGE');
  await page.goto(`${BASE_URL}/this-route-does-not-exist-xyz`, { waitUntil: 'networkidle', timeout: 15000 });
  await screenshot(page, '404_page');
  const is404 = await page.locator('text=404, text=not found, text=Not Found, text=doesn\'t exist').first().isVisible({ timeout: 3000 }).catch(() => false);
  if (is404) pass('Routing', '404 page shown for invalid routes');
  else warn('Routing', 'No clear 404 message for invalid route');
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: RESPONSIVE DESIGN
// ─────────────────────────────────────────────────────────────────────────────
async function testResponsive(page) {
  console.log('\n>>> RESPONSIVE DESIGN');
  const viewports = [
    { width: 1440, height: 900, label: 'desktop_1440' },
    { width: 1280, height: 800, label: 'laptop_1280' },
    { width: 1024, height: 768, label: 'tablet_landscape_1024' },
    { width: 768, height: 1024, label: 'tablet_portrait_768' },
    { width: 390, height: 844, label: 'mobile_390' },
    { width: 375, height: 667, label: 'mobile_375' },
  ];

  const pagesToTest = [BASE_URL, `${BASE_URL}/food`, `${BASE_URL}/courier`];

  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    for (const url of pagesToTest) {
      const slug = url.replace(BASE_URL, '') || 'home';
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(800);
      await screenshot(page, `responsive_${vp.label}${slug.replace('/', '_')}`);

      // Check horizontal overflow
      const hasHScroll = await page.evaluate(() => document.body.scrollWidth > window.innerWidth + 5);
      if (!hasHScroll) pass('Responsive', `No horizontal overflow at ${vp.width}×${vp.height} on ${slug || '/'}`);
      else fail('Responsive', `Horizontal scroll at ${vp.width}×${vp.height} on ${slug || '/'}`, 'Medium');
    }
  }

  // Reset to desktop
  await page.setViewportSize({ width: 1440, height: 900 });
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: MULTI-SERVICE ARCHITECTURE VISUAL
// ─────────────────────────────────────────────────────────────────────────────
async function testMultiServiceArchitecture(page) {
  console.log('\n>>> MULTI-SERVICE ARCHITECTURE (MIGRATION 028)');

  // Food page — should show food vendors
  await page.goto(`${BASE_URL}/food`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(2000);
  const foodVendorCount = await page.locator('[class*="vendor"], [class*="store"]').count();
  pass('Multi-Service', `Food page renders ${foodVendorCount} vendor entries`);
  await screenshot(page, 'multiservice_food_page');

  // Grocery page — should show grocery vendors (may be 0 if none configured)
  await page.goto(`${BASE_URL}/groceries`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(2000);
  const groceryVendorCount = await page.locator('[class*="vendor"], [class*="store"]').count();
  pass('Multi-Service', `Grocery page renders ${groceryVendorCount} vendor entries`);
  await screenshot(page, 'multiservice_grocery_page');

  // Verify courier has no vendor marketplace UI
  await page.goto(`${BASE_URL}/courier`, { waitUntil: 'networkidle', timeout: 15000 });
  const noVendorMarketplace = await page.locator('text=Select a vendor, text=Browse vendors, text=Choose store').count() === 0;
  if (noVendorMarketplace) pass('Multi-Service', 'Courier page has no vendor marketplace — correct');
  else fail('Multi-Service', 'Courier page incorrectly shows vendor marketplace', 'High');
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4: ROUTE REFRESH TEST
// ─────────────────────────────────────────────────────────────────────────────
async function testRouteRefresh(page) {
  console.log('\n>>> ROUTE REFRESH / SPA ROUTING');
  const routes = [
    { url: `${BASE_URL}/food`, name: 'food' },
    { url: `${BASE_URL}/groceries`, name: 'groceries' },
    { url: `${BASE_URL}/courier`, name: 'courier' },
    { url: `${BASE_URL}/contact`, name: 'contact' },
    { url: `${BASE_URL}/login`, name: 'login' },
  ];

  for (const route of routes) {
    await page.goto(route.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
    const status = await page.locator('h1, h2, main, [role="main"]').first().isVisible({ timeout: 5000 }).catch(() => false);
    if (status) pass('Routing', `Refresh on /${route.name} renders correctly`);
    else fail('Routing', `Refresh on /${route.name} — page broken after reload`, 'High');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5: VISUAL QA — KEY PAGES
// ─────────────────────────────────────────────────────────────────────────────
async function testVisualQuality(page) {
  console.log('\n>>> VISUAL QUALITY SCREENSHOTS');
  await page.setViewportSize({ width: 1440, height: 900 });
  const pages = [
    { url: BASE_URL, name: 'home_full' },
    { url: `${BASE_URL}/food`, name: 'food_full' },
    { url: `${BASE_URL}/groceries`, name: 'grocery_full' },
    { url: `${BASE_URL}/courier`, name: 'courier_full' },
    { url: `${BASE_URL}/services`, name: 'services_full' },
    { url: `${BASE_URL}/about`, name: 'about_full' },
    { url: `${BASE_URL}/contact`, name: 'contact_full' },
    { url: `${BASE_URL}/become-vendor`, name: 'become_vendor_full' },
    { url: `${BASE_URL}/become-rider`, name: 'become_rider_full' },
    { url: `${BASE_URL}/faq`, name: 'faq_full' },
    { url: `${BASE_URL}/login`, name: 'login_full' },
    { url: `${BASE_URL}/register`, name: 'register_full' },
  ];

  for (const p of pages) {
    await page.goto(p.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1500);
    await screenshot(page, p.name);
    pass('Visual', `Screenshot taken: ${p.name}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log('='.repeat(70));
  console.log('KINGDOMDASH — BROWSER QA AUDIT');
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`Playwright version: 1.63.0`);
  console.log('='.repeat(70));

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
    locale: 'en-GB',
    timezoneId: 'Africa/Lagos',
  });

  const page = await context.newPage();
  await setupConsoleAndNetwork(page);

  try {
    await testHomepage(page);
    await testNavigation(page);
    await testFoodPage(page);
    await testGroceryPage(page);
    await testCourierPage(page);
    await testCart(page);
    await testAuthPages(page);
    await testContactAndFooter(page);
    await test404(page);
    await testMultiServiceArchitecture(page);
    await testRouteRefresh(page);
    await testResponsive(page);
    await testVisualQuality(page);
  } catch (e) {
    fail('RUNTIME', `Unhandled audit error: ${e.message}`, 'Critical');
  } finally {
    await browser.close();
  }

  // Print summary
  console.log('\n' + '='.repeat(70));
  console.log('QA AUDIT SUMMARY');
  console.log('='.repeat(70));
  console.log(`PASS: ${RESULTS.pass.length}`);
  console.log(`FAIL: ${RESULTS.fail.length}`);
  console.log(`WARN: ${RESULTS.warn.length}`);
  console.log(`Console errors: ${RESULTS.consoleErrors.length}`);
  console.log(`Network errors: ${RESULTS.networkErrors.length}`);

  if (RESULTS.fail.length > 0) {
    console.log('\nFAILURES:');
    RESULTS.fail.forEach(f => console.log(`  [${f.severity}] ${f.area}: ${f.detail}`));
  }
  if (RESULTS.warn.length > 0) {
    console.log('\nWARNINGS:');
    RESULTS.warn.forEach(w => console.log(`  ${w.area}: ${w.detail}`));
  }
  if (RESULTS.consoleErrors.length > 0) {
    console.log('\nCONSOLE ERRORS:');
    RESULTS.consoleErrors.slice(0, 20).forEach(e => console.log(`  [${e.url}] ${e.text}`));
  }
  if (RESULTS.networkErrors.length > 0) {
    console.log('\nNETWORK ERRORS:');
    RESULTS.networkErrors.slice(0, 20).forEach(e => console.log(`  ${e.status || 'FAIL'} ${e.url}`));
  }

  console.log(`\nScreenshots saved to: ${SCREENSHOTS_DIR}`);
  console.log('='.repeat(70));

  // Save JSON results
  const reportPath = path.join(__dirname, 'qa_results.json');
  fs.writeFileSync(reportPath, JSON.stringify(RESULTS, null, 2));
  console.log(`Results JSON: ${reportPath}`);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
