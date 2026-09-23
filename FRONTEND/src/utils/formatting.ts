export function formatNgn(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Formats order ID into standard human-readable identifier (e.g., KD-20260920-00125)
 */
export function formatReadableOrderId(id: string, createdAt?: string): string {
  if (!id) return ''
  if (id.startsWith('KD-')) return id
  const datePart = createdAt
    ? new Date(createdAt).toISOString().slice(0, 10).replace(/-/g, '')
    : new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const cleanId = id.replace(/-/g, '').toUpperCase()
  const shortSeq = cleanId.slice(0, 5)
  return `KD-${datePart}-${shortSeq}`
}

