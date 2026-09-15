# KINGDOMDASH — FINAL ARCHITECTURE

**Version:** 3.1  
**Date:** September 2, 2026  
**Status:** Updated - Pending Implementation Approval

---

# EXECUTIVE SUMMARY

KingdomDash is a Nigerian multi-service delivery platform (Food, Grocery, Courier) with online ordering, Paystack payments, and distance-based delivery pricing in V1. The platform includes internal operational systems for delivery management, rider assignment, and earnings tracking.

**V1 Core Features:**
- Online ordering with shopping cart
- Paystack payment integration
- Distance-based delivery pricing
- Maps/location services
- Full admin CRUD control
- User-friendly customer experience
- Multi-service support (Food, Grocery, Courier)

**Official Tagline:** SWIFT IN MOTION

---

# TECHNOLOGY STACK

## Frontend
- React + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- React Router
- Zustand (client state)
- TanStack Query (server state)
- Paystack Inline (frontend payment)
- Maps provider (Google Maps or Mapbox - provider-agnostic architecture)
- Checkout components
- Payment status display components

## Backend
- Supabase (PostgreSQL)
- Supabase Auth
- Supabase Storage
- Supabase Realtime (where useful)
- Supabase Edge Functions (for payment verification)

## Deployment
- Vercel (frontend)
- GitHub (source control)
- Zoho domain (existing)
- Paystack (payment processing)
- Maps provider (location services)

---

# V1 DATABASE SCHEMA

## Core Tables (25 total)

### User Management
- **profiles** - User profiles for all roles
- **vendor_applications** - Vendor registration (non-sensitive)
- **vendors** - Approved vendors (single table with business_type discriminator)
- **rider_applications** - Rider registration (non-sensitive)
- **rider_application_private** - Sensitive rider data (admin-only access)
- **riders** - Approved riders
- **addresses** - Customer saved addresses

### Orders & Payments
- **orders** - Customer orders (food, grocery, courier)
- **order_items** - Order line items
- **payments** - Paystack payment records
- **delivery_pricing_rules** - Configurable delivery pricing rules

### Fleet & Operations
- **vehicles** - Fleet vehicles (assigned_rider_id for current assignment)
- **deliveries** - Delivery records linked to orders
- **delivery_assignments** - Rider to delivery assignments
- **delivery_status_updates** - Delivery status audit trail
- **delivery_tracking** - Location tracking (basic, not live GPS)
- **rider_earnings** - Authoritative earnings records

### Content & Communication
- **categories** - Product categories
- **products** - Products/menu items
- **contact_messages** - Contact form submissions
- **notifications** - User notifications
- **notification_preferences** - User notification preferences per channel/category
- **service_areas** - Geographic service areas
- **audit_logs** - System audit trail

## Key Relationships

```
profiles (1) ─────── (1) vendors
profiles (1) ─────── (1) riders
profiles (1) ─────── (*) orders
vehicles (1) ─────── (1) riders (via assigned_rider_id)
vendors (1) ─────── (*) orders
orders (1) ─────── (*) order_items
orders (1) ─────── (1) payments
orders (1) ─────── (1) deliveries
deliveries (1) ─────── (*) delivery_assignments
delivery_assignments (1) ─────── (1) riders
delivery_assignments (1) ─────── (1) rider_earnings
```

## Business Rules

**Delivery Service Types:**
- `service_type = food` → vendor_id REQUIRED
- `service_type = grocery` → vendor_id REQUIRED
- `service_type = courier` → vendor_id must be NULL

**Distance-Based Pricing:**
- Delivery fee calculated based on distance between pickup and delivery locations
- Pricing rules configurable by admin via delivery_pricing_rules table
- Base fee + distance charge = delivery fee
- Pricing may vary by service type, location, vehicle type (future)
- Frontend displays calculated fee, but authoritative calculation validated server-side

**Payment Security:**
- Paystack secret key NEVER exposed in frontend
- Payment verification must happen server-side (Supabase edge functions or secure backend)
- Frontend uses Paystack public key for payment initialization
- Payment success must be verified via Paystack API before confirming order
- Database stores authoritative payment status

Enforced via database constraints and secure backend logic.

---

# SECURITY MODEL

## Security Hierarchy

**Database (RLS) > Backend (Supabase) > Frontend (Route Guards)**

Client-side route guards are UX improvements, NOT security boundaries. RLS is the primary security mechanism.

## RLS Policies

**rider_application_private table:** ONLY admins/super_admins can access. Applicants cannot query this table.

