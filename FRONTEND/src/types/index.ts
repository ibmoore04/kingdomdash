import type {
  ASSIGNMENT_STATUSES,
  DELIVERY_STATUSES,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  SERVICE_TYPES,
} from '@/utils/constants'
import type { Database } from './database.types'

export type { Database } from './database.types'

export type ServiceType = (typeof SERVICE_TYPES)[number]
export type OrderStatus = (typeof ORDER_STATUSES)[number]
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number]
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number]
export type BusinessType = Database['public']['Enums']['business_type']
export type UserRole = Database['public']['Enums']['user_role']

// ── First-Class Database Domain Entities ─────────────────────────────────────
export type Vendor = Database['public']['Tables']['vendors']['Row']
export type VendorInsert = Database['public']['Tables']['vendors']['Insert']
export type VendorUpdate = Database['public']['Tables']['vendors']['Update']

export type VendorService = Database['public']['Tables']['vendor_services']['Row']
export type VendorServiceInsert = Database['public']['Tables']['vendor_services']['Insert']
export type VendorServiceUpdate = Database['public']['Tables']['vendor_services']['Update']

export type Category = Database['public']['Tables']['categories']['Row']
export type CategoryInsert = Database['public']['Tables']['categories']['Insert']
export type CategoryUpdate = Database['public']['Tables']['categories']['Update']

export type Product = Database['public']['Tables']['products']['Row']
export type ProductInsert = Database['public']['Tables']['products']['Insert']
export type ProductUpdate = Database['public']['Tables']['products']['Update']

export type ReferenceCategory = Database['public']['Tables']['reference_categories']['Row']
export type ReferenceCategoryInsert = Database['public']['Tables']['reference_categories']['Insert']
export type ReferenceCategoryUpdate = Database['public']['Tables']['reference_categories']['Update']

export type Address = Database['public']['Tables']['addresses']['Row']
export type AddressInsert = Database['public']['Tables']['addresses']['Insert']
export type AddressUpdate = Database['public']['Tables']['addresses']['Update']

export type Order = Database['public']['Tables']['orders']['Row']
export type OrderInsert = Database['public']['Tables']['orders']['Insert']
export type OrderUpdate = Database['public']['Tables']['orders']['Update']

export type OrderItem = Database['public']['Tables']['order_items']['Row']
export type OrderItemInsert = Database['public']['Tables']['order_items']['Insert']
export type OrderItemUpdate = Database['public']['Tables']['order_items']['Update']

export type ServiceArea = Database['public']['Tables']['service_areas']['Row']
export type ServiceAreaInsert = Database['public']['Tables']['service_areas']['Insert']
export type ServiceAreaUpdate = Database['public']['Tables']['service_areas']['Update']

export type DeliveryPricingRule = Database['public']['Tables']['delivery_pricing_rules']['Row']
export type DeliveryPricingRuleInsert = Database['public']['Tables']['delivery_pricing_rules']['Insert']
export type DeliveryPricingRuleUpdate = Database['public']['Tables']['delivery_pricing_rules']['Update']

// ── Geographic & Map Domain Types ───────────────────────────────────────────
export interface Coordinates {
  latitude: number
  longitude: number
}

export interface LocationValidationResult {
  isValid: boolean
  errorMessage?: string
  isServiceable?: boolean
  serviceAreaName?: string
  distanceKm?: number
}

// ── Phase 8 Delivery Fee Preview Domain Type ─────────────────────────────────
export interface DeliveryFeePreviewResult {
  is_serviceable: boolean
  distance_km?: number | null
  base_fee?: number | null
  distance_rate?: number | null
  min_fee?: number | null
  max_fee?: number | null
  raw_fee?: number | null
  delivery_fee?: number | null
  pricing_tier?: number | null
  pricing_rule_id?: string | null
  service_area_id?: string | null
  service_area_name?: string | null
  error?: string | null
}

// ── Mock Types (Preserved for offline/testing isolation) ──────────────────────
export interface MockVendor {
  id: string
  name: string
  businessType: BusinessType
  description: string
  area: string
  isOpen: boolean
  etaMinutes: number
  categories: string[]
}

export interface MockProduct {
  id: string
  vendorId: string
  name: string
  description: string
  price: number
  category: string
  available: boolean
}

// ── Phase 11 Rider Domain Types ──────────────────────────────────────────────
export * from './rider'

