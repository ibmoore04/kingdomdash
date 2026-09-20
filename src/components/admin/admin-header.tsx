import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth-store';
import { Menu, Bell, Shield, RefreshCw, Globe } from 'lucide-react';
import { getUnreadNotificationCount, subscribeToMyNotifications } from '@/services/supabase/notifications';

interface AdminHeaderProps {
  onToggleMobileMenu: () => void;
  onRefreshData?: () => void;
  isRefreshing?: boolean;
}

const routeTitles: Record<string, { title: string; subtitle: string }> = {
  '/admin/dashboard': { title: 'Platform Overview', subtitle: 'Live metrics and analytical telemetry' },
  '/admin/notifications': { title: 'System Notifications', subtitle: 'Platform alerts, application triage, and incident logs' },
  '/admin/orders': { title: 'Order Operations', subtitle: 'Multi-service order management and lifecycle tracking' },
  '/admin/deliveries': { title: 'Delivery Tracking', subtitle: 'Real-time transit state and courier custody monitoring' },
  '/admin/dispatch': { title: 'Dispatch Console', subtitle: 'Manual delivery assignment and rider allocation' },
  '/admin/exceptions': { title: 'Operational Incidents', subtitle: 'Incident resolution, escalations, and cancellations' },
  '/admin/payments': { title: 'Payments & Refunds', subtitle: 'Financial reconciliation and refund queue review' },
  '/admin/riders': { title: 'Fleet Directory', subtitle: 'Courier roster, verification status, and vehicle telemetry' },
  '/admin/rider-applications': { title: 'Rider Applications', subtitle: 'Courier onboarding approvals and background vetting' },
  '/admin/vendors': { title: 'Vendor Directory', subtitle: 'Merchant management, store verification, and activation' },
  '/admin/vendor-applications': { title: 'Vendor Applications', subtitle: 'Merchant onboarding queue and documentation reviews' },
  '/admin/users': { title: 'Platform Users', subtitle: 'Unified identity directory and account access governance' },
  '/admin/catalog': { title: 'Catalog & Categories', subtitle: 'Cross-service taxonomies and product catalog governance' },
  '/admin/pricing': { title: 'Pricing Rules', subtitle: 'Server-authoritative delivery fee calculation tiers' },
  '/admin/service-areas': { title: 'Service Areas', subtitle: 'Operational zones and geographic delivery boundaries' },
  '/admin/audit-logs': { title: 'Forensic Audit Logs', subtitle: 'Immutable security and administrative action ledger' },
};

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  onToggleMobileMenu,
  onRefreshData,
  isRefreshing = false,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const userRole = profile?.role;
  const currentPath = location.pathname;
  const [unreadCount, setUnreadCount] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;

    async function loadUnread() {
      const res = await getUnreadNotificationCount();
      if (isMounted) {
        setUnreadCount(res.count);
      }
    }

    loadUnread();

    if (!profile?.id) return;

    const unsubscribe = subscribeToMyNotifications(profile.id, (payload) => {
      if (payload.eventType === 'INSERT') {
        setUnreadCount((prev) => prev + 1);
      } else if (payload.eventType === 'UPDATE' || payload.eventType === 'DELETE') {
        loadUnread();
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [profile?.id]);

  // Match route or find closest parent
  const matchedRoute =
    routeTitles[currentPath] ||
    Object.entries(routeTitles).find(([path]) => currentPath.startsWith(path))?.[1] || {
      title: 'Admin Control Center',
      subtitle: 'KingdomDash Administrative Environment',
    };

  return (
    <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-border px-4 lg:px-8 py-3.5 flex items-center justify-between transition-all">
      <div className="flex items-center gap-3">
        {/* Mobile menu hamburger */}
        <button
          type="button"
          onClick={onToggleMobileMenu}
          className="lg:hidden p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-page-background transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Page Title & Breadcrumbs */}
        <div>
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-base sm:text-lg lg:text-xl font-bold text-text-primary tracking-tight truncate max-w-[150px] sm:max-w-none">
              {matchedRoute.title}
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-light-surface text-text-secondary border border-border shrink-0">
              <Shield className="w-3 h-3 text-primary" />
              {userRole === 'super_admin' ? 'Super Admin' : 'Admin'}
            </span>
          </div>
          <p className="text-xs text-text-secondary hidden sm:block">
            {matchedRoute.subtitle}
          </p>
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-2 lg:gap-3">
        {onRefreshData && (
          <button
            type="button"
            onClick={onRefreshData}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-secondary bg-white hover:bg-light-surface hover:text-text-primary border border-border rounded-lg transition-colors disabled:opacity-50 shadow-xs"
            title="Refresh current dataset"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-primary' : ''}`} />
            <span className="hidden md:inline">{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        )}

        {/* Link to public website / consumer portal */}
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 px-2 sm:px-3 py-1.5 text-xs font-semibold text-text-secondary hover:text-primary bg-white hover:bg-light-surface border border-border rounded-lg transition-colors shadow-xs shrink-0"
          title="Back to Public Website"
        >
          <Globe className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="hidden sm:inline">Live Store</span>
        </Link>

        {/* Admin Notifications Trigger */}
        <button
          type="button"
          onClick={() => navigate('/admin/notifications')}
          className="relative p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-page-background transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
          title={unreadCount > 0 ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}` : 'Notifications'}
          aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 ? (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-text-muted/30 rounded-full ring-2 ring-white" />
          )}
        </button>
      </div>
    </header>
  );
};
