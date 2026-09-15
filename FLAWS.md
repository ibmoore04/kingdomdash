# KingdomDash — Code Audit: Flaws, Security Issues, Route Problems & Design Issues

**Audit date:** September 2026  
**Scope:** Full frontend codebase (auth pages, routing, store, utilities, config, shell components)  
**Severity:** CRITICAL → HIGH → MEDIUM → LOW → DESIGN

---

## Table of Contents

1. [Security Flaws](#1-security-flaws)
2. [Route Flaws](#2-route-flaws)
3. [Code / Logic Mistakes](#3-code--logic-mistakes)
4. [Design & Spacing Issues](#4-design--spacing-issues)
5. [Performance Issues](#5-performance-issues)
6. [Accessibility Gaps](#6-accessibility-gaps)
7. [Remediation Summary](#7-remediation-summary)

---

## 1. Security Flaws

---

### SEC-01 — CRITICAL: `account_type` metadata sent on registration can be manipulated by a crafted client

**File:** `src/pages/auth/register.tsx`  
**Line:** `data: { full_name, phone, account_type }`

**Problem:**  
`account_type: accountType` (value: `'customer' | 'rider' | 'vendor'`) is sent directly from the client as Supabase Auth signup metadata. Any user can intercept the request and send `account_type: 'admin'` or `account_type: 'super_admin'`. The `handle_new_user()` trigger in Phase 2 hardcodes `role = 'customer'` for all new registrations — so the **database role is safe** — but:

1. If any future trigger or Edge Function reads `account_type` from `raw_user_meta_data` and uses it for role assignment, this becomes a privilege escalation path.
2. Client-supplied metadata that is never validated server-side is a code smell that will cause confusion and potential bugs.
3. The Phase 3 requirements (Requirement 2.2) explicitly state: metadata must ONLY contain `full_name`. Sending `phone` and `account_type` violates the agreed architecture.

**Solution:**
- Remove `account_type` from signup metadata entirely. The application-level intent (rider/vendor wanting to apply) should be handled post-registration via a separate application flow, not embedded in the signup call.
- Remove `phone` from signup metadata. Phone should be collected via a profile update (`updateProfile`) after email confirmation, where it goes into `public.profiles.phone` via a controlled update path.
- Keep only `data: { full_name: fullName.trim() }` as required by the spec.

---

### SEC-02 — HIGH: `appConfig.url` fallback is `https://kingdomdash.com` — incorrect redirect in development

**File:** `src/config/app.config.ts`, `src/pages/auth/forgot-password.tsx`, `src/pages/auth/register.tsx`  
**Lines:** `url: import.meta.env.VITE_APP_URL || 'https://kingdomdash.com'`

**Problem:**  
When `VITE_APP_URL` is not set (local development), `appConfig.url` falls back to the production URL `https://kingdomdash.com`. This means:
- `emailRedirectTo` on signup sends users to the production site, not localhost.
- Password reset links send the user to production, not the local dev instance.
- Email confirmation links from development signups land on the wrong URL.

This is especially harmful during development because all email-based auth flows silently redirect to production instead of the local environment.

**Solution:**
```typescript
url: import.meta.env.VITE_APP_URL || 
  (import.meta.env.DEV ? 'http://localhost:5173' : 'https://kingdomdash.com'),
```
Or enforce that `VITE_APP_URL` is always required (throw at startup if missing, like the Supabase env vars).

---

### SEC-03 — HIGH: `exchangedCodes` Set in `callback.tsx` is module-level — persists across hot-reloads and tests

**File:** `src/pages/auth/callback.tsx`  
**Lines:** `const exchangedCodes = new Set<string>()`

**Problem:**  
The `exchangedCodes` module-level Set was introduced to prevent React Strict Mode double-invocation. However:
1. In Vite HMR (hot module reload), modules are re-evaluated but the Set may or may not reset depending on HMR behavior.
2. A valid PKCE code that is legitimately navigated to a second time (e.g. user refreshes the callback URL) will be silently rejected by the Set, causing the callback to do nothing — the user sees a permanent spinner.
3. The exported `_resetCallbackIdempotency()` function exposes an internal testing escape hatch at the module level, which is a code smell.

**Solution:**  
Use a `useRef(false)` idempotency guard scoped to the component instance (which was the pattern in the previous version), NOT a module-level Set. The component-scoped ref is torn down when the component unmounts, making it naturally idempotent per mount without persisting across navigations.

Replace:
```typescript
const exchangedCodes = new Set<string>()
```
With (inside the component):
```typescript
const exchanged = useRef(false)
// ...
if (exchanged.current) return
exchanged.current = true
```

---

### SEC-04 — HIGH: `mapAuthError` in `update-password.tsx` exposes the operation name in the error string

**File:** `src/pages/auth/update-password.tsx`  
**Lines:**
```typescript
setError(mapAuthError(updateError, 'Password update failed. Failed to update password'))
setError(mapAuthError(err, 'Password update failed. Failed to update password'))
```

**Problem:**  
The `actionFallback` string passed to `mapAuthError` is `'Password update failed. Failed to update password'` which produces error messages like:
> "Password update failed. Failed to update password failed. Please try again."

This is a sentence construction bug that produces nonsensical output (the word "failed" appears twice) and also partially leaks the operation context. The correct pattern is `mapAuthError(err, 'Password update')`.

**Solution:**
```typescript
setError(mapAuthError(updateError, 'Password update'))
setError(mapAuthError(err, 'Password update'))
```

---

### SEC-05 — MEDIUM: `forgot-password.tsx` success state reveals the email address

**File:** `src/pages/auth/forgot-password.tsx`  
**Line:**
```tsx
If an account exists for <span className="font-semibold text-[#111111]">{email}</span>, we have sent...
```

**Problem:**  
The enumeration-safe design requires identical confirmation regardless of whether the email exists. However, displaying the email address in the success state leaks which email the user typed. While this is the user's own input (low risk), a stricter enumeration-safe implementation would show the same message without mentioning the specific email, since the message format can still subtly differ in some attack scenarios.

More importantly, the requirements document (Requirement 4.2) states: "regardless of whether the email exists" — the message should be identical for any input. Showing the typed email is fine UX but borderline on strict enumeration safety.

**Solution (if strict enumeration safety is required):**
```tsx
<p>If that email is registered, we've sent a password reset link. Check your inbox and spam folder.</p>
```

---

### SEC-06 — MEDIUM: No `autocomplete="current-password"` on login password field

**File:** `src/pages/auth/login.tsx`

**Problem:**  
The password input on login has no `autoComplete` attribute. Password managers use `autocomplete="current-password"` to correctly fill login credentials. Without it, some browsers may not auto-fill the password field correctly, and the browser may treat it as a new-password field.

**Solution:** Add `autoComplete="current-password"` to the login password input.

---

### SEC-07 — LOW: `useAuthStore.setState?.({ isRecoverySession: false })` uses optional chaining on a non-optional method

**File:** `src/pages/auth/update-password.tsx`  
**Line:** `useAuthStore.setState?.({ isRecoverySession: false })`

**Problem:**  
`useAuthStore.setState` is always present on a Zustand store — it is never undefined. Using `?.` (optional chaining) masks any potential future renaming or misconfiguration. It also suggests the developer was unsure whether the method exists, which is a code smell. In a TypeScript codebase with proper types, this should be a plain call.

**Solution:**
```typescript
useAuthStore.setState({ isRecoverySession: false })
```

---

## 2. Route Flaws

---

### ROUTE-01 — HIGH: `/auth/update-password` is publicly accessible without recovery context enforcement at the route level

**File:** `src/App.tsx`

**Problem:**  
`/auth/update-password` is registered as a plain public route. The only protection is the `isRecoverySession` check inside the component's `useEffect`. This means:
1. A user who navigates directly to `/auth/update-password` without going through the recovery flow will briefly render the password form before the `useEffect` fires and redirects. On slow connections, the form may flash.
2. The recovery context check happens in an async effect — there is a render cycle gap.

**Solution:**  
The UpdatePasswordPage itself already handles this correctly (redirects in useEffect). However, to eliminate the flash, the `RouteGuard` should be extended to also protect this route by checking `isRecoverySession`. Alternatively, the component can show a loading state until `isRecoverySession` is confirmed.

---

### ROUTE-02 — MEDIUM: Duplicate route definitions for groceries

**File:** `src/App.tsx`  
**Lines:**
```tsx
<Route path="/grocery" element={<GroceriesPage />} />
<Route path="/grocery/:storeId" element={<GroceryDetailPage />} />
<Route path="/groceries" element={<GroceriesPage />} />
<Route path="/groceries/:storeId" element={<GroceryDetailPage />} />
```

**Problem:**  
Both `/grocery` and `/groceries` resolve to the same page. This means:
- SEO canonical URL is ambiguous (two URLs for the same content).
- Navigation from the app may use one path while external links use another.
- Two identical pages in the router means two lazy-loaded chunks for the same component.

**Solution:**  
Pick one canonical path (e.g. `/groceries`) and redirect the other:
```tsx
<Route path="/grocery" element={<Navigate to="/groceries" replace />} />
<Route path="/grocery/:storeId" element={<Navigate to="/groceries/:storeId" replace />} />
```

---

### ROUTE-03 — MEDIUM: `PageLoader` fallback renders white page with no branding

**File:** `src/App.tsx`  
**Lines:**
```tsx
function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">Loading…</p>
    </div>
  )
}
```

**Problem:**  
When a lazy-loaded page is being fetched, a plain white div with gray "Loading…" text is shown. This is visually jarring — especially on the auth pages which have a cinematic background. The flash of white is noticeable on slower connections.

**Solution:**  
Replace with a branded spinner using the KingdomDash logo and the `bg-near-black` background for auth routes, or at minimum a centered spinner using the `Spinner` component:
```tsx
function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#080607]">
      <img src="/KingdomDash-logo.jpg" alt="" className="h-10 w-auto animate-pulse" />
    </div>
  )
}
```

---

### ROUTE-04 — LOW: Shallow redirect aliases don't encode query params correctly for `update-password`

**File:** `src/App.tsx`  
**Lines:**
```tsx
<Route path="/update-password" element={<RedirectWithQuery to="/auth/update-password" />} />
```

**Problem:**  
`RedirectWithQuery` appends `location.search` to the target. The `/auth/update-password` page doesn't use query params, so this is harmless but adds unnecessary noise to the URL. More importantly, if the Supabase email sends the user to `/update-password?code=...`, the code will be appended to `/auth/update-password?code=...` but the page does not call `exchangeCodeForSession`. The code exchange must happen via `/auth/callback`, not `/auth/update-password`.

**Solution:**  
Ensure all Supabase redirect URLs point to `/auth/callback` only. The `/update-password` alias may be removed if not needed.

---

### ROUTE-05 — LOW: `RouteGuard` renders `<AuthSpinner />` which is not the branded auth spinner

**File:** `src/components/auth/route-guard.tsx`

**Problem:**  
The `AuthSpinner` in `route-guard.tsx` renders a small centered spinner inside `min-h-[60vh]`. When used on a protected route, the page background shows through, which is inconsistent. For dashboard routes, this is acceptable. But there is no visual branding during the auth resolution period.

---

## 3. Code / Logic Mistakes

---

### CODE-01 — HIGH: `SERVICES` array duplicated in both `login.tsx` and `auth-shell.tsx`

**Files:** `src/pages/auth/login.tsx`, `src/components/auth/auth-shell.tsx`

**Problem:**  
The `SERVICES` constant (Food Delivery, Grocery Delivery, Courier Dispatch) is defined twice with identical content. This means a content change needs to be made in two places. The login page does not use `AuthShell` so it has its own copy.

**Solution:**  
Extract `SERVICES` to `auth-shell.tsx` and export it. The `login.tsx` page should import and use the same array:
```typescript
// In auth-shell.tsx
export const AUTH_SERVICES = [...]

// In login.tsx
import { AUTH_SERVICES } from '@/components/auth/auth-shell'
```

---

### CODE-02 — MEDIUM: `login.tsx` uses `<main>` inside `<div>` for the card column but `auth-shell.tsx` also uses `<main>` for the card column

**Files:** Both `login.tsx` and `auth-shell.tsx`  

**Problem:**  
Both files use a `<main>` element for the right-side card column. In a page that uses `AuthShell`, this means there are two nested `<main>` elements in the DOM (one from `AuthShell`, one from the page child). HTML allows only one `<main>` element per document. Having two is an accessibility violation and will cause screen readers to behave unpredictably.

**Solution:**  
In `auth-shell.tsx`, change `<main>` to `<div>` for the card column. The individual auth pages should wrap their card content in `<main>` if needed. Only ONE `<main>` per page. In practice, since auth pages are full-screen login forms, a `<div role="main">` or just a `<main>` at the page level is correct.

---

### CODE-03 — MEDIUM: `callback.tsx` imports `useLocation` but the previous version used `window.location.search` directly

**File:** `src/pages/auth/callback.tsx`

**Problem:**  
The current version uses `useLocation()` to get the search params:
```typescript
const params = new URLSearchParams(location.search)
const code = params.get('code')
```
But then adds `location.search` to the `useEffect` dependency array. This means the exchange effect will re-run if the URL search changes while the component is mounted. If navigation occurs during the exchange (rare but possible), a second exchange attempt could happen with an old search string. The idempotency guard (`exchangedCodes`) partially mitigates this, but the dependency is still fragile.

**Solution:**  
Read `window.location.search` once at mount time inside the effect rather than from the reactive `location.search`:
```typescript
useEffect(() => {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  // ...
}, [navigate]) // no location.search dependency
```

---

### CODE-04 — MEDIUM: `AuthField` component silently applies `INPUT_STYLE_PASSWORD` when `rightSlot` is truthy but `rightSlot` is never used

**File:** `src/components/auth/auth-shell.tsx`

**Problem:**  
The `AuthField` component has a `rightSlot` prop that adjusts the padding style. However, none of the callsites in `register.tsx`, `forgot-password.tsx`, or `update-password.tsx` pass `rightSlot`. The password show/hide toggle in those pages is implemented by using `INPUT_STYLE_PASSWORD` directly on a raw `<input>`, not via `AuthField`. This means `AuthField` has dead code for `rightSlot` that is never exercised and provides false safety.

**Solution:**  
Either remove `rightSlot` from `AuthField` (since it's unused) or properly wire the password toggle through `AuthField` for consistency.

---

### CODE-05 — LOW: `forgot-password.tsx` uses `fieldError` (singular) for the field error state but passes it to `AuthField.error` which expects `string | undefined`

**File:** `src/pages/auth/forgot-password.tsx`  
**Line:** `error={fieldError ?? undefined}`

**Problem:**  
`fieldError` is typed as `string | null` but `AuthField.error` expects `string | undefined`. The `?? undefined` coercion is necessary but only because the state type is `null` rather than `undefined`. This inconsistency with other pages that use `string | undefined` creates unnecessary type conversions.

**Solution:**  
Initialize as `useState<string | undefined>(undefined)` and use `setFieldError(undefined)` for clearing.

---

### CODE-06 — LOW: `register.tsx` has `fieldErrors.accountType` in the type but account type is never validated with an error

**File:** `src/pages/auth/register.tsx`

**Problem:**  
The `fieldErrors` state type includes `accountType?: string` but the validation logic never sets `errors.accountType`. The account type selector always has a default value (`'customer'`) so it cannot be unset. This dead type field adds noise.

**Solution:**  
Remove `accountType?: string` from the `fieldErrors` type since it is never used.

---

### CODE-07 — LOW: `auth-store.ts` `startProfileFetch` is `async` and awaited inside `onAuthStateChange` callback

**File:** `src/stores/auth-store.ts`

**Problem:**  
The `onAuthStateChange` callback is async and `await`s `startProfileFetch()`. Supabase's `onAuthStateChange` callback is not designed to handle async functions safely — the `await` inside it does not block subsequent events and may cause ordering issues if multiple events fire rapidly. The profile fetch correctly uses the generation counter to discard stale results, but the `await` pattern adds unnecessary complexity.

**Solution:**  
Call `startProfileFetch()` without `await` (fire-and-forget). The generation counter already handles race conditions:
```typescript
case 'SIGNED_IN': {
  set({ session, isRecoverySession: false, isLoading: true })
  if (session) {
    const gen = ++fetchGeneration
    void startProfileFetch(session.user.id, gen, set) // no await
  }
  break
}
```

---

## 4. Design & Spacing Issues

---

### DESIGN-01 — Heading font size in the login card is too large relative to card width

**File:** `src/pages/auth/login.tsx`

**Problem:**  
`fontSize: 'clamp(2rem,3.5vw,2.6rem)'` — at viewport widths between 1024px and 1440px, the heading "Welcome back." can break awkwardly or feel oversized relative to the 520px card. `2.6rem` (41.6px) is large for a 520px white card.

**Recommendation:** Cap at `2.2rem` (35.2px) for the card heading:
```css
fontSize: 'clamp(1.75rem,3vw,2.2rem)'
```

---

### DESIGN-02 — `mb-5` on the auth icon badge is inconsistent with `mt-5` gap before the form

**File:** `auth-shell.tsx` (AuthIconBadge), all auth pages

**Problem:**  
The icon badge has `mb-5` baked in. The heading has no `mt-*` between it and the icon. This creates a fixed 20px gap regardless of page context. On pages with error alerts (which add `mt-4` or `mt-5`), the total vertical spacing above the form becomes inconsistent across states (with/without error).

**Recommendation:** Remove `mb-5` from `AuthIconBadge` and let each page control the gap explicitly with `mb-4` or `mb-3` depending on context.

---

### DESIGN-03 — Register page `space-y-5` form fields are too spread out for a viewport-constrained card

**File:** `src/pages/auth/register.tsx`

**Problem:**  
The Register form has 6 fields (name, email, phone, password, confirm password, account type selector) with `space-y-5` (20px gaps). The account type selector with 3 options is tall. On a 768px-height viewport, the card overflows and the right column becomes scrollable, breaking the "no scroll" requirement that was explicitly requested.

**Recommendation:**
- Change `space-y-5` to `space-y-4` (16px) on the register form.
- Reduce the account type option cards from `p-3.5` to `p-2.5`.
- Reduce the account type option icon from `h-10 w-10` to `h-8 w-8`.

---

### DESIGN-04 — `AuthDivider` "SECURE ACCESS" text is visually misleading as a bottom divider on every page

**File:** `auth-shell.tsx`

**Problem:**  
"SECURE ACCESS" as a visual divider between the form and the sign-in/sign-up link is semantically odd. On the callback page, it shows "KINGDOMDASH" instead (correctly). But on forgot-password, the same "SECURE ACCESS" divider appears below a simple email form, which is confusing UX. It implies the divider separates two auth methods (like "OR"), but there's only one.

**Recommendation:** On single-action pages (forgot-password, update-password), use a plain `<hr>` with no text label rather than the "SECURE ACCESS" eyebrow.

---

### DESIGN-05 — `mb-5` before form fields on mobile creates too much space when the mobile brand is hidden on `lg:`

**File:** `auth-shell.tsx` card column

**Problem:**  
The mobile brand lockup (`<div className="flex items-center gap-2 mb-5 lg:hidden">`) adds `mb-5` (20px) before the auth icon on mobile. On small screens where the brand is visible, this is correct. But on tablet (mid-size screens), the brand may or may not be shown depending on breakpoints, and the spacing relationship between the brand and icon can feel crowded.

**Recommendation:** Reduce to `mb-4` on the mobile brand lockup and increase the card top padding slightly to compensate.

---

### DESIGN-06 — Login card heading "Welcome back." splits awkwardly at narrow card widths

**File:** `src/pages/auth/login.tsx`

**Problem:**  
`Welcome <span class="text-[#E50914]">back.</span>` — the heading is on a single line with the red word at the end. At certain viewport widths (around 768–900px wide), the heading wraps unexpectedly because `leading-none` with a large `clamp` font size can cause the heading to break mid-sentence: "Welcome" on one line and "back." on the next, but "back." inherits the red color correctly. The issue is that there is no line-break control.

**Recommendation:** Use `whitespace-nowrap` on the heading when possible, or wrap each part in its own `<span className="block">`:
```tsx
<h2>
  <span className="block">Welcome</span>
  <span className="text-[#E50914] block">back.</span>
</h2>
```

---

### DESIGN-07 — `maxHeight: '100svh'` conflicts with `min-h-svh` creating potential double-constraint

**File:** `src/pages/auth/login.tsx`, `src/components/auth/auth-shell.tsx`

**Problem:**  
Both `min-h-svh` (minimum height = 100svh) and `maxHeight: '100svh'` (maximum height = 100svh) are applied to the outer container. This effectively locks the container to exactly `100svh`. However, `100svh` in browsers like Chrome Mobile changes when the browser chrome (address bar) hides/shows, causing the layout to jump. Additionally, `overflow-hidden` on the outer container combined with `overflow-y-auto` on the card column creates a double-scroll architecture that may not work correctly in all browsers.

**Recommendation:** Use `h-dvh` (dynamic viewport height) instead of `h-svh` / `min-h-svh` for more stable mobile behavior:
```css
h-dvh overflow-hidden
```

---

## 5. Performance Issues

---

### PERF-01 — `fixed` background divs are recreated on every auth page render

**File:** `auth-shell.tsx`

**Problem:**  
Three `position: fixed` divs are created by `AuthShell` on every mount. Since auth pages use a single background image, using CSS `body` background or a persistent background component would be more efficient and would avoid the background flickering on page transitions between auth pages.

**Recommendation:** Move the background to the `body` element via CSS class for auth routes, or use a persistent layout component for auth routes.

---

### PERF-02 — `KingdomDash-logo.jpg` is used as a JPEG instead of SVG/WebP

**File:** All auth pages

**Problem:**  
The logo is a `.jpg` file loaded via `<img src="/KingdomDash-logo.jpg">`. JPEG is not ideal for logos (lossy, no transparency). The logo appears at `h-10` (40px height) and is displayed on a dark background — transparency support would allow the logo to integrate cleanly without white background artifacts.

**Recommendation:** Convert the logo to SVG or WebP with transparency. Use the existing `src/components/layout/logo.tsx` component instead of raw `<img>` tags scattered across auth pages.

---

## 6. Accessibility Gaps

---

### A11Y-01 — `AuthIconBadge` has `aria-hidden="true"` but it contains meaningful semantic context

**File:** `auth-shell.tsx`

**Problem:**  
`AuthIconBadge` wraps a `LockKeyhole`, `UserPlus`, `KeyRound` etc. icon with `aria-hidden="true"`. These icons are purely decorative — correct. However, screen readers navigating the page will read the heading ("Create a new password") without any icon announcement, which is fine. But the icon container is `inline-flex` and interactive-looking. This is acceptable as long as it truly has no interactive purpose.

---

### A11Y-02 — Password field on login has no `aria-label` or visible label for screen readers when `labelFor` pattern is in a `flex justify-between` container

**File:** `src/pages/auth/login.tsx`

**Problem:**  
The password label and "Forgot password?" link are in a `<div className="flex items-center justify-between mb-1.5">`. The `<label htmlFor="login-password">` is inside this flex container. Some screen readers may not correctly associate the label with the input because the flex container interrupts the standard label-input DOM relationship.

**Solution:**  
Keep the `htmlFor="login-password"` label associated correctly (it IS correctly associated in HTML since `htmlFor` is a direct reference), but verify with screen reader testing. The implementation is technically correct — this is a note to verify, not a guaranteed bug.

---

### A11Y-03 — Account type selector uses `role="radio"` on `<button>` elements without a `<fieldset>` + `<legend>`

**File:** `src/pages/auth/register.tsx`

**Problem:**  
The account type selector uses `role="radiogroup"` on a `<div>` and `role="radio"` on `<button>` elements. This is valid ARIA, but the group label (`aria-label="What would you like to do on KingdomDash?"`) is duplicated — once on the `<label>` element above and once on the `role="radiogroup"`. The visible label is a `<label>` but it's not linked to the `radiogroup` via `aria-labelledby`.

**Solution:**
```tsx
<div
  role="radiogroup"
  aria-labelledby="account-type-label"
>
  <span id="account-type-label" ...>What would you like to do on KingdomDash?</span>
  {/* options */}
</div>
```

---

### A11Y-04 — Error focus on the forgot-password field error — `errorRef` is never attached to anything

**File:** `src/pages/auth/forgot-password.tsx`

**Problem:**  
```typescript
const errorRef = useRef<HTMLDivElement>(null)
useEffect(() => {
  if (fieldError && errorRef.current) {
    errorRef.current.focus()
  }
}, [fieldError])
```
However, the `fieldError` is displayed as:
1. A standalone `<div>` alert above the form with `ref={errorRef}` — but looking at the code, the `fieldError` is passed to `AuthField.error` which renders it as a `<p>` below the input. The `errorRef` div with `role="alert"` is a SEPARATE element that only shows when `fieldError` exists.

The issue is the `AuthField` component also renders its own error paragraph. So the error appears TWICE: once in the alert div (focused) and once below the input via `AuthField`. This creates a double error announcement for screen readers.

**Solution:**  
Either use `AuthField` for the field error (via the `error` prop) OR use the standalone alert div — not both. Since the standalone alert with `role="alert"` provides focus management, use that and remove the `error` prop from `AuthField`:

```tsx
{fieldError && (
  <div ref={errorRef} tabIndex={-1} role="alert" ...>{fieldError}</div>
)}
<AuthField ... error={undefined} /> {/* no error on field itself */}
```

---

## 7. Remediation Summary

| ID | Severity | File | Fix Required |
|---|---|---|---|
| SEC-01 | CRITICAL | `register.tsx` | Remove `account_type` and `phone` from signup metadata |
| SEC-02 | HIGH | `app.config.ts` | Fix `VITE_APP_URL` fallback for dev environments |
| SEC-03 | HIGH | `callback.tsx` | Replace module-level `Set` with component-scoped `useRef` |
| SEC-04 | HIGH | `update-password.tsx` | Fix `mapAuthError` action string (double "failed") |
| SEC-05 | MEDIUM | `forgot-password.tsx` | Consider not showing typed email in success state |
| SEC-06 | MEDIUM | `login.tsx` | Add `autoComplete="current-password"` to password input |
| SEC-07 | LOW | `update-password.tsx` | Remove `?.` optional chaining on `setState` |
| ROUTE-01 | HIGH | `App.tsx` | Guard `/auth/update-password` against flash before redirect |
| ROUTE-02 | MEDIUM | `App.tsx` | Remove duplicate `/grocery` routes, redirect to `/groceries` |
| ROUTE-03 | MEDIUM | `App.tsx` | Replace `PageLoader` with branded fallback |
| ROUTE-04 | LOW | `App.tsx` | Remove `/update-password` alias or ensure it doesn't receive `?code=` |
| ROUTE-05 | LOW | `route-guard.tsx` | Style `AuthSpinner` with a branded background |
| CODE-01 | HIGH | `login.tsx` + `auth-shell.tsx` | Extract and export single `SERVICES` array |
| CODE-02 | MEDIUM | `auth-shell.tsx` | Fix double `<main>` element per page |
| CODE-03 | MEDIUM | `callback.tsx` | Use `window.location.search` snapshot, not reactive `location.search` |
| CODE-04 | MEDIUM | `auth-shell.tsx` | Remove unused `rightSlot` from `AuthField` or use it consistently |
| CODE-05 | LOW | `forgot-password.tsx` | Use `string \| undefined` not `string \| null` for field error state |
| CODE-06 | LOW | `register.tsx` | Remove dead `accountType` from `fieldErrors` type |
| CODE-07 | LOW | `auth-store.ts` | Don't `await` profile fetch inside `onAuthStateChange` |
| DESIGN-01 | DESIGN | `login.tsx` | Reduce heading clamp to `1.75rem–2.2rem` |
| DESIGN-02 | DESIGN | `auth-shell.tsx` | Remove `mb-5` from `AuthIconBadge`, let pages control gap |
| DESIGN-03 | DESIGN | `register.tsx` | Reduce `space-y-5` to `space-y-4` for register form |
| DESIGN-04 | DESIGN | `auth-shell.tsx` | Use plain divider on single-action pages |
| DESIGN-05 | DESIGN | `auth-shell.tsx` | Reduce mobile brand `mb-5` to `mb-4` |
| DESIGN-06 | DESIGN | `login.tsx` | Add line-break control to heading |
| DESIGN-07 | DESIGN | `login.tsx` + `auth-shell.tsx` | Use `h-dvh` instead of `h-svh` for mobile stability |
| PERF-01 | PERFORMANCE | `auth-shell.tsx` | Consider persistent background element |
| PERF-02 | PERFORMANCE | All auth pages | Replace JPEG logo with SVG/WebP, use `Logo` component |
| A11Y-01 | ACCESS | `auth-shell.tsx` | Icons correctly marked `aria-hidden`; verify no functional icons hidden |
| A11Y-02 | ACCESS | `login.tsx` | Verify screen reader label association in flex container |
| A11Y-03 | ACCESS | `register.tsx` | Link visible label to `radiogroup` via `aria-labelledby` |
| A11Y-04 | ACCESS | `forgot-password.tsx` | Fix double error display — alert div AND AuthField error |

---

*Generated by full code inspection, September 2026.*
