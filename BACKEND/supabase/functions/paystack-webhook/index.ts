import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// Constant-time HMAC-SHA512 verification to prevent timing attacks (§17)
async function verifyPaystackSignature(
  rawBody: string,
  signatureHeader: string | null,
  secretKey: string
): Promise<boolean> {
  if (!signatureHeader || !secretKey) return false

  try {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secretKey),
      { name: 'HMAC', hash: 'SHA-512' },
      false,
      ['sign', 'verify']
    )

    const calculatedSignatureBytes = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(rawBody)
    )

    const calculatedSignatureHex = Array.from(new Uint8Array(calculatedSignatureBytes))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    // Length check
    if (calculatedSignatureHex.length !== signatureHeader.length) {
      return false
    }

    // Timing-attack resistant byte comparison
    let mismatch = 0
    for (let i = 0; i < calculatedSignatureHex.length; i++) {
      mismatch |= calculatedSignatureHex.charCodeAt(i) ^ signatureHeader.charCodeAt(i)
    }

    return mismatch === 0
  } catch (err) {
    console.error('[paystack-webhook] Signature calculation error:', err)
    return false
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY')

    if (!supabaseUrl || !supabaseServiceKey || !paystackSecretKey) {
      console.error('[paystack-webhook] Missing required environment variables')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 1. Read raw body text BEFORE JSON parsing for HMAC-SHA512 verification (§18)
    const rawBody = await req.text()
    const signature = req.headers.get('x-paystack-signature')

    if (!signature) {
      console.warn('[paystack-webhook] Rejected request missing x-paystack-signature header')
      return new Response(
        JSON.stringify({ error: 'Missing x-paystack-signature header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Validate HMAC-SHA512 signature against Paystack secret key (§17)
    const isValidSignature = await verifyPaystackSignature(rawBody, signature, paystackSecretKey)
    if (!isValidSignature) {
      console.warn('[paystack-webhook] Invalid signature verification attempt rejected')
      return new Response(
        JSON.stringify({ error: 'Unauthorized: invalid webhook signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Parse JSON payload
    let payload: Record<string, any>
    try {
      payload = JSON.parse(rawBody)
    } catch {
      return new Response(
        JSON.stringify({ error: 'Malformed JSON payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const event = payload?.event
    const data = payload?.data || {}

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // 4. Handle 'charge.success' event (§19, §20)
    if (event === 'charge.success') {
      const reference = data.reference
      const transactionId = data.id ? String(data.id) : null
      const koboAmount = Number(data.amount)
      const currency = data.currency || 'NGN'
      const channel = data.channel || 'unknown'
      const gatewayResponse = data.gateway_response || 'Successful'
      const paidAt = data.paid_at || new Date().toISOString()

      if (!reference || !koboAmount) {
        return new Response(
          JSON.stringify({ error: 'Missing required charge fields in webhook payload' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Invoke authoritative database reconciliation stored procedure (§21)
      const { data: reconciliationResult, error: rpcError } = await supabaseAdmin.rpc(
        'reconcile_paystack_payment',
        {
          p_reference: reference,
          p_paystack_transaction_id: transactionId,
          p_kobo_amount: koboAmount,
          p_currency: currency,
          p_channel: channel,
          p_gateway_response: gatewayResponse,
          p_paid_at: paidAt,
          p_raw_payload: payload,
        }
      )

      if (rpcError) {
        console.error('[paystack-webhook] Reconciliation RPC failed:', rpcError.message)
        // Return 500 to allow Paystack webhook retry mechanism
        return new Response(
          JSON.stringify({ error: 'Reconciliation failed. Delivery will retry.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({
          success: true,
          status: reconciliationResult?.status || 'reconciled',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 5. Audit non-success events (e.g. charge.failed)
    if (event === 'charge.failed' && data.reference) {
      await supabaseAdmin.from('payment_events').insert({
        paystack_reference: data.reference,
        event_type: 'charge.failed',
        idempotency_key: `${data.reference}:charge.failed:${data.id || Date.now()}`,
        payload,
      }).catch((e) => console.warn('[paystack-webhook] Non-blocking event log failure:', e))

      await supabaseAdmin
        .from('payments')
        .update({
          status: 'failed',
          gateway_response: data.gateway_response || 'Charge failed on gateway',
          updated_at: new Date().toISOString(),
        })
        .eq('paystack_reference', data.reference)
        .catch((e) => console.warn('[paystack-webhook] Failed to update payment status:', e))
    }

    // Always acknowledge event receipt to Paystack for recognized events
    return new Response(
      JSON.stringify({ success: true, message: `Event ${event || 'unknown'} acknowledged` }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    console.error('[paystack-webhook] Unexpected error:', message)
    return new Response(
      JSON.stringify({ error: 'Webhook processing error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
