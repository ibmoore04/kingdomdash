# Tasks: Phase 4 — Public Website

- [x] 4.1 Update application configuration and global brand constants <!-- id: 4.1 -->
  - Set official tagline: "SWIFT IN MOTION." in `src/config/app.config.ts`.
  - Set launch market: "Ijebu-Ode, Ogun State".
  - Set expansion markets: "Ogun State and subsequent markets".
  - Set support address to "Ijebu-Ode, Ogun State, Nigeria".
  - _Requirements: R2_

- [x] 4.2 Establish SEO foundation utility (`useSeo`) <!-- id: 4.2 -->
  - Create `src/hooks/use-seo.ts` to manage dynamic document title and meta description.
  - Suffix titles with `| KingdomDash — SWIFT IN MOTION.`
  - Clean up previous document title on unmount.
  - _Requirements: R2_

- [x] 4.3 Update Public Navigation and Footer <!-- id: 4.3 -->
  - Update `src/components/layout/navbar.tsx` with links: Home, About, Services, Food, Grocery, Courier, Contact, Sign In, Order Now.
  - Update `src/components/layout/mobile-nav.tsx` with matching link list and accessibility attributes.
  - Update `src/components/layout/footer.tsx` with brand information, launch market address, and link columns (Services, Company, Join Us).
  - Ensure zero dead links (`href="#"` prohibited).
  - _Requirements: R1, R3_

- [x] 4.4 Update Homepage (`/`) <!-- id: 4.4 -->
  - Update `src/pages/public/home.tsx` with "SWIFT IN MOTION." and Ijebu-Ode launch market positioning.
  - Highlight the 3 core services: Food Delivery, Grocery Delivery, Courier Dispatch.
  - Connect primary/secondary CTAs to active public routes.
  - Ensure no fake customer counts, fake statistics, or fake reviews.
  - _Requirements: R1, R2_

- [x] 4.5 Update About Page (`/about`) <!-- id: 4.5 -->
  - Update `src/pages/public/about.tsx` with company vision, mission, and core values.
  - Communicate multi-service model and launch in Ijebu-Ode, Ogun State.
  - Provide vendor and rider partnership CTAs.
  - _Requirements: R1, R2_

- [x] 4.6 Update Services Overview Page (`/services`) <!-- id: 4.6 -->
  - Update `src/pages/public/services.tsx` with dedicated sections and CTAs for Food, Grocery, and Courier.
  - Align all copy with launch market and verified rider dispatch.
  - _Requirements: R1, R2_

- [x] 4.7 Update Food Delivery Page (`/food`) <!-- id: 4.7 -->
  - Update `src/pages/public/food.tsx` as an authentic production public service introduction.
  - Detail food delivery benefits, how it works, and vendor onboarding CTA (`/become-vendor`).
  - Eliminate fake mock restaurant catalog.
  - Provide direct WhatsApp ordering assistance.
  - _Requirements: R1, R2_

- [x] 4.8 Update Grocery Delivery Page (`/groceries`, `/grocery`) <!-- id: 4.8 -->
  - Update `src/pages/public/groceries.tsx` focusing on fresh produce, pantry staples, and supermarket delivery.
  - Detail benefits, how it works, and grocery partner onboarding CTA.
  - Eliminate fake mock grocery catalog.
  - Support both `/groceries` and `/grocery` routes in `src/App.tsx`.
  - _Requirements: R1, R2_

- [x] 4.9 Update Courier Dispatch Page (`/courier`) <!-- id: 4.9 -->
  - Update `src/pages/public/courier.tsx` detailing package/parcel/document dispatch.
  - Provide clear pickup and delivery workflow.
  - Feature official WhatsApp booking integration and intentional V1 online booking notice.
  - _Requirements: R1, R2_

- [x] 4.10 Verify Contact Page (`/contact`) and Supporting Public Pages <!-- id: 4.10 -->
  - Verify accessible form controls, client validation, and toast feedback in `src/pages/public/contact.tsx`.
  - Verify `faq.tsx`, `become-vendor.tsx`, `become-rider.tsx`, and `not-found.tsx`.
  - _Requirements: R1, R3_

- [x] 4.11 Configure Vercel SPA Routing & Direct Auth Compatibility Aliases <!-- id: 4.11 -->
  - Maintain `vercel.json` SPA rewrite rules.
  - Add search-param-preserving route aliases in `src/App.tsx` for `/login`, `/register`, `/forgot-password`, `/callback`, `/update-password`.
  - _Requirements: R4, R5_

- [x] 4.12 Automated Testing & Regression Auditing <!-- id: 4.12 -->
  - Create `src/pages/public/__tests__/public-website.test.tsx` verifying all routes, links, SEO, and form validation.
  - Update `src/pages/__tests__/routes.test.tsx` to include `/grocery` and direct aliases.
  - Verify Vitest suite, TypeScript compilation, Oxlint linter, and production build.
  - Confirm zero regressions in Phase 0–3.
  - _Requirements: R1, R2, R3, R4, R5_
