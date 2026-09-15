# Design Document — KingdomDash Phase 1 Foundation

## Overview

Phase 1 completes the KingdomDash application foundation: wiring the entry point, building the full
navigation system, implementing every public-facing and shell page, and validating the codebase with a
clean production build. No backend connections (Supabase), authentication, payments (Paystack), maps, or
distance calculations are introduced.

The project already has a Vite + React 19 + TypeScript + Tailwind CSS scaffold with a comprehensive design
token system and a library of shared UI and layout components. This phase layers the routing tree, layout
shell, and page content on top of that foundation.

**Official tagline:** SWIFT IN MOTION  
**Primary brand reference:** `tailwind.config.js` + `src/styles/index.css` (all color tokens)

### Key Constraints

- No Supabase, Paystack, Google Maps, or Mapbox imports anywhere in `src/`
- All forms are controlled (`useState`) with client-side validation only — no network calls
- All colors via SemanticTokens (Tailwind utility classes mapping to CSS custom properties) — no raw hex
  values in any `.tsx`/`.ts`/`.js` file inside `src/` (except `src/styles/index.css`)
- Every page has exactly one `<h1>` element
- Dashboard shells have no auth logic, no fake data, and no backend imports
- Focus management: visible `focus-visible` rings on all interactive elements (defined globally in
  `src/styles/index.css`)

---

## Architecture

### Component and Provider Tree

```
StrictMode
  └── BrowserRouter
        └── QueryClientProvider (client = queryClient from src/lib/query-client.ts)
              ├── App  ← Routes tree (src/App.tsx)
              └── ToastViewport  ← mounted once, outside Routes
```

`ToastViewport` is rendered as a sibling to `<App>` so that toasts overlay all page content regardless of
active route.

### Route Tree

All public, auth, and application routes are wrapped in `PublicLayout`. Dashboard routes render without
`PublicLayout` (bare shell).

```
/                          → PublicLayout > HomePage
/about                     → PublicLayout > AboutPage
/services                  → PublicLayout > ServicesPage
/food                      → PublicLayout > FoodPage
/food/:vendorId            → PublicLayout > FoodDetailPage
/groceries                 → PublicLayout > GroceriesPage
/groceries/:storeId        → PublicLayout > GroceryDetailPage
/courier                   → PublicLayout > CourierPage
/contact                   → PublicLayout > ContactPage
/faq                       → PublicLayout > FaqPage
/become-vendor             → PublicLayout > BecomeVendorPage
/become-rider              → PublicLayout > BecomeRiderPage
/auth/login                → PublicLayout > LoginPage
/auth/register             → PublicLayout > RegisterPage
/auth/forgot-password      → PublicLayout > ForgotPasswordPage
/dashboard/*               → CustomerDashboardPage   (no PublicLayout)
/vendor/*                  → VendorDashboardPage     (no PublicLayout)
/rider/*                   → RiderDashboardPage      (no PublicLayout)
/admin/*                   → AdminDashboardPage      (no PublicLayout)
*                          → PublicLayout > NotFoundPage
```

### State Management

Client state is managed by the existing `UiStore` (Zustand):

- `toasts: ToastItem[]` — toast queue consumed by `ToastViewport`
- `mobileNavOpen: boolean` — drives the `MobileNav` open/close state
- `pushToast`, `dismissToast`, `setMobileNavOpen` — action creators

No server state is used in Phase 1 (all data comes from `mock-catalog.ts`).

### Data Flow for Vendor/Product Pages

```
URL param (:vendorId / :storeId)
  → getVendorById(id) / getRestaurants() / getGroceryStores()  (mock-catalog.ts)
  → VendorCard / ProductCard rendering
  → WhatsAppCta with vendor-name pre-filled message
```

---

## Components and Interfaces

### New Layout Components

#### `src/components/layout/navbar.tsx`

```typescript
// No props — reads UiStore internally
export function Navbar(): JSX.Element
```

- Renders inside a `<header>` with `bg-near-black text-white` and `sticky top-0 z-40`
- Left: `<Logo />` linked to `/`
- Center/Right (desktop, `lg:flex hidden`): `<NavLink>` elements for Home, Services, Food, Groceries,
  Courier, About, Contact; active link styled with `text-primary` via NavLink's `className` callback
  (SemanticToken, not hex)
- Desktop CTA: `<Button asChild><Link to="/food">Order Now</Link></Button>`
- Mobile (`lg:hidden`): hamburger `<button>` with `aria-label="Open navigation menu"` that calls
  `setMobileNavOpen(true)` from `useUiStore`
- All interactive elements have visible `focus-visible` outlines (global CSS handles this)
- No raw hex values

#### `src/components/layout/mobile-nav.tsx`

