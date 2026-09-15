# Requirements Document

## Introduction

KingdomDash is a Nigerian multi-service delivery platform (Food, Grocery, Courier) with online ordering,
Paystack payments, and distance-based delivery pricing in V1. Official tagline: **SWIFT IN MOTION.**

The project already has a Vite + React 19 + TypeScript + Tailwind CSS scaffold in place, along with a
comprehensive design token system and a library of shared UI and layout components. Phase 1 completes the
foundation by wiring the application entry point, building the full navigation system, implementing all
public-facing pages and application pages (with UI-only forms), providing auth and dashboard shells, and
validating the entire codebase through a clean production build.

No backend connections (Supabase), authentication logic, payment processing (Paystack), maps/geocoding, or
distance calculations are introduced in Phase 1. All of these are the responsibility of later phases.

---

## Glossary

- **App**: The KingdomDash React single-page application served by Vite.
- **Router**: The React Router DOM v6 `BrowserRouter` and `Routes` tree declared in `App.tsx`.
- **Navbar**: The persistent top navigation component rendered on every public and shell page.
- **Footer**: The persistent bottom component rendered on every public and shell page.
- **MobileNav**: The slide-in drawer/sheet used for navigation on viewports narrower than the `lg` breakpoint.
- **PublicLayout**: The layout wrapper that includes Navbar and Footer and wraps all public, auth, and application routes.
- **PageContainer**: The existing `src/components/layout/section.tsx` container that constrains content width and provides horizontal padding.
- **DesignToken**: A named CSS custom property (e.g. `--color-primary`) defined in `src/styles/index.css` and mapped to a Tailwind utility class in `tailwind.config.js`.
- **SemanticToken**: A design token with a semantic name (e.g. `bg-primary`, `text-text-secondary`) rather than a raw hex value.
- **ComingSoonNotice**: The existing `src/components/shared/coming-soon-notice.tsx` component used to mark dashboard shells as UI-only.
- **MockCatalog**: The static data in `src/data/mock-catalog.ts` providing mock vendors and products for food/grocery pages.
- **WhatsApp_Link_Generator**: The `generateWhatsAppLink` function in `src/utils/whatsapp.ts`.
- **ToastViewport**: The existing `src/components/ui/toast.tsx` viewport component that must be mounted once at the app root.
- **QueryClient**: The TanStack Query `QueryClient` instance from `src/lib/query-client.ts`.
- **UiStore**: The Zustand store in `src/stores/ui-store.ts` managing toast and mobile navigation state.
- **BecomeVendorPage**: The `/become-vendor` public recruitment and application page.
- **BecomeRiderPage**: The `/become-rider` public recruitment and application page.
- **DashboardShell**: A placeholder page behind a protected-looking route that displays only `ComingSoonNotice` and contains no live backend calls.

---

## Requirements

---

### Requirement 1: Application Entry Point

**User Story:** As a developer, I want `src/main.tsx` to mount the full provider tree, so that React Router, TanStack Query, and the toast system are available everywhere in the application without additional setup.

#### Acceptance Criteria

1. THE App SHALL be wrapped in `StrictMode`, `BrowserRouter`, and `QueryClientProvider` (using the `QueryClient` from `src/lib/query-client.ts`), in that nesting order, before rendering.
2. THE App SHALL mount the `ToastViewport` component once at the application root, outside of the page routing tree, so toasts are displayed over all page content.
3. WHEN `src/main.tsx` mounts, THE App SHALL import `src/styles/index.css` (not the old `src/index.css`) as its global stylesheet entry point.
4. THE App SHALL not import or reference Supabase, Paystack, or any maps/geocoding library.

---

### Requirement 2: Application Router

**User Story:** As a developer, I want `src/App.tsx` to be replaced with a clean React Router route tree, so that every defined URL in the architecture resolves to the correct page component without crashing.

#### Acceptance Criteria

