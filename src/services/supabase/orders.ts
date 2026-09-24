import { supabase } from './client'

// Scaffold compatibility: cast to untyped client until `npm run db:types` generates real types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export interface OrderItem {
  product_id: string
  quantity: number
}

export interface CreateOrderParams {
  vendorId: string
  serviceType: 'food' | 'grocery'
  pickupAddress: string
  deliveryAddress: string
  deliveryAddressId: string
  items: OrderItem[]
  specialInstructions?: string
}

/**
 * Places an order via the PostgreSQL `create_order_secure` SECURITY DEFINER RPC.
 *
 * Phase 8 Distance-Based Pricing Architecture:
 * ZERO CLIENT FINANCIAL AUTHORITY:
 * The client supplies ONLY identifiers, quantities, and addresses.
 * The database verifies caller ownership of `deliveryAddressId`, checks
 * serviceability, calculates straight-line distance, selects the deterministic
 * 4-tier pricing rule, computes the delivery fee, locks product rows, computes
 * the subtotal, calculates the total, and snapshots the financial values atomically.
 */
export async function createOrderSecure(params: CreateOrderParams) {
  // Cast needed because Database is a bootstrap scaffold (Record<string, never>);
  // once `npm run db:types` is run the real types replace this scaffold.
  return db.rpc('create_order_secure', {
    p_vendor_id: params.vendorId,
    p_service_type: params.serviceType,
    p_pickup_address: params.pickupAddress,
    p_delivery_address: params.deliveryAddress,
    p_items: params.items,
    p_special_instructions: params.specialInstructions ?? null,
    p_delivery_address_id: params.deliveryAddressId,
  }) as Promise<{ data: unknown; error: unknown }>
}

export interface CreateCourierOrderParams {
  pickupAddress: string
  pickupContact: string
  pickupPhone: string
  pickupLat: number
  pickupLon: number
  deliveryAddress: string
  deliveryContact: string
  deliveryPhone: string
  deliveryLat: number
  deliveryLon: number
  idempotencyKey: string
  specialInstructions?: string
}

/**
 * Places a standalone courier dispatch request via `create_courier_order_secure` RPC.
 *
 * Courier requests do NOT require a vendor, catalog products, or vendor_id.
 * Distance and fee are computed server-side from geographic coordinates.
 */
export async function createCourierOrderSecure(params: CreateCourierOrderParams) {
  return db.rpc('create_courier_order_secure', {
    p_pickup_address: params.pickupAddress,
    p_pickup_contact: params.pickupContact,
    p_pickup_phone: params.pickupPhone,
    p_pickup_lat: params.pickupLat,
    p_pickup_lon: params.pickupLon,
    p_delivery_address: params.deliveryAddress,
    p_delivery_contact: params.deliveryContact,
    p_delivery_phone: params.deliveryPhone,
    p_delivery_lat: params.deliveryLat,
    p_delivery_lon: params.deliveryLon,
    p_idempotency_key: params.idempotencyKey,
    p_special_instructions: params.specialInstructions ?? null,
  }) as Promise<{ data: unknown; error: unknown }>
}

export async function getOrderById(id: string) {
  return db
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', id)
    .single() as Promise<{ data: unknown; error: unknown }>
}

export async function getOrdersByCustomer(customerId: string) {
  return db
    .from('orders')
    .select('*, order_items(*)')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false }) as Promise<{ data: unknown; error: unknown }>
}

/**
 * Update order status as a vendor.
 *
 * Routes through the `update_order_status_vendor` SECURITY DEFINER RPC
 * (migration 014). Validates vendor ownership and permits only two transitions:
 *   payment_confirmed → preparing
 *   preparing         → ready_for_pickup
 *
 * Financial fields (subtotal, total, delivery_fee) are never touched.
 * Direct UPDATE on the `orders` table by vendors is no longer allowed
 * (policy dropped in migration 014).
 */
export async function updateOrderStatusVendor(orderId: string, newStatus: string) {
  return db.rpc('update_order_status_vendor', {
    p_order_id: orderId,
    p_new_status: newStatus,
  }) as Promise<{ data: unknown; error: unknown }>
}

export async function vendorRejectOrder(orderId: string, reason: string) {
  return db.rpc('vendor_reject_order', {
    p_order_id: orderId,
    p_reason: reason,
  }) as Promise<{ data: unknown; error: unknown }>
}

export async function getOrdersByVendor(vendorId: string) {
  return db
    .from('orders')
    .select('*, order_items(*)')
    .eq('vendor_id', vendorId)
    .order('created_at', { ascending: false }) as Promise<{ data: unknown; error: unknown }>
}

/**
 * Cancel an order as a customer.
 * Invokes cancel_order_operational RPC with fallback direct updates.
 */
export async function cancelOrderCustomer(orderId: string, reason: string) {
  try {
    const res = await db.rpc('cancel_order_operational', {
      p_order_id: orderId,
      p_reason: reason,
    })
    if (!res?.error) return { data: true, error: null }
  } catch (err) {
    console.warn('cancel_order_operational RPC call fallback:', err)
  }

  // Fallback direct update
  const now = new Date().toISOString()
  const { data, error } = await db
    .from('orders')
    .update({
      status: 'cancelled',
      cancelled_at: now,
      cancellation_reason: reason,
      updated_at: now,
    })
    .eq('id', orderId)
    .select('id')
    .maybeSingle()

  if (!error) {
    await db.from('deliveries').update({ status: 'cancelled', updated_at: now }).eq('order_id', orderId)
  }

  return { data, error }
}

export interface SubmitPersonalShopperParams {
  customerName: string
  customerPhone: string
  deliveryAddress: string
  marketName: string
  budgetCap?: number
  estimatedTotal?: number
  items: unknown[]
  notes?: string
}

/**
 * Places a Personal Shopper market concierge request via `submit_personal_shopper_request` RPC.
 * Enforces 100% server-side financial authority and creates orders atomically.
 */
export async function submitPersonalShopperRequestSecure(params: SubmitPersonalShopperParams) {
  return db.rpc('submit_personal_shopper_request', {
    p_customer_name: params.customerName,
    p_customer_phone: params.customerPhone,
    p_delivery_address: params.deliveryAddress,
    p_market_name: params.marketName,
    p_budget_cap: params.budgetCap ?? null,
    p_estimated_total: params.estimatedTotal ?? null,
    p_items: params.items ?? [],
    p_notes: params.notes ?? null,
  }) as Promise<{ data: unknown; error: unknown }>
}



