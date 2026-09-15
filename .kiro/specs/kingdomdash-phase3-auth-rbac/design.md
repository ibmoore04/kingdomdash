# Design Document — KingdomDash Phase 3: Authentication & RBAC

**Feature:** `kingdomdash-phase3-auth-rbac`
**Workflow:** Requirements-First
**Status:** Corrected — implementation-ready

---

## 1. Overview and Scope

Phase 3 wires the three existing Phase 1 auth page shells to Supabase Auth using the PKCE flow, redesigns `forgot-password.tsx` from its `ComingSoonNotice` stub, adds two new auth pages (`/auth/callback`, `/auth/update-password`), creates a Zustand auth store, and adds React Router route guards enforcing authentication and role-based dashboard routing.

**What Phase 3 does not touch:**
- Phase 2 database, RLS, migrations, or SECURITY DEFINER functions
- `login.tsx` and `register.tsx` visual layout, class names, or structural markup
- OAuth, phone auth, dashboard UI, shopping cart, Paystack, or maps

**Security boundary.** React Router guards and the Zustand auth store are UX navigation mechanisms only. All real authorization is enforced by Supabase PostgreSQL RLS and SECURITY DEFINER functions from Phase 2. A client-side session or role value grants no database privileges — RLS evaluates every query independently.