1. THE Router SHALL declare all public routes: `/`, `/about`, `/services`, `/food`, `/food/:vendorId`, `/groceries`, `/groceries/:storeId`, `/courier`, `/contact`, `/faq`.
2. THE Router SHALL declare all auth shell routes: `/auth/login`, `/auth/register`, `/auth/forgot-password`.
3. THE Router SHALL declare all application routes: `/become-vendor`, `/become-rider`.
4. THE Router SHALL declare dashboard shell routes: `/dashboard/*`, `/vendor/*`, `/rider/*`, `/admin/*`.
5. THE Router SHALL render a 404 / Not Found page for any URL that does not match a defined route.
6. WHEN any defined route is visited, THE Router SHALL render the corresponding page component without throwing an unhandled error.
7. THE Router SHALL not import the default Vite starter `App.css` or any asset from `src/assets/react.svg` or `src/assets/vite.svg`.

---

### Requirement 3: Public Layout Wrapper

**User Story:** As a visitor, I want consistent navigation and footer on every public page, so that I can move between sections without re-orienting myself.

#### Acceptance Criteria

1. THE PublicLayout SHALL render the Navbar at the top and the Footer at the bottom, with the routed page content between them on every public, auth, and application route.
2. WHILE a page is rendered inside PublicLayout, THE PublicLayout SHALL not add any extra vertical spacing between the Navbar and the page hero section beyond what the page itself defines.
3. THE PublicLayout SHALL not be applied to DashboardShell routes (`/dashboard/*`, `/vendor/*`, `/rider/*`, `/admin/*`).

---

### Requirement 4: Navbar Component

**User Story:** As a visitor, I want a top navigation bar, so that I can quickly access any major section of the KingdomDash website.

#### Acceptance Criteria

1. THE Navbar SHALL display the `Logo` component (from `src/components/layout/logo.tsx`) as a link to `/`.
2. THE Navbar SHALL display desktop navigation links to: Home (`/`), Services (`/services`), Food (`/food`), Groceries (`/groceries`), Courier (`/courier`), About (`/about`), Contact (`/contact`).
3. WHEN a desktop navigation link matches the current URL path, THE Navbar SHALL apply an active visual state to that link using a SemanticToken (not a raw hex value).
4. THE Navbar SHALL display a primary CTA button (e.g. "Order Now") that links to `/food` on desktop.
5. THE Navbar SHALL display a hamburger icon button on viewports narrower than the `lg` breakpoint (1024 px) and hide the desktop nav links.
6. WHEN the hamburger button is activated, THE Navbar SHALL set `mobileNavOpen` to `true` in the UiStore.
7. THE Navbar SHALL use a dark background (`bg-near-black`) with white text so that it visually anchors the page header on all public pages.
8. THE Navbar SHALL be keyboard navigable: all links and buttons must be reachable and activatable via the Tab and Enter/Space keys.
9. IF a focus-visible style is present, THE Navbar SHALL display it using the `focus-visible` CSS class already defined in `src/styles/index.css`.
10. THE Navbar SHALL not contain any hard-coded brand color hex values; all colors SHALL use SemanticTokens.

---

### Requirement 5: Mobile Navigation Drawer

**User Story:** As a mobile visitor, I want a slide-in navigation drawer, so that I can access all site sections comfortably on a small screen.

#### Acceptance Criteria

1. WHEN `mobileNavOpen` is `true` in the UiStore, THE MobileNav SHALL render a full-height overlay panel containing all primary navigation links.
2. THE MobileNav SHALL include a close button that sets `mobileNavOpen` to `false` in the UiStore when activated.
3. WHEN a navigation link inside MobileNav is activated, THE MobileNav SHALL close (set `mobileNavOpen` to `false`) after navigation.
4. WHILE MobileNav is open, THE MobileNav SHALL trap keyboard focus within the drawer so that Tab does not cycle to background content.
5. WHEN MobileNav opens, THE MobileNav SHALL receive focus on its first focusable element.
6. THE MobileNav SHALL use a `role="dialog"` and `aria-modal="true"` attribute pair for screen reader compatibility.
7. THE MobileNav SHALL contain links to all routes defined in Requirement 4 Criterion 2, plus "Become a Vendor" (`/become-vendor`) and "Become a Rider" (`/become-rider`).

---

### Requirement 6: Footer Component

**User Story:** As a visitor reaching the bottom of any page, I want a footer with service links, contact information, and social channels, so that I can find secondary information without scrolling back to the top.

