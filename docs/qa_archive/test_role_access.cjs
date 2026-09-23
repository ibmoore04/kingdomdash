const { chromium } = require('playwright');

async function testRoleAccess() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Test Customer
  const mockCustomer = {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'customer@kingdomdash.com',
    full_name: 'Amara Okafor',
    phone: '+2348012345678',
    avatar_url: null,
    role: 'customer',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  await page.route('**/auth/v1/user*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: mockCustomer.id,
        email: mockCustomer.email,
        app_metadata: { provider: 'email' },
        user_metadata: { full_name: mockCustomer.full_name },
        aud: 'authenticated',
        role: 'authenticated'
      })
    });
  });

  await page.route('**/rest/v1/profiles*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockCustomer)
    });
  });

  // Inject session in localStorage with a valid 3-part JWT
  await page.goto('http://localhost:5174', { waitUntil: 'domcontentloaded' });
  await page.evaluate((cust) => {
    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const payload = btoa(JSON.stringify({
      sub: cust.id,
      email: cust.email,
      role: "authenticated",
      aud: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600
    }));
    const sig = btoa("fake-signature");
    const fakeJwt = `${header}.${payload}.${sig}`;

    const sessionData = {
      access_token: fakeJwt,
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: 'fake-refresh-token',
      user: {
        id: cust.id,
        email: cust.email,
        aud: 'authenticated',
        role: 'authenticated',
        user_metadata: { full_name: cust.full_name }
      }
    };
    localStorage.setItem('sb-kbrfaccrhmvgcdtdfjna-auth-token', JSON.stringify(sessionData));
  }, mockCustomer);

  // Now navigate to /dashboard
  await page.goto('http://localhost:5174/dashboard', { waitUntil: 'networkidle' });
  console.log('Customer dashboard URL:', page.url());
  console.log('Customer dashboard title:', await page.title());
  const h1 = await page.locator('h1, h2').allTextContents();
  console.log('Headings:', h1);

  await browser.close();
}

testRoleAccess().catch(console.error);
