# KINGDOMDASH — DEVELOPMENT PLAN

**Version:** 2.1  
**Last Updated:** September 2, 2026  
**Status:** Architecture Updated - Pending Implementation

---

# TABLE OF CONTENTS

1. [Project Overview](#1-project-overview)
2. [V1 Business Decisions](#2-v1-business-decisions)
3. [Technology Stack](#3-technology-stack)
4. [Website Purpose](#4-website-purpose)
5. [Public Website Structure](#5-public-website-structure)
6. [Customer Account System](#6-customer-account-system)
7. [Vendor System](#7-vendor-system)
8. [Rider System](#8-rider-system)
9. [Admin System](#9-admin-system)
10. [Role-Based Access Control](#10-role-based-access-control)
11. [Database Planning](#11-database-planning)
12. [WhatsApp Ordering Architecture](#12-whatsapp-ordering-architecture)
13. [Security](#13-security)
14. [Development Phases](#14-development-phases)
15. [Project Folder Architecture](#15-project-folder-architecture)
16. [Route Structure](#16-route-structure)
17. [UI/UX Requirements](#17-uiux-requirements)
18. [Performance Strategy](#18-performance-strategy)
19. [Future-Proofing](#19-future-proofing)
20. [Implementation Tracker](#20-implementation-tracker)
21. [Development Rules](#21-development-rules)
22. [Build Order](#22-build-order)

---

# 1. PROJECT OVERVIEW

KingdomDash is a Nigerian multi-service delivery platform operating three customer-facing services:

1. **Food Delivery** — Restaurant meals delivery
2. **Grocery Delivery** — Grocery store items delivery
3. **Courier Dispatch** — Parcel and document delivery

The platform operates through a shared technology and logistics infrastructure with a network of delivery riders using both petrol-powered and electric motorcycles. The motorcycle fleet is internal delivery infrastructure, not a separate customer-facing service.

**Goal:** Create a professional, scalable web platform that allows customers to discover KingdomDash services while providing the KingdomDash team, vendors, and riders with the tools required to operate the business.

---

# 2. V1 BUSINESS DECISIONS

These decisions are binding for Version 1 and must be respected throughout development.

## Ordering

**Customers can now place and pay for orders directly through the website.**

**Website Requirements:**
- Online shopping cart
- Paystack payment integration
- Distance-based delivery pricing display
- Order confirmation
- Clear CTAs for both online ordering and WhatsApp support
- WhatsApp messages should be pre-filled with useful context as a fallback
- Example pre-filled message: "Hello KingdomDash, I would like to place an order from [Vendor Name]."
- WhatsApp number must be stored as configuration, not hard-coded

Orders may be initiated through the website or via WhatsApp as a fallback/support channel. WhatsApp must NOT replace website ordering as the primary mechanism.

## Payments

**Paystack integration is now part of V1.**

- Online checkout/payment gateway via Paystack is V1
- Architecture supports online payments, payment initialization, payment verification, transaction records, payment status, successful payments, failed payments, payment references, order/payment relationship, secure payment verification, and admin visibility into transactions
- The Paystack secret key must NEVER be exposed in frontend code
- Architecture specifies a secure backend/server-side verification approach via Supabase Edge Functions
- The frontend may use the Paystack public key where appropriate, but sensitive operations must happen securely
- Do not integrate Paystack in a way that exposes secret keys to the browser

## Domain

- KingdomDash domain already purchased through **Zoho**
- Website will be deployed to **Vercel**
- Do NOT plan for purchasing another domain

## Hosting

- **Frontend:** Vercel
- **Backend:** Supabase
- **Database:** PostgreSQL through Supabase

## Source Control

- **GitHub**

---

# 3. TECHNOLOGY STACK

## Frontend

- **React** — UI library
- **TypeScript** — Type safety
- **Vite** — Build tool and dev server
- **Tailwind CSS** — Styling
- **shadcn/ui** — Component library
- **React Router** — Client-side routing

## Application State

- **Zustand** — Client/global state where necessary
- **TanStack Query** — Server/data state management

## Backend

- **Supabase** — Backend-as-a-Service
- **PostgreSQL** — Database (via Supabase)
- **Supabase Auth** — Authentication
- **Supabase Storage** — File storage
- **Supabase Realtime** — Real-time subscriptions (where genuinely useful)
- **Database Functions/RPC** — Server-side logic where appropriate

## Maps

**Maps are now a V1 requirement.**

- The system must support location-aware delivery
- Maps/location are part of the delivery-pricing architecture
- The architecture should be provider-agnostic enough that the provider can be changed without rewriting the entire platform
- Options to consider: Google Maps Platform, Mapbox
- Do not hard-code the platform to one provider unless explicitly specified

The Development Plan should state that Maps/location services are a V1 requirement. The implementation should follow the provider-agnostic architecture, with the specific provider treated as an implementation decision.

V1 location functionality includes the requirements already defined by the Architecture and UI/UX documents.

## Deployment

- **GitHub** — Source control
- **Vercel** — Frontend hosting
- **Zoho** — Existing domain DNS

---

# 4. WEBSITE PURPOSE

The public KingdomDash website functions as:

- The company's official online presence
- A platform for discovering KingdomDash services
- A place where customers learn how services work
- A way for customers to access restaurants/grocery vendors
- A way to initiate orders through WhatsApp
- A platform for vendor recruitment
- A platform for rider recruitment
- A customer support/contact channel
- A platform for online ordering and payment (V1)

**Critical:** This is NOT a simple static business website. It must be architected as the foundation of a future multi-service delivery platform.

---

# 5. PUBLIC WEBSITE STRUCTURE

## Home

**Components:**
- Hero section with value proposition
- Service selection (Food, Grocery, Courier)
- Service highlights
- How KingdomDash Works section
- Why Choose KingdomDash section
- Vendor/rider recruitment CTAs
- Service coverage information
- Multiple call-to-action sections
- Footer

**Objective:** Immediately communicate that KingdomDash provides multiple delivery services through one platform, including online ordering and payment functionality.

## About

**Components:**
- Company story
- Mission statement
- Vision statement
- Core values
- What KingdomDash provides (Food Delivery, Grocery Delivery, Courier Dispatch with online ordering and payment)
- Logistics/delivery network overview
- Future growth vision

## Services

### Food Delivery Service Page

**Components:**
- Service explanation
- How customers discover food vendors
- How to initiate orders through WhatsApp
- Delivery areas
- Pricing information (if available)
- FAQ section specific to food delivery

### Grocery Delivery Service Page

**Components:**
- Service explanation
- How customers obtain groceries
- How to initiate orders through WhatsApp
- Delivery areas
- Available store types
- FAQ section specific to grocery delivery

### Courier Dispatch Service Page

**Components:**
- Service explanation
- Eligible delivery types (parcels, documents)
- Pickup/drop-back process
- How customers request a courier
- WhatsApp CTA
- Delivery areas
- Pricing information (if available)
- FAQ section specific to courier

**Note:** Courier supports online ordering with cart, checkout, and Paystack payment in V1. WhatsApp remains available as a fallback/support channel.

## Restaurants / Food Vendors

**Structure for future expansion:**
- Restaurant listing page
- Restaurant details page
- Menu/items presentation
- Opening status indicator
- Location/service area information
- WhatsApp ordering CTA

**V1 Implementation:**
- Restaurant listings with basic information
- Restaurant details with menu preview
- WhatsApp ordering CTAs
- WhatsApp remains available as a fallback/support channel

## Grocery Stores

**Structure for future expansion:**
- Grocery store listing page
- Store details page
- Products/categories presentation
- Availability information
- Location/service area information
- WhatsApp ordering CTA

**V1 Implementation:**
- Store listings with basic information
- Store details with product preview
- WhatsApp ordering CTAs
- WhatsApp remains available as a fallback/support channel

## Courier

**Dedicated courier service page:**
- What KingdomDash Courier does
- Eligible deliveries (parcels, documents, packages)
- Pickup/drop-off process
- How customers request a courier
- WhatsApp CTA with pre-filled message
- Service areas
- Estimated delivery times (if available)
- Pricing information (if available)

**V1 Implementation:**
- Informational page only
- V1 supports online courier ordering with cart, checkout, and Paystack payment

## Become a Vendor

**Vendor recruitment flow/page:**
- Benefits of joining KingdomDash
- Who can become a vendor (restaurants, grocery stores)
- Requirements for vendors
- Application process overview
- Vendor registration form
- Admin review process explanation
- FAQ for prospective vendors

**V1 Implementation:**
- Informational page with registration form
- Form data stored in Supabase for admin review
- No automatic approval

## Become a Rider

**Rider recruitment flow/page:**
- Rider benefits
- Requirements (license, vehicle, etc.)
- Petrol/electric fleet information
- Application form
- Rider approval process
- FAQ for prospective riders

**V1 Implementation:**
- Informational page with application form
- Form data stored in Supabase for admin review
- No automatic approval

## Contact

**Components:**
- Phone number
- WhatsApp number with CTA
- Email address
- Physical location/address
- Contact form
- Business hours
- Social media links
- Map (if implemented)

## FAQ

**Categories:**
- Food delivery questions
- Grocery delivery questions
- Courier dispatch questions
- WhatsApp ordering questions
- Delivery areas
- Vendor-related questions
- Rider-related questions
- Payments (future)
- Support questions

---

# 6. CUSTOMER ACCOUNT SYSTEM

A customer account system is planned for the platform foundation, supporting V1 website ordering and Paystack payments.

## Customer Dashboard Structure

```
Customer Dashboard
├── Overview
├── Profile
├── Saved Addresses
├── Order History
├── Service Activity
├── Notifications
└── Settings
```

## V1 Functionality

**Implemented in V1:**
- User registration and authentication
- Profile management (name, phone, email)
- Saved addresses
- Order history (V1 - records website-Placed orders with Paystack payment status)
- Basic notifications
- Settings (preferences, language, order history preferences)

**Deferred to Future Phases:**
- Advanced order tracking detailed views
- Loyalty points
- Reviews and ratings
- Promotional campaigns

---

# 7. VENDOR SYSTEM

KingdomDash supports vendors such as restaurants and grocery stores.

## Vendor Dashboard Structure

```
Vendor Dashboard
├── Overview
├── Business Profile
├── Products/Menu
├── Categories
├── Availability
├── Operating Hours
├── Service Area
├── Applications/Status
├── Notifications
└── Settings
```

## V1 Functionality

**Implemented in V1:**
- Vendor registration application
- Admin approval workflow
- Basic business profile
- Product/menu management (for display and order processing)
- Operating hours
- Availability status
- Service area definition
- Basic notifications
- Basic order management: New → Accepted/Rejected → Preparing → Ready for Pickup

**Deferred to Future Phases:**
- Order management analytics
- Inventory management
- Sales analytics
- Payout management
- Advanced reporting

---

# 8. RIDER SYSTEM

## Rider Dashboard Structure

```
Rider Dashboard
├── Overview
├── Availability
├── Assigned Deliveries
├── Delivery Status
├── Delivery History
├── Earnings
├── Vehicle
├── Profile
├── Notifications
└── Support
```

## Vehicle Types

**V1 Support:**
- Petrol-powered motorcycles
- Electric motorcycles

**Future Considerations:**
- Additional vehicle types
- Fleet management
- Vehicle maintenance tracking

## V1 Functionality

**Implemented in V1:**
- Rider application
- Admin approval workflow
- Rider profile
- Availability toggle
- Vehicle assignment (via vehicles table)
- Delivery assignment display
- Delivery status updates
- Earnings history (from rider_earnings table)
- Notifications

**Deferred to Future Phases:**
- Live GPS tracking
- Automated dispatch
- Advanced earnings analytics
- Route optimization
- Vehicle maintenance scheduling

---

# 9. ADMIN SYSTEM

## Admin Dashboard Structure

```
Admin Dashboard
├── Overview
├── Customers
├── Vendors
├── Vendor Applications
├── Riders
├── Rider Applications
├── Deliveries
├── Services
├── Restaurants
├── Grocery Stores
├── Products/Menu
├── Fleet
├── Contact Messages
├── Support
├── Notifications
├── Reports
├── Settings
└── Audit Logs
```

## V1 Functionality

**Implemented in V1:**
- Overview dashboard with key metrics
- Customer management (view, basic edit)
- Vendor management (view, approve/reject applications)
- Rider management (view, approve/reject applications)
- Delivery creation from WhatsApp orders
- Delivery assignment to riders
- Delivery status management
- Restaurant management
- Grocery store management
- Product/menu management
- Fleet/vehicle management
- Rider earnings overview
- Contact message management
- Basic reports
- System settings
- Audit logs

**Deferred to Future Phases:**
- Advanced analytics
- Automated dispatch
- Live tracking
- Financial reporting
- Payout management

## Admin Roles

**Super Admin:**
- Full system access
- Can manage other admins
- Can modify system settings
- Can access audit logs

**Admin:**
- Can manage customers, vendors, riders
- Can approve/reject applications
- Can manage content
- Cannot modify system settings
- Cannot manage other admins

---

# 10. ROLE-BASED ACCESS CONTROL

## Roles

1. **Super Admin**
2. **Admin**
3. **Vendor**
4. **Rider**
5. **Customer**

## Permissions Matrix

| Action                | Super Admin | Admin | Vendor | Rider | Customer |
| --------------------- | ------------ | ----- | ------ | ----- | -------- |
| View dashboard        | ✓            | ✓     | ✓      | ✓     | ✓        |
| Edit own profile      | ✓            | ✓     | ✓      | ✓     | ✓        |
| Manage customers      | ✓            | ✓     | ✗      | ✗     | ✗        |
| Manage vendors        | ✓            | ✓     | ✗      | ✗     | ✗        |
| Manage riders         | ✓            | ✓     | ✗      | ✗     | ✗        |
| Approve applications  | ✓            | ✓     | ✗      | ✗     | ✗        |
| Manage products       | ✓            | ✓     | ✓ (own)| ✗     | ✗        |
| Create deliveries     | ✓            | ✓     | ✗      | ✗     | ✗        |
| View all deliveries    | ✓            | ✓     | ✓ (own)| ✗     | ✗        |
| View own deliveries   | ✗            | ✗     | ✓ (own)| ✓ (assigned)| ✗     |
| Assign riders         | ✓            | ✓     | ✗      | ✗     | ✗        |
| View own assignments   | ✗            | ✗     | ✗      | ✓     | ✗        |
| Update delivery status| ✓            | ✓     | ✗      | ✓ (assigned)| ✗     |
| View own earnings      | ✗            | ✗     | ✗      | ✓     | ✗        |
| Manage vehicles       | ✓            | ✓     | ✗      | ✗     | ✗        |
| View assigned vehicle | ✗            | ✗     | ✗      | ✓     | ✗        |
| Access sensitive rider data| ✓     | ✓     | ✗      | ✗     | ✗        |
| Access audit logs     | ✓            | ✗     | ✗      | ✗     | ✗        |
| Modify system settings| ✓            | ✗     | ✗      | ✗     | ✗        |

## Actions Requiring Admin Approval

- Vendor applications
- Rider applications
- Business profile changes (significant)
- Service area changes

## Implementation

- Supabase Row Level Security (RLS) policies
- Role-based authentication
- Middleware for route protection
- Server-side validation for sensitive operations

---

# 11. DATABASE PLANNING

## V1 Tables

### profiles

**Purpose:** Store user profile information for all user types

**Important Fields:**
- id (UUID, primary key, references auth.users)
- email (text)
- phone (text)
- full_name (text)
- avatar_url (text, nullable)
- role (enum: customer, vendor, rider, admin, super_admin)
- created_at (timestamp)
- updated_at (timestamp)

**Relationships:**
- One-to-one with auth.users
- One-to-many with addresses
- One-to-one with vendors (if role = vendor)
- One-to-one with riders (if role = rider)

**V1:** Yes  
**Security:** RLS to ensure users can only view/edit their own profile (except admins)

---

### vendor_applications

**Purpose:** Store vendor registration applications pending approval

**Important Fields:**
- id (UUID, primary key)
- profile_id (UUID, references profiles)
- business_name (text)
- business_type (enum: restaurant, grocery_store)
- business_description (text)
- business_address (text)
- phone (text)
- email (text)
- operating_hours (jsonb)
- service_area (text)
- status (enum: pending, approved, rejected)
- rejection_reason (text, nullable)
- submitted_at (timestamp)
- reviewed_at (timestamp, nullable)
- reviewed_by (UUID, references profiles, nullable)

**Relationships:**
- Many-to-one with profiles
- One-to-one with vendors (when approved)

**V1:** Yes  
**Security:** RLS - applicants can view own application, admins can view all

---

### vendors

**Purpose:** Store approved vendor information

**Important Fields:**
- id (UUID, primary key)
- profile_id (UUID, references profiles, unique)
- business_name (text)
- business_type (enum: restaurant, grocery_store)
- business_description (text)
- business_address (text)
- phone (text)
- email (text)
- logo_url (text, nullable)
- cover_image_url (text, nullable)
- operating_hours (jsonb)
- service_area (text)
- is_active (boolean, default true)
- rating (numeric, nullable)
- created_at (timestamp)
- updated_at (timestamp)

**Relationships:**
- One-to-one with profiles
- One-to-many with products
- One-to-many with categories

**V1:** Yes  
**Security:** RLS - vendors can edit own data, admins can view/edit all

---

### rider_applications

**Purpose:** Store rider registration applications pending approval (non-sensitive data)

**Important Fields:**
- id (UUID, primary key)
- profile_id (UUID, references profiles)
- full_name (text)
- phone (text)
- email (text)
- address (text)
- vehicle_type (enum: petrol, electric)
- vehicle_make (text)
- vehicle_model (text)
- vehicle_year (integer)
- status (enum: pending, approved, rejected)
- rejection_reason (text, nullable)
- submitted_at (timestamp)
- reviewed_at (timestamp, nullable)
- reviewed_by (UUID, references profiles, nullable)

**Relationships:**
- Many-to-one with profiles
- One-to-one with riders (when approved)
- One-to-one with rider_application_private

**V1:** Yes  
**Security:** RLS - applicants can view own application, admins can view all. Sensitive data is in separate rider_application_private table.

---

### rider_application_private

**Purpose:** Store sensitive rider application information (restricted access)

**Important Fields:**
- application_id (UUID, primary key, references rider_applications)
- date_of_birth (date)
- license_number (text)
- license_expiry (date)
- emergency_contact_name (text)
- emergency_contact_phone (text)
- bank_name (text)
- bank_account_number (text)

**Relationships:**
- One-to-one with rider_applications

**V1:** Yes  
**Security:** RLS - ONLY admins and super_admins can access this table. Applicants cannot query this table. Sensitive information must never appear in public queries or components.

---

### riders

**Purpose:** Store approved rider information

**Important Fields:**
- id (UUID, primary key)
- profile_id (UUID, references profiles, unique)
- is_available (boolean, default true)
- total_deliveries (integer, default 0)
- rating (numeric, nullable)
- created_at (timestamp)
- updated_at (timestamp)

**Relationships:**
- One-to-one with profiles
- One-to-many with delivery_assignments
- One-to-many with rider_earnings

**V1:** Yes  
**Security:** RLS - riders can edit own data, admins can view/edit all. Vehicle information is in vehicles table.

---

### categories

**Purpose:** Store product categories for vendors

**Important Fields:**
- id (UUID, primary key)
- vendor_id (UUID, references vendors)
- name (text)
- description (text, nullable)
- display_order (integer, default 0)
- is_active (boolean, default true)
- created_at (timestamp)
- updated_at (timestamp)

**Relationships:**
- Many-to-one with vendors
- One-to-many with products

**V1:** Yes  
**Security:** RLS - vendors can manage own categories, admins can view all

---

### products

**Purpose:** Store products/menu items for vendors

**Important Fields:**
- id (UUID, primary key)
- vendor_id (UUID, references vendors)
- category_id (UUID, references categories, nullable)
- name (text)
- description (text, nullable)
- price (numeric)
- image_url (text, nullable)
- is_available (boolean, default true)
- display_order (integer, default 0)
- created_at (timestamp)
- updated_at (timestamp)

**Relationships:**
- Many-to-one with vendors
- Many-to-one with categories

**V1:** Yes  
**Security:** RLS - vendors can manage own products, admins can view all

---

### addresses

**Purpose:** Store saved addresses for customers

**Important Fields:**
- id (UUID, primary key)
- profile_id (UUID, references profiles)
- label (text) - e.g., "Home", "Office"
- recipient_name (text)
- phone (text)
- address_line_1 (text)
- address_line_2 (text, nullable)
- city (text)
- state (text)
- postal_code (text, nullable)
- is_default (boolean, default false)
- created_at (timestamp)
- updated_at (timestamp)

**Relationships:**
- Many-to-one with profiles

**V1:** Yes  
**Security:** RLS - customers can manage own addresses only

---

### contact_messages

**Purpose:** Store messages from contact form

**Important Fields:**
- id (UUID, primary key)
- name (text)
- email (text)
- phone (text, nullable)
- subject (text)
- message (text)
- status (enum: new, in_progress, resolved)
- created_at (timestamp)
- updated_at (timestamp)

**Relationships:** None

**V1:** Yes  
**Security:** RLS - admins can view all, public can insert only

---

### notifications

**Purpose:** Store user notifications

**Important Fields:**
- id (UUID, primary key)
- profile_id (UUID, references profiles)
- title (text)
- message (text)
- type (enum: info, success, warning, error)
- is_read (boolean, default false)
- action_url (text, nullable)
- created_at (timestamp)

**Relationships:**
- Many-to-one with profiles

**V1:** Yes  
**Security:** RLS - users can view own notifications only

---

### service_areas

**Purpose:** Define geographic service areas

**Important Fields:**
- id (UUID, primary key)
- name (text)
- description (text)
- coverage_polygon (jsonb, nullable) - for future mapping
- is_active (boolean, default true)
- created_at (timestamp)
- updated_at (timestamp)

**Relationships:** None

**V1:** Yes (basic)  
**Security:** Public read, admin write

---

### vehicles

**Purpose:** Track KingdomDash fleet of petrol and electric motorcycles

**Important Fields:**
- id (UUID, primary key)
- assigned_rider_id (UUID, references riders, nullable)
- vehicle_type (enum: petrol, electric)
- make (text)
- model (text)
- year (integer)
- license_plate (text, unique)
- vin (text, nullable)
- purchase_date (date, nullable)
- status (enum: active, maintenance, retired)
- created_at (timestamp)
- updated_at (timestamp)

**Relationships:**
- One-to-one with riders (current assignment)

**V1:** Yes  
**Security:** RLS - admins can view/edit all, riders can view assigned vehicle only

---

### deliveries

**Purpose:** Internal operational delivery records created from WhatsApp orders

**Important Fields:**
- id (UUID, primary key)
- customer_name (text)
- customer_phone (text)
- service_type (enum: food, grocery, courier)
- vendor_id (UUID, references vendors, nullable)
- pickup_address (text)
- pickup_contact (text)
- delivery_address (text)
- delivery_contact (text)
- special_instructions (text, nullable)
- status (enum: pending, assigned, picked_up, in_transit, delivered, cancelled)
- created_by (UUID, references profiles)
- created_at (timestamp)
- updated_at (timestamp)

**Business Rules:**
- service_type = food → vendor_id is required
- service_type = grocery → vendor_id is required
- service_type = courier → vendor_id must be NULL

**Relationships:**
- Many-to-one with vendors
- One-to-many with delivery_assignments
- One-to-many with delivery_status_updates

**V1:** Yes  
**Security:** RLS - admins can view/create, riders can view assigned only, vendors can view own deliveries only

---

### delivery_assignments

**Purpose:** Assign deliveries to riders

**Important Fields:**
- id (UUID, primary key)
- delivery_id (UUID, references deliveries)
- rider_id (UUID, references riders)
- assigned_by (UUID, references profiles)
- assigned_at (timestamp)
- status (enum: assigned, accepted, rejected, completed)
- notes (text, nullable)
- created_at (timestamp)
- updated_at (timestamp)

**Relationships:**
- Many-to-one with deliveries
- Many-to-one with riders
- One-to-one with rider_earnings

**V1:** Yes  
**Security:** RLS - admins can view/create, riders can view own assignments only

---

### delivery_status_updates

**Purpose:** Track delivery status changes for audit trail

**Important Fields:**
- id (UUID, primary key)
- delivery_id (UUID, references deliveries)
- old_status (enum)
- new_status (enum)
- updated_by (UUID, references profiles)
- updated_at (timestamp)
- notes (text, nullable)

**Relationships:**
- Many-to-one with deliveries

**V1:** Yes  
**Security:** RLS - admins can view all, riders can view for assigned deliveries

---

### rider_earnings

**Purpose:** Authoritative financial record of rider earnings per delivery

**Important Fields:**
- id (UUID, primary key)
- rider_id (UUID, references riders)
- delivery_id (UUID, references deliveries)
- delivery_assignment_id (UUID, references delivery_assignments)
- amount (numeric)
- currency (text, default 'NGN')
- payment_status (enum: pending, paid)
- paid_at (timestamp, nullable)
- notes (text, nullable)
- created_at (timestamp)

**Relationships:**
- Many-to-one with riders
- Many-to-one with deliveries
- Many-to-one with delivery_assignments

**V1:** Yes  
**Security:** RLS - riders can view own earnings only, admins can view all

---

### audit_logs

**Purpose:** Track important system actions for security and compliance

**Important Fields:**
- id (UUID, primary key)
- profile_id (UUID, references profiles, nullable)
- action (text)
- entity_type (text)
- entity_id (UUID, nullable)
- old_values (jsonb, nullable)
- new_values (jsonb, nullable)
- ip_address (text, nullable)
- user_agent (text, nullable)
- created_at (timestamp)

**Relationships:**
- Many-to-one with profiles

**V1:** Yes  
**Security:** Super admin access only

---

## Future Tables (Not V1)

### promotions

**Purpose:** Store promotional offers

**V1:** No (deferred to promotions phase)

---

# 12. WHATSAPP ORDERING ARCHITECTURE

## Current V1 Flow

```
Customer
   ↓
KingdomDash Website
   ↓
Select Service (Food/Grocery/Courier)
   ↓
Select Vendor (for Food/Grocery) or Courier Option
   ↓
Click WhatsApp CTA
   ↓
WhatsApp Opens (with pre-filled message)
   ↓
KingdomDash Operations Team
   ↓
Admin creates delivery record in system
   ↓
Admin assigns rider to delivery
   ↓
Rider receives assignment notification
   ↓
Rider accepts assignment
   ↓
Rider picks up delivery
   ↓
Rider delivers to customer
   ↓
Delivery completed
   ↓
Earnings record created
```

## Delivery Status Flow

**Delivery Status Transitions:**
- pending → assigned (when rider assigned)
- assigned → picked_up (when rider picks up)
- picked_up → in_transit (when rider is en route)
- in_transit → delivered (when delivery completed)
- Any status → cancelled (if cancelled)

**Assignment Status Transitions:**
- assigned → accepted (when rider accepts)
- assigned → rejected (when rider rejects)
- accepted → completed (when delivery completed)

**Rejection Flow:**
1. Admin assigns rider → assignment = assigned
2. Rider accepts → assignment = accepted
3. Rider rejects → assignment = rejected
4. Admin can assign another available rider
5. When delivery completed → delivery.status = delivered, assignment.status = completed

## Configuration Strategy

**Centralized Configuration:**

```typescript
// config/app.config.ts
export const appConfig = {
  whatsapp: {
    businessNumber: import.meta.env.VITE_WHATSAPP_BUSINESS_NUMBER || '+234XXXXXXXXXX',
    defaultMessage: 'Hello KingdomDash, I would like to place an order.',
  },
  // ... other config
}
```

**Environment Variables:**

```bash
# .env
VITE_WHATSAPP_BUSINESS_NUMBER=+234XXXXXXXXXX
```

## WhatsApp Link Generator

```typescript
// utils/whatsapp.ts
export const generateWhatsAppLink = (message: string): string => {
  const encodedMessage = encodeURIComponent(message);
  // Strip + and spaces from number for wa.me format
  const cleanNumber = appConfig.whatsapp.businessNumber.replace(/[\s+]/g, '');
  return `https://wa.me/${cleanNumber}?text=${encodedMessage}`;
};
```

**WhatsApp URL Format Verification:**

**Format:** `https://wa.me/{number}?text={encoded_message}`

**Number Format:** International format without + or spaces
- Example: 234XXXXXXXXXX (not +234XXXXXXXXXX)

**Validation:** Strip + and spaces from number before generating URL

## Pre-filled Message Examples

**Food Delivery:**
```
Hello KingdomDash, I would like to place an order from [Restaurant Name].
```

**Grocery Delivery:**
```
Hello KingdomDash, I would like to order groceries from [Store Name].
```

**Courier:**
```
Hello KingdomDash, I would like to request a courier service.
Pickup: [Pickup Address]
Drop-off: [Drop-off Address]
```

**Vendor Application:**
```
Hello KingdomDash, I would like to apply as a vendor.
```

**Rider Application:**
```
Hello KingdomDash, I would like to apply as a rider.
```

## Ordering Channel Strategy

Online ordering through the website with Paystack payment is the primary ordering mechanism; WhatsApp is available as a fallback and support channel.

1. Online ordering through the website is the primary ordering mechanism
2. WhatsApp is available as a fallback and support channel for customers who prefer it
3. Maintain WhatsApp for customer support and special requests
4. Configuration can be extended to support multiple WhatsApp numbers per service/region

> **V1 Technical Note:** For food and grocery orders placed through the website, the `create_order_secure` Supabase RPC is the V1 primary order creation mechanism. It is a `SECURITY DEFINER` database function that enforces financial authority (all prices, fees, and totals are calculated server-side — the client never supplies monetary values). WhatsApp order creation flows through admin-created delivery records in the admin dashboard and is a transitional fallback/support channel, not the primary path. The diagram above describes the WhatsApp-assisted fulfilment flow, which remains operational for support and courier requests; however, food/grocery website orders bypass this flow entirely and go directly through `create_order_secure`.

---

# 13. SECURITY

## Authentication

**Supabase Auth Implementation:**
- Email/password authentication
- Phone authentication (optional for Nigerian context)
- OAuth providers (Google, Apple) - optional for V1
- Session management
- Password reset flow

## Row Level Security (RLS)

**Security Boundary Clarification:**

**CRITICAL:** Client-side route guards (ProtectedRoute components) are UX improvements, NOT security boundaries.

**Actual Security Boundaries:**
1. Supabase Row Level Security (RLS) policies - PRIMARY security mechanism
2. Supabase Auth - Authentication and session management
3. Database constraints - Data integrity
4. Secure database functions - Elevated privilege operations

**Security Hierarchy:**
- Database (RLS) > Backend (Supabase) > Frontend (Route Guards)

**Rule:** Never assume client-side route protection provides security. All authorization must be enforced at the database level via RLS.

---

**Database Security Policies:**

**profiles table:**
- Users can view/edit own profile
- Admins can view all profiles
- Super admins can edit all profiles

**vendors table:**
- Vendors can view/edit own data
- Admins can view/edit all vendors
- Public can view active vendors only

**products table:**
- Vendors can manage own products
- Admins can manage all products
- Public can view available products only

**rider_applications table:**
- Applicants can view own application (non-sensitive fields only)
- Admins can view all applications

**rider_application_private table:**
- ONLY admins and super_admins can access
- Applicants cannot query this table
- Sensitive information must never appear in public queries or components

**riders table:**
- Riders can view/edit own data
- Admins can view/edit all riders

**vehicles table:**
- Admins can view/edit all
- Riders can view assigned vehicle only

**deliveries table:**
- Admins can view/create
- Riders can view assigned only
- Vendors can view own deliveries only

**delivery_assignments table:**
- Admins can view/create
- Riders can view own assignments only

**rider_earnings table:**
- Riders can view own earnings only
- Admins can view all

**addresses table:**
- Customers can manage own addresses only

**audit_logs table:**
- Super admin access only

## Environment Variables

**Critical Variables:**
```bash
# Supabase
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# WhatsApp
VITE_WHATSAPP_BUSINESS_NUMBER=+234XXXXXXXXXX

# Application
VITE_APP_NAME=KingdomDash
VITE_APP_URL=https://kingdomdash.com
```

**Security Rules:**
- Never expose `SUPABASE_SERVICE_ROLE_KEY` in frontend
- Use anon key for client-side operations
- Service role key only used in server-side functions/migrations
- All sensitive data in environment variables
- Never commit `.env` files to Git

## API Key Handling

**Supabase Client Configuration:**
```typescript
// services/supabase/client.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

## Validation

**Client-side Validation:**
- Form validation using react-hook-form or zod
- Input sanitization
- Type checking with TypeScript

**Server-side Validation:**
- Database constraints (NOT NULL, UNIQUE, CHECK)
- Supabase database functions with validation
- RLS policies as additional validation layer

## Input Sanitization

- Escape user input before database operations
- Use parameterized queries (Supabase handles this)
- Sanitize HTML content if allowing rich text
- Validate file uploads

## Secure Database Functions

**Use Cases:**
- Complex business logic
- Operations requiring elevated privileges
- Multi-step transactions

**Example:**
```sql
CREATE OR REPLACE FUNCTION approve_vendor_application(
  application_id UUID,
  admin_id UUID
) RETURNS VOID AS $$
BEGIN
  -- Validate admin role
  -- Create vendor record
  -- Update application status
  -- Create audit log
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Admin Protection

**Route Protection:**
```typescript
// ProtectedRoute component
const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { user, role } = useAuth();
  
  if (!user) return <Navigate to="/login" />;
  if (!allowedRoles.includes(role)) return <Navigate to="/unauthorized" />;
  
  return <>{children}</>;
};
```

**Middleware:**
- Check authentication state
- Verify role permissions
- Redirect unauthorized access

## File Upload Security

**Supabase Storage Policies:**
- Restrict file types (images only for V1)
- Limit file sizes
- User-specific upload buckets
- Virus scanning (consider third-party service)

**Validation:**
- Validate file type on client
- Validate file type on server
- Rename files on upload
- Store metadata separately

## Vendor/Rider Approval

**Approval Workflow:**
1. User submits application
2. Application stored with status 'pending'
3. Admin reviews application
4. Admin approves or rejects
5. If approved, create vendor/rider record
6. Update application status
7. Send notification to applicant

**Security:**
- Only admins can approve/reject
- Approval requires admin authentication
- Audit log of all approval actions
- Cannot bypass approval process

## Audit Logging

**What to Log:**
- User authentication events
- Profile changes
- Vendor/rider approvals
- Admin actions
- Failed authentication attempts
- Permission changes

**Log Retention:**
- Keep logs for minimum 90 days
- Consider longer retention for compliance

---

# 14. DEVELOPMENT PHASES

## Phase 0 — Discovery & Architecture

**Objective:** Establish complete understanding of requirements, business rules, and technical architecture before implementation begins.

**Features:**
- Complete requirements documentation
- Business rules definition
- Technical architecture decisions
- Database schema design
- Role and permission definitions
- Security model specification
- User flow documentation
- API contract design (where applicable)

**Technical Work:**
- Create this development plan document
- Design database schema with relationships
- Define RLS policies
- Map user journeys
- Design API structure
- Define environment variables
- Create technical specifications

**Files/Components Created:**
- `KINGDOMDASH_DEVELOPMENT_PLAN.md` (this document)
- Database schema documentation
- API documentation (if needed)
- Architecture diagrams (optional)

**Database Changes:**
- Schema design (no migrations yet)

**Dependencies:**
- None

**Security Considerations:**
- Define security model
- Plan RLS policies
- Identify sensitive data

**Testing Requirements:**
- Review plan with stakeholders
- Validate technical decisions
- Security review of architecture

**Definition of Done:**
- Development plan approved
- Database schema finalized
- Security model defined
- All stakeholders aligned
- Technical risks identified

**Complexity:** High  
**Phase:** V1

---

## Phase 1 — Project Foundation

**Objective:** Set up the React project with all necessary tooling and configuration.

**Features:**
- React + TypeScript project
- Vite build configuration
- Tailwind CSS setup
- shadcn/ui installation
- React Router configuration
- Folder structure
- Environment configuration
- Git/GitHub repository

**Technical Work:**
- Initialize Vite + React + TypeScript project
- Install and configure Tailwind CSS
- Install and configure shadcn/ui
- Set up React Router
- Create folder structure
- Configure environment variables
- Set up ESLint and Prettier
- Initialize Git repository
- Create .gitignore
- Set up GitHub repository
- Create README

**Files/Components Created:**
- `package.json`
- `vite.config.ts`
- `tailwind.config.js`
- `tsconfig.json`
- `.env.example`
- `.gitignore` (must include .env, .env.local, .env.*.local)
- `README.md`
- `src/` folder structure
- `src/main.tsx`
- `src/App.tsx`
- `src/index.css`
- ESLint/Prettier configs

**Database Changes:**
- None

**Dependencies:**
- Phase 0

**Security Considerations:**
- Set up environment variable handling
- Configure .gitignore to exclude sensitive files
- Document security practices

**Testing Requirements:**
- Verify project builds successfully
- Verify TypeScript compiles without errors
- Verify Tailwind CSS works
- Verify routing works

**Definition of Done:**
- Project builds without errors
- Development server runs successfully
- Folder structure is in place
- Environment variables configured
- Git repository initialized and pushed to GitHub
- README with setup instructions

**Complexity:** Medium  
**Phase:** V1

---

## Phase 2 — Design System & Public Website

**Objective:** Build the design system and all public-facing pages.

**Features:**
- Global layout components
- Navigation bar
- Footer
- Responsive design system
- Homepage
- About page
- Services pages (Food, Grocery, Courier)
- FAQ page
- Contact page
- CTA system (WhatsApp integration)

**Technical Work:**
- Create layout components (Navbar, Footer, Layout)
- Implement responsive design patterns
- Build Homepage with all sections
- Build About page
- Build Services pages
- Build FAQ page with categories
- Build Contact page with form
- Implement WhatsApp CTA components
- Create reusable UI components
- Implement routing for all public pages

**Files/Components Created:**
- `src/components/layout/Navbar.tsx`
- `src/components/layout/Footer.tsx`
- `src/components/layout/Layout.tsx`
- `src/pages/public/Home.tsx`
- `src/pages/public/About.tsx`
- `src/pages/public/Services.tsx`
- `src/pages/public/FoodDelivery.tsx`
- `src/pages/public/GroceryDelivery.tsx`
- `src/pages/public/Courier.tsx`
- `src/pages/public/FAQ.tsx`
- `src/pages/public/Contact.tsx`
- `src/components/shared/WhatsAppCTA.tsx`
- `src/components/shared/Hero.tsx`
- `src/config/app.config.ts`
- `src/utils/whatsapp.ts`

**Database Changes:**
- None (static content for now)

**Dependencies:**
- Phase 1

**Security Considerations:**
- Validate contact form inputs
- Sanitize user inputs
- No sensitive data in frontend

**Testing Requirements:**
- Test all pages render correctly
- Test responsive design on mobile/tablet/desktop
- Test WhatsApp links work correctly
- Test navigation between pages
- Test contact form validation

**Definition of Done:**
- All public pages implemented
- Responsive design works on all devices
- WhatsApp CTAs functional
- Navigation works correctly
- Contact form validates inputs
- Design system consistent across pages

**Complexity:** Medium  
**Phase:** V1

---

## Phase 3 — Food Delivery Experience

**Objective:** Build the restaurant discovery and browsing experience.

**Features:**
- Restaurant listing page
- Restaurant details page
- Menu presentation
- Category filtering
- WhatsApp ordering integration
- Service area information

**Technical Work:**
- Create restaurant listing page
- Create restaurant details page
- Implement menu display components
- Add category filtering
- Integrate WhatsApp CTAs with pre-filled messages
- Add service area information
- Create placeholder restaurant data (for V1)

**Files/Components Created:**
- `src/pages/public/Restaurants.tsx`
- `src/pages/public/RestaurantDetail.tsx`
- `src/components/food/RestaurantCard.tsx`
- `src/components/food/MenuSection.tsx`
- `src/components/food/MenuItem.tsx`
- `src/components/food/CategoryFilter.tsx`
- `src/data/mockRestaurants.ts` (temporary for V1)

**Database Changes:**
- None yet (using mock data for V1)

**Dependencies:**
- Phase 2

**Security Considerations:**
- Validate any user inputs
- No sensitive data exposure

**Testing Requirements:**
- Test restaurant listing displays correctly
- Test restaurant details page
- Test menu display
- Test category filtering
- Test WhatsApp CTAs with restaurant-specific messages

**Definition of Done:**
- Restaurant listing page functional
- Restaurant details page functional
- Menu displays correctly
- Category filtering works
- WhatsApp CTAs pre-filled with restaurant name
- Responsive design maintained

**Complexity:** Medium  
**Phase:** V1

---

## Phase 4 — Grocery Experience

**Objective:** Build the grocery store discovery and browsing experience.

**Features:**
- Grocery store listing page
- Store details page
- Product presentation
- Category filtering
- WhatsApp ordering integration
- Service area information

**Technical Work:**
- Create grocery store listing page
- Create store details page
- Implement product display components
- Add category filtering
- Integrate WhatsApp CTAs with pre-filled messages
- Add service area information
- Create placeholder grocery store data (for V1)

**Files/Components Created:**
- `src/pages/public/GroceryStores.tsx`
- `src/pages/public/GroceryStoreDetail.tsx`
- `src/components/grocery/StoreCard.tsx`
- `src/components/grocery/ProductSection.tsx`
- `src/components/grocery/ProductItem.tsx`
- `src/components/grocery/CategoryFilter.tsx`
- `src/data/mockGroceryStores.ts` (temporary for V1)

**Database Changes:**
- None yet (using mock data for V1)

**Dependencies:**
- Phase 2

**Security Considerations:**
- Validate any user inputs
- No sensitive data exposure

**Testing Requirements:**
- Test grocery store listing displays correctly
- Test store details page
- Test product display
- Test category filtering
- Test WhatsApp CTAs with store-specific messages

**Definition of Done:**
- Grocery store listing page functional
- Store details page functional
- Products display correctly
- Category filtering works
- WhatsApp CTAs pre-filled with store name
- Responsive design maintained

**Complexity:** Medium  
**Phase:** V1

---

## 7. COURIER — V1

Courier must be a real website-based ordering/checkout flow in V1.

The minimum flow is:

**Courier Service → Pickup Location → Drop-off Location → Package Details → Distance Calculation → Delivery Fee → Review → Paystack → Courier Request Created**

The customer must NOT be forced to use WhatsApp to initiate the courier request.

WhatsApp may remain available for support/manual communication.

Remove or rewrite any statement saying:

> "No online courier checkout in V1."

That requirement is obsolete. V1 courier service supports online ordering, cart, checkout, and Paystack payment.

---

## Phase 6 — Supabase Backend

**Objective:** Set up Supabase backend with database, authentication, and security.

**Features:**
- Supabase project setup
- Database schema creation
- Authentication configuration
- Profile system
- Role system
- Row Level Security policies
- Storage configuration
- Database functions where required

**Technical Work:**
- Create Supabase project
- Create database tables (V1 tables only)
- Set up Supabase Auth
- Create RLS policies
- Create database functions
- Set up Storage buckets
- Configure environment variables
- Create Supabase client configuration
- Create type definitions from database

**Files/Components Created:**
- `supabase/migrations/` (SQL migration files)
- `src/services/supabase/client.ts`
- `src/services/supabase/auth.ts`
- `src/services/supabase/profiles.ts`
- `src/services/supabase/deliveries.ts`
- `src/services/supabase/vehicles.ts`
- `src/types/database.types.ts` (generated)
- `.env` with Supabase credentials
- `.env.example` (committed to Git)

**Database Changes:**
- Create all V1 tables:
  - profiles
  - vendor_applications
  - vendors
  - rider_applications
  - rider_application_private
  - riders
  - vehicles
  - categories
  - products
  - addresses
  - contact_messages
  - notifications
  - service_areas
  - deliveries
  - delivery_assignments
  - delivery_status_updates
  - rider_earnings
  - audit_logs
- Create RLS policies for all tables
- Create database functions (including admin role check function)
- Set up Storage buckets
- Add database constraints for delivery service-type business rules

**Dependencies:**
- Phase 0
- Phase 1

**Security Considerations:**
- Implement all RLS policies
- Never expose service role key
- Secure database functions
- Proper authentication setup

**Testing Requirements:**
- Test database migrations
- Test RLS policies
- Test authentication flow
- Test database functions
- Test Supabase client connection

**Definition of Done:**
- Supabase project created
- All V1 tables created
- RLS policies implemented and tested
- Authentication configured
- Storage configured
- Environment variables set
- Database types generated
- All security policies verified

**Complexity:** High  
**Phase:** V1

---

## Phase 7 — Customer Account

**Objective:** Implement customer authentication and account management.

**Features:**
- User registration
- User login/logout
- Profile management
- Saved addresses
- Notifications
- Customer dashboard
- Settings

**Technical Work:**
- Implement authentication flow
- Create registration form
- Create login form
- Create customer dashboard
- Create profile management
- Create saved addresses management
- Implement notifications display
- Create settings page
- Add route protection

**Files/Components Created:**
- `src/pages/auth/Register.tsx`
- `src/pages/auth/Login.tsx`
- `src/pages/auth/ForgotPassword.tsx`
- `src/pages/customer/Dashboard.tsx`
- `src/pages/customer/Profile.tsx`
- `src/pages/customer/Addresses.tsx`
- `src/pages/customer/Notifications.tsx`
- `src/pages/customer/Settings.tsx`
- `src/components/auth/AuthForm.tsx`
- `src/components/customer/AddressForm.tsx`
- `src/hooks/useAuth.ts`
- `src/components/shared/ProtectedRoute.tsx`

**Database Changes:**
- None (tables created in Phase 6)

**Dependencies:**
- Phase 6

**Security Considerations:**
- Secure authentication flow
- RLS for profile data
- Secure password handling
- Session management

**Testing Requirements:**
- Test registration flow
- Test login/logout
- Test authentication persistence
- Test profile updates
- Test address CRUD operations
- Test route protection
- Test RLS policies

**Definition of Done:**
- Users can register
- Users can login/logout
- Profile management functional
- Saved addresses functional
- Notifications display
- Dashboard functional
- Route protection working
- RLS policies verified

**Complexity:** Medium  
**Phase:** V1

---

## Phase 8 — Vendor Platform

**Objective:** Implement vendor registration and vendor dashboard.

**Features:**
- Vendor registration application
- Vendor dashboard
- Business profile management
- Products/menu management
- Category management
- Operating hours
- Availability status
- Service area

**Technical Work:**
- Create vendor registration form
- Create vendor dashboard
- Implement business profile management
- Implement product/menu CRUD
- Implement category CRUD
- Add operating hours management
- Add availability toggle
- Add service area configuration
- Integrate with Supabase

**Files/Components Created:**
- `src/pages/public/BecomeVendor.tsx`
- `src/pages/vendor/Dashboard.tsx`
- `src/pages/vendor/BusinessProfile.tsx`
- `src/pages/vendor/Products.tsx`
- `src/pages/vendor/Categories.tsx`
- `src/pages/vendor/Availability.tsx`
- `src/pages/vendor/Settings.tsx`
- `src/components/vendor/ProductForm.tsx`
- `src/components/vendor/CategoryForm.tsx`
- `src/components/vendor/OperatingHours.tsx`
- `src/services/supabase/vendors.ts`
- `src/services/supabase/products.ts`

**Database Changes:**
- None (tables created in Phase 6)

**Dependencies:**
- Phase 6
- Phase 7

**Security Considerations:**
- Vendor can only access own data
- RLS for vendor data
- Application approval workflow
- Audit logging for approvals

**Testing Requirements:**
- Test vendor application submission
- Test vendor dashboard
- Test business profile updates
- Test product CRUD
- Test category CRUD
- Test RLS policies
- Test approval workflow

**Definition of Done:**
- Vendor registration form functional
- Vendor dashboard functional
- Business profile management working
- Product/menu management working
- Category management working
- Operating hours configurable
- Availability toggle working
- RLS policies verified

**Complexity:** High  
**Phase:** V1

---

## Phase 9 — Rider Platform

**Objective:** Implement rider application and rider dashboard.

**Features:**
- Rider application form
- Rider dashboard
- Profile management
- Availability toggle
- Vehicle information
- Delivery assignments display (basic)
- Delivery status updates
- Earnings overview
- Notifications

**Technical Work:**
- Create rider application form
- Create rider dashboard
- Implement profile management
- Add availability toggle
- Add vehicle information display
- Implement basic delivery assignment display
- Add delivery status update capability
- Add earnings overview
- Integrate with Supabase

**Files/Components Created:**
- `src/pages/public/BecomeRider.tsx`
- `src/pages/rider/Dashboard.tsx`
- `src/pages/rider/Profile.tsx`
- `src/pages/rider/Availability.tsx`
- `src/pages/rider/Vehicle.tsx`
- `src/pages/rider/Deliveries.tsx`
- `src/pages/rider/Earnings.tsx`
- `src/pages/rider/Settings.tsx`
- `src/components/rider/ApplicationForm.tsx`
- `src/components/rider/DeliveryCard.tsx`
- `src/services/supabase/riders.ts`

**Database Changes:**
- None (tables created in Phase 6)

**Note:** Vehicle information now references vehicles table via vehicles.assigned_rider_id. Earnings data comes from rider_earnings table.

**Dependencies:**
- Phase 6
- Phase 7

**Security Considerations:**
- Rider can only access own data
- RLS for rider data
- Application approval workflow
- Audit logging for approvals

**Testing Requirements:**
- Test rider application submission
- Test rider dashboard
- Test profile updates
- Test availability toggle
- Test vehicle information display
- Test delivery assignment display
- Test delivery status updates
- Test RLS policies
- Test approval workflow

**Definition of Done:**
- Rider application form functional
- Rider dashboard functional
- Profile management working
- Availability toggle working
- Vehicle information display working
- Delivery assignments display working
- Delivery status updates working
- Earnings overview functional
- RLS policies verified

**Complexity:** High  
**Phase:** V1

---

## Phase 10 — Admin Platform

**Objective:** Implement comprehensive admin dashboard for platform management.

**Features:**
- Admin dashboard with overview metrics
- Customer management
- Vendor management
- Vendor application approval
- Rider management
- Rider application approval
- Restaurant management
- Grocery store management
- Product/menu management
- Fleet overview
- Contact message management
- Basic reports
- System settings
- Audit logs

**Technical Work:**
- Create admin dashboard
- Implement customer management
- Implement vendor management
- Implement vendor application approval workflow
- Implement rider management
- Implement rider application approval workflow
- Implement restaurant management
- Implement grocery store management
- Implement product/menu management
- Add fleet overview
- Add contact message management
- Add basic reports
- Add system settings
- Add audit logs viewer
- Implement role-based access for admin functions

**Files/Components Created:**
- `src/pages/admin/Dashboard.tsx`
- `src/pages/admin/Customers.tsx`
- `src/pages/admin/Vendors.tsx`
- `src/pages/admin/VendorApplications.tsx`
- `src/pages/admin/Riders.tsx`
- `src/pages/admin/RiderApplications.tsx`
- `src/pages/admin/Deliveries.tsx`
- `src/pages/admin/DeliveryDetail.tsx`
- `src/pages/admin/Fleet.tsx`
- `src/pages/admin/Products.tsx`
- `src/pages/admin/Messages.tsx`
- `src/pages/admin/Reports.tsx`
- `src/pages/admin/Settings.tsx`
- `src/pages/admin/AuditLogs.tsx`
- `src/components/admin/ApprovalCard.tsx`
- `src/components/admin/MetricsCard.tsx`
- `src/components/admin/DeliveryForm.tsx`
- `src/components/admin/AssignmentForm.tsx`
- `src/components/admin/VehicleForm.tsx`
- `src/services/supabase/admin.ts`
- `src/services/supabase/deliveries.ts`
- `src/services/supabase/vehicles.ts`

**Database Changes:**
- None (tables created in Phase 6)

**Note:** Delivery creation enforces service-type business rules via database constraints. Fleet management uses vehicles table.

**Dependencies:**
- Phase 6
- Phase 7
- Phase 8
- Phase 9

**Security Considerations:**
- Strict role-based access
- Super admin vs Admin permissions
- Audit logging for all admin actions
- RLS for sensitive operations
- Secure approval workflows

**Testing Requirements:**
- Test admin dashboard
- Test customer management
- Test vendor management
- Test vendor approval workflow
- Test rider management
- Test rider approval workflow
- Test restaurant management
- Test grocery store management
- Test product management
- Test role-based access
- Test audit logging
- Test RLS policies

**Definition of Done:**
- Admin dashboard functional
- Customer management working
- Vendor management working
- Vendor approval workflow working
- Rider management working
- Rider approval workflow working
- Restaurant management working
- Grocery store management working
- Product management working
- Fleet overview functional
- Contact message management working
- Basic reports functional
- System settings configurable
- Audit logs viewable
- Role-based access verified
- All RLS policies verified

**Complexity:** High  
**Phase:** V1

---

## Phase 11 — Maps & Location

**Objective:** Implement mapping functionality as a V1 requirement.

**Features:**
- Service area maps
- Vendor/courier location maps
- Customer location selection
- Distance calculation for pricing
- Provider-agnostic implementation (Google Maps or Mapbox)

**Technical Work:**
- Evaluate Google Maps vs Mapbox
- Implement chosen mapping solution
- Create map components
- Integrate with service areas and delivery pricing
- Add location selection UI

**Dependencies:**
- Phase 6 (database with service_areas)
- Phase 8 (distance-based pricing)

**Security Considerations:**
- Secure API key handling
- Rate limiting
- Cost management

**Definition of Done:**
- Mapping solution chosen and implemented
- Service areas displayed on map
- Vendor/courier locations displayed
- Customer location selection functional
- API keys secured
- Cost controls in place

**Complexity:** High  
**Phase:** Future (requirements pending)

---

## Phase 12 — Testing & Security

**Objective:** Comprehensive testing and security audit of the platform with V1 requirements.

**Features:**
- Functional testing (including Paystack integration, maps, checkout)
- Responsive testing
- Authentication testing
- RLS testing
- Role testing
- Form validation testing
- Payment flow testing
- Maps/location testing
- Performance testing
- Accessibility testing
- Security audit

**Technical Work:**
- Create test suite for critical components including Paystack, maps, checkout
- Test all user flows including ordering and payment
- Test authentication flows
- Test RLS policies thoroughly
- Test role-based access
- Test form validations
- Test payment flows (initialization, verification, status)
- Test maps/location functionality
- Run responsive design tests
- Run accessibility audits
- Perform security audit
- Performance optimization
- Fix identified issues

**Files/Components Created:**
- Test files for critical components
- Test documentation
- Security audit report
- Performance report

**Database Changes:**
- None

**Dependencies:**
- Phase 10 (all core features complete including Paystack, maps, ordering)

**Security Considerations:**
- Comprehensive RLS testing
- Authentication security testing
- Input validation testing
- API security testing
- Environment variable security
- Payment security testing (no secret key exposure)
- Maps API key security

**Testing Requirements:**
- All user flows tested including ordering and payment
- All authentication scenarios tested
- All RLS policies tested
- All role permissions tested
- All forms validated
- Responsive design confirmed
- Accessibility compliant
- Security audit passed
- Performance optimized
- No critical bugs
- Payment verification flow tested end-to-end

**Complexity:** High  
**Phase:** V1

---

## Phase 13 — Deployment

**Objective:** Deploy the application to production with V1 features.

**Features:**
- GitHub repository configuration
- Vercel deployment
- Production environment variables
- Supabase production configuration
- Zoho DNS/domain configuration
- HTTPS setup
- Production testing including Paystack and maps

**Technical Work:**
- Configure GitHub repository
- Set up Vercel project
- Configure environment variables in Vercel (including VITE_PAYSTACK_PUBLIC_KEY, MAPS_API_KEY)
- Configure Supabase for production
- Set up Zoho DNS for Vercel
- Configure SSL/HTTPS
- Deploy to production
- Run production smoke tests including Paystack and maps
- Set up monitoring

**Files/Components Created:**
- `vercel.json` (if needed)
- Production deployment documentation
- Monitoring configuration

**Database Changes:**
- Apply migrations to production Supabase

**Dependencies:**
- Phase 12

**Security Considerations:**
- Secure production environment variables
- HTTPS enforcement
- Production database security
- API rate limiting
- Payment security (no secret keys in frontend)
- Maps API key security

**Testing Requirements:**
- Test production deployment
- Test all critical user flows in production including ordering and payment
- Test authentication in production
- Test Paystack integration in production
- Test WhatsApp CTAs in production
- Test domain resolution
- Test SSL certificate

**Definition of Done:**
- Application deployed to Vercel
- Domain connected to Vercel
- HTTPS working
- Environment variables configured (including Paystack public key and maps API key)
- Supabase production configured
- All features working in production including Paystack and maps
- Monitoring set up
- DNS propagation complete

**Complexity:** Medium  
**Phase:** V1

---

## Phase 14 — Launch

**Objective:** Prepare and execute the platform launch.

**Features:**
- Pre-launch checklist
- Content verification
- Vendor onboarding
- Rider onboarding
- Service area confirmation
- WhatsApp verification
- Analytics setup
- Monitoring setup

**Technical Work:**
- Complete pre-launch checklist
- Verify all content
- Onboard initial vendors
- Onboard initial riders
- Confirm service areas
- Verify WhatsApp number and messages
- Set up analytics (Google Analytics, etc.)
- Set up monitoring and alerts
- Final testing
- Launch

**Files/Components Created:**
- Pre-launch checklist
- Launch documentation
- Onboarding guides

**Database Changes:**
- Seed initial vendor data
- Seed initial rider data
- Seed initial category/product data

**Dependencies:**
- Phase 13

**Security Considerations:**
- Verify all security measures in production
- Confirm audit logging is active
- Verify RLS policies in production

**Testing Requirements:**
- Final end-to-end testing
- Load testing
- WhatsApp integration testing
- Vendor onboarding flow testing
- Rider onboarding flow testing

**Definition of Done:**
- Pre-launch checklist complete
- All content verified
- Initial vendors onboarded
- Initial riders onboarded
- Service areas confirmed
- WhatsApp verified
- Analytics configured
- Monitoring configured
- Platform launched
- Support processes in place

**Complexity:** Medium  
**Phase:** V1

---

## Phase 15 — Future Expansion

**Objective:** Plan for features beyond V1 (which now includes Paystack and maps).

**Features to be implemented after V1 completion:**

### Website-Based Ordering
- Shopping cart (now V1)
- Online checkout (now V1 with Paystack)
- Order management (now V1)
- Order history (future enhancement)

### Payment Integration
- Paystack integration (now V1)
- Payment processing (now V1)
- Payment history (future enhancement - expanded from V1)
- Refund handling (future enhancement)

### Automated Dispatch
- Automated rider assignment (future)
- Dispatch algorithms (future)
- Route optimization (future)

### Live Tracking
- GPS tracking for riders (future)
- Real-time delivery tracking (future)
- Customer tracking view (future)

### Advanced Notifications
- SMS notifications (future)
- Push notifications (future)
- Email notifications (future)
- In-app notifications (future)

### Promotions
- Discount codes (future)
- Promotional campaigns (future)
- Loyalty points (future)
- Rewards system (future)

### Reviews
- Customer reviews (future)
- Vendor ratings (future)
- Rider ratings (future)
- Review moderation (future)

### Mobile Applications
- iOS customer app (future)
- Android customer app (future)
- Rider mobile app (future)
- Vendor mobile app (future)

**Technical Work:**
- Detailed planning for each feature
- Architecture updates as needed
- Database schema expansions
- API expansions

**Dependencies:**
- V1 completion
- Business requirements for each feature

**Definition of Done:**
- Each feature planned when business requirements are established
- Architecture updated to accommodate new features
- No breaking changes to V1

**Complexity:** Varies by feature  
**Phase:** Future

---

# 15. PROJECT FOLDER ARCHITECTURE

## Recommended Structure

```
src/
├── app/                          # App-wide configuration
│   ├── providers.tsx             # React context providers
│   └── config.ts                 # App configuration
├── components/
│   ├── ui/                       # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   └── ...
│   ├── shared/                   # Shared across features
│   │   ├── Navbar.tsx
│   │   ├── Footer.tsx
│   │   ├── Layout.tsx
│   │   ├── WhatsAppCTA.tsx
│   │   └── Hero.tsx
│   ├── forms/                    # Reusable form components
│   │   ├── FormField.tsx
│   │   ├── FormSelect.tsx
│   │   └── FormTextarea.tsx
│   └── layout/                   # Layout-specific components
│       ├── PageHeader.tsx
│       └── Section.tsx
├── features/                     # Feature-specific components (NO pages)
│   ├── auth/
│   │   └── components/
│   │       ├── LoginForm.tsx
│   │       ├── RegisterForm.tsx
│   │       └── ForgotPasswordForm.tsx
│   ├── customers/
│   │   └── components/
│   │       ├── CustomerDashboard.tsx
│   │       ├── ProfileForm.tsx
│   │       └── AddressForm.tsx
│   ├── vendors/
│   │   └── components/
│   │       ├── VendorDashboard.tsx
│   │       ├── ProductForm.tsx
│   │       └── CategoryForm.tsx
│   ├── riders/
│   │   └── components/
│   │       ├── RiderDashboard.tsx
│   │       ├── DeliveryCard.tsx
│   │       └── ApplicationForm.tsx
│   ├── deliveries/               # Delivery operations components
│   │   └── components/
│   │       ├── DeliveryForm.tsx
│   │       ├── DeliveryCard.tsx
│   │       └── AssignmentForm.tsx
│   ├── fleet/                    # Fleet management components
│   │   └── components/
│   │       ├── VehicleCard.tsx
│   │       └── VehicleForm.tsx
│   └── notifications/
│       └── components/
│           └── NotificationPanel.tsx
├── pages/                        # ALL page components
│   ├── public/
│   │   ├── Home.tsx
│   │   ├── About.tsx
│   │   ├── Services.tsx
│   │   ├── FoodDelivery.tsx
│   │   ├── GroceryDelivery.tsx
│   │   ├── Courier.tsx
│   │   ├── Restaurants.tsx
│   │   ├── RestaurantDetail.tsx
│   │   ├── GroceryStores.tsx
│   │   ├── GroceryStoreDetail.tsx
│   │   ├── BecomeVendor.tsx
│   │   ├── BecomeRider.tsx
│   │   ├── FAQ.tsx
│   │   └── Contact.tsx
│   ├── auth/
│   │   ├── Login.tsx
│   │   ├── Register.tsx
│   │   └── ForgotPassword.tsx
│   ├── customer/
│   │   ├── Dashboard.tsx
│   │   ├── Profile.tsx
│   │   ├── Addresses.tsx
│   │   ├── Notifications.tsx
│   │   └── Settings.tsx
│   ├── vendor/
│   │   ├── Dashboard.tsx
│   │   ├── BusinessProfile.tsx
│   │   ├── Products.tsx
│   │   ├── Categories.tsx
│   │   ├── Availability.tsx
│   │   └── Settings.tsx
│   ├── rider/
│   │   ├── Dashboard.tsx
│   │   ├── Profile.tsx
│   │   ├── Availability.tsx
│   │   ├── Vehicle.tsx
│   │   ├── Deliveries.tsx
│   │   ├── Earnings.tsx
│   │   └── Settings.tsx
│   └── admin/
│       ├── Dashboard.tsx
│       ├── Customers.tsx
│       ├── Vendors.tsx
│       ├── VendorApplications.tsx
│       ├── Riders.tsx
│       ├── RiderApplications.tsx
│       ├── Deliveries.tsx
│       ├── Deliveries/:id.tsx
│       ├── Fleet.tsx
│       ├── Products.tsx
│       ├── Messages.tsx
│       ├── Reports.tsx
│       ├── Settings.tsx
│       └── AuditLogs.tsx
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
│       └── index.ts
├── hooks/
│   ├── useAuth.ts
│   ├── useProfile.ts
│   ├── useVendors.ts
│   ├── useRiders.ts
│   ├── useDeliveries.ts
│   └── useNotifications.ts
├── stores/
│   ├── authStore.ts
│   └── uiStore.ts
├── types/
│   ├── index.ts
│   ├── database.types.ts
│   ├── vendor.types.ts
│   ├── rider.types.ts
│   └── delivery.types.ts
├── utils/
│   ├── whatsapp.ts
│   ├── validation.ts
│   ├── formatting.ts
│   └── constants.ts
├── config/
│   ├── app.config.ts
│   └── routes.config.ts
├── styles/
│   └── index.css
├── App.tsx
└── main.tsx
```

## Rationale

This architecture is appropriate because:

1. **Feature-based organization** — Groups related functionality together, making it easier to find and maintain code for specific features

2. **Separation of concerns** — Clear separation between UI components, pages, services, hooks, and utilities

3. **Scalability** — Easy to add new features without disrupting existing code

4. **Type safety** — Centralized type definitions ensure consistency across the application

5. **Reusability** — Shared components and utilities reduce code duplication

6. **Testability** — Modular structure makes it easier to test individual components and services

7. **Team collaboration** — Clear structure helps multiple developers work on different features simultaneously

8. **Future-proofing** — Architecture can accommodate future features like mobile apps or additional services

---

# 16. ROUTE STRUCTURE

## Proposed Route Map

```
/                              # Home
/about                         # About page
/services                      # Services overview
/food                          # Food delivery service
/food/:vendorId                # Restaurant detail
/groceries                     # Grocery delivery service
/groceries/:storeId            # Grocery store detail
/courier                       # Courier service
/contact                       # Contact page
/faq                           # FAQ page

/auth/login                    # Login
/auth/register                 # Register
/auth/forgot-password          # Forgot password

/become-vendor                 # Become a vendor
/become-rider                  # Become a rider

/dashboard                     # Customer dashboard
/dashboard/profile             # Customer profile
/dashboard/addresses           # Saved addresses
/dashboard/notifications       # Customer notifications
/dashboard/settings            # Customer settings

/vendor                        # Vendor dashboard
/vendor/profile                # Vendor business profile
/vendor/products               # Product/menu management
/vendor/categories             # Category management
/vendor/availability           # Availability settings
/vendor/settings               # Vendor settings

/rider                         # Rider dashboard
/rider/profile                 # Rider profile
/rider/availability            # Rider availability
/rider/vehicle                 # Vehicle information
/rider/deliveries              # Assigned deliveries
/rider/earnings                # Earnings overview
/rider/settings                # Rider settings

/admin                         # Admin dashboard
/admin/customers               # Customer management
/admin/vendors                 # Vendor management
/admin/vendor-applications     # Vendor applications
/admin/riders                  # Rider management
/admin/rider-applications      # Rider applications
/admin/deliveries              # Delivery management
/admin/deliveries/:id          # Delivery detail
/admin/fleet                   # Fleet/vehicle management
/admin/products                # Product management
/admin/messages                # Contact messages
/admin/reports                 # Reports
/admin/settings                # System settings
/admin/audit-logs              # Audit logs
```

## Protected Routes

**Customer Routes:**
- `/dashboard/*` — Requires customer role

**Vendor Routes:**
- `/vendor/*` — Requires vendor role

**Rider Routes:**
- `/rider/*` — Requires rider role

**Admin Routes:**
- `/admin/*` — Requires admin or super_admin role

## Route Protection Implementation

```typescript
// Route configuration
const protectedRoutes = {
  customer: ['/dashboard'],
  vendor: ['/vendor'],
  rider: ['/rider'],
  admin: ['/admin']
};

// Middleware to check role and redirect
const requireRole = (allowedRoles: string[]) => {
  // Check user role
  // Redirect if not authorized
};
```

---

# 17. UI/UX REQUIREMENTS

## Design Principles

KingdomDash should feel like a serious Nigerian technology/logistics company.

**Key Characteristics:**
- Modern
- Professional
- Clean
- Mobile-first
- Fast
- Accessible
- Easy to navigate
- Trustworthy
- Conversion-focused

## Mobile-First Design

**Critical:** Many customers will access the platform from mobile devices.

**Requirements:**
- Design for mobile screens first
- Test on various screen sizes
- Touch-friendly interactions
- Optimized images for mobile
- Fast loading on mobile networks
- Readable text without zooming
- Accessible buttons and CTAs

## Clear CTAs

**WhatsApp CTAs should be:**
- Prominent
- Clear
- Action-oriented
- Pre-filled with context
- Consistent across the site

**Examples:**
- "Order on WhatsApp"
- "Request Courier on WhatsApp"
- "Contact KingdomDash"

## Navigation

**Requirements:**
- Clear navigation structure
- Easy to find services
- Logical page hierarchy
- Breadcrumbs where appropriate
- Search functionality (future)

## Trust Signals

**Include:**
- Professional design
- Clear contact information
- Business information
- Vendor/rider information
- Professional imagery
- Clear policies

## Performance

**Requirements:**
- Fast page loads
- Optimized images
- Minimal JavaScript
- Efficient CSS
- Code splitting
- Lazy loading

## Accessibility

**Requirements:**
- WCAG 2.1 AA compliance
- Keyboard navigation
- Screen reader support
- Color contrast compliance
- Alt text for images
- ARIA labels where needed

## Color Scheme

**Recommendations:**
- Professional primary color (e.g., deep blue or green)
- High contrast for readability
- Consistent use of colors
- Accessible color combinations

## Typography

**Requirements:**
- Clear, readable fonts
- Consistent font hierarchy
- Appropriate font sizes
- Good line height
- Responsive typography

---

# 18. PERFORMANCE STRATEGY

## Code Splitting

**Implementation:**
- React.lazy() for route-based code splitting
- Dynamic imports for heavy components
- Separate bundles for different routes

```typescript
const Home = lazy(() => import('./pages/public/Home'));
const Dashboard = lazy(() => import('./pages/customer/Dashboard'));
```

## Lazy Loading

**Implementation:**
- Lazy load images
- Lazy load components below the fold
- Intersection Observer for lazy loading

## Image Optimization

**Implementation:**
- Use WebP format where supported
- Responsive images with srcset
- Image compression
- CDN for images (Supabase Storage)
- Lazy loading images

## Caching

**Implementation:**
- Service Worker for offline support (future)
- Browser caching headers
- Vercel edge caching
- Cache API responses with TanStack Query

## API Request Optimization

**Implementation:**
- TanStack Query for caching and deduplication
- Pagination for large datasets
- Select only needed fields from database
- Debounce search inputs
- Cancel pending requests on unmount

## Avoiding Unnecessary Client-Side State

**Implementation:**
- Keep state in URL where appropriate
- Use server state (TanStack Query) instead of client state
- Minimize Zustand store usage
- Prefer URL params over state for filters

## Mobile Performance

**Implementation:**
- Optimize for mobile networks
- Minimize bundle size
- Reduce JavaScript execution
- Optimize images for mobile
- Touch-optimized interactions

## Vercel Deployment Optimization

**Implementation:**
- Enable Vercel Analytics
- Configure build caching
- Use edge functions where appropriate
- Optimize build configuration
- Enable automatic compression

---

# 19. FUTURE-PROOFING

## Architecture for Incremental Enhancement

The architecture must support future expansion without overengineering V1.

## Current V1 Flow

```
Website
   ↓
Customer
   ↓
WhatsApp
   ↓
KingdomDash Operations
   ↓
Rider
```

## Future Flow

```
Website
   ↓
Customer
   ↓
Cart (V1 — Phase 6: Customer Ordering & Cart)
   ↓
Checkout (V1 — Phase 6: Customer Ordering & Cart)
   ↓
Payment via Paystack (V1 — Phase 6: Customer Ordering & Cart)
   ↓
Order (V1)
   ↓
Dispatch (V1)
   ↓
Rider
   ↓
Live Tracking (future)
```

## Database Schema Considerations

**V1 Schema:**
- Designed to accommodate future tables
- Relationships planned for future entities
- Extensible where needed
- No breaking changes for future features

**Future Tables:**
- orders
- order_items
- payments
- delivery_assignments
- delivery_tracking
- reviews
- promotions

## API Considerations

**V1 API:**
- Supabase direct access
- Simple CRUD operations
- No complex business logic in API

**Future API:**
- May add API layer for complex operations
- May add business logic in database functions
- May add separate backend service if needed

## Component Architecture

**V1 Components:**
- Modular and reusable
- Clear separation of concerns
- Easy to extend

**Future Components:**
- Can add cart components
- Can add checkout components
- Can add tracking components
- Can add payment components

## State Management

**V1 State:**
- Minimal client state
- Server state with TanStack Query
- Simple Zustand stores

**Future State:**
- Can add cart state
- Can add checkout state
- Can add tracking state
- Can extend existing stores

## Authentication

**V1 Authentication:**
- Supabase Auth
- Email/password
- Simple role system

**Future Authentication:**
- Can add OAuth providers
- Can add phone authentication
- Can add 2FA
- Can extend role system

## Payment Integration

**V1:**
- No payment integration

**Future:**
- Architecture supports adding Paystack
- Can add payment processing
- Can add refund handling
- Can add payment history

## Mapping Integration

**V1:**
- No mapping (deferred)

**Future:**
- Can add Google Maps or Mapbox
- Can add service area maps
- Can add live tracking
- Can add route optimization

## Mobile Applications

**V1:**
- Web only

**Future:**
- Can share API with mobile apps
- Can reuse business logic
- Can share database
- Can share authentication

---

# 20. IMPLEMENTATION TRACKER

| Phase                    | Status      | Priority | Complexity | Dependencies        |
| ------------------------ | ----------- | -------- | ---------- | ------------------- |
| Phase 0: Requirements & Architecture | Complete | Critical | High       | —                   |
| Phase 1: Foundation      | Not Started | Critical | Medium     | Phase 0             |
| Phase 2: Design System & Public Website | Not Started | Critical | Medium     | Phase 1             |
| Phase 3: Food Delivery   | Not Started | High     | Medium     | Phase 2             |
| Phase 4: Grocery Experience | Not Started | High     | Medium     | Phase 2             |
| Phase 5: Courier Experience | Not Started | High     | Low        | Phase 2             |
| Phase 6: Supabase Backend | Not Started | Critical | High       | Phase 0, Phase 1    |
| Phase 7: Customer Account | Not Started | Medium   | Medium     | Phase 6             |
| Phase 8: Vendor Platform  | Not Started | High     | High       | Phase 6, Phase 7    |
| Phase 9: Rider Platform  | Not Started | High     | High       | Phase 6, Phase 7    |
| Phase 10: Admin Platform | Not Started | Critical | High       | Phase 6, 7, 8, 9    |
| Phase 11: Maps & Location | Not Started | Medium   | High       | Requirements        |
| Phase 12: Testing & Security | Not Started | Critical | High       | Phase 10            |
| Phase 13: Deployment     | Not Started | Critical | Medium     | Phase 12            |
| Phase 14: Launch         | Not Started | Critical | Medium     | Phase 13            |
| Phase 15: Future Expansion | Not Started | Low      | Varies     | V1 Completion       |

---

# 21. DEVELOPMENT RULES

These rules must be followed during implementation:

13. Keep future features clearly separated from V1 (unless explicitly V1).
14. Paystack integration is V1 - follow security architecture (no secret keys in frontend)
15. Maps/location services are V1 - follow provider-agnostic architecture
16. Distance-based pricing is V1 - use configurable rules
17. Online ordering flow is V1 with Paystack payment
18. Do not implement live GPS tracking in V1
19. Do not replace existing Zoho domain
20. Keep architecture scalable but avoid unnecessary overengineering
21. Before making major architectural changes, update this development plan
22. Write tests for critical functionality
23. Follow the established folder structure
24. Use environment variables for all configuration
25. Implement proper error handling
26. Use semantic HTML
27. Follow accessibility best practices
28. Optimize images and assets
29. Use proper Git commit messages
30. Create meaningful pull requests
31. Document complex logic
32. Keep dependencies updated
33. Never expose Paystack secret key in frontend code
34. Never expose Supabase service-role keys
35. Use RLS for database security
36. Validate user input on both client and server
37. Make the website responsive from the beginning
38. Do not hard-code business-critical configuration throughout the codebase
39. Keep WhatsApp configuration centralized
40. Keep future features clearly separated from V1

---

# 22. BUILD ORDER

## Recommended Implementation Order

Based on dependencies and complexity, here is the recommended order for implementing KingdomDash:

### 1. Phase 0: Requirements & Architecture Update
- Update all planning documents with new requirements
- Finalize database schema with new entities
- Define security model with new requirements
- Get stakeholder approval

### 2. Phase 1: Project Foundation & UI Design System
- Set up React + TypeScript + Vite
- Install Tailwind CSS and shadcn/ui
- Configure routing
- Set up folder structure
- Initialize Git and GitHub
- Establish UI design system with updated guidelines

### 3. Phase 2: Supabase Backend & Database
- Set up Supabase project
- Create database schema (including orders, order_items, payments, delivery_pricing_rules, delivery_tracking)
- Implement RLS policies for all new and existing tables
- Configure authentication
- Set up storage
- Generate database types

### 4. Phase 3: Authentication & RBAC
- Implement authentication flow
- Set up role-based access control
- Configure RBAC policies

### 5. Phase 4: Public Website
- Establishes the public-facing UI structure and application shells for V1 capabilities
- Build layout components (Navbar, Footer, Layout)
- Build all public pages with UI-only forms and shells
- Functional cart, ordering, checkout, Paystack payment, maps/location selection, and distance-based pricing are implemented in their respective dedicated phases later in the V1 build sequence
- Establish design system

### 6. Phase 5: Vendor & Product System
- Build vendor registration
- Build vendor dashboard
- Implement product/menu CRUD
- Implement category CRUD
- Add operating hours management
- Add availability toggle

### 7. Phase 6: Customer Ordering & Cart
- Implement shopping cart
- Implement checkout flow
- Integrate Paystack payment
- Implement distance-based delivery fee calculation
- Order placement and confirmation

### 8. Phase 7: Maps & Location Services
- Implement mapping functionality
- Provider-agnostic implementation (Google Maps or Mapbox)
- Customer location selection
- Distance calculation
- Service area display

### 9. Phase 8: Distance-Based Delivery Pricing
- Implement configurable pricing rules
- Admin pricing configuration UI
- Distance calculation integration
- Pricing rule management

### 10. Phase 9: Rider Platform
- Build rider application
- Build rider dashboard
- Implement delivery management
- Implement earnings tracking

### 11. Phase 10: Admin Control Center
- Build admin dashboard
- Implement all admin management features
- Implement approval workflows
- Implement payment management
- Implement pricing rule configuration
- Implement delivery management
- Implement vendor management
- Implement rider management
- Implement fleet management
- Implement service management

### 12. Phase 12: Testing & Security
- Comprehensive testing including Paystack, maps, checkout
- Security audit
- Performance optimization
- Bug fixes
- RLS policy verification

### 13. Phase 13: Deployment
- Deploy to Vercel
- Configure domain
- Set up production environment
- Production testing including Paystack and maps

### 14. Phase 14: Launch
- Pre-launch checklist
- Vendor onboarding
- Rider onboarding
- Platform launch

### 15. Phase 11: Maps & Location (Parallel with V1)
- Already implemented in Phase 7
- Final integration and testing

### 16. Phase 15: Future Expansion
- Implement as business requirements emerge
- Website-based ordering enhancements
- Advanced payment features
- Live tracking
- Mobile apps

---

## END OF DEVELOPMENT PLAN

This document serves as the single source of truth for building KingdomDash. All development decisions should reference this plan. Any changes to the plan should be documented and approved before implementation.

**Document Version:** 2.0  
**Last Updated:** September 2, 2026  
**Status:** Architecture Approved - Ready for Implementation
