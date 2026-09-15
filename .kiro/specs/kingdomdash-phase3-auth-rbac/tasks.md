# Implementation Plan: KingdomDash Phase 3 — Authentication & RBAC

## Overview

This plan converts the Phase 3 design and requirements into discrete, dependency-ordered implementation tasks. Phase 3 activates the KingdomDash authentication system and enforces Role-Based Access Control (RBAC). It wires the existing Phase 1 auth page shells to Supabase Auth using the PKCE flow, creates a Zustand auth store as the single client-side source of truth for session and profile state, implements a safe-redirect validation utility with an injectable origin and property-based testing, introduces route guards that protect dashboard routes according to role and account active status, implements deterministic callback routing for recovery vs. normal email confirmation, implements the password-update page, redesigns the forgot-password page from its stub, and integrates everything into the React Router tree in `src/App.tsx`.

**Phase 2 backend — unchanged:** All PostgreSQL tables, enums, triggers, RPC functions, and RLS policies established in Phase 2 remain the authoritative security boundary. Phase 3 makes zero database modifications.

---

## Tasks

- [ ] 1. Repository inspection & baseline verification
  - Verify that `auth-card.tsx` compile errors are cleaned up (remove unused `Link` and `Button` imports)
  - Verify that `src/types/database.types.ts` exports the full Supabase schema types from Phase 2
  - Verify that `package.json` contains `@supabase/supabase-js`, `zustand`, `@tanstack/react-query`, `fast-check`, and `vitest`
  - Verify that `.env` and `.env.example` contain `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
  - _Requirements: 1.1, 1.4_

- [ ] 2. Supabase client configuration update
  - Update `src/services/supabase/client.ts` to configure the `auth` options:
    - `flowType: 'pkce'`
    - `persistSession: true`
    - `autoRefreshToken: true`
    - `detectSessionInUrl: false` (manual exchange in `/auth/callback` to prevent race condition)
  - Maintain existing environment variable checks and singleton `createClient<Database>` export
  - Ensure missing environment variables throw an informative error at module evaluation time
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 6.1_

- [ ] 3. Safe redirect utility with injectable origin & property tests
  - [ ] 3.1 Implement `src/utils/safe-redirect.ts` with injectable origin
    - Create `validateRedirectPath(path: string | null | undefined, currentOrigin?: string): string | null`
      - Make `currentOrigin` explicitly injectable (defaulting to `typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'`) so the function is truly pure and testable across Node, JSDOM, and browser runtimes without relying on global window mutation
      - Reject non-strings, null, undefined, and empty strings
      - Decode URI components safely; catch malformed URI errors and return `null`
      - Require path to start with `/`
      - Reject protocol-relative paths starting with `//`
      - Reject dangerous schemes (`javascript:`, `data:`, `vbscript:`, etc.)
      - Enforce same-origin check against `currentOrigin`
    - Create `resolvePostLoginTarget(redirectParam: string | null, profile: Profile, currentOrigin?: string): string`
      - Call `validateRedirectPath(redirectParam, currentOrigin)`
      - If invalid, return user's canonical dashboard via `roleDashboardPath(profile.role)`
      - If redirect points to a dashboard route belonging to another role, ignore it and return `roleDashboardPath(profile.role)` (P16)
      - Otherwise return the validated path (P4)
    - _Requirements: 3.2, 7.8, 7.9, 7.10; Correctness Properties: P4, P12, P16_
  - [ ] 3.2 Implement tests in `src/utils/__tests__/safe-redirect.test.ts`
    - Unit tests covering: valid relative paths, invalid external URLs, protocol-relative URLs, dangerous schemes, URL-encoded variations, empty/null values, cross-role dashboard redirection
    - Fast-check property-based tests for P12:
      - Rejects arbitrary `fc.webUrl()`
      - Rejects protocol-relative strings (`//` + arbitrary string)
      - Rejects dangerous schemes (`javascript:`, `data:`, `vbscript:`)
      - Accepts valid same-origin paths starting with `/` (excluding `//`)
    - Fast-check property-based test for P16:
      - Confirms any cross-role redirect parameter is blocked and mapped to the user's own `roleDashboardPath(profile.role)`
    - _Requirements: 3.2, 7.8, 7.9, 7.10; Correctness Properties: P4, P12, P16_

