import { supabase } from './client'
import type {
  AdminAnalyticsResponse,
  DeliveryPricingRuleRow,
  ServiceAreaRow,
  OrderDetailsData,
  AdminOrderRow,
  OrderItemLine,
} from '@/types/admin'

// Scaffold compatibility: cast to any until npm run db:types is executed with real DB.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

// =============================================================================
// §1  ANALYTICS & OPERATIONAL METRICS
// =============================================================================

export async function getAdminAnalytics(
  startDate?: string,
  endDate?: string
): Promise<{ data: AdminAnalyticsResponse | null; error: Error | null }> {
  try {
    const { data, error } = await db.rpc('get_admin_analytics', {
      p_start_date: startDate ?? null,
      p_end_date: endDate ?? null,
    })

    if (error) {
      return { data: null, error: new Error(error.message || 'Failed to load analytics') }
    }

    return { data: data as AdminAnalyticsResponse, error: null }
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Network error loading analytics'),
    }
  }
}

// =============================================================================
// §2  USER & PROFILE MANAGEMENT
// =============================================================================

export async function getUsers(params?: {
  search?: string
  role?: string
  page?: number
  limit?: number
}) {
  const page = params?.page ?? 1
  const limit = params?.limit ?? 20
  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = db
    .from('profiles')
    .select('id, email, full_name, phone, role, is_active, created_at', { count: 'exact' })

  if (params?.role && params.role !== 'all') {
    query = query.eq('role', params.role)
  }

  if (params?.search && params.search.trim()) {
    const term = `%${params.search.trim()}%`
    query = query.or(`full_name.ilike.${term},email.ilike.${term},phone.ilike.${term}`)
  }

  return query.order('created_at', { ascending: false }).range(from, to)
}

export async function toggleUserActive(userId: string, isActive: boolean) {
  return db.rpc('admin_toggle_user_active', {
    p_target_user_id: userId,
    p_is_active: isActive,
  })
}

export async function adminSetUserRole(userId: string, newRole: string) {
  return db.rpc('admin_set_user_role', {
    p_target_user_id: userId,
    p_new_role: newRole,
  })
}


// =============================================================================
// §3  RIDER FLEET & VEHICLE MANAGEMENT
// =============================================================================

export async function getAllRiders(params?: {
  search?: string
  isAvailable?: boolean
  isVerified?: boolean
}) {
  let query = db
    .from('riders')
    .select(`
      id,
      profile_id,
      is_available,
      is_verified,
      is_active,
      total_deliveries,
      rating,
      created_at,
      profiles:profile_id (
        full_name,
        email,
        phone,
        avatar_url
      ),
      vehicles (
        id,
        vehicle_type,
        make,
        model,
        year,
        license_plate,
        status
      )
    `)

  if (params?.isAvailable !== undefined) {
    query = query.eq('is_available', params.isAvailable)
  }

  if (params?.isVerified !== undefined) {
    query = query.eq('is_verified', params.isVerified)
  }

  const res = await query.order('created_at', { ascending: false })
  if (res.data) {
    res.data = res.data.map((r: any) => {
      const prof = r.profiles || {}
      const v = Array.isArray(r.vehicles) ? r.vehicles[0] : r.vehicles
      return {
        ...r,
        full_name: prof.full_name || r.full_name || 'Courier Rider',
        phone: prof.phone || r.phone || null,
        phone_number: prof.phone || r.phone_number || null,
        email: prof.email || r.email || null,
        avatar_url: prof.avatar_url || r.avatar_url || null,
        vehicle: v
          ? {
              ...v,
              plate_number: v.license_plate || v.plate_number || null,
            }
          : null,
      }
    })
  }

  return res
}

export async function toggleRiderVerified(riderId: string, isVerified: boolean) {
  return db
    .from('riders')
    .update({ is_verified: isVerified, updated_at: new Date().toISOString() })
    .eq('id', riderId)
    .select()
    .single()
}

export async function toggleRiderActive(riderId: string, isActive: boolean) {
  return db
    .from('riders')
    .update({
      is_active: isActive,
      is_available: isActive ? false : false, // Force offline if deactivated
      updated_at: new Date().toISOString(),
    })
    .eq('id', riderId)
    .select()
    .single()
}

// =============================================================================
// §4  RIDER & VENDOR ONBOARDING APPLICATIONS
// =============================================================================

export async function getPendingRiderApplications() {
  const res = await db
    .from('rider_applications')
    .select('*')
    .eq('status', 'pending')
    .order('submitted_at', { ascending: false })

  if (res.error || !res.data || res.data.length === 0) {
    return res
  }

  const profileIds = res.data
    .map((app: { profile_id?: string }) => app.profile_id)
    .filter(Boolean)

  if (profileIds.length > 0) {
    const { data: profiles } = await db
      .from('profiles')
      .select('id, full_name, phone, email')
      .in('id', profileIds)

    if (profiles && profiles.length > 0) {
      const profileMap = new Map(profiles.map((p: { id: string }) => [p.id, p]))
      const enriched = res.data.map((app: any) => ({
        ...app,
        profile: app.profile_id ? profileMap.get(app.profile_id) : undefined,
      }))
      return { data: enriched, error: null }
    }
  }

  return res
}

