# Requirements Document — Phase 5: Vendor & Product System

## 1. Project Context
- **Platform**: KingdomDash — Nigeria's Multi-Service Delivery Platform
- **Tagline**: **SWIFT IN MOTION.**
- **Launch Market**: **Ijebu-Ode, Ogun State**
- **Core Services**:
  1. Food Delivery
  2. Grocery Delivery
  3. Courier Dispatch
- **Target Roles**: `customer`, `vendor`, `rider`, `admin`, `super_admin`

---

## 2. Phase 5 Objectives
Establish the complete, secure, production-grade **Vendor & Product System** for KingdomDash:
1. Vendor-facing catalog management (Dashboard Overview, Categories, Products, and Business Profile).
2. Vendor category management (listing, creation, updating, activation/deactivation, deletion with ownership enforcement).
3. Vendor product management (listing, creation, updating, authoritative pricing, availability toggling, deletion with category-vendor integrity).
4. Product image support via validated image URLs and preview (compatible with existing Phase 2 schema `image_url text`).
5. Public catalog consumption (connecting public routes `/food`, `/food/:vendorId`, `/groceries`, `/groceries/:storeId` to real Supabase queries).
6. Strict vendor ownership enforcement at both application and database RLS levels (no cross-vendor manipulation, no ownership theft).
7. Strict price security (database is authoritative for pricing; no client-side price fabrication).
8. Strict role-based route protection via existing `RouteGuard`.
9. Production decoupling from mock catalog data.
10. Full regression safety for Phase 0–4 functionality.

---

## 3. Scope Boundaries

### In Scope (Phase 5)
- Vendor portal at `/vendor/*` with protected navigation for users with role `vendor`.
- Vendor context resolution linking `auth.uid()` / `profile.id` to `vendors.profile_id`.
- Handled state for vendor accounts without an active vendor record (pending setup / onboarding notice).
- Category CRUD:
  - List vendor's categories.
  - Create category (name, optional reference category link, description, display order, is_active).
  - Edit category.
  - Toggle active/inactive.
  - Delete category with confirmation and product check.
- Product CRUD:
  - List vendor's products with category grouping, search, and availability filtering.
  - Create product with name, category selection, price (NGN >= 0), description, image URL, availability.
  - Edit product.
  - Instant toggle of `is_available` status.
  - Delete product with confirmation.
- Business Profile view and editing of permitted contact/operational details.
- Public catalog data fetching:
  - `/food` lists active restaurant vendors.
  - `/food/:vendorId` displays vendor hero, details, and active products with real prices.
  - `/groceries` (and `/grocery`) lists active grocery store vendors.
  - `/groceries/:storeId` (and `/grocery/:storeId`) displays store hero, details, and available products.
  - WhatsApp CTA with prefilled message dynamically tailored to real vendor name.
- RLS audit and surgical migration:
  - Add `categories_select_own_vendor` and `products_select_own_vendor` to permit vendors to view and manage inactive categories and unavailable products.
  - Harden `UPDATE` policies with `WITH CHECK` and trigger protection to prevent `vendor_id` reassignment.
  - Protect vendor profile fields against unauthorized escalation.
- Comprehensive unit and integration testing for Phase 5 features.

### Out of Scope (Strictly Phase 6+)
- Customer shopping cart (state, persistence, cart item management) — Phase 6.
- Checkout workflow & delivery address selection — Phase 6.
- Order creation & placement UI — Phase 6.
- Distance calculation & delivery fee calculation — Phase 7 & 8.
- Paystack payment gateway integration — Phase 9.
- Live order tracking, dispatch, & rider assignment — Phase 10 & 11.
- Admin review center & platform configuration — Phase 12.

---

## 4. Functional Requirements

### FR-1: Vendor Authentication & Authorization
- **FR-1.1**: Only authenticated users with role `'vendor'` may access `/vendor/*` routes.
- **FR-1.2**: Unauthenticated users visiting `/vendor/*` are redirected to `/auth/login?redirect=%2Fvendor`.
- **FR-1.3**: Customers and riders attempting to access `/vendor/*` are redirected to their own dashboards (`/dashboard` and `/rider` respectively).
- **FR-1.4**: If an authenticated vendor user does not have an approved vendor record in `vendors`, the system must render an informative onboarding pending state rather than crashing.

### FR-2: Category Management
- **FR-2.1**: A vendor can only see and manage categories where `vendor_id` matches their own vendor record.
- **FR-2.2**: Category creation requires a non-empty name and defaults `is_active` to `true`.
- **FR-2.3**: Category updates allow editing name, description, display order, and active status.
- **FR-2.4**: Vendors cannot assign categories to another vendor's `vendor_id`.
- **FR-2.5**: Deleting a category warns the user if active products are assigned to it.

### FR-3: Product Management & Authoritative Pricing
- **FR-3.1**: A vendor can only see, create, edit, or delete products associated with their own `vendor_id`.
- **FR-3.2**: Product creation requires a non-empty name, a non-negative price (`price >= 0`), and an optional category selection from the vendor's own categories.
- **FR-3.3**: Cross-vendor category assignment is strictly rejected (enforced client-side and verified by database trigger `validate_product_category_vendor`).
- **FR-3.4**: Prices are stored authoritatively in the database as `numeric(12,2)`. The frontend displays prices in formatted Nigerian Naira (NGN, ₦) and enforces valid decimal numeric input.
- **FR-3.5**: Vendors can quickly toggle `is_available` on any product.
- **FR-3.6**: Product deletion requires explicit confirmation.

### FR-4: Business Profile Management
- **FR-4.1**: Vendors can view their business details (name, business type, phone, email, address, service area, operating hours, active status, rating).
- **FR-4.2**: Vendors can update allowed operational fields (phone, business description, business address, service area, operating hours).
- **FR-4.3**: Vendors cannot mutate immutable fields (`id`, `profile_id`, `rating`, `is_active`).

### FR-5: Public Catalog Integration
- **FR-5.1**: Public pages `/food` and `/groceries` query active, approved vendors from Supabase.
- **FR-5.2**: Inactive vendors (`is_active = false`) are never displayed to the public.
- **FR-5.3**: Vendor detail pages `/food/:vendorId` and `/groceries/:storeId` query active products (`is_available = true`) belonging to that vendor.
- **FR-5.4**: Unavailable products (`is_available = false`) are hidden from public catalog views.
- **FR-5.5**: Loading, error, and empty states are gracefully rendered for all public catalog views.
- **FR-5.6**: Mock catalog data in `src/data/mock-catalog.ts` is isolated from production execution paths.

---

## 5. Non-Functional Requirements
- **Security**: No secrets in frontend. Zero RLS bypasses. Authoritative database pricing. Ownership immutability.
- **Accessibility**: Keyboard navigable, valid ARIA dialogs, accessible forms with proper labeling, responsive across mobile, tablet, and desktop.
- **Performance**: Optimistic updates for availability toggles, efficient indexing on `vendor_id` and `is_active`.
- **Code Quality**: Strict TypeScript (no `any`), ESLint/oxlint clean, Vitest 100% green, Vite build clean.