**Authoritative backend properties (Phase 2 — read-only from Phase 3's perspective):**
- `profiles.role` defaults to `'customer'` via `handle_new_user()` trigger
- `profiles.is_active` defaults to `true` via `handle_new_user()` trigger
- Phase 2 RLS policy `profiles_update_own` prevents clients from changing `role` or `is_active`
- The frontend treats `role` and `is_active` as read-only fields

---

## 2. Supabase Client Configuration

### 2.1 Selected Flow: PKCE with Manual Callback Exchange

**Decision:** `detectSessionInUrl: false` combined with explicit `exchangeCodeForSession(code)` in `/auth/callback`.

**Rationale:** With `detectSessionInUrl: true`, `@supabase/supabase-js` automatically attempts to exchange a PKCE code from the URL on page load. If `/auth/callback` also calls `exchangeCodeForSession(code)` manually, two attempts race to consume the same one-time code. The second will fail with an expired/already-used error. Setting `detectSessionInUrl: false` makes the callback page the single, controlled exchange point — no race is possible.

### 2.2 Client Options

```typescript
// Additive change to existing client.ts — existing export and env-var validation unchanged
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,  // Manual exchange only — see /auth/callback
  },
})
```

### 2.3 Redirect URL

The `redirectTo` URL for `resetPasswordForEmail()` is `appConfig.url + '/auth/callback'` (e.g. `https://app.kingdomdash.com/auth/callback`). This URL must be registered in Supabase Dashboard → Auth → URL Configuration → Redirect URLs.

---

## 3. Architecture

### 3.1 Initialization Ordering

```
1. client.ts imported → supabase client created
2. auth-store.ts imported by App.tsx
   → create() runs synchronously
   → onAuthStateChange subscription established
   → isLoading = true
3. App.tsx renders
   → RouteGuard reads isLoading=true → shows spinner
4. Supabase emits INITIAL_SESSION (guaranteed after subscription is registered)
   → Auth Store handles event
   → session: non-null → startFetch()
   → session: null → isLoading = false
5. Profile fetch resolves
   → isLoading = false
   → RouteGuard re-evaluates → shows content or redirects
```

Supabase guarantees `INITIAL_SESSION` is emitted to the listener after the subscription is established. No race between store initialization and the initial event is possible using this pattern.

### 3.2 Auth State Machine

```
States: Initializing, Unauthenticated, FetchingProfile,
        Authenticated, RecoveryMode, ProfileError

[*] → Initializing
  (app mounts; subscription established; isLoading=true)

Initializing → Unauthenticated
  (INITIAL_SESSION null → isLoading=false)

Initializing → FetchingProfile
  (INITIAL_SESSION non-null → startFetch)

FetchingProfile → Authenticated
  (profile fetch succeeds and is_active=true)

FetchingProfile → ProfileError
  (profile fetch fails; profileError set; isLoading=false)

FetchingProfile → Unauthenticated
  (SIGNED_OUT fires during fetch; fetch ID invalidated; result discarded)

Authenticated → RecoveryMode
  (PASSWORD_RECOVERY event; isRecoverySession=true)

Authenticated → FetchingProfile
  (USER_UPDATED received → re-fetch public.profiles)

Authenticated → Unauthenticated
  (SIGNED_OUT)

RecoveryMode → Unauthenticated
  (signOut() after successful updateUser, or SIGNED_OUT)

ProfileError → Unauthenticated
  (RouteGuard calls signOut() once; no automatic retry)

Unauthenticated → FetchingProfile
  (SIGNED_IN)
```

---

## 4. Auth Store (`src/stores/auth-store.ts`)

### 4.1 State Interface

```typescript
import type { Session } from '@supabase/supabase-js'

export interface Profile {
  id:         string
  email:      string
  full_name:  string
  phone:      string | null
  avatar_url: string | null
  role:       'customer' | 'vendor' | 'rider' | 'admin' | 'super_admin'
  is_active:  boolean   // read-only: backend-controlled via Phase 2 RLS
  created_at: string
  updated_at: string
}

export type UserRole = Profile['role']

interface AuthState {
  session:           Session | null
  profile:           Profile | null
  isLoading:         boolean
  isRecoverySession: boolean
  profileError:      Error | null

  signOut: () => Promise<void>
}
```

`isAuthenticated` is derived by consumers: `const isAuthenticated = session !== null`. It is not stored to avoid divergence.

### 4.2 Fetch Generation Counter

A module-level integer prevents stale profile responses from overwriting newer state.

```
Events that INVALIDATE (increment counter, stop in-flight fetch):
  SIGNED_OUT
  signOut() called

Events that START a new fetch (increment counter, initiate request):
  INITIAL_SESSION with non-null session
  SIGNED_IN
  PASSWORD_RECOVERY
  USER_UPDATED

Events that PRESERVE profile without re-fetching:
  TOKEN_REFRESHED (update session only; profile data unchanged)

Race guarantee A — SIGNED_IN then SIGNED_OUT before fetch completes:
  SIGNED_IN  → counter=1, fetch id=1
  SIGNED_OUT → counter=2, session cleared
  fetch(id=1) resolves → id(1) ≠ counter(2) → discarded ✓

Race guarantee B — USER_UPDATED before SIGNED_IN fetch completes:
  SIGNED_IN    → counter=1, fetch A id=1
  USER_UPDATED → counter=2, fetch B id=2
  fetch A resolves → id(1) ≠ counter(2) → discarded ✓
  fetch B resolves → id(2) = counter(2) → written ✓
```

### 4.3 Auth Event Handlers

| Event | session | isRecoverySession | isLoading | Action |
|---|---|---|---|---|
| `INITIAL_SESSION` (non-null) | updated | unchanged | true | `startFetch` |
| `INITIAL_SESSION` (null) | null | false | false | clear state |
| `SIGNED_IN` | updated | **false** | true | `startFetch` |
| `SIGNED_OUT` | null | false | false | `invalidate()`, clear all |
| `TOKEN_REFRESHED` | updated | unchanged | unchanged | session replaced; **no fetch** |
| `PASSWORD_RECOVERY` | updated | **true** | true | `startFetch` |
| `USER_UPDATED` | updated | unchanged | true | `startFetch` (re-read `public.profiles`) |

**TOKEN_REFRESHED:** Session JWT is replaced. Profile has not changed. No database round-trip needed. Subsequent requests carry the new JWT and remain subject to RLS.

**USER_UPDATED:** Relates to `auth.users` being updated. Re-fetching `public.profiles` gets the latest `role` and `is_active` from the database. The client never trusts locally-computed authorization values — the fetch result from `public.profiles` (via RLS) is the only source.

### 4.4 signOut() Action

Navigation is the **caller's** responsibility. The store has no React Router dependency.

```typescript
signOut: async () => {
  // 1. Invalidate any in-flight profile fetch immediately
  invalidate()   // increments fetchGeneration

  // 2. Attempt remote sign-out — failure is swallowed
  try {
    await supabase.auth.signOut()
  } catch { /* intentional: user must be able to log out even on network error */ }

  // 3. Clear all local auth state unconditionally
  set({
    session:           null,
    profile:           null,
    profileError:      null,
    isRecoverySession: false,
    isLoading:         false,
  })

  // 4. Caller navigates (RouteGuard / UpdatePasswordPage / sign-out button)
}
```

### 4.5 Profile Fetch Failure

- `profileError` set, `profile = null`, `isLoading = false`
- No automatic retry — retry only on a new auth event
- `RouteGuard` detects `session ≠ null && profile === null && profileError ≠ null` → calls `signOut()` once → redirects to `/auth/login`
- `signOut()` invalidates the fetch ID so any late response is discarded

---

## 5. Safe Redirect (`src/utils/safe-redirect.ts`)

### 5.1 Validation Rules

```typescript
export function validateRedirectPath(path: string | null | undefined): string | null {
  if (!path || typeof path !== 'string') return null

  let decoded: string
  try { decoded = decodeURIComponent(path) }
  catch { return null }  // malformed encoding

  if (!decoded.startsWith('/'))  return null   // must be relative
  if (decoded.startsWith('//'))  return null   // protocol-relative
  if (/javascript:|data:|vbscript:/i.test(decoded)) return null  // dangerous scheme
  if (/^[a-zA-Z][a-zA-Z0-9+\-.]*:/i.test(decoded.slice(1))) return null  // any scheme

  // Same-origin check
  try {
    const url = new URL(decoded, window.location.origin)
    if (url.origin !== window.location.origin) return null
  } catch { return null }

  return decoded
}
```

### 5.2 Role Compatibility Check

A valid internal path is not automatically an authorized path. A customer with `?redirect=/admin` should land on `/dashboard`.

```typescript
export function resolvePostLoginTarget(
  redirectParam: string | null,
  profile: Profile,
): string {
  const safe = validateRedirectPath(redirectParam)
  if (!safe) return roleDashboardPath(profile.role)

  // If redirect points to a dashboard belonging to another role, ignore it
  const allDashboardRoots = ['/dashboard', '/vendor', '/rider', '/admin']
  const ownDashboard = roleDashboardPath(profile.role)
  const pointsToDashboard = allDashboardRoots.some(
    d => safe === d || safe.startsWith(d + '/')
  )
  if (pointsToDashboard && !safe.startsWith(ownDashboard)) {
    return ownDashboard
  }

  return safe
}
```

### 5.3 Encoding for RouteGuard Redirect

```typescript
const encodedPath = encodeURIComponent(location.pathname + location.search)
navigate(`/auth/login?redirect=${encodedPath}`, { replace: true })
```

---

## 6. Route Guard (`src/components/auth/route-guard.tsx`)

### 6.1 Role Dashboard Map

```typescript
export const ROLE_DASHBOARD_MAP: Record<UserRole, string> = {
  customer:    '/dashboard',
  vendor:      '/vendor',
  rider:       '/rider',
  admin:       '/admin',
  super_admin: '/admin',
}
export const roleDashboardPath = (role: UserRole) => ROLE_DASHBOARD_MAP[role] ?? '/dashboard'
```

### 6.2 Decision Tree

```
1. isLoading === true
   OR (session ≠ null AND profile === null AND profileError === null)
   → <AuthSpinner />
   (auth state still resolving; prevent premature redirect)

2. session === null
   → navigate('/auth/login?redirect=' + encodeURIComponent(currentPath), { replace })
   (unauthenticated)

3. session ≠ null AND profile === null AND profileError ≠ null
   → call signOut() once (signOutInitiated.current guard prevents loops)
   → navigate('/auth/login', { replace })
   (session exists but profile unresolvable — treated as auth failure)

4. profile.is_active === false
   → call signOut() once
   → navigate('/auth/login', { replace })
   Note: frontend never modifies is_active; this is a read from public.profiles
   enforced read-only by Phase 2 RLS

5. allowedRoles defined AND profile.role NOT IN allowedRoles
   → navigate(roleDashboardPath(profile.role), { replace })
   (authenticated, active, but wrong role)

6. All conditions satisfied
   → <Outlet />
   This is the ONLY code path that renders protected content.
```

`signOutInitiated: useRef<boolean>` prevents repeated `signOut()` calls from steps 3 and 4 if the component re-renders before navigation completes.

---

## 7. Auth Pages

### 7.1 Login Page — Additions to Existing Layout

**Zero layout changes.** All existing class names, elements, and structure are preserved. The following are purely additive.

New state: `showPassword`, `isLoading`, `error: string|null`, `fieldErrors`, `errorRef`.

**handleSubmit pattern:**
- Client-side validation first (non-empty email, non-empty password)
- `supabase.auth.signInWithPassword({ email, password })`
- Error mapping (see Section 10)
- On success: `SIGNED_IN` event → Auth Store → profile fetch → `useEffect` detects session+profile and navigates

**useEffect for already-authenticated redirect:**
```typescript
useEffect(() => {
  if (session && profile?.is_active) {
    navigate(resolvePostLoginTarget(
      new URLSearchParams(location.search).get('redirect'),
      profile
    ), { replace: true })
  }
}, [session, profile])
```

**Structural additions (no removals):**
- `<form>` gains `aria-label`
- `Alert` component above form, `tabIndex={-1}`, `ref={errorRef}`, focused on error via `useEffect`
- Field-level `<p>` error messages with `id` matching `aria-describedby` on inputs
- `<label>` elements gain `htmlFor`
- Password input wrapped in `<div className="relative">` for show/hide toggle icon; input gets `pr-11`
- `Button` gains `loading={isLoading}` and loading-state `aria-label`

### 7.2 Register Page — Additions to Existing Layout

Same constraint: zero layout changes.

**Security constraint:**
```typescript
await supabase.auth.signUp({
  email,
  password,
  options: { data: { full_name: name.trim() } },  // ONLY full_name
  // Never send: role, is_active, vendor_id, rider_id, admin flags
})
```

On success: show confirmation panel inside the existing card (form body replaced, card header/footer unchanged).

### 7.3 Forgot Password — Full Redesign from Stub

Matches the login/register visual pattern: `/kingdomDash-login.jpg` background, dark overlay, `rounded-xl border border-border bg-card/95 p-8 shadow-card` card.

**Enumeration prevention:** `handleSubmit` always transitions to `submitted = true` regardless of API result. The confirmation message is identical whether the email exists or not.

```typescript
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault()
  if (!email.trim()) { setFieldError('Email is required'); return }
  setIsLoading(true)
  try {
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${appConfig.url}/auth/callback`,
    })
  } finally {
    setIsLoading(false)
    setSubmitted(true)  // Always show confirmation
  }
}
```

### 7.4 Auth Callback Page (`/auth/callback`) — New

Full-page spinner only. Handles PKCE code exchange.

**Idempotency mechanism:** `exchanged: useRef<boolean>` checked at the top of the mount effect. If `exchanged.current` is already `true`, the effect body returns without calling `exchangeCodeForSession` again. This makes the page safe under React Strict Mode (which double-invokes effects in development).

**Exchange effect (runs once on mount):**
```typescript
useEffect(() => {
  if (exchanged.current) return
  exchanged.current = true

  let cancelled = false
  const code = new URLSearchParams(window.location.search).get('code')

  if (!code) {
    pushToast({ variant: 'error', title: 'Invalid link', message: 'Required information is missing.' })
    navigate('/auth/login', { replace: true })
    return
  }

  supabase.auth.exchangeCodeForSession(code)
    .then(({ error }) => {
      if (cancelled) return
      if (error) {
        pushToast({ variant: 'error', title: 'Link expired or already used',
                    message: 'Please request a new link.' })
        navigate('/auth/login', { replace: true })
      }
      // Success: onAuthStateChange fires PASSWORD_RECOVERY or SIGNED_IN
      // Reaction effect below handles navigation
    })

  return () => { cancelled = true }  // cleanup on unmount
}, [])
```

**Reaction effect (responds to auth store state):**
```typescript
useEffect(() => {
  if (isLoading) return  // still resolving

  if (isRecoverySession) {
    navigate('/auth/update-password', { replace: true })
    return
  }

  if (session && profile) {
    pushToast({ variant: 'success', title: `Welcome, ${profile.full_name}!` })
    navigate(roleDashboardPath(profile.role), { replace: true })
  }
}, [isRecoverySession, session, profile, isLoading])
```

**Password recovery sequence:**
```
User clicks reset link in email
→ /auth/callback?code=<pkce_code>
→ exchanged.current: false → set true; extract code
→ exchangeCodeForSession(code)
→ Supabase emits PASSWORD_RECOVERY event
→ Auth Store: isRecoverySession=true, session updated, profile fetch started
→ Reaction effect: isLoading false, isRecoverySession true
→ navigate('/auth/update-password', { replace: true })
```

**Email confirmation sequence:**
```
User clicks confirmation link in email
→ /auth/callback?code=<pkce_code>
→ exchangeCodeForSession(code)
→ Supabase emits SIGNED_IN event
→ Auth Store: session updated, isRecoverySession=false, profile fetch started
→ Reaction effect: isLoading false, session+profile present
→ navigate(roleDashboardPath(profile.role), { replace: true })
```

### 7.5 Update Password Page (`/auth/update-password`) — New

Matches login/register visual pattern. Checks `isRecoverySession` before rendering the form.

**Guard (runs on mount and when isRecoverySession changes):**
```typescript
const signOutInitiated = useRef(false)
useEffect(() => {
  if (!isRecoverySession && !signOutInitiated.current) {
    navigate('/auth/login', { replace: true })
  }
}, [isRecoverySession])
```

**Completion sequence (atomic from user perspective):**
```typescript
// On successful updateUser:
useAuthStore.setState({ isRecoverySession: false })  // clear recovery flag first
signOutInitiated.current = true                       // prevent guard loop
await useAuthStore.getState().signOut()               // clear session and local state
pushToast({ variant: 'success', title: 'Password updated',
            message: 'Sign in with your new password.' })
