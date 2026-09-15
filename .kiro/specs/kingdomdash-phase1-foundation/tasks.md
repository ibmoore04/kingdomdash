# Implementation Plan: KingdomDash Phase 1 Foundation

## Overview

Wire the application entry point, build the full navigation system, implement all public-facing pages
and application pages (with UI-only forms), provide auth and dashboard shells, configure the test suite,
and validate the codebase through a clean production build. No backend connections (Supabase, Paystack,
maps, or geocoding) are introduced.

All code is TypeScript / React 19 with Tailwind CSS semantic tokens. Forms use controlled `useState` with
client-side validation only.

**Phase 1 scope boundary:** Food, Grocery, and Courier online ordering, cart, checkout, Paystack
payments, maps/location, and distance-based delivery pricing are all confirmed V1 capabilities. Phase 1
establishes the UI structure and application shells for these features. The functional implementations
are delivered in their respective dedicated phases later in the V1 build sequence. Phase 1 must not
introduce any of those backend/integration technologies.

---

## Tasks

- [x] 1. Wire the application entry point (`src/main.tsx`)
  - Rewrite `src/main.tsx` so the provider tree is: `StrictMode` → `BrowserRouter` → `QueryClientProvider`
    (using the exported `queryClient` from `src/lib/query-client.ts`) → `<App />`, with `<ToastViewport />`
    mounted as a sibling to `<App />` outside the routing tree
  - Import `src/styles/index.css` as the global stylesheet (replace the old `./index.css` import)
  - Do not import Supabase, Paystack, or any maps/geocoding library
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Build the layout shell components
  - [x] 2.1 Create `src/components/layout/navbar.tsx`
    - Render a `<header>` with `sticky top-0 z-40 bg-near-black text-white`
    - Left: `<Logo />` linked to `/`; right (desktop `lg:flex hidden`): `<NavLink>` items for Home,
      Services, Food, Groceries, Courier, About, Contact with active state via `text-primary` SemanticToken
    - Desktop CTA: `<Button asChild><Link to="/food">Order Now</Link></Button>`
    - Mobile (`lg:hidden`): hamburger `<button aria-label="Open navigation menu">` that calls
      `setMobileNavOpen(true)` from `useUiStore`
    - No raw hex values; all interactive elements keyboard-navigable with `focus-visible` rings
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10_

  - [x] 2.2 Create `src/components/layout/mobile-nav.tsx`
    - Returns `null` when `mobileNavOpen === false`
    - When open: fixed full-height overlay (`fixed inset-0 z-50`); panel has `role="dialog"`,
      `aria-modal="true"`, `aria-label="Navigation menu"`
    - Close button with `aria-label="Close navigation menu"` calls `setMobileNavOpen(false)`
    - Each nav link calls `setMobileNavOpen(false)` on click; includes all public routes plus
      `/become-vendor` and `/become-rider`
    - Focus trap via `useEffect` + `keydown` listener; first focusable element receives focus on open
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [x] 2.3 Create `src/components/layout/footer.tsx`
    - `<footer>` with `bg-near-black text-white`: `<Logo inverted />`, "SWIFT IN MOTION" tagline, `<WhatsAppCta />`
    - Three link columns: Services (Food, Groceries, Courier), Company (About, Contact, FAQ), Join Us
      (Become a Vendor, Become a Rider)
    - Contact row: `appConfig.support.email` and `appConfig.support.phoneDisplay`
    - Bottom bar: copyright with `appConfig.name`; no raw hex values
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [x] 2.4 Create `src/components/layout/public-layout.tsx`
    - Renders `<Navbar />` → `<MobileNav />` → `<main><Outlet /></main>` → `<Footer />`
    - `<main>` adds no extra padding between Navbar and page hero; pages own their own top spacing
    - _Requirements: 3.1, 3.2_