- [ ] 4. Auth store (Zustand) with singleton subscription & cleanup
  - [ ] 4.1 Create `src/stores/auth-store.ts`
    - Define `Profile` interface matching Phase 2 `public.profiles`: `id`, `email`, `full_name`, `phone`, `avatar_url`, `role` (`'customer' | 'vendor' | 'rider' | 'admin' | 'super_admin'`), `is_active`, `created_at`, `updated_at`
    - Define `UserRole` type: `'customer' | 'vendor' | 'rider' | 'admin' | 'super_admin'`
    - Define `AuthState` interface: `session: Session | null`, `profile: Profile | null`, `isLoading: boolean`, `isRecoverySession: boolean`, `profileError: Error | null`, `signOut: () => Promise<void>`
    - Implement module-level fetch generation counter (`fetchGeneration`) to eliminate stale profile race conditions (Guarantee A and Guarantee B; P7)
    - Implement module-level singleton auth listener management:
      - Store subscription handle in `let authSubscription: { unsubscribe: () => void } | null = null`
      - Ensure `initAuthListener()` executes as a true singleton; subsequent calls are no-ops
      - Export `cleanupAuthListener()` to call `unsubscribe()`, reset the subscription reference to `null`, and reset store state for test isolation and HMR cleanup
    - Implement `startProfileFetch(userId: string, currentGeneration: number)` helper:
      - Queries `public.profiles` where `id = userId` via `supabase`
      - Verifies `currentGeneration === fetchGeneration` upon completion before updating store; discards stale responses (P7)
      - On error, sets `profileError` and `profile = null`, sets `isLoading = false`, does NOT retry automatically (P8)
    - Wire `supabase.auth.onAuthStateChange` listener:
      - `INITIAL_SESSION` (non-null): updates `session`, `isLoading = true`, calls `startProfileFetch`
      - `INITIAL_SESSION` (null): sets `session = null`, `profile = null`, `isLoading = false`, `isRecoverySession = false`
      - `SIGNED_IN`: updates `session`, sets `isRecoverySession = false`, `isLoading = true`, calls `startProfileFetch`
      - `SIGNED_OUT`: increments `fetchGeneration`, clears `session`, `profile`, `profileError`, `isRecoverySession = false`, `isLoading = false` (P7)
      - `TOKEN_REFRESHED`: updates `session` only without re-fetching profile
      - `PASSWORD_RECOVERY`: updates `session`, sets `isRecoverySession = true`, `isLoading = true`, calls `startProfileFetch`
      - `USER_UPDATED`: updates `session`, `isLoading = true`, calls `startProfileFetch` to re-read `public.profiles`
    - Implement `signOut()` action:
      - Increments `fetchGeneration` to cancel in-flight fetches
      - Calls `supabase.auth.signOut()` wrapped in try/catch (swallows network errors so user is never trapped; P14)
      - Unconditionally clears all store state (`session: null, profile: null, profileError: null, isRecoverySession: false, isLoading: false`) (P14)
    - Export `useAuthStore`, `initAuthListener`, and `cleanupAuthListener`
    - _Requirements: 5.1–5.14, 6.2–6.6, 10.1, 10.2, 10.4; Correctness Properties: P7, P8, P14_
  - [ ] 4.2 Implement tests in `src/stores/__tests__/auth-store.test.ts`
    - Verify singleton listener lifecycle and clean isolation with `cleanupAuthListener()` between tests
    - Test initial store state (`session=null, profile=null, isLoading=true`)
    - Test `INITIAL_SESSION` (null) sets `isLoading=false`
    - Test `INITIAL_SESSION` (session) triggers profile fetch
    - Test `SIGNED_IN` triggers profile fetch and clears recovery flag
    - Test `SIGNED_OUT` clears all state and cancels pending profile fetch (P7)
    - Test race condition: `SIGNED_IN` followed immediately by `SIGNED_OUT` before profile resolves leaves `profile=null` (P7)
    - Test race condition: `SIGNED_IN` followed by `USER_UPDATED` applies only latest result
    - Test `TOKEN_REFRESHED` updates session without querying profiles table
    - Test `PASSWORD_RECOVERY` sets `isRecoverySession=true`
    - Test profile fetch failure sets `profileError`, `isLoading=false`, and does NOT retry (P8)
    - Test `signOut()` always resets store even when `supabase.auth.signOut()` throws an error (P14)
    - _Requirements: 5.1–5.14, 10.1; Correctness Properties: P7, P8, P14_

