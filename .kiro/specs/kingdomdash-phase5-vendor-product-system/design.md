# Design Document — Phase 5: Vendor & Product System

## 1. System Architecture

Phase 5 introduces the vendor-side catalog management portal and transitions the public customer catalog from static mock data to live Supabase PostgreSQL queries.

```
┌─────────────────────────────────────────────────────────────────┐
│                      KingdomDash Frontend                       │
│                                                                 │
│  ┌───────────────────────────┐    ┌──────────────────────────┐  │
│  │   Public Customer Views   │    │  Protected Vendor Portal │  │
│  │   • /food                 │    │  • /vendor/overview      │  │
│  │   • /food/:vendorId       │    │  • /vendor/products      │  │
│  │   • /groceries            │    │  • /vendor/categories    │  │
│  │   • /groceries/:storeId   │    │  • /vendor/profile       │  │
│  └─────────────┬─────────────┘    └────────────┬─────────────┘  │
│                │                               │                │
│                ▼                               ▼                │
│   ┌──────────────────────────┐    ┌──────────────────────────┐  │
│   │ Public Catalog Services  │    │  Vendor Catalog Services │  │
│   │ • getActiveVendors()     │    │  • getVendorByProfile()  │  │
│   │ • getVendorById()        │    │  • getVendorCategories() │  │
│   │ • getAvailableProducts() │    │  • createCategory()      │  │
│   └─────────────┬────────────┘    │  • updateCategory()      │  │
│                 │                 │  • deleteCategory()      │  │
│                 │                 │  • getVendorProducts()   │  │
│                 │                 │  • createProduct()       │  │
│                 │                 │  • updateProduct()       │  │
│                 │                 │  • toggleAvailability()  │  │
│                 │                 │  • deleteProduct()       │  │
│                 │                 │  • updateVendorProfile() │  │
│                 │                 └────────────┬─────────────┘  │
│                 │                              │                │
└─────────────────┼──────────────────────────────┼────────────────┘
                  │                              │
                  ▼                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Supabase Backend & DB                       │
│                                                                 │
│  ┌───────────────────────────┐    ┌──────────────────────────┐  │
│  │        RLS Policies       │    │     Triggers & Checks    │  │
│  │ • Public SELECT active    │    │ • validate_product_      │  │
│  │ • Vendor SELECT own all   │    │   category_vendor()      │  │
│  │ • Vendor CUD own records  │    │ • trg_protect_vendor_    │  │
│  │ • Admin Full access       │    │   ownership              │  │
│  └───────────────────────────┘    └──────────────────────────┘  │
│                                                                 │
│  Tables:                                                        │
│  • `vendors` (profile_id, business_name, business_type...)      │
│  • `categories` (vendor_id, name, display_order, is_active...)  │
│  • `products` (vendor_id, category_id, name, price...)          │
│  • `reference_categories` (global categories lookup)            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Database Schema & RLS Hardening

### Migration 016: `20260902000016_vendor_catalog_ownership_rls.sql`
Addresses the architectural requirement in Section 4 & 5:

1. **Vendor SELECT Policies**:
   ```sql
   -- categories_select_own_vendor
   DROP POLICY IF EXISTS "categories_select_own_vendor" ON public.categories;
   CREATE POLICY "categories_select_own_vendor" ON public.categories
     FOR SELECT USING (
       EXISTS (
         SELECT 1 FROM public.vendors v
         WHERE v.id = vendor_id AND v.profile_id = auth.uid()
       )
     );

   -- products_select_own_vendor
   DROP POLICY IF EXISTS "products_select_own_vendor" ON public.products;
   CREATE POLICY "products_select_own_vendor" ON public.products
     FOR SELECT USING (
       EXISTS (
         SELECT 1 FROM public.vendors v
         WHERE v.id = vendor_id AND v.profile_id = auth.uid()
       )
     );
   ```

2. **Harden UPDATE with `WITH CHECK` on Categories and Products**:
   ```sql
   DROP POLICY IF EXISTS "categories_update_own_vendor" ON public.categories;
   CREATE POLICY "categories_update_own_vendor" ON public.categories
     FOR UPDATE
     USING (
       EXISTS (
         SELECT 1 FROM public.vendors v
         WHERE v.id = vendor_id AND v.profile_id = auth.uid()
       )
     )
     WITH CHECK (
       EXISTS (
         SELECT 1 FROM public.vendors v
         WHERE v.id = vendor_id AND v.profile_id = auth.uid()
       )
     );

   DROP POLICY IF EXISTS "products_update_own_vendor" ON public.products;
   CREATE POLICY "products_update_own_vendor" ON public.products
     FOR UPDATE
     USING (
       EXISTS (
         SELECT 1 FROM public.vendors v
         WHERE v.id = vendor_id AND v.profile_id = auth.uid()
       )
     )
     WITH CHECK (
       EXISTS (
         SELECT 1 FROM public.vendors v
         WHERE v.id = vendor_id AND v.profile_id = auth.uid()
       )
     );
   ```

3. **Vendor Ownership Immutability Trigger**:
   ```sql
   CREATE OR REPLACE FUNCTION public.prevent_vendor_id_change()
   RETURNS trigger
   LANGUAGE plpgsql
   SECURITY INVOKER
   SET search_path = public
   AS $$
   BEGIN
     IF NEW.vendor_id <> OLD.vendor_id THEN
       RAISE EXCEPTION 'Ownership violation: vendor_id cannot be modified.';
     END IF;
     RETURN NEW;
   END;
   $$;

   DROP TRIGGER IF EXISTS trg_prevent_category_vendor_change ON public.categories;
   CREATE TRIGGER trg_prevent_category_vendor_change
     BEFORE UPDATE ON public.categories
     FOR EACH ROW
     EXECUTE FUNCTION public.prevent_vendor_id_change();

   DROP TRIGGER IF EXISTS trg_prevent_product_vendor_change ON public.products;
   CREATE TRIGGER trg_prevent_product_vendor_change
     BEFORE UPDATE ON public.products
     FOR EACH ROW
     EXECUTE FUNCTION public.prevent_vendor_id_change();
   ```

4. **Harden Vendor Profile UPDATE**:
   ```sql
   CREATE OR REPLACE FUNCTION public.prevent_vendor_immutable_field_change()
   RETURNS trigger
   LANGUAGE plpgsql
   SECURITY INVOKER
   SET search_path = public
   AS $$
   BEGIN
     -- Only admin/super_admin may change is_active, rating, profile_id, or id
     IF (get_current_user_role() NOT IN ('admin', 'super_admin')) THEN
       IF NEW.id <> OLD.id OR NEW.profile_id <> OLD.profile_id THEN
         RAISE EXCEPTION 'Cannot modify vendor identity fields.';
       END IF;
       IF NEW.is_active <> OLD.is_active THEN
         RAISE EXCEPTION 'Vendors cannot alter their own active status.';
       END IF;
       IF NEW.rating IS DISTINCT FROM OLD.rating THEN
         RAISE EXCEPTION 'Vendors cannot alter their own rating.';
       END IF;
     END IF;
     RETURN NEW;
   END;
   $$;

   DROP TRIGGER IF EXISTS trg_protect_vendor_fields ON public.vendors;
   CREATE TRIGGER trg_protect_vendor_fields
     BEFORE UPDATE ON public.vendors
     FOR EACH ROW
     EXECUTE FUNCTION public.prevent_vendor_immutable_field_change();
   ```

---

## 3. Component Hierarchy & Navigation

### Vendor Dashboard Layout (`/vendor/*`)
- Sidebar (Desktop) / Mobile Drawer (Mobile) with KingdomDash branding and role indicator.
- Navigation items:
  1. `Overview` (`/vendor` or `/vendor/overview`)
  2. `Products` (`/vendor/products`)
  3. `Categories` (`/vendor/categories`)
  4. `Business Profile` (`/vendor/profile`)
- Header with vendor business name, status badge (`Active` or `Under Review`), and quick sign out / return home links.

### Vendor State Management (`useCurrentVendor`)
- Hook `useCurrentVendor()`:
  - Looks up vendor row by `profile.id` (`auth.uid()`).
  - Returns `{ vendor, isLoading, error, isPendingApproval, refreshVendor }`.
  - If user has role `'vendor'` but no row exists or status is pending, renders `VendorPendingView`.

### Product & Category Views
- `VendorOverviewTab`: High-level summary metrics, store link preview, quick CTA buttons.
- `VendorProductsTab`:
  - Search input & category filter pill-bar.
  - Availability filter (All, In Stock, Out of Stock).
  - Responsive table on desktop, cards on mobile.
  - In-place availability switch with optimistic UI and error rollback.
  - Modals: `AddProductModal`, `EditProductModal`, `DeleteProductDialog`.
- `VendorCategoriesTab`:
  - Categories list showing category name, description, active status, and product count.
  - In-place active toggle switch.
  - Modals: `AddCategoryModal`, `EditCategoryModal`, `DeleteCategoryDialog`.
- `VendorProfileTab`:
  - Business information display.
  - Editable form for phone, address, description, operating hours, service area.

---

## 4. Public Catalog Integration

### Service Pages (`/food` and `/groceries`)
- Integrated with `usePublicVendors(businessType: 'restaurant' | 'grocery_store')`.
- Displays active, approved vendors with business name, area, ETA, and tags.
- Links to `/food/:vendorId` and `/groceries/:storeId`.
- If no active vendors exist yet, displays a welcoming "Coming soon to Ijebu-Ode" state.

### Vendor Detail Pages (`/food/:vendorId` and `/groceries/:storeId`)
- Integrated with `usePublicVendorDetail(vendorId)`:
  - Fetches vendor details (verifying `is_active = true`).
  - Fetches available products (`is_available = true`).
  - Groups products by category if categories exist.
  - Displays formatted Nigerian Naira price (authoritative from DB).
  - Preserves WhatsApp ordering CTA with vendor name and product list enquiries.
- Mock catalog data in `src/data/mock-catalog.ts` is retained as a fallback fixture for offline testing, but production queries target Supabase.

---

## 5. Price & Data Security Guarantees
1. **Authoritative Database Pricing**:
   - `products.price` is defined as `numeric(12,2)` with `CHECK (price >= 0)`.
   - Prices can only be written by the owning vendor through validated Supabase mutations.
   - Public pages display the database price.
   - The ordering system in Phase 6 will re-fetch authoritative database prices, never trusting client calculations.
2. **Strict RLS Isolation**:
   - Every mutation checks that `vendor_id` belongs to `auth.uid()`.
   - The database trigger `validate_product_category_vendor` prevents linking a product to another vendor's category.
   - The database trigger `prevent_vendor_id_change` prevents stealing or moving products/categories across vendors.
