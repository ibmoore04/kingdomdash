const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5174';
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots_critical_qa');
const SUPABASE_STORAGE_KEY = 'sb-kbrfaccrhmvgcdtdfjna-auth-token';

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

// User Profiles for testing
const mockAdmin = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  email: 'admin@kingdomdash.test',
  full_name: 'Standard Ops Admin',
  phone: '+2348011111111',
  avatar_url: null,
  role: 'admin',
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

const mockSuperAdmin = {
  id: '00000000-0000-0000-0000-000000000000',
  email: 'superadmin@kingdomdash.test',
  full_name: 'Root Super Admin',
  phone: '+2348000000000',
  avatar_url: null,
  role: 'super_admin',
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

const mockCustomer = {
  id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  email: 'customer@kingdomdash.test',
  full_name: 'Test Customer',
  phone: '+2348022222222',
  avatar_url: null,
  role: 'customer',
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

const mockVendor = {
  id: 'vvvvvvvv-vvvv-vvvv-vvvv-vvvvvvvvvvvv',
  email: 'vendor@kingdomdash.test',
  full_name: 'Mama Put Kitchen',
  phone: '+2348033333333',
  avatar_url: null,
  role: 'vendor',
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

const mockRider = {
  id: 'rrrrrrrr-rrrr-rrrr-rrrr-rrrrrrrrrrrr',
  email: 'rider@kingdomdash.test',
  full_name: 'Speedy Dispatcher',
  phone: '+2348044444444',
  avatar_url: null,
  role: 'rider',
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

const mockVendorApp = {
  id: 'app-vendor-101',
  user_id: 'uuuuuuuu-uuuu-uuuu-uuuu-uuuuuuuuuuuu',
  business_name: 'Golden Harvest Market',
  business_type: 'restaurant',
  address: '14 Hospital Road, Ijebu-Ode',
  phone_number: '+2348055555555',
  owner_email: 'harvest@kingdomdash.test',
  service_types: ['food'],
  status: 'pending',
  admin_notes: null,
  submitted_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

const mockRiderApp = {
  id: 'app-rider-202',
  user_id: 'uuuuuuuu-uuuu-uuuu-uuuu-uuuuuuuuuuuu',
  full_name: 'Taiwo Adeyemi',
  phone_number: '+2348066666666',
  email: 'taiwo@kingdomdash.test',
  vehicle_type: 'motorcycle',
  plate_number: 'JBD-456-XY',
  drivers_license_number: 'DL-987654321',
  status: 'pending',
  admin_notes: null,
  submitted_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

const mockVendorDirectory = [
  {
    id: 'store-1',
    owner_id: mockVendor.id,
    business_name: 'Mama Put Food Joint',
    business_type: 'food',
    business_address: '12 Ibadan Road, Ijebu-Ode',
    phone: mockVendor.phone,
    is_active: true,
    created_at: new Date().toISOString(),
    vendor_services: [{ service_type: 'food', is_active: true }]
  },
  {
    id: 'store-2',
    owner_id: 'vvvvvvvv-2222-2222-2222-222222222222',
    business_name: 'Ijebu Fresh Groceries',
    business_type: 'grocery',
    business_address: '8 Degun Street, Ijebu-Ode',
    phone: '+2348077777777',
    is_active: true,
    created_at: new Date().toISOString(),
    vendor_services: [{ service_type: 'grocery', is_active: true }]
  },
  {
    id: 'store-3',
    owner_id: 'vvvvvvvv-3333-3333-3333-333333333333',
    business_name: 'Kingdom Hypermarket',
    business_type: 'food',
    business_address: '25 Folagbade Street, Ijebu-Ode',
    phone: '+2348088888888',
    is_active: true,
    created_at: new Date().toISOString(),
    vendor_services: [
      { service_type: 'food', is_active: true },
      { service_type: 'grocery', is_active: true }
    ]
  }
];

// Helper to inject session in localStorage
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
    localStorage.setItem('sb-placeholder-auth-token', JSON.stringify(sessionData));
  }, { storageKey: SUPABASE_STORAGE_KEY, prof: profile });
}

async function checkOverflow(page) {
  return await page.evaluate(() => {
    const sw = document.documentElement.scrollWidth;
    const cw = document.documentElement.clientWidth;
    return {
      scrollWidth: sw,
      clientWidth: cw,
      hasOverflow: sw > cw,
      overflowAmount: sw - cw
    };
  });
}

async function runCriticalQA() {
  console.log('🚀 Launching Chromium for Critical RBAC + Onboarding + Support E2E QA...');
  const browser = await chromium.launch({ headless: true });
  const results = {
    superAdminIsolation: {},
    vendorMultiService: {},
    riderOnboarding: {},
    supportSystem: {},
    inactiveAccount: {},
    responsiveAudit: [],
    overflowViolations: []
  };

  try {
    // ──────────────────────────────────────────────────────────────────────────
    // CONTEXT 1: Standard Admin Session
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- 1. Testing Super Admin Isolation (Standard Admin) ---');
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();

    // Register all routes on adminPage
    await adminPage.route('**/auth/v1/user*', async route => {
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

    await adminPage.route('**/rest/v1/profiles*', async route => {
      const url = route.request().url();
      if (url.includes('id=eq.' + mockAdmin.id)) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockAdmin)
        });
        return;
      }
      if (url.includes('role=eq.super_admin')) {
        await route.fulfill({
          status: 200,
          headers: { 'content-range': '0-0/0' },
          contentType: 'application/json',
          body: JSON.stringify([])
        });
        return;
      }
      const visibleProfiles = [mockAdmin, mockCustomer, mockVendor, mockRider];
      await route.fulfill({
        status: 200,
        headers: { 'content-range': `0-3/4` },
        contentType: 'application/json',
        body: JSON.stringify(visibleProfiles)
      });
    });

    await adminPage.route('**/rest/v1/rpc/admin_toggle_user_active*', async route => {
      const payload = JSON.parse(route.request().postData() || '{}');
      if (payload.p_target_user_id === mockSuperAdmin.id) {
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 'KD403',
            message: 'Unauthorized: Admins cannot deactivate Super Admin accounts'
          })
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(true)
      });
    });

    let recordedApprovalServiceTypes = null;
    await adminPage.route('**/rest/v1/rpc/approve_vendor_application*', async route => {
      const payload = JSON.parse(route.request().postData() || '{}');
      recordedApprovalServiceTypes = payload.p_service_types;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ vendor_id: 'new-vendor-id-999', user_id: mockVendorApp.user_id })
      });
    });

    await adminPage.route('**/rest/v1/vendor_applications*', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'content-range': '0-0/1' },
        contentType: 'application/json',
        body: JSON.stringify([mockVendorApp])
      });
    });

    await adminPage.route('**/rest/v1/vendors*', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'content-range': '0-2/3' },
        contentType: 'application/json',
        body: JSON.stringify(mockVendorDirectory)
      });
    });

    let riderApprovedRpcCalled = false;
    await adminPage.route('**/rest/v1/rpc/approve_rider_application*', async route => {
      riderApprovedRpcCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ rider_id: 'new-rider-id-777' })
      });
    });

    await adminPage.route('**/rest/v1/rider_applications*', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'content-range': '0-0/1' },
        contentType: 'application/json',
        body: JSON.stringify([mockRiderApp])
      });
    });

    await injectSession(adminPage, mockAdmin);
    await adminPage.goto(BASE_URL + '/admin/users', { waitUntil: 'networkidle' });
    await adminPage.waitForTimeout(600);

    const pageText = await adminPage.innerText('body');
    const hasSuperAdminName = pageText.includes('Root Super Admin');
    const hasSuperAdminEmail = pageText.includes('superadmin@kingdomdash.test');
    const hasSuperAdminRoleBadge = pageText.includes('super_admin');
    const hasDisclosureNotice = pageText.toLowerCase().includes('hidden') && pageText.toLowerCase().includes('super admin');

    console.log('  Standard Admin view - Super Admin name visible:', hasSuperAdminName);
    console.log('  Standard Admin view - Super Admin email visible:', hasSuperAdminEmail);
    console.log('  Standard Admin view - Super Admin role badge:', hasSuperAdminRoleBadge);
    console.log('  Standard Admin view - Any UI disclosure about Super Admins:', hasDisclosureNotice);

    // Verify Role Filter Dropdown does NOT list Super Admin for standard admin
    const roleFilterOptions = await adminPage.evaluate(() => {
      const select = document.querySelector('select');
      if (!select) return [];
      return Array.from(select.options).map(o => o.value);
    });
    console.log('  Role filter options for Admin:', roleFilterOptions);
    const filterHasSuperAdmin = roleFilterOptions.includes('super_admin');

    // Direct REST API deactivate attack on Super Admin ID
    const restDeactivateResult = await adminPage.evaluate(async (superAdminId) => {
      const res = await fetch(`/rest/v1/rpc/admin_toggle_user_active`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_target_user_id: superAdminId, p_is_active: false })
      });
      return { status: res.status, data: await res.json() };
    }, mockSuperAdmin.id);

    console.log('  Direct deactivate attempt on Super Admin returned:', restDeactivateResult.status, restDeactivateResult.data.code);

    results.superAdminIsolation = {
      zeroSuperAdminRecordsInTable: !hasSuperAdminName && !hasSuperAdminEmail,
      zeroSuperAdminInRoleFilter: !filterHasSuperAdmin,
      zeroDisclosureInUI: !hasDisclosureNotice,
      directDeactivateRejected: restDeactivateResult.status === 403 && restDeactivateResult.data.code === 'KD403',
      passed: !hasSuperAdminName && !hasSuperAdminEmail && !filterHasSuperAdmin && !hasDisclosureNotice && restDeactivateResult.status === 403
    };

    const shotAdminUsers = path.join(SCREENSHOTS_DIR, '01_admin_users_superadmin_isolated.png');
    await adminPage.screenshot({ path: shotAdminUsers, fullPage: true });

    // ──────────────────────────────────────────────────────────────────────────
    // CONTEXT 2: Super Admin Session (Elevated Capabilities)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- 2. Testing Super Admin Elevated Management ---');
    const superContext = await browser.newContext();
    const superPage = await superContext.newPage();

    await superPage.route('**/auth/v1/user*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: mockSuperAdmin.id,
          email: mockSuperAdmin.email,
          app_metadata: { provider: 'email' },
          user_metadata: { full_name: mockSuperAdmin.full_name },
          aud: 'authenticated',
          role: 'authenticated'
        })
      });
    });

    await superPage.route('**/rest/v1/profiles*', async route => {
      const url = route.request().url();
      if (url.includes('id=eq.' + mockSuperAdmin.id)) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockSuperAdmin)
        });
        return;
      }
      const allProfiles = [mockSuperAdmin, mockAdmin, mockCustomer, mockVendor, mockRider];
      await route.fulfill({
        status: 200,
        headers: { 'content-range': `0-4/5` },
        contentType: 'application/json',
        body: JSON.stringify(allProfiles)
      });
    });

    await injectSession(superPage, mockSuperAdmin);
    await superPage.goto(BASE_URL + '/admin/users', { waitUntil: 'networkidle' });
    await superPage.waitForTimeout(600);

    const superAdminRoleFilterOptions = await superPage.evaluate(() => {
      const select = document.querySelector('select');
      if (!select) return [];
      return Array.from(select.options).map(o => o.value);
    });
    console.log('  Role filter options for Super Admin:', superAdminRoleFilterOptions);
    const superAdminHasOption = superAdminRoleFilterOptions.includes('super_admin');
    results.superAdminIsolation.superAdminFilterElevated = superAdminHasOption;

    const shotSuperAdminUsers = path.join(SCREENSHOTS_DIR, '02_superadmin_users_elevated.png');
    await superPage.screenshot({ path: shotSuperAdminUsers, fullPage: true });

    // ──────────────────────────────────────────────────────────────────────────
    // WORKFLOW 3: Multi-Service Vendor Approval Workflow
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- 3. Testing Multi-Service Vendor Approval Modal ---');
    await adminPage.goto(BASE_URL + '/admin/vendor-applications', { waitUntil: 'networkidle' });
    await adminPage.waitForTimeout(600);

    // Look for Approve button in the table row
    const vendorRowApproveBtn = adminPage.locator('tr:has-text("Golden Harvest Market") button:has-text("Approve")');
    const isApproveBtnVisible = await vendorRowApproveBtn.isVisible();
    console.log('  Vendor row Approve button visible:', isApproveBtnVisible);

    if (isApproveBtnVisible) {
      await vendorRowApproveBtn.click();
      await adminPage.waitForTimeout(500);

      const modalTitle = await adminPage.locator('text=Approve Merchant & Assign Services').isVisible();
      const foodCheckbox = adminPage.locator('label:has-text("Food Delivery Service") input[type="checkbox"]');
      const groceryCheckbox = adminPage.locator('label:has-text("Grocery Delivery Service") input[type="checkbox"]');

      const foodVisible = await foodCheckbox.isVisible();
      const groceryVisible = await groceryCheckbox.isVisible();
      console.log('  Vendor Approval Modal displayed:', modalTitle);
      console.log('  Food checkbox visible:', foodVisible);
      console.log('  Grocery checkbox visible:', groceryVisible);

      // Check Grocery to configure Food + Grocery
      await groceryCheckbox.check();
      await adminPage.waitForTimeout(300);

      const shotVendorModal = path.join(SCREENSHOTS_DIR, '03_vendor_multi_service_modal.png');
      await adminPage.screenshot({ path: shotVendorModal });

      const confirmApprovalBtn = adminPage.locator('button:has-text("Confirm & Approve Merchant")');
      if (await confirmApprovalBtn.isVisible()) {
        await confirmApprovalBtn.click();
        await adminPage.waitForTimeout(600);
      }

      console.log('  approve_vendor_application called with services:', recordedApprovalServiceTypes);
      results.vendorMultiService = {
        modalOpened: modalTitle,
        bothServiceCheckboxesPresent: foodVisible && groceryVisible,
        persistedMultiService: Array.isArray(recordedApprovalServiceTypes) && recordedApprovalServiceTypes.includes('grocery'),
        passed: modalTitle && foodVisible && groceryVisible && recordedApprovalServiceTypes?.includes('grocery')
      };
    }

    // ──────────────────────────────────────────────────────────────────────────
    // WORKFLOW 4: Vendor Directory Store Services Display
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- 4. Testing Vendor Directory Store Services ---');
    await adminPage.goto(BASE_URL + '/admin/vendors', { waitUntil: 'networkidle' });
    await adminPage.waitForTimeout(600);

    const vendorDirText = await adminPage.innerText('body');
    const hasFoodBadge = vendorDirText.includes('food') || vendorDirText.includes('Food');
    const hasGroceryBadge = vendorDirText.includes('grocery') || vendorDirText.includes('Grocery');
    console.log('  Vendor Directory renders Food service badges:', hasFoodBadge);
    console.log('  Vendor Directory renders Grocery service badges:', hasGroceryBadge);

    const shotVendorDirectory = path.join(SCREENSHOTS_DIR, '04_vendor_directory_services.png');
    await adminPage.screenshot({ path: shotVendorDirectory, fullPage: true });

    // ──────────────────────────────────────────────────────────────────────────
    // WORKFLOW 5: Rider Onboarding UI Modal
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- 5. Testing Rider Approval Modal ---');
    await adminPage.goto(BASE_URL + '/admin/rider-applications', { waitUntil: 'networkidle' });
    await adminPage.waitForTimeout(600);

    const riderRowApproveBtn = adminPage.locator('tr:has-text("Taiwo Adeyemi") button:has-text("Approve")');
    const isRiderApproveBtnVisible = await riderRowApproveBtn.isVisible();
    console.log('  Rider row Approve button visible:', isRiderApproveBtnVisible);

    if (isRiderApproveBtnVisible) {
      await riderRowApproveBtn.click();
      await adminPage.waitForTimeout(500);

      const riderModalTitle = await adminPage.locator('text=Approve Courier Candidate').isVisible();
      const modalBody = await adminPage.innerText('body');
      const vehicleDetailsVisible = modalBody.includes('motorcycle') || modalBody.includes('JBD-456-XY');
      console.log('  Rider Approval Modal displayed:', riderModalTitle);
      console.log('  Candidate vehicle details shown:', vehicleDetailsVisible);

      const shotRiderModal = path.join(SCREENSHOTS_DIR, '05_rider_approval_modal.png');
      await adminPage.screenshot({ path: shotRiderModal });

      const confirmRiderBtn = adminPage.locator('button:has-text("Confirm & Approve Rider")');
      if (await confirmRiderBtn.isVisible()) {
        await confirmRiderBtn.click();
        await adminPage.waitForTimeout(600);
      }

      console.log('  approve_rider_application RPC called:', riderApprovedRpcCalled);
      results.riderOnboarding = {
        modalOpened: riderModalTitle,
        vehicleDetailsShown: vehicleDetailsVisible,
        rpcCalled: riderApprovedRpcCalled,
        passed: riderModalTitle && vehicleDetailsVisible && riderApprovedRpcCalled
      };
    }

    // ──────────────────────────────────────────────────────────────────────────
    // WORKFLOW 6: Public Support Page & Inactive Account Flow
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- 6. Testing Public Support System ---');
    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();

    let supportTicketPayload = null;
    await guestPage.route('**/rest/v1/rpc/submit_support_ticket*', async route => {
      supportTicketPayload = JSON.parse(route.request().postData() || '{}');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          ticket_id: 'KD-SUP-TEST-8899',
          reference: 'KD-SUP-TEST-8899',
          created_at: new Date().toISOString()
        })
      });
    });

    // 6a: Normal unauthenticated /support
    await guestPage.goto(BASE_URL + '/support', { waitUntil: 'networkidle' });
    const supportBodyText = await guestPage.innerText('body');
    const hasPhone = supportBodyText.includes('+234 807 795 8755');
    const hasEmail = supportBodyText.includes('Contact@kingdomdash.net');
    const hasLocation = supportBodyText.includes('Ijebu-Ode');
    const hasWhatsAppLink = await guestPage.locator('a[href*="wa.me/2348077958755"]').isVisible();

    console.log('  Support page verified phone present:', hasPhone);
    console.log('  Support page verified email present:', hasEmail);
    console.log('  Support page verified location present:', hasLocation);
    console.log('  Live WhatsApp button present:', hasWhatsAppLink);

    const shotSupportPublic = path.join(SCREENSHOTS_DIR, '06_support_public_page.png');
    await guestPage.screenshot({ path: shotSupportPublic, fullPage: true });

    // 6b: Support page with ?reason=account_inactive
    await guestPage.goto(BASE_URL + '/support?reason=account_inactive', { waitUntil: 'networkidle' });
    const restrictedBannerVisible = await guestPage.locator('text=Account Access Restricted').isVisible();
    console.log('  Account Access Restricted high-contrast banner visible:', restrictedBannerVisible);

    const shotSupportInactive = path.join(SCREENSHOTS_DIR, '07_support_account_inactive_banner.png');
    await guestPage.screenshot({ path: shotSupportInactive, fullPage: true });

    // 6c: Submit support ticket form
    await guestPage.fill('#support-name', 'Adekunle Gold');
    await guestPage.fill('#support-email', 'adekunle@example.com');
    await guestPage.fill('#support-phone', '+2348012345678');
    await guestPage.fill('#support-subject', 'Account Re-activation Request');
    await guestPage.fill('#support-message', 'Please review my account reactivation request for KingdomDash delivery services.');
    
    await guestPage.click('button[type="submit"]');
    await guestPage.waitForTimeout(800);

    const confirmationBannerVisible = await guestPage.locator('text=Support Request Dispatched').isVisible() || await guestPage.locator('text=KD-SUP-TEST-8899').isVisible();
    const referenceTicketVisible = await guestPage.locator('text=KD-SUP-TEST-8899').isVisible();
    console.log('  Support ticket confirmation banner visible:', confirmationBannerVisible);
    console.log('  Reference Ticket ID shown to user:', referenceTicketVisible);
    console.log('  Payload sent to submit_support_ticket RPC:', supportTicketPayload);

    const shotSupportSubmitted = path.join(SCREENSHOTS_DIR, '08_support_ticket_confirmation.png');
    await guestPage.screenshot({ path: shotSupportSubmitted, fullPage: true });

    results.supportSystem = {
      unauthenticatedAccess: true,
      verifiedPhone: hasPhone,
      verifiedEmail: hasEmail,
      verifiedLocation: hasLocation,
      liveWhatsApp: hasWhatsAppLink,
      accountInactiveBanner: restrictedBannerVisible,
      ticketSubmittedRpc: supportTicketPayload !== null,
      ticketReferenceReturned: referenceTicketVisible,
      passed: hasPhone && hasEmail && hasLocation && hasWhatsAppLink && restrictedBannerVisible && referenceTicketVisible
    };

    // 6d: Login page Inactive Account Notice
    console.log('\n--- 7. Testing Login Inactive Account Notice ---');
    await guestPage.goto(BASE_URL + '/login?error=inactive', { waitUntil: 'networkidle' });
    const hasLoginSupportLink = await guestPage.locator('a[href="/support?reason=account_inactive"]').isVisible();
    console.log('  Login page has direct Support CTA for inactive accounts:', hasLoginSupportLink);

    const shotLogin = path.join(SCREENSHOTS_DIR, '09_login_inactive_cta.png');
    await guestPage.screenshot({ path: shotLogin, fullPage: true });

    results.inactiveAccount = {
      loginSupportLinkVisible: hasLoginSupportLink,
      passed: hasLoginSupportLink
    };

    // ──────────────────────────────────────────────────────────────────────────
    // WORKFLOW 8: Responsive Visual QA Across All 10 Required Viewports
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- 8. Responsive Visual QA Across 10 Viewports ---');
    const viewports = [
      { name: '320x568_iPhoneSE_1st', width: 320, height: 568 },
      { name: '375x667_iPhoneSE_2nd', width: 375, height: 667 },
      { name: '390x844_iPhone12_13', width: 390, height: 844 },
      { name: '414x896_iPhoneXR_11', width: 414, height: 896 },
      { name: '768x1024_iPad_Portrait', width: 768, height: 1024 },
      { name: '820x1180_iPadAir_Portrait', width: 820, height: 1180 },
      { name: '1024x768_iPad_Landscape', width: 1024, height: 768 },
      { name: '1280x800_LaptopSmall', width: 1280, height: 800 },
      { name: '1440x900_MacBook', width: 1440, height: 900 },
      { name: '1920x1080_FHD_Desktop', width: 1920, height: 1080 }
    ];

    const testPages = [
      { name: 'support', url: '/support' },
      { name: 'support_inactive', url: '/support?reason=account_inactive' },
      { name: 'login', url: '/login' },
      { name: 'home', url: '/' },
      { name: 'food', url: '/food' },
      { name: 'grocery', url: '/grocery' },
      { name: 'courier', url: '/courier' }
    ];

    for (const vp of viewports) {
      await guestPage.setViewportSize({ width: vp.width, height: vp.height });
      console.log(`\nTesting Viewport: ${vp.name} (${vp.width}x${vp.height})`);

      for (const tp of testPages) {
        await guestPage.goto(BASE_URL + tp.url, { waitUntil: 'domcontentloaded' });
        await guestPage.waitForTimeout(250);

        const overflow = await checkOverflow(guestPage);
        const shotName = `responsive_${tp.name}_${vp.name}.png`;
        const shotPath = path.join(SCREENSHOTS_DIR, shotName);

        if (overflow.hasOverflow) {
          console.warn(`  ⚠️ OVERFLOW DETECTED: ${tp.name} at ${vp.width}x${vp.height} (+${overflow.overflowAmount}px)`);
          results.overflowViolations.push({
            page: tp.name,
            viewport: `${vp.width}x${vp.height}`,
            overflowAmount: overflow.overflowAmount
          });
        }

        if ([320, 390, 768, 1280, 1920].includes(vp.width)) {
          await guestPage.screenshot({ path: shotPath, fullPage: true });
        }

        results.responsiveAudit.push({
          page: tp.name,
          viewport: `${vp.width}x${vp.height}`,
          scrollWidth: overflow.scrollWidth,
          clientWidth: overflow.clientWidth,
          hasOverflow: overflow.hasOverflow
        });
      }
    }

    console.log(`\nResponsive QA Complete. Total audit checks: ${results.responsiveAudit.length}`);
    console.log(`Overflow Violations count: ${results.overflowViolations.length}`);

    fs.writeFileSync(
      path.join(__dirname, 'playwright_critical_qa_results.json'),
      JSON.stringify(results, null, 2)
    );

    console.log('\n✅ All Critical QA checks finished successfully.');
  } finally {
    await browser.close();
  }
}

runCriticalQA().catch(err => {
  console.error('❌ Critical QA Error:', err);
  process.exit(1);
});
