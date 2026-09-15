import { supabase } from './client'
import type { Database } from '@/types/database.types'

export type NotificationType = Database['public']['Enums']['notification_type']
export type NotificationCategory = Database['public']['Enums']['notification_category']

export interface NotificationItem {
  id: string
  profile_id: string
  title: string
  message: string
  type: NotificationType
  category: NotificationCategory
  is_read: boolean
  action_url: string | null
  idempotency_key: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface NotificationPreferences {
  profile_id: string
  order_updates: boolean
  delivery_updates: boolean
  payment_updates: boolean
  application_updates: boolean
  promotional: boolean
  operational_alerts: boolean
  created_at?: string
  updated_at?: string
}

export interface GetNotificationsOptions {
  unreadOnly?: boolean
  category?: NotificationCategory
  limit?: number
  offset?: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

/**
 * Get all notifications for the currently authenticated user.
 */
export async function getMyNotifications(options?: GetNotificationsOptions) {
  if (!supabase?.auth?.getUser) return { data: [], error: null }
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { data: null, error: authError }

  let query = db
    .from('notifications')
    .select('*')
    .eq('profile_id', user.id)
    .order('created_at', { ascending: false })

  if (options?.unreadOnly) {
    query = query.eq('is_read', false)
  }

  if (options?.category) {
    query = query.eq('category', options.category)
  }

  if (options?.limit) {
    const from = options.offset || 0
    const to = from + options.limit - 1
    query = query.range(from, to)
  }

  const { data, error } = await query
  if (error) return { data: null, error }

  return {
    data: (data || []).map((row: Record<string, unknown>) => ({
      id: String(row.id),
      profile_id: String(row.profile_id),
      title: String(row.title || ''),
      message: String(row.message || ''),
      type: (row.type as NotificationType) || 'info',
      category: (row.category as NotificationCategory) || 'system',
      is_read: Boolean(row.is_read),
      action_url: row.action_url ? String(row.action_url) : null,
      idempotency_key: row.idempotency_key ? String(row.idempotency_key) : null,
      metadata: (row.metadata as Record<string, unknown>) || {},
      created_at: String(row.created_at || new Date().toISOString()),
    })) as NotificationItem[],
    error: null,
  }
}

/**
 * Get instantaneous count of unread notifications for the caller.
 */
export async function getUnreadNotificationCount(): Promise<{ count: number; error: unknown }> {
  if (!supabase?.auth?.getUser) return { count: 0, error: null }
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { count: 0, error: authError }

  try {
    const { data, error } = await db.rpc('get_unread_notification_count')
    if (!error && typeof data === 'number') {
      return { count: data, error: null }
    }
  } catch {
    // Fallback to table count if RPC not yet populated in test mocks
  }

  if (!db?.from) return { count: 0, error: null }

  const { count, error } = await db
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('profile_id', user.id)
    .eq('is_read', false)

  return { count: count || 0, error }
}

/**
 * Mark a single notification as read via SECURITY DEFINER RPC.
 */
export async function markNotificationRead(notificationId: string) {
  if (!db?.rpc) return { data: null, error: null }
  return db.rpc('mark_notification_read', {
    p_notification_id: notificationId,
  }) as Promise<{ data: unknown; error: unknown }>
}

/**
 * Mark all unread notifications as read atomically via SECURITY DEFINER RPC.
 */
export async function markAllNotificationsRead(): Promise<{ count: number; error: unknown }> {
  if (!db?.rpc) return { count: 0, error: null }
  try {
    const { data, error } = await db.rpc('mark_all_notifications_read')
    if (error) return { count: 0, error }
    return { count: typeof data === 'number' ? data : 0, error: null }
  } catch (err) {
    return { count: 0, error: err }
  }
}

/**
 * Purge read notifications for the current authenticated user via SECURITY DEFINER RPC.
 */
export async function clearReadNotifications(): Promise<{ count: number; error: unknown }> {
  if (!db?.rpc) return { count: 0, error: null }
  try {
    const { data, error } = await db.rpc('clear_read_notifications')
    if (error) return { count: 0, error }
    return { count: typeof data === 'number' ? data : 0, error: null }
  } catch (err) {
    return { count: 0, error: err }
  }
}

/**
 * Retrieve notification preferences for the caller with default fallback.
 */
export async function getNotificationPreferences(): Promise<{ data: NotificationPreferences | null; error: unknown }> {
  if (!supabase?.auth?.getUser) return { data: null, error: null }
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { data: null, error: authError }

  if (!db?.from) return { data: null, error: null }

  const { data, error } = await db
    .from('notification_preferences')
    .select('*')
    .eq('profile_id', user.id)
    .maybeSingle()

  if (error) return { data: null, error }

  if (!data) {
    // Return sensible defaults if not yet persisted
    return {
      data: {
        profile_id: user.id,
        order_updates: true,
        delivery_updates: true,
        payment_updates: true,
        application_updates: true,
        promotional: false,
        operational_alerts: true,
      },
      error: null,
    }
  }

  return { data: data as NotificationPreferences, error: null }
}

/**
 * Update notification preferences for the caller.
 */
export async function updateNotificationPreferences(
  updates: Partial<Omit<NotificationPreferences, 'profile_id' | 'created_at' | 'updated_at'>>
): Promise<{ data: NotificationPreferences | null; error: unknown }> {
  if (!supabase?.auth?.getUser) return { data: null, error: null }
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { data: null, error: authError }

  if (!db?.from) return { data: null, error: null }

  const payload = {
    profile_id: user.id,
    ...updates,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await db
    .from('notification_preferences')
    .upsert(payload)
    .select()
    .single()

  return { data: data as NotificationPreferences, error }
}

/**
 * Subscribe to realtime notification changes for a specific user profile.
 * Returns an unsubscribe cleanup function.
 */
export function subscribeToMyNotifications(
  userId: string,
  onEvent: (payload: {
    eventType: 'INSERT' | 'UPDATE' | 'DELETE'
    new?: NotificationItem
    old?: Partial<NotificationItem>
  }) => void
): () => void {
  if (!userId || !supabase?.channel) return () => {}

  const channelName = `realtime:notifications:${userId}`
  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `profile_id=eq.${userId}`,
      },
      (payload: any) => {
        onEvent({
          eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
          new: payload.new as NotificationItem | undefined,
          old: payload.old as Partial<NotificationItem> | undefined,
        })
      }
    )
    .subscribe()

  return () => {
    if (supabase?.removeChannel && channel) {
      supabase.removeChannel(channel)
    }
  }
}