- [x] 3. Rewrite `src/App.tsx` — full React Router v6 route tree
  - Wrap all public, auth, and application routes in `PublicLayout` using a parent `<Route>` element
  - Public routes inside `PublicLayout`: `/`, `/about`, `/services`, `/food`, `/food/:vendorId`,
    `/groceries`, `/groceries/:storeId`, `/courier`, `/contact`, `/faq`, `/become-vendor`,
    `/become-rider`
  - Auth shell routes inside `PublicLayout`: `/auth/login`, `/auth/register`, `/auth/forgot-password`
  - Dashboard shell routes **without** `PublicLayout`: `/dashboard/*` → `CustomerDashboardPage`,
    `/vendor/*` → `VendorDashboardPage`, `/rider/*` → `RiderDashboardPage`,
    `/admin/*` → `AdminDashboardPage`
  - Catch-all `*` route inside `PublicLayout` renders `NotFoundPage`
  - Remove all imports from the old starter (`App.css`, `src/assets/react.svg`, `src/assets/vite.svg`)
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.3_

- [x] 4. Checkpoint — layout shell wired; verify entry point and routing compile
  - Verify that `src/main.tsx`, the layout components (Tasks 1–2), and the initial `src/App.tsx` route
    tree (Task 3) compile and render without crashes
  - Run `tsc -b` to confirm no TypeScript errors in the files created so far
  - Run `npm run lint` on the files created so far
  - Start the dev server (`npm run dev`) briefly to confirm the app loads without a blank screen or
    console errors at `/`
  - Do NOT require the WhatsApp property tests or route smoke tests at this checkpoint — those are
    implemented in Task 12
  - Do NOT require pages from Tasks 5–10 to exist at this checkpoint
  - _Requirements: 1.1, 2.1, 3.1, 4.1, 26.1_

- [x] 5. Implement public pages — informational
  - [x] 5.1 Create `src/pages/public/home.tsx`
    - `<Hero>` with `eyebrow="SWIFT IN MOTION"`, headline, description, `primaryCta` → `/food`,
      `secondaryCta` → `/services`; `tone="dark"`
    - Services section: three `<ServiceCard>` items (Food → `/food`, Groceries → `/groceries`,
      Courier → `/courier`) using Lucide icons
    - "How It Works" section: three numbered steps using `<Section>` + `<SectionHeading>` + `<Card>`
    - "Why KingdomDash" section: three value propositions (Fast Delivery, Multiple Services, Reliable
      Riders)
    - Vendor/rider recruitment CTA section with links to `/become-vendor` and `/become-rider`
    - No raw hex values; no Supabase/Paystack/maps imports
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [x] 5.2 Create `src/pages/public/about.tsx`
    - `<Hero>` with appropriate headline; `<Section>` blocks for: story/background, mission statement,
      vision statement, core values (3+)
    - Reference all three services (Food Delivery, Grocery Delivery, Courier Dispatch) in content
    - No raw hex values
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 5.3 Create `src/pages/public/services.tsx`
    - `<Hero>` section; three service summary cards/sections each with CTA linking to `/food`,
      `/groceries`, `/courier`
    - No raw hex values
    - _Requirements: 9.1, 9.2, 9.3_

  - [x] 5.4 Create `src/pages/public/faq.tsx`
    - `useState`-managed accordion: one `openId` state tracks which item is expanded
    - Four categories: Food Delivery, Grocery Delivery, Courier, General/Support — 3+ questions each
    - Each question is a `<button>` that toggles the answer; keyboard accessible
    - No raw hex values
    - _Requirements: 16.1, 16.2, 16.3, 16.4_

