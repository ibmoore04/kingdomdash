# KINGDOMDASH — UI/UX ELEVATION ROADMAP (PHASES 1–5)

**Version:** 1.0  
**Date:** October 2026  
**Status:** Approved for Implementation  
**Design Reference:** Inspired by Chowdeck, Uber Eats, and DoorDash usability patterns while adhering strictly to KingdomDash Brand Identity (`#FF0000` Brand Red, `#0A0A0A` Authority Black, Clean White Surfaces).

---

## Executive Overview

The KingdomDash platform is functionally complete across all 14 core phases. This roadmap specifies 5 strategic UI/UX phases designed to elevate the visual aesthetic, tactile responsiveness, and mobile-first delight from standard e-commerce to a **world-class, high-conversion delivery application**.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       UI ELEVATION ARCHITECTURE                            │
├───────────────┬───────────────┬───────────────┬──────────────┬──────────────┤
│    PHASE 1    │    PHASE 2    │    PHASE 3    │   PHASE 4    │   PHASE 5    │
│ Catalog &     │ Live Delivery │ Cart Delight  │ Zero-CLS     │ Mobile       │
│ Discovery     │ Radar & PIN   │ & Loyalty     │ Shimmer      │ Bottom       │
│ Steppers      │ Security Pass │ Gamification  │ Skeletons    │ Sheets & Bar │
└───────────────┴───────────────┴───────────────┴──────────────┴──────────────┘
```

---

## Phase 1: Catalog & Menu Browsing Experience

### Objective
Eliminate redundant navigation steps when ordering food and groceries by providing inline cart manipulation and rapid category filtering.

### 1.1 "Quick Add" Inline Quantity Steppers
* **Component:** `src/components/food/product-card.tsx` / `src/components/groceries/grocery-card.tsx`
* **Interaction Flow:**
  1. Default State: Clean, compact button labeled `+ Add` with a subtle red border and soft background (`bg-red-50 text-primary hover:bg-primary hover:text-white`).
  2. Active Cart State: When the product is in `useCartStore`, the button morphs smoothly into a pill stepper:
     ```
     [ − ]   1   [ + ]
     ```
  3. Micro-Interactions:
     * Tapping `+` increments quantity and fires a haptic scale bounce (`scale-110` -> `scale-100` in 150ms).
     * Tapping `−` decrements; upon reaching 0, the stepper cleanly collapses back into the `+ Add` button.
     * Vendor Conflict Guard: If customer attempts to add an item from a second vendor, trigger the existing `VendorConflictModal` seamlessly before modifying the stepper.

### 1.2 Sticky Category Navigation Rail
* **Component:** `src/components/catalog/sticky-category-rail.tsx`
* **Placement:** Top of [`/food`](file:///c:/Users/USER/KindomDash/src/pages/public/food.tsx), [`/groceries`](file:///c:/Users/USER/KindomDash/src/pages/public/groceries.tsx), and vendor detail pages.
* **Behaviors:**
  * Becomes `sticky top-[64px]` when scrolled past the hero banner.
  * Horizontally scrollable on mobile with hidden scrollbars (`no-scrollbar`) and smooth momentum scrolling.
  * Active pill indicator has high contrast: `bg-[#111111] text-white shadow-sm` with active badge count.

### 1.3 Card Micro-Interactions & Visual Depth
* Image zoom on hover (`group-hover:scale-105 transition-transform duration-300`).
* Live status badges:
  * Open / Closed status pill with pulsating dot indicator (green for open, amber for closing soon).
  * Prep time badge: `Clock` icon with `"20–30 mins"`.

---

## Phase 2: Live Order Tracking Radar & PIN Security Pass

### Objective
Turn the post-checkout waiting period into an engaging, transparent visual experience that builds absolute customer trust and eliminates delivery friction.

### 2.1 Animated Order Handover Radar
* **Component:** `src/components/order/delivery-radar.tsx`
* **Location:** [`src/pages/customer/order-confirmation.tsx`](file:///c:/Users/USER/KindomDash/src/pages/customer/order-confirmation.tsx) & [`src/pages/dashboard/customer-dashboard.tsx`](file:///c:/Users/USER/KindomDash/src/pages/dashboard/customer-dashboard.tsx)
* **Visual Structure:**
  ```
  [1. Confirmed] ══════ [2. Preparing] ══════ [3. On the Way] ══════ [4. Arrived]
        ✓                    ✓                     ⦿ (Pulsing)           ○
  ```
* **Key Features:**
  * Animated gradient trail connecting completed steps to the in-progress step.
  * Active step has a glowing halo ring using KingdomDash Brand Red (`box-shadow: 0 0 0 6px rgba(229, 9, 20, 0.15)`).
  * Live status pill dynamically adapts:
    * `"Restaurant is boxing your meal..."`
    * `"Rider is en route to your doorstep..."`

### 2.2 6-Digit Delivery PIN "Security Pass" Card
* **Component:** `src/components/order/delivery-pin-card.tsx`
* **Design Specifications:**
  * High-contrast dark badge (`bg-[#0A0A0A] text-white border border-neutral-800 rounded-2xl p-5 shadow-lg`).
  * Giant monospaced PIN display:
    ```
    ┌──────────────────────────────────────────────┐
    │  🔒 DELIVERY VERIFICATION PIN                │
    │                                              │
    │             8  4  2  9  1  0                 │
    │                                              │
    │  [ 📋 Copy PIN ]     Give this code to your  │
    │                      rider upon handover.    │
    └──────────────────────────────────────────────┘
    ```
  * One-tap copy button with instant checkmark feedback (`Copied!`).
  * Security explainer: *"Never disclose this PIN over the phone. Hand it over only when inspecting your package."*

---

## Phase 3: Cart Drawer Delight & Rewards Gamification

### Objective
Enhance checkout conversion, reward average order value (AOV), and provide tactile satisfaction during basket building.

### 3.1 Loyalty & Milestone Progress Meter
* **Component:** `src/components/cart/cart-milestone-meter.tsx`
* **Location:** Inside [`src/components/cart/cart-drawer.tsx`](file:///c:/Users/USER/KindomDash/src/components/cart/cart-drawer.tsx) & [`src/pages/public/cart.tsx`](file:///c:/Users/USER/KindomDash/src/pages/public/cart.tsx).
* **Functionality:**
  * Calculates distance to next tier:
    * *"Add ₦1,400 more to earn 150 KingdomDash Loyalty Points!"*
  * Dynamic percentage fill bar in brand red gradient with confetti micro-animation upon threshold completion.

### 3.2 Cart Trigger Spring Animation
* Whenever `useCartStore.getState().addItem()` fires:
  * Header cart icon and mobile bottom nav trigger a spring physics bounce (`keyframes: 0% scale(1), 50% scale(1.3), 100% scale(1)`).
  * Floating badge increments with a smooth counter transition.

### 3.3 Transparent Cost & Distance Accordion
* An expandable fees summary on checkout:
  * Meal / Item Subtotal
  * Distance-Based Delivery Fee (`Haversine straight-line tier preview with mileage tag: e.g. 3.2 km`)
  * Service Fee
  * Total Payable in Nigerian Naira (₦).

---

## Phase 4: Zero Layout Shift & Shimmer Skeleton Design System

### Objective
Eliminate jarring spinners and layout shifts (CLS), ensuring smooth transitions on both fast Wi-Fi and 3G/4G mobile networks across Nigeria.

### 4.1 Shimmer Animation Engine
* **Token:** Tailwind `animate-shimmer` with CSS gradient mask:
  ```css
  background: linear-gradient(90deg, #f0f0f0 25%, #f8f8f8 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  ```

### 4.2 Skeleton Suite Components
1. `src/components/ui/skeletons/vendor-card-skeleton.tsx`:
   * Aspect 16:9 banner placeholder, circular logo badge cutout, title, rating chip, and tags.
2. `src/components/ui/skeletons/product-card-skeleton.tsx`:
   * Square/rectangular product image box, 2-line title placeholder, price chip, and button outline.
3. `src/components/ui/skeletons/order-tracking-skeleton.tsx`:
   * Progress timeline track with pulse dots and address card lines.

---

## Phase 5: Mobile Ergonomics & Native-Feeling Bottom Sheets

### Objective
Optimize mobile navigation for one-handed thumb interaction on mobile devices (over 80% of Nigerian delivery traffic).

### 5.1 Thumb-Zone Bottom Sheets
* **Component:** `src/components/ui/bottom-sheet.tsx`
* **Usage:** Replace centered desktop modals on mobile viewports for:
  * Delivery Address Selection & New Address Form
  * Order Review & Cancellation Modals
  * Vendor Conflict Prompts
* **Features:**
  * Pull-down dismiss drag handle.
  * Backdrop blur (`backdrop-blur-sm bg-black/60`).
  * Keyboard-aware positioning for inputs.

### 5.2 Floating Mobile Checkout Bar
* **Component:** `src/components/cart/floating-cart-bar.tsx`
* **Behavior:**
  * Appears automatically on mobile whenever `items.length > 0` and user is on a catalog or restaurant page.
  * Stays anchored above the bottom navigation bar:
    ```
    ┌──────────────────────────────────────────────┐
    │  🛍️ 3 Items  •  ₦6,450       View Cart ➔   │
    └──────────────────────────────────────────────┘
    ```
  * Tapping expands the cart drawer or navigates directly to [`/checkout`](file:///c:/Users/USER/KindomDash/src/pages/customer/checkout.tsx).

---

## Implementation Order & Task Breakdown

| Phase | Core Deliverables | Target Files |
| :--- | :--- | :--- |
| **Phase 1** | Quick-add steppers, sticky category rail, card hover zoom | `src/components/food/`, `src/pages/public/food.tsx`, `src/pages/public/groceries.tsx` |
| **Phase 2** | 4-stage delivery radar, glowing active halo, 6-digit PIN pass card | `src/pages/customer/order-confirmation.tsx`, `src/components/customer/` |
| **Phase 3** | Loyalty threshold meter, cart bounce spring animation, fee accordion | `src/components/cart/cart-drawer.tsx`, `src/pages/public/cart.tsx` |
| **Phase 4** | Shimmer skeleton cards for vendors, food, groceries, orders | `src/components/ui/skeletons/`, catalog pages |
| **Phase 5** | Mobile bottom sheets, floating bottom checkout bar | `src/components/ui/bottom-sheet.tsx`, `src/components/layout/` |

---

## Verification & Quality Gates

Every phase must pass:
1. `npx tsc --noEmit` with **0 type errors**.
2. Automated Vitest suite testing component interactions and store updates.
3. Mobile viewport responsiveness (tested down to 360px viewport width).
4. Accessibility: WCAG AA contrast standards, keyboard accessible, `aria-live` for steppers and counters.
5. Dual-directory synchronization (`src` $\rightarrow$ `FRONTEND/src`).