**orders table:**
- Customers: view own orders only
- Admins: view/create/update all
- Vendors: view own vendor orders only
- Riders: no direct access (via deliveries)

**payments table:**
- Customers: view own payments only
- Admins: view all
- Vendors: view payments for own orders only
- Frontend NEVER sees Paystack secret key

**deliveries table:**
- Admins: view/create/update
- Riders: view assigned only
- Vendors: view own deliveries only
- Customers: view own deliveries only

**delivery_assignments table:**
- Admins: view/create/update
- Riders: view own assignments only

**rider_earnings table:**
- Riders: view own earnings only
- Admins: view all

**vehicles table:**
- Admins: view/edit all
- Riders: view assigned vehicle only

**delivery_pricing_rules table:**
- Admins/Super Admins: view/edit only
- Other roles: read-only where appropriate

## Environment Variables

```bash
# .env (NEVER commit to Git)
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_WHATSAPP_BUSINESS_NUMBER=+234XXXXXXXXXX
VITE_PAYSTACK_PUBLIC_KEY=your_paystack_public_key

# Backend/Server-side (NEVER in frontend code)
PAYSTACK_SECRET_KEY=your_paystack_secret_key
MAPS_API_KEY=your_maps_provider_api_key

# .gitignore must include:
.env
.env.local
.env.*.local
```

Only `.env.example` is committed to Git.

**Critical:** Paystack secret key and Maps API key must NEVER be exposed in frontend code. Use Supabase edge functions or secure backend for sensitive operations.

---

# DELIVERY OPERATIONS FLOW

## V1 Flow

```
Customer
↓
Choose Service (Food/Grocery/Courier)
↓
Choose Vendor or Enter Courier Details
↓
Select Products or Package Details
↓
Select/Confirm Delivery Location
↓
Calculate Distance (Maps API)
↓
Calculate Delivery Fee (Pricing Rules)
↓
Review Order
↓
Checkout
↓
Paystack Payment
↓
Secure Payment Verification (Server-side)
↓
Order Confirmed
↓
Delivery Record Created
↓
Admin Assigns Rider
→ Rider Accepts Assignment
→ Rider Picks Up
→ Rider Delivers
→ Earnings Record Created
```

**WhatsApp Role:** WhatsApp remains available as a support/contact channel and fallback, but is no longer the primary ordering mechanism.

## Status Transitions

**Order Status:** pending → payment_pending → payment_processing → payment_confirmed → preparing → ready_for_pickup → picked_up → in_transit → delivered/cancelled

**Payment Status:** pending → processing → successful/failed/refunded

**Delivery Status:** pending → assigned → picked_up → in_transit → delivered/cancelled

**Assignment Status:** assigned → accepted/rejected → completed

**Rejection Flow:**
1. Admin assigns rider → assignment = assigned
2. Rider rejects → assignment = rejected
3. Admin assigns another rider
4. On completion → delivery.status = delivered, assignment.status = completed

---

# ROLE-BASED ACCESS CONTROL

## Roles
- Super Admin
- Admin
- Vendor
- Rider
- Customer

## Key Permissions

| Action | Super Admin | Admin | Vendor | Rider | Customer |
|--------|-------------|-------|--------|-------|----------|
| Create orders | ✓ | ✓ | ✗ | ✗ | ✓ |
| View all orders | ✓ | ✓ | ✗ | ✗ | ✗ |
| View own orders | ✗ | ✗ | ✓ (own) | ✗ | ✓ |
| Manage orders | ✓ | ✓ | ✓ (own) | ✗ | ✗ |
| Create deliveries | ✓ | ✓ | ✗ | ✗ | ✗ |
| Assign riders | ✓ | ✓ | ✗ | ✗ | ✗ |
| View own assignments | ✗ | ✗ | ✗ | ✓ | ✗ |
| Update delivery status | ✓ | ✓ | ✗ | ✓ (assigned) | ✗ |
| View own earnings | ✗ | ✗ | ✗ | ✓ | ✗ |
| Manage vehicles | ✓ | ✓ | ✗ | ✗ | ✗ |
| Access sensitive rider data | ✓ | ✓ | ✗ | ✗ | ✗ |
| Manage pricing rules | ✓ | ✓ | ✗ | ✗ | ✗ |
| View all payments | ✓ | ✓ | ✗ | ✗ | ✗ |
| Manage users | ✓ | ✓ | ✗ | ✗ | ✗ |
| Manage vendors | ✓ | ✓ | ✗ | ✗ | ✗ |
| Manage riders | ✓ | ✓ | ✗ | ✗ | ✗ |
| Manage products | ✓ | ✓ | ✓ (own) | ✗ | ✗ |
| View audit logs | ✓ | ✗ | ✗ | ✗ | ✗ |