navigate('/auth/login', { replace: true })
```

**Why sign out after update:** The recovery session is still active after `updateUser()`. Signing out clears it completely and prevents the recovery context from persisting. The user is directed to log in fresh with their new credentials.

---

## 8. App.tsx Route Updates

```tsx
<Routes>
  {/* Full-screen auth — no PublicLayout */}
  <Route path="/auth/login"           element={<LoginPage />} />
  <Route path="/auth/register"        element={<RegisterPage />} />
  <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
  <Route path="/auth/callback"        element={<AuthCallbackPage />} />
  <Route path="/auth/update-password" element={<UpdatePasswordPage />} />

  {/* Protected — RouteGuard enforces auth + role */}
  <Route element={<RouteGuard allowedRoles={['customer']} />}>
    <Route path="/dashboard/*" element={<CustomerDashboardPage />} />
  </Route>
  <Route element={<RouteGuard allowedRoles={['vendor']} />}>
    <Route path="/vendor/*" element={<VendorDashboardPage />} />
  </Route>
  <Route element={<RouteGuard allowedRoles={['rider']} />}>
    <Route path="/rider/*" element={<RiderDashboardPage />} />
  </Route>
  <Route element={<RouteGuard allowedRoles={['admin', 'super_admin']} />}>
    <Route path="/admin/*" element={<AdminDashboardPage />} />
  </Route>

  {/* Public — PublicLayout */}
  <Route element={<PublicLayout />}>
    <Route index element={<HomePage />} />
    {/* ...remaining public routes... */}
    <Route path="*" element={<NotFoundPage />} />
  </Route>
