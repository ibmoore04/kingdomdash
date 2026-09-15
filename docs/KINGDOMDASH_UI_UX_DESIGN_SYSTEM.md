# KINGDOMDASH — UI/UX DESIGN SYSTEM

**Version:** 2.0  
**Date:** September 2, 2026  
**Status:** Updated - Pending Implementation Approval

---

# 1. DESIGN SYSTEM OBJECTIVE

Define a single cohesive visual and interaction system for KingdomDash.

KingdomDash is a Nigerian multi-service delivery platform providing:

- Food Delivery
- Grocery Delivery
- Courier Dispatch

It also contains internal operational systems for:

- Riders
- Fleet
- Delivery operations
- Vendors
- Administrators

The UI must feel like one professional platform rather than several unrelated applications.

The design should communicate:

- Speed
- Reliability
- Convenience
- Trust
- Modern technology
- Professional operations
- Nigerian/local relevance without relying on stereotypes

The overall visual direction should be:

**Modern + bold + premium + energetic + trustworthy + operationally clean**

**Official Tagline:** SWIFT IN MOTION

---

# 2. BRAND IDENTITY

The official KingdomDash logo uses:

- Red icon
- White wordmark
- Black background

The official brand red is:

`#FF0000`

Treat this as the primary KingdomDash brand color.

Do NOT replace the official brand red with another primary red.

Supporting red shades may be created for interaction states and accessibility purposes.

Recommended supporting shades:

```text
Brand Red       #FF0000
Deep Red        #CC0000
Dark Red        #990000
Soft Red        #FFF1F1
```

These supporting colors do not replace the official brand red.

## Design Reference: Chowdeck

Chowdeck is used as a **UX/design reference** for simplicity and usability inspiration, NOT as a template to copy.

**Learn from Chowdeck:**
- Simple, user-friendly service discovery
- Mobile-first experience
- Clear navigation patterns
- Practical delivery experience
- Information hierarchy
- Card layouts
- Ordering flow simplicity

**Do NOT copy from Chowdeck:**
- Chowdeck branding
- Chowdeck logo
- Exact colors
- Exact typography
- Exact layouts
- Exact page structures
- Proprietary assets
- Exact illustrations
- Exact component styling
- Exact wording
- Exact UI patterns

**KingdomDash Branding Remains Authoritative:**
The KingdomDash customer-approved color palette is the authoritative visual color system. Chowdeck is only a UX/design reference and must never override KingdomDash branding.

