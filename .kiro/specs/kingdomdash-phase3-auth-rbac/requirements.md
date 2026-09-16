# Requirements Document

## Introduction

Phase 3 delivers a complete authentication and role-based access control (RBAC) system for KingdomDash. It activates the three Phase 1 stub auth pages (`/auth/login`, `/auth/register`, `/auth/forgot-password`) by wiring them to Supabase Auth, introduces a Zustand auth store as the single client-side source of truth for session and profile state, adds two new auth pages (`/auth/callback`, `/auth/update-password`), and adds React Router route guards that enforce authentication and role-based dashboard routing.

**Phase 2 backend — unchanged.** The following are the authoritative source of truth for authorization and must not be modified by Phase 3:

- `public.profiles` table (with `role user_role`, `is_active boolean`)
- `user_role` enum: `customer | vendor | rider | admin | super_admin`
- `handle_new_user()` trigger — auto-creates `profiles` row with `role = 'customer'` on signup
- `get_current_user_role()` SECURITY DEFINER function
- All 23 public tables and their RLS policies
- All SECURITY DEFINER RPCs

**Phase 3 does not implement:** OAuth (Google/Apple), phone authentication, dashboard UI beyond stub shells, shopping cart, Paystack, maps, or any new database tables or migrations.

**Security boundary:** React Router guards and the Zustand auth store are UX navigation mechanisms, not the authoritative security boundary. All real authorization is enforced by Supabase/PostgreSQL RLS, SECURITY DEFINER functions, and trusted database logic. A client-side session or role value grants no database privileges — RLS evaluates every query independently. The frontend must never be treated as the authority for authorization.

**Selected authentication flow:** PKCE (Proof Key for Code Exchange), consistent with Supabase's recommended flow for browser-based applications. The Supabase client must be configured with `flowType: 'pkce'`, `persistSession: true`, `autoRefreshToken: true`, and `detectSessionInUrl: true`. All callback handling must be consistent with this choice.

---

## Glossary

- **Auth_Service**: The Supabase Auth subsystem accessed via `supabase.auth.*` methods in `@supabase/supabase-js`.
- **Auth_Store**: The Zustand store (`src/stores/auth-store.ts`) that holds the resolved auth session, the user's `Profile`, auth status flags, and auth action methods on the client.
- **Profile**: A row in `public.profiles` containing `id`, `email`, `full_name`, `phone`, `avatar_url`, `role` (`user_role`), `is_active` (`boolean`), `created_at`, `updated_at`. Created automatically by `handle_new_user()` on Supabase signup with `role = 'customer'` and `is_active = true`.
- **Session**: A Supabase Auth session object containing the authenticated user's JWT and refresh token. Persisted to `localStorage` by `@supabase/supabase-js` when `persistSession: true`.
- **PKCE_Code**: The one-time authorization code appended as `?code=<value>` in the callback URL by Supabase Auth when using the PKCE flow. It is exchanged for a Session via `exchangeCodeForSession(code)`.
- **Auth_Event**: An event emitted by `supabase.auth.onAuthStateChange()`. Relevant events: `INITIAL_SESSION`, `SIGNED_IN`, `SIGNED_OUT`, `TOKEN_REFRESHED`, `PASSWORD_RECOVERY`, `USER_UPDATED`.
- **Route_Guard**: A React component (`src/components/auth/route-guard.tsx`) that wraps protected routes and enforces authentication, profile resolution, and role-based routing before rendering the protected content.
- **UserRole**: The `user_role` PostgreSQL enum: `customer | vendor | rider | admin | super_admin`. Stored in `profiles.role`. Defaults to `customer` on registration. May only be changed by a super_admin through the database; the frontend cannot modify it.
- **Login_Page**: `/auth/login` — activates `Auth_Service.signInWithPassword()`.
- **Register_Page**: `/auth/register` — activates `Auth_Service.signUp()`.
- **Forgot_Password_Page**: `/auth/forgot-password` — activates `Auth_Service.resetPasswordForEmail()`.
- **Auth_Callback_Page**: `/auth/callback` — handles the PKCE code redirect from Supabase after email confirmation or password-reset link clicks.
- **Update_Password_Page**: `/auth/update-password` — presents the new-password form. Only callable when a valid `PASSWORD_RECOVERY` session context exists.
- **Dashboard_Route**: Any route under `/dashboard/*`, `/vendor/*`, `/rider/*`, or `/admin/*`. Requires authentication and a resolved Profile with `is_active = true`.
- **Role_Dashboard_Map**: The canonical mapping: `customer` → `/dashboard`, `vendor` → `/vendor`, `rider` → `/rider`, `admin` → `/admin`, `super_admin` → `/admin`.
- **Safe_Redirect**: A `redirect` query parameter value that has been validated as an internal application path before use. See Requirement 6.
- **Inactive_Account**: An authenticated user whose `Profile.is_active` is `false`. The session may be valid but dashboard access is denied.
- **Recovery_Context**: The authenticated state established after a `PASSWORD_RECOVERY` Auth_Event. Required before `updateUser({ password })` may be called.