</Routes>
```

---

## 9. Data Models

### Profile

```typescript
export interface Profile {
  id:         string    // UUID — matches auth.users.id
  email:      string    // copied by handle_new_user()
  full_name:  string
  phone:      string | null
  avatar_url: string | null
  role:       UserRole  // defaulted to 'customer' by handle_new_user()
  is_active:  boolean   // defaulted to true by handle_new_user()
  created_at: string
  updated_at: string
}
export type UserRole = 'customer' | 'vendor' | 'rider' | 'admin' | 'super_admin'
```

`role` and `is_active` are **read-only** from the frontend's perspective. The Phase 2 `profiles_update_own` RLS policy is an existing backend control that prevents clients from modifying these fields. Phase 3 does not implement or rely on a client-side enforcement of this — it simply does not send these fields.

---

## 10. Error Handling

### Safe Error Message Map

Raw Supabase error messages are never surfaced directly. The application maps to safe strings:

| Scenario | Detection | Safe Message |
|---|---|---|
| Wrong credentials | `"Invalid login credentials"` | "Invalid email or password." |
| Unconfirmed email | `"Email not confirmed"` | "Please confirm your email before signing in." |
| Duplicate registration | `"already registered"` or `"User already registered"` | "An account with this email already exists." |
| Inactive profile detected | `profile.is_active === false` | "Your account is inactive. Please contact support." |
| Missing profile after login | `profileError !== null` | Redirect to login (no message — silent recovery) |
| Network / unexpected error | All other errors | "[Action] failed. Please try again." |
| Expired callback code | `exchangeCodeForSession()` error | "Link expired or already used. Please request a new one." |
| Password update failure | `updateUser()` error | "Failed to update password. Please try again." |

### Profile Fetch Failure Recovery

```
Profile fetch fails
→ Auth Store: profileError set, profile=null, isLoading=false
→ RouteGuard: session≠null AND profile===null AND profileError≠null
→ RouteGuard: calls signOut() once (ref guard prevents loops)
→ Auth Store: all state cleared, fetch generation incremented
→ RouteGuard: navigate('/auth/login', { replace: true })
→ User signs in again → new SIGNED_IN event → profile fetch retried
```

---

## 11. Correctness Properties

Properties reference the **corrected** requirements.md requirement numbers.

### P1: Signup metadata never contains authorization fields

For any valid registration input, the object passed to `signUp()` SHALL contain `{ data: { full_name } }` and MUST NOT contain `role`, `is_active`, `vendor_id`, `rider_id`, or any other authorization field.

**Validates: Requirement 2.2**

### P2: Short passwords rejected before API call

For any password string of length 0–7, `signUp()` SHALL NOT be called; a validation error SHALL be displayed.

**Validates: Requirement 2.5**

### P3: All auth errors produce safe messages

For any error returned by `signInWithPassword()` or `signUp()`, the displayed message SHALL be one of the predefined safe strings; the raw `error.message` SHALL NOT be displayed.

**Validates: Requirements 2.8, 3.7**

### P4: Post-login navigation is role-correct

For any `UserRole`, after successful sign-in and profile resolution, navigation SHALL go to `ROLE_DASHBOARD_MAP[role]` or to a validated same-role `Safe_Redirect`.

**Validates: Requirement 3.2**

### P5: Forgot-password confirmation is identical for all outcomes

For any email value and any API response, the forgot-password page SHALL show the same confirmation. The user cannot determine whether the email exists.

**Validates: Requirement 4.2**

### P6: Empty email rejected before forgot-password API call

For any empty or whitespace-only email, `resetPasswordForEmail()` SHALL NOT be called; a validation error SHALL be displayed.

**Validates: Requirement 4.3**

### P7: Stale profile fetch is discarded after SIGNED_OUT

For any sequence where `SIGNED_IN` triggers a fetch and `SIGNED_OUT` arrives before the fetch completes, the final store state SHALL have `profile = null`.

**Validates: Requirement 5.11**

### P8: Profile fetch failure never auto-retries

For any profile fetch error, the store SHALL set `profileError`, set `isLoading=false`, and SHALL NOT initiate another fetch automatically.

**Validates: Requirement 5.12**

### P9: RouteGuard never renders protected content with unresolved auth

For any auth state where at least one of `(session≠null, profile≠null, is_active=true)` is not satisfied, `<Outlet />` SHALL NOT be rendered.

**Validates: Requirements 7.2, 7.3, 9.1**

### P10: RouteGuard encodes a validatable safe redirect

For any dashboard path visited by an unauthenticated user, the `redirect` parameter SHALL encode that path such that `validateRedirectPath(decodeURIComponent(param))` returns non-null.

**Validates: Requirement 7.4**

### P11: Wrong-role users are redirected to their own dashboard

For any `(actualRole, attemptedPath)` where `attemptedPath` is not under `ROLE_DASHBOARD_MAP[actualRole]`, the RouteGuard SHALL redirect to `ROLE_DASHBOARD_MAP[actualRole]`.

**Validates: Requirement 7.5**

### P12: validateRedirectPath rejects all external and dangerous values

For any absolute URL, protocol-relative URL, or value that URL-decodes to either: `validateRedirectPath` SHALL return `null`. For any relative path starting with `/` that resolves to the same origin: SHALL return the decoded path.

**Validates: Requirement 7.8**

### P13: Inactive accounts always trigger sign-out and redirect

For any profile where `is_active = false`, regardless of role, RouteGuard SHALL call `signOut()` and redirect to `/auth/login`.

**Validates: Requirements 9.1, 9.2, 9.3**

### P14: signOut always clears local state regardless of API outcome

For any outcome of `supabase.auth.signOut()`, after `AuthStore.signOut()` completes, `session`, `profile`, `profileError`, and `isRecoverySession` SHALL all be null/false.

**Validates: Requirement 10.1**

### P15: Accessible error presentation

For any auth form field with a non-null validation error, the input SHALL have `aria-invalid="true"` and `aria-describedby` pointing to the error element's `id`.

**Validates: Requirement 11.2**

### P16: Cross-role redirect is blocked

For any authenticated user with role R requesting `?redirect=<path>` where `<path>` belongs to a dashboard for role S ≠ R, the navigation target SHALL be `roleDashboardPath(R)` not `<path>`.

**Validates: Requirement 7.8 (safe redirect), Requirement 6.5 (role mapping)**

### P17: Callback page exchanges code at most once

For any lifecycle including React Strict Mode double-invocation, `exchangeCodeForSession()` SHALL be called at most once per page mount.

**Validates: Requirement 4.5 (callback idempotency)**

### P18: /auth/update-password requires Recovery_Context

For any navigation to `/auth/update-password` where `isRecoverySession = false`, the page SHALL redirect to `/auth/login` without rendering the form and without calling `updateUser()`.

**Validates: Requirement 4.11**

---

## 12. Testing Strategy

### 12.1 Test File Locations

```
src/
  stores/__tests__/
    auth-store.test.ts
  utils/__tests__/
    safe-redirect.test.ts         ← primary PBT target
  components/auth/__tests__/
    route-guard.test.tsx
  pages/auth/__tests__/
    login.test.tsx
    register.test.tsx
    forgot-password.test.tsx
    callback.test.tsx
    update-password.test.tsx
