import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCircle,
  Clock,
  CheckCheck,
  RefreshCw,
  Trash2,
  Bike,
  Store,
  ShieldAlert,
  AlertTriangle,
  Info,
  ExternalLink,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  clearReadNotifications,
} from '@/services/supabase/notifications';

export interface AdminNotificationItem {
  id: string;
  title: string;
  message: string;
  severity: 'critical' | 'warning' | 'info';
  is_read: boolean;
  category: 'application' | 'dispatch' | 'order' | 'system';
  action_href?: string;
  action_label?: string;
  created_at: string;
}

const STORAGE_KEY = 'kd_admin_notifications_cache';

export const AdminNotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const [notifications, setNotifications] = useState<AdminNotificationItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'applications' | 'system'>('all');
  const [isLoading, setIsLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    setIsLoading(true);

    // Helper: normalise a raw local cache entry into AdminNotificationItem shape
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const normaliseLocal = (n: any): AdminNotificationItem => {
      const lowerTitle = String(n.title || '').toLowerCase();
      const lowerMsg = String(n.message || '').toLowerCase();
      const href = n.action_href || n.action_url || '';
      const isSupport =
        lowerTitle.includes('support') ||
        lowerMsg.includes('support') ||
        lowerTitle.includes('ticket') ||
        lowerTitle.includes('kd-sup') ||
        href.includes('/admin/support');

      return {
        id: n.id,
        title: n.title || 'Notification',
        message: n.message || '',
        severity: (n.severity || 'info') as AdminNotificationItem['severity'],
        is_read: Boolean(n.read ?? n.is_read),
        category: (
          isSupport ? 'system'
          : n.type === 'corporate_lead' ? 'application'
          : n.type === 'personal_shopper_request' ? 'order'
          : n.category || 'system'
        ) as AdminNotificationItem['category'],
        action_href: href || (
          isSupport ? '/admin/support'
          : n.type === 'corporate_lead' ? '/admin/users'
          : n.type === 'personal_shopper_request' ? '/admin/orders'
          : '/admin/dashboard'
        ),
        action_label:
          isSupport ? 'View Support Ticket'
          : n.action_label || (
            n.type === 'corporate_lead' ? 'View Leads'
            : n.type === 'personal_shopper_request' ? 'View Orders'
            : 'View Dashboard'
          ),
        created_at: n.createdAt || n.created_at || new Date().toISOString(),
      };
    };

    const readLocalCache = (): AdminNotificationItem[] => {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (!cached) return [];
      try { return (JSON.parse(cached) as unknown[]).map(normaliseLocal); } catch { return []; }
    };

    try {
      const res = await getMyNotifications();
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapped: AdminNotificationItem[] = (res.data as any[]).map((row) => {
          const lowerTitle = (row.title || '').toLowerCase();
          const lowerMsg = (row.message || '').toLowerCase();
          const rawUrl = row.action_url || '';

          let category: AdminNotificationItem['category'] = 'system';
          let actionHref = rawUrl || '/admin/dashboard';
          let actionLabel = 'View Dashboard';

          if (
            lowerTitle.includes('support') ||
            lowerMsg.includes('support') ||
            lowerTitle.includes('ticket') ||
            lowerTitle.includes('kd-sup') ||
            rawUrl.includes('/admin/support')
          ) {
            category = 'system';
            actionHref = rawUrl || '/admin/support';
            actionLabel = 'View Support Ticket';
          } else if (lowerTitle.includes('corporate') || lowerMsg.includes('corporate')) {
            category = 'application';
            actionHref = rawUrl || '/admin/users?tab=corporate';
            actionLabel = 'View Corporate Leads';
          } else if (lowerTitle.includes('shopper') || lowerMsg.includes('market run')) {
            category = 'order';
            actionHref = rawUrl || '/admin/orders?type=shopper';
            actionLabel = 'View Shopper Request';
          } else if (lowerTitle.includes('rider') || lowerMsg.includes('rider app')) {
            category = 'application';
            actionHref = rawUrl || '/admin/rider-applications';
            actionLabel = 'Review Application';
          } else if (lowerTitle.includes('vendor') || lowerMsg.includes('vendor app')) {
            category = 'application';
            actionHref = rawUrl || '/admin/vendor-applications';
            actionLabel = 'Review Application';
          } else if (lowerTitle.includes('dispatch') || lowerMsg.includes('delivery')) {
            category = 'dispatch';
            actionHref = rawUrl || '/admin/dispatch';
            actionLabel = 'Open Dispatch';
          } else if (lowerTitle.includes('order') || lowerMsg.includes('refund')) {
            category = 'order';
            actionHref = rawUrl || '/admin/orders';
            actionLabel = 'View Orders';
          }

          return {
            id: row.id,
            title: row.title || 'Platform Notification',
            message: row.message || '',
            severity: row.type === 'error' ? 'critical' : row.type === 'warning' ? 'warning' : 'info',
            is_read: Boolean(row.is_read),
            category,
            action_href: actionHref,
            action_label: actionLabel,
            created_at: row.created_at || new Date().toISOString(),
          } as AdminNotificationItem;
        });

        // Merge: keep local-only entries (corporate leads, shopper requests) not in Supabase result
        const remoteIds = new Set(mapped.map((n) => n.id));
        const localOnly = readLocalCache().filter((n) => !remoteIds.has(n.id));
        const merged = [...localOnly, ...mapped].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setNotifications(merged);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      } else {
        // No remote data — use normalised local cache
        setNotifications(readLocalCache());
      }
    } catch {
      // Network error — fall back to local cache
      setNotifications(readLocalCache());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const persist = (updated: AdminNotificationItem[]) => {
    setNotifications(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to save admin notifications cache', err);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    const updated = notifications.map((n) => (n.id === id ? { ...n, is_read: true } : n));
    persist(updated);

    if (!id.startsWith('seed-')) {
      try {
        await markNotificationRead(id);
      } catch {
        // Handled silently
      }
    }

    pushToast({
      title: 'Alert Acknowledged',
      message: 'Notification marked as read.',
      variant: 'info',
    });
  };

  const handleMarkAllAsRead = async () => {
    const unreadCount = notifications.filter((n) => !n.is_read).length;
    if (unreadCount === 0) return;

    const updated = notifications.map((n) => ({ ...n, is_read: true }));
    persist(updated);

    try {
      await markAllNotificationsRead();
    } catch {
      // Fallback already persisted in local state
    }

    pushToast({
      title: 'All Caught Up',
      message: 'All system alerts have been marked as read.',
      variant: 'success',
    });
  };

  const handleClearRead = async () => {
    const unreadOnly = notifications.filter((n) => !n.is_read);
    persist(unreadOnly);

    try {
      await clearReadNotifications();
    } catch {
      // Fallback already persisted in local state
    }

    pushToast({
      title: 'Cleared',
      message: 'Read admin alerts removed.',
      variant: 'info',
    });
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const filteredNotifications = notifications.filter((n) => {
    if (activeFilter === 'unread') return !n.is_read;
    if (activeFilter === 'applications') return n.category === 'application';
    if (activeFilter === 'system') return n.category === 'system' || n.category === 'dispatch';
    return true;
  });

  const formatTimeAgo = (isoString: string) => {
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch {
      return 'Recently';
    }
  };

  const getSeverityBadge = (severity: AdminNotificationItem['severity']) => {
    switch (severity) {
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-50 text-primary border border-rose-200">
            <AlertTriangle className="w-3 h-3" />
            Critical
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">
            <ShieldAlert className="w-3 h-3" />
            Warning
          </span>
        );
      case 'info':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-light-surface text-text-secondary border border-border">
            <Info className="w-3 h-3 text-text-muted" />
            Info
          </span>
        );
    }
  };

  const getIcon = (item: AdminNotificationItem) => {
    if (item.category === 'application') {
      return item.title.toLowerCase().includes('rider') ? (
        <Bike className="h-5 w-5 text-primary" aria-hidden="true" />
      ) : (
        <Store className="h-5 w-5 text-primary" aria-hidden="true" />
      );
    }
    if (item.severity === 'critical' || item.severity === 'warning') {
      return <ShieldAlert className="h-5 w-5 text-amber-600" aria-hidden="true" />;
    }
    return <Bell className="h-5 w-5 text-primary" aria-hidden="true" />;
  };

  return (
    <div className="space-y-6">
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-border shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-text-primary">Admin System Alerts & Notifications</h2>
              {unreadCount > 0 ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  {unreadCount} Unread
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  All Caught Up
                </span>
              )}
            </div>
            <p className="text-xs text-text-secondary">
              Real-time platform notifications, application alerts, and dispatch operational incidents
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllAsRead}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-text-secondary bg-light-surface hover:bg-slate-100 rounded-xl transition-colors border border-border shadow-xs"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark All Read</span>
            </button>
          )}

          {notifications.some((n) => n.is_read) && (
            <button
              type="button"
              onClick={handleClearRead}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-text-secondary bg-light-surface hover:bg-slate-100 rounded-xl transition-colors border border-border shadow-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clear Read</span>
            </button>
          )}

          <button
            type="button"
            onClick={loadNotifications}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-text-secondary bg-light-surface hover:bg-slate-100 rounded-xl transition-colors border border-border shadow-xs"
            title="Refresh alerts"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-primary' : ''}`} />
            <span>Reload</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <button
          type="button"
          onClick={() => setActiveFilter('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            activeFilter === 'all'
              ? 'bg-primary/10 text-primary border border-primary/20'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          All Alerts ({notifications.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter('unread')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            activeFilter === 'unread'
              ? 'bg-primary/10 text-primary border border-primary/20'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Unread ({unreadCount})
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter('applications')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            activeFilter === 'applications'
              ? 'bg-primary/10 text-primary border border-primary/20'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Applications
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter('system')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            activeFilter === 'system'
              ? 'bg-primary/10 text-primary border border-primary/20'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Dispatch & System
        </button>
      </div>

      {/* Notifications List Container */}
      <div className="rounded-2xl bg-white border border-border shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-text-muted">
            <RefreshCw className="w-5 h-5 animate-spin text-primary mx-auto mb-2" />
            <p className="text-xs">Loading admin alerts...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="p-12 text-center text-text-muted space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-light-surface border border-border flex items-center justify-center mx-auto text-text-secondary">
              <CheckCircle className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-primary">No notifications found</h3>
              <p className="text-xs text-text-secondary mt-1">
                {activeFilter === 'unread'
                  ? 'All administrative alerts have been reviewed and acknowledged.'
                  : 'Your administrative alert inbox is currently empty.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredNotifications.map((item) => (
              <div
                key={item.id}
                className={`p-4 transition-colors flex items-start gap-3.5 ${
                  item.is_read
                    ? 'bg-white hover:bg-light-surface/40'
                    : 'bg-primary/[0.02] hover:bg-primary/[0.04]'
                }`}
              >
                {/* Icon Circle */}
                <div
                  className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center border ${
                    item.severity === 'critical'
                      ? 'bg-rose-50 border-rose-200'
                      : item.severity === 'warning'
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-light-surface border-border'
                  }`}
                >
                  {getIcon(item)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h4 className="text-xs font-semibold text-text-primary">{item.title}</h4>
                    {getSeverityBadge(item.severity)}
                    {!item.is_read && (
                      <span className="w-2 h-2 rounded-full bg-primary" title="Unread" />
                    )}
                  </div>
                  <p className="text-xs text-text-secondary leading-relaxed">{item.message}</p>

                  <div className="flex flex-wrap items-center gap-4 mt-2.5 text-[11px] text-text-muted">
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3" />
                      {formatTimeAgo(item.created_at)}
                    </span>

                    {item.action_href && (
                      <button
                        type="button"
                        onClick={() => navigate(item.action_href!)}
                        className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                      >
                        <span>{item.action_label || 'View'}</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Action: Mark as read */}
                {!item.is_read && (
                  <button
                    type="button"
                    onClick={() => handleMarkAsRead(item.id)}
                    className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-light-surface transition-colors"
                    title="Mark as read"
                  >
                    <CheckCircle className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminNotificationsPage;