- [x] 6. Implement vendor/store listing and detail pages
  - [x] 6.1 Create `src/pages/public/food.tsx`
    - `<Hero>` section; call `getRestaurants()` from `mock-catalog.ts` and render a grid of `<VendorCard>`
      components, each with `to={\`/food/${vendor.id}\`}`
    - `<WhatsAppCta>` fallback below the grid
    - Open/closed status shown via `<Badge>` in `VendorCard` (text label, not color alone)
    - No raw hex values
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [x] 6.2 Create `src/pages/public/food-detail.tsx`
    - `const { vendorId } = useParams<{ vendorId: string }>()`
    - Call `getVendorById(vendorId ?? '')` — if `undefined`, render `<ErrorState>` or inline not-found UI
      with a link back to `/food` (no crash, no silent empty page)
    - If vendor found: display name, description, area, open/closed status (`<Badge>`), ETA; render
      product grid using `getProductsByVendor(vendorId)` with `<ProductCard>` for each product
    - `<WhatsAppCta message={\`Hello KingdomDash, I would like to place an order from ${vendor.name}.\`} />`
    - Prices formatted with `formatNgn`; no raw hex values
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

  - [x] 6.3 Create `src/pages/public/groceries.tsx`
    - Same pattern as `food.tsx` but call `getGroceryStores()` and link cards to `/groceries/${vendor.id}`
    - No raw hex values
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

  - [x] 6.4 Create `src/pages/public/grocery-detail.tsx`
    - `const { storeId } = useParams<{ storeId: string }>()`
    - Same pattern as `food-detail.tsx`: not-found guard → store info → product grid → WhatsApp CTA with
      pre-filled grocery message containing store name
    - No raw hex values
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6_

- [x] 7. Implement Courier page
  - Create `src/pages/public/courier.tsx`
  - `<Hero>` explaining the courier dispatch service; list eligible delivery types (parcels, documents,
    packages); describe pickup and drop-off process using `<Section>` + `<Card>` or list items
  - Prominent `<WhatsAppCta>` with pre-filled courier request message
  - Include UI foundation elements (placeholder cards or a `<ComingSoonNotice>` variant) that communicate
    the V1 online courier ordering flow is being built in a later development phase — do NOT state or
    imply that courier ordering is excluded from V1, permanently unavailable, or only a future product;
    the page must make clear that interactive checkout functionality is coming later in the V1 build
  - No raw hex values; no Paystack/maps/geocoding imports
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

- [x] 8. Implement form pages — Contact, Become a Vendor, Become a Rider
  - [x] 8.1 Create `src/pages/public/contact.tsx`
    - Display `appConfig.support.email`, `appConfig.support.phoneDisplay`, `appConfig.support.hours`,
      `appConfig.support.address`; include `<WhatsAppCta />`
    - Controlled form with `useState<ContactFormState>` and `useState<ContactFormErrors>`; fields: Name
      (required), Email (required), Phone (optional), Subject (required), Message (required)
    - On submit: run synchronous validation; if errors, populate error state and abort — no toast; if
      valid, call `pushToast({ variant: 'success', ... })` and reset form
    - `<FormField>` wraps each input/textarea; `error` prop renders `<p role="alert">`
    - No Supabase or backend imports; no network calls; no raw hex values
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7_

  - [x] 8.2 Create `src/pages/public/become-vendor.tsx`
    - Hero/benefits section describing the advantages of joining as a vendor; describe vendor types
      (restaurants, grocery stores) and the application/admin-review process
    - Controlled form with `useState<VendorFormState>` and `useState<VendorFormErrors>`; fields:
      Business Name, Business Type (`<Select>` with restaurant / grocery_store options), Owner Name,
      Email, Phone, Business Address, Description — all required
    - On submit: synchronous validation; errors shown inline via `<FormField error=...>`; on success
      call `pushToast` and reset form; no network calls; no Supabase imports
    - No raw hex values
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8_

  - [x] 8.3 Create `src/pages/public/become-rider.tsx`
    - Hero/benefits section describing rider perks; list requirements (valid license, motorcycle) and
      supported vehicle types (petrol, electric); describe application/admin-review process
    - Controlled form with `useState<RiderFormState>` and `useState<RiderFormErrors>`; fields: Full
      Name, Email, Phone, Address, Vehicle Type (`<Select>` with petrol / electric options), Vehicle
      Make, Vehicle Model — all required
    - On submit: same synchronous validation → inline errors → `pushToast` on success; no network
      calls; no Supabase imports
    - No raw hex values
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7, 18.8_