export async function approveRiderApplication(applicationId: string) {
  return db.rpc('approve_rider_application', {
    p_application_id: applicationId,
  })
}

export async function rejectRiderApplication(applicationId: string, reason: string) {
  return db.rpc('reject_rider_application', {
    p_application_id: applicationId,
    p_reason: reason.trim() || 'Did not meet requirements',
  })
}

export async function getPendingVendorApplications() {
  const res = await db
    .from('vendor_applications')
    .select('*')
    .eq('status', 'pending')
    .order('submitted_at', { ascending: false })

  if (res.error || !res.data || res.data.length === 0) {
    return res
  }

  const profileIds = res.data
    .map((app: { profile_id?: string }) => app.profile_id)
    .filter(Boolean)

  if (profileIds.length > 0) {
    const { data: profiles } = await db
      .from('profiles')
      .select('id, full_name, phone, email')
      .in('id', profileIds)

    if (profiles && profiles.length > 0) {
      const profileMap = new Map(profiles.map((p: { id: string }) => [p.id, p]))
      const enriched = res.data.map((app: any) => ({
        ...app,
        profile: app.profile_id ? profileMap.get(app.profile_id) : undefined,
      }))
      return { data: enriched, error: null }
    }
  }

  return res
}

export async function getPendingApplications() {
  const [vendorRes, riderRes] = await Promise.all([
    getPendingVendorApplications(),
    getPendingRiderApplications(),
  ])
  return {
    vendorApplications: vendorRes.data || [],
    riderApplications: riderRes.data || [],
  }
}

export async function approveVendorApplication(
  applicationId: string,
  serviceTypes?: ('food' | 'grocery')[]
) {
  const payload: { p_application_id: string; p_service_types?: ('food' | 'grocery')[] } = {
    p_application_id: applicationId,
  }
  if (serviceTypes && serviceTypes.length > 0) {
    payload.p_service_types = serviceTypes
  }
  return db.rpc('approve_vendor_application', payload)
}

export async function rejectVendorApplication(applicationId: string, reason: string) {
  return db.rpc('reject_vendor_application', {
    p_application_id: applicationId,
    p_reason: reason.trim() || 'Did not meet requirements',
  })
}

export interface AdminDirectOnboardVendorPayload {
  profileId?: string
  businessName: string
  businessAddress: string
  phone: string
  email: string
  serviceTypes: ('food' | 'grocery')[]
  ownerName?: string
  description?: string
  password?: string
}

export interface AdminDirectOnboardRiderPayload {
  profileId?: string
  fullName: string
  phone: string
  email: string
  vehicleType: 'bicycle' | 'motorcycle' | 'car' | 'van'
  address?: string
  vehicleMake?: string
  vehicleModel?: string
  vehicleYear?: number
  licensePlate?: string
  password?: string
}

export async function adminDirectOnboardVendor(payload: AdminDirectOnboardVendorPayload) {
  let targetProfileId = payload.profileId
  if (!targetProfileId && payload.email) {
    const { data: existingProfile } = await db
      .from('profiles')
      .select('id')
      .ilike('email', payload.email.trim())
      .maybeSingle()
    if (existingProfile?.id) {
      targetProfileId = existingProfile.id
    }
  }

  if (!targetProfileId) {
    const tempPassword = payload.password || `KDPartner!${Math.random().toString(36).slice(-8)}A1`
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: payload.email.trim(),
      password: tempPassword,
      options: {
        data: {
          full_name: payload.ownerName || payload.businessName,
          phone: payload.phone,
          account_type: 'vendor',
        },
      },
    })
    if (authErr) {
      throw new Error(`Failed to create partner account: ${authErr.message}`)
    }
    if (authData?.user?.id) {
      targetProfileId = authData.user.id
    }
  }

  if (!targetProfileId) {
    throw new Error('Unable to resolve user profile for vendor onboarding.')
  }

  try {
    const rpcRes = await db.rpc('admin_direct_onboard_vendor', {
      p_profile_id: targetProfileId,
      p_business_name: payload.businessName.trim(),
      p_business_address: payload.businessAddress.trim(),
      p_phone: payload.phone.trim(),
      p_email: payload.email.trim().toLowerCase(),
      p_service_types: payload.serviceTypes,
      p_business_description: payload.description?.trim() || null,
      p_business_type:
        payload.serviceTypes.includes('grocery') && !payload.serviceTypes.includes('food')
          ? 'grocery_store'
          : 'restaurant',
    })
    if (!rpcRes.error) {
      return rpcRes
    }
    console.warn('[adminDirectOnboardVendor] RPC error or uninstalled, executing fallback:', rpcRes.error)
  } catch (rpcErr) {
    console.warn('[adminDirectOnboardVendor] RPC exception, executing fallback:', rpcErr)
  }

  const bizType =
    payload.serviceTypes.includes('grocery') && !payload.serviceTypes.includes('food')
      ? 'grocery_store'
      : 'restaurant'

  const { data: app, error: appErr } = await db
    .from('vendor_applications')
    .upsert(
      {
        profile_id: targetProfileId,
        business_name: payload.businessName.trim(),
        business_type: bizType,
        service_types: payload.serviceTypes,
        business_address: payload.businessAddress.trim(),
        phone: payload.phone.trim(),
        email: payload.email.trim().toLowerCase(),
        business_description: payload.description?.trim() || null,
        status: 'pending',
        submitted_at: new Date().toISOString(),
      },
      { onConflict: 'profile_id' }
    )
    .select('id')
    .single()

  if (appErr || !app) {
    throw new Error(`Failed to initialize vendor application: ${appErr?.message || 'Unknown error'}`)
  }

  return approveVendorApplication(app.id, payload.serviceTypes)
}

