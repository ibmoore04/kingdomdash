# KINGDOMDASH — PHASE 6 REQUIREMENTS SPECIFICATION
## Customer Ordering & Cart System

**Document Version:** 1.1.0  
**Status:** READY FOR IMPLEMENTATION REVIEW  
**Platform:** KingdomDash (Launch Market: Ijebu-Ode, Ogun State)  
**Tagline:** SWIFT IN MOTION.  
**Author:** Antigravity  

---

## 1. Executive Summary & Objectives

### 1.1 Primary Objective
The objective of **Phase 6 — Customer Ordering & Cart** is to establish the end-to-end customer purchasing lifecycle on KingdomDash:
$$\text{Public Catalog} \longrightarrow \text{Product Selection} \longrightarrow \text{Cart Management} \longrightarrow \text{Delivery Address Selection} \longrightarrow \text{Order Review} \longrightarrow \text{Secure Order Creation} \longrightarrow \text{Order Confirmation}$$

Phase 6 links the completed live catalog from Phase 5 (vendors, categories, products) to the existing database-level ordering security boundary (`create_order_secure()` RPC and PostgreSQL RLS).

### 1.2 Core Security Philosophy
- **Zero Client Financial Authority:** The browser/client is NEVER authoritative for unit price, line total, subtotal, delivery fee, or grand total. All frontend totals are for display and user guidance only.
- **Authoritative Database Snapshotting:** Product availability, prices, vendor status, and constraints are resolved atomically in PostgreSQL at the moment of order placement.
- **Atomicity:** Order creation is strictly all-or-nothing via the transactional `create_order_secure()` RPC.
- **Explicit Least Privilege:** Orders cannot be created via direct table `INSERT`. Unauthenticated and unauthorized users cannot access customer addresses or private orders.

---

## 2. Scope & Phase Boundaries

### 2.1 In-Scope (Phase 6)
1. **Client-Side Cart Store & State:**
   - Zustand store (`useCartStore`) with `localStorage` persistence.
   - Add product, increment/decrement quantity, remove item, clear cart.
   - Dynamic item counts and display-only subtotal calculation.
2. **Product-to-Cart Integration:**
   - Wiring the `+` button in `ProductCard` across Food Detail (`/food/:vendorId`) and Grocery Detail (`/grocery/:storeId`).
   - Visual feedback (badge count in Navbar, toast notifications, slide-over drawer).
3. **Vendor Consistency Rule Enforcement:**
   - Single-vendor-per-cart constraint.
   - Clear confirmation dialog when attempting to add an item from a different vendor.
4. **Cart Validation & Stale Data Handling:**
   - Verification of product availability and vendor status prior to checkout.
   - Graceful removal or error signaling for deactivated/deleted items.
5. **Customer Delivery Address Management:**
   - Fetching customer's saved addresses (`public.addresses`).
   - Selecting a delivery address for order destination.
   - Creating/editing delivery addresses directly from checkout.
   - Default address selection behavior.
6. **Checkout & Order Review Page:**
   - Detailed breakdown: vendor details, item lines, quantities, prices, subtotal, delivery address, special instructions (optional, max 500 chars).
   - Delivery fee representation (₦0.00 Phase 6 preview placeholder with explicit note that distance pricing will be calculated in Phase 8).
7. **Secure Order Creation:**
   - Invocation of `create_order_secure()` RPC with caller identity derived from `auth.uid()`.
   - Handling database validation errors (item unavailable, vendor closed, invalid quantity).
   - Idempotency / duplicate submission protection on checkout CTA.
8. **Order Confirmation Experience:**
   - Dedicated confirmation page (`/order/:orderId/confirmation`).
   - Displaying order reference, status badge (`pending`), delivery address, items snapshot, and next-step guides.
   - Clearing the cart upon verified order creation.
9. **Automated Testing Suite:**
   - Unit tests for cart store and address services.
   - Integration tests for cart drawer, checkout flow, address modal, and confirmation view.
   - Security tests verifying cross-user address isolation and direct INSERT prevention.

