export const SERVICE_TYPES = ['food', 'grocery', 'courier'] as const

export const ORDER_STATUSES = [
  'pending',
  'payment_pending',
  'payment_processing',
  'payment_confirmed',
  'preparing',
  'ready_for_pickup',
  'picked_up',
  'in_transit',
  'delivered',
  'cancelled',
] as const

export const PAYMENT_STATUSES = [
  'pending',
  'processing',
  'successful',
  'failed',
  'refunded',
] as const

export const ASSIGNMENT_STATUSES = [
  'assigned',
  'accepted',
  'rejected',
  'completed',
] as const

export const DELIVERY_STATUSES = [
  'pending',
  'assigned',
  'picked_up',
  'in_transit',
  'delivered',
  'cancelled',
] as const