---

## Requirements

### Requirement 1: Supabase Client Configuration

**User Story:** As a developer, I need the Supabase client to be correctly configured for the PKCE authentication flow so that all auth operations behave consistently and securely.

#### Acceptance Criteria

1. THE Supabase client SHALL be initialized in `src/services/supabase/client.ts` with `flowType: 'pkce'`, `persistSession: true`, `autoRefreshToken: true`, and `detectSessionInUrl: false` in the `auth` configuration option. `detectSessionInUrl` is explicitly set to `false` because the `/auth/callback` route performs a manual, deduplicated `exchangeCodeForSession(code)` call to eliminate race conditions.
2. THE `flowType: 'pkce'` setting SHALL be applied consistently so that `resetPasswordForEmail()`, `signUp()`, and all other auth operations that produce redirect URLs generate PKCE-flow callbacks — not implicit-flow hash fragments.
3. THE Supabase client configuration SHALL be verified by the implementation to confirm these values are set before any auth operation is called; a missing or incorrect configuration SHALL cause an explicit initialization error at startup.
4. THE `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` environment variables remain the only credentials used by the client; the service-role key must never appear in browser code.
5. THE `redirectTo` URL supplied to `resetPasswordForEmail()` SHALL be the application's canonical callback URL (e.g. `https://app.kingdomdash.com/auth/callback`). This URL must be registered as an allowed redirect URL in the Supabase project's Auth settings.
6. The `redirectTo` URL supplied to `resetPasswordForEmail()` SHALL be read from application configuration, not hard-coded in component logic.

---

### Requirement 2: User Registration

**User Story:** As a visitor, I want to create a KingdomDash account using my email address and password, so that I can place orders and access my dashboard.

#### Acceptance Criteria

1. WHEN a visitor submits the registration form with a valid email, a password of at least 8 characters, and a non-empty `full_name`, THE Register_Page SHALL call `Auth_Service.signUp()` with the email, password, and `full_name` passed in `options.data` as user metadata (`{ data: { full_name } }`).
2. THE `signUp()` call SHALL pass ONLY `full_name` in user metadata. The following values MUST NOT be passed as metadata or in any other client-supplied field: `role`, `is_active`, `vendor_id`, `rider_id`, admin flags, or any other authorization-sensitive value. The `handle_new_user()` trigger is the sole authority that creates the `profiles` row with `role = 'customer'` and `is_active = true`.
3. WHEN `Auth_Service.signUp()` succeeds, THE Register_Page SHALL display a confirmation message instructing the user to check their email to confirm their account before they can sign in.
4. WHEN a visitor submits the registration form with an email already associated with an existing account, THE Register_Page SHALL display a field-level error stating the email is already registered.
5. WHEN a visitor submits the registration form with a password shorter than 8 characters, THE Register_Page SHALL display a field-level error before calling `Auth_Service.signUp()`.
6. WHEN a visitor submits the registration form with an empty `full_name`, THE Register_Page SHALL display a field-level error before calling `Auth_Service.signUp()`.
7. WHILE the registration form submission is in progress, THE Register_Page SHALL disable the submit button and display a loading indicator to prevent duplicate submissions.
8. IF `Auth_Service.signUp()` returns any error, THEN THE Register_Page SHALL display a dismissible generic error alert. The raw Supabase error message SHALL NOT be displayed if it reveals sensitive server details; a safe user-facing message SHALL be used instead.
9. WHEN `Auth_Service.signUp()` succeeds, THE Auth_Service SHALL automatically invoke `handle_new_user()` which creates a `profiles` row — the frontend performs no additional profile-creation step.

