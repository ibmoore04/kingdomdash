import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { PublicLayout } from '@/components/layout/public-layout'
import { ScrollToTop } from '@/components/layout/scroll-to-top'
import { RouteGuard } from '@/components/auth/route-guard'
import { useAuthStore } from '@/stores/auth-store'

function RedirectWithQuery({ to }: { to: string }) {
  const location = useLocation()
  return <Navigate to={`${to}${location.search}`} replace />
}

function NotificationsRedirect() {
  const { profile } = useAuthStore()
  if (!profile) return <Navigate to="/auth/login" replace />
  if (profile.role === 'admin' || profile.role === 'super_admin') {
    return <Navigate to="/admin/notifications" replace />
  }
  if (profile.role === 'rider') {
    return <Navigate to="/rider/notifications" replace />
  }
  if (profile.role === 'vendor') {
    return <Navigate to="/vendor?tab=notifications" replace />
  }
  return <Navigate to="/dashboard?tab=notifications" replace />
}

// ── Public pages ──────────────────────────────────────────────────────────────
const HomePage = lazy(() => import('@/pages/public/home'))
const AboutPage = lazy(() => import('@/pages/public/about'))
const ServicesPage = lazy(() => import('@/pages/public/services'))
const FoodPage = lazy(() => import('@/pages/public/food'))
const FoodDetailPage = lazy(() => import('@/pages/public/food-detail'))
const GroceriesPage = lazy(() => import('@/pages/public/groceries'))
const GroceryDetailPage = lazy(() => import('@/pages/public/grocery-detail'))
const CourierPage = lazy(() => import('@/pages/public/courier'))
const ContactPage = lazy(() => import('@/pages/public/contact'))
const SupportPage = lazy(() => import('@/pages/public/support'))
const FaqPage = lazy(() => import('@/pages/public/faq'))
const BecomeVendorPage = lazy(() => import('@/pages/public/become-vendor'))
const BecomeRiderPage = lazy(() => import('@/pages/public/become-rider'))
const NotFoundPage = lazy(() => import('@/pages/public/not-found'))

// ── Auth pages (full-screen, no PublicLayout) ─────────────────────────────────
const LoginPage = lazy(() => import('@/pages/auth/login'))
const RegisterPage = lazy(() => import('@/pages/auth/register'))
const ForgotPasswordPage = lazy(() => import('@/pages/auth/forgot-password'))
const AuthCallbackPage = lazy(() => import('@/pages/auth/callback'))
const UpdatePasswordPage = lazy(() => import('@/pages/auth/update-password'))
const VerifyEmailPage = lazy(() => import('@/pages/auth/verify-email'))

// ── Dashboard pages (protected by RouteGuard) ─────────────────────────────────
const CustomerDashboardPage = lazy(() => import('@/pages/dashboard/customer-dashboard'))
const VendorDashboardPage = lazy(() => import('@/pages/dashboard/vendor-dashboard'))

// ── Admin Control Center (Phase 12) ──────────────────────────────────────────
const AdminShell = lazy(() => import('@/pages/admin/admin-shell'))
const AdminDashboardPage = lazy(() => import('@/pages/admin/admin-dashboard-page'))
const AdminNotificationsPage = lazy(() => import('@/pages/admin/admin-notifications-page'))
const AdminUsersPage = lazy(() => import('@/pages/admin/admin-users-page'))
const AdminRidersPage = lazy(() => import('@/pages/admin/admin-riders-page'))
const AdminRiderApplicationsPage = lazy(() => import('@/pages/admin/admin-rider-applications-page'))
const AdminVendorsPage = lazy(() => import('@/pages/admin/admin-vendors-page'))
const AdminVendorApplicationsPage = lazy(() => import('@/pages/admin/admin-vendor-applications-page'))
const AdminOrdersPage = lazy(() => import('@/pages/admin/admin-orders-page'))
const AdminDeliveriesPage = lazy(() => import('@/pages/admin/admin-deliveries-page'))
const AdminDispatchPage = lazy(() => import('@/pages/admin/admin-dispatch-page'))
const AdminExceptionsPage = lazy(() => import('@/pages/admin/admin-exceptions-page'))
const AdminPaymentsPage = lazy(() => import('@/pages/admin/admin-payments-page'))
const AdminCatalogPage = lazy(() => import('@/pages/admin/admin-catalog-page'))
const AdminPricingPage = lazy(() => import('@/pages/admin/admin-pricing-page'))
const AdminServiceAreasPage = lazy(() => import('@/pages/admin/admin-service-areas-page'))
const AdminAuditLogsPage = lazy(() => import('@/pages/admin/admin-audit-logs-page'))