- [ ] 5. Route guard component & tests
  - [ ] 5.1 Implement `src/components/auth/route-guard.tsx`
    - Export `ROLE_DASHBOARD_MAP: Record<UserRole, string>`: `customer: '/dashboard'`, `vendor: '/vendor'`, `rider: '/rider'`, `admin: '/admin'`, `super_admin: '/admin'`
    - Export `roleDashboardPath(role: UserRole): string`
    - Implement `RouteGuard({ allowedRoles }: { allowedRoles?: UserRole[] })`:
      - Read `session`, `profile`, `isLoading`, `profileError`, `isRecoverySession`, and `signOut` from `useAuthStore`
      - Use `signOutInitiated: useRef(false)` to prevent duplicate sign-out calls
      - Case 1: `isLoading === true` OR (`session !== null && profile === null && profileError === null`) → render accessible `<AuthSpinner />` with role="status" and loading label (P9)
      - Case 2: `session === null` → navigate to `/auth/login?redirect=${encodeURIComponent(currentPath)}` with `replace: true` (P10)
      - Case 3: `session !== null && profile === null && profileError !== null` → trigger `signOut()`, navigate to `/auth/login` with `replace: true` (P9)
      - Case 4: `profile.is_active === false` → trigger `signOut()`, navigate to `/auth/login` with `replace: true` and inactive account notification (P13)
      - Case 5: `allowedRoles` defined AND `profile.role` not in `allowedRoles` → navigate to `roleDashboardPath(profile.role)` with `replace: true` (P11)
      - Case 6: All checks pass → render `<Outlet />` (P9)
    - _Requirements: 7.2–7.7, 7.10, 7.11, 9.1–9.6; Correctness Properties: P9, P10, P11, P13_
  - [ ] 5.2 Implement tests in `src/components/auth/__tests__/route-guard.test.tsx`
    - Test rendering spinner while `isLoading === true` (P9)
    - Test rendering spinner while session exists but profile fetch is in progress (P9)
    - Test redirecting unauthenticated users to `/auth/login?redirect=...` with validly encoded redirect (P10)
    - Test profile fetch failure triggers sign-out and redirects to login (P9)
    - Test inactive profile (`is_active: false`) triggers sign-out and redirects to login across all roles (P13)
    - Test authenticated user with mismatched role redirected to own dashboard (P11)
    - Test authorized user with active profile renders protected `<Outlet />` (P9)
    - _Requirements: 7.2–7.11, 9.1–9.6; Correctness Properties: P9, P10, P11, P13_