Maintain the established visual relationship between:
- KingdomDash red (#FF0000)
- Black
- White/light surfaces
- Supporting semantic colors

---

# 3. COLOR SYSTEM

Define semantic color tokens rather than scattering raw hex values throughout components.

## Brand

```text
primary
primary-hover
primary-active
primary-soft
primary-foreground
```

Recommended mapping:

```text
primary          #FF0000
primary-hover    #CC0000
primary-active   #990000
primary-soft     #FFF1F1
primary-foreground #FFFFFF
```

## Neutral Palette

```text
black            #000000
near-black       #0A0A0A
dark-surface     #141414
white            #FFFFFF

page-background  #F7F7F7
light-surface    #FAFAFA

text-primary     #111111
text-secondary   #4B5563
text-muted       #6B7280

border           #E5E7EB
```

## Semantic States

Use dedicated semantic colors for:

```text
success
warning
error
info
```

Recommended starting values:

```text
success          #16A34A
warning          #F59E0B
error            #DC2626
info             #2563EB
```

These colors are functional colors and are not part of the primary KingdomDash brand identity.

---

# 4. COLOR USAGE RULES

Use the following visual hierarchy:

**White/light surfaces → primary environment**

**Black/dark surfaces → authority, navigation, footer, premium/high-impact sections**

**Red → action, emphasis, active states, brand identity**

Do not flood interfaces with pure `#FF0000`.

Avoid:

- Entire pages covered in bright red
- Large amounts of pure red text
- Red backgrounds behind large amounts of text
- Making every component red
- Using red for information that is not actionable or important

Red should have meaning.

Primary red should generally be used for:

- Primary CTAs
- Active navigation
- Important actions
- Selected states
- Brand highlights
- Important indicators
- Key service actions

---

# 5. BRAND BALANCE

Use the approximate visual principle:

```text
70% light/white surfaces
20% black/dark/charcoal
10% brand red
```

This is a design guideline, not a strict mathematical requirement.

The interface should remain visually balanced and breathable.

---

# 6. TYPOGRAPHY

Use **Inter** as the primary typeface unless an implementation constraint requires a documented alternative.

Typography should prioritize:

- Readability
- Hierarchy
- Scanning
- Accessibility
- Dashboard usability

Recommended weights:

```text
400 — Regular
500 — Medium
600 — Semibold
700 — Bold
800 — Extra Bold
```

## Typography Scale

```text
Display          48px / 700
H1               36px / 700
H2               30px / 600
H3               24px / 600
H4               20px / 600
Body Large       18px / 500
Body             16px / 400
Body Small       14px / 400
Caption          12px / 400
Label            14px / 500
Button Text      16px / 600
```

Do not use excessive font sizes simply to make pages appear impressive.

---

# 7. DESIGN PRINCIPLES

Document and follow these principles:

### Clarity

Users should immediately understand:

- Where they are
- What they can do
- What happened
- What action comes next

### Hierarchy

Important information should visually dominate secondary information.

### Consistency

Equivalent actions and components should look and behave consistently across the platform.

### Speed

Interfaces should feel fast and responsive.

Avoid unnecessary animations and visual effects.

### Trust

Important operational information should be clear and unambiguous.

### Accessibility

Accessibility must be considered from the beginning rather than added later.

### Mobile-First Responsiveness

The public website must work exceptionally well on mobile devices.

Dashboards must remain usable on smaller screens.

---

# 8. PUBLIC WEBSITE EXPERIENCE

Define the public website as:

**Bold, welcoming, modern and conversion-focused.**

Public pages include:

- Home
- About
- Services
- Food
- Restaurant details
- Groceries
- Store details
- Courier
- Contact
- FAQ
- Become Vendor
- Become Rider

The public website should emphasize:

- Strong visual hierarchy
- Clear CTAs
- Service discovery
- Online ordering
- Paystack payment
- Distance-based delivery pricing
- Trust signals
- Fast navigation
- Mobile usability

Primary CTA examples:

- Order Food
- Explore Groceries
- Send a Package
- Become a Vendor
- Become a Rider
- Chat on WhatsApp

---

# 9. HERO SECTION

Define a reusable hero pattern.

Recommended structure:

```text
Eyebrow / service label
Large headline
Supporting description
Primary CTA
Secondary CTA where appropriate
Supporting visual/content
```

Hero sections may use:

- White backgrounds
- Black backgrounds
- Carefully controlled red accents

Avoid making every page use an identical hero.

Create visual variation while maintaining the same design language.

**Tagline:** SWIFT IN MOTION

May be displayed in hero sections as the official brand tagline.

---

# 10. SERVICE EXPERIENCE

Food, Grocery and Courier must feel like parts of the same KingdomDash platform.

Do NOT create three independent visual identities.

## Food

Primary KingdomDash red remains the dominant brand accent.

Possible supporting imagery:

- Meals
- Restaurants
- Food delivery
- Dining

## Grocery

KingdomDash red remains the primary brand color.

A restrained green accent may be used for small functional indicators where useful.

Green must not replace KingdomDash red as the service's primary brand identity.

## Courier

KingdomDash red remains the primary brand color.

A restrained blue accent may be used for small functional indicators where useful.

Blue must not replace KingdomDash red as the service's primary brand identity.

---

# 11. WHATSAPP ORDERING UX

WhatsApp remains available as a support/contact channel and fallback, but is no longer the primary ordering mechanism.

Primary ordering is now through the website with:
- Online shopping cart
- Paystack payment
- Distance-based delivery pricing
- Order confirmation

WhatsApp is used for:
- Customer support
- Vendor communication
- Rider communication
- Fallback ordering assistance
- General inquiries

WhatsApp CTAs should use the centralized application configuration.

---

# 12. DASHBOARD DESIGN

Dashboards should have a different visual character from the marketing website while remaining part of the same brand.

Recommended structure:

```text
Dark Sidebar
    ↓
Light Main Background
    ↓
White Cards
    ↓
Black/near-black Typography
    ↓
Red Primary Actions
```

Suggested dashboard colors:

```text
Sidebar             #0A0A0A
Main Background     #F7F7F7
Cards               #FFFFFF
Primary Action      #FF0000
Primary Text        #111111
Secondary Text      #4B5563
Muted Text          #6B7280
Borders             #E5E7EB
```

Dashboards should prioritize:

- Information density
- Scannability
- Clear navigation
- Tables
- Filters
- Status indicators
- Actions
- Responsive behavior

---

# 13. CUSTOMER DASHBOARD

The customer dashboard should feel simple and approachable.

Primary areas:

- Overview
- Profile
- Saved Addresses
- Order History
- Service Activity
- Notifications
- Settings

The customer experience should prioritize:
- Simplicity
- Clear order status
- Easy reordering
- Saved address management
- Payment history visibility

Avoid unnecessary operational complexity in the customer experience.

---

# 14. VENDOR DASHBOARD

Vendor dashboard should prioritize business management.

Areas include:

- Overview
- Business Profile
- Products/Menu
- Categories
- Availability
- Operating Hours
- Service Area
- Application Status
- Notifications
- Settings

Use clear empty states when a vendor has no products or activity.

---

# 15. RIDER DASHBOARD

Rider dashboard should prioritize operational clarity.

Areas include:

- Overview
- Availability
- Assigned Deliveries
- Delivery Status
- Delivery History
- Earnings
- Vehicle
- Profile
- Notifications
- Support

Important delivery states should be visually obvious.

Riders should never need to interpret ambiguous status labels.

Do not implement live GPS tracking in V1.

Do not display GPS maps as though live tracking exists.

---

# 16. ADMIN DASHBOARD

The admin interface is a serious operational control center with full CRUD capabilities.

It should prioritize:

- Efficiency
- Information density
- Fast navigation
- Filtering
- Search
- Sorting
- Status management
- Auditability
- Clear actions
- Bulk operations where appropriate

Areas include:

- Overview
- Customers (full CRUD)
- Vendors (full CRUD)
- Vendor Applications (approve/reject)
- Riders (full CRUD)
- Rider Applications (approve/reject)
- Orders (view, manage, status)
- Deliveries (create, assign, manage)
- Services (manage availability)
- Products/Menu (full CRUD)
- Fleet/Vehicles (full CRUD)
- Payments (view, investigate)
- Delivery Pricing Rules (configure)
- Contact Messages
- Support
- Notifications
- Reports
- Settings
- Audit Logs

The admin experience should be powerful but not visually overwhelming. Use progressive disclosure and clear navigation.

**Security Note:** "Full CRUD" means full control within the security boundaries of RLS and database constraints. Admin permissions are enforced at the database level, not just hidden in the UI.

---

# 17. DELIVERY UI

Define a consistent delivery status system.

Delivery statuses:

```text
pending
payment_pending
payment_processing
payment_confirmed
preparing
ready_for_pickup
picked_up
in_transit
delivered
cancelled
```

Payment statuses:

```text
pending
processing
successful
failed
refunded
```

Assignment statuses:

```text
assigned
accepted
rejected
completed
```

Do not combine these two concepts into one status.

Use badges, icons, text and appropriate visual hierarchy.

Never rely on color alone to communicate status.

For example:

```text
✓ Delivered
● In Transit
! Attention
× Cancelled
```

Use accessible labels and text.

---

# 18. LOCATION & MAPS UX

## Location Selection

Users should be able to:
- Select delivery location from saved addresses
- Enter new address manually
- Use current location (with permission)
- View location on map interface
- Confirm pickup and delivery locations

## Map Interface

The map should:
- Show pickup location clearly
- Show delivery destination clearly
- Display calculated distance
- Support address search
- Be responsive on mobile
- Use provider-agnostic implementation (Google Maps or Mapbox)

## Location Confirmation

Before confirming order, users should see:
- Pickup location
- Delivery location
- Calculated distance
- Delivery fee based on distance
- Clear confirmation button

## Saved Addresses

Users can:
- Save frequently used addresses
- Edit saved addresses
- Delete saved addresses
- Set default delivery address

---

# 19. DISTANCE-BASED PRICING UX

## Pricing Transparency

The UI must clearly explain:
- Base delivery fee
- Distance-based charge
- Total delivery fee
- How distance affects pricing

## Fee Display

Show delivery fee breakdown:
- Subtotal (products/services)
- Delivery fee
- Total

Do not surprise users with unexplained fees.

## Pricing Updates

If pricing rules change:
- New pricing applies to new orders
- Historical orders retain their original pricing
- Admin can configure pricing without frontend redeployment

Fleet management is internal.

It should communicate:

- Vehicle identity
- Vehicle status
- Assigned rider
- Availability
- Operational condition

Do not present the fleet as a customer-facing vehicle rental service.

The current rider relationship is based on:

`vehicles.assigned_rider_id`

Do not introduce duplicate rider/vehicle relationship fields.

# 19. CHECKOUT UX

## Order Summary
- Subtotal (products/services)
- Delivery fee (distance-based)
- Total

## Delivery Address
- Selected delivery location
- Option to edit address
- Saved addresses access

## Delivery Fee
- Clear display of delivery fee
- Distance information where relevant
- No surprise fees

## Payment Method
- Paystack payment option
- Payment processing state
- Success/failure feedback

## Order Review
- Summary of items
- Delivery details
- Total price
- Confirm button

---

# 20. PAYMENT STATES

Design states for payment flow:

- **Awaiting Payment:** Customer has initiated checkout, ready to pay
- **Processing:** Payment is being processed by Paystack
- **Successful:** Payment confirmed, order confirmed
- **Failed:** Payment failed, retry option
- **Cancelled:** Order cancelled by customer

Each state should have appropriate visual feedback through:
- Button states
- Toast notifications
- Page messaging
- Iconography

# 19. COMPONENT SYSTEM

Document reusable component categories.

At minimum:

### Navigation

- Navbar
- Sidebar
- Mobile navigation
- Breadcrumbs

### Actions

- Primary Button
- Secondary Button
- Ghost Button
- Destructive Button
- Icon Button

### Order Status

Prepare UX for order status flow:

- **Order Placed:** Order received, payment pending
- **Payment Confirmed:** Payment verified, order confirmed
- **Preparing:** Vendor is preparing the order
- **Assigned:** Rider has been assigned to delivery
- **Picked Up:** Rider has picked up the order
- **In Transit:** Rider is delivering to customer
- **Delivered:** Delivery completed
- **Cancelled:** Order cancelled

Keep delivery status and rider assignment status separate where appropriate.

Use badges, icons, text and appropriate visual hierarchy.

Never rely on color alone to communicate status.

For example:

✓ Delivered
● In Transit
! Attention
× Cancelled

Use accessible labels and text.

### Content

- Card
- Service Card
- Vendor Card
- Product Card
- Stat Card
- Empty State

### Data

- Table
- Status Badge
- Filter
- Search
- Pagination
- Tabs

### Forms

- Input
- Select
- Textarea
- Checkbox
- Radio
- Switch
- Form Field
- Validation Message

### Feedback

- Toast
- Alert
- Dialog
- Confirmation Dialog
- Skeleton
- Loading State
- Error State

Use shadcn/ui where appropriate rather than rebuilding standard components unnecessarily.

---

# 20. BUTTON SYSTEM

Define button hierarchy.

### Primary

Brand red background with white text.

Used for the most important action.

### Secondary

White/light background with dark text and appropriate border.

### Ghost

Minimal visual weight.

### Destructive

Reserved for dangerous or irreversible actions.

Buttons must have:

- Hover state
- Active state
- Disabled state
- Loading state
- Focus state

Never communicate disabled state through color alone.

---

# 21. FORMS

Forms must provide:

- Clear labels
- Helpful placeholders where appropriate
- Validation
- Error messages
- Required-field indicators
- Accessible focus states
- Loading states
- Success feedback

Never rely solely on placeholder text as the label.

---

# 22. CARDS

Cards should be used to group related information.

Avoid excessive card nesting.

Use:

- Consistent padding
- Consistent border radius
- Subtle borders
- Restrained shadows
- Clear hierarchy

Do not turn every section into a floating card.

---

# 23. BORDER RADIUS

Establish a consistent radius system.

Recommended:

```text
Small       6px
Medium      8px
Large       12px
XL          16px
Pill        9999px
```

Use radius intentionally.

Avoid making every element excessively rounded.

---

# 24. SPACING SYSTEM

Use a consistent spacing scale based on multiples of 4px.

Example:

```text
4px
8px
12px
16px
20px
24px
32px
40px
48px
64px
80px
96px
```

Avoid arbitrary spacing values unless there is a clear reason.

---

# 25. ICONOGRAPHY

Use one consistent icon family throughout the application.

Lucide icons are preferred if already included through shadcn/ui conventions.

Icons should:

- Support meaning
- Not replace necessary text
- Have accessible labels when interactive
- Maintain consistent sizing

Do not mix multiple unrelated icon styles.

---

# 26. IMAGERY

Public website imagery should be:

- High quality
- Relevant
- Authentic-looking
- Optimized
- Responsive

Food imagery should look appetizing.

Grocery imagery should communicate variety and convenience.

Courier imagery should communicate speed and reliability.

Do not overload pages with stock imagery.

---

# 27. MOTION

Use motion sparingly.

Appropriate uses:

- Hover feedback
- Page transitions
- Dropdowns
- Dialogs
- Loading indicators
- Subtle card interactions

Avoid:

- Excessive bouncing
- Unnecessary parallax
- Distracting animations
- Animations that slow down task completion

Respect reduced-motion accessibility preferences.

---

# 28. RESPONSIVE DESIGN

Design mobile-first.

Breakpoints should follow the project's Tailwind configuration.

Public website:

- Mobile
- Tablet
- Desktop
- Large desktop

Dashboards:

- Desktop-first operational layout where appropriate
- Responsive tablet layout
- Usable mobile layout

Tables must have an intentional mobile strategy.

Do not simply allow desktop tables to overflow indefinitely.

---

# 29. ACCESSIBILITY

Target WCAG 2.2 AA principles where practical.

Requirements include:

- Semantic HTML
- Keyboard navigation
- Visible focus states
- Sufficient color contrast
- Accessible labels
- Accessible form validation
- Alt text
- Screen-reader-friendly controls
- No color-only status communication
- Reduced-motion support

The red `#FF0000` must not automatically be used for normal body text on white backgrounds if contrast is insufficient.

Use darker supporting reds or black text where accessibility requires it.

---

# 30. LOADING STATES

Every data-dependent interface should have an intentional loading state.

Use:

- Skeletons
- Spinners where appropriate
- Disabled/loading buttons
- Progressive content

Avoid blank screens while data loads.

---

# 31. EMPTY STATES

Every major dashboard list should have a useful empty state.

Example structure:

```text
Icon
Title
Short explanation
Optional action
```

Empty states must explain what the user can do next.

---

# 32. ERROR STATES

Errors should be:

- Understandable
- Actionable
- Non-technical where possible

Do not expose raw database errors to normal users.

Technical details may be logged for developers/admins where appropriate.

---

# 33. NOTIFICATIONS

Notifications should have clear:

- Title
- Message
- Timestamp
- Read/unread state
- Relevant action

Do not overwhelm users with unnecessary notifications.

---

# 34. DARK MODE

Do not implement a full user-facing dark-mode system unless explicitly approved.

The existing brand's black/dark surfaces are part of the visual identity and should not be confused with an application-wide dark theme.

Use dark sections strategically.

---

# 35. PUBLIC VS DASHBOARD VISUAL LANGUAGE

Maintain one brand but two presentation modes.

## Public

```text
Bold
Visual
Marketing-oriented
Spacious
Conversion-focused
```

## Dashboard

```text
Functional
Dense
Structured
Operational
Information-focused
```

Both must share:

- Brand red
- Typography
- Iconography
- Spacing
- Radius
- Component language
- Interaction patterns

---

# 36. V1 PRODUCT LIMITATIONS

The UI must NOT imply that the following features exist in V1:

- Live GPS tracking
- Automated dispatch
- Route optimization
- Customer live delivery tracking
- Customer reviews
- Ratings
- Promotions
- Loyalty points
- Mobile apps

The UI may include:
- Online shopping cart
- Paystack payment checkout
- Distance-based delivery pricing display
- Order placement flow

Do not create placeholder UI that falsely suggests these systems are operational in V1 before the appropriate development phases are complete.

---

# 37. FUTURE-PROOFING

The design system should be extensible for future:

- Online ordering (now V1 with Paystack)
- Payments (now V1 with Paystack)
- GPS tracking (future - not V1)
- Maps (now V1)
- Customer order history (future)
- Reviews (future)
- Promotions (future)
- Mobile applications (future)

However, future features must not visually or technically leak into V1.

---

# 38. TAILWIND / SHADCN IMPLEMENTATION GUIDELINES

The implementation should use semantic design tokens.

Do not scatter hard-coded brand colors throughout JSX.

Prefer semantic tokens such as:

```text
bg-primary
text-primary
border-primary
bg-background
bg-card
text-foreground
text-muted
border-border
```

The exact implementation should follow the installed Tailwind/shadcn configuration.

If CSS variables are used, define the design system centrally.

Brand colors should have one authoritative source.

The KingdomDash customer-approved color palette is the authoritative visual color system. Chowdeck is only a UX/design reference and must never override KingdomDash branding.

Do not replace the approved palette with Chowdeck's colors.

Do not introduce a new color direction simply because Chowdeck is being used as a design reference.

Use the exact KingdomDash palette already documented.

The KingdomDash brand red remains:

```text
#FF0000
```

unless the existing customer-supplied palette document specifies another exact value.

Do not silently change the approved brand colors.

---

# 39. DESIGN TOKEN SOURCE OF TRUTH

Create a clear hierarchy:

```text
Brand Design Tokens
        ↓
Semantic Design Tokens
        ↓
Reusable Components
        ↓
Pages
```

Pages should consume components and tokens rather than defining their own visual systems.

---

# 40. UX RULES

The following rules are mandatory:

1. Never make users guess what a button does.
2. Never hide critical information behind unnecessary interactions.
3. Never use color alone to communicate important states.
4. Never create duplicate UI patterns for the same function.
5. Always provide feedback after important actions.
6. Always handle loading, empty and error states.
7. Keep forms simple.
8. Minimize unnecessary steps.
9. Preserve user input where possible after errors.
10. Make destructive actions require appropriate confirmation.
11. Make mobile interactions comfortable.
12. Do not introduce V1-excluded functionality through UI.
13. Keep public and operational experiences visually related.
14. Prioritize accessibility.
15. Prefer clarity over visual decoration.

---

# 41. UI IMPLEMENTATION RULES FOR WINDSURF

When implementation begins:

- Read this document before creating UI.
- Read `KINGDOMDASH_FINAL_ARCHITECTURE.md`.
- Read `KINGDOMDASH_DEVELOPMENT_PLAN.md`.
- Do not invent a competing design system.
- Do not introduce arbitrary colors.
- Do not introduce arbitrary fonts.
- Do not create feature-specific visual systems without documenting why.
- Reuse components.
- Keep responsive behavior intentional.
- Test interactive states.
- Test keyboard navigation.
- Test mobile layouts.
- Keep design tokens centralized.

If a design decision is not explicitly defined here, choose the option that best preserves the established design principles and document significant decisions.

---

# 42. DESIGN SYSTEM APPROVAL

Status: Approved for UI/UX Implementation

Authority:
KINGDOMDASH_UI_UX_DESIGN_SYSTEM.md

This document defines the approved visual and UX direction for KingdomDash V1.

Any major change to:

- Brand colors
- Typography
- Design language
- Dashboard architecture
- Navigation patterns
- Core interaction patterns

must be documented and approved before implementation.

---

**Document Version:** 1.0  
**Date:** September 2, 2026  
**Status:** Approved for UI/UX Implementation