---

### Requirement 3: User Login

**User Story:** As a registered user, I want to sign in with my email and password, so that I can access my KingdomDash dashboard.

#### Acceptance Criteria

1. WHEN a user submits the login form with a registered, confirmed email and correct password, THE Login_Page SHALL call `Auth_Service.signInWithPassword()`. On success, the resulting `SIGNED_IN` Auth_Event SHALL cause the Auth_Store to fetch the user's Profile and determine their Dashboard_Route.
2. AFTER a successful sign-in and Profile resolution, THE application SHALL navigate the user to their role-appropriate Dashboard_Route as defined by the Role_Dashboard_Map. If a valid Safe_Redirect parameter is present, the application SHALL navigate there instead (see Requirement 6).
3. WHEN sign-in succeeds but the Profile cannot be fetched or `profile.is_active` is `false`, the login SHALL be treated as a failed authorization state — see Requirements 9 and 10 respectively.
4. WHEN a user submits the login form with unregistered credentials or an incorrect password, THE Login_Page SHALL display a dismissible error alert stating credentials are invalid, without specifying which field is wrong.
5. WHEN a login attempt fails due to an unconfirmed email address, THE Login_Page SHALL display an error message indicating the user must confirm their email.
6. WHEN a login attempt fails due to a temporary API or network error, THE Login_Page SHALL display a generic error message that does not expose backend error details.
7. WHEN a login attempt fails for any unexpected reason, THE Login_Page SHALL display a safe fallback error message.
8. WHEN a user submits the login form with an empty email or empty password, THE Login_Page SHALL display field-level validation errors before calling `Auth_Service.signInWithPassword()`.
9. WHILE the login form submission is in progress, THE Login_Page SHALL disable the submit button and display a loading indicator.
10. WHEN a user navigates to `/auth/login` while already holding a valid Session and a resolved active Profile, THE Login_Page SHALL redirect the user to their role-appropriate Dashboard_Route without displaying the form.

---

### Requirement 4: Password Reset

**User Story:** As a registered user who has forgotten my password, I want to request a password reset link by email, so that I can securely regain access to my account.

#### Acceptance Criteria

**Forgot-password request:**

1. WHEN a user submits the forgot-password form with any non-empty email value, THE Forgot_Password_Page SHALL call `Auth_Service.resetPasswordForEmail()` with that email and the configured `redirectTo` URL (Requirement 1.5).
2. AFTER `Auth_Service.resetPasswordForEmail()` completes — whether success or error — THE Forgot_Password_Page SHALL replace the form with a confirmation message stating that if the email is registered, a link has been sent. This response SHALL be identical regardless of whether the email exists, to prevent account enumeration.
3. WHEN a user submits the forgot-password form with an empty email field, THE Forgot_Password_Page SHALL display a field-level validation error before calling `Auth_Service.resetPasswordForEmail()`.
4. WHILE the forgot-password form submission is in progress, THE Forgot_Password_Page SHALL disable the submit button and show a loading indicator.

**Callback handling (PKCE recovery flow):**

