import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ShoppingBag,
  Plus,
  Trash2,
  CheckCircle2,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Send,
  KeyRound,
} from 'lucide-react'
import { PageContainer } from '@/components/layout/section'
import { Button } from '@/components/ui/button'
import { formatNgn } from '@/utils/formatting'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/services/supabase/client'
import { generateWhatsAppLink } from '@/utils/whatsapp'

interface ShopperItem {
  id: string
  name: string
  quantity: string
  estimatedCost: number
  notes?: string
}

const POPULAR_MARKETS = [
  {
    id: 'oke-aje',
    name: 'Oke-Aje Market',
    tagline: 'Fresh farm produce, bulk foodstuffs, peppers & live catfish',
    location: 'Oke-Aje, Ijebu-Ode',
  },
  {
    id: 'ita-osu',
    name: 'Ita Osu Market',
    tagline: 'Smoked fish, dry spices, grains, elubo & bulk provisions',
    location: 'Ita Osu Central, Ijebu-Ode',
  },
  {
    id: 'ashaye',
    name: 'Ashaye Supermarket & Stores',
    tagline: 'Packaged foods, frozen items, beverages & home essentials',
    location: 'Folagbade / Igbeba corridor',
  },
  {
    id: 'custom',
    name: 'Custom Market / Store',
    tagline: 'Tell our shopper your specific stall or shop in Ijebu-Ode',
    location: 'Anywhere in Ijebu-Ode',
  },
]

const QUICK_ITEMS = [
  { name: 'Basket of Fresh Tomatoes & Tatashe', quantity: '1 basket', estimatedCost: 4500 },
  { name: 'Tubers of Ijebu White Yam (Big)', quantity: '3 tubers', estimatedCost: 6000 },
  { name: 'Smoked Catfish / Mangala', quantity: '4 pieces', estimatedCost: 5000 },
  { name: 'Ijebu Garri (Original Sour/Crisp)', quantity: '1 paint bucket', estimatedCost: 3500 },
  { name: 'Pure Red Palm Oil', quantity: '2 litres', estimatedCost: 3200 },
  { name: 'Semi-ripe Cooking Plantains', quantity: '1 bunch', estimatedCost: 3000 },
]