```typescript
// No props — reads UiStore internally
export function MobileNav(): JSX.Element | null
```

- Returns `null` when `mobileNavOpen === false`
- When open: fixed full-height overlay (`fixed inset-0 z-50`) + slide-in panel
- `role="dialog"` `aria-modal="true"` `aria-label="Navigation menu"` on the panel element
- Close button: `aria-label="Close navigation menu"` calls `setMobileNavOpen(false)`
- Focus trap: `useEffect` hooks `keydown` listener; Tab cycles within drawer only; first focusable element
  receives focus on open (`useRef` + `focus()`)
- Links: all public routes + `/become-vendor` + `/become-rider`; each link calls
  `setMobileNavOpen(false)` then navigates via `<NavLink>` (navigation is implicit on click)
- Implemented with native DOM focus management (no external focus-trap library needed given the small
  interactive surface)

#### `src/components/layout/footer.tsx`

```typescript
// No props
export function Footer(): JSX.Element
```

- `<footer>` with `bg-near-black text-white`
- Top section: `<Logo inverted />` + tagline "SWIFT IN MOTION" + `<WhatsAppCta />`
- Three link columns using `<Link>` from react-router-dom:
  - **Services:** Food (`/food`), Groceries (`/groceries`), Courier (`/courier`)
  - **Company:** About (`/about`), Contact (`/contact`), FAQ (`/faq`)
  - **Join Us:** Become a Vendor (`/become-vendor`), Become a Rider (`/become-rider`)
- Contact row: `appConfig.support.email`, `appConfig.support.phoneDisplay`
- Bottom bar: copyright text with `appConfig.name`
- No raw hex values

#### `src/components/layout/public-layout.tsx`

```typescript
// No props
export function PublicLayout(): JSX.Element
```

- Renders: `<Navbar />` (sticky) → `<MobileNav />` → `<main><Outlet /></main>` → `<Footer />`
- No extra vertical margin/padding between Navbar and the page hero — pages own their own top spacing
- `<main>` has no extra padding, just `flex-1` or `min-h-0`

### Shared Components (existing — referenced, not redesigned)

| Component | File | Used by |
|---|---|---|
| `Hero` | `shared/hero.tsx` | All public page heroes |
| `SectionHeading` | `shared/section-heading.tsx` | Interior sections |
| `ServiceCard` | `shared/service-card.tsx` | Home, Services |
| `VendorCard` | `shared/vendor-card.tsx` | Food, Groceries |
| `ProductCard` | `shared/product-card.tsx` | FoodDetail, GroceryDetail |
| `WhatsAppCta` | `shared/whatsapp-cta.tsx` | Food, Groceries, Courier, Contact, Footer |
| `ComingSoonNotice` | `shared/coming-soon-notice.tsx` | Auth shells, Dashboard shells |
| `StatCard` | `shared/stat-card.tsx` | Available for future use |
| `StatusBadge` | `shared/status-badge.tsx` | Available for future use |

### UI Primitives (existing — referenced, not redesigned)

`Button`, `Card`, `Badge`, `Alert`, `Input`, `Textarea`, `Select`/`SelectTrigger`/`SelectContent`/`SelectItem`,
`FormField`, `Label`, `Separator`, `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent`, `ToastViewport`

---

## Data Models

### Mock Catalog (existing — `src/data/mock-catalog.ts`)

```typescript
interface MockVendor {
  id: string           // slug used as URL param
  name: string
  businessType: 'restaurant' | 'grocery_store'
  description: string
  area: string
  isOpen: boolean
  etaMinutes: number
  categories: string[]
}

interface MockProduct {
  id: string
  vendorId: string     // foreign key → MockVendor.id
  name: string
  description: string
  price: number        // in kobo or naira — formatted with formatNgn()
  category: string
  available: boolean
}
```

**Accessor functions (existing):**
- `getVendorById(id: string): MockVendor | undefined`
- `getProductsByVendor(vendorId: string): MockProduct[]`
- `getRestaurants(): MockVendor[]`
- `getGroceryStores(): MockVendor[]`

### Form State Models (new — local to each page)

All form state is `useState`-managed local state. No global form store.

#### Contact Form (`ContactPage`)

```typescript
interface ContactFormState {
  name: string
  email: string
  phone: string      // optional
  subject: string
  message: string
}
interface ContactFormErrors {
  name?: string
  email?: string
  subject?: string
  message?: string
}
```

#### Become a Vendor Form (`BecomeVendorPage`)

```typescript
interface VendorFormState {
  businessName: string
  businessType: 'restaurant' | 'grocery_store' | ''
  ownerName: string
  email: string
  phone: string
  businessAddress: string
  description: string
}
interface VendorFormErrors {
  businessName?: string
  businessType?: string
  ownerName?: string
  email?: string
  phone?: string
  businessAddress?: string
  description?: string
}
```