- [x] 9. Implement auth shells and 404 page
  - [x] 9.1 Create `src/pages/auth/login.tsx`
    - Render `<h1>Sign In</h1>` and `<ComingSoonNotice>` explaining auth is coming in Phase 3
    - No form inputs, no submit handlers, no Supabase imports, no raw hex values
    - _Requirements: 19.1, 19.4, 19.5_

  - [x] 9.2 Create `src/pages/auth/register.tsx`
    - Render `<h1>Create Account</h1>` and `<ComingSoonNotice>`
    - No form inputs, no Supabase imports, no raw hex values
    - _Requirements: 19.2, 19.4, 19.5_

  - [x] 9.3 Create `src/pages/auth/forgot-password.tsx`
    - Render `<h1>Reset Password</h1>` and `<ComingSoonNotice>`
    - No form inputs, no Supabase imports, no raw hex values
    - _Requirements: 19.3, 19.4, 19.5_

  - [x] 9.4 Create `src/pages/public/not-found.tsx`
    - Accessible 404 page with a single `<h1>` and a `<Link>` back to `/`
    - No raw hex values
    - _Requirements: 2.5_

- [x] 10. Implement dashboard shells
  - [x] 10.1 Create `src/pages/dashboard/customer-dashboard.tsx`
    - Renders at `/dashboard`; `<h1>Customer Dashboard</h1>` + `<ComingSoonNotice>` explaining Phase 1
      placeholder; no Supabase/auth imports, no fake data, no raw hex values
    - _Requirements: 20.1, 20.5, 20.6, 20.7_

  - [x] 10.2 Create `src/pages/dashboard/vendor-dashboard.tsx`
    - Renders at `/vendor`; `<h1>Vendor Dashboard</h1>` + `<ComingSoonNotice>`
    - No Supabase/auth imports, no fake data, no raw hex values
    - _Requirements: 20.2, 20.5, 20.6, 20.7_

  - [x] 10.3 Create `src/pages/dashboard/rider-dashboard.tsx`
    - Renders at `/rider`; `<h1>Rider Dashboard</h1>` + `<ComingSoonNotice>`
    - No Supabase/auth imports, no fake data, no raw hex values
    - _Requirements: 20.3, 20.5, 20.6, 20.7_

  - [x] 10.4 Create `src/pages/dashboard/admin-dashboard.tsx`
    - Renders at `/admin`; `<h1>Admin Dashboard</h1>` + `<ComingSoonNotice>`
    - No Supabase/auth imports, no fake data, no raw hex values
    - _Requirements: 20.4, 20.5, 20.6, 20.7_

- [x] 11. Checkpoint — all pages and routing complete; verify before final validation
  - Confirm all routes defined in Task 3 resolve to their corresponding page components without crashing
  - Run `tsc -b` to confirm no TypeScript errors across all files created in Tasks 1–10
  - Run `npm run lint` and fix any errors before proceeding
  - Manually verify in the dev server: home page loads, food/grocery listing pages show mock vendors,
    vendor detail pages display products, forms display validation errors on empty submit, dashboard
    shells show ComingSoonNotice, 404 page renders for unknown routes
  - Do NOT run the full `vitest --run` suite at this checkpoint — that is Task 14.4
  - _Requirements: 2.6, 7.1, 10.1, 11.1, 12.1, 15.5, 20.1_