### 2.2 Out-of-Scope (Strict Phase Boundaries)
The following features are **explicitly excluded** from Phase 6 and deferred to their designated phases:
- **Paystack Payment Gateway Integration:** (Phase 9)
- **Paystack Webhook & Payment Verification:** (Phase 9)
- **Google/Mapbox Maps Integration & Geocoding:** (Phase 7)
- **Distance Calculation & Distance-Based Delivery Pricing:** (Phase 8)
- **Rider Dispatch, Matching, & Assignment:** (Phase 10 & 11)
- **Live Order Tracking via WebSockets/Realtime:** (Phase 10 & 11)
- **Vendor Order Acceptance/Preparation Workflow:** (Phase 10 & 12)
- **Admin Order Modification & Cancellation Center:** (Phase 12)
- **Courier Dispatch Order Flow:** (Dedicated courier workflow)

---

## 3. User Stories

| ID | As a... | I want to... | So that... |
| :--- | :--- | :--- | :--- |
| **US-1** | Visitor / Customer | Browse restaurant and grocery menus and add available items to my cart | I can select meals or groceries I wish to order. |
| **US-2** | Customer | View a cart drawer or cart page showing my selected items, quantities, and display subtotal | I can review what I have chosen before purchasing. |
| **US-3** | Customer | Increase, decrease, or remove items in my cart | I can adjust quantities to fit my appetite or budget. |
| **US-4** | Customer | Be warned if I attempt to add an item from a different vendor | I understand that orders are prepared and delivered by one vendor at a time. |
| **US-5** | Customer | Select a saved delivery address or enter a new address in Ijebu-Ode | KingdomDash riders know exactly where to deliver my order. |
| **US-6** | Customer | Add special delivery instructions (e.g., "Leave at security gate") | The vendor and rider have necessary preparation/delivery notes. |
| **US-7** | Customer | Place my order with a single click and have it securely recorded in the database | My order is confirmed with guaranteed prices and no tampering. |
| **US-8** | Customer | View an order confirmation screen with my order ID and details | I have immediate proof and reference for my placed order. |
| **US-9** | Unauthenticated User | Add items to cart while browsing as a guest | I don't face friction before deciding what to eat. |
| **US-10**| Unauthenticated User | Be prompted to log in or register when proceeding to checkout | My order and delivery address are safely tied to my personal account. |

---

## 4. Functional Requirements

### 4.1 Cart & State Management
- **FR-1.1:** Cart state must be managed via a client-side store (`useCartStore`) backed by `localStorage` persistence.
- **FR-1.2:** Each cart item must store:
  - `productId`: UUID
  - `vendorId`: UUID
  - `serviceType`: `'food' | 'grocery'`
  - `name`: string
  - `price`: number (display only)
  - `quantity`: integer (1 to 999)
  - `imageUrl`: string | null
- **FR-1.3:** The cart must track `vendorId` and `vendorName` for the current active cart.
- **FR-1.4:** Adding a product from the current vendor must increment its quantity if already present, or add a new line if not present.
- **FR-1.5:** Quantity controls (`+` and `-`) must enforce integer values between 1 and 999. Reducing quantity to 0 removes the item. This mirrors the **database-enforced constraint** in `create_order_secure()`.
- **FR-1.6:** Total distinct product lines in cart must not exceed 50 items. This mirrors the **database-enforced constraint** in `create_order_secure()`.

### 4.2 Vendor Consistency Rule
- **FR-2.1:** A cart can only contain products from a **single vendor**.
- **FR-2.2:** If a user attempts to add an item from Vendor B while having items from Vendor A in the cart, the application must display a modal dialog:
  - Header: *"Start a new cart?"*
  - Body: *"Your cart already contains items from **[Vendor A]**. Would you like to clear your cart and add items from **[Vendor B]** instead?"*
  - Actions: `Cancel` (retains existing cart) and `Start New Cart` (clears existing items and adds new product).