```

### 12.2 Unit Tests (Example-Based)

**auth-store.test.ts**
- Initial state: `session=null, profile=null, isLoading=true, isRecoverySession=false, profileError=null`
- `INITIAL_SESSION` null → `isLoading=false`, all null
- `SIGNED_IN` → session updated, `isRecoverySession=false`, profile fetch triggered
- `SIGNED_OUT` → all state cleared, fetch generation incremented
- `TOKEN_REFRESHED` → session updated only; profile unchanged; no new fetch
- `PASSWORD_RECOVERY` → `isRecoverySession=true`, session updated, profile fetch triggered
- `USER_UPDATED` → profile re-fetched from `public.profiles`

**Race condition tests:**
- `SIGNED_IN` → `SIGNED_OUT` before fetch completes → final `profile=null`
- `SIGNED_IN` → `USER_UPDATED` before first fetch completes → A discarded, B written
- Multiple rapid auth events → only the last fetch result is applied

**safe-redirect.test.ts**
- `/dashboard` → valid
- `/vendor/settings` → valid
- `https://evil.example/path` → null
- `//evil.example` → null
- `javascript:alert(1)` → null
- `%2F%2Fevil.example` (encoded `//`) → null
- `%6aavascript:` (encoded `javascript:`) → null
- `http:%2F%2Fevil.example` → null
- empty string → null
- null → null
- `/admin` requested by customer → resolvePostLoginTarget → `/dashboard`
- `/vendor` requested by rider → resolvePostLoginTarget → `/rider`

