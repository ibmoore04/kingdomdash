export interface SettlementRecord {
  id: string
  orderId: string
  orderNumber: string
  merchantName: string
  createdAt: string
  status: string
  grossAmount: number
  platformCommission: number
  deliveryFee: number
  riderTip?: number
  netMerchantPayout: number
  payoutReference?: string
}

/**
 * Escapes CSV field value according to RFC 4180.
 */
function escapeCsvValue(val: unknown): string {
  if (val === null || val === undefined) return '""'
  const str = String(val).replace(/"/g, '""')
  return `"${str}"`
}

/**
 * Converts settlement records into RFC 4180 compliant CSV string with UTF-8 BOM.
 */
export function formatSettlementsCsv(settlements: SettlementRecord[]): string {
  const headers = [
    'Settlement ID',
    'Order ID',
    'Order Ref',
    'Merchant Name',
    'Date & Time',
    'Settlement Status',
    'Gross Amount (NGN)',
    'Platform Commission (NGN)',
    'Delivery Fee (NGN)',
    'Rider Tip (NGN)',
    'Net Merchant Payout (NGN)',
    'Payout Reference',
  ]

  const rows = settlements.map((s) => [
    escapeCsvValue(s.id),
    escapeCsvValue(s.orderId),
    escapeCsvValue(s.orderNumber),
    escapeCsvValue(s.merchantName),
    escapeCsvValue(s.createdAt),
    escapeCsvValue(s.status),
    escapeCsvValue(s.grossAmount.toFixed(2)),
    escapeCsvValue(s.platformCommission.toFixed(2)),
    escapeCsvValue(s.deliveryFee.toFixed(2)),
    escapeCsvValue((s.riderTip || 0).toFixed(2)),
    escapeCsvValue(s.netMerchantPayout.toFixed(2)),
    escapeCsvValue(s.payoutReference || 'PENDING_BATCH'),
  ])

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n')
  return `\uFEFF${csvContent}`
}

/**
 * Triggers instant browser download of settlements CSV file.
 */
export function exportSettlementsToCsv(
  settlements: SettlementRecord[],
  filename = `KingdomDash_Settlement_Export_${new Date().toISOString().slice(0, 10)}.csv`
): void {
  if (typeof window === 'undefined') return

  const csvData = formatSettlementsCsv(settlements)
  const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Aggregates financials from settlement records.
 */
export function calculateSettlementTotals(settlements: SettlementRecord[]) {
  return settlements.reduce(
    (acc, curr) => {
      acc.totalOrders += 1
      acc.totalGross += curr.grossAmount
      acc.totalCommissions += curr.platformCommission
      acc.totalNetPayout += curr.netMerchantPayout
      return acc
    },
    {
      totalOrders: 0,
      totalGross: 0,
      totalCommissions: 0,
      totalNetPayout: 0,
    }
  )
}
