export interface FlutterwaveCustomer {
  email: string
  phone_number?: string
  name?: string
}

export interface FlutterwaveCustomizations {
  title?: string
  description?: string
  logo?: string
}

export interface FlutterwaveCallbackResponse {
  tx_ref: string
  transaction_id: string | number
  status: 'successful' | 'completed' | 'failed' | 'cancelled'
  amount: number
  currency: string
  flw_ref?: string
  charge_response_code?: string
  charge_response_message?: string
}

export interface FlutterwaveCheckoutOptions {
  public_key: string
  tx_ref: string
  amount: number
  currency?: string
  payment_options?: string
  customer: FlutterwaveCustomer
  customizations?: FlutterwaveCustomizations
  callback: (data: FlutterwaveCallbackResponse) => void
  onclose?: (incomplete?: boolean) => void
}

export interface InitializeFlutterwaveParams {
  orderId: string
  amount: number
  customer: FlutterwaveCustomer
  txRef?: string
  onSuccess?: (response: FlutterwaveCallbackResponse) => void
  onCancel?: () => void
  onError?: (error: Error) => void
}

export interface InitializeFlutterwaveRequest {
  order_id: string
  callback_url?: string
}

export interface InitializeFlutterwaveData {
  link: string
  tx_ref: string
  order_id: string
}

export interface InitializeFlutterwaveResult {
  success: boolean
  data?: InitializeFlutterwaveData
  error?: string
}

export interface VerifyFlutterwaveParams {
  transaction_id?: string | number
  tx_ref?: string
}

export interface VerifyFlutterwaveResult {
  success: boolean
  status: 'payment_confirmed' | 'payment_pending' | 'failed'
  order_id?: string
  tx_ref?: string
  message?: string
  error?: string
}

declare global {
  interface Window {
    FlutterwaveCheckout?: (options: FlutterwaveCheckoutOptions) => {
      close: () => void
    }
  }
}