---

# FOLDER ARCHITECTURE

```
src/
├── app/                          # App-wide configuration
├── components/
│   ├── ui/                       # shadcn/ui components
│   ├── shared/                   # Shared components
│   ├── forms/                    # Reusable forms
│   └── layout/                   # Layout components
├── features/                     # Feature components (NO pages)
│   ├── auth/components/
│   ├── customers/components/
│   ├── vendors/components/
│   ├── riders/components/
│   ├── deliveries/components/
│   ├── fleet/components/
│   └── notifications/components/
├── pages/                        # ALL page components
│   ├── public/
│   ├── auth/
│   ├── customer/
│   ├── vendor/
│   ├── rider/
│   └── admin/
├── services/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── auth.ts
│   │   ├── profiles.ts
│   │   ├── vendors.ts
│   │   ├── riders.ts
│   │   ├── products.ts
│   │   ├── deliveries.ts
│   │   ├── vehicles.ts
│   │   └── admin.ts
│   └── whatsapp/
├── hooks/
├── stores/
├── types/
├── utils/
├── config/
└── styles/
```

**Key:** `features/` contains components only. `pages/` contains all route pages.

---

# ROUTE STRUCTURE

## Public Routes
- `/` - Home
- `/about` - About
- `/services` - Services overview
- `/food` - Food delivery
- `/food/:vendorId` - Restaurant detail
- `/groceries` - Grocery delivery
- `/groceries/:storeId` - Store detail
- `/courier` - Courier service
- `/contact` - Contact
- `/faq` - FAQ

## Auth Routes
- `/auth/login` - Login
- `/auth/register` - Register
- `/auth/forgot-password` - Forgot password

## Application Routes
- `/become-vendor` - Become a vendor
- `/become-rider` - Become a rider
- `/dashboard/*` - Customer dashboard (customer role)
- `/vendor/*` - Vendor dashboard (vendor role)
- `/rider/*` - Rider dashboard (rider role)
- `/admin/*` - Admin dashboard (admin/super_admin role)

## New Admin Routes
- `/admin/deliveries` - Delivery management
- `/admin/deliveries/:id` - Delivery detail
- `/admin/fleet` - Fleet/vehicle management
- `/admin/orders` - Order management
- `/admin/orders/:id` - Order detail
- `/admin/payments` - Payment management
- `/admin/pricing` - Delivery pricing rules management

---

# WHATSAPP INTEGRATION

## URL Format

```
https://wa.me/{number}?text={encoded_message}
```

**Number Format:** International format without + or spaces (e.g., 234XXXXXXXXXX)

## Configuration

