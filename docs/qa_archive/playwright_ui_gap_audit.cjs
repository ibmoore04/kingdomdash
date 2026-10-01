const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5173';
const OUTPUT_DIR = path.join(__dirname, 'ui_gap_audit_results');
const SCREENSHOTS_DIR = path.join(OUTPUT_DIR, 'screenshots');
const SUPABASE_STORAGE_KEY = 'sb-kbrfaccrhmvgcdtdfjna-auth-token';

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

// User Profiles
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
  full_name: 'Amara Obi',
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
  full_name: 'Tunde Dispatch',
  phone: '+2348044444444',
  role: 'rider',
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockRiderOperationalProfile = {
  id: 'rrrrrrrr-rrrr-rrrr-rrrr-rrrrrrrrrrrr',
  profile_id: 'rrrrrrrr-rrrr-rrrr-rrrr-rrrrrrrrrrrr',
  full_name: 'Tunde Dispatch',
  phone: '+2348044444444',
  vehicle_type: 'Motorcycle',
  vehicle_plate: 'AGL-892-XA',
  is_active: true,
  is_verified: true,
  is_available: true,
  rating: 4.9,
  total_deliveries: 142,
  completed_deliveries: 139,
  cancelled_deliveries: 3,
  current_location: { lat: 6.8166, lng: 3.9166 },
};

const mockAdminAnalytics = {
  total_orders: 1248,
  active_orders: 14,
  delivered_orders: 1210,
  cancelled_orders: 24,
  total_gmv: 6420500,
  net_revenue: 642050,
  active_riders: 8,
  active_vendors: 22,
};

// Setup complete API and Session mocks
async function setupMocks(page, profile = null) {
  if (profile) {
    await page.addInitScript(({ storageKey, prof }) => {
      const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
      const payload = btoa(JSON.stringify({
        sub: prof.id,
        email: prof.email,
        role: 'authenticated',
        aud: 'authenticated',
        exp: Math.floor(Date.now() / 1000) + 7200
      }));
      const fakeJwt = `${header}.${payload}.${btoa('sig')}`;
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
  }

  // Intercept all Supabase Auth requests
  await page.route('**/auth/v1/**', async route => {
    const activeProf = profile || mockCustomer;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: activeProf.id,
        aud: 'authenticated',
        role: 'authenticated',
        email: activeProf.email,
        email_confirmed_at: new Date().toISOString(),
        user_metadata: { full_name: activeProf.full_name },
        app_metadata: { provider: 'email' },
      }),
    });
  });

  // Intercept all Supabase REST tables
  await page.route('**/rest/v1/**', async route => {
    const url = route.request().url();

    // Specific endpoints
    if (url.includes('/rest/v1/profiles')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(profile || mockCustomer),
      });
    }

    if (url.includes('/rest/v1/vendors')) {
      const vendorList = [
        {
          id: 'vvvvvvvv-vvvv-vvvv-vvvv-vvvvvvvvvvvv',
          profile_id: 'vvvvvvvv-vvvv-vvvv-vvvv-vvvvvvvvvvvv',
          business_name: 'Mama Put Kitchen',
          business_type: 'restaurant',
          phone: '+2348033333333',
          address: '12 Hospital Road, Ijebu-Ode',
          description: 'Authentic Nigerian dishes and delicacies',
          is_active: true,
          is_verified: true,
          rating: 4.8,
          delivery_time_min: 25,
          delivery_time_max: 40,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      ];
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(vendorList),
      });
    }

    if (url.includes('/rest/v1/rpc/get_rider_operational_profile')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockRiderOperationalProfile),
      });
    }

    if (url.includes('/rest/v1/rpc/get_admin_analytics')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockAdminAnalytics),
      });
    }

    if (url.includes('/rest/v1/rpc/get_rider_active_delivery')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(null),
      });
    }

    if (url.includes('/rest/v1/rpc/get_rider_assignment_inbox')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    }

    if (url.includes('/rest/v1/rpc/get_vendor_earnings_summary')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          vendor_id: 'vvvvvvvv-vvvv-vvvv-vvvv-vvvvvvvvvvvv',
          gross_revenue: 450000,
          net_settled: 380000,
          pending_balance: 70000,
          total_orders: 86,
          settled_orders: 72,
          pending_orders: 14,
        }),
      });
    }

    if (url.includes('/rest/v1/rpc/get_partner_bank_account')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          vendor_id: 'vvvvvvvv-vvvv-vvvv-vvvv-vvvvvvvvvvvv',
          bank_name: 'Access Bank',
          bank_code: '044',
          account_number: '0123456789',
          account_name: 'MAMA PUT VENTURES',
          is_verified: true,
          created_at: new Date().toISOString(),
        }),
      });
    }

    if (url.includes('/rest/v1/rpc/get_vendor_settlement_statements')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    }

    // Default 200 array for any table queries
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });
}