- [x] 12. Set up the test suite and write property + smoke tests
  - [x] 12.1 Install test dependencies and configure Vitest
    - Check `package.json` first — inspect whether `vitest`, `@testing-library/react`,
      `@testing-library/jest-dom`, `jsdom`, and `fast-check` are already present; reuse compatible
      existing versions and install only genuinely missing packages
    - If installing: `npm install --save-dev fast-check @testing-library/react @testing-library/jest-dom vitest jsdom`
    - Add `test` block to `vite.config.ts`: `environment: 'jsdom'`, `setupFiles: ['./src/test-setup.ts']`
    - Create `src/test-setup.ts` with `import '@testing-library/jest-dom'`
    - Do not overwrite or upgrade unrelated existing dependencies
    - _Requirements: 22.1, 26.3_

  - [x] 12.2 Write property test — Property 1: link always starts with base URL
    - Create `src/utils/__tests__/whatsapp.test.ts`
    - `// Feature: kingdomdash-phase1-foundation, Property 1: WhatsApp link always starts with the correct base URL`
    - Use `fc.property(fc.string(), ...)` to assert `generateWhatsAppLink(message).startsWith('https://wa.me/')`
    - **Property 1: WhatsApp link always starts with the correct base URL**
    - **Validates: Requirements 22.1, 22.6**
    - _Requirements: 22.1, 22.6_

  - [x] 12.3 Write property test — Property 2: number segment has no `+` or space
    - Extend `src/utils/__tests__/whatsapp.test.ts`
    - `// Feature: kingdomdash-phase1-foundation, Property 2: WhatsApp number segment contains no + or space characters`
    - Slice the number segment between `https://wa.me/` and `?`; assert it contains neither `+` nor ` `
    - **Property 2: WhatsApp number segment contains no `+` or space characters**
    - **Validates: Requirements 22.2**
    - _Requirements: 22.2_

  - [x] 12.4 Write property test — Property 3: message round-trip encoding
    - Extend `src/utils/__tests__/whatsapp.test.ts`
    - `// Feature: kingdomdash-phase1-foundation, Property 3: Message round-trip encoding`
    - Use `new URL(link).searchParams.get('text')` and assert it equals the original `message`
    - **Property 3: Message round-trip encoding**
    - **Validates: Requirements 22.3, 22.4**
    - _Requirements: 22.3, 22.4_

  - [x] 12.5 Write property test — Property 4: empty message produces a valid URL
    - Extend `src/utils/__tests__/whatsapp.test.ts`
    - `// Feature: kingdomdash-phase1-foundation, Property 4: Empty message produces a valid URL without a malformed query string`
    - Call `generateWhatsAppLink('')`; assert it starts with `https://wa.me/`; construct `new URL(link)`
      (throws if malformed); assert decoded text param equals `""`
    - **Property 4: Empty message produces a valid URL without a malformed query string**
    - **Validates: Requirements 22.5**
    - _Requirements: 22.5_

  - [x] 12.6 Write route smoke tests
    - Create `src/pages/__tests__/routes.test.tsx`
    - Create an `AppWithProviders` helper that wraps the full route tree with `MemoryRouter` +
      `QueryClientProvider` (test-scoped `QueryClient`)
    - One `it` block per route — public routes (`/`, `/about`, `/services`, `/food`, `/groceries`,
      `/courier`, `/contact`, `/faq`), auth shells (`/auth/login`, `/auth/register`,
      `/auth/forgot-password`), and application routes (`/become-vendor`, `/become-rider`) — each
      asserts `screen.getByRole('main')` is in the document
    - If equivalent smoke tests already exist in the repository, extend them rather than duplicating
    - _Requirements: 2.6_