5. WHEN a user clicks a password-reset link in their email, Supabase redirects them to `/auth/callback?code=<pkce_code>`. The Auth_Callback_Page SHALL extract the `code` query parameter and call `Auth_Service.exchangeCodeForSession(code)`.
6. `Auth_Service.exchangeCodeForSession(code)` SHALL only be called when a `code` query parameter is present in the URL. If no `code` parameter is present, the Auth_Callback_Page SHALL navigate the user to `/auth/login` with an error toast.
7. WHEN `exchangeCodeForSession()` succeeds and the resulting Auth_Event is `PASSWORD_RECOVERY`, THE Auth_Callback_Page SHALL set the Recovery_Context in the Auth_Store and navigate to `/auth/update-password`.
8. WHEN `exchangeCodeForSession()` succeeds and the resulting Auth_Event is `SIGNED_IN` (email confirmation), THE Auth_Callback_Page SHALL allow the Auth_Store to resolve the Profile and navigate to the user's role-appropriate Dashboard_Route with a welcome toast.
9. IF `exchangeCodeForSession()` returns an error, or the code is expired or invalid, THEN THE Auth_Callback_Page SHALL navigate the user to `/auth/login` with a descriptive but safe error toast.
10. WHILE the code exchange is in progress, THE Auth_Callback_Page SHALL display a full-page loading indicator.

**Password update:**

11. THE Update_Password_Page SHALL verify that a valid Recovery_Context exists in the Auth_Store before rendering the password-update form. If no Recovery_Context exists, the page SHALL redirect to `/auth/login` without rendering the form and without calling `updateUser()`.
12. WHEN a user submits the new-password form with a password of at least 8 characters and the Recovery_Context is valid, THE Update_Password_Page SHALL call `Auth_Service.updateUser({ password })`.
13. WHEN `Auth_Service.updateUser()` succeeds, THE Update_Password_Page SHALL clear the Recovery_Context from the Auth_Store, sign the user out, and navigate to `/auth/login` with a success toast instructing the user to sign in with their new password.
14. IF `Auth_Service.updateUser()` fails, THEN THE Update_Password_Page SHALL display a safe error message without exposing backend details. The Recovery_Context SHALL remain active so the user may retry.
15. The Recovery_Context SHALL be a distinct flag in the Auth_Store (`isRecoverySession: boolean`) that is set to `true` only when the Auth_Store receives a `PASSWORD_RECOVERY` Auth_Event, and is explicitly cleared on sign-out, successful password update, or a subsequent `SIGNED_IN` or `SIGNED_OUT` event.

---

### Requirement 5: Auth State Management

**User Story:** As the application, I need a single source of truth for the current user's session and profile so that any component can reliably read auth state without making redundant network calls.

#### Acceptance Criteria

**State shape:**

1. THE Auth_Store SHALL expose: `session` (Supabase Session or `null`), `profile` (Profile or `null`), `isLoading` (boolean), `isAuthenticated` (boolean, derived: `true` when `session` is non-null), `isRecoverySession` (boolean, `true` only when a `PASSWORD_RECOVERY` event is active), `profileError` (Error or `null`), and actions: `signOut()`.

**Initialization:**

2. WHEN the application mounts, THE Auth_Store SHALL initialize by calling `Auth_Service.getSession()`. `isLoading` SHALL be `true` from the start of this call until the session is resolved, confirmed absent, and — if a session exists — the Profile fetch has completed or failed.
3. THE Auth_Store subscription to `Auth_Service.onAuthStateChange()` SHALL be established once at the top level of the store setup, not inside a component lifecycle, and SHALL be unsubscribed when no longer needed (e.g. on store teardown).

**Auth event handling:**

4. WHEN Auth_Service emits `INITIAL_SESSION` with a non-null session, THE Auth_Store SHALL treat it as equivalent to `SIGNED_IN` — update `session` and initiate a Profile fetch.
5. WHEN Auth_Service emits `SIGNED_IN`, THE Auth_Store SHALL update `session`, set `isRecoverySession = false`, and initiate a Profile fetch. The fetch must be request-cancellation-safe (see criterion 11 on race conditions).
6. WHEN Auth_Service emits `SIGNED_OUT`, THE Auth_Store SHALL set `session = null`, `profile = null`, `profileError = null`, `isRecoverySession = false`, and cancel any in-flight Profile fetch.
7. WHEN Auth_Service emits `TOKEN_REFRESHED`, THE Auth_Store SHALL update `session` without re-fetching the Profile unless the user identity has changed.
8. WHEN Auth_Service emits `PASSWORD_RECOVERY`, THE Auth_Store SHALL set `isRecoverySession = true` and update `session`. A Profile fetch may be initiated but the Recovery_Context takes priority.
9. WHEN Auth_Service emits `USER_UPDATED`, THE Auth_Store SHALL re-fetch the Profile to ensure the store reflects the latest `profiles` row.

