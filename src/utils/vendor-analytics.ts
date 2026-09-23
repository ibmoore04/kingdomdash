import type { OrderOverTimeItem, AdminDateRangePreset } from '@/types/admin'

export interface MinimalVendorOrder {
  id: string
  created_at: string
  status: string
  subtotal?: number | null
  total?: number | null
}

/**
 * Formats a Date object to YYYY-MM-DD
 */
function toDateString(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Aggregates vendor orders into daily or hourly time-series buckets
 * matching the OrderVolumeChart requirements for presets (1D, 1W, 1M, 3M).
 */
export function generateVendorOrdersOverTime(
  orders: MinimalVendorOrder[],
  preset: AdminDateRangePreset = '30d'
): OrderOverTimeItem[] {
  const now = new Date()

  if (preset === 'today') {
    // 1D: 12 2-hour buckets across the 24 hours of today
    const todayStr = toDateString(now)
    const points: OrderOverTimeItem[] = []

    for (let h = 0; h < 24; h += 2) {
      const hourLabel = `${String(h).padStart(2, '0')}:00`
      const nextHour = h + 2

      const matchingOrders = orders.filter((o) => {
        const orderDate = new Date(o.created_at)
        const orderDateStr = toDateString(orderDate)
        const orderHour = orderDate.getHours()
        return orderDateStr === todayStr && orderHour >= h && orderHour < nextHour
      })

      const totalRevenue = matchingOrders.reduce((sum, o) => {
        if (o.status !== 'cancelled') {
          return sum + Number(o.subtotal || o.total || 0)
        }
        return sum
      }, 0)

      points.push({
        date: hourLabel,
        total_orders: matchingOrders.length,
        completed_orders: matchingOrders.filter((o) => o.status === 'delivered').length,
        cancelled_orders: matchingOrders.filter((o) => o.status === 'cancelled').length,
        total_revenue: totalRevenue,
      })
    }

    return points
  }

  // Multi-day presets: 7d (1W), 30d (1M), 90d (3M)
  const daysCount = preset === '7d' ? 7 : preset === '90d' ? 90 : 30
  const points: OrderOverTimeItem[] = []

  // Pre-index orders by YYYY-MM-DD for O(N) performance
  const ordersByDay = new Map<string, MinimalVendorOrder[]>()
  for (const order of orders) {
    if (!order.created_at) continue
    const d = new Date(order.created_at)
    const dayKey = toDateString(d)
    const existing = ordersByDay.get(dayKey) || []
    existing.push(order)
    ordersByDay.set(dayKey, existing)
  }

  // Generate sequence of dates leading up to today
  for (let i = daysCount - 1; i >= 0; i--) {
    const targetDate = new Date(now)
    targetDate.setDate(targetDate.getDate() - i)
    const dayKey = toDateString(targetDate)

    const dayOrders = ordersByDay.get(dayKey) || []
    const totalRevenue = dayOrders.reduce((sum, o) => {
      if (o.status !== 'cancelled') {
        return sum + Number(o.subtotal || o.total || 0)
      }
      return sum
    }, 0)

    points.push({
      date: dayKey,
      total_orders: dayOrders.length,
      completed_orders: dayOrders.filter((o) => o.status === 'delivered').length,
      cancelled_orders: dayOrders.filter((o) => o.status === 'cancelled').length,
      total_revenue: totalRevenue,
    })
  }

  return points
}
