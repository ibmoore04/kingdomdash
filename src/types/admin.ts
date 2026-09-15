/**
 * KINGDOMDASH — PHASE 12: ADMIN CONTROL CENTER
 * Strongly-Typed Administrative Domain Interfaces
 */

export type AdminDateRangePreset = 'today' | '7d' | '30d' | '90d' | 'custom'
export type DateRangePreset = AdminDateRangePreset

export interface AdminAnalyticsSummary {
  total_orders: number
  completed_orders: number
  cancelled_orders: number
  total_revenue: number
  total_delivery_fees?: number
  active_riders_count: number
  active_vendors_count: number
  pending_rider_applications: number
  pending_vendor_applications: number
  refund_review_count?: number
}

export interface AdminLiveMetrics {
  pending_orders_live: number
  active_deliveries_live: number
  unassigned_deliveries_live: number
  available_riders_live: number
}

export interface OrderOverTimeItem {
  date: string
  total_orders: number
  completed_orders: number
  cancelled_orders: number
  total_revenue: number
}

export interface OrderByServiceItem {
  service_type: 'food' | 'grocery' | 'courier'
  order_count: number
  total_revenue: number
  percentage: number
}

export interface OrderStatusDistItem {
  status: string
  count: number
  percentage?: number
}

export interface DeliveryStatusDistItem {
  status: string
  count: number
  percentage?: number
}

export interface CompletionTrendItem {
  date: string
  completed: number
  cancelled: number
}

export interface AdminAnalyticsResponse {
  date_range?: {
    start_date: string
    end_date: string
  }
  summary: AdminAnalyticsSummary
  live_metrics: AdminLiveMetrics
  orders_over_time: OrderOverTimeItem[]
  orders_by_service: OrderByServiceItem[]
  order_status_distribution: OrderStatusDistItem[]
  delivery_status_distribution: DeliveryStatusDistItem[]
  completion_trends: CompletionTrendItem[]
}

export interface AdminUserRow {
  id: string
  email?: string
  full_name: string
  phone_number?: string | null
  phone?: string | null
  role: 'customer' | 'vendor' | 'rider' | 'admin' | 'super_admin'
  is_active: boolean
  created_at: string
}
export type AdminUserListItem = AdminUserRow

export interface AdminVehicle {
  id: string
  assigned_rider_id?: string | null
  vehicle_type: string
  make?: string
  model?: string
  year?: number
  license_plate?: string
  plate_number?: string
  status?: string
}

export interface AdminRiderRow {
  id: string
  profile_id?: string
  full_name: string
  email?: string
  phone_number?: string | null
  phone?: string | null
  avatar_url?: string | null
  is_verified: boolean
  is_active: boolean
  is_available: boolean
  total_deliveries?: number
  rating?: number
  created_at: string
  vehicle?: AdminVehicle | null
}
export type AdminRiderListItem = AdminRiderRow

export interface RiderApplication {
  id: string
  full_name: string
  phone_number: string
  vehicle_type: string
  plate_number?: string
  vehicle_make?: string
  vehicle_model?: string
  vehicle_year?: number
  license_number?: string
  license_url?: string
  status: string
  created_at: string
}

export interface AdminVendorRow {
  id: string
  profile_id?: string
  business_name: string
  business_type: string
  services?: ('food' | 'grocery')[]
  address?: string
  business_address?: string
  phone_number?: string
  phone?: string
  owner_email?: string
  email?: string
  is_active: boolean
  created_at: string
}
export type AdminVendorListItem = AdminVendorRow

export interface VendorApplication {
  id: string
  business_name: string
  business_type: string
  service_types?: ('food' | 'grocery')[]
  phone_number?: string
  owner_email?: string
  address?: string
  description?: string
  status: string
  created_at: string
}

export interface OrderItemLine {
  id: string
  product_name: string
  quantity: number
  unit_price: number
  total_price: number
}

export interface AdminOrderRow {
  id: string
  customer_id: string
  customer_name?: string
  customer_phone?: string
  vendor_id?: string | null
  vendor_name?: string
  service_type: 'food' | 'grocery' | 'courier'
  status: string
  subtotal: number
  delivery_fee: number
  tax_amount?: number
  total_amount: number
  total?: number
  pickup_address?: string
  delivery_address?: string
  created_at: string
}
export type AdminOrderItem = AdminOrderRow

export interface OrderDetailsData {
  order: AdminOrderRow
  items: OrderItemLine[]
  delivery?: {
    id: string
    status: string
    rider_id?: string | null
  } | null
}

export interface AdminDeliveryRow {
  id: string
  order_id: string | null
  customer_name?: string
  customer_phone?: string
  pickup_address?: string
  delivery_address?: string
  service_type?: 'food' | 'grocery' | 'courier'
  status: string
  created_at: string
  picked_up_at?: string | null
  delivered_at?: string | null
  cancelled_at?: string | null
  rider?: {
    id: string
    full_name: string
    phone_number?: string | null
  } | null
}
export type AdminDeliveryListItem = AdminDeliveryRow

export interface DeliveryPricingRuleRow {
  id: string
  service_type: string | null
  base_fee: number
  per_km_fee: number
  distance_rate?: number
  min_fee: number
  surge_multiplier: number
  is_active: boolean
  effective_date?: string
  created_at: string
}
export type AdminPricingRule = DeliveryPricingRuleRow

export interface ServiceAreaRow {
  id: string
  name: string
  description?: string | null
  center_lat: number
  center_lng: number
  radius_km: number
  is_active: boolean
  created_at: string
}
export type AdminServiceArea = ServiceAreaRow

export interface PaymentTransactionRow {
  id: string
  order_id: string | null
  amount: number
  paystack_reference?: string
  status: string
  created_at: string
}

export interface RefundReviewRow {
  id: string
  total_amount: number
  status: string
  refund_required: boolean
  created_at: string
}

export interface CategoryRow {
  id: string
  name: string
  slug: string
  service_type: string
  icon_url?: string
  is_active: boolean
  sort_order: number
}

export interface ProductRow {
  id: string
  name: string
  price: number
  vendor_id: string
  is_available: boolean
}

export interface AuditLogRow {
  id: string
  user_id?: string | null
  action: string
  entity_type: string
  entity_id?: string | null
  details?: Record<string, unknown> | null
  created_at: string
}
export type AdminAuditLogItem = AuditLogRow
