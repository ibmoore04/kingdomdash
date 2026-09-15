# Implementation Tasks — Phase 5: Vendor & Product System

## Task Overview

- [x] **Task 1: Database Migration & Schema Types**
  - [x] 1.1 Create migration `supabase/migrations/20260902000016_vendor_catalog_ownership_rls.sql` with vendor SELECT policies, UPDATE `WITH CHECK` protections, and immutability triggers.
  - [x] 1.2 Update `src/types/database.types.ts` with complete types for `vendors`, `categories`, `products`, and `reference_categories`.
  - [x] 1.3 Export domain types in `src/types/index.ts` (`Vendor`, `Category`, `Product`, `ReferenceCategory`).

- [x] **Task 2: Supabase Service Layer for Catalog Management**
  - [x] 2.1 Enhance `src/services/supabase/vendors.ts` with `getVendorByProfileId()`, `updateVendorProfile()`, and typed query helpers.
  - [x] 2.2 Create `src/services/supabase/categories.ts` with `getVendorCategories()`, `createCategory()`, `updateCategory()`, `deleteCategory()`.
  - [x] 2.3 Enhance `src/services/supabase/products.ts` with `getVendorProducts()`, `createProduct()`, `updateProduct()`, `toggleProductAvailability()`, `deleteProduct()`.
  - [x] 2.4 Add service-layer tests in `src/services/supabase/__tests__/catalog.test.ts`.

- [x] **Task 3: Vendor Context & Dashboard Navigation**
  - [x] 3.1 Create `src/hooks/use-current-vendor.ts` to resolve vendor state from `useAuthStore`'s profile.
  - [x] 3.2 Build `VendorPendingView` for accounts awaiting vendor record or approval.
  - [x] 3.3 Refactor `src/pages/dashboard/vendor-dashboard.tsx` with modern responsive layout, sub-views/tabs (Overview, Products, Categories, Profile), mobile drawer, and header.

- [x] **Task 4: Category Management UI**
  - [x] 4.1 Build `VendorCategoriesTab` with category cards/table, product count, and active status toggle.
  - [x] 4.2 Build `CategoryFormModal` (Add/Edit category with name, description, reference category, display order).
  - [x] 4.3 Build `DeleteCategoryDialog` with confirmation and assigned product check.
  - [x] 4.4 Add category management tests.

- [x] **Task 5: Product Management UI & Authoritative Pricing**
  - [x] 5.1 Build `VendorProductsTab` with search, category filtering, availability status filters, and table/card presentation.
  - [x] 5.2 Build `ProductFormModal` (Add/Edit product with name, category selection, price validation >= 0, description, image URL preview, availability).
  - [x] 5.3 Implement instant availability switch with optimistic feedback.
  - [x] 5.4 Build `DeleteProductDialog` with confirmation.
  - [x] 5.5 Add product management tests (validating prices, category selection, availability toggling).

- [x] **Task 6: Vendor Business Profile UI**
  - [x] 6.1 Build `VendorProfileTab` displaying vendor business details and operating metrics.
  - [x] 6.2 Implement profile edit form for operational fields (phone, address, description, operating hours, service area).
  - [x] 6.3 Add profile update tests.

- [x] **Task 7: Public Catalog Consumption & Decoupling from Mock Data**
  - [x] 7.1 Update `src/pages/public/food.tsx` to query and display active restaurant vendors from Supabase.
  - [x] 7.2 Update `src/pages/public/groceries.tsx` to query and display active grocery store vendors from Supabase.
  - [x] 7.3 Update `src/pages/public/food-detail.tsx` to query real vendor details and live products from Supabase.
  - [x] 7.4 Update `src/pages/public/grocery-detail.tsx` to query real store details and live products from Supabase.
  - [x] 7.5 Isolate `src/data/mock-catalog.ts` for offline test fixtures and fallbacks.
  - [x] 7.6 Update `src/components/shared/product-card.tsx` to accept real `Product` or mock product.
  - [x] 7.7 Add public catalog tests with mocked Supabase queries.

- [x] **Task 8: Route Guard & RBAC Verification**
  - [x] 8.1 Verify vendor route protection: unauthenticated users redirected to `/auth/login?redirect=%2Fvendor`.
  - [x] 8.2 Verify role isolation: customers redirected to `/dashboard`, riders to `/rider`, vendors allowed on `/vendor/*`.
  - [x] 8.3 Add comprehensive RBAC and routing tests for vendor paths in `src/pages/dashboard/__tests__/vendor-dashboard.test.tsx`.

- [x] **Task 9: End-to-End Verification & Documentation**
  - [x] 9.1 Run TypeScript type check (`tsc -b`).
  - [x] 9.2 Run Vitest test suite (`npx vitest run`).
  - [x] 9.3 Run linter (`oxlint`).
  - [x] 9.4 Run production build (`npm run build`).
  - [x] 9.5 Perform regression verification across Phase 0–4 pages.
  - [x] 9.6 Update `walkthrough.md` and generate final structured report.