export async function adminDirectOnboardRider(payload: AdminDirectOnboardRiderPayload) {
  let targetProfileId = payload.profileId
  if (!targetProfileId && payload.email) {
    const { data: existingProfile } = await db
      .from('profiles')
      .select('id')
      .ilike('email', payload.email.trim())
      .maybeSingle()
    if (existingProfile?.id) {
      targetProfileId = existingProfile.id
    }
  }

  if (!targetProfileId) {
    const tempPassword = payload.password || `KDCourier!${Math.random().toString(36).slice(-8)}A1`
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: payload.email.trim(),
      password: tempPassword,
      options: {
        data: {
          full_name: payload.fullName,
          phone: payload.phone,
          account_type: 'rider',
        },
      },
    })
    if (authErr) {
      throw new Error(`Failed to create courier account: ${authErr.message}`)
    }
    if (authData?.user?.id) {
      targetProfileId = authData.user.id
    }
  }

  if (!targetProfileId) {
    throw new Error('Unable to resolve user profile for rider onboarding.')
  }

  try {
    const rpcRes = await db.rpc('admin_direct_onboard_rider', {
      p_profile_id: targetProfileId,
      p_full_name: payload.fullName.trim(),
      p_phone: payload.phone.trim(),
      p_email: payload.email.trim().toLowerCase(),
      p_vehicle_type: payload.vehicleType,
      p_address: payload.address?.trim() || null,
      p_vehicle_make: payload.vehicleMake?.trim() || null,
      p_vehicle_model: payload.vehicleModel?.trim() || null,
      p_vehicle_year: payload.vehicleYear || null,
      p_license_plate: payload.licensePlate?.trim() || null,
    })
    if (!rpcRes.error) {
      return rpcRes
    }
    console.warn('[adminDirectOnboardRider] RPC error or uninstalled, executing fallback:', rpcRes.error)
  } catch (rpcErr) {
    console.warn('[adminDirectOnboardRider] RPC exception, executing fallback:', rpcErr)
  }

  const { data: app, error: appErr } = await db
    .from('rider_applications')
    .upsert(
      {
        profile_id: targetProfileId,
        full_name: payload.fullName.trim(),
        phone: payload.phone.trim(),
        email: payload.email.trim().toLowerCase(),
        address: payload.address?.trim() || null,
        vehicle_type: payload.vehicleType,
        vehicle_make: payload.vehicleMake?.trim() || null,
        vehicle_model: payload.vehicleModel?.trim() || null,
        vehicle_year: payload.vehicleYear || null,
        status: 'pending',
        submitted_at: new Date().toISOString(),
      },
      { onConflict: 'profile_id' }
    )
    .select('id')
    .single()

  if (appErr || !app) {
    throw new Error(`Failed to initialize rider application: ${appErr?.message || 'Unknown error'}`)
  }

  const approveRes = await approveRiderApplication(app.id)

  if (payload.licensePlate?.trim()) {
    try {
      const { data: riderRow } = await db
        .from('riders')
        .select('id')
        .eq('profile_id', targetProfileId)
        .maybeSingle()

      if (riderRow?.id) {
        await db.from('vehicles').upsert(
          {
            assigned_rider_id: riderRow.id,
            vehicle_type: payload.vehicleType,
            make: payload.vehicleMake?.trim() || 'Standard',
            model: payload.vehicleModel?.trim() || 'Fleet',
            year: payload.vehicleYear || new Date().getFullYear(),
            license_plate: payload.licensePlate.trim().toUpperCase(),
            status: 'active',
          },
          { onConflict: 'license_plate' }
        )
      }
    } catch (vehErr) {
      console.warn('[adminDirectOnboardRider] Vehicle record save warning:', vehErr)
    }
  }

  return approveRes
}