// ── Rider Platform pages (Phase 11) ──────────────────────────────────────────
const RiderDashboardPage = lazy(() => import('@/pages/rider/dashboard'))
const RiderAssignmentsPage = lazy(() => import('@/pages/rider/assignments'))
const RiderActiveDeliveryPage = lazy(() => import('@/pages/rider/active-delivery'))
const RiderHistoryPage = lazy(() => import('@/pages/rider/history'))
const RiderProfilePage = lazy(() => import('@/pages/rider/profile'))
const RiderSettingsPage = lazy(() => import('@/pages/rider/settings'))
const RiderNotificationsPage = lazy(() => import('@/pages/rider/notifications'))

// ── Ordering & Cart pages (Phase 6) ──────────────────────────────────────────
const CartPage = lazy(() => import('@/pages/public/cart'))
const CheckoutPage = lazy(() => import('@/pages/customer/checkout'))
const OrderConfirmationPage = lazy(() => import('@/pages/customer/order-confirmation'))

// ── Onboarding pending pages ──────────────────────────────────────────────────
const RiderPendingPage = lazy(() => import('@/pages/customer/rider-pending-page'))
const VendorPendingPage = lazy(() => import('@/pages/customer/vendor-pending-page'))

// ── Loading fallback ──────────────────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">Loading…</p>
    </div>
  )
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<PageLoader />}>
        <Routes>
        {/* ── Direct auth aliases (preserving query parameters) ─────────────── */}
        <Route path="/login" element={<RedirectWithQuery to="/auth/login" />} />
        <Route path="/register" element={<RedirectWithQuery to="/auth/register" />} />
        <Route path="/verify-email" element={<RedirectWithQuery to="/auth/verify-email" />} />
        <Route path="/forgot-password" element={<RedirectWithQuery to="/auth/forgot-password" />} />
        <Route path="/callback" element={<RedirectWithQuery to="/auth/callback" />} />
        <Route path="/update-password" element={<RedirectWithQuery to="/auth/update-password" />} />

        {/* ── Full-screen auth routes — no PublicLayout ───────────────────────── */}
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/register" element={<RegisterPage />} />
        <Route path="/auth/verify-email" element={<VerifyEmailPage />} />
        <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/auth/update-password" element={<UpdatePasswordPage />} />

        {/* ── Protected customer routes — RouteGuard enforces auth + role ──────── */}
        <Route element={<RouteGuard allowedRoles={['customer']} />}>
          {/* Primary dashboard route — tabs controlled via ?tab= query param */}
          <Route path="/dashboard" element={<CustomerDashboardPage />} />
          {/* Path-based aliases so deep links / bookmarks / notifications resolve correctly */}
          <Route path="/dashboard/orders" element={<Navigate to="/dashboard?tab=orders" replace />} />
          <Route path="/dashboard/addresses" element={<Navigate to="/dashboard?tab=addresses" replace />} />
          <Route path="/dashboard/profile" element={<Navigate to="/dashboard?tab=profile" replace />} />
          <Route path="/dashboard/notifications" element={<Navigate to="/dashboard?tab=notifications" replace />} />
          <Route path="/dashboard/settings" element={<Navigate to="/dashboard?tab=settings" replace />} />
          {/* Catch-all for any other /dashboard/* paths → default to orders tab */}
          <Route path="/dashboard/*" element={<Navigate to="/dashboard?tab=orders" replace />} />
          <Route path="/onboarding/rider-pending" element={<RiderPendingPage />} />
          <Route path="/onboarding/vendor-pending" element={<VendorPendingPage />} />
          <Route element={<PublicLayout />}>
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/order/:orderId/confirmation" element={<OrderConfirmationPage />} />
          </Route>
        </Route>
        <Route element={<RouteGuard allowedRoles={['vendor']} />}>
          <Route path="/vendor/*" element={<VendorDashboardPage />} />
        </Route>
        <Route element={<RouteGuard allowedRoles={['rider']} />}>
          <Route path="/rider" element={<Navigate to="/rider/dashboard" replace />} />
          <Route path="/rider/dashboard" element={<RiderDashboardPage />} />
          <Route path="/rider/assignments" element={<RiderAssignmentsPage />} />
          <Route path="/rider/deliveries/active" element={<RiderActiveDeliveryPage />} />
          <Route path="/rider/deliveries/:id" element={<RiderActiveDeliveryPage />} />
          <Route path="/rider/history" element={<RiderHistoryPage />} />
          <Route path="/rider/profile" element={<RiderProfilePage />} />
          <Route path="/rider/settings" element={<RiderSettingsPage />} />
          <Route path="/rider/notifications" element={<RiderNotificationsPage />} />
          <Route path="/rider/*" element={<Navigate to="/rider/dashboard" replace />} />
        </Route>
        <Route element={<RouteGuard allowedRoles={['admin', 'super_admin']} />}>
          <Route path="/admin" element={<AdminShell />}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboardPage />} />
            <Route path="notifications" element={<AdminNotificationsPage />} />
            <Route path="orders" element={<AdminOrdersPage />} />
            <Route path="deliveries" element={<AdminDeliveriesPage />} />
            <Route path="dispatch" element={<AdminDispatchPage />} />
            <Route path="exceptions" element={<AdminExceptionsPage />} />
            <Route path="payments" element={<AdminPaymentsPage />} />
            <Route path="riders" element={<AdminRidersPage />} />
            <Route path="rider-applications" element={<AdminRiderApplicationsPage />} />
            <Route path="vendors" element={<AdminVendorsPage />} />
            <Route path="vendor-applications" element={<AdminVendorApplicationsPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="catalog" element={<AdminCatalogPage />} />
            <Route path="pricing" element={<AdminPricingPage />} />
            <Route path="service-areas" element={<AdminServiceAreasPage />} />
            <Route path="audit-logs" element={<AdminAuditLogsPage />} />
            <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
          </Route>
        </Route>

        {/* ── Global notifications shortcut (role-aware) ────────────────────────── */}
        <Route path="/notifications" element={<NotificationsRedirect />} />

        {/* ── Public routes — wrapped in PublicLayout ───────────────────────────── */}
        <Route element={<PublicLayout />}>
          <Route index element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/food" element={<FoodPage />} />
          <Route path="/food/:vendorId" element={<FoodDetailPage />} />
          <Route path="/grocery" element={<GroceriesPage />} />
          <Route path="/grocery/:storeId" element={<GroceryDetailPage />} />
          <Route path="/groceries" element={<GroceriesPage />} />
          <Route path="/groceries/:storeId" element={<GroceryDetailPage />} />
          <Route path="/courier" element={<CourierPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/support" element={<SupportPage />} />
          <Route path="/faq" element={<FaqPage />} />
          <Route path="/become-vendor" element={<BecomeVendorPage />} />
          <Route path="/become-rider" element={<BecomeRiderPage />} />

          {/* 404 catch-all */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
    </>
  )
}
