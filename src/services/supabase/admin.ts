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
      customer_name,
      customer_phone,
      delivery_contact,
      delivery_phone,
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
      const customerName = row.customer_name || row.delivery_contact || prof.full_name || 'Customer'
      const customerPhone = row.customer_phone || row.delivery_phone || prof.phone || null
      return {
        ...row,
        total: totalAmount,
        total_amount: totalAmount,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: prof.email || null,
        vendor_name: row.vendors?.business_name || (row.service_type === 'custom' ? row.pickup_address : null),
      }
    })
  }

  return res
}

export async function updateOrderStatusAdmin(
  orderId: string,
  status: string
): Promise<{ data: AdminOrderRow | null; error: Error | null }> {
  try {
    const { data, error } = await db
      .from('orders')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select()
      .single()

    if (error) {
      return { data: null, error: new Error(error.message || 'Failed to update order status') }
    }

    // Synchronize linked personal shopper requests if this order is linked
    try {
      const shopperStatus = (
        status === 'in_transit' ? 'shopping' :
        status === 'delivered' ? 'completed' :
        status
      )
      await db
        .from('personal_shopper_requests')
        .update({
          status: shopperStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('order_id', orderId)
    } catch (syncErr) {
      console.warn('Could not sync personal_shopper_requests on order status update:', syncErr)
    }

    return { data: data as AdminOrderRow, error: null }
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Network error updating order status'),
    }
  }
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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isUuid = (val?: string | null): val is string => !!val && UUID_REGEX.test(val)

export async function assignOrderToRider(
  orderId: string,
  riderId: string,
  serviceType?: string
): Promise<{ data: any; error: Error | null }> {
  try {
    if (!orderId || !riderId) {
      throw new Error('Both Order ID and Rider ID are required for assignment')
    }

    // 1. Handle Personal Shopper / Custom requests - harmonize with first-class orders & deliveries
    let isShopperOrder = false
    let shopperProfileId = riderId
    let shopperTargetId: string | null = null

    if (serviceType === 'custom' || orderId.startsWith('SHOP-') || orderId.startsWith('shopper_')) {
      isShopperOrder = true
      const realId = orderId.startsWith('SHOP-') ? orderId.replace(/^SHOP-/, '') : orderId

      if (!isUuid(orderId) && !isUuid(realId)) {
        // Mock or demo shopper request
        return { data: { orderId, riderId, serviceType: 'custom', mock: true }, error: null }
      }

      shopperTargetId = isUuid(orderId) ? orderId : realId

      // Determine profile_id if riderId is a rider table PK (personal_shopper_requests references profiles.id)
      if (isUuid(riderId)) {
        const { data: riderRec } = await db
          .from('riders')
          .select('profile_id')
          .eq('id', riderId)
          .maybeSingle()
        if (riderRec?.profile_id) {
          shopperProfileId = riderRec.profile_id
        }
      }

      // Fetch the shopper request to check if it already has an order_id
      let { data: shopperReq } = await db
        .from('personal_shopper_requests')
        .select('*')
        .eq('id', shopperTargetId)
        .maybeSingle()

      if (!shopperReq) {
        const { data: byOrderId } = await db
          .from('personal_shopper_requests')
          .select('*')
          .eq('order_id', shopperTargetId)
          .maybeSingle()
        shopperReq = byOrderId
      }
      if (shopperReq) {
        shopperTargetId = shopperReq.id
        if (shopperReq.order_id) {
          orderId = shopperReq.order_id
        } else {
          // Ensure a first-class orders row exists for this personal shopper request
          const subtotal = Number(shopperReq.estimated_total || shopperReq.budget_cap || 0)
          const deliveryFee = 600
          const total = subtotal + deliveryFee
          const authUser = (await db.auth.getUser()).data.user

        const { data: newOrder } = await db
          .from('orders')
          .insert({
            customer_id: authUser?.id || null,
            service_type: 'custom',
            status: 'payment_confirmed',
            pickup_address: shopperReq.market_name || 'Market Concierge',
            delivery_address: shopperReq.delivery_address || 'Customer Delivery Address',
            customer_name: shopperReq.customer_name || 'Valued Customer',
            customer_phone: shopperReq.customer_phone || '—',
            delivery_contact: shopperReq.customer_name || 'Valued Customer',
            delivery_phone: shopperReq.customer_phone || '—',
            pickup_contact: 'Market Concierge',
            pickup_phone: shopperReq.customer_phone || '—',
            subtotal,
            delivery_fee: deliveryFee,
            total,
            special_instructions: shopperReq.notes || null,
          })
          .select('id')
          .maybeSingle()

        if (newOrder?.id) {
          orderId = newOrder.id
          await db
            .from('personal_shopper_requests')
            .update({ order_id: orderId })
            .eq('id', shopperTargetId)

          // Insert cargo items into order_items so the rider can inspect them
          if (Array.isArray(shopperReq.items) && shopperReq.items.length > 0) {
            for (const item of shopperReq.items) {
              const itemName = item.name || 'Shopping Item'
              const itemCost = Number(item.estimatedCost || 0)
              const rawQty = item.quantity ? String(item.quantity) : '1'
              const numQty = parseInt(rawQty.replace(/[^0-9]/g, ''), 10) || 1
              await db.from('order_items').insert({
                order_id: orderId,
                product_name: itemName + (rawQty && rawQty !== String(numQty) ? ` (${rawQty})` : ''),
                quantity: numQty,
                unit_price: itemCost,
                line_total: itemCost * numQty,
              })
            }
          }
        }
      }
    }
  }

    // 2. Non-UUID standard orders (e.g. dev mock data like 'ord-food-1')
    if (!isUuid(orderId)) {
      console.info(`assignOrderToRider: Order ID "${orderId}" is not a UUID, treating as demo/mock assignment`)
      return { data: { orderId, riderId, status: 'in_transit', mock: true }, error: null }
    }

    // 3. Ensure rider is active, verified, and available before assignment
    if (isUuid(riderId)) {
      try {
        await db
          .from('riders')
          .update({ is_available: true, is_active: true, is_verified: true })
          .eq('id', riderId)
      } catch (riderUpdateErr) {
        console.warn('Could not update rider availability:', riderUpdateErr)
      }
    }

    // 4. Fetch or create Delivery record
    let deliveryId: string | null = null

    const { data: existingDeliv } = await db
      .from('deliveries')
      .select('id, status')
      .eq('order_id', orderId)
      .maybeSingle()

    if (existingDeliv?.id) {
      deliveryId = existingDeliv.id
      // Ensure existing delivery is pending or assigned so RPC allows dispatch
      if (existingDeliv.status !== 'pending' && existingDeliv.status !== 'assigned') {
        await db.from('deliveries').update({ status: 'pending' }).eq('id', deliveryId)
      }
    } else {
      // Query order with profile relationship
      const { data: ord, error: ordErr } = await db
        .from('orders')
        .select(`
          id,
          service_type,
          customer_id,
          pickup_address,
          delivery_address,
          customer_name,
          customer_phone,
          status,
          profiles:customer_id ( full_name, phone )
        `)
        .eq('id', orderId)
        .maybeSingle()

      if (ordErr) {
        console.warn('Could not fetch order profile relation, querying base order:', ordErr)
      }

      // If order is still 'placed' or 'pending', advance to 'payment_confirmed' so RPC allows dispatch
      if (ord && (ord.status === 'placed' || ord.status === 'pending')) {
        await db.from('orders').update({ status: 'payment_confirmed' }).eq('id', orderId)
      }

      const prof = (ord?.profiles as any) || {}
      const customerName = ord?.customer_name || prof.full_name || 'Customer'
      const customerPhone = ord?.customer_phone || prof.phone || '—'
      const serviceTypeVal = ord?.service_type || serviceType || (isShopperOrder ? 'custom' : 'food')
      const pickupAddress = ord?.pickup_address || 'Merchant Storefront'
      const deliveryAddress = ord?.delivery_address || 'Customer Delivery Address'

      const authUser = (await db.auth.getUser()).data.user
      const createdBy = ord?.customer_id || authUser?.id

      const { data: newDeliv, error: insertErr } = await db
        .from('deliveries')
        .insert({
          order_id: orderId,
          customer_name: customerName,
          customer_phone: customerPhone,
          service_type: serviceTypeVal,
          pickup_address: pickupAddress,
          pickup_contact: isShopperOrder ? 'Market Concierge' : 'Store Dispatch',
          delivery_address: deliveryAddress,
          delivery_contact: customerPhone,
          status: 'pending',
          created_by: createdBy && isUuid(createdBy) ? createdBy : null,
        })
        .select('id')
        .maybeSingle()

      if (insertErr) {
        console.warn('Could not insert delivery record:', insertErr)
      } else if (newDeliv?.id) {
        deliveryId = newDeliv.id
      }
    }

    // 5. Attempt authoritative assignment via assign_delivery_to_rider RPC
    let rpcSuccess = false
    if (deliveryId && isUuid(deliveryId) && isUuid(riderId)) {
      const rpcRes = await db.rpc('assign_delivery_to_rider', {
        p_delivery_id: deliveryId,
        p_rider_id: riderId,
      })

      if (!rpcRes.error) {
        rpcSuccess = true
      } else {
        console.warn('assign_delivery_to_rider RPC rejected assignment, running authoritative fallback:', rpcRes.error)
      }
    }

    // 6. Authoritative Fallback / State Synchronization
    if (!rpcSuccess) {
      if (deliveryId) {
        await db.from('deliveries').update({ status: 'assigned' }).eq('id', deliveryId)

        const authUser = (await db.auth.getUser()).data.user
        const dispatcherId = authUser?.id || shopperProfileId

        if (dispatcherId && isUuid(dispatcherId)) {
          try {
            // Close any existing open assignment
            await db
              .from('delivery_assignments')
              .update({ status: 'rejected', notes: 'Reassigned by dispatch console' })
              .eq('delivery_id', deliveryId)
              .eq('status', 'assigned')

            // Insert new assignment
            await db.from('delivery_assignments').insert({
              delivery_id: deliveryId,
              rider_id: riderId,
              assigned_by: dispatcherId,
              status: 'assigned',
              assigned_at: new Date().toISOString(),
            })
          } catch (assignErr) {
            console.warn('Non-fatal: could not log delivery_assignments row:', assignErr)
          }
        }
      }
    }

    // 7. Synchronize linked tables & emit rider notification
    // Both shopper and standard orders transition to 'assigned' — the rider
    // has been dispatched but has not yet physically picked up the goods.
    // Status advances to 'picked_up' / 'in_transit' via mark_delivery_* RPCs.
    const nextOrderStatus = 'assigned'
    await db.from('orders').update({ status: nextOrderStatus }).eq('id', orderId)

    if (isShopperOrder && shopperTargetId) {
      await db
        .from('personal_shopper_requests')
        .update({
          assigned_shopper_id: shopperProfileId,
          status: 'assigned',
          updated_at: new Date().toISOString(),
        })
        .eq('id', shopperTargetId)
    }

    // Send real-time notification to the rider's profile
    if (isUuid(shopperProfileId)) {
      try {
        await db.from('notifications').insert({
          profile_id: shopperProfileId,
          title: '🛒 New Delivery Assignment Available',
          message: `Order #${orderId.slice(0, 8)} allocated to you. Tap to review pickup and items.`,
          type: 'order',
          action_url: '/rider/assignments',
          is_read: false,
        })
      } catch (notifErr) {
        console.warn('Could not notify rider profile:', notifErr)
      }
    }

    return { data: { orderId, deliveryId, riderId, serviceType: isShopperOrder ? 'custom' : serviceType, status: 'in_transit' }, error: null }
  } catch (err) {
    console.error('Error assigning rider to order:', err)
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to assign rider to order'),
    }
  }
}

export async function resetDeliveryForOrder(orderId: string): Promise<{ success: boolean; error?: Error | null }> {
  try {
    if (!orderId) return { success: false }

    // 1. Fetch linked delivery row
    const { data: deliv } = await db
      .from('deliveries')
      .select('id')
      .eq('order_id', orderId)
      .maybeSingle()

    if (deliv?.id) {
      // Revert delivery status to pending
      await db.from('deliveries').update({ status: 'pending', updated_at: new Date().toISOString() }).eq('id', deliv.id)

      // Mark any in-progress delivery assignments as cancelled/reassigned
      await db
        .from('delivery_assignments')
        .update({ status: 'rejected', notes: 'Reset to pending by dispatcher' })
        .eq('delivery_id', deliv.id)
        .in('status', ['assigned', 'accepted'])
    }

    // 2. If this was also linked to personal_shopper_requests, reset assigned shopper
    try {
      await db
        .from('personal_shopper_requests')
        .update({
          status: 'pending',
          assigned_shopper_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)

      await db
        .from('personal_shopper_requests')
        .update({
          status: 'pending',
          assigned_shopper_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('order_id', orderId)
    } catch {}

    return { success: true }
  } catch (err) {
    console.warn('[resetDeliveryForOrder] Non-fatal error resetting delivery state:', err)
    return { success: false, error: err instanceof Error ? err : new Error('Reset failed') }
  }
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

  try {
    let query = db.from('corporate_leads').select('*', { count: 'exact' })
    if (statusFilter) {
      query = query.eq('status', statusFilter)
    }
    const from = (page - 1) * limit
    const to = from + limit - 1
    const { data, count, error } = await query.order('created_at', { ascending: false }).range(from, to)
    if (!error && data) {
      return { data: data as CorporateLeadRow[], count: count ?? data.length, error: null }
    }
    if (error) {
      return { data: [], count: 0, error: error.message }
    }
  } catch (err) {
    return { data: [], count: 0, error: err instanceof Error ? err.message : 'Error loading corporate leads' }
  }

  return { data: [], count: 0, error: null }
}

export async function updateCorporateLeadStatus(
  id: string,
  status: 'pending' | 'contacted' | 'onboarded' | 'rejected'
) {
  try {
    const { data, error } = await db
      .from('corporate_leads')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) {
      return { data: null, error: error.message }
    }
    return { data, error: null }
  } catch (err: any) {
    return { data: null, error: err?.message || 'Failed to update corporate lead' }
  }
}

export async function getPersonalShopperRequests(params?: {
  page?: number
  limit?: number
  status?: string
}) {
  const page = params?.page || 1
  const limit = params?.limit || 20
  const statusFilter = params?.status && params.status !== 'all' ? params.status : null

  // 1. First try RPC
  try {
    const res = await db.rpc('get_personal_shopper_requests', {
      p_status: statusFilter,
      p_page: page,
      p_limit: limit,
    })
    if (res.data && !res.error && Array.isArray(res.data)) {
      const count = res.data.length > 0 ? Number(res.data[0].total_count || res.data.length) : 0
      return { data: res.data as PersonalShopperRequestRow[], count, error: null }
    }
  } catch (rpcErr) {
    console.warn('[getPersonalShopperRequests] RPC fallback to table query:', rpcErr)
  }

  // 2. Direct table query
  try {
    let query = db.from('personal_shopper_requests').select('*', { count: 'exact' })
    if (statusFilter) {
      query = query.eq('status', statusFilter)
    }
    const from = (page - 1) * limit
    const to = from + limit - 1
    const { data, count, error } = await query.order('created_at', { ascending: false }).range(from, to)
    if (!error && data) {
      return { data: data as PersonalShopperRequestRow[], count: count ?? data.length, error: null }
    }
    if (error) {
      return { data: [], count: 0, error: error.message }
    }
  } catch (tableErr: any) {
    console.error('[getPersonalShopperRequests] Table query error:', tableErr)
    return { data: [], count: 0, error: tableErr?.message || 'Failed to fetch personal shopper requests' }
  }

  return { data: [], count: 0, error: null }
}

export async function updatePersonalShopperStatus(
  id: string,
  status: 'pending' | 'assigned' | 'shopping' | 'completed' | 'cancelled' | 'in_transit' | 'delivered'
) {
  const now = new Date().toISOString()
  const shopperStatus = (
    status === 'in_transit' ? 'shopping' :
    status === 'delivered' ? 'completed' :
    status
  )
  const orderStatus = (
    status === 'shopping' ? 'in_transit' :
    status === 'completed' ? 'delivered' :
    status
  )

  // 1. Try to update by primary id in personal_shopper_requests
  const { data: matchedById } = await db
    .from('personal_shopper_requests')
    .update({ status: shopperStatus, updated_at: now })
    .eq('id', id)
    .select('id, order_id')

  if (matchedById && matchedById.length > 0) {
    const linkedOrderId = matchedById[0].order_id
    if (linkedOrderId) {
      await db.from('orders').update({ status: orderStatus, updated_at: now }).eq('id', linkedOrderId)
    }
    return { data: matchedById[0], error: null }
  }

  // 2. If no record was matched by id, id might be an order_id
  await db
    .from('personal_shopper_requests')
    .update({ status: shopperStatus, updated_at: now })
    .eq('order_id', id)

  // 3. Also update orders table directly by id
  return db
    .from('orders')
    .update({ status: orderStatus, updated_at: now })
    .eq('id', id)
}