```typescript
// config/app.config.ts
export const appConfig = {
  whatsapp: {
    businessNumber: import.meta.env.VITE_WHATSAPP_BUSINESS_NUMBER,
  },
};

// utils/whatsapp.ts
export const generateWhatsAppLink = (message: string): string => {
  const encodedMessage = encodeURIComponent(message);
  const cleanNumber = appConfig.whatsapp.businessNumber.replace(/[\s+]/g, '');
  return `https://wa.me/${cleanNumber}?text=${encodedMessage}`;
};
```

---

# PAYSTACK INTEGRATION ARCHITECTURE

## Security Model

**Frontend (Client-Side):**
- Uses Paystack public key only
- Initializes payment via Paystack Inline
- Receives payment reference/callback
- Shows payment status to user
- NEVER has access to Paystack secret key

**Backend (Server-Side):**
- Uses Paystack secret key (secure environment variable)
- Verifies payment via Paystack API
- Validates payment reference
- Updates authoritative payment status in database
- Prevents forged payment confirmations
- Implemented via Supabase Edge Functions or secure backend

**Database:**
- Stores authoritative payment records
- Stores payment status (pending, processing, successful, failed, refunded)
- Links payments to orders
- Never trusts frontend alone for payment success

## Payment Flow

```
Customer Checkout
↓
Frontend: Initialize Paystack Inline (public key)
↓
Customer completes payment
↓
Paystack returns payment reference
↓
Frontend: Send reference to backend
↓
Backend: Verify payment with Paystack API (secret key)
↓
Backend: Update payment status in database
↓
Backend: Confirm order if payment successful
↓
Frontend: Show confirmation to customer
```

## Payment Security Rules

1. Paystack secret key NEVER in frontend code
2. Payment verification MUST happen server-side
3. Payment status validated via Paystack API
4. Database is source of truth for payment status
5. Frontend cannot directly mark payment as successful
6. Failed payments allow retry
7. Refunds handled via Paystack dashboard or secure backend

---

# MAPS & LOCATION ARCHITECTURE

## Provider Selection

Architecture is provider-agnostic to support:
- Google Maps Platform
- Mapbox

Provider selection can be configured without rebuilding entire system.

## Location Data

**Customer Location:**
- Selected via map interface
- Saved addresses from addresses table
- Current location (optional, with permission)

**Vendor Location:**
- Stored in vendors table
- Used for distance calculation

**Courier Locations:**
- Pickup location (customer or vendor)
- Destination location (delivery address)

## Distance Calculation

```
Pickup Location
↓
Destination Location
↓
Maps API Distance Calculation
↓
Distance (km/miles)
↓
Delivery Pricing Rules
↓
Delivery Fee
```

## Location Security

- Maps API key stored in server-side environment variable
- Frontend may use maps for display, but distance calculation validated server-side where possible
- Location data stored in database with appropriate RLS

## Future: Live GPS Tracking

Live GPS tracking remains deferred to future phase.
Current V1 supports:
- Basic location selection
- Distance calculation
- Delivery fee calculation
- NOT real-time rider tracking

---

# DISTANCE-BASED DELIVERY PRICING

## Pricing Architecture

**Configurable Rules:**
- Base delivery fee
- Distance-based charge (per km/mile)
- Service-type adjustments (food, grocery, courier)
- Location/service area adjustments
- Minimum delivery fee
- Maximum delivery fee (optional)

**Pricing Formula:**
```
Delivery Fee = Base Fee + (Distance × Distance Rate) + Adjustments
```

## Pricing Rules Table

**delivery_pricing_rules table stores:**
- service_type (food, grocery, courier, all)
- base_fee (numeric)
- distance_rate (per unit distance)
- min_fee (optional)
- max_fee (optional)
- service_area_id (optional, for area-specific pricing)
- is_active (boolean)
- effective_date
- expiry_date (optional)

## Pricing Calculation Flow

```
Customer selects locations
↓
Calculate distance (Maps API)
↓
Fetch applicable pricing rules
↓
Calculate delivery fee
↓
Display to customer (frontend)
↓
Customer confirms order
↓
Server validates calculation
↓
Store final fee with order
```

## Admin Control

Admins can:
- Create pricing rules
- Update pricing rules
- Activate/deactivate rules
- Set effective dates
- Configure service-area-specific pricing

Pricing changes do not require frontend redeployment.

---

# EXPLICITLY DEFERRED (NOT V1)

## Customer-Facing
- Customer order history (depends on website-based ordering)
- Live GPS tracking (future - not V1)
- Customer live delivery tracking (future)
- Automated dispatch algorithms (future)
- Route optimization (future)
- Real-time delivery tracking for customers (future)
- Automated WhatsApp order creation (future - WhatsApp is fallback, not primary)
- Customer reviews
- Vendor ratings
- Rider ratings
- Promotional campaigns
- Discount codes
- Rewards system

## Operational
- Automated dispatch algorithms
- Route optimization
- Real-time delivery tracking for customers
- Automated WhatsApp order creation

## Authentication
- Google OAuth
- Apple OAuth
- Phone authentication
- Two-factor authentication (2FA)

## Engagement
- Customer reviews
- Vendor ratings
- Rider ratings
- Promotional campaigns
- Discount codes
- Rewards system

## Infrastructure
- Mobile applications (iOS/Android)
- Vendor mobile app
- Rider mobile app
- Separate backend API server
- Webhooks for third-party integrations

---

# IMPLEMENTATION PHASES

## Recommended Build Order

1. **Phase 0:** Requirements & Architecture Update (✓ Complete)
2. **Phase 1:** Project Foundation & UI Design System
3. **Phase 2:** Supabase Backend & Database
4. **Phase 3:** Authentication & RBAC
5. **Phase 4:** Public Website
6. **Phase 5:** Vendor & Product System
7. **Phase 6:** Customer Ordering & Cart
8. **Phase 7:** Maps & Location Services
9. **Phase 8:** Distance-Based Delivery Pricing
10. **Phase 9:** Paystack Integration
11. **Phase 10:** Order & Delivery Operations
12. **Phase 11:** Rider Platform
13. **Phase 12:** Admin Control Center
14. **Phase 13:** Notifications & Supporting Systems
15. **Phase 14:** Testing & Security
16. **Phase 15:** Deployment & Production Configuration
17. **Phase 16:** Launch & Monitoring
18. **Phase 17:** Future Enhancements

---

# DEVELOPMENT RULES

1. Do not build features not approved in this architecture
2. Do not introduce unnecessary dependencies
3. Do not duplicate business logic across components
4. Keep business logic separate from presentation
5. Use TypeScript properly - avoid `any` unless documented
6. Never expose secrets in frontend code
7. Never expose Supabase service-role keys
8. Never expose Paystack secret key in frontend
9. Use RLS for database security (PRIMARY security mechanism)
10. Validate user input on both client and server
11. Make website responsive from the beginning
12. Do not hard-code business-critical configuration
13. Keep WhatsApp configuration centralized
14. Keep future features clearly separated from V1
15. Paystack integration is V1 - follow security architecture
16. Maps/location services are V1 - follow provider-agnostic architecture
17. Distance-based pricing is V1 - use configurable rules
18. Online ordering flow is V1 with Paystack payment
19. Do not implement live GPS tracking in V1
20. Do not replace existing Zoho domain
21. Keep architecture scalable but avoid overengineering
21. Before major architectural changes, update development plan
22. Write tests for critical functionality
23. Follow established folder structure
24. Use environment variables for all configuration
25. Implement proper error handling
26. Use semantic HTML
27. Follow accessibility best practices
28. Optimize images and assets
29. Use proper Git commit messages
30. Create meaningful pull requests
31. Document complex logic
32. Keep dependencies updated

---

# CRITICAL ARCHITECTURAL DECISIONS

## Vehicle Relationship
- Use `vehicles.assigned_rider_id` for current rider assignment
- Do NOT add `riders.current_vehicle_id` (no bidirectional FK)

## Sensitive Rider Data
- Split into `rider_applications` (non-sensitive) and `rider_application_private` (admin-only)
- Applicants cannot query `rider_application_private`
- Sensitive data never appears in public queries or components

## GPS Location
- Basic location tracking in V1 (delivery_tracking table)
- No live GPS tracking in V1
- Future live GPS will use enhanced delivery_tracking

## Vendor Model
- Single `vendors` table with `business_type` discriminator
- No separate `restaurants` or `grocery_stores` tables

## Earnings
- Authoritative record is `rider_earnings` table
- No manual `riders.total_earnings` field
- Earnings calculated from `rider_earnings` records

## Security Boundary
- RLS is the PRIMARY security mechanism
- Client-side route guards are UX only
- All authorization enforced at database level

## Paystack Security
- Paystack secret key NEVER in frontend code
- Payment verification MUST happen server-side
- Database is source of truth for payment status
- Frontend uses Paystack public key only

## Maps Provider
- Architecture is provider-agnostic (Google Maps or Mapbox)
- Provider can be configured without system rebuild
- Maps API key stored server-side

## Delivery Pricing
- Distance-based pricing is V1 requirement
- Pricing rules configurable by admin
- Authoritative calculation validated server-side
- Frontend displays calculated fee but does not determine final fee

## Admin Control
- Admin has full CRUD control over platform entities
- All admin permissions enforced via RLS
- Admin actions audited where appropriate
- "Full control" does not mean unrestricted database access

## Notifications & Supporting Systems (Phase 13)
- Event-driven notifications via database triggers (`trg_order_notification_lifecycle`, `trg_delivery_assignment_notification`, `trg_rider_application_notification`, `trg_vendor_application_notification`)
- SECURITY DEFINER `emit_notification()` with mandatory transactional enforcement (order, delivery, payment updates cannot be opted out)
- Deterministic idempotency key enforcement via `uq_notifications_profile_idempotency` preventing duplicate alert storms
- Separation of visual severity `type` (`info`, `success`, `warning`, `error`) and business domain `category` (`order`, `delivery`, `payment`, `application`, `system`, `promotional`)
- Realtime push via Supabase Realtime channel subscription with granular filters (`profile_id=eq.{user_id}`)
- Atomic RPC operations: `mark_all_notifications_read()`, `clear_read_notifications()`, `get_unread_notification_count()`

---

# AUTHORITY

This document is the authoritative architecture for KingdomDash V1 implementation.

**Document Version:** 3.1  
**Date:** September 2, 2026  
**Status:** Updated - Pending Implementation Approval

All development decisions must reference this architecture. Any changes require documented approval and update to both this document and the full development plan.
