# Design Specification — Phase 4: Public Website

## 1. Architectural Architecture & Component Hierarchy
The public website operates under a unified layout `PublicLayout` containing:
- `Navbar`: Sticky desktop header with dynamic backdrop theme awareness (`dark`/`light`), responsive navigation items, and direct auth/ordering CTAs.
- `MobileNav`: Accessible slide-out dialog with trap-focus navigation, keyboard Escape dismiss, and dark/light adaptive theming.
- `<main className="flex-1">`: Encloses the routed page content with proper accessibility landmarks.
- `Footer`: Comprehensive corporate footer detailing branding, tagline ("SWIFT IN MOTION."), launch market ("Ijebu-Ode, Ogun State, Nigeria"), link clusters, and contact channels.

## 2. Route Topology
```
/                      -> HomePage
/about                 -> AboutPage
/services              -> ServicesPage
/food                  -> FoodPage
/food/:vendorId        -> FoodDetailPage
/groceries             -> GroceriesPage
/grocery               -> GroceriesPage (alias)
/groceries/:storeId    -> GroceryDetailPage
/grocery/:storeId      -> GroceryDetailPage (alias)
/courier               -> CourierPage
/contact               -> ContactPage
/faq                   -> FaqPage
/become-vendor         -> BecomeVendorPage
/become-rider          -> BecomeRiderPage
*                      -> NotFoundPage (404)
```

Direct Auth Aliases (preserve search params):
```
/login                 -> /auth/login
/register              -> /auth/register
/forgot-password       -> /auth/forgot-password
/callback              -> /auth/callback
/update-password       -> /auth/update-password
```

## 3. Design System & Token Compliance
- **Typography**: Display headlines with tight tracking and fluid typography clamp tokens; clean body text (`text-body`, `text-body-small`).
- **Color Palette**: `#E50914` primary red accent, `#0A0A0A` near-black dark surfaces, clean whites, and subtle border dividers.
- **Micro-interactions**: Subtle hover state translations (`group-hover:translate-x-0.5`), pill-shaped button borders, focus visible rings (`focus-visible:ring-2 focus-visible:ring-primary`).
- **SEO Architecture**: `useSeo` hook injects page-specific `<title>` with `" | KingdomDash — SWIFT IN MOTION."` suffix and manages meta description tags.

## 4. Vercel SPA Hosting Resilience
`vercel.json` defines client-side catch-all rewrite:
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```
Ensuring direct URL navigation and browser refreshes on routes like `/about` or `/groceries` don't yield HTTP 404 errors.
