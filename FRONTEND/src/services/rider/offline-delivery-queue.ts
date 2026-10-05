/**
 * Gate Network Resilience & Optimistic Offline Delivery Action Queue.
 * Empowers dispatch riders to record pickups, transit starts, and deliveries
 * at campus gates (TASUED / OOU) with weak or zero cellular connectivity.
 */

export interface QueuedDeliveryAction {
  id: string
  orderId: string
  actionType: 'pickup' | 'transit' | 'delivered'
  pin?: string
  timestamp: string
  retryCount: number
}

export interface CachedGateDetails {
  orderId: string
  customerName?: string
  customerPhone?: string
  deliveryAddress: string
  pickupAddress?: string
  cachedAt: string
}

const STORAGE_QUEUE_KEY = 'kd_offline_delivery_queue_v1'
const STORAGE_GATE_PREFIX = 'kd_cached_gate_order_'

/**
 * Returns all currently queued offline delivery actions.
 */
export function getQueuedDeliveryActions(): QueuedDeliveryAction[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_QUEUE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (err) {
    console.warn('[OfflineDeliveryQueue] Error reading offline queue:', err)
    return []
  }
}

/**
 * Enqueues a custody action to be submitted when cellular data reconnects.
 */
export function enqueueOfflineDeliveryAction(
  action: Omit<QueuedDeliveryAction, 'id' | 'timestamp' | 'retryCount'>
): QueuedDeliveryAction {
  const queue = getQueuedDeliveryActions()
  const queuedItem: QueuedDeliveryAction = {
    ...action,
    id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    retryCount: 0,
  }

  queue.push(queuedItem)

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_QUEUE_KEY, JSON.stringify(queue))
    } catch (err) {
      console.warn('[OfflineDeliveryQueue] Error persisting action to localStorage:', err)
    }
  }

  return queuedItem
}

/**
 * Removes a specific successfully processed action from the offline queue.
 */
export function removeQueuedDeliveryAction(id: string): void {
  if (typeof window === 'undefined') return
  try {
    const queue = getQueuedDeliveryActions().filter((item) => item.id !== id)
    localStorage.setItem(STORAGE_QUEUE_KEY, JSON.stringify(queue))
  } catch (err) {
    console.warn('[OfflineDeliveryQueue] Error removing item from offline queue:', err)
  }
}

/**
 * Clears the entire offline delivery queue.
 */
export function clearOfflineDeliveryQueue(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_QUEUE_KEY)
  } catch (err) {
    console.warn('[OfflineDeliveryQueue] Error clearing queue:', err)
  }
}

/**
 * Caches customer and gate handover details locally so the rider can access
 * phone numbers and addresses even in complete cellular blackout zones.
 */
export function cacheOrderGateDetails(
  orderId: string,
  details: Omit<CachedGateDetails, 'orderId' | 'cachedAt'>
): void {
  if (typeof window === 'undefined') return
  try {
    const record: CachedGateDetails = {
      ...details,
      orderId,
      cachedAt: new Date().toISOString(),
    }
    localStorage.setItem(`${STORAGE_GATE_PREFIX}${orderId}`, JSON.stringify(record))
  } catch (err) {
    console.warn('[OfflineDeliveryQueue] Error caching gate details:', err)
  }
}

/**
 * Retrieves cached recipient and gate delivery instructions for an order.
 */
export function getCachedOrderGateDetails(orderId: string): CachedGateDetails | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(`${STORAGE_GATE_PREFIX}${orderId}`)
    return raw ? JSON.parse(raw) : null
  } catch (err) {
    console.warn('[OfflineDeliveryQueue] Error retrieving cached gate details:', err)
    return null
  }
}

/**
 * Flushes the queued actions by invoking a provided processor callback for each item.
 */
export async function syncQueuedDeliveryActions(
  processor: (action: QueuedDeliveryAction) => Promise<boolean>
): Promise<{ synced: number; failed: number }> {
  const actions = getQueuedDeliveryActions()
  if (actions.length === 0) return { synced: 0, failed: 0 }

  let synced = 0
  let failed = 0

  for (const action of actions) {
    try {
      const ok = await processor(action)
      if (ok) {
        removeQueuedDeliveryAction(action.id)
        synced++
      } else {
        failed++
      }
    } catch {
      failed++
    }
  }

  return { synced, failed }
}

/**
 * Auto-registers online sync listener in browser environment.
 */
export function registerAutoQueueSync(
  processor: (action: QueuedDeliveryAction) => Promise<boolean>
): () => void {
  if (typeof window === 'undefined') return () => {}

  const handleOnline = () => {
    syncQueuedDeliveryActions(processor).catch((err) => {
      console.warn('[OfflineDeliveryQueue] Auto-sync failed on online event:', err)
    })
  }

  window.addEventListener('online', handleOnline)
  return () => window.removeEventListener('online', handleOnline)
}
