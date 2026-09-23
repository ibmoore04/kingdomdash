const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5173';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots_mobile_dashboards');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function createJwt(profile) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
  const payload = Buffer.from(JSON.stringify({
    sub: profile.id,
    email: profile.email,
    role: 'authenticated',
    aud: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + 7200,
  })).toString('base64');
  const sig = Buffer.from('sig').toString('base64');
  return `${header}.${payload}.${sig}`;
}

async function setMockAuth(page, profile) {
  const fakeJwt = createJwt(profile);

  await page.route('**/auth/v1/user*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: profile.id,
        email: profile.email,
        aud: 'authenticated',
        role: 'authenticated',
        app_metadata: { provider: 'email' },
        user_metadata: { full_name: profile.full_name },
      }),
    });
  });

  await page.route('**/rest/v1/profiles*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(profile),
    });
  });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ prof, jwt }) => {
    const sessionData = {
      access_token: jwt,
      token_type: 'bearer',
      expires_in: 7200,
      expires_at: Math.floor(Date.now() / 1000) + 7200,
      refresh_token: 'refresh-' + prof.id,
      user: {
        id: prof.id,
        email: prof.email,
        aud: 'authenticated',
        role: 'authenticated',
        user_metadata: { full_name: prof.full_name },
      },
    };
    localStorage.setItem('sb-kbrfaccrhmvgcdtdfjna-auth-token', JSON.stringify(sessionData));
  }, { prof: profile, jwt: fakeJwt });
}

async function checkIssues(page, name, vp) {
  return await page.evaluate(({ name, vp }) => {
    const issues = [];
    const sw = document.documentElement.scrollWidth;
    const cw = document.documentElement.clientWidth;
    if (sw > cw + 1) {
      issues.push({
        type: 'horizontal_overflow',
        details: `ScrollWidth (${sw}px) > ClientWidth (${cw}px) by ${sw - cw}px`
      });
      // find which element causes overflow
      const allEls = document.querySelectorAll('*');
      for (const el of allEls) {
        const r = el.getBoundingClientRect();
        if (r.right > cw + 2 && r.width > 0) {
          issues.push({
            type: 'overflowing_element',
            tag: el.tagName,
            classes: (el.className || '').toString().substring(0, 80),
            right: Math.round(r.right),
            width: Math.round(r.width),
            text: (el.textContent || '').trim().substring(0, 40)
          });
          if (issues.filter(i => i.type === 'overflowing_element').length >= 4) break;
        }
      }
    }

    // Check touch targets under 36px on buttons and links
    const clickables = document.querySelectorAll('button, a, [role="button"], input[type="submit"]');
    let smallTargetCount = 0;
    for (const c of clickables) {
      const r = c.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && (r.height < 32 || r.width < 32)) {
        smallTargetCount++;
      }
    }
    if (smallTargetCount > 0) {
      issues.push({
        type: 'small_touch_targets',
        count: smallTargetCount
      });
    }

    return issues;
  }, { name, vp });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const viewports = [
    { name: 'iPhone_14', width: 390, height: 844 },
    { name: 'Android_360', width: 360, height: 780 }
  ];

  const results = {};

  const mockCustomer = {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'amara.okafor@kingdomdash.com',
    full_name: 'Amara Okafor',
    phone: '+2348012345678',
    avatar_url: null,
    role: 'customer',
    is_active: true,
  };

  const mockRider = {
    id: '33333333-3333-3333-3333-333333333333',
    email: 'rider@kingdomdash.com',
    full_name: 'Tunde SpeedRider',
    phone: '+2348033334444',
    avatar_url: null,
    role: 'rider',
    is_active: true,
  };

  const mockVendor = {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'vendor@kingdomdash.com',
    full_name: 'Ibrahim Moore',
    phone: '+2348022223333',
    avatar_url: null,
    role: 'vendor',
    is_active: true,
  };

  const mockAdmin = {
    id: '44444444-4444-4444-4444-444444444444',
    email: 'admin@kingdomdash.com',
    full_name: 'Super Admin KD',
    phone: '+2348044445555',
    avatar_url: null,
    role: 'super_admin',
    is_active: true,
  };

  for (const vp of viewports) {
    console.log(`\n=== TESTING VIEWPORT: ${vp.name} (${vp.width}x${vp.height}) ===`);
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
      isMobile: true,
      hasTouch: true
    });
    const page = await context.newPage();

    // 1. Customer Dashboard
    await setMockAuth(page, mockCustomer);
    for (const tab of ['overview', 'orders', 'addresses', 'profile', 'settings', 'notifications']) {
      await page.goto(`${BASE_URL}/dashboard?tab=${tab}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(600);
      const shotName = `cust_${tab}_${vp.name}`;
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${shotName}.png`), fullPage: true });
      const issues = await checkIssues(page, `Customer ${tab}`, vp);
      results[shotName] = issues;
      console.log(`  Customer [${tab}] issues:`, issues.length ? issues : 'None');
    }

    // 2. Rider Dashboard
    await setMockAuth(page, mockRider);
    for (const rPath of ['/rider/dashboard', '/rider/assignments', '/rider/history', '/rider/profile', '/rider/settings']) {
      const slug = rPath.replace('/rider/', '');
      await page.goto(`${BASE_URL}${rPath}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(600);
      const shotName = `rider_${slug}_${vp.name}`;
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${shotName}.png`), fullPage: true });
      const issues = await checkIssues(page, `Rider ${slug}`, vp);
      results[shotName] = issues;
      console.log(`  Rider [${slug}] issues:`, issues.length ? issues : 'None');
    }

    // 3. Vendor Dashboard
    await setMockAuth(page, mockVendor);
    for (const tab of ['overview', 'orders', 'menu', 'products', 'settings', 'profile']) {
      await page.goto(`${BASE_URL}/vendor?tab=${tab}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(600);
      const shotName = `vendor_${tab}_${vp.name}`;
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${shotName}.png`), fullPage: true });
      const issues = await checkIssues(page, `Vendor ${tab}`, vp);
      results[shotName] = issues;
      console.log(`  Vendor [${tab}] issues:`, issues.length ? issues : 'None');
    }

    // 4. Admin Dashboard
    await setMockAuth(page, mockAdmin);
    for (const rPath of ['/admin/dashboard', '/admin/orders', '/admin/vendors', '/admin/riders', '/admin/dispatch', '/admin/pricing', '/admin/service-areas', '/admin/settings']) {
      const slug = rPath.replace('/admin/', '');
      await page.goto(`${BASE_URL}${rPath}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(600);
      const shotName = `admin_${slug}_${vp.name}`;
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${shotName}.png`), fullPage: true });
      const issues = await checkIssues(page, `Admin ${slug}`, vp);
      results[shotName] = issues;
      console.log(`  Admin [${slug}] issues:`, issues.length ? issues : 'None');
    }

    await context.close();
  }

  await browser.close();
  console.log('\n=== AUDIT SUMMARY ===');
  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);