**route-guard.test.tsx**
- `isLoading=true` → spinner rendered, no redirect
- `session=null` → redirect to `/auth/login?redirect=...`
- `session≠null, profile=null, profileError=null` → spinner (loading)
- `session≠null, profile=null, profileError≠Error` → signOut called, redirect to login
- `profile.is_active=false` → signOut called, redirect to login (not called twice on re-render)
- Inactive customer → no dashboard rendered
- Inactive vendor → no dashboard rendered
- Inactive rider → no dashboard rendered
- Inactive admin → no dashboard rendered
- `allowedRoles=['customer'], profile.role='vendor'` → redirect to `/vendor`
- All conditions met → `<Outlet />` rendered

**callback.test.tsx**
- No `?code` param → `exchangeCodeForSession` NOT called, navigate to login
- Valid code → `exchangeCodeForSession` called exactly once
- `exchangeCodeForSession` error → navigate to login with toast
- `PASSWORD_RECOVERY` event after exchange → navigate to `/auth/update-password`
- `SIGNED_IN` event + profile → navigate to role dashboard with welcome toast
- Strict Mode double-invocation → `exchangeCodeForSession` called only once
- Component unmounts during exchange → no navigation after unmount

**update-password.test.tsx**
- `isRecoverySession=false` on mount → redirect to `/auth/login`, form not rendered
- `isRecoverySession=true`, passwords don't match → field error, `updateUser` not called
- `isRecoverySession=true`, password < 8 chars → field error
- Successful `updateUser` → `isRecoverySession` cleared, signOut called, navigate to login
- Failed `updateUser` → error displayed, `isRecoverySession` preserved (retry possible)
- Recovery session cleared after completion → guard redirects if page still mounted