#### Acceptance Criteria

1. THE Footer SHALL display a KingdomDash logo or wordmark linked to `/`.
2. THE Footer SHALL display grouped links in at minimum three columns: Services (Food, Groceries, Courier), Company (About, Contact, FAQ), and Join Us (Become a Vendor, Become a Rider).
3. THE Footer SHALL display the official support email and phone number from `appConfig.support`.
4. THE Footer SHALL display a WhatsApp CTA using the `WhatsAppCta` component with the default message from `appConfig.whatsapp.defaultMessage`.
5. THE Footer SHALL use a dark background (`bg-near-black`) with white text.
6. THE Footer SHALL display the tagline "SWIFT IN MOTION" and a copyright notice with the KingdomDash name.
7. THE Footer SHALL not hard-code any brand color hex values; all colors SHALL use SemanticTokens.

---

### Requirement 7: Home Page

**User Story:** As a first-time visitor, I want a compelling home page, so that I immediately understand what KingdomDash offers and how to get started.

#### Acceptance Criteria

1. THE Home Page SHALL render a hero section with: the "SWIFT IN MOTION" tagline, a headline, a supporting description, a primary CTA (e.g. "Order Food Now" → `/food`), and a secondary CTA (e.g. "Learn More" → `/services`), using the existing `Hero` component.
2. THE Home Page SHALL render a services section displaying three `ServiceCard` items for Food Delivery, Grocery Delivery, and Courier, each linking to their respective routes.
3. THE Home Page SHALL render a "How It Works" section with at least three numbered steps explaining the ordering process.
4. THE Home Page SHALL render a "Why KingdomDash" section with at least three trust/value propositions (e.g. Fast Delivery, Multiple Services, Reliable Riders).
5. THE Home Page SHALL render a vendor/rider recruitment CTA section with links to `/become-vendor` and `/become-rider`.
6. THE Home Page SHALL not hard-code any raw color hex values.
7. THE Home Page SHALL not import or reference Supabase, Paystack, or maps libraries.

---

### Requirement 8: About Page

**User Story:** As a visitor, I want an About page, so that I can learn about KingdomDash's story, mission, and values.

#### Acceptance Criteria

1. THE About Page SHALL include a hero section with an appropriate headline.
2. THE About Page SHALL include sections covering: company story/background, mission statement, vision statement, and core values.
3. THE About Page SHALL reference all three services (Food Delivery, Grocery Delivery, Courier Dispatch) in its content.
4. THE About Page SHALL not hard-code any raw color hex values.

---

### Requirement 9: Services Overview Page

**User Story:** As a visitor, I want a Services page, so that I can get an overview of all three KingdomDash offerings before choosing one.

#### Acceptance Criteria

1. THE Services Page SHALL display a summary card or section for each of the three services: Food Delivery, Grocery Delivery, and Courier.
2. WHEN a service card or CTA is activated, THE Services Page SHALL navigate to the corresponding service-specific route (`/food`, `/groceries`, `/courier`).
3. THE Services Page SHALL not hard-code any raw color hex values.

---

### Requirement 10: Food Delivery Listing Page

**User Story:** As a customer, I want to browse a list of food vendors, so that I can find a restaurant to order from.

#### Acceptance Criteria

1. THE Food Delivery Page SHALL display all restaurant vendors from `MockCatalog` using the existing `VendorCard` component.
2. THE Food Delivery Page SHALL display only vendors where `businessType === 'restaurant'`.
3. WHEN a vendor card is activated, THE Food Delivery Page SHALL navigate to `/food/:vendorId` using the vendor's `id` field.
4. THE Food Delivery Page SHALL display a WhatsApp CTA using the `WhatsAppCta` component as a fallback ordering channel.
5. THE Food Delivery Page SHALL display an open/closed status indicator for each vendor that does not rely solely on color to convey state.
6. THE Food Delivery Page SHALL not hard-code any raw color hex values.

---

### Requirement 11: Food Vendor Detail Page

**User Story:** As a customer, I want to view a specific restaurant's details and menu, so that I can see what is available before ordering.

#### Acceptance Criteria