- [ ] 6. Auth error mapping & accessibility helpers
  - [ ] 6.1 Implement `src/utils/auth-errors.ts`
    - Map Supabase error messages and codes to safe, user-friendly strings (P3):
      - "Invalid login credentials" → "Invalid email or password."
      - "Email not confirmed" → "Please confirm your email before signing in."
      - "already registered" / "User already registered" → "An account with this email already exists."
      - "Password should be at least" → "Password must be at least 8 characters."
      - Fallback for unexpected errors → "[Action] failed. Please try again."
    - Ensure raw backend error stacks or internal database messages are never returned
    - _Requirements: 2.8, 3.4, 3.5, 3.6, 3.7, 4.9, 4.14; Correctness Property: P3_
  - [ ] 6.2 Implement property tests for auth error mapping
    - Fast-check property test in `src/utils/__tests__/auth-errors.test.ts` confirming all inputs map to allowed safe strings (P3)
    - _Requirements: 2.8, 3.7; Correctness Property: P3_

- [ ] 7. Login page activation & accessibility
  - [ ] 7.1 Update `src/pages/auth/login.tsx`
    - Preserve existing visual layout, background image, card styles, and class names
    - Add state: `email`, `password`, `showPassword`, `isLoading`, `error`, `fieldErrors`, `errorRef`
    - Client-side validation for non-empty email and password before API call
    - Wire submit handler to `supabase.auth.signInWithPassword({ email, password })`
    - Map auth errors using `mapAuthError` (P3)
    - Add already-authenticated redirect check (`useEffect` checks `session && profile?.is_active` → navigates to `resolvePostLoginTarget(redirectParam, profile)`; P4)
    - Accessibility enhancements (P15):
      - `<form aria-label="Sign in to your account">`
      - Programmatic focus on error alert element (`tabIndex={-1}`, `ref={errorRef}`)
      - Password show/hide toggle button with dynamic `aria-label` ("Show password" / "Hide password")
      - Field error elements linked via `aria-describedby` and `aria-invalid`
      - Submit button `loading={isLoading}` with accessible loading text
    - _Requirements: 3.1, 3.2, 3.4–3.10, 11.1–11.7; Correctness Properties: P3, P4, P15_
  - [ ] 7.2 Implement tests in `src/pages/auth/__tests__/login.test.tsx`
    - Test validation: empty email or password displays field error and prevents API call
    - Test successful login invokes `signInWithPassword` with correct arguments
    - Test invalid credentials error displays safe error message (P3)
    - Test unconfirmed email error displays confirmation warning (P3)
    - Test password visibility toggle switches input type between password and text (P15)
    - Test already-authenticated user redirected to role dashboard on mount (P4)
    - Test redirect query parameter respected when role-compatible (P4, P16)
    - _Requirements: 3.1–3.10, 11.1–11.7; Correctness Properties: P3, P4, P15, P16_

- [ ] 8. Register page activation with explicit emailRedirectTo & accessibility
  - [ ] 8.1 Update `src/pages/auth/register.tsx`
    - Preserve existing visual design and structure
    - Add state: `fullName`, `email`, `password`, `confirmPassword`, `showPassword`, `isLoading`, `error`, `fieldErrors`, `isSubmitted`, `errorRef`
    - Client-side validation: non-empty `fullName`, valid email format, minimum 8 characters password (P2), password confirmation match
    - Wire submit handler to `supabase.auth.signUp`:
      ```typescript
      await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName.trim() },
          emailRedirectTo: `${appConfig.url}/auth/callback`,
        },
      })
      ```
    - STRICT SECURITY CONSTRAINT: NEVER send `role`, `is_active`, `vendor_id`, `rider_id`, or admin flags in metadata (handled exclusively by DB trigger; P1)
    - On success, display check-your-email confirmation screen within the card
    - Map duplicate user and other errors to safe strings (P3)
    - Accessibility enhancements (P15): aria labels, programmatic alert focus, password toggle, aria-describedby for errors
    - _Requirements: 2.1–2.9, 11.1–11.7; Correctness Properties: P1, P2, P3, P15_
  - [ ] 8.2 Implement tests in `src/pages/auth/__tests__/register.test.tsx`
    - Test validation: rejects empty name, invalid email, password < 8 characters (P2)
    - Test `signUp` called with `{ data: { full_name }, emailRedirectTo: `${appConfig.url}/auth/callback` }` ONLY — verifies no role or is_active passed (P1)
    - Test duplicate email displays user-friendly error message (P3)
    - Test successful registration displays confirmation message
    - Fast-check property test verifying short passwords (0-7 chars) never invoke `signUp` (P2)
    - _Requirements: 2.1–2.9, 11.1–11.7; Correctness Properties: P1, P2, P3, P15_