// Deep UI Gaps Evaluator running inside browser DOM
async function deepInspectPage(page, pageName, viewportName) {
  return await page.evaluate(({ pageName, viewportName }) => {
    const gaps = [];

    // 1. Horizontal Overflow Inspection
    const docEl = document.documentElement;
    const body = document.body;
    const scrollWidth = Math.max(docEl.scrollWidth, body ? body.scrollWidth : 0);
    const clientWidth = docEl.clientWidth;

    let overflowData = null;
    if (scrollWidth > clientWidth + 2) {
      const offendingElements = [];
      const allElements = document.querySelectorAll('*');
      for (const el of allElements) {
        const r = el.getBoundingClientRect();
        if (r.right > clientWidth + 2 && r.width > 0 && r.height > 0) {
          const tag = el.tagName.toLowerCase();
          const cls = (el.className && typeof el.className === 'string') ? el.className.split(' ').slice(0, 3).join('.') : '';
          const id = el.id ? `#${el.id}` : '';
          offendingElements.push({
            selector: `${tag}${id}${cls ? '.' + cls : ''}`,
            right: Math.round(r.right),
            width: Math.round(r.width),
            text: (el.textContent || '').trim().slice(0, 40),
          });
          if (offendingElements.length >= 5) break;
        }
      }
      overflowData = {
        amount: scrollWidth - clientWidth,
        offendingElements,
      };
      gaps.push({
        type: 'HORIZONTAL_OVERFLOW',
        severity: 'HIGH',
        message: `Page overflows horizontally by ${overflowData.amount}px on viewport ${viewportName}`,
        details: offendingElements,
      });
    }

    // 2. Broken Image Inspection
    const imgs = Array.from(document.querySelectorAll('img'));
    for (const img of imgs) {
      const src = img.getAttribute('src');
      if (!src || src.trim() === '') {
        gaps.push({
          type: 'BROKEN_IMAGE',
          severity: 'MEDIUM',
          message: 'Image tag has empty src attribute',
          details: { alt: img.alt, className: img.className },
        });
      } else if (img.complete && img.naturalWidth === 0 && !src.startsWith('data:image/svg')) {
        gaps.push({
          type: 'BROKEN_IMAGE',
          severity: 'HIGH',
          message: `Image failed to load: ${src}`,
          details: { src, alt: img.alt },
        });
      }
    }

    // 3. Glitch / Placeholder / Junk Text Inspection
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    const junkPatterns = [
      /\[object\s+Object\]/i,
      /\bundefined\b/,
      /\bNaN\b/,
      /\bnull\b/,
      /lorem\s+ipsum/i,
    ];
    while ((node = walker.nextNode())) {
      const text = node.textContent.trim();
      if (!text) continue;
      const parent = node.parentElement;
      if (!parent || ['SCRIPT', 'STYLE', 'CODE', 'PRE'].includes(parent.tagName)) continue;
      // Filter out code or intentional words
      if (text === 'undefined' || text === 'null' || text === 'NaN' || text.includes('[object Object]') || /lorem\s+ipsum/i.test(text)) {
        gaps.push({
          type: 'JUNK_OR_PLACEHOLDER_TEXT',
          severity: 'MEDIUM',
          message: `Found placeholder/glitch text: "${text}"`,
          details: { text, parentTag: parent.tagName, className: parent.className },
        });
      }
    }

    // 4. Truly Visible Interactive Elements with Zero Dimensions
    const buttons = Array.from(document.querySelectorAll('button, a[role="button"]'));
    for (const btn of buttons) {
      // Must actually be visible in layout tree
      if (btn.offsetParent !== null && typeof btn.checkVisibility === 'function' && btn.checkVisibility()) {
        const rect = btn.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
          gaps.push({
            type: 'ZERO_DIMENSION_BUTTON',
            severity: 'HIGH',
            message: `Clickable element is rendered visible but has 0 dimensions (${rect.width}x${rect.height})`,
            details: { text: btn.textContent.trim(), ariaLabel: btn.getAttribute('aria-label') },
          });
        }
      }
    }

    // 5. Touch Target Size Check on Mobile
    if (viewportName === 'mobile' || viewportName === 'mobileNarrow') {
      const interactiveEls = Array.from(document.querySelectorAll('button:not([hidden]), a:not([hidden])'));
      let tinyTouchCount = 0;
      for (const el of interactiveEls) {
        if (el.offsetParent !== null && typeof el.checkVisibility === 'function' && el.checkVisibility()) {
          const rect = el.getBoundingClientRect();
          // Radix/shadcn or custom icons
          if (rect.width > 0 && rect.height > 0 && (rect.width < 28 || rect.height < 28)) {
            tinyTouchCount++;
          }
        }
      }
      if (tinyTouchCount > 5) {
        gaps.push({
          type: 'TOUCH_TARGET_SIZE',
          severity: 'LOW',
          message: `${tinyTouchCount} interactive elements have touch targets smaller than 28px on mobile`,
        });
      }
    }

    // 6. Semantic Heading Hierarchy
    const h1s = Array.from(document.querySelectorAll('h1'));
    const h1Count = h1s.length;
    const h1Texts = h1s.map(h => (h.textContent || '').trim().slice(0, 60));

    if (h1Count === 0) {
      gaps.push({
        type: 'MISSING_H1_HEADING',
        severity: 'LOW',
        message: 'Page does not contain a primary <h1> heading',
      });
    } else if (h1Count > 2) {
      gaps.push({
        type: 'MULTIPLE_H1_HEADINGS',
        severity: 'LOW',
        message: `Page contains ${h1Count} <h1> headings`,
        details: h1Texts,
      });
    }

    // 7. Page Title
    const title = document.title;
    if (!title || title.trim() === '' || title === 'Vite + React') {
      gaps.push({
        type: 'MISSING_PAGE_TITLE',
        severity: 'LOW',
        message: `Generic or missing title: "${title}"`,
      });
    }

    return {
      pageName,
      viewport: viewportName,
      url: window.location.pathname + window.location.search,
      title,
      h1Count,
      h1Texts,
      overflowData,
      gaps,
    };
  }, { pageName, viewportName });
}