#### Become a Rider Form (`BecomeRiderPage`)

```typescript
interface RiderFormState {
  fullName: string
  email: string
  phone: string
  address: string
  vehicleType: 'petrol' | 'electric' | ''
  vehicleMake: string
  vehicleModel: string
}
interface RiderFormErrors {
  fullName?: string
  email?: string
  phone?: string
  address?: string
  vehicleType?: string
  vehicleMake?: string
  vehicleModel?: string
}
```

### UiStore (existing — `src/stores/ui-store.ts`)

```typescript
interface ToastItem {
  id: string
  title: string
  message?: string
  variant: 'info' | 'success' | 'warning' | 'error'
}

interface UiState {
  toasts: ToastItem[]
  mobileNavOpen: boolean
  pushToast(toast: Omit<ToastItem, 'id'>): void
  dismissToast(id: string): void
  setMobileNavOpen(open: boolean): void
}
```

### App Configuration (existing — `src/config/app.config.ts`)

```typescript
const appConfig = {
  name: string           // 'KingdomDash'
  tagline: string        // 'SWIFT IN MOTION'
  url: string
  support: {
    email: string        // 'hello@kingdomdash.com'
    phoneDisplay: string // '+234 800 000 0000'
    hours: string        // 'Monday–Sunday, 8:00 AM – 10:00 PM WAT'
    address: string      // 'Lagos, Nigeria'
  }
  whatsapp: {
    businessNumber: string    // env var or fallback
    defaultMessage: string
  }
}
```

### Page Component Interfaces

Each page is a default-exported React component with no required props. Detail pages read URL params
via `useParams()`.

```typescript
// FoodDetailPage / GroceryDetailPage
const { vendorId } = useParams<{ vendorId: string }>()
// storeId for grocery equivalent
const { storeId } = useParams<{ storeId: string }>()
```

### WhatsApp Link (existing — `src/utils/whatsapp.ts`)

```typescript
function generateWhatsAppLink(message: string): string
// Returns: `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`
// cleanNumber = appConfig.whatsapp.businessNumber with all '+' and spaces stripped
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: WhatsApp link always starts with the correct base URL

*For any* non-null string `message`, `generateWhatsAppLink(message)` SHALL produce a string that starts with `https://wa.me/`.

**Validates: Requirements 22.1, 22.6**

### Property 2: WhatsApp number segment contains no `+` or space characters

*For any* non-null string `message`, the URL produced by `generateWhatsAppLink(message)` SHALL contain no literal `+` or unencoded space characters in the segment between `https://wa.me/` and `?text=`.

**Validates: Requirements 22.2**

### Property 3: Message round-trip encoding

*For any* non-null string `message`, the `text` query-parameter value in the URL produced by `generateWhatsAppLink(message)`, when decoded with `decodeURIComponent`, SHALL equal the original `message` string.

**Validates: Requirements 22.3, 22.4**

### Property 4: Empty message produces a valid URL without a malformed query string

*For any* call to `generateWhatsAppLink("")`, the resulting URL SHALL start with `https://wa.me/` and SHALL NOT contain an orphaned `?text=` with an empty value that breaks URL parsers (i.e., the URL must parse cleanly, and `decodeURIComponent` applied to the text param value must return `""`).

**Validates: Requirements 22.5**

---

## Error Handling

### Vendor / Store Not Found

`FoodDetailPage` and `GroceryDetailPage` call `getVendorById(vendorId)`. When the return value is
`undefined` (unrecognized ID), the page renders an `<ErrorState>` component (or equivalent inline
not-found UI) rather than crashing or silently rendering an empty page.

```tsx
const vendor = getVendorById(vendorId ?? '')
if (!vendor) {
  return <NotFoundVendor />  // inline message + link back to /food or /groceries
}
```

### Form Validation Errors

All three forms (Contact, BecomeVendor, BecomeRider) follow the same pattern:
1. On submit, run synchronous validation over the form state object
2. If any required field is empty (or `businessType`/`vehicleType` is `''`), populate the errors object and
   abort submit — no toast, no network call
3. If validation passes, call `pushToast({ variant: 'success', ... })` to show confirmation and reset
   the form state

`FormField` renders `<p role="alert">` for each field error (already implemented in the existing component).

### Route Not Found

The catch-all `*` route renders `NotFoundPage` — an accessible 404 page with a heading and a `<Link>` back
to `/`.

### WhatsApp Link with Empty String

`generateWhatsAppLink("")` is handled by the existing implementation: `encodeURIComponent("")` returns `""`,
so the URL becomes `https://wa.me/{number}?text=`. This is valid and parseable. The design treats this as
acceptable behavior (empty text param) rather than omitting the `?text=` parameter entirely.