- [ ] 9. Forgot password page redesign & enumeration prevention
  - [ ] 9.1 Update `src/pages/auth/forgot-password.tsx`
    - Redesign from stub to full-featured form matching login/register visual pattern
    - Background: `/kingdomDash-login.jpg` with dark overlay and centered card
    - Add state: `email`, `isLoading`, `fieldError`, `isSubmitted`
    - Client-side validation: non-empty email (P6)
    - Submit handler calls `supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${appConfig.url}/auth/callback` })`
    - Enumeration prevention: regardless of whether the API returns success or error, always display the same confirmation message ("If an account exists for this email, a reset link has been sent."; P5)
    - Accessible form structure with keyboard support and clear return-to-login link (P15)
    - _Requirements: 1.5, 1.6, 4.1–4.4, 11.1–11.7; Correctness Properties: P5, P6, P15_
  - [ ] 9.2 Implement tests in `src/pages/auth/__tests__/forgot-password.test.tsx`
    - Test empty email shows validation error and halts submission (P6)
    - Test submission calls `resetPasswordForEmail` with correct `redirectTo` parameter
    - Test confirmation message is identical for existing and non-existing email responses (P5)
    - _Requirements: 4.1–4.4; Correctness Properties: P5, P6_

- [ ] 10. Auth callback page (`/auth/callback`) with deterministic routing
  - [ ] 10.1 Create `src/pages/auth/callback.tsx` with deterministic recovery vs. normal callback routing
    - Full-screen loading indicator during PKCE code exchange
    - Idempotency guard: `exchanged: useRef(false)` ensuring `exchangeCodeForSession` is called at most once, even under React 19 / Strict Mode double mounting (P17)
    - Mount effect:
      - Read `code` and `type` query parameters from `window.location.search`
      - If no code: push error toast ("Invalid link"), navigate to `/auth/login` with `replace: true`
      - If code present: call `supabase.auth.exchangeCodeForSession(code)`
      - If exchange errors: push error toast ("Link expired or already used"), navigate to `/auth/login` with `replace: true`
    - State reaction effect with deterministic routing priority:
      - Route determination logic:
        1. **Recovery route condition:** If URL parameter `type === 'recovery'` OR `isRecoverySession === true` (from `PASSWORD_RECOVERY` auth event), navigate immediately to `/auth/update-password` with `replace: true`.
        2. **Normal confirmation route condition:** If not a recovery session (`type !== 'recovery'` AND `isRecoverySession === false`), wait until `isLoading === false`. Once `session && profile` are present, push welcome toast (`Welcome, ${profile.full_name}!`) and navigate to `roleDashboardPath(profile.role)` with `replace: true`.
      - Prevents race conditions between `exchangeCodeForSession` resolution and `onAuthStateChange` event delivery by checking both URL intent and auth store state deterministically
    - _Requirements: 4.5–4.10, 8.1–8.8; Correctness Property: P17_
  - [ ] 10.2 Implement tests in `src/pages/auth/__tests__/callback.test.tsx`
    - Test missing code navigates to login with error toast
    - Test valid code invokes `exchangeCodeForSession` once (P17)
    - Test Strict Mode double-invocation calls exchange at most once (P17)
    - Test failed exchange navigates to login with error toast
    - Test deterministic routing for password recovery (`type=recovery` or `isRecoverySession=true`) navigates to `/auth/update-password`
    - Test deterministic routing for email confirmation (`SIGNED_IN` event with resolved profile) navigates to role dashboard with welcome toast
    - _Requirements: 8.1–8.8; Correctness Property: P17_

- [ ] 11. Update password page (`/auth/update-password`) implementation
  - [ ] 11.1 Create `src/pages/auth/update-password.tsx`
    - Visual layout matching login/register/forgot-password pages
    - Recovery context check: if `!isRecoverySession`, immediately redirect to `/auth/login` with `replace: true` without rendering form (P18)
    - State: `password`, `confirmPassword`, `showPassword`, `isLoading`, `error`, `fieldErrors`, `errorRef`
    - Client-side validation: minimum 8 characters, confirmation matching
    - Submit handler:
      - Calls `supabase.auth.updateUser({ password })`
      - On error: display safe error alert (P3), retain recovery context for retry
      - On success:
        - Set `isRecoverySession = false`
        - Call `signOut()` to clear recovery session cleanly
        - Push success toast ("Password updated. Sign in with your new password.")
        - Navigate to `/auth/login` with `replace: true`
    - Accessibility: aria labels, focus management, password toggles (P15)
    - _Requirements: 4.11–4.15, 11.1–11.7; Correctness Properties: P3, P15, P18_
  - [ ] 11.2 Implement tests in `src/pages/auth/__tests__/update-password.test.tsx`
    - Test access without recovery session redirects immediately to `/auth/login` (P18)
    - Test validation: passwords mismatch or password < 8 characters prevents API call
    - Test successful update clears recovery state, calls signOut, and navigates to login with success toast
    - Test failed update displays error and preserves recovery session for retry
    - _Requirements: 4.11–4.15, 11.1–11.7; Correctness Property: P18_

- [ ] 12. App.tsx route tree restructuring & integration
  - Update `src/App.tsx`:
    - Separate full-screen auth routes from `PublicLayout` so auth pages have a dedicated single `<main>` element (fixing nested `<main>` issue):
      - `/auth/login` → `LoginPage`
      - `/auth/register` → `RegisterPage`
      - `/auth/forgot-password` → `ForgotPasswordPage`
      - `/auth/callback` → `AuthCallbackPage`
      - `/auth/update-password` → `UpdatePasswordPage`
    - Wrap dashboard route areas in `RouteGuard` with appropriate `allowedRoles`:
      - `/dashboard/*` → `<Route element={<RouteGuard allowedRoles={['customer']} />}><Route path="/dashboard/*" element={<CustomerDashboardPage />} /></Route>`
      - `/vendor/*` → `<Route element={<RouteGuard allowedRoles={['vendor']} />}><Route path="/vendor/*" element={<VendorDashboardPage />} /></Route>`
      - `/rider/*` → `<Route element={<RouteGuard allowedRoles={['rider']} />}><Route path="/rider/*" element={<RiderDashboardPage />} /></Route>`
      - `/admin/*` → `<Route element={<RouteGuard allowedRoles={['admin', 'super_admin']} />}><Route path="/admin/*" element={<AdminDashboardPage />} /></Route>`
    - Retain all public pages wrapped in `PublicLayout` (`/`, `/about`, `/services`, `/food`, `/groceries`, `/courier`, `/contact`, `/faq`, `/become-vendor`, `/become-rider`, `*`)
  - Update existing route tests in `src/pages/__tests__/routes.test.tsx` to verify updated route tree and ensure all public, auth, and application routes pass cleanly
  - _Requirements: 7.1, 7.2, 7.5, 8.8; Correctness Properties: P9, P11_

- [ ] 13. Integration validation & test suite execution
  - [ ] 13.1 Run `npx oxlint` / `npm run lint` across entire repository; resolve any lint issues
  - [ ] 13.2 Run `npx tsc -b`; verify zero TypeScript compile errors
  - [ ] 13.3 Run `npx vitest run`; verify that all unit, property-based, and route tests pass 100%
  - [ ] 13.4 Run `npm run build` (Vite production build); verify successful production artifact generation
  - [ ] 13.5 Perform manual / visual check with browser subagent or dev server confirmation
  - _Requirements: 1.1–11.7; All Correctness Properties P1–P18_

- [ ] 14. Phase 3 completion checkpoint & documentation
  - Confirm all 18 Correctness Properties are tested and passing (see Traceability Matrix below)
  - Verify zero database migrations or backend files were modified
  - Verify no Paystack, Maps, or fake checkout functionality was introduced
  - Prepare final Phase 3 completion report

---

## Correctness Property to Task Traceability Matrix

| Property | Summary | Validates | Implementation Task | Test Task & File |
|---|---|---|---|---|
| **P1** | Signup metadata never contains authorization fields | Req 2.2 | Task 8.1 | Task 8.2 (`register.test.tsx`) |
| **P2** | Short passwords (< 8 chars) rejected before API call | Req 2.5 | Task 8.1 | Task 8.2 (`register.test.tsx` fast-check) |
| **P3** | All auth errors produce safe predefined messages | Req 2.8, 3.7 | Task 6.1, 7.1, 8.1, 11.1 | Task 6.2 (`auth-errors.test.ts` fast-check) |
| **P4** | Post-login navigation is role-correct | Req 3.2 | Task 3.1, 7.1 | Task 3.2, 7.2 (`login.test.tsx`) |
| **P5** | Forgot-password confirmation is identical for all outcomes | Req 4.2 | Task 9.1 | Task 9.2 (`forgot-password.test.tsx`) |
| **P6** | Empty email rejected before forgot-password API call | Req 4.3 | Task 9.1 | Task 9.2 (`forgot-password.test.tsx`) |
| **P7** | Stale profile fetch discarded after SIGNED_OUT | Req 5.11 | Task 4.1 | Task 4.2 (`auth-store.test.ts`) |
| **P8** | Profile fetch failure never auto-retries | Req 5.12 | Task 4.1 | Task 4.2 (`auth-store.test.ts`) |
| **P9** | RouteGuard never renders protected content with unresolved auth | Req 7.2, 7.3, 9.1 | Task 5.1, 12 | Task 5.2 (`route-guard.test.tsx`) |
| **P10** | RouteGuard encodes a validatable safe redirect | Req 7.4 | Task 5.1 | Task 5.2 (`route-guard.test.tsx`) |
| **P11** | Wrong-role users are redirected to their own dashboard | Req 7.5 | Task 5.1, 12 | Task 5.2 (`route-guard.test.tsx`) |
| **P12** | validateRedirectPath rejects all external and dangerous values | Req 7.8 | Task 3.1 | Task 3.2 (`safe-redirect.test.ts` fast-check) |
| **P13** | Inactive accounts always trigger sign-out and redirect | Req 9.1, 9.2, 9.3 | Task 5.1 | Task 5.2 (`route-guard.test.tsx`) |
| **P14** | signOut always clears local state regardless of API outcome | Req 10.1 | Task 4.1 | Task 4.2 (`auth-store.test.ts`) |
| **P15** | Accessible error presentation (aria-invalid, aria-describedby, focus) | Req 11.2 | Task 7.1, 8.1, 9.1, 11.1 | Task 7.2, 8.2, 9.2, 11.2 |
| **P16** | Cross-role redirect is blocked | Req 7.8, 6.5 | Task 3.1 | Task 3.2 (`safe-redirect.test.ts` fast-check) |
| **P17** | Callback page exchanges code at most once | Req 4.5 | Task 10.1 | Task 10.2 (`callback.test.tsx`) |
| **P18** | /auth/update-password requires Recovery_Context | Req 4.11 | Task 11.1 | Task 11.2 (`update-password.test.tsx`) |