### 4.3 Navigation & Cart Access
- **FR-3.1:** The Navbar must display a Cart button with a dynamic badge showing the total count of items in the cart.
- **FR-3.2:** Clicking the Cart button must open a slide-over Cart Drawer (accessible from any public page).
- **FR-3.3:** The Cart Drawer must provide a direct "Proceed to Checkout" button.
- **FR-3.4:** A standalone `/cart` route must also be provided for full-page cart management and mobile web accessibility.

### 4.4 Delivery Address Management
- **FR-4.1:** Customers must be able to view their saved addresses from `public.addresses` (created in `20260902000004_create_orders.sql`, protected by `addresses_all_own` in `20260902000011_create_rls_policies.sql`).
- **FR-4.2:** Customers must be able to create a new delivery address containing:
  - `recipient_name`: string (required)
  - `phone`: string (required, validated for Nigerian mobile formats)
  - `address_line_1`: string (required, street address)
  - `address_line_2`: string (optional, apartment/landmark)
  - `city`: string (defaults to "Ijebu-Ode")
  - `state`: string (defaults to "Ogun State")
  - `label`: string (e.g., "Home", "Office", "Hostel")
  - `is_default`: boolean
- **FR-4.3:** If a customer has a default address, it must be pre-selected on checkout.
- **FR-4.4:** If no addresses exist, the checkout page must present an inline "Add Delivery Address" form.

### 4.5 Checkout & Order Review
- **FR-5.1:** The checkout route (`/checkout`) must be protected by `RouteGuard` allowing only authenticated `customer` users.
- **FR-5.2:** Unauthenticated users attempting to access `/checkout` must be redirected to `/auth/login?redirect=/checkout`.
- **FR-5.3:** If the cart is empty, `/checkout` must display an empty state with a link back to `/food` or `/groceries`.
- **FR-5.4:** The review page must display:
  - Vendor name, service type, and pickup location.
  - Selected delivery address with recipient name and phone.
  - Itemized table of dishes/products with unit price and line total.
  - Subtotal (estimated from client, confirmed by DB).
  - Delivery fee representation: displayed as `₦0.00 (Launch Preview)` accompanied by explicit messaging: *"Delivery fee will be calculated based on distance in Phase 8. For this launch preview, base delivery fee is set to ₦0.00."*
  - Special instructions textarea (max 500 characters, matching RPC truncation).
- **FR-5.5:** The "Place Order" button must be disabled during submission, preventing double-clicks.

### 4.6 Secure Order Creation & Confirmation
- **FR-6.1:** When submitting an order, the client calls `createOrderSecure` RPC (`public.create_order_secure` in `20260902000015_remaining_medium_fixes.sql`) passing:
  - `p_vendor_id`: UUID
  - `p_service_type`: `'food'` or `'grocery'`
  - `p_pickup_address`: vendor's registered business address
  - `p_delivery_address`: compiled full address string
  - `p_items`: array of `{ product_id: string, quantity: number }`
  - `p_special_instructions`: string | null
- **FR-6.2:** The server returns `order_id` (UUID) on success.
- **FR-6.3:** Upon receiving `order_id`, the client clears the cart store and navigates to `/order/:orderId/confirmation`.
- **FR-6.4:** The confirmation page fetches the created order via `getOrderById(orderId)` and displays ONLY confirmed information:
  - Order reference number (UUID / short reference).
  - Order status badge (`pending`).
  - Itemized receipt with authoritative prices from `order_items`.
  - Delivery address recorded on the order.
  - Informational note: *"Your order has been recorded in the KingdomDash system. Online payment (Paystack) and delivery tracking will be connected in upcoming releases."*

---

## 5. Non-Functional Requirements