export async function getEligibleUserProfiles(search?: string) {
  let query = db
    .from('profiles')
    .select('id, full_name, email, phone, role')
    .neq('role', 'super_admin')
    .eq('is_active', true)
    .order('full_name', { ascending: true })
    .limit(30)

  if (search && search.trim()) {
    query = query.or(`full_name.ilike.%${search.trim()}%,email.ilike.%${search.trim()}%`)
  }

  return query
}


// =============================================================================
// §5  VENDOR MANAGEMENT
// =============================================================================

export async function getAllVendors(params?: { search?: string; businessType?: string }) {
  let query = db
    .from('vendors')
    .select(`
      id,
      profile_id,
      business_name,
      business_type,
      business_address,
      phone,
      email,
      is_active,
      latitude,
      longitude,
      created_at,
      profiles:profile_id (
        full_name,
        email,
        phone
      ),
      vendor_services (
        service_type,
        is_active
      )
    `)

  if (params?.businessType && params.businessType !== 'all') {
    query = query.eq('business_type', params.businessType)
  }

  if (params?.search && params.search.trim()) {
    query = query.ilike('business_name', `%${params.search.trim()}%`)
  }

  const res = await query.order('created_at', { ascending: false })
  if (res.data) {
    res.data = res.data.map((v: any) => {
      const prof = v.profiles || {}
      const activeServices = (v.vendor_services || [])
        .filter((s: any) => s.is_active)
        .map((s: any) => s.service_type)
      const fallbackServices = v.business_type === 'restaurant' ? ['food'] : ['grocery']
      return {
        ...v,
        address: v.business_address || v.address || null,
        business_address: v.business_address || v.address || null,
        phone: v.phone || prof.phone || v.phone_number || null,
        phone_number: v.phone || prof.phone || v.phone_number || null,
        email: v.email || prof.email || null,
        owner_email: v.email || prof.email || null,
        services: activeServices.length > 0 ? activeServices : fallbackServices,
      }
    })
  }

  return res
}

export async function toggleVendorActive(vendorId: string, isActive: boolean) {
  return db
    .from('vendors')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', vendorId)
    .select()
    .single()
}

// =============================================================================
// §6  ORDER OPERATIONS
// =============================================================================

export async function getOrders(params?: {
  status?: string
  serviceType?: string
  search?: string
  page?: number
  limit?: number
}) {
  const page = params?.page ?? 1
  const limit = params?.limit ?? 20
  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = db.from('orders').select(
    `
      id,
      customer_id,
      vendor_id,
      service_type,
      status,
      subtotal,
      delivery_fee,
      total,
      pickup_address,
      delivery_address,
      refund_required,
      refund_status,
      cancellation_reason,
      created_at,
      vendors:vendor_id ( business_name ),
      profiles:customer_id ( full_name, phone, email )
    `,
    { count: 'exact' }
  )

  if (params?.status && params.status !== 'all') {
    query = query.eq('status', params.status)
  }

  if (params?.serviceType && params.serviceType !== 'all') {
    query = query.eq('service_type', params.serviceType)
  }

  if (params?.search && params.search.trim()) {
    query = query.or(`pickup_address.ilike.%${params.search.trim()}%,delivery_address.ilike.%${params.search.trim()}%`)
  }

  const res = await query.order('created_at', { ascending: false }).range(from, to)
  if (res.data) {
    res.data = res.data.map((row: any) => {
      const prof = row.profiles || row.customers || {}
      const totalAmount = Number(row.total ?? row.total_amount ?? 0)
      return {
        ...row,
        total: totalAmount,
        total_amount: totalAmount,
        customer_name: prof.full_name || 'Customer',
        customer_phone: prof.phone || null,
        customer_email: prof.email || null,
        vendor_name: row.vendors?.business_name || null,
      }
    })
  }

  return res
}