1. WHEN `/food/:vendorId` is visited with a valid `vendorId`, THE Food Vendor Detail Page SHALL display the vendor's name, description, area, open/closed status, and ETA.
2. WHEN `/food/:vendorId` is visited with a valid `vendorId`, THE Food Vendor Detail Page SHALL display all products for that vendor from `MockCatalog` using the existing `ProductCard` component.
3. THE Food Vendor Detail Page SHALL display a WhatsApp CTA with a pre-filled message containing the vendor's name (e.g. "Hello KingdomDash, I would like to place an order from [Vendor Name].").
4. WHEN `/food/:vendorId` is visited with an unrecognised `vendorId`, THE Food Vendor Detail Page SHALL display a not-found state (message or redirect) rather than crashing or showing an empty page silently.
5. THE Food Vendor Detail Page SHALL display product prices formatted using the `formatNgn` utility.
6. THE Food Vendor Detail Page SHALL not hard-code any raw color hex values.

---

### Requirement 12: Grocery Delivery Listing Page

**User Story:** As a customer, I want to browse grocery stores, so that I can choose where to order groceries from.

#### Acceptance Criteria

1. THE Grocery Delivery Page SHALL display all grocery store vendors from `MockCatalog` using the existing `VendorCard` component.
2. THE Grocery Delivery Page SHALL display only vendors where `businessType === 'grocery_store'`.
3. WHEN a store card is activated, THE Grocery Delivery Page SHALL navigate to `/groceries/:storeId` using the store's `id` field.
4. THE Grocery Delivery Page SHALL display a WhatsApp CTA as a fallback ordering channel.
5. THE Grocery Delivery Page SHALL display an open/closed status indicator for each store that does not rely solely on color.
6. THE Grocery Delivery Page SHALL not hard-code any raw color hex values.

---

### Requirement 13: Grocery Store Detail Page

**User Story:** As a customer, I want to view a specific grocery store's products, so that I can see what is available before ordering.

#### Acceptance Criteria

1. WHEN `/groceries/:storeId` is visited with a valid `storeId`, THE Grocery Store Detail Page SHALL display the store's name, description, area, open/closed status, and ETA.
2. WHEN `/groceries/:storeId` is visited with a valid `storeId`, THE Grocery Store Detail Page SHALL display all products for that store from `MockCatalog` using the existing `ProductCard` component.
3. THE Grocery Store Detail Page SHALL display a WhatsApp CTA with a pre-filled message containing the store's name (e.g. "Hello KingdomDash, I would like to order groceries from [Store Name].").
4. WHEN `/groceries/:storeId` is visited with an unrecognised `storeId`, THE Grocery Store Detail Page SHALL display a not-found state rather than crashing or showing an empty page silently.
5. THE Grocery Store Detail Page SHALL display product prices formatted using the `formatNgn` utility.
6. THE Grocery Store Detail Page SHALL not hard-code any raw color hex values.

---

### Requirement 14: Courier Service Page

**User Story:** As a customer, I want a Courier service page, so that I can understand how to send a package and initiate a courier request.

#### Acceptance Criteria

1. THE Courier Page SHALL include a hero section explaining the courier dispatch service.
2. THE Courier Page SHALL list eligible delivery types (e.g. parcels, documents, packages).
3. THE Courier Page SHALL describe the pickup and drop-off process.
4. THE Courier Page SHALL display a prominent WhatsApp CTA with a pre-filled courier request message.
5. THE Courier Page SHALL provide the UI foundation for the V1 online courier ordering flow without implementing live checkout, payment, maps, or distance calculation in Phase 1. The page SHALL NOT state or imply that online courier ordering is excluded from V1.

---

### Requirement 15: Contact Page

**User Story:** As a visitor, I want a Contact page, so that I can find KingdomDash's contact details and send a message.

#### Acceptance Criteria