**Profile fetch behaviour:**

10. THE Profile SHALL be fetched by querying `public.profiles` where `id = session.user.id` using the authenticated Supabase client. The Phase 2 RLS `profiles_select_own` policy ensures only the authenticated user's own row is returned.
11. THE Auth_Store SHALL protect against profile-fetch race conditions: each auth event that triggers a Profile fetch SHALL carry an increment identifier or a cancellation signal. IF an older fetch completes after a newer auth event has already cleared or changed the session, the stale result SHALL be discarded and SHALL NOT overwrite current store state. The implementation SHALL prevent the scenario: `SIGNED_IN` → fetch starts → `SIGNED_OUT` → fetch finishes → stale profile written.
12. THE Auth_Store SHALL not enter an infinite profile-fetch loop. If a profile fetch fails, the store SHALL set `profileError` and `profile = null` and SHALL NOT automatically retry unless a new auth event is received.
13. IF a Profile fetch fails, THE Auth_Store SHALL set `profileError` to the error and `profile = null`. `isLoading` SHALL be set to `false`. The session SHALL remain intact unless the error indicates the session itself is invalid.

**Sign-out:**

14. THE Auth_Store `signOut()` action SHALL call `Auth_Service.signOut()`, then immediately clear `session`, `profile`, `profileError`, `isRecoverySession`, `isEmailConfirmed`, and reset in-memory cart state. If `Auth_Service.signOut()` returns an error, the store SHALL still clear all local state — a remote sign-out failure must not leave the user stuck in an authenticated state client-side. Navigation following sign-out belongs to UI callers, button handlers, and RouteGuard redirection, preserving clean architectural separation between state management and routing.

---

### Requirement 6: Session Persistence and Auto-Refresh

**User Story:** As an authenticated user, I want my login session to persist across page reloads within a reasonable timeframe, so that I do not have to log in repeatedly.

#### Acceptance Criteria

1. The Supabase client SHALL be configured with `persistSession: true` and `autoRefreshToken: true`. These settings cause `@supabase/supabase-js` to persist the Session to `localStorage` and automatically refresh the access token before expiry — no additional frontend implementation is needed beyond correct client configuration.
2. WHEN a user returns to the application with a non-expired Session in `localStorage`, THE Auth_Store SHALL restore that Session via the `INITIAL_SESSION` event and fetch the Profile without requiring the user to log in again.
3. WHEN the access token approaches expiry, THE Auth_Service SHALL automatically refresh it and emit `TOKEN_REFRESHED`. THE Auth_Store SHALL update `session` accordingly.
4. IF a Session refresh fails because the refresh token has expired or been revoked, THEN THE Auth_Service SHALL emit `SIGNED_OUT` and THE Auth_Store SHALL handle it by clearing all auth state.
5. Browser-session persistence is a UX convenience mechanism. A stored session does not bypass Supabase RLS or any database authorization check. Every database query is evaluated against RLS policies independently of whether the client holds a persisted session.
6. WHEN a user explicitly calls `Auth_Store.signOut()`, the Session SHALL be removed from `localStorage` by `Auth_Service.signOut()`.

---

### Requirement 7: Route Protection

**User Story:** As a system, I need to prevent unauthenticated users from accessing dashboard pages and route authenticated users to the correct dashboard for their role, with proper handling of inactive accounts.

#### Acceptance Criteria

**Public routes (no authentication required):**

1. THE following routes SHALL be accessible without authentication: `/`, `/about`, `/services`, `/food`, `/food/:vendorId`, `/groceries`, `/groceries/:storeId`, `/courier`, `/contact`, `/faq`, `/become-vendor`, `/become-rider`, `/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/callback`, `/auth/update-password`.

**Protected route behaviour:**

