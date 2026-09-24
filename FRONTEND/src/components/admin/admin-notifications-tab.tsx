import { useState, useEffect, useCallback } from 'react'
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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { getMyNotifications, markNotificationRead } from '@/services/supabase/notifications'

export interface AdminNotificationItem {
  id: string
  title: string
  message: string
  severity: 'critical' | 'warning' | 'info'
  is_read: boolean
  category: 'application' | 'dispatch' | 'system'
  action_label?: string
  created_at: string
}

const STORAGE_KEY = 'kd_admin_notifications_cache'

export function AdminNotificationsTab() {
  const { pushToast } = useToast()
  const [notifications, setNotifications] = useState<AdminNotificationItem[]>([])
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'applications' | 'system'>('all')
  const [isLoading, setIsLoading] = useState(true)

  const loadNotifications = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await getMyNotifications()
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapped: AdminNotificationItem[] = (res.data as any[]).map((row) => {
          const lowerTitle = (row.title || '').toLowerCase()
          const lowerMsg = (row.message || '').toLowerCase()
          const rawUrl = row.action_url || ''
          const isSupport =
            lowerTitle.includes('support') ||
            lowerMsg.includes('support') ||
            lowerTitle.includes('ticket') ||
            lowerTitle.includes('kd-sup') ||
            rawUrl.includes('/admin/support')

          return {
            id: row.id,
            title: row.title || 'Platform Notification',
            message: row.message || '',
            severity: (row.type === 'error' ? 'critical' : row.type === 'warning' ? 'warning' : 'info'),
            is_read: Boolean(row.is_read),
            category: 'system',
            action_label: isSupport ? 'View Support Ticket' : 'View Details',
            action_href: rawUrl || (isSupport ? '/admin/support' : '/admin/dashboard'),
            created_at: row.created_at || new Date().toISOString(),
          }
        })
        setNotifications(mapped)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(mapped))
      } else {
        const cached = localStorage.getItem(STORAGE_KEY)
        if (cached) {
          try {
            setNotifications(JSON.parse(cached))
          } catch {
            setNotifications([])
          }
        } else {
          setNotifications([])
        }
      }
    } catch {
      const cached = localStorage.getItem(STORAGE_KEY)
      if (cached) {
        try {
          setNotifications(JSON.parse(cached))
        } catch {
          setNotifications([])
        }
      } else {
        setNotifications([])
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  const persist = (updated: AdminNotificationItem[]) => {
    setNotifications(updated)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    } catch (err) {
      console.error('Failed to save admin notifications cache', err)
    }
  }

  const handleMarkAsRead = async (id: string) => {
    const updated = notifications.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    persist(updated)

    if (!id.startsWith('seed-')) {
      try {
        await markNotificationRead(id)
      } catch {
        // Silently handled
      }
    }

    pushToast({
      title: 'Alert Acknowledged',
      message: 'Notification marked as read.',
      variant: 'info',
    })
  }

  const handleMarkAllAsRead = async () => {
    const unreadCount = notifications.filter((n) => !n.is_read).length
    if (unreadCount === 0) return

    const updated = notifications.map((n) => ({ ...n, is_read: true }))
    persist(updated)

    const realUnread = notifications.filter((n) => !n.is_read && !n.id.startsWith('seed-'))
    await Promise.all(realUnread.map((n) => markNotificationRead(n.id).catch(() => {})))

    pushToast({
      title: 'All Caught Up',
      message: 'All system alerts have been marked as read.',
      variant: 'success',
    })
  }

  const handleClearRead = () => {
    const unreadOnly = notifications.filter((n) => !n.is_read)
    persist(unreadOnly)
    pushToast({
      title: 'Cleared',
      message: 'Read admin alerts removed.',
      variant: 'info',
    })
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length

  const filteredNotifications = notifications.filter((n) => {
    if (activeFilter === 'unread') return !n.is_read
    if (activeFilter === 'applications') return n.category === 'application'
    if (activeFilter === 'system') return n.category === 'system' || n.category === 'dispatch'
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

  const getSeverityBadge = (severity: AdminNotificationItem['severity']) => {
    switch (severity) {
      case 'critical':
        return <Badge variant="error">Critical</Badge>
      case 'warning':
        return <Badge variant="warning">Warning</Badge>
      case 'info':
      default:
        return <Badge variant="info">Info</Badge>
    }
  }

  const getIcon = (item: AdminNotificationItem) => {
    if (item.category === 'application') {
      return item.title.toLowerCase().includes('rider') ? (
        <Bike className="h-5 w-5 text-primary" aria-hidden="true" />
      ) : (
        <Store className="h-5 w-5 text-primary" aria-hidden="true" />
      )
    }
    if (item.severity === 'critical' || item.severity === 'warning') {
      return <ShieldAlert className="h-5 w-5 text-amber-600" aria-hidden="true" />
    }
    return <Bell className="h-5 w-5 text-primary" aria-hidden="true" />
  }

  return (
    <div className="space-y-6 max-w-4xl pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-h3 font-bold text-text-primary">Admin System Alerts</h2>
            {unreadCount > 0 ? (
              <Badge variant="warning" className="font-semibold text-caption">
                {unreadCount} Unread
              </Badge>
            ) : (
              <Badge variant="default" className="font-semibold text-caption text-text-muted">
                All systems nominal
              </Badge>
            )}
          </div>
          <p className="text-body-small text-text-secondary mt-1">
            Real-time platform warnings, onboarding submissions, and infrastructure telemetry.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleMarkAllAsRead}
            disabled={unreadCount === 0 || isLoading}
            className="gap-1.5"
          >
            <CheckCheck className="h-4 w-4" aria-hidden="true" />
            Mark all as read
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={loadNotifications}
            disabled={isLoading}
            title="Refresh alerts"
            className="text-text-muted hover:text-text-primary"
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
              { id: 'applications', label: 'Rider & Vendor Signups' },
              { id: 'system', label: 'System Health & Dispatch' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-body-small font-medium transition-all shrink-0 whitespace-nowrap ${
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
            className="text-text-muted hover:text-red-600 gap-1.5 text-caption"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Clear read
          </Button>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex min-h-[250px] flex-col items-center justify-center p-8 text-center bg-white rounded-2xl border border-border/80">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
          <p className="mt-3 text-body-small text-text-secondary">Loading system alerts...</p>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="flex min-h-[250px] flex-col items-center justify-center p-8 text-center bg-white rounded-2xl border border-border/80">
          <div className="h-12 w-12 rounded-2xl bg-surface-muted flex items-center justify-center text-text-muted mb-3">
            <Bell className="h-6 w-6" aria-hidden="true" />
          </div>
          <h3 className="text-body-large font-bold text-text-primary">No pending alerts</h3>
          <p className="text-body-small text-text-secondary max-w-sm mt-1">
            {activeFilter === 'unread'
              ? 'All alerts have been reviewed and resolved.'
              : 'No alerts match the selected filter.'}
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
              <div className="flex items-start gap-4">
                <div
                  className={`h-10 w-10 shrink-0 rounded-xl flex items-center justify-center ${
                    notif.is_read ? 'bg-surface-muted' : 'bg-primary-soft/50'
                  }`}
                >
                  {getIcon(notif)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4
                          className={`text-body font-bold ${
                            notif.is_read ? 'text-text-primary' : 'text-primary-hover'
                          }`}
                        >
                          {notif.title}
                        </h4>
                        {getSeverityBadge(notif.severity)}
                      </div>
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
                        className="h-8 text-caption text-text-muted hover:text-primary gap-1"
                      >
                        <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        <span className="hidden sm:inline">Mark read</span>
                      </Button>
                    )}
                  </div>

                  <p className="text-body-small text-text-secondary mt-2 leading-relaxed">
                    {notif.message}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