1. THE Contact Page SHALL display the support email, phone number, business hours, and physical location from `appConfig.support`.
2. THE Contact Page SHALL display a WhatsApp CTA using the `WhatsAppCta` component.
3. THE Contact Page SHALL display a contact form with fields: Name, Email, Phone (optional), Subject, and Message.
4. WHEN the contact form is submitted, THE Contact Page SHALL display a UI-only success confirmation (e.g. a toast or inline message) without making any network request or API call.
5. IF a required field is left empty when the form is submitted, THEN THE Contact Page SHALL display an inline validation error for each empty required field without submitting.
6. THE Contact Page SHALL not import or reference Supabase or any backend client.
7. THE Contact Page SHALL not hard-code any raw color hex values.

---

### Requirement 16: FAQ Page

**User Story:** As a visitor, I want an FAQ page, so that I can find answers to common questions without contacting support.

#### Acceptance Criteria

1. THE FAQ Page SHALL display questions organised into at least four categories: Food Delivery, Grocery Delivery, Courier, and General / Support.
2. WHEN an FAQ item heading is activated, THE FAQ Page SHALL expand or collapse the answer for that item (accordion behaviour).
3. THE FAQ Page SHALL contain at least three questions per category.
4. THE FAQ Page SHALL not hard-code any raw color hex values.

---

### Requirement 17: Become a Vendor Page

**User Story:** As a prospective vendor, I want a "Become a Vendor" page, so that I can learn about the benefits and submit a basic expression of interest.

#### Acceptance Criteria

1. THE BecomeVendorPage SHALL include a hero or header section describing the benefits of joining KingdomDash as a vendor.
2. THE BecomeVendorPage SHALL describe the types of vendors accepted (restaurants, grocery stores).
3. THE BecomeVendorPage SHALL describe the application and admin-review process.
4. THE BecomeVendorPage SHALL display an application form with fields: Business Name, Business Type (restaurant / grocery store), Owner Name, Email, Phone, Business Address, and a Message / Description field.
5. WHEN the application form is submitted, THE BecomeVendorPage SHALL display a UI-only confirmation message without making any network request.
6. IF a required field is left empty on submission, THEN THE BecomeVendorPage SHALL display inline validation errors without submitting.
7. THE BecomeVendorPage SHALL not import or reference Supabase or any backend client.
8. THE BecomeVendorPage SHALL not hard-code any raw color hex values.

---

### Requirement 18: Become a Rider Page

**User Story:** As a prospective rider, I want a "Become a Rider" page, so that I can learn about the requirements and submit my application interest.

#### Acceptance Criteria

1. THE BecomeRiderPage SHALL include a hero or header section describing the benefits of joining KingdomDash as a rider.
2. THE BecomeRiderPage SHALL list rider requirements (e.g. valid license, motorcycle) and vehicle types supported (petrol, electric).
3. THE BecomeRiderPage SHALL describe the application and admin-review process.
4. THE BecomeRiderPage SHALL display an application form with fields: Full Name, Email, Phone, Address, Vehicle Type (petrol / electric), Vehicle Make, and Vehicle Model.
5. WHEN the application form is submitted, THE BecomeRiderPage SHALL display a UI-only confirmation message without making any network request.
6. IF a required field is left empty on submission, THEN THE BecomeRiderPage SHALL display inline validation errors without submitting.
7. THE BecomeRiderPage SHALL not import or reference Supabase or any backend client.
8. THE BecomeRiderPage SHALL not hard-code any raw color hex values.

---

### Requirement 19: Auth Page Shells

**User Story:** As a developer, I want placeholder auth pages at `/auth/login`, `/auth/register`, and `/auth/forgot-password`, so that the routing skeleton is complete and future authentication work has a clear mount point.

#### Acceptance Criteria

1. THE Auth Login Shell SHALL render a page at `/auth/login` that displays a heading ("Sign In") and a `ComingSoonNotice` explaining that authentication is coming in Phase 3.
2. THE Auth Register Shell SHALL render a page at `/auth/register` that displays a heading ("Create Account") and a `ComingSoonNotice`.
3. THE Auth Forgot Password Shell SHALL render a page at `/auth/forgot-password` that displays a heading ("Reset Password") and a `ComingSoonNotice`.
4. THE Auth Page Shells SHALL not contain any form inputs, submit handlers, or Supabase imports.
5. THE Auth Page Shells SHALL not hard-code any raw color hex values.

---

### Requirement 20: Dashboard Shells