2. THE Route_Guard SHALL render protected route content only when ALL of the following are true: `Auth_Store.isLoading` is `false`, `Auth_Store.session` is non-null, `Auth_Store.profile` is non-null, and `Auth_Store.profile.is_active` is `true`.
3. WHILE `Auth_Store.isLoading` is `true` or `Auth_Store.profile` is `null` but `Auth_Store.session` is non-null (profile fetch pending), THE Route_Guard SHALL render a full-page loading indicator. This prevents a flash of the login redirect while auth state is being resolved.
4. WHEN an unauthenticated user navigates to any Dashboard_Route, THE Route_Guard SHALL redirect to `/auth/login`, preserving the originally requested path as a Safe_Redirect query parameter: `/auth/login?redirect=<safe_path>`.
5. WHEN an authenticated user navigates to a Dashboard_Route that does not match their `profile.role`, THE Route_Guard SHALL redirect to their role-appropriate Dashboard_Route as defined by the Role_Dashboard_Map.

**Inactive account:**

6. WHEN `Auth_Store.profile.is_active` is `false`, THE Route_Guard SHALL deny Dashboard_Route access, call `Auth_Store.signOut()` to clear the session, and redirect to `/auth/login` with a message explaining the account is inactive. The frontend SHALL NOT attempt to set `is_active = true`; this is a database-level administrative decision.

**Authenticated user on auth pages:**

7. WHEN a user with a valid session and an active Profile navigates to `/auth/login` or `/auth/register`, THE Route_Guard SHALL redirect to their role-appropriate Dashboard_Route.

**Safe_Redirect validation (open-redirect prevention):**

8. THE `redirect` query parameter SHALL only be used as a navigation target after passing ALL of the following validation rules:
   - The value must be a relative path starting with `/` (e.g. `/dashboard`).
   - The value must not start with `//`.
   - The value must not contain a protocol component (e.g. `http:`, `https:`, `javascript:`).
   - The value must not resolve to an origin different from the application's own origin.
   - The value must not contain URL-encoded versions of the above rejected patterns.
   - IF any of these checks fail, the application SHALL fall back to the user's role-appropriate Dashboard_Route and SHALL NOT navigate to the provided value.
9. Safe_Redirect validation SHALL be a dedicated utility function, not inline logic, so it can be independently tested.

**Role mapping:**

10. THE Role_Dashboard_Map SHALL be: `customer` → `/dashboard`, `vendor` → `/vendor`, `rider` → `/rider`, `admin` → `/admin`, `super_admin` → `/admin`.

**Profile-fetch failure during route guard:**

11. WHEN Auth_Store reaches a state where `session` is non-null but `profile` is `null` AND `profileError` is non-null (fetch failed definitively), THE Route_Guard SHALL treat this as an authorization failure: call `Auth_Store.signOut()` and redirect to `/auth/login` with an error message. This prevents authenticated-but-unresolved states from looping indefinitely.

---

### Requirement 8: Auth Callback Handling (PKCE Flow)

**User Story:** As a user who clicked an email confirmation or password-reset link, I want to be seamlessly redirected into the application with my session established.

#### Acceptance Criteria

1. THE Auth_Callback_Page at `/auth/callback` SHALL be the single handler for all Supabase Auth redirect callbacks in the PKCE flow.
2. WHEN the page loads, THE Auth_Callback_Page SHALL extract the `code` query parameter from the URL. The `code` parameter is the PKCE authorization code issued by Supabase; it is not a hash fragment and it is not a `type=` parameter.
3. IF no `code` parameter is present in the URL, THE Auth_Callback_Page SHALL navigate to `/auth/login` with a safe error toast. The `exchangeCodeForSession()` function SHALL NOT be called when no code is present.
4. WHEN a valid `code` is present, THE Auth_Callback_Page SHALL call `Auth_Service.exchangeCodeForSession(code)` exactly once.
5. `exchangeCodeForSession()` returns a session; the Auth_Service also emits an Auth_Event. THE Auth_Callback_Page SHALL respond to the resulting Auth_Event:
   - `PASSWORD_RECOVERY` event → Auth_Store sets `isRecoverySession = true`; navigate to `/auth/update-password`.
   - `SIGNED_IN` event (email confirmation) → Auth_Store resolves Profile; navigate to role-appropriate Dashboard_Route with a welcome toast.