export async function getOrderDetails(orderId: string): Promise<OrderDetailsData> {
  const { data, error } = await db
    .from('orders')
    .select(`
      *,
      order_items (
        id,
        product_id,
        quantity,
        unit_price,
        line_total,
        product_name
      ),
      vendors ( business_name, phone, business_address ),
      profiles:customer_id ( full_name, phone, email ),
      deliveries (
        id,
        status,
        pickup_address,
        delivery_address,
        picked_up_at,
        delivered_at,
        cancelled_at,
        delivery_assignments (
          id,
          status,
          assigned_at,
          responded_at,
          rider_id,
          riders (
            id,
            profiles ( full_name, phone )
          )
        )
      ),
      payments (
        id,
        paystack_reference,
        amount,
        status,
        verified_at
      )
    `)
    .eq('id', orderId)
    .single()

  if (error) throw error
  if (!data) throw new Error('Order not found')

  const deliveryRecord = Array.isArray(data.deliveries) ? data.deliveries[0] : data.deliveries
  const assignments = deliveryRecord?.delivery_assignments
  const assignment = Array.isArray(assignments) ? assignments[0] : assignments

  const items: OrderItemLine[] = (data.order_items || []).map((item: any) => ({
    id: item.id,
    product_name: item.product_name || 'Product',
    quantity: item.quantity,
    unit_price: Number(item.unit_price) || 0,
    total_price: Number(item.line_total) || 0,
  }))

  const prof = data.profiles || {}
  const order: AdminOrderRow = {
    id: data.id,
    customer_id: data.customer_id,
    customer_name: prof.full_name || data.customer_name || 'Customer',
    customer_phone: prof.phone || data.customer_phone || null,
    vendor_id: data.vendor_id,
    vendor_name: data.vendors?.business_name,
    service_type: data.service_type,
    status: data.status,
    subtotal: Number(data.subtotal) || 0,
    delivery_fee: Number(data.delivery_fee) || 0,
    tax_amount: Number(data.tax_amount || 0),
    total_amount: Number(data.total ?? data.total_amount ?? 0),
    total: Number(data.total ?? data.total_amount ?? 0),
    pickup_address: data.pickup_address,
    delivery_address: data.delivery_address,
    created_at: data.created_at,
  }

  return {
    order,
    items,
    delivery: deliveryRecord
      ? {
          id: deliveryRecord.id,
          status: deliveryRecord.status,
          rider_id: assignment?.rider_id || null,
        }
      : null,
  }
}

// =============================================================================
// §7  DELIVERY OPERATIONS & DISPATCH CONSOLE
// =============================================================================

export async function getDeliveries(params?: {
  status?: string
  page?: number
  limit?: number
}) {
  const page = params?.page ?? 1
  const limit = params?.limit ?? 20
  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = db.from('deliveries').select(
    `
      id,
      order_id,
      service_type,
      status,
      customer_name,
      customer_phone,
      pickup_address,
      delivery_address,
      picked_up_at,
      delivered_at,
      cancelled_at,
      created_at,
      delivery_assignments (
        id,
        status,
        assigned_at,
        riders (
          id,
          profiles ( full_name, phone )
        )
      )
    `,
    { count: 'exact' }
  )

  if (params?.status && params.status !== 'all') {
    query = query.eq('status', params.status)
  }

  return query.order('created_at', { ascending: false }).range(from, to)
}

export async function getUnassignedDeliveries() {
  return db
    .from('deliveries')
    .select(`
      id,
      order_id,
      service_type,
      status,
      customer_name,
      customer_phone,
      pickup_address,
      delivery_address,
      created_at,
      orders!inner (
        status,
        total,
        service_type
      )
    `)
    .eq('status', 'pending')
    .in('orders.status', ['payment_confirmed', 'preparing', 'ready_for_pickup'])
    .order('created_at', { ascending: true })
}

export async function assignDelivery(deliveryId: string, riderId: string) {
  return db.rpc('assign_delivery_to_rider', {
    p_delivery_id: deliveryId,
    p_rider_id: riderId,
  })
}

export async function cancelOrderOperational(orderId: string, reason: string) {
  return db.rpc('cancel_order_operational', {
    p_order_id: orderId,
    p_reason: reason.trim(),
  })
}

// =============================================================================
// §8  PAYMENTS & REFUND REVIEW QUEUE
// =============================================================================

export async function getPaymentTransactions(params?: {
  status?: string
  page?: number
  limit?: number
}) {
  const page = params?.page ?? 1
  const limit = params?.limit ?? 20
  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = db.from('payments').select(
    `
      id,
      order_id,
      reference,
      amount,
      currency,
      status,
      channel,
      paid_at,
      created_at,
      orders (
        service_type,
        customer_id,
        profiles:customer_id ( full_name, email )
      )
    `,
    { count: 'exact' }
  )

  if (params?.status && params.status !== 'all') {
    query = query.eq('status', params.status)
  }

  return query.order('created_at', { ascending: false }).range(from, to)
}

export async function getRefundReviewQueue() {
  return db
    .from('orders')
    .select(`
      id,
      customer_id,
      service_type,
      total,
      delivery_fee,
      status,
      refund_required,
      refund_status,
      cancellation_reason,
      cancelled_at,
      profiles:customer_id ( full_name, phone, email ),
      payments ( reference, amount, status )
    `)
    .eq('refund_required', true)
    .order('cancelled_at', { ascending: false })
}

// =============================================================================
// §9  PRICING & SERVICE AREA ADMINISTRATION
// =============================================================================

export async function getPricingRules() {
  return db
    .from('delivery_pricing_rules')
    .select('*')
    .order('created_at', { ascending: false })
}

