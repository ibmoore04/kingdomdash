# Requirements Document — Phase 4: Public Website

## 1. Project Context
- **Platform**: KingdomDash — Nigeria's Multi-Service Delivery Platform
- **Tagline**: **SWIFT IN MOTION.**
- **Launch Market**: **Ijebu-Ode, Ogun State**
- **Expansion**: **Ogun State and subsequent markets**
- **Core Services**:
  1. Food Delivery
  2. Grocery Delivery
  3. Courier Dispatch

## 2. Phase 4 Objectives
Build the complete, production-grade public-facing website for KingdomDash. The site must communicate the value proposition of all three core services, establish local market positioning in Ijebu-Ode, Ogun State, provide accessible navigation, and link into authentication and partner onboarding without pre-implementing future Phase 5+ business logic or introducing fake statistics, fake reviews, or fake products.

## 3. Scope Boundaries
- **In Scope (Phase 4)**:
  - Homepage (`/`) with Hero, Service breakdown, How it works, Why KingdomDash, and Partner CTAs.
  - About page (`/about`) with mission, vision, core values, and launch context.
  - Services overview page (`/services`) highlighting all three services with deep links.
  - Food Delivery service page (`/food`) with explanation, benefits, how-it-works, and vendor onboarding CTA.
  - Grocery Delivery service page (`/groceries`, with `/grocery` alias) with produce/staples focus, benefits, and grocery store partner CTA.
  - Courier Dispatch service page (`/courier`) with parcel/document coverage, pickup concept, WhatsApp booking integration, and upcoming online booking notice.
  - Contact page (`/contact`) with accessible form validation, error states, and official contact channels.
  - Public navigation (`Navbar` and `MobileNav`) with links to Home, About, Services, Food, Grocery, Courier, Contact, Sign In, and Order Now.
  - Footer with official branding, tagline, address, service links, company links, and join links.
  - Direct routing aliases: `/login`, `/register`, `/forgot-password`, `/callback`, `/update-password` with query string preservation.
  - Vercel SPA direct-navigation/refresh rewrite configuration.
  - SEO fundamentals (`<title>` and meta description updates).
- **Out of Scope (Phase 5+)**:
  - Vendor catalog management, menu creation, product CRUD (Phase 5).
  - Customer cart, checkout, and delivery fees engine (Phase 6).
  - Live maps & geolocation tracking (Phase 7).
  - Distance-based delivery fee computation (Phase 8).
  - Paystack payment gateway processing (Phase 9).
  - Live driver dispatch and order status state machine (Phases 10-11).
  - Admin control center dashboards (Phase 12).

## 4. Functional Requirements
- **R1: Public Route Accessibility**: All public routes (`/`, `/about`, `/services`, `/food`, `/groceries`, `/grocery`, `/courier`, `/contact`, `/faq`, `/become-vendor`, `/become-rider`) must render cleanly inside `PublicLayout` with a valid `<main>` landmark.
- **R2: Launch Market Truthfulness**: All pages must consistently reference Ijebu-Ode, Ogun State as the launch market and "SWIFT IN MOTION." as the official tagline. No fake testimonials, fake partner counts, or fake reviews.
- **R3: Navigation & Links**: Zero broken links, zero `href="#"`, fully accessible keyboard navigation and focus management on desktop and mobile.
- **R4: Direct Navigation Safety**: Ensure all routes work on hard page refresh in production via `vercel.json` SPA rewrite rules.
- **R5: Auth Boundary Integrity**: Phase 3 auth routes (`/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/callback`, `/auth/update-password`) and their direct aliases must remain functional without regressions.