**login.test.tsx / register.test.tsx**
- Valid submission → correct Supabase method called with correct parameters
- Register: `signUp` called with `{ data: { full_name } }` only — no role/is_active
- `"Invalid login credentials"` → "Invalid email or password."
- `"Email not confirmed"` → confirmation error message
- `"User already registered"` → duplicate email message
- Unexpected error → generic fallback message
- Success → confirmation panel shown (register)

### 12.3 Property-Based Tests (fast-check)

**`src/utils/__tests__/safe-redirect.test.ts` — primary PBT target**

```typescript
// P12: validateRedirectPath rejects all external/dangerous values
fc.assert(fc.property(
  fc.webUrl(),  // generates absolute URLs
  (url) => validateRedirectPath(url) === null
))

fc.assert(fc.property(
  fc.string().map(s => '//' + s),  // protocol-relative
  (url) => validateRedirectPath(url) === null
))

fc.assert(fc.property(
  fc.constantFrom('javascript:', 'data:', 'vbscript:').chain(
    scheme => fc.string().map(s => scheme + s)
  ),
  (dangerous) => validateRedirectPath(dangerous) === null
))

fc.assert(fc.property(
  fc.string().filter(s => s.startsWith('/')).filter(s => !s.startsWith('//')),
  (path) => {
    const result = validateRedirectPath(path)
    // If result is non-null, it must be a same-origin path starting with /
    if (result !== null) {
      expect(result.startsWith('/')).toBe(true)
      expect(result.startsWith('//')).toBe(false)
    }
  }
))
```