export async function savePricingRule(rule: Partial<DeliveryPricingRuleRow>) {
  if (rule.id) {
    return db
      .from('delivery_pricing_rules')
      .update({
        service_type: rule.service_type || null,
        base_fee: rule.base_fee,
        distance_rate: rule.distance_rate ?? rule.per_km_fee,
        min_fee: rule.min_fee || null,
        is_active: rule.is_active ?? true,
        effective_date: rule.effective_date,
        updated_at: new Date().toISOString(),
      })
      .eq('id', rule.id)
      .select()
      .single()
  }

  return db
    .from('delivery_pricing_rules')
    .insert([
      {
        service_type: rule.service_type || null,
        base_fee: rule.base_fee,
        distance_rate: rule.distance_rate ?? rule.per_km_fee,
        min_fee: rule.min_fee || null,
        is_active: rule.is_active ?? true,
        effective_date: rule.effective_date || new Date().toISOString().split('T')[0],
      },
    ])
    .select()
    .single()
}

export async function togglePricingRuleActive(ruleId: string, isActive: boolean) {
  return db
    .from('delivery_pricing_rules')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', ruleId)
    .select()
    .single()
}

export async function getServiceAreas() {
  return db
    .from('service_areas')
    .select('*')
    .order('created_at', { ascending: false })
}