async function runComprehensiveUiGapAudit() {
  console.log('🚀 Starting Clean Comprehensive Playwright UI Gap Audit...');
  const browser = await chromium.launch({ headless: true });

  const viewports = {
    desktop: { width: 1440, height: 900 },
    tablet: { width: 768, height: 1024 },
    mobile: { width: 390, height: 844 },
    mobileNarrow: { width: 375, height: 667 },
  };

  const allPageResults = [];
  const allIdentifiedGaps = [];

  async function testView(category, name, url, role = null, vpKey = 'desktop', captureScreenshot = true) {
    const vp = viewports[vpKey];
    const context = await browser.newContext({ viewport: vp });
    const page = await context.newPage();

    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('favicon.ico') && !text.includes('chrome-extension')) {
          consoleErrors.push(text);
        }
      }
    });
    page.on('pageerror', err => {
      consoleErrors.push(err.message);
    });

    const profile = role === 'admin' ? mockAdmin
                  : role === 'vendor' ? mockVendor
                  : role === 'rider' ? mockRider
                  : role === 'customer' ? mockCustomer
                  : null;

    await setupMocks(page, profile);

    try {
      await page.goto(`${BASE_URL}${url}`, { waitUntil: 'domcontentloaded', timeout: 20000 });

      // Wait until Preloader (role="status" with "Loading" or "Verifying") is removed or timeout
      await page.waitForFunction(() => {
        const preloader = document.querySelector('div[role="status"]');
        if (!preloader) return true;
        const text = preloader.textContent || '';
        return !text.includes('Loading page') && !text.includes('Verifying authorization');
      }, { timeout: 8000 }).catch(() => {});

      await page.waitForTimeout(600); // Allow render settle

      const inspection = await deepInspectPage(page, name, vpKey);
      inspection.category = category;
      inspection.role = role || 'anonymous';
      inspection.consoleErrors = consoleErrors;

      if (consoleErrors.length > 0) {
        inspection.gaps.push({
          type: 'CONSOLE_RUNTIME_ERROR',
          severity: 'HIGH',
          message: `${consoleErrors.length} runtime console error(s) logged`,
          details: consoleErrors.slice(0, 3),
        });
      }

      if (captureScreenshot) {
        const safeName = `${category}_${name}_${vpKey}`.replace(/[^a-zA-Z0-9_-]/g, '_');
        const filename = `${safeName}.png`;
        const ssPath = path.join(SCREENSHOTS_DIR, filename);
        await page.screenshot({ path: ssPath, fullPage: false }).catch(() => {});
        inspection.screenshot = filename;
      }

      allPageResults.push(inspection);
      if (inspection.gaps.length > 0) {
        allIdentifiedGaps.push({
          page: name,
          url,
          viewport: vpKey,
          category,
          gaps: inspection.gaps,
        });
      }

      const hasCriticalOrHigh = inspection.gaps.some(g => g.severity === 'HIGH' || g.severity === 'CRITICAL');
      const icon = hasCriticalOrHigh ? '🚨' : inspection.gaps.length > 0 ? '⚠️' : '✅';
      console.log(` ${icon} [${category.toUpperCase()}] ${name} (${vpKey}) -> Gaps: ${inspection.gaps.length}`);
      inspection.gaps.forEach(g => {
        console.log(`    [${g.severity}] ${g.type}: ${g.message}`);
      });
    } catch (err) {
      console.log(` 💥 [${category.toUpperCase()}] ${name} (${vpKey}) ERROR: ${err.message}`);
      allIdentifiedGaps.push({
        page: name,
        url,
        viewport: vpKey,
        category,
        gaps: [{ type: 'PAGE_CRASH_OR_TIMEOUT', severity: 'CRITICAL', message: err.message }],
      });
    } finally {
      await context.close();
    }
  }

  // 1. PUBLIC ROUTES
  console.log('\n--- 1. AUDITING PUBLIC ROUTES ---');
  const publicRoutes = [
    { name: 'Home', url: '/' },
    { name: 'About', url: '/about' },
    { name: 'Services', url: '/services' },
    { name: 'Food Catalog', url: '/food' },
    { name: 'Groceries Catalog', url: '/groceries' },
    { name: 'Courier Dispatch', url: '/courier' },
    { name: 'Contact Us', url: '/contact' },
    { name: 'Help & Support', url: '/support' },
    { name: 'FAQ', url: '/faq' },
    { name: 'Become Vendor', url: '/become-vendor' },
    { name: 'Become Rider', url: '/become-rider' },
    { name: 'Business / Corporate', url: '/business' },
    { name: 'Personal Shopper', url: '/personal-shopper' },
    { name: 'Privacy Policy', url: '/privacy' },
    { name: 'Terms of Service', url: '/terms' },
    { name: 'Refund Policy', url: '/refund-policy' },
    { name: 'Cart View', url: '/cart' },
    { name: '404 Catch-All', url: '/unknown-route-test' },
  ];

  for (const r of publicRoutes) {
    await testView('public', r.name, r.url, null, 'desktop', true);
    await testView('public', r.name, r.url, null, 'mobile', true);
    await testView('public', r.name, r.url, null, 'mobileNarrow', false);
  }

  // 2. AUTH ROUTES
  console.log('\n--- 2. AUDITING AUTHENTICATION ROUTES ---');
  const authRoutes = [
    { name: 'Login', url: '/auth/login' },
    { name: 'Register', url: '/auth/register' },
    { name: 'Forgot Password', url: '/auth/forgot-password' },
    { name: 'Update Password', url: '/auth/update-password' },
    { name: 'Verify Email', url: '/auth/verify-email' },
    { name: 'MFA Security', url: '/auth/mfa' },
  ];

  for (const r of authRoutes) {
    await testView('auth', r.name, r.url, null, 'desktop', true);
    await testView('auth', r.name, r.url, null, 'mobile', true);
  }

  // 3. CUSTOMER PORTAL
  console.log('\n--- 3. AUDITING CUSTOMER PORTAL ---');
  const customerRoutes = [
    { name: 'Dashboard Orders', url: '/dashboard?tab=orders' },
    { name: 'Dashboard Addresses', url: '/dashboard?tab=addresses' },
    { name: 'Dashboard Profile', url: '/dashboard?tab=profile' },
    { name: 'Dashboard Rewards', url: '/dashboard?tab=rewards' },
    { name: 'Dashboard Notifications', url: '/dashboard?tab=notifications' },
    { name: 'Dashboard Support', url: '/dashboard?tab=support' },
    { name: 'Dashboard Settings', url: '/dashboard?tab=settings' },
    { name: 'Dashboard Corporate', url: '/dashboard?tab=corporate' },
    { name: 'Checkout Page', url: '/checkout' },
    { name: 'Rider Pending View', url: '/onboarding/rider-pending' },
    { name: 'Vendor Pending View', url: '/onboarding/vendor-pending' },
  ];

  for (const r of customerRoutes) {
    await testView('customer', r.name, r.url, 'customer', 'desktop', true);
    await testView('customer', r.name, r.url, 'customer', 'mobile', true);
  }

  // 4. VENDOR PORTAL
  console.log('\n--- 4. AUDITING VENDOR PORTAL ---');
  const vendorRoutes = [
    { name: 'Vendor Dashboard', url: '/vendor' },
    { name: 'Vendor Orders', url: '/vendor?tab=orders' },
    { name: 'Vendor Catalog', url: '/vendor?tab=catalog' },
    { name: 'Vendor Earnings', url: '/vendor?tab=earnings' },
    { name: 'Vendor Analytics', url: '/vendor?tab=analytics' },
    { name: 'Vendor Settings', url: '/vendor?tab=settings' },
  ];

  for (const r of vendorRoutes) {
    await testView('vendor', r.name, r.url, 'vendor', 'desktop', true);
    await testView('vendor', r.name, r.url, 'vendor', 'mobile', true);
  }

  // 5. RIDER PLATFORM
  console.log('\n--- 5. AUDITING RIDER PLATFORM ---');
  const riderRoutes = [
    { name: 'Rider Dashboard', url: '/rider/dashboard' },
    { name: 'Rider Assignments', url: '/rider/assignments' },
    { name: 'Rider Active Delivery', url: '/rider/deliveries/active' },
    { name: 'Rider History', url: '/rider/history' },
    { name: 'Rider Profile', url: '/rider/profile' },
    { name: 'Rider Settings', url: '/rider/settings' },
    { name: 'Rider Notifications', url: '/rider/notifications' },
    { name: 'Rider Support', url: '/rider/support' },
  ];

  for (const r of riderRoutes) {
    await testView('rider', r.name, r.url, 'rider', 'desktop', true);
    await testView('rider', r.name, r.url, 'rider', 'mobile', true);
  }

  // 6. ADMIN CONTROL CENTER
  console.log('\n--- 6. AUDITING ADMIN CONTROL CENTER ---');
  const adminRoutes = [
    { name: 'Admin Dashboard', url: '/admin/dashboard' },
    { name: 'Admin Orders', url: '/admin/orders' },
    { name: 'Admin Deliveries', url: '/admin/deliveries' },
    { name: 'Admin Dispatch Control', url: '/admin/dispatch' },
    { name: 'Admin Exceptions', url: '/admin/exceptions' },
    { name: 'Admin Payments Ledger', url: '/admin/payments' },
    { name: 'Admin Riders Management', url: '/admin/riders' },
    { name: 'Admin Rider Applications', url: '/admin/rider-applications' },
    { name: 'Admin Vendors Directory', url: '/admin/vendors' },
    { name: 'Admin Vendor Applications', url: '/admin/vendor-applications' },
    { name: 'Admin Users & Impersonation', url: '/admin/users' },
    { name: 'Admin Catalog & Menus', url: '/admin/catalog' },
    { name: 'Admin Pricing Rules', url: '/admin/pricing' },
    { name: 'Admin Service Areas Geofence', url: '/admin/service-areas' },
    { name: 'Admin Support Tickets', url: '/admin/support' },
    { name: 'Admin Audit Logs', url: '/admin/audit-logs' },
    { name: 'Admin Notifications', url: '/admin/notifications' },
  ];

  for (const r of adminRoutes) {
    await testView('admin', r.name, r.url, 'admin', 'desktop', true);
    await testView('admin', r.name, r.url, 'admin', 'mobile', true);
  }

  // Export Results
  const finalReport = {
    timestamp: new Date().toISOString(),
    totalViewsAudited: allPageResults.length,
    totalGapsIdentified: allIdentifiedGaps.reduce((acc, item) => acc + item.gaps.length, 0),
    gapsByCategory: {
      CRITICAL: allIdentifiedGaps.flatMap(i => i.gaps).filter(g => g.severity === 'CRITICAL'),
      HIGH: allIdentifiedGaps.flatMap(i => i.gaps).filter(g => g.severity === 'HIGH'),
      MEDIUM: allIdentifiedGaps.flatMap(i => i.gaps).filter(g => g.severity === 'MEDIUM'),
      LOW: allIdentifiedGaps.flatMap(i => i.gaps).filter(g => g.severity === 'LOW'),
    },
    identifiedGaps: allIdentifiedGaps,
  };

  fs.writeFileSync(path.join(OUTPUT_DIR, 'clean_ui_gap_report.json'), JSON.stringify(finalReport, null, 2));

  console.log('\n================ FINAL AUDIT SUMMARY ================');
  console.log(`Total Views Tested: ${finalReport.totalViewsAudited}`);
  console.log(`🚨 CRITICAL Gaps: ${finalReport.gapsByCategory.CRITICAL.length}`);
  console.log(`⚠️ HIGH Severity Gaps: ${finalReport.gapsByCategory.HIGH.length}`);
  console.log(`🟡 MEDIUM Severity Gaps: ${finalReport.gapsByCategory.MEDIUM.length}`);
  console.log(`ℹ️ LOW Severity Gaps: ${finalReport.gapsByCategory.LOW.length}`);

  await browser.close();
}

runComprehensiveUiGapAudit().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