- [ ] 13. Update `KINGDOMDASH_DEVELOPMENT_PLAN.md`
  - In the Build Order section, update Phase 4 "Public Website" to state that it establishes the
    public-facing UI structure and application shells for V1 capabilities — functional cart, ordering,
    checkout, Paystack, maps/location, and distance-based pricing are implemented in their respective
    dedicated phases later in the V1 build sequence; do NOT use wording that implies these capabilities
    are excluded from V1 or indefinitely deferred
  - Update the "Future Flow" section so that cart, checkout, and Paystack are described as V1
    features delivered in their own dedicated phases, not as post-V1 items
  - Replace any language describing the primary ordering mechanism as WhatsApp with: "Online ordering
    through the website with Paystack payment is the primary ordering mechanism; WhatsApp is available
    as a fallback and support channel"
  - Preserve all other content in the document; do not remove sections or restructure the phase list
  - _Requirements: 27.1_

- [x] 14. Build validation
  - [x] 14.1 Run `tsc -b` and fix all TypeScript errors
    - Resolve any missing type imports, implicit `any`, incorrect prop types, or missing return types
    - _Requirements: 26.1, 26.4_

  - [x] 14.2 Run `npm run lint` and fix all lint errors
    - Use `npm run lint` (oxlint via `.oxlintrc.json`); address every reported error before proceeding
    - _Requirements: 26.2_

  - [x] 14.3 Run `vite build` and confirm clean production build
    - Build must complete without errors; confirm `dist/` directory is produced
    - _Requirements: 26.3_

  - [x] 14.4 Run `vitest --run` and confirm all tests pass
    - All four WhatsApp property tests (Properties 1–4) and all route smoke tests must report green
    - Fix any test failures before proceeding; do not declare Phase 1 complete if tests are red
    - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.5, 26.3_

- [x] 15. Final checkpoint — Phase 1 complete
  - Confirm all of the following before declaring Phase 1 complete:
    - All required routes exist and resolve to the correct page components
    - Public layout (Navbar, Footer, MobileNav) works at all defined breakpoints
    - Food and Grocery mock catalog listing pages display mock vendors
    - Food and Grocery detail pages display products and pre-filled WhatsApp CTAs
    - Detail-page not-found handling renders an error state (no crash, no silent blank)
    - All three forms (Contact, BecomeVendor, BecomeRider) display inline validation errors on empty
      submit and show a success toast on valid submit — no network calls made
    - Dashboard shells (/dashboard, /vendor, /rider, /admin) render ComingSoonNotice with no fake data
    - Auth shells (/auth/login, /auth/register, /auth/forgot-password) render ComingSoonNotice
    - WhatsApp property tests pass (Properties 1–4)
    - Route smoke tests pass
    - `tsc -b` reports zero errors
    - `npm run lint` reports zero errors
    - `vite build` completes successfully with a `dist/` output
    - `vitest --run` reports all tests green
    - No Supabase, Paystack, Maps, geocoding, distance calculation, fake auth, or fake backend data
      has been introduced anywhere in the Phase 1 codebase
  - Stop here. Do not begin Phase 2 automatically.
  - _Requirements: 1–27_

---

## Notes

- Tasks 12.2–12.6 (all property tests and route smoke tests) are **required** Phase 1 deliverables —
  they are not optional and must not be skipped
- Task 14.4 (`vitest --run`) is **required**; it depends on Tasks 12.1–12.6 being complete
- All new files must use only Tailwind SemanticToken classes — no raw hex values in any `.tsx`/`.ts`
  file inside `src/` (except `src/styles/index.css`)
- Dashboard shells must be placed under `src/pages/dashboard/` and must not import `PublicLayout`
- Before installing test dependencies in Task 12.1, inspect `package.json` to avoid duplicating
  packages that may already be present
- Task 4 checkpoint covers only Tasks 1–3; it does not require pages or tests from later tasks
- Task 11 checkpoint covers Tasks 1–10; it does not require the test suite from Task 12
- The definitive full validation is Task 14 (all four sub-tasks required)
- Dependencies: Task 3 (`App.tsx`) depends on Tasks 2 (layout) and 5–10 (pages); Task 12 depends on
  Task 3 (routes must exist for smoke tests); Task 14 must run last
