import { useState, useEffect, useCallback } from 'react'
import {
  Bell,
  CheckCircle,
  Clock,
  ExternalLink,
  CheckCheck,
  RefreshCw,
  Trash2,
  ShoppingBag,
  Store,
  DollarSign,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  clearReadNotifications,
} from '@/services/supabase/notifications'
import type { Vendor } from '@/types'

export interface VendorNotificationItem {
  id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  is_read: boolean
  action_tab?: 'orders' | 'products' | 'profile' | 'settings' | 'support'
  action_url?: string | null
  action_label?: string | null
  created_at: string
}

interface VendorNotificationsTabProps {
  vendor: Vendor
  onNavigateToTab?: (tab: 'orders' | 'products' | 'profile' | 'settings' | 'support') => void
}

export function VendorNotificationsTab({
  onNavigateToTab,
}: VendorNotificationsTabProps) {
  const { pushToast } = useToast()
  const [notifications, setNotifications] = useState<VendorNotificationItem[]>([])
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'orders' | 'system'>('all')
  const [isLoading, setIsLoading] = useState(true)

  const loadNotifications = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await getMyNotifications()
      if (res.data && Array.isArray(res.data)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapped: VendorNotificationItem[] = (res.data as any[]).map((row) => {
          const rawUrl = row.action_url || ''
          const lowerTitle = (row.title || '').toLowerCase()
          const isSupport = rawUrl.includes('support') || lowerTitle.includes('support')
          return {
            id: row.id,
            title: row.title,
            message: row.message,
            type: (row.type as VendorNotificationItem['type']) || 'info',
            is_read: Boolean(row.is_read),
            action_tab: isSupport ? 'support' : 'orders',
            action_url: rawUrl || null,
            action_label: isSupport ? 'View Support Ticket' : undefined,
            created_at: row.created_at || new Date().toISOString(),
          }
        })
        setNotifications(mapped)
      } else {
        setNotifications([])
      }
    } catch {
      setNotifications([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  const handleMarkAsRead = async (id: string) => {
    const updated = notifications.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    setNotifications(updated)

    try {
      await markNotificationRead(id)
    } catch {
      // Silently handled
    }

    pushToast({
      title: 'Notification Read',
      message: 'Marked notification as read.',
      variant: 'info',
    })
  }

  const handleMarkAllAsRead = async () => {
    const unreadItems = notifications.filter((n) => !n.is_read)
    if (unreadItems.length === 0) return

    const updated = notifications.map((n) => ({ ...n, is_read: true }))
    setNotifications(updated)

    try {
      await markAllNotificationsRead()
    } catch {
      // Handled via local update
    }

    pushToast({
      title: 'All Caught Up',
      message: 'All notifications marked as read.',
      variant: 'success',
    })
  }

  const handleClearRead = async () => {
    const unreadOnly = notifications.filter((n) => !n.is_read)
    setNotifications(unreadOnly)

    try {
      await clearReadNotifications()
    } catch {
      // Handled via local update
    }

    pushToast({
      title: 'Cleared',
      message: 'Read notifications removed.',
      variant: 'info',
    })
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length

  const filteredNotifications = notifications.filter((n) => {
    if (activeFilter === 'unread') return !n.is_read
    if (activeFilter === 'orders') {
      return (
        n.title.toLowerCase().includes('order') ||
        n.title.toLowerCase().includes('rider') ||
        n.action_tab === 'orders'
      )
    }
    if (activeFilter === 'system') {
      return (
        !n.title.toLowerCase().includes('order') &&
        !n.title.toLowerCase().includes('rider')
      )
    }
    return true
  })

  const formatTimeAgo = (isoString: string) => {
    try {
      const diffMs = Date.now() - new Date(isoString).getTime()
      const diffMins = Math.floor(diffMs / (1000 * 60))
      if (diffMins < 1) return 'Just now'
      if (diffMins < 60) return `${diffMins}m ago`
      const diffHours = Math.floor(diffMins / 60)
      if (diffHours < 24) return `${diffHours}h ago`
      const diffDays = Math.floor(diffHours / 24)
      return `${diffDays}d ago`
    } catch {
      return 'Recently'
    }
  }

  const getIcon = (item: VendorNotificationItem) => {
    if (item.title.toLowerCase().includes('settlement') || item.title.toLowerCase().includes('payout')) {
      return <DollarSign className="h-5 w-5 text-emerald-600" aria-hidden="true" />
    }
    if (item.type === 'warning') {
      return <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden="true" />
    }
    if (item.action_tab === 'orders') {
      return <ShoppingBag className="h-5 w-5 text-primary" aria-hidden="true" />
    }
    return <Store className="h-5 w-5 text-primary" aria-hidden="true" />
  }

  return (
    <div className="space-y-5 max-w-4xl pb-16 w-full min-w-0 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/80 pb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-h3 font-bold text-text-primary">Store Notifications</h2>
            {unreadCount > 0 ? (
              <Badge variant="warning" className="font-semibold text-caption">
                {unreadCount} Unread
              </Badge>
            ) : (
              <Badge variant="default" className="font-semibold text-caption text-text-muted">
                All caught up
              </Badge>
            )}
          </div>
          <p className="text-body-small text-text-secondary mt-1">
            Order updates, courier pickup statuses, daily settlements, and catalog alerts.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleMarkAllAsRead}
            disabled={unreadCount === 0 || isLoading}
            className="gap-1.5 text-caption h-8"
          >
            <CheckCheck className="h-4 w-4" aria-hidden="true" />
            Mark all read
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={loadNotifications}
            disabled={isLoading}
            title="Refresh notifications"
            className="text-text-muted hover:text-text-primary h-8 w-8"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto max-w-full pb-1">
        <div className="flex items-center gap-1.5 p-1 bg-surface-muted rounded-xl border border-border/60 shrink-0">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'unread', label: `Unread (${unreadCount})` },
              { id: 'orders', label: 'Orders & Couriers' },
              { id: 'system', label: 'Settlements & Catalog' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-body-small font-medium transition-all whitespace-nowrap shrink-0 ${
                activeFilter === tab.id
                  ? 'bg-white text-text-primary shadow-xs font-semibold'
                  : 'text-text-secondary hover:text-text-primary hover:bg-white/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {notifications.some((n) => n.is_read) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClearRead}
            className="text-text-muted hover:text-red-600 gap-1 text-caption shrink-0"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Clear read
          </Button>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex min-h-[200px] flex-col items-center justify-center p-8 text-center bg-white rounded-2xl border border-border/80">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
          <p className="mt-3 text-body-small text-text-secondary">Loading store notifications...</p>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="flex min-h-[220px] flex-col items-center justify-center p-8 text-center bg-white rounded-2xl border border-border/80">
          <div className="h-12 w-12 rounded-2xl bg-surface-muted flex items-center justify-center text-text-muted mb-3">
            <Bell className="h-6 w-6" aria-hidden="true" />
          </div>
          <h3 className="text-body-large font-bold text-text-primary">No notifications yet</h3>
          <p className="text-body-small text-text-secondary max-w-sm mt-1">
            {activeFilter === 'unread'
              ? 'You have no unread notifications.'
              : 'Incoming customer orders, rider assignments, and settlements will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((notif) => (
            <div
              key={notif.id}
              className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                notif.is_read
                  ? 'bg-white border-border/70 hover:border-border'
                  : 'bg-primary-soft/20 border-primary/20 shadow-xs'
              }`}
            >
              <div className="flex items-start gap-3 sm:gap-4">
                <div
                  className={`h-9 w-9 sm:h-10 sm:w-10 shrink-0 rounded-xl flex items-center justify-center ${
                    notif.is_read ? 'bg-surface-muted' : 'bg-primary-soft/50'
                  }`}
                >
                  {getIcon(notif)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4
                        className={`text-body font-bold truncate ${
                          notif.is_read ? 'text-text-primary' : 'text-primary-hover'
                        }`}
                      >
                        {notif.title}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="flex items-center gap-1 text-caption text-text-muted">
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          {formatTimeAgo(notif.created_at)}
                        </span>
                        {!notif.is_read && (
                          <span className="inline-block h-2 w-2 rounded-full bg-primary" />
                        )}
                      </div>
                    </div>

                    {!notif.is_read && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMarkAsRead(notif.id)}
                        className="h-7 text-caption text-text-muted hover:text-primary gap-1 shrink-0 px-2"
                      >
                        <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        <span className="hidden sm:inline">Mark read</span>
                      </Button>
                    )}
                  </div>

                  <p className="text-body-small text-text-secondary mt-2 leading-relaxed break-words">
                    {notif.message}
                  </p>

                  {notif.action_url ? (
                    <div className="mt-3">
                      <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 bg-white text-caption">
                        <a href={notif.action_url}>
                          {notif.action_label || 'View Details'}
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        </a>
                      </Button>
                    </div>
                  ) : notif.action_tab && onNavigateToTab ? (
                    <div className="mt-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onNavigateToTab(notif.action_tab!)}
                        className="h-8 gap-1.5 bg-white text-caption"
                      >
                        {notif.action_label || `View ${notif.action_tab === 'orders' ? 'Orders' : notif.action_tab === 'support' ? 'Support' : 'Catalog'}`}
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