export async function saveServiceArea(area: Partial<ServiceAreaRow>) {
  if (area.id) {
    return db
      .from('service_areas')
      .update({
        name: area.name,
        description: area.description || null,
        center_lat: area.center_lat,
        center_lon: area.center_lng,
        radius_km: area.radius_km,
        is_active: area.is_active ?? true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', area.id)
      .select()
      .single()
  }

  return db
    .from('service_areas')
    .insert([
      {
        name: area.name,
        description: area.description || null,
        center_lat: area.center_lat,
        center_lon: area.center_lng,
        radius_km: area.radius_km,
        is_active: area.is_active ?? true,
      },
    ])
    .select()
    .single()
}

export async function toggleServiceAreaActive(areaId: string, isActive: boolean) {
  return db
    .from('service_areas')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', areaId)
    .select()
    .single()
}

// =============================================================================
// §10  CATALOG & PRODUCT OVERSIGHT
// =============================================================================

export async function getCategories() {
  return db.from('categories').select('*').order('name', { ascending: true })
}

export async function saveCategory(category: {
  id?: string
  name: string
  description?: string
  is_active?: boolean
}) {
  if (category.id) {
    return db
      .from('categories')
      .update({
        name: category.name,
        description: category.description || null,
        is_active: category.is_active ?? true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', category.id)
      .select()
      .single()
  }

  return db
    .from('categories')
    .insert([
      {
        name: category.name,
        description: category.description || null,
        is_active: category.is_active ?? true,
      },
    ])
    .select()
    .single()
}

export async function getProducts(params?: {
  vendorId?: string
  search?: string
  page?: number
  limit?: number
}) {
  const page = params?.page ?? 1
  const limit = params?.limit ?? 20
  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = db.from('products').select(
    `
      id,
      vendor_id,
      category_id,
      name,
      description,
      price,
      is_available,
      image_url,
      created_at,
      vendors:vendor_id ( business_name ),
      categories:category_id ( name )
    `,
    { count: 'exact' }
  )

  if (params?.vendorId && params.vendorId !== 'all') {
    query = query.eq('vendor_id', params.vendorId)
  }

  if (params?.search && params.search.trim()) {
    query = query.ilike('name', `%${params.search.trim()}%`)
  }

  return query.order('created_at', { ascending: false }).range(from, to)
}

export async function toggleProductAvailable(productId: string, isAvailable: boolean) {
  return db
    .from('products')
    .update({ is_available: isAvailable, updated_at: new Date().toISOString() })
    .eq('id', productId)
    .select()
    .single()
}

// =============================================================================
// §11  AUDIT LOGS (SUPER ADMIN ONLY)
// =============================================================================

export async function getAuditLogs(params?: {
  entityType?: string
  page?: number
  limit?: number
}) {
  const page = params?.page ?? 1
  const limit = params?.limit ?? 30
  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = db.from('audit_logs').select(
    `
      id,
      profile_id,
      action,
      entity_type,
      entity_id,
      old_values,
      new_values,
      ip_address,
      user_agent,
      created_at,
      profiles:profile_id ( full_name, email )
    `,
    { count: 'exact' }
  )

  if (params?.entityType && params.entityType !== 'all') {
    query = query.eq('entity_type', params.entityType)
  }

  return query.order('created_at', { ascending: false }).range(from, to)
}

// =============================================================================
// §12  DIAGNOSTICS & RECONCILIATION
// =============================================================================

export async function auditRiderVendorConsistency() {
  return db.rpc('audit_rider_vendor_consistency')
}

export async function reconcileRiderVendorRecords() {
  return db.rpc('reconcile_rider_vendor_records')
}

// =============================================================================
// §13  CORPORATE LEADS & PERSONAL SHOPPER REQUESTS
// =============================================================================

export interface CorporateLeadRow {
  id: string
  company_name: string
  contact_name: string
  email: string
  phone: string
  address?: string | null
  business_type: string
  estimated_volume?: string | null
  notes?: string | null
  status: 'pending' | 'contacted' | 'onboarded' | 'rejected'
  created_at: string
  updated_at: string
  total_count?: number
}

export interface PersonalShopperRequestRow {
  id: string
  customer_name: string
  customer_phone: string
  delivery_address: string
  market_name: string
  budget_cap?: number | null
  estimated_total?: number | null
  items: Array<{
    id: string
    name: string
    quantity: string
    estimatedCost: number
    notes?: string
  }>
  notes?: string | null
  status: 'pending' | 'assigned' | 'shopping' | 'completed' | 'cancelled'
  assigned_shopper_id?: string | null
  created_at: string
  updated_at: string
  total_count?: number
}

export async function getCorporateLeads(params?: {
  status?: string
  page?: number
  limit?: number
}) {
  const page = params?.page || 1
  const limit = params?.limit || 20
  const statusFilter = params?.status && params.status !== 'all' ? params.status : null

  let dbLeads: CorporateLeadRow[] = []

  // 1. Attempt RPC
  try {
    const res = await db.rpc('get_corporate_leads', {
      p_status: statusFilter,
      p_page: page,
      p_limit: limit,
    })
    if (res.data && !res.error && Array.isArray(res.data) && res.data.length > 0) {
      const count = Number(res.data[0].total_count || res.data.length)
      return { data: res.data as CorporateLeadRow[], count, error: null }
    }
  } catch (rpcErr) {
    console.warn('[getCorporateLeads] RPC error, falling back to table query:', rpcErr)
  }

  // 2. Direct table query fallback
  try {
    let query = db.from('corporate_leads').select('*', { count: 'exact' })
    if (statusFilter) {
      query = query.eq('status', statusFilter)
    }
    const from = (page - 1) * limit
    const to = from + limit - 1
    const { data, error } = await query.order('created_at', { ascending: false }).range(from, to)
    if (!error && data) {
      dbLeads = data as CorporateLeadRow[]
    }
  } catch (tableErr) {
    console.warn('[getCorporateLeads] Direct table query error:', tableErr)
  }

  // 3. Client local cache fallback & merge (ensures leads created locally or via offline submission appear immediately)
  const localLeads: CorporateLeadRow[] = []
  try {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('kingdomdash_corporate_leads')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          parsed.forEach((item: any) => {
            localLeads.push({
              id: item.id || `corp_${Math.random().toString(36).slice(2, 9)}`,
              company_name: item.company_name || item.companyName || 'Corporate Lead',
              contact_name: item.contact_name || item.contactName || 'Lead Contact',
              email: item.email || '',
              phone: item.phone || '',
              address: item.address || null,
              business_type: item.business_type || item.businessType || 'General Business',
              estimated_volume: item.estimated_volume || (item.estimatedVolume ? `${item.estimatedVolume} parcels/mo` : 'Volume Dispatch'),
              notes: item.notes || null,
              status: (item.status as any) || 'pending',
              created_at: item.created_at || item.createdAt || new Date().toISOString(),
              updated_at: item.updated_at || item.updatedAt || new Date().toISOString(),
            })
          })
        }
      }

      // If no local leads exist, extract from notification cache if present (e.g. Florson Pharmacy)
      if (localLeads.length === 0 && dbLeads.length === 0) {
        const notifsRaw = localStorage.getItem('kd_admin_notifications_cache')
        if (notifsRaw) {
          const notifs = JSON.parse(notifsRaw)
          if (Array.isArray(notifs)) {
            notifs.forEach((n: any) => {
              if (typeof n?.title === 'string' && n.title.includes('Corporate Account Lead')) {
                const company = n.title.replace('🏢 Corporate Account Lead:', '').trim()
                const msg = String(n.message || '')
                // Extract contact name and phone from msg e.g. "Akanbi Ibrahim (08123424005 • contact@florson.com)..."
                const contactMatch = msg.match(/^([^(]+)\(([^•)]+)(?:•\s*([^)]+))?\)/)
                const contact = contactMatch ? contactMatch[1].trim() : 'Company Contact'
                const phone = contactMatch ? contactMatch[2].trim() : ''
                const email = contactMatch && contactMatch[3] ? contactMatch[3].trim() : ''
                localLeads.push({
                  id: n.id ? String(n.id).replace('notif_', '') : `corp_${Date.now()}`,
                  company_name: company || 'Corporate Lead',
                  contact_name: contact,
                  email: email === 'No email' ? '' : email,
                  phone,
                  address: null,
                  business_type: 'E-commerce & Retail',
                  estimated_volume: '100 deliveries/mo',
                  notes: msg,
                  status: 'pending',
                  created_at: n.created_at || new Date().toISOString(),
                  updated_at: n.created_at || new Date().toISOString(),
                })
              }
            })
          }
        }
      }
    }
  } catch (parseErr) {
    console.warn('[getCorporateLeads] Local cache parsing warning:', parseErr)
  }

  // Merge DB leads and local leads without duplicates
  const leadMap = new Map<string, CorporateLeadRow>()
  dbLeads.forEach((l) => leadMap.set(l.id, l))
  localLeads.forEach((l) => {
    // Check if duplicate by ID or company name + phone
    const exists = Array.from(leadMap.values()).some(
      (existing) => existing.id === l.id || (existing.company_name.toLowerCase() === l.company_name.toLowerCase() && existing.phone === l.phone)
    )
    if (!exists) {
      if (!statusFilter || l.status === statusFilter) {
        leadMap.set(l.id, l)
      }
    }
  })

  const merged = Array.from(leadMap.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  const paged = merged.slice((page - 1) * limit, page * limit)
  return { data: paged, count: merged.length, error: null }
}

export async function updateCorporateLeadStatus(
  id: string,
  status: 'pending' | 'contacted' | 'onboarded' | 'rejected'
) {
  // 1. Update local cache
  try {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('kingdomdash_corporate_leads')
      if (raw) {
        const list = JSON.parse(raw)
        if (Array.isArray(list)) {
          const updated = list.map((item: any) =>
            item.id === id ? { ...item, status, updated_at: new Date().toISOString() } : item
          )
          localStorage.setItem('kingdomdash_corporate_leads', JSON.stringify(updated))
        }
      }
    }
  } catch {}

  // 2. Update Supabase
  try {
    return await db
      .from('corporate_leads')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
  } catch (err) {
    return { data: null, error: err }
  }
}

