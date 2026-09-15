import { supabase } from '@/services/supabase/client'
import type {
  InitializePaymentParams,
  InitializePaymentData,
  VerifyPaymentParams,
  VerifyPaymentResult,
  PaymentRow,
} from './types'

/**
 * Initializes a secure Paystack transaction via Supabase Edge Function.
 * The server reads the authoritative order total from the database.
 * No client-supplied amounts or delivery fees are used.
 */
export async function initializePaystackPayment(
  orderIdOrParams: string | InitializePaymentParams
): Promise<InitializePaymentData> {
  const order_id =
    typeof orderIdOrParams === 'string' ? orderIdOrParams : orderIdOrParams.order_id
  const callback_url =
    typeof orderIdOrParams === 'string' ? undefined : orderIdOrParams.callback_url

  const { data, error } = await supabase.functions.invoke<{
    success: boolean
    data: InitializePaymentData
    error?: string
  }>('paystack-initialize', {
    body: {
      order_id,
      ...(callback_url ? { callback_url } : {}),
    },
  })

  if (error) {
    throw new Error(error.message || 'Payment initialization request failed')
  }

  if (!data?.success || !data.data?.authorization_url) {
    throw new Error(data?.error || 'Failed to obtain Paystack authorization URL')
  }

  return data.data
}

/**
 * Actively verifies transaction status with Paystack via Supabase Edge Function.
 * Used as fallback reconciliation on confirmation page redirect.
 */
export async function verifyPaystackPayment(
  referenceOrParams: string | VerifyPaymentParams
): Promise<VerifyPaymentResult> {
  const reference =
    typeof referenceOrParams === 'string'
      ? referenceOrParams
      : referenceOrParams.reference

  const { data, error } = await supabase.functions.invoke<VerifyPaymentResult>(
    'paystack-verify',
    {
      body: {
        reference,
      },
    }
  )

  if (error) {
    throw new Error(error.message || 'Payment verification request failed')
  }

  if (!data) {
    throw new Error('Empty verification response received')
  }

  return data
}

/**
 * Retrieves the latest payment record for an order owned by current user.
 */
export async function getLatestPaymentForOrder(
  orderId: string
): Promise<PaymentRow | null> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[PaystackService] Failed to load payment record:', error.message)
    return null
  }

  return data
}
