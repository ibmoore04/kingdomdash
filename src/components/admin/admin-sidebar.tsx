import React from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth-store';
import {
  LayoutDashboard,
  Users,
  Bike,
  ClipboardList,
  Store,
  FileCheck,
  ShoppingBag,
  Truck,
  Send,
  AlertTriangle,
  CreditCard,
  Layers,
  DollarSign,
  MapPin,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Bell,
  Globe,
} from 'lucide-react';

interface AdminSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  superAdminOnly?: boolean;
  badge?: string;
}

const navSections: { title: string; items: NavItem[] }[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard & Analytics', href: '/admin/dashboard', icon: LayoutDashboard },
      { label: 'Notifications', href: '/admin/notifications', icon: Bell },
    ],
  },
  {
    title: 'Operations',
    items: [
      { label: 'Orders Management', href: '/admin/orders', icon: ShoppingBag },
      { label: 'Delivery Tracking', href: '/admin/deliveries', icon: Truck },
      { label: 'Dispatch Console', href: '/admin/dispatch', icon: Send },
      { label: 'Operational Incidents', href: '/admin/exceptions', icon: AlertTriangle },
      { label: 'Payment & Refunds', href: '/admin/payments', icon: CreditCard },
    ],
  },
  {
    title: 'Fleet & Vendors',
    items: [
      { label: 'Rider Fleet', href: '/admin/riders', icon: Bike },
      { label: 'Rider Onboarding', href: '/admin/rider-applications', icon: ClipboardList },
      { label: 'Vendor Directory', href: '/admin/vendors', icon: Store },
      { label: 'Vendor Onboarding', href: '/admin/vendor-applications', icon: FileCheck },
      { label: 'Platform Users', href: '/admin/users', icon: Users },
    ],
  },
  {
    title: 'Configuration',
    items: [
      { label: 'Catalog & Categories', href: '/admin/catalog', icon: Layers },
      { label: 'Pricing Rules', href: '/admin/pricing', icon: DollarSign },
      { label: 'Service Areas', href: '/admin/service-areas', icon: MapPin },
      { label: 'Audit Logs', href: '/admin/audit-logs', icon: ShieldAlert, superAdminOnly: true },
    ],
  },
];

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}) => {
  const { profile, signOut } = useAuthStore();
  const location = useLocation();
  const userRole = profile?.role;
  const isSuperAdmin = userRole === 'super_admin';

  const sidebarClasses = `
    fixed inset-y-0 left-0 z-40 bg-white border-r border-border text-text-secondary
    transition-all duration-300 ease-in-out flex flex-col
    ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
    ${collapsed ? 'w-20' : 'w-64'}
  `;

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden backdrop-blur-xs"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside className={sidebarClasses} aria-label="Admin Navigation">
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-border shrink-0">
          <NavLink to="/admin/dashboard" className="flex items-center gap-2.5 overflow-hidden group">
            <img
              src="/KingdomDash-logo.jpg"
              alt="KingdomDash"
              className="h-9 w-auto rounded-lg object-contain shrink-0 shadow-xs"
            />
            {!collapsed && (
              <div className="truncate">
                <div className="font-bold text-text-primary tracking-wide text-sm group-hover:text-primary transition-colors">
                  KINGDOM<span className="text-primary">DASH</span>
                </div>
                <div className="text-[10px] text-primary font-semibold uppercase tracking-wider">
                  Admin Center
                </div>
              </div>
            )}
          </NavLink>

          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden lg:flex p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-page-background transition-colors"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation items */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {navSections.map((section) => {
            const filteredItems = section.items.filter(
              (item) => !item.superAdminOnly || isSuperAdmin
            );
            if (filteredItems.length === 0) return null;

            return (
              <div key={section.title} className="space-y-1">
                {!collapsed && (
                  <div className="px-3 text-[11px] font-bold uppercase tracking-wider text-text-muted mb-2">
                    {section.title}
                  </div>
                )}
                {filteredItems.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    location.pathname === item.href ||
                    (item.href !== '/admin/dashboard' && location.pathname.startsWith(item.href));

                  return (
                    <NavLink
                      key={item.href}
                      to={item.href}
                      onClick={onCloseMobile}
                      className={({ isActive: linkActive }) => `
                        flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group
                        ${
                          isActive || linkActive
                            ? 'bg-primary text-white font-bold shadow-xs'
                            : 'text-text-secondary hover:text-text-primary hover:bg-page-background'
                        }
                        ${collapsed ? 'justify-center px-0' : ''}
                      `}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon
                        className={`w-5 h-5 shrink-0 transition-colors ${
                          isActive ? 'text-white' : 'text-text-muted group-hover:text-text-primary'
                        }`}
                      />
                      {!collapsed && (
                        <span className="truncate flex-1">{item.label}</span>
                      )}
                      {!collapsed && item.superAdminOnly && (
                        <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ${
                          isActive
                            ? 'bg-white/20 text-white border-white/30'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          Super
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* User Info & Footer */}
        <div className="p-3 border-t border-border shrink-0 bg-white space-y-2">
          <Link
            to="/"
            onClick={onCloseMobile}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-text-secondary hover:text-primary hover:bg-page-background border border-transparent hover:border-border transition-all ${
              collapsed ? 'justify-center px-0' : ''
            }`}
            title="Public Website"
          >
            <Globe className="w-4 h-4 text-primary shrink-0" />
            {!collapsed && <span>Public Website</span>}
          </Link>

          <div
            className={`flex items-center gap-3 px-2 py-2 rounded-xl bg-light-surface border border-border ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            <div className="w-8 h-8 rounded-lg bg-near-black flex items-center justify-center font-bold text-white text-xs shrink-0">
              {isSuperAdmin ? 'SA' : 'AD'}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-text-primary truncate capitalize">
                  {userRole?.replace('_', ' ') || 'Admin'}
                </div>
                <div className="text-[10px] text-primary font-mono truncate">
                  Authenticated
                </div>
              </div>
            )}
            {!collapsed && (
              <button
                type="button"
                onClick={() => signOut()}
                className="p-1.5 text-text-muted hover:text-primary hover:bg-page-background rounded-lg transition-colors"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};
