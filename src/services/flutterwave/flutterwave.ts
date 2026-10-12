import { supabase } from '@/services/supabase/client'
import type {
  InitializeFlutterwaveParams,
  FlutterwaveCheckoutOptions,
  InitializeFlutterwaveRequest,
  InitializeFlutterwaveData,
  VerifyFlutterwaveParams,
  VerifyFlutterwaveResult,
} from './types'

const FLUTTERWAVE_SCRIPT_URL = 'https://checkout.flutterwave.com/v3.js'
const DEFAULT_TEST_PUBLIC_KEY = 'FLWPUBK_TEST-SANDBOX-DEMO'

/**
 * Returns the configured Flutterwave public key or test fallback.
 */
export function getFlutterwavePublicKey(): string {
  const envKey = import.meta.env.VITE_FLUTTERWAVE_PUBLIC_KEY
  if (envKey && typeof envKey === 'string' && envKey.trim().length > 0) {
    return envKey.trim()
  }
  return DEFAULT_TEST_PUBLIC_KEY
}

let scriptLoadingPromise: Promise<boolean> | null = null

/**
 * Dynamically loads the official Flutterwave Inline Checkout v3 script.
 */
export function loadFlutterwaveScript(): Promise<boolean> {
  if (typeof window === 'undefined') {
    return Promise.resolve(false)
  }

  if (typeof window.FlutterwaveCheckout === 'function') {
    return Promise.resolve(true)
  }

  if (scriptLoadingPromise) {
    return scriptLoadingPromise
  }

  scriptLoadingPromise = new Promise((resolve) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${FLUTTERWAVE_SCRIPT_URL}"]`
    )

    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(true))
      existingScript.addEventListener('error', () => resolve(false))
      return
    }

    const script = document.createElement('script')
    script.src = FLUTTERWAVE_SCRIPT_URL
    script.async = true
    script.onload = () => {
      resolve(true)
    }
    script.onerror = () => {
      console.warn('[Flutterwave] Failed to load checkout script from CDN.')
      resolve(false)
    }

    document.head.appendChild(script)
  })

  return scriptLoadingPromise
}

/**
 * Generates a fallback transaction reference for KingdomDash Flutterwave payments.
 */
export function generateFlutterwaveTxRef(orderId: string): string {
  const cleanId = orderId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)
  return `KD-FLW-${cleanId}-${Date.now()}`
}

/**
 * Authoritatively initializes a Flutterwave payment attempt via Supabase Edge Function.
 * The server reads the authoritative order total from the database and returns the hosted payment link and tx_ref.
 */
export async function initializeFlutterwavePayment(
  orderIdOrParams: string | InitializeFlutterwaveRequest
): Promise<InitializeFlutterwaveData> {
  const order_id =
    typeof orderIdOrParams === 'string' ? orderIdOrParams : orderIdOrParams.order_id
  const callback_url =
    typeof orderIdOrParams === 'string' ? undefined : orderIdOrParams.callback_url

  const { data, error } = await supabase.functions.invoke<{
    success: boolean
    data: InitializeFlutterwaveData
    error?: string
  }>('flutterwave-initialize', {
    body: {
      order_id,
      ...(callback_url ? { callback_url } : {}),
    },
  })

  if (error) {
    throw new Error(error.message || 'Flutterwave initialization request failed')
  }

  if (!data?.success || !data.data?.tx_ref) {
    throw new Error(data?.error || 'Failed to initialize Flutterwave transaction')
  }

  return data.data
}

/**
 * Actively verifies transaction status with Flutterwave via Supabase Edge Function.
 * Invokes server-authoritative reconciliation inside Postgres.
 */
export async function verifyFlutterwavePayment(
  params: VerifyFlutterwaveParams
): Promise<VerifyFlutterwaveResult> {
  const { data, error } = await supabase.functions.invoke<VerifyFlutterwaveResult>(
    'flutterwave-verify',
    {
      body: params,
    }
  )

  if (error) {
    throw new Error(error.message || 'Flutterwave payment verification failed')
  }

  if (!data) {
    throw new Error('Empty verification response received from Flutterwave verify endpoint')
  }

  return data
}

/**
 * Opens Flutterwave Inline Checkout Modal for customer payment.
 */
export async function openFlutterwaveCheckout(
  params: InitializeFlutterwaveParams
): Promise<void> {
  const isLoaded = await loadFlutterwaveScript()

  const txRef = params.txRef || generateFlutterwaveTxRef(params.orderId)
  const publicKey = getFlutterwavePublicKey()

  if (!isLoaded || typeof window.FlutterwaveCheckout !== 'function') {
    const error = new Error('Flutterwave checkout gateway could not be loaded. Please try again.')
    if (params.onError) {
      params.onError(error)
      return
    }
    throw error
  }

  const options: FlutterwaveCheckoutOptions = {
    public_key: publicKey,
    tx_ref: txRef,
    amount: params.amount,
    currency: 'NGN',
    payment_options: 'card,banktransfer,ussd,account,barter',
    customer: {
      email: params.customer.email,
      phone_number: params.customer.phone_number || '',
      name: params.customer.name || 'KingdomDash Customer',
    },
    customizations: {
      title: 'KingdomDash',
      description: `Payment for Order #${params.orderId.slice(0, 8).toUpperCase()}`,
      logo: `${typeof window !== 'undefined' ? window.location.origin : ''}/logo.png`,
    },
    callback: (response) => {
      if (params.onSuccess) {
        params.onSuccess(response)
      }
    },
    onclose: (incomplete) => {
      if (incomplete && params.onCancel) {
        params.onCancel()
      }
    },
  }

  window.FlutterwaveCheckout(options)
}