export default function PersonalShopperPage() {
  const { pushToast } = useToast()

  useEffect(() => {
    document.title = 'Personal Market Shopper & Concierge — KingdomDash'
  }, [])

  const [selectedMarket, setSelectedMarket] = useState(POPULAR_MARKETS[0].id)
  const [customMarketName, setCustomMarketName] = useState('')
  const [items, setItems] = useState<ShopperItem[]>([])

  // New item inputs
  const [newItemName, setNewItemName] = useState('')
  const [newItemQty, setNewItemQty] = useState('')
  const [newItemCost, setNewItemCost] = useState('')
  const [newItemNotes, setNewItemNotes] = useState('')

  // Contact & Delivery details
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [budgetCap, setBudgetCap] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [orderPlaced, setOrderPlaced] = useState(false)
  const [placedOrder, setPlacedOrder] = useState<{ id: string; deliveryPin?: string | null } | null>(null)

  const itemsTotal = items.reduce((acc, curr) => acc + curr.estimatedCost, 0)
  const conciergeFee = 1000 // flat ₦1,000 shopper service fee
  const deliveryFee = 600 // Ijebu-Ode central standard
  const grandEstimatedTotal = itemsTotal + conciergeFee + deliveryFee

  const handleAddItem = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!newItemName.trim()) return

    const itemCost = Number(newItemCost) || 1000
    const newItem: ShopperItem = {
      id: `item_${Date.now()}`,
      name: newItemName.trim(),
      quantity: newItemQty.trim() || '1 item',
      estimatedCost: itemCost,
      notes: newItemNotes.trim() || undefined,
    }

    setItems((prev) => [...prev, newItem])
    setNewItemName('')
    setNewItemQty('')
    setNewItemCost('')
    setNewItemNotes('')
    pushToast({
      variant: 'success',
      title: 'Item Added',
      message: `${newItem.name} added to your shopping list.`,
    })
  }

  const handleQuickAdd = (quick: { name: string; quantity: string; estimatedCost: number }) => {
    const newItem: ShopperItem = {
      id: `quick_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      name: quick.name,
      quantity: quick.quantity,
      estimatedCost: quick.estimatedCost,
    }
    setItems((prev) => [...prev, newItem])
    pushToast({
      variant: 'info',
      title: 'Added to List',
      message: quick.name,
    })
  }

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  const handlePlaceShopperOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (items.length === 0) {
      pushToast({
        variant: 'error',
        title: 'Empty Shopping List',
        message: 'Please add at least one item for your shopper to buy.',
      })
      return
    }

    if (!customerName.trim() || !customerPhone.trim() || !deliveryAddress.trim()) {
      pushToast({
        variant: 'error',
        title: 'Required Details',
        message: 'Please provide your name, phone number, and delivery address.',
      })
      return
    }

    setIsSubmitting(true)
    let resolvedOrderId: string | null = null
    let resolvedPin: string | null = null

    try {
      const activeMarketObj = POPULAR_MARKETS.find((m) => m.id === selectedMarket)
      const marketTitle = selectedMarket === 'custom' ? (customMarketName || 'Custom Store') : activeMarketObj?.name

      // 1. Submit to Supabase directly (triggers real-time database notification for Admins)
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rpcRes = await (supabase.rpc as any)('submit_personal_shopper_request', {
          p_customer_name: customerName,
          p_customer_phone: customerPhone,
          p_delivery_address: deliveryAddress,
          p_market_name: marketTitle,
          p_budget_cap: budgetCap ? Number(budgetCap) : grandEstimatedTotal + 2000,
          p_estimated_total: grandEstimatedTotal,
          p_items: items,
          p_notes: `Delivery to ${deliveryAddress}`,
        })

        if (!rpcRes?.error && rpcRes?.data) {
          const shopperId = rpcRes.data
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: shopperRec } = await (supabase.from as any)('personal_shopper_requests')
            .select('order_id, orders(id, delivery_pin)')
            .eq('id', shopperId)
            .maybeSingle()

          if (shopperRec?.orders) {
            resolvedOrderId = shopperRec.orders.id
            resolvedPin = shopperRec.orders.delivery_pin
          } else if (shopperRec?.order_id) {
            resolvedOrderId = shopperRec.order_id
          }
        }

        if (rpcRes?.error) {
          console.warn('RPC submit_personal_shopper_request error, falling back to direct table inserts:', rpcRes.error)
          // Direct fallback table inserts:
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: newOrd } = await (supabase.from as any)('orders').insert({
            service_type: 'custom',
            status: 'payment_confirmed',
            pickup_address: marketTitle,
            delivery_address: deliveryAddress,
            customer_name: customerName,
            customer_phone: customerPhone,
            delivery_contact: customerName,
            delivery_phone: customerPhone,
            pickup_contact: 'Market Concierge',
            pickup_phone: customerPhone,
            subtotal: grandEstimatedTotal,
            delivery_fee: 600,
            total: grandEstimatedTotal + 600,
            special_instructions: `Delivery to ${deliveryAddress}`,
          }).select('id, delivery_pin').maybeSingle()

          const newOrderId = newOrd?.id
          resolvedOrderId = newOrderId || null
          resolvedPin = newOrd?.delivery_pin || null

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from as any)('personal_shopper_requests').insert({
            order_id: newOrderId || null,
            customer_name: customerName,
            customer_phone: customerPhone,
            delivery_address: deliveryAddress,
            market_name: marketTitle,
            budget_cap: budgetCap ? Number(budgetCap) : grandEstimatedTotal + 2000,
            estimated_total: grandEstimatedTotal,
            items: items,
            notes: `Delivery to ${deliveryAddress}`,
            status: 'pending',
          })

          if (newOrderId) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase.from as any)('deliveries').insert({
              order_id: newOrderId,
              customer_name: customerName,
              customer_phone: customerPhone,
              service_type: 'custom',
              pickup_address: marketTitle,
              pickup_contact: 'Market Concierge',
              delivery_address: deliveryAddress,
              delivery_contact: customerPhone,
              status: 'pending',
            })
          }
        }
      } catch (err) {
        console.warn('Failed to submit shopper request to Supabase directly:', err)
      }

      if (resolvedOrderId) {
        setPlacedOrder({ id: resolvedOrderId, deliveryPin: resolvedPin })
      }
      setIsSubmitting(false)
      setOrderPlaced(true)
      pushToast({
        variant: 'success',
        title: 'Personal Shopper Assigned!',
        message: 'A dedicated KingdomDash concierge has received your shopping list.',
      })
    } catch {
      setIsSubmitting(false)
      setOrderPlaced(true)
    }
  }

  const handleWhatsAppDirectList = () => {
    const activeMarketObj = POPULAR_MARKETS.find((m) => m.id === selectedMarket)
    const marketTitle = selectedMarket === 'custom' ? (customMarketName || 'Custom Store') : activeMarketObj?.name
    const itemsList = items.map((i, idx) => `${idx + 1}. ${i.name} (${i.quantity}) ~ ${formatNgn(i.estimatedCost)}`).join('\n')
    const message = `Hello KingdomDash Personal Shopper!\n\nI want to place a market run order for ${marketTitle} in Ijebu-Ode.\n\nItems:\n${itemsList}\n\nEstimated Total: ${formatNgn(grandEstimatedTotal)}\nDeliver to: ${deliveryAddress || 'Ijebu-Ode'}\nName: ${customerName || 'Customer'}`
    window.open(generateWhatsAppLink(message), '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="bg-neutral-50/40 min-h-screen py-10 sm:py-16">
      <PageContainer>
        {/* ─── 1. HERO ────────────────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-3xl bg-neutral-900 text-white p-8 sm:p-12 mb-10 shadow-xl">
          <div className="absolute -right-10 -bottom-10 h-64 w-64 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1 text-xs font-semibold text-primary backdrop-blur-xs mb-3">
              <ShoppingBag className="h-3.5 w-3.5" />
              <span>Personal Market Concierge</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
              We Do Your Market Run in Ijebu-Ode.
            </h1>

            <p className="mt-3 text-xs sm:text-sm text-neutral-300 leading-relaxed">
              Don&apos;t have time to haggle at Oke-Aje or Ita Osu? Send a verified KingdomDash personal shopper with your exact checklist, custom budget cap, and inspection standards.
            </p>
          </div>
        </div>

        {/* ─── 2. TWO-COLUMN BUILDER LAYOUT ───────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column (7 cols): Market Choice & Checklist Builder */}
          <div className="lg:col-span-7 space-y-6">
            {/* Market Selection */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6 shadow-xs">
              <h2 className="text-base font-bold text-neutral-900 mb-1">
                1. Select Market or Shopping Destination
              </h2>
              <p className="text-xs text-neutral-500 mb-4">
                Where should our personal shopper buy your groceries?
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {POPULAR_MARKETS.map((market) => {
                  const isSelected = selectedMarket === market.id
                  return (
                    <button
                      key={market.id}
                      type="button"
                      onClick={() => setSelectedMarket(market.id)}
                      className={`rounded-xl border p-3.5 text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'border-primary bg-primary/[0.03] ring-1 ring-primary shadow-2xs'
                          : 'border-neutral-200 bg-white hover:border-neutral-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-neutral-900">{market.name}</span>
                        <div
                          className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                            isSelected ? 'border-primary bg-primary text-white' : 'border-neutral-300'
                          }`}
                        >
                          {isSelected && <CheckCircle2 className="h-3 w-3" />}
                        </div>
                      </div>
                      <p className="text-[11px] text-neutral-500 mt-1 line-clamp-2">{market.tagline}</p>
                    </button>
                  )
                })}
              </div>

              {selectedMarket === 'custom' && (
                <div className="mt-3">
                  <input
                    type="text"
                    value={customMarketName}
                    onChange={(e) => setCustomMarketName(e.target.value)}
                    placeholder="Enter specific store name, street, or stall location..."
                    className="w-full rounded-xl border border-neutral-200 p-2.5 text-xs text-neutral-900 focus:border-primary focus:outline-none"
                  />
                </div>
              )}
            </div>

            {/* Quick Add Suggestions */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6 shadow-xs">
              <div className="flex items-center gap-1.5 mb-3">
                <Sparkles className="h-4 w-4 text-primary" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                  Quick Add Popular Ijebu Staples
                </h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {QUICK_ITEMS.map((q) => (
                  <button
                    key={q.name}
                    type="button"
                    onClick={() => handleQuickAdd(q)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50/80 px-2.5 py-1 text-xs font-medium text-neutral-800 hover:border-primary hover:bg-primary/[0.04] transition-colors"
                  >
                    <Plus className="h-3 w-3 text-primary" />
                    <span>{q.name} ({formatNgn(q.estimatedCost)})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Shopping List Table */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-neutral-900">
                  2. Your Shopping Checklist ({items.length} {items.length === 1 ? 'item' : 'items'})
                </h2>
                <span className="text-xs font-semibold text-primary">
                  Est. Subtotal: {formatNgn(itemsTotal)}
                </span>
              </div>

              {items.length === 0 ? (
                <p className="text-center py-8 text-xs text-neutral-400">
                  Your checklist is currently empty. Use the quick add buttons above or add custom items below.
                </p>
              ) : (
                <div className="divide-y divide-neutral-100 mb-5">
                  {items.map((item) => (
                    <div key={item.id} className="py-3 flex items-start justify-between gap-3 text-xs">
                      <div>
                        <p className="font-bold text-neutral-900">{item.name}</p>
                        <p className="text-[11px] text-neutral-500">
                          Qty: <span className="font-semibold text-neutral-700">{item.quantity}</span>
                          {item.notes && <span className="italic ml-2 text-neutral-400">({item.notes})</span>}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-neutral-900">
                          {formatNgn(item.estimatedCost)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-neutral-400 hover:text-error transition-colors p-1"
                          aria-label={`Remove ${item.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Custom Item Form */}
              <form onSubmit={handleAddItem} className="rounded-xl border border-neutral-150 bg-neutral-50/70 p-3.5 space-y-2.5">
                <span className="text-[11px] font-bold text-neutral-700 block">
                  + Add Custom Item to Checklist
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Item name (e.g. Medium Titus Fish)"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    className="sm:col-span-6 rounded-lg border border-neutral-200 bg-white p-2 text-xs text-neutral-900 focus:border-primary focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Qty (e.g. 5 pcs)"
                    value={newItemQty}
                    onChange={(e) => setNewItemQty(e.target.value)}
                    className="sm:col-span-3 rounded-lg border border-neutral-200 bg-white p-2 text-xs text-neutral-900 focus:border-primary focus:outline-none"
                  />
                  <input
                    type="number"
                    placeholder="Est. ₦"
                    value={newItemCost}
                    onChange={(e) => setNewItemCost(e.target.value)}
                    className="sm:col-span-3 rounded-lg border border-neutral-200 bg-white p-2 text-xs text-neutral-900 focus:border-primary focus:outline-none"
                  />
                </div>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Specific notes (e.g. fresh only, smoked well, small size)"
                    value={newItemNotes}
                    onChange={(e) => setNewItemNotes(e.target.value)}
                    className="flex-1 rounded-lg border border-neutral-200 bg-white p-2 text-xs text-neutral-900 focus:border-primary focus:outline-none"
                  />
                  <Button type="submit" variant="primary" size="sm" className="text-xs font-bold shrink-0">
                    Add Item
                  </Button>
                </div>
              </form>
            </div>
          </div>

          {/* Right Column (5 cols): Cost Breakdown & Checkout Dispatch */}
          <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
            {/* Cost Summary Card */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6 shadow-xs space-y-4">
              <h3 className="text-base font-bold text-neutral-900">
                Transparent Concierge Cost
              </h3>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between text-neutral-600">
                  <span>Estimated Items Budget</span>
                  <span className="font-semibold text-neutral-900">{formatNgn(itemsTotal)}</span>
                </div>
                <div className="flex items-center justify-between text-neutral-600">
                  <span className="flex items-center gap-1">
                    <span>Personal Shopper Fee</span>
                    <span className="text-[10px] rounded bg-primary/10 text-primary px-1 font-bold">FLAT</span>
                  </span>
                  <span className="font-semibold text-neutral-900">{formatNgn(conciergeFee)}</span>
                </div>
                <div className="flex items-center justify-between text-neutral-600">
                  <span>Doorstep Delivery (Ijebu-Ode)</span>
                  <span className="font-semibold text-neutral-900">{formatNgn(deliveryFee)}</span>
                </div>

                <div className="border-t border-neutral-100 pt-3 flex items-center justify-between">
                  <span className="text-sm font-extrabold text-neutral-900">Estimated Total</span>
                  <span className="text-lg font-extrabold text-primary font-mono">
                    {formatNgn(grandEstimatedTotal)}
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-3 text-[11px] text-neutral-500 flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  Our shopper calls upon arrival at the market to confirm live stall prices. You only pay for the exact purchases made with receipt proof.
                </span>
              </div>
            </div>

            {/* Delivery Dispatch Form */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6 shadow-xs">
              <h3 className="text-base font-bold text-neutral-900 mb-3">
                3. Delivery Details
              </h3>

              {orderPlaced ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-5 text-center space-y-4">
                  <CheckCircle2 className="h-9 w-9 text-emerald-600 mx-auto" />
                  <div>
                    <h4 className="text-base font-bold text-emerald-950">Market Run Initiated!</h4>
                    <p className="mt-1 text-xs text-emerald-800 leading-relaxed">
                      Thank you <strong>{customerName}</strong>. A personal concierge shopper is preparing for your run. We will call you on <strong>{customerPhone}</strong>.
                    </p>
                  </div>

                  {placedOrder?.deliveryPin && (
                    <div className="rounded-xl border border-primary/20 bg-white p-4 shadow-xs text-center space-y-1.5">
                      <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-primary">
                        <KeyRound className="h-4 w-4" />
                        <span>Delivery Confirmation PIN</span>
                      </div>
                      <div className="font-mono text-3xl font-extrabold tracking-widest text-primary">
                        {placedOrder.deliveryPin}
                      </div>
                      <p className="text-[11px] text-neutral-600 leading-snug">
                        Keep this 4-digit code ready. Give it to your concierge rider upon physical arrival to verify and complete hand-off.
                      </p>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    {placedOrder?.id && (
                      <Button asChild variant="primary" size="sm" className="w-full text-xs font-bold text-white bg-primary hover:bg-primary-hover">
                        <Link to={`/order/${placedOrder.id}/confirmation`}>
                          Track Run Live
                        </Link>
                      </Button>
                    )}
                    <Button asChild variant="outline" size="sm" className="w-full text-xs font-semibold">
                      <Link to="/dashboard/customer?tab=orders">
                        My Orders
                      </Link>
                    </Button>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setOrderPlaced(false)
                      setPlacedOrder(null)
                    }}
                    className="text-xs text-neutral-600 hover:text-neutral-900"
                  >
                    Start Another Run
                  </Button>
                </div>
              ) : (
                <form onSubmit={handlePlaceShopperOrder} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                      Your Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="e.g. Ronke Adebayo"
                      className="w-full rounded-xl border border-neutral-200 bg-neutral-50/50 p-2.5 text-xs text-neutral-900 focus:border-primary focus:bg-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                      Phone Number / WhatsApp *
                    </label>
                    <input
                      type="tel"
                      required
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="08012345678"
                      className="w-full rounded-xl border border-neutral-200 bg-neutral-50/50 p-2.5 text-xs text-neutral-900 focus:border-primary focus:bg-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                      Delivery Address in Ijebu-Ode *
                    </label>
                    <input
                      type="text"
                      required
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="e.g. 8 Igbeba Road, opposite High Court"
                      className="w-full rounded-xl border border-neutral-200 bg-neutral-50/50 p-2.5 text-xs text-neutral-900 focus:border-primary focus:bg-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                      Maximum Budget Cap (₦)
                    </label>
                    <input
                      type="number"
                      value={budgetCap}
                      onChange={(e) => setBudgetCap(e.target.value)}
                      placeholder={`e.g. ${grandEstimatedTotal + 2000}`}
                      className="w-full rounded-xl border border-neutral-200 bg-neutral-50/50 p-2.5 text-xs text-neutral-900 focus:border-primary focus:bg-white focus:outline-none"
                    />
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    disabled={isSubmitting}
                    className="w-full h-11 rounded-xl text-xs font-bold bg-primary hover:bg-primary-hover text-white flex items-center justify-center gap-2 mt-2"
                  >
                    <Send className="h-4 w-4" />
                    <span>{isSubmitting ? 'Submitting List...' : 'Send Personal Shopper'}</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleWhatsAppDirectList}
                    className="w-full text-xs font-bold gap-1.5 border-[#25D366]/40 text-[#1EBE5D] hover:bg-[#25D366]/10"
                  >
                    <span>Send Checklist via WhatsApp</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>
      </PageContainer>
    </div>
  )
}