- **NFR-1 (Performance):** Cart operations (add, remove, change quantity) must update UI instantly (< 16ms) without network latency.
- **NFR-2 (Accessibility):** All cart and checkout interactive elements (modals, quantity counters, address selectors) must have proper ARIA attributes (`aria-label`, `role="dialog"`, keyboard accessibility).
- **NFR-3 (Mobile-First Responsiveness):** The ordering experience must be fully optimized for mobile devices (360px width upwards), including sticky bottom summary bars on mobile checkout.
- **NFR-4 (Resilience):** Persisted cart state must survive browser crashes and tab closures. Corrupted `localStorage` data must fail safely by resetting to an empty cart without crashing the app.

---

## 6. Security & Authorization Matrix

| Actor | Action | DB Mechanism | Policy / Constraint |
| :--- | :--- | :--- | :--- |
| **Anonymous** | Add items to client cart | Client-side only | Allowed in memory / localStorage |
| **Anonymous** | Access `/checkout` | Frontend RouteGuard | Redirected to `/auth/login` |
| **Anonymous** | Call `create_order_secure()` | DB RPC (`015`) | DENIED (`Not authenticated` exception) |
| **Customer A** | Select saved addresses | DB RLS (`011`) | ALLOWED (`addresses_all_own` where `profile_id = auth.uid()`) |
| **Customer A** | Select Customer B's addresses | DB RLS (`011`) | DENIED (0 rows returned) |
| **Customer A** | Create order for own account | DB RPC (`015`) | ALLOWED (`customer_id` bound to `auth.uid()`) |
| **Customer A** | Modify order prices in payload | DB RPC (`015`) | IMPOSSIBLE (RPC queries `products.price` directly) |
| **Customer A** | Direct INSERT into `orders` | DB RLS (`013`) | DENIED (Direct INSERT policy dropped in migration 013) |
| **Customer A** | Direct INSERT into `order_items`| DB RLS (`013`) | DENIED (Direct INSERT policy dropped in migration 013) |
| **Customer A** | View placed order | DB RLS (`011`) | ALLOWED (`orders_select_own_customer`) |
| **Customer A** | View Customer B's order | DB RLS (`011`) | DENIED (0 rows returned) |

---

## 7. Acceptance Criteria

1. **AC-1 (Catalog to Cart):** Clicking `+` on any available product on Food Detail or Grocery Detail adds the item to the cart and triggers a visual indicator.
2. **AC-2 (Cart Drawer & Badge):** The Navbar reflects the total item count accurately; clicking the cart icon opens the cart drawer with accurate item details.
3. **AC-3 (Single Vendor Enforcement):** Adding a product from Vendor B while cart has Vendor A items shows the replacement confirmation dialog. Choosing Cancel preserves Vendor A; choosing Confirm replaces cart with Vendor B.
4. **AC-4 (Address Flow):** Authenticated customer can view saved addresses, add a new address, and select an address during checkout.
5. **AC-5 (Price Tamper Immunity):** Tampering with client-side item prices or quantities in localStorage or network requests has zero effect on the created order; database snapshots current authoritative prices.
6. **AC-6 (Order Atomicity):** If any item in the cart is deactivated or belongs to another vendor at checkout time, the transaction aborts with a user-friendly error message, leaving no partial order.
7. **AC-7 (Confirmation & Cart Reset):** On successful order placement, the customer is routed to `/order/:orderId/confirmation`, the cart is emptied, and the order receipt matches database values.

---

## 8. Dependencies & Assumptions

- **Dependencies:**
  - Phase 3 Authentication (`useAuthStore`, `RouteGuard`, safe redirects).
  - Phase 5 Catalog Schema (`public.vendors`, `public.products`, `public.categories`).
  - Migration `20260902000015_remaining_medium_fixes.sql` `create_order_secure()` RPC.
- **Assumptions:**
  - Base delivery fee is recorded as `0` by `create_order_secure()` until Phase 8 activates server-calculated distance-based pricing.
  - Initial order status is `pending` until Phase 9 integrates Paystack payments.
