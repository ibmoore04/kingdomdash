import type { Database } from '@/types/database.types'

export type PaymentStatus = Database['public']['Enums']['payment_status']
export type PaymentRow = Database['public']['Tables']['payments']['Row']

export interface InitializePaymentParams {
  order_id: string
  callback_url?: string
}

export interface InitializePaymentData {
  authorization_url: string
  access_code: string
  reference: string
}

export interface InitializePaymentResult {
  success: boolean
  data?: InitializePaymentData
  error?: string
}

export interface VerifyPaymentParams {
  reference: string
}

export interface VerifyPaymentResult {
  success: boolean
  status: 'payment_confirmed' | 'payment_pending' | 'failed'
  order_id?: string
  reference: string
  message?: string
  error?: string
}