**User Story:** As a developer, I want placeholder dashboard pages behind their routes, so that the route tree is complete and team members have clear entry points for later phases.

#### Acceptance Criteria

1. THE Customer Dashboard Shell SHALL render at `/dashboard` and display a heading and a `ComingSoonNotice` explaining the shell is a Phase 1 placeholder.
2. THE Vendor Dashboard Shell SHALL render at `/vendor` and display a heading and a `ComingSoonNotice`.
3. THE Rider Dashboard Shell SHALL render at `/rider` and display a heading and a `ComingSoonNotice`.
4. THE Admin Dashboard Shell SHALL render at `/admin` and display a heading and a `ComingSoonNotice`.
5. WHILE any DashboardShell is rendered, THE DashboardShell SHALL not import, instantiate, or call any Supabase client, authentication hook, or external API.
6. THE DashboardShells SHALL not display fabricated orders, users, metrics, or any other fake backend data.
7. THE DashboardShells SHALL not hard-code any raw color hex values.

---

### Requirement 21: Design System Token Discipline

**User Story:** As a developer, I want all color usage to go through semantic design tokens, so that the brand system remains consistent and easy to maintain across the entire codebase.

#### Acceptance Criteria

1. THE App SHALL not contain any raw hex color values (`#RRGGBB` or `#RGB` format) in any `.tsx`, `.ts`, `.css`, or `.js` file inside `src/`, with the sole exception of `src/styles/index.css` (where the authoritative token values are defined).
2. THE App SHALL not contain any inline `style={{ color: '...' }}` or `style={{ backgroundColor: '...' }}` properties referencing raw hex values.
3. THE App SHALL reference brand colors exclusively through Tailwind utility classes that map to SemanticTokens (e.g. `bg-primary`, `text-primary`, `border-primary`, `bg-near-black`).
4. WHERE a component needs a color not currently covered by an existing SemanticToken, THE Developer SHALL add the token to `tailwind.config.js` and `src/styles/index.css` rather than hardcoding the value in the component.

---

### Requirement 22: WhatsApp Link Correctness

**User Story:** As a customer, I want WhatsApp CTAs to always produce a working wa.me link, so that tapping the button opens a pre-filled conversation without any URL errors.

#### Acceptance Criteria

1. THE WhatsApp_Link_Generator SHALL produce output that always starts with `https://wa.me/`.
2. THE WhatsApp_Link_Generator SHALL strip all `+` and space characters from the business number before embedding it in the URL.
3. THE WhatsApp_Link_Generator SHALL percent-encode the message string using `encodeURIComponent` before appending it as the `text` query parameter.
4. WHEN the message contains special characters (ampersands, equals signs, Unicode), THE WhatsApp_Link_Generator SHALL produce a URL where those characters are correctly percent-encoded and do not break the URL structure.
5. WHEN the message is an empty string, THE WhatsApp_Link_Generator SHALL produce a valid `https://wa.me/{number}` URL without a malformed query string.
6. THE WhatsApp_Link_Generator SHALL read the business number exclusively from `appConfig.whatsapp.businessNumber` and SHALL NOT accept a hardcoded number as a parameter.

**Property Test:** FOR ALL non-null strings `message`, `generateWhatsAppLink(message)` SHALL produce a string that:
- Starts with `https://wa.me/`
- Contains no unencoded `+` or space in the number segment
- Has a `?text=` segment where the value decodes back to the original `message` via `decodeURIComponent`

---

### Requirement 23: No Deferred Technology in Phase 1

**User Story:** As a developer, I want Phase 1 code to contain no imports or references to technologies planned for later phases, so that the build remains clean and scope boundaries are clear.

#### Acceptance Criteria

1. THE App SHALL not import from `@supabase/supabase-js` or any Supabase-related package in Phase 1.
2. THE App SHALL not import or reference Paystack inline, the Paystack public key, or any Paystack SDK.
3. THE App SHALL not import or reference Google Maps, Mapbox, or any maps/geocoding library.
4. THE Phase 1 application SHALL NOT access Supabase, Paystack secret/public keys, Maps, geocoding, or distance-calculation environment variables at runtime.

---

