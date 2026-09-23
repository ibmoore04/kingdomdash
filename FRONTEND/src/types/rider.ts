export interface RiderProfile {
  id: string
  profile_id: string
  vehicle_type: 'bicycle' | 'motorcycle' | 'car' | 'van'
  rating: number
  total_deliveries: number
  is_available: boolean
  is_verified: boolean
  is_active: boolean
  full_name?: string
  email?: string
  phone?: string
  avatar_url?: string | null
  active_in_flight_count?: number
}

export interface AssignmentInboxOffer {
  assignment_id: string
  delivery_id: string
  service_type: 'food' | 'grocery' | 'courier'
  pickup_address: string
  pickup_latitude: number | null
  pickup_longitude: number | null
  delivery_area: string // Generalized neighborhood only (server-projected)
  estimated_distance_km: number
  vendor_name: string
  special_instructions_preview: string | null
  status: 'assigned'
  assigned_at: string
}

export interface ActiveDeliveryDetails {
  assignment_id: string
  delivery_id: string
  order_id: string
  service_type: 'food' | 'grocery' | 'courier'
  delivery_status: 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled'
  assignment_status: 'accepted'
  order_status: string
  pickup_address: string
  pickup_latitude: number | null
  pickup_longitude: number | null
  delivery_address: string
  delivery_latitude: number | null
  delivery_longitude: number | null
  customer_name: string
  customer_phone: string
  special_instructions: string | null
  vendor_id: string | null
  vendor_name: string
  vendor_address: string | null
  assigned_at: string
  responded_at: string | null
  picked_up_at: string | null
  items: Array<{
    id: string
    product_name: string
    quantity: number
  }>
}

export interface CompletedDeliveryHistoryItem {
  assignment_id: string
  delivery_id: string
  order_id: string
  service_type: 'food' | 'grocery' | 'courier'
  vendor_name: string
  pickup_area: string
  delivery_area: string
  delivered_at: string | null
  assignment_status: 'completed'
  delivery_status: 'delivered'
  earnings_amount?: number
}

export type OperationalIssueType =
  | 'customer_unreachable'
  | 'vendor_delay'
  | 'address_issue'
  | 'vehicle_breakdown'
  | 'traffic_delay'
  | 'other'

export interface OperationalIssueSubmission {
  delivery_id: string
  issue_type: OperationalIssueType
  notes: string
}