6. IF `exchangeCodeForSession()` returns an error (expired code, already-used code, network failure), THE Auth_Callback_Page SHALL navigate to `/auth/login` with a descriptive but safe error toast. The error message SHALL NOT expose internal Supabase error details.
7. WHILE the code exchange is in progress, THE Auth_Callback_Page SHALL display a full-page loading indicator.
8. THE route `/auth/callback` SHALL be registered as a public route accessible without prior authentication.

---

### Requirement 9: Inactive and Missing Profile Handling

**User Story:** As the system, I need deterministic behavior when an authenticated user's profile is inactive or cannot be fetched, so that the application never enters an unresolvable state.

#### Acceptance Criteria

**Inactive profile:**

1. WHEN `Auth_Store.profile.is_active` is `false`, THE application SHALL deny all Dashboard_Route access.
2. THE Auth_Store SHALL call its own `signOut()` action when an inactive profile is detected during route guard evaluation, clearing `session`, `profile`, and `isRecoverySession`.
3. THE application SHALL redirect the user to `/auth/login` and display a message that the account is inactive and they should contact support.
4. THE frontend SHALL NOT attempt to read or modify `is_active` — its value is read-only from `public.profiles` via the authenticated client. The Phase 2 `profiles_update_own` RLS policy prevents users from changing `is_active`; this must not be bypassed client-side.

**Missing profile (fetch failed):**

5. WHEN a Profile fetch fails with a network or database error, THE Auth_Store SHALL set `profileError` and `profile = null`. `isLoading` SHALL be `false`.
6. THE Route_Guard SHALL treat `profileError` as a blocking condition — it SHALL NOT render Dashboard_Route content when `profileError` is non-null.
7. THE Auth_Store SHALL NOT automatically retry a failed Profile fetch. A retry SHALL only occur when a new Auth_Event (e.g. `TOKEN_REFRESHED`) is received.
8. THE application SHALL display an appropriate error state to the user when `profileError` is non-null, with a way to retry (e.g. a refresh action) rather than silently failing.

---

### Requirement 10: Sign Out

**User Story:** As an authenticated user, I want to sign out so that my session is terminated and the browser no longer holds my credentials.

#### Acceptance Criteria

1. WHEN a user triggers sign-out, THE `Auth_Store.signOut()` action SHALL call `Auth_Service.signOut()`. Regardless of whether `Auth_Service.signOut()` succeeds or fails, the action SHALL then clear `session`, `profile`, `profileError`, and `isRecoverySession` in the store, and navigate to `/`.
2. WHEN `Auth_Service.signOut()` succeeds, the Session SHALL be removed from `localStorage`.
3. THE sign-out control SHALL be accessible from any authenticated route via the navigation or dashboard shell.
4. AFTER sign-out, any in-flight Profile fetch SHALL be discarded (see Requirement 5.11 race condition protection).

---

### Requirement 11: Form Accessibility and User Experience

**User Story:** As a user with assistive technology, I want the auth forms to be fully accessible so I can register, log in, and reset my password regardless of how I interact with the browser.

#### Acceptance Criteria

1. THE Login_Page, Register_Page, Forgot_Password_Page, and Update_Password_Page SHALL each render a `<form>` element with a descriptive `aria-label` identifying the form's purpose.
2. WHEN a field-level validation error is displayed, THE corresponding input SHALL have `aria-invalid="true"` and `aria-describedby` pointing to the error message element's `id`.
3. THE password input on Login_Page, Register_Page, and Update_Password_Page SHALL include a visible toggle button switching `type` between `password` and `text`, with an `aria-label` reflecting the current state (e.g. "Show password" / "Hide password").
4. THE submit button on each auth form SHALL have a descriptive `aria-label` when in the loading state (e.g. "Signing in…").
5. WHEN an error alert is displayed, THE alert element SHALL receive focus programmatically so screen-reader users are immediately notified.
6. THE auth forms SHALL be fully operable by keyboard alone, including field navigation, submission, and dismissal of error alerts.
7. THE auth form pages SHALL meet WCAG 2.1 Level AA colour-contrast requirements for all text, labels, and interactive elements.