export async function getPersonalShopperRequests(params?: {
  status?: string
  page?: number
  limit?: number
}) {
  const page = params?.page || 1
  const limit = params?.limit || 20
  const statusFilter = params?.status && params.status !== 'all' ? params.status : null

  let dbRequests: PersonalShopperRequestRow[] = []

  try {
    const res = await db.rpc('get_personal_shopper_requests', {
      p_status: statusFilter,
      p_page: page,
      p_limit: limit,
    })
    if (res.data && !res.error && Array.isArray(res.data) && res.data.length > 0) {
      const count = Number(res.data[0].total_count || res.data.length)
      return { data: res.data as PersonalShopperRequestRow[], count, error: null }
    }
  } catch (rpcErr) {
    console.warn('[getPersonalShopperRequests] RPC error, falling back to table query:', rpcErr)
  }

  // Fallback: direct table query
  try {
    let query = db.from('personal_shopper_requests').select('*', { count: 'exact' })
    if (statusFilter) {
      query = query.eq('status', statusFilter)
    }
    const from = (page - 1) * limit
    const to = from + limit - 1
    const { data, error } = await query.order('created_at', { ascending: false }).range(from, to)
    if (!error && data) {
      dbRequests = data as PersonalShopperRequestRow[]
    }
  } catch (tableErr) {
    console.warn('[getPersonalShopperRequests] Table query error:', tableErr)
  }

  // Local storage fallback
  const localRequests: PersonalShopperRequestRow[] = []
  try {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('kingdomdash_shopper_requests')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          parsed.forEach((item: any) => {
            localRequests.push({
              id: item.id || `shopper_${Math.random().toString(36).slice(2, 9)}`,
              customer_name: item.customer_name || item.customerName || 'Customer',
              customer_phone: item.customer_phone || item.customerPhone || '',
              delivery_address: item.delivery_address || item.deliveryAddress || 'Ijebu-Ode',
              market_name: item.market_name || item.marketName || 'Oke-Aje Market',
              budget_cap: item.budget_cap || item.budgetCap || null,
              estimated_total: item.estimated_total || item.estimatedTotal || null,
              items: item.items || [],
              notes: item.notes || null,
              status: item.status || 'pending',
              assigned_shopper_id: item.assigned_shopper_id || null,
              created_at: item.created_at || item.createdAt || new Date().toISOString(),
              updated_at: item.updated_at || item.updatedAt || new Date().toISOString(),
            })
          })
        }
      }
    }
  } catch {}

  const reqMap = new Map<string, PersonalShopperRequestRow>()
  dbRequests.forEach((r) => reqMap.set(r.id, r))
  localRequests.forEach((r) => {
    if (!reqMap.has(r.id)) {
      if (!statusFilter || r.status === statusFilter) {
        reqMap.set(r.id, r)
      }
    }
  })

  const merged = Array.from(reqMap.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  const paged = merged.slice((page - 1) * limit, page * limit)
  return { data: paged, count: merged.length, error: null }
}

export async function updatePersonalShopperStatus(
  id: string,
  status: 'pending' | 'assigned' | 'shopping' | 'completed' | 'cancelled'
) {
  // Update local cache
  try {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('kingdomdash_shopper_requests')
      if (raw) {
        const list = JSON.parse(raw)
        if (Array.isArray(list)) {
          const updated = list.map((item: any) =>
            item.id === id ? { ...item, status, updated_at: new Date().toISOString() } : item
          )
          localStorage.setItem('kingdomdash_shopper_requests', JSON.stringify(updated))
        }
      }
    }
  } catch {}

  return db
    .from('personal_shopper_requests')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
}
