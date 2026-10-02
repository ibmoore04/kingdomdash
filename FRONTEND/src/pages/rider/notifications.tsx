import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Bell,
  CheckCircle,
  AlertTriangle,
  Clock,
  ExternalLink,
  CheckCheck,
  RefreshCw,
  Trash2,
  Bike,
} from 'lucide-react'
import { RiderLayout } from '@/components/rider/layout/rider-layout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  clearReadNotifications,
} from '@/services/supabase/notifications'

export interface RiderNotificationItem {
  id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  is_read: boolean
  action_url?: string | null
  created_at: string
}

export default function RiderNotificationsPage() {
  const { pushToast } = useToast()
  const [notifications, setNotifications] = useState<RiderNotificationItem[]>([])
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'dispatch' | 'system'>('all')
  const [isLoading, setIsLoading] = useState(true)

  const loadNotifications = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await getMyNotifications()
      if (res.data && Array.isArray(res.data)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapped: RiderNotificationItem[] = (res.data as any[]).map((row) => ({
          id: row.id,
          title: row.title,
          message: row.message,
          type: (row.type as RiderNotificationItem['type']) || 'info',
          is_read: Boolean(row.is_read),
          action_url: row.action_url,
          created_at: row.created_at || new Date().toISOString(),
        }))
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
      message: 'All notifications have been marked as read.',
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
      message: 'Read notifications have been removed from your list.',
      variant: 'info',
    })
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length

  const filteredNotifications = notifications.filter((n) => {
    if (activeFilter === 'unread') return !n.is_read
    if (activeFilter === 'dispatch') {
      return (
        n.action_url?.includes('assignment') ||
        n.title.toLowerCase().includes('order') ||
        n.title.toLowerCase().includes('dispatch')
      )
    }
    if (activeFilter === 'system') {
      return (
        !n.action_url?.includes('assignment') &&
        !n.title.toLowerCase().includes('order') &&
        !n.title.toLowerCase().includes('dispatch')
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

  const getTypeIcon = (type: RiderNotificationItem['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-emerald-600" aria-hidden="true" />
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden="true" />
      case 'error':
        return <AlertTriangle className="h-5 w-5 text-red-600" aria-hidden="true" />
      case 'info':
      default:
        return <Bike className="h-5 w-5 text-primary" aria-hidden="true" />
    }
  }

  return (
    <RiderLayout>
      <div className="space-y-5 max-w-4xl mx-auto pb-12 w-full min-w-0 overflow-x-hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/80 pb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-h3 font-bold text-text-primary">Notifications</h1>
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
              Dispatch requests, route alerts, earning credits, and fleet announcements.
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

        {/* Filter Pills - Horizontally scrollable on small screens */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto max-w-full pb-1">
          <div className="flex items-center gap-1.5 p-1 bg-surface-muted rounded-xl border border-border/60 shrink-0">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'unread', label: `Unread (${unreadCount})` },
                { id: 'dispatch', label: 'Dispatch Orders' },
                { id: 'system', label: 'System & Safety' },
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

        {/* List Content */}
        {isLoading ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center p-8 text-center bg-white rounded-2xl border border-border/80">
            <RefreshCw className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
            <p className="mt-3 text-body-small text-text-secondary">Loading notifications...</p>
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
                : 'Dispatch updates and announcements from KingdomDash will appear here.'}
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
                    {getTypeIcon(notif.type)}
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

                    {notif.action_url && (
                      <div className="mt-3">
                        <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 bg-white text-caption">
                          <Link to={notif.action_url}>
                            {notif.action_url.includes('support') || notif.title.toLowerCase().includes('support') ? 'View Support Ticket' : 'View Details'}
                            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                          </Link>
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </RiderLayout>
  )
}