### Requirement 24: Responsive Layout Integrity

**User Story:** As a visitor on any device, I want pages to display without horizontal scroll or overflow, so that the layout feels professional and intentional at every screen size.

#### Acceptance Criteria

1. WHEN the viewport is set to 360 px wide, THE App SHALL render every public page without any element overflowing the viewport horizontally.
2. WHEN the viewport is set to 390 px wide (iPhone 14 size), THE App SHALL render every public page without horizontal overflow.
3. WHEN the viewport is set to 768 px wide (tablet), THE App SHALL render every public page without horizontal overflow.
4. WHEN the viewport is set to 1024 px wide (laptop), THE App SHALL render every public page without horizontal overflow.
5. WHEN the viewport is set to 1280 px wide (desktop), THE App SHALL render every public page without horizontal overflow.
6. WHEN the viewport is set to 1440 px wide (large desktop), THE App SHALL render every public page without horizontal overflow.
7. THE App SHALL use the `PageContainer` component (max-width 72rem, horizontal padding) to constrain all page content, and SHALL NOT introduce custom `max-width` or `width` values that conflict with it.

---

### Requirement 25: Accessibility Baseline

**User Story:** As a user who relies on a keyboard or screen reader, I want all interactive elements on public pages to be accessible, so that I can navigate and use KingdomDash regardless of input method.

#### Acceptance Criteria

1. THE App SHALL use semantic HTML elements (`<nav>`, `<main>`, `<header>`, `<footer>`, `<section>`, `<article>`, `<h1>`–`<h6>`) in all public page layouts.
2. THE App SHALL ensure every page has exactly one `<h1>` element.
3. WHEN an interactive element (button, link, input) receives keyboard focus, THE App SHALL display a visible focus indicator using the `focus-visible` ring defined in `src/styles/index.css`.
4. THE App SHALL provide non-empty `alt` text for all `<img>` elements that convey information; decorative images SHALL use `alt=""`.
5. THE App SHALL provide `aria-label` or visible text for all icon-only buttons (e.g. hamburger menu, close button).
6. THE App SHALL not rely on color alone to communicate any status or action (open/closed indicators, validation errors, etc. must include text or icons).

---

### Requirement 26: Build Validation

**User Story:** As a developer, I want the Phase 1 codebase to pass all static checks and produce a successful production build, so that the foundation is solid before any backend work begins.

#### Acceptance Criteria

1. THE App SHALL compile without TypeScript errors when `tsc -b` is run.
2. THE App SHALL produce no lint errors when `oxlint` is run (using the existing `.oxlintrc.json` configuration).
3. WHEN `vite build` is run, THE App SHALL complete without build errors and produce a `dist/` output.
4. THE App SHALL not contain any TypeScript `any` type that is not accompanied by a documented comment explaining why the escape is necessary.
5. WHEN the production build is previewed with `vite preview`, THE App SHALL load the home page at `/` without a blank screen or console errors.

---

### Requirement 27: Development Plan Wording Correction

**User Story:** As a project stakeholder, I want the `KINGDOMDASH_DEVELOPMENT_PLAN.md` build order to accurately describe each phase's scope, so that developers do not accidentally implement out-of-scope features during Phase 4.

#### Acceptance Criteria

1. THE Development Plan's Phase 4 "Public Website" section SHALL NOT state that it implements Paystack payment checkout, maps/location selection, or distance-based pricing display, because those capabilities are the responsibility of Phases 7–9 respectively.
2. THE Development Plan's Phase 4 description SHALL state that it establishes the UI structure and shells for features that will be connected in later phases (cart/checkout UI shell for Phase 6, maps placeholder for Phase 7, pricing display placeholder for Phase 8).
3. THE Development Plan SHALL NOT describe cart, checkout, or Paystack payment as "future" features outside V1, because the architecture has already defined them as V1 requirements in `KINGDOMDASH_FINAL_ARCHITECTURE.md`.
4. WHERE the Development Plan previously said "WhatsApp is the primary ordering mechanism", THE Development Plan SHALL replace that language with: "Online ordering through the website with Paystack payment is the primary ordering mechanism; WhatsApp is available as a fallback and support channel."