**P2: Short passwords rejected before API call (register form)**
```typescript
fc.assert(fc.property(
  fc.string({ minLength: 0, maxLength: 7 }),
  (shortPassword) => {
    // Render form, attempt submit with short password
    // signUp should NOT be called
    expect(supabaseMock.auth.signUp).not.toHaveBeenCalled()
  }
))
```

**P3: Auth errors produce safe messages**
```typescript
fc.assert(fc.property(
  fc.record({ message: fc.string() }),  // arbitrary error
  (error) => {
    const msg = mapAuthError(error)
    // Must be one of the safe predefined messages
    expect(SAFE_ERROR_MESSAGES).toContain(msg)
  }
))
```

### 12.4 Integration Scenarios (manual / Playwright)

1. Full signup → email confirmation → callback → customer dashboard
2. Forgot password → email link → callback → update password → login
3. Sign in as vendor → lands on `/vendor`; navigate to `/dashboard` → redirected to `/vendor`
4. Sign in as inactive user → signOut triggered, redirected to login with message
5. PKCE callback with expired code → login redirect with toast
6. Direct `/auth/update-password` access → immediate redirect to login

---

## 13. Design/Requirements Reconciliation

| Requirement | Design Decision | Section |
|---|---|---|
| 1: PKCE client config | `flowType:'pkce'`, `detectSessionInUrl:false`, manual callback exchange | §2 |
| 2: Registration | `signUp({data:{full_name}})` only; no auth fields in metadata | §7.2 |
| 3: Login | `signInWithPassword`; error mapping; SIGNED_IN → Auth Store → navigate | §7.1 |
| 4: Password reset | Forgot→resetPasswordForEmail; callback→exchangeCodeForSession; PASSWORD_RECOVERY event→isRecoverySession; update-password→updateUser→signOut→login | §7.3, §7.4, §7.5 |
| 5: Auth store | Zustand; session/profile/isLoading/isRecoverySession/profileError; signOut | §4 |
| 6: Session persistence | `persistSession:true`, `autoRefreshToken:true` in client config | §2.2 |
| 7: Route protection | RouteGuard decision tree; spinner, redirect, role check | §6 |
| 8: Callback handling | PKCE code exchange; `exchanged.current` idempotency; event-driven navigation | §7.4 |
| 9: Inactive + missing profile | signOut once; no loop; no dashboard render; error state | §4.5, §6.2, §10 |
| 10: Sign out | `signOut()` clears all local state regardless; caller navigates | §4.4 |
| 11: Accessibility | aria-label on forms; aria-invalid; aria-describedby; password toggle; focus management | §7.1 |