---

## Testing Strategy

### Overview

Phase 1 has two testing concerns:

1. **`generateWhatsAppLink` utility correctness** — a pure function with clear input/output behavior and
   universal properties that hold across the full input space (any string). This is an ideal candidate for
   property-based testing.
2. **Route rendering** — every defined route must render without React error boundaries triggering. This is
   tested as example-based smoke tests, one per route.

### Property-Based Testing

**Library:** [fast-check](https://fast-check.dev/) (MIT, actively maintained, first-class TypeScript support)

**Test runner:** Vitest (already integrated with Vite)

**Install:**
```bash
npm install --save-dev fast-check
```

**Configuration:** Each `fc.assert` / `fc.property` call defaults to 100 runs. No additional configuration
needed for Phase 1.

**Property test file:** `src/utils/__tests__/whatsapp.test.ts`

Each property test is tagged with a comment in the format:
> `// Feature: kingdomdash-phase1-foundation, Property N: <property text>`

#### Property 1 — Link starts with base URL

```typescript
// Feature: kingdomdash-phase1-foundation, Property 1: WhatsApp link always starts with the correct base URL
it('generateWhatsAppLink always returns a string starting with https://wa.me/', () => {
  fc.assert(
    fc.property(fc.string(), (message) => {
      const link = generateWhatsAppLink(message)
      return link.startsWith('https://wa.me/')
    }),
    { numRuns: 100 },
  )
})
```

#### Property 2 — Number segment has no `+` or space

```typescript
// Feature: kingdomdash-phase1-foundation, Property 2: WhatsApp number segment contains no + or space characters
it('generateWhatsAppLink number segment contains no + or space', () => {
  fc.assert(
    fc.property(fc.string(), (message) => {
      const link = generateWhatsAppLink(message)
      const numberSegment = link.slice('https://wa.me/'.length).split('?')[0]
      return !numberSegment.includes('+') && !numberSegment.includes(' ')
    }),
    { numRuns: 100 },
  )
})
```

#### Property 3 — Message round-trip encoding

```typescript
// Feature: kingdomdash-phase1-foundation, Property 3: Message round-trip encoding
it('generateWhatsAppLink message decodes back to original', () => {
  fc.assert(
    fc.property(fc.string(), (message) => {
      const link = generateWhatsAppLink(message)
      const textParam = new URL(link).searchParams.get('text') ?? ''
      return textParam === message
    }),
    { numRuns: 100 },
  )
})
```

#### Property 4 — Empty message produces a valid URL

```typescript
// Feature: kingdomdash-phase1-foundation, Property 4: Empty message produces a valid URL without a malformed query string
it('generateWhatsAppLink with empty string produces a valid, parseable URL', () => {
  const link = generateWhatsAppLink('')
  expect(link.startsWith('https://wa.me/')).toBe(true)
  const url = new URL(link)  // throws if malformed
  expect(decodeURIComponent(url.searchParams.get('text') ?? '')).toBe('')
})
```

### Unit / Smoke Tests

**Test file:** `src/pages/__tests__/routes.test.tsx`

For each route in the route tree, render the full provider-wrapped app with `MemoryRouter` at that path and
assert that no React error boundary was triggered and the page renders a document title or landmark element.

```typescript
// Example pattern (one describe block per route group)
describe('Public routes render without error', () => {
  const routes = ['/', '/about', '/services', '/food', '/groceries', '/courier', '/contact', '/faq']
  routes.forEach((path) => {
    it(`renders ${path}`, () => {
      render(<AppWithProviders initialEntries={[path]} />)
      // assert no error boundary triggered — look for <main> or <h1>
      expect(screen.getByRole('main')).toBeInTheDocument()
    })
  })
})
```

This uses `@testing-library/react` and `vitest` — both are standard in the Vite ecosystem.

**Install testing libraries (if not present):**
```bash
npm install --save-dev @testing-library/react @testing-library/jest-dom vitest jsdom
```

**Vitest config addition (`vite.config.ts`):**
```typescript
test: {
  environment: 'jsdom',
  setupFiles: ['./src/test-setup.ts'],
}
```

### Design Token Discipline

While not an automated test, the no-hex-in-components constraint is validated at build time through the
existing `oxlint` config (`.oxlintrc.json`). A custom lint rule or a simple `grep` CI step can be added to
flag any `#[0-9a-fA-F]{3,6}` pattern in `src/**/*.tsx` excluding `src/styles/index.css`.

### Build Validation

The full test suite for Phase 1 build confidence:

```bash
tsc -b            # TypeScript type-check
npm run lint      # oxlint
vite build        # production bundle
vitest --run      # unit + property tests (single execution, no watch)
vite preview      # manual smoke check
```
