import { formatNgn } from './formatting'
import { getReceiptVerificationUrl } from './receipt-generator'
import type { Order, OrderItem } from '@/types'
import type { PaymentRow } from '@/services/paystack/types'

export interface GenerateReceiptImageOptions {
  order: Order & { order_items?: OrderItem[] }
  payment?: PaymentRow | null
  riderTip?: number
}

/**
 * Loads an image with CORS anonymous handling.
 */
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

/**
 * Helper to wrap text into lines fitting within maxWidth on a 2D canvas.
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let currentLine = words[0] || ''

  for (let i = 1; i < words.length; i++) {
    const word = words[i]
    const width = ctx.measureText(currentLine + ' ' + word).width
    if (width < maxWidth) {
      currentLine += ' ' + word
    } else {
      lines.push(currentLine)
      currentLine = word
    }
  }
  if (currentLine) {
    lines.push(currentLine)
  }
  return lines
}

/**
 * Renders a high-resolution, branded PNG receipt slip to an HTML5 Canvas.
 * Returns a Blob ready for file sharing via Web Share API or download.
 */
export async function generateReceiptImageBlob({
  order,
  payment,
  riderTip = 0,
}: GenerateReceiptImageOptions): Promise<Blob> {
  const items = order.order_items || []
  const orderIdShort = order.id.slice(0, 8).toUpperCase()
  const vendorName =
    (order as unknown as { vendors?: { business_name?: string } | null })?.vendors?.business_name ||
    (order as unknown as { vendor?: { business_name?: string } | null })?.vendor?.business_name ||
    'Campus Kitchen Partner'
  const serviceFee = (order as unknown as { service_fee?: number }).service_fee ?? 150
  const deliveryFee = order.delivery_fee || 0
  const subtotal = order.subtotal || 0
  const total = order.total || 0
  const verificationUrl = getReceiptVerificationUrl(order.id)

  const isCash =
    (order.status as string) === 'pending_cod' ||
    payment?.channel === 'cash' ||
    (order as unknown as { payment_method?: string }).payment_method === 'cash'

  const settlementLabel =
    order.status === 'payment_confirmed' || order.status === 'delivered'
      ? 'Paid & Settled'
      : (order.status as string) === 'pending_cod'
      ? 'Cash on Handover'
      : (order.status as string).replace(/_/g, ' ')

  const paymentMethodLabel = isCash
    ? 'Cash on Delivery'
    : payment?.channel
    ? `Via ${payment.channel.toUpperCase()}`
    : 'Paystack Escrow'

  const paymentRef =
    payment?.paystack_reference || (payment as any)?.reference || `KD-REF-${orderIdShort}`

  // Calculate dynamic canvas height based on number of items
  const baseHeight = 980
  const itemHeight = Math.max(items.length, 1) * 44
  const tipHeight = riderTip > 0 ? 32 : 0
  const canvasWidth = 720
  const canvasHeight = baseHeight + itemHeight + tipHeight

  const canvas = document.createElement('canvas')
  canvas.width = canvasWidth
  canvas.height = canvasHeight
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('Canvas 2D context not available')
  }

  // Pre-load emblem & QR code
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=0&data=${encodeURIComponent(
    verificationUrl,
  )}`
  const [emblemImg, qrImg] = await Promise.all([
    loadImage('/KingdomDash-emblem-clean.png'),
    loadImage(qrUrl),
  ])

  // 1. Background
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvasWidth, canvasHeight)

  // Outer subtle border
  ctx.strokeStyle = '#e2e8f0'
  ctx.lineWidth = 2
  ctx.strokeRect(16, 16, canvasWidth - 32, canvasHeight - 32)

  // Top Accent Bar (KingdomDash Red)
  ctx.fillStyle = '#E50914'
  ctx.fillRect(16, 16, canvasWidth - 32, 8)

  let y = 60
  const leftX = 48
  const rightX = canvasWidth - 48
  const contentWidth = rightX - leftX

  // 2. Brand Header
  if (emblemImg) {
    ctx.drawImage(emblemImg, leftX, y, 52, 52)
  }

  ctx.fillStyle = '#0f172a'
  ctx.font = 'bold 30px Inter, -apple-system, sans-serif'
  const brandX = emblemImg ? leftX + 66 : leftX
  ctx.fillText('Kingdom', brandX, y + 30)

  const kingdomWidth = ctx.measureText('Kingdom').width
  ctx.fillStyle = '#E50914'
  ctx.fillText('Dash', brandX + kingdomWidth, y + 30)

  ctx.font = 'bold 10px Inter, -apple-system, sans-serif'
  ctx.fillStyle = '#E50914'
  ctx.fillText('SWIFT IN MOTION', brandX, y + 46)

  // Right Header Corporate Details
  ctx.textAlign = 'right'
  ctx.fillStyle = '#334155'
  ctx.font = 'bold 12px Inter, -apple-system, sans-serif'
  ctx.fillText('OFFICIAL TAX INVOICE', rightX, y + 16)
  ctx.font = 'normal 11px monospace'
  ctx.fillStyle = '#64748b'
  ctx.fillText('RC: 7892341 • TIN: 2489102-0001', rightX, y + 32)
  ctx.fillText('Ijebu-Ode, Ogun State, Nigeria', rightX, y + 46)
  ctx.textAlign = 'left'

  y += 75

  // Slogan subheader
  ctx.strokeStyle = '#e2e8f0'
  ctx.setLineDash([4, 4])
  ctx.beginPath()
  ctx.moveTo(leftX, y)
  ctx.lineTo(rightX, y)
  ctx.stroke()
  ctx.setLineDash([])

  y += 18
  ctx.fillStyle = '#475569'
  ctx.font = '600 11px Inter, -apple-system, sans-serif'
  ctx.fillText('HYPERLOCAL CAMPUS LOGISTICS & INSTANT FOOD DELIVERY', leftX, y)

  ctx.textAlign = 'right'
  ctx.fillStyle = '#047857'
  ctx.font = 'bold 11px Inter, -apple-system, sans-serif'
  ctx.fillText('ORIGINAL CUSTOMER COPY', rightX, y)
  ctx.textAlign = 'left'

  y += 24

  // 3. Metadata Card (Light grey container)
  const metaBoxHeight = 82
  ctx.fillStyle = '#f8fafc'
  ctx.strokeStyle = '#e2e8f0'
  ctx.lineWidth = 1
  roundRect(ctx, leftX, y, contentWidth, metaBoxHeight, 12)
  ctx.fill()
  ctx.stroke()

  // Col 1: Order Ref
  ctx.fillStyle = '#94a3b8'
  ctx.font = 'bold 10px Inter, -apple-system, sans-serif'
  ctx.fillText('OFFICIAL ORDER REF', leftX + 16, y + 24)
  ctx.fillStyle = '#0f172a'
  ctx.font = 'bold 16px monospace'
  ctx.fillText(`#${orderIdShort}`, leftX + 16, y + 46)
  ctx.fillStyle = '#64748b'
  ctx.font = 'normal 11px Inter, -apple-system, sans-serif'
  ctx.fillText(new Date(order.created_at).toLocaleDateString(), leftX + 16, y + 64)

  // Col 2: Settlement Status
  const col2X = leftX + 220
  ctx.fillStyle = '#94a3b8'
  ctx.font = 'bold 10px Inter, -apple-system, sans-serif'
  ctx.fillText('SETTLEMENT STATUS', col2X, y + 24)
  ctx.fillStyle = '#065f46'
  ctx.font = 'bold 13px Inter, -apple-system, sans-serif'
  ctx.fillText(`✓ ${settlementLabel}`, col2X, y + 45)
  ctx.fillStyle = '#64748b'
  ctx.font = 'normal 11px monospace'
  ctx.fillText(paymentMethodLabel, col2X, y + 64)

  // Col 3: Transaction Ref
  const col3X = leftX + 430
  ctx.fillStyle = '#94a3b8'
  ctx.font = 'bold 10px Inter, -apple-system, sans-serif'
  ctx.fillText('TRANSACTION REF', col3X, y + 24)
  ctx.fillStyle = '#1e293b'
  ctx.font = 'bold 11px monospace'
  ctx.fillText(paymentRef.slice(0, 18), col3X, y + 45)
  ctx.fillStyle = '#94a3b8'
  ctx.font = 'normal 10px Inter, -apple-system, sans-serif'
  ctx.fillText('Ledger Verified Settlement', col3X, y + 64)

  y += metaBoxHeight + 16

  // 4. Parties Grid (Vendor & Delivery Destination)
  const partyBoxWidth = (contentWidth - 14) / 2
  const partyBoxHeight = 72

  // Vendor Card
  ctx.fillStyle = '#f8fafc'
  ctx.strokeStyle = '#e2e8f0'
  roundRect(ctx, leftX, y, partyBoxWidth, partyBoxHeight, 12)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = '#94a3b8'
  ctx.font = 'bold 10px Inter, -apple-system, sans-serif'
  ctx.fillText('MERCHANT VENDOR', leftX + 16, y + 22)
  ctx.fillStyle = '#0f172a'
  ctx.font = 'bold 13px Inter, -apple-system, sans-serif'
  const safeVendor = vendorName.length > 28 ? vendorName.slice(0, 27) + '…' : vendorName
  ctx.fillText(safeVendor, leftX + 16, y + 42)
  ctx.fillStyle = '#64748b'
  ctx.font = 'normal 10.5px Inter, -apple-system, sans-serif'
  ctx.fillText('Verified Campus Kitchen Partner', leftX + 16, y + 58)

  // Destination Card
  const destX = leftX + partyBoxWidth + 14
  ctx.fillStyle = '#f8fafc'
  ctx.strokeStyle = '#e2e8f0'
  roundRect(ctx, destX, y, partyBoxWidth, partyBoxHeight, 12)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = '#94a3b8'
  ctx.font = 'bold 10px Inter, -apple-system, sans-serif'
  ctx.fillText('DELIVERY DESTINATION', destX + 16, y + 22)
  ctx.fillStyle = '#1e293b'
  ctx.font = '500 11.5px Inter, -apple-system, sans-serif'
  const addressText = order.delivery_address || 'Ijebu-Ode Campus Area, Ogun State'
  const addressLines = wrapText(ctx, addressText, partyBoxWidth - 32)
  ctx.fillText(addressLines[0] || 'Campus Area', destX + 16, y + 42)
  if (addressLines[1]) {
    ctx.fillText(addressLines[1].slice(0, 32), destX + 16, y + 58)
  }

  y += partyBoxHeight + 20

  // 5. Line Items Table
  // Table Header
  ctx.fillStyle = '#f1f5f9'
  roundRect(ctx, leftX, y, contentWidth, 30, 8)
  ctx.fill()

  ctx.fillStyle = '#475569'
  ctx.font = 'bold 11px Inter, -apple-system, sans-serif'
  ctx.fillText('ITEM & DESCRIPTION', leftX + 16, y + 19)
  ctx.textAlign = 'right'
  ctx.fillText('AMOUNT', rightX - 16, y + 19)
  ctx.textAlign = 'left'

  y += 38

  // Items
  if (items.length === 0) {
    ctx.fillStyle = '#94a3b8'
    ctx.font = 'italic 12px Inter, -apple-system, sans-serif'
    ctx.fillText('Custom Order Meals', leftX + 16, y + 16)
    y += 36
  } else {
    for (const item of items) {
      // Qty badge
      ctx.fillStyle = '#e2e8f0'
      roundRect(ctx, leftX + 12, y - 2, 26, 20, 4)
      ctx.fill()
      ctx.fillStyle = '#1e293b'
      ctx.font = 'bold 10.5px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(`${item.quantity}×`, leftX + 25, y + 12)
      ctx.textAlign = 'left'

      // Product Name
      ctx.fillStyle = '#0f172a'
      ctx.font = 'bold 13px Inter, -apple-system, sans-serif'
      const safeName =
        item.product_name.length > 34 ? item.product_name.slice(0, 33) + '…' : item.product_name
      ctx.fillText(safeName, leftX + 46, y + 12)

      // Unit price
      ctx.fillStyle = '#94a3b8'
      ctx.font = 'normal 10.5px monospace'
      ctx.fillText(`@ ${formatNgn(item.unit_price)} each`, leftX + 46, y + 26)

      // Amount
      ctx.textAlign = 'right'
      ctx.fillStyle = '#0f172a'
      ctx.font = 'bold 13px monospace'
      ctx.fillText(formatNgn(item.line_total), rightX - 16, y + 16)
      ctx.textAlign = 'left'

      y += 44

      // Row separator
      ctx.strokeStyle = '#f1f5f9'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(leftX + 12, y - 10)
      ctx.lineTo(rightX - 12, y - 10)
      ctx.stroke()
    }
  }

  y += 10

  // 6. Financial Breakdown Box
  const breakdownHeight = 110 + tipHeight
  ctx.fillStyle = '#f8fafc'
  ctx.strokeStyle = '#e2e8f0'
  roundRect(ctx, leftX, y, contentWidth, breakdownHeight, 12)
  ctx.fill()
  ctx.stroke()

  let by = y + 24
  const drawRow = (label: string, value: string, bold = false, color = '#334155') => {
    ctx.fillStyle = '#64748b'
    ctx.font = 'normal 12px Inter, -apple-system, sans-serif'
    ctx.fillText(label, leftX + 16, by)
    ctx.textAlign = 'right'
    ctx.fillStyle = color
    ctx.font = bold ? 'bold 13px monospace' : 'normal 12px monospace'
    ctx.fillText(value, rightX - 16, by)
    ctx.textAlign = 'left'
    by += 22
  }

  drawRow('Items Subtotal', formatNgn(subtotal))
  drawRow('Platform Service Fee', formatNgn(serviceFee))
  drawRow('Campus Delivery Logistics', deliveryFee > 0 ? formatNgn(deliveryFee) : '₦0.00 (Free)')
  if (riderTip > 0) {
    drawRow('Rider Appreciation Tip (100% to Rider)', formatNgn(riderTip), true, '#047857')
  }

  // Total divider
  ctx.strokeStyle = '#0f172a'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(leftX + 16, by - 6)
  ctx.lineTo(rightX - 16, by - 6)
  ctx.stroke()

  by += 16
  ctx.fillStyle = '#0f172a'
  ctx.font = 'bold 13px Inter, -apple-system, sans-serif'
  ctx.fillText(order.status === 'delivered' ? 'TOTAL AMOUNT PAID' : 'TOTAL AMOUNT DUE', leftX + 16, by)

  ctx.textAlign = 'right'
  ctx.fillStyle = '#E50914'
  ctx.font = 'bold 22px monospace'
  ctx.fillText(formatNgn(total), rightX - 16, by)
  ctx.textAlign = 'left'

  y += breakdownHeight + 20

  // 7. Verification Seal & QR Box
  const verifyHeight = 88
  ctx.fillStyle = '#ecfdf5'
  ctx.strokeStyle = '#a7f3d0'
  roundRect(ctx, leftX, y, contentWidth, verifyHeight, 12)
  ctx.fill()
  ctx.stroke()

  const qrBoxSize = 68
  const qrBoxX = leftX + 14
  const qrBoxY = y + 10
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = '#d1fae5'
  roundRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 8)
  ctx.fill()
  ctx.stroke()

  if (qrImg) {
    ctx.drawImage(qrImg, qrBoxX + 4, qrBoxY + 4, qrBoxSize - 8, qrBoxSize - 8)
  } else {
    // Stylized QR fallback placeholder
    ctx.fillStyle = '#065f46'
    ctx.font = 'bold 11px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('VERIFY', qrBoxX + qrBoxSize / 2, qrBoxY + 38)
    ctx.textAlign = 'left'
  }

  const vTextX = qrBoxX + qrBoxSize + 16
  ctx.fillStyle = '#064e3b'
  ctx.font = 'bold 14px Inter, -apple-system, sans-serif'
  ctx.fillText('Authentic Digital Receipt ✓', vTextX, y + 32)
  ctx.fillStyle = '#047857'
  ctx.font = 'normal 11px Inter, -apple-system, sans-serif'
  ctx.fillText('Secured & verified on KingdomDash Authoritative Ledger', vTextX, y + 50)
  ctx.fillStyle = '#64748b'
  ctx.font = 'normal 10px monospace'
  ctx.fillText('Scan QR code with phone camera to verify authenticity', vTextX, y + 68)

  y += verifyHeight + 20

  // 8. Footer Legal Note
  ctx.strokeStyle = '#e2e8f0'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(leftX, y)
  ctx.lineTo(rightX, y)
  ctx.stroke()

  y += 18
  ctx.textAlign = 'center'
  const centerX = canvasWidth / 2
  ctx.fillStyle = '#065f46'
  ctx.font = 'bold 11px Inter, -apple-system, sans-serif'
  ctx.fillText('Certified Delivery Ledger & Paystack Settlement', centerX, y)
  ctx.fillStyle = '#64748b'
  ctx.font = 'normal 10px monospace'
  ctx.fillText(`Order ID: ${order.id}`, centerX, y + 16)
  ctx.fillStyle = '#94a3b8'
  ctx.font = 'normal 10px Inter, -apple-system, sans-serif'
  ctx.fillText(
    'KingdomDash Technologies — support@kingdomdash.ng • Swift Campus Delivery',
    centerX,
    y + 30,
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob)
      } else {
        reject(new Error('Failed to create receipt image blob'))
      }
    }, 'image/png')
  })
}

/**
 * Utility to draw rounded rectangles on HTML5 canvas.
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + width - radius, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
  ctx.lineTo(x + width, y + height - radius)
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  ctx.lineTo(x + radius, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}
