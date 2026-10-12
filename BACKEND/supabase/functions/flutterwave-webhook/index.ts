import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// Constant-time string comparison to prevent timing attacks
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const secretHash = Deno.env.get('FLUTTERWAVE_SECRET_HASH')

    if (!supabaseUrl || !supabaseServiceKey || !secretHash) {
      console.error('[flutterwave-webhook] Missing required environment variables')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 1. Validate Flutterwave secret hash from verif-hash header
    const signature = req.headers.get('verif-hash')
    if (!signature) {
      console.warn('[flutterwave-webhook] Missing verif-hash header')
      return new Response(
        JSON.stringify({ error: 'Missing verif-hash signature header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!timingSafeEqual(signature, secretHash)) {
      console.warn('[flutterwave-webhook] Invalid verif-hash received')
      return new Response(
        JSON.stringify({ error: 'Unauthorized: invalid webhook signature hash' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Parse JSON payload
    const rawBody = await req.text()
    let payload: Record<string, any>
    try {
      payload = JSON.parse(rawBody)
    } catch {
      return new Response(
        JSON.stringify({ error: 'Malformed JSON payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const event = payload?.['event.type'] || payload?.event || 'unknown'
    const data = payload?.data || {}

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // 3. Compute event fingerprint for idempotency: SHA-256(event : identifier : timestamp)
    const eventIdentifier = data.tx_ref || data.id || 'no_id'
    const eventTimestamp = data.created_at || ''
    const fingerprintSource = `${event}:${eventIdentifier}:${eventTimestamp}`
    const encoder = new TextEncoder()
    const hashBytes = await crypto.subtle.digest('SHA-256', encoder.encode(fingerprintSource))
    const eventFingerprint = Array.from(new Uint8Array(hashBytes)).map((b) => b.toString(16).padStart(2, '0')).join('')

    // Idempotent insertion into flutterwave_webhook_events
    const { error: insertErr } = await supabaseAdmin
      .from('flutterwave_webhook_events')
      .insert({
        event_fingerprint: eventFingerprint,
        event_type: event,
        tx_ref: data.tx_ref || null,
        flw_ref: data.flw_ref || null,
        payload,
        processed: false,
      })

    // If duplicate event fingerprint, acknowledge immediately (idempotency replay)
    if (insertErr && (insertErr.code === '23505' || insertErr.message?.includes('duplicate key'))) {
      return new Response(
        JSON.stringify({ success: true, message: 'Event already recorded and processed' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. Handle charge completion event
    if ((event === 'charge.completed' || event === 'CARD_TRANSACTION') && data.status === 'successful') {
      const txRef = data.tx_ref
      const transactionId = data.id ? String(data.id) : null
      const amount = Number(data.amount)
      const currency = data.currency || 'NGN'
      const paymentType = data.payment_type || 'flutterwave'
      const gatewayResponse = data.processor_response || 'Successful'
      const paidAt = data.created_at || new Date().toISOString()

      if (!txRef || isNaN(amount) || amount <= 0) {
        return new Response(
          JSON.stringify({ error: 'Missing required charge fields in webhook payload' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Invoke authoritative database reconciliation stored procedure
      const { data: reconciliationResult, error: rpcError } = await supabaseAdmin.rpc(
        'reconcile_flutterwave_payment',
        {
          p_tx_ref: txRef,
          p_flutterwave_transaction_id: transactionId,
          p_flw_ref: data.flw_ref || null,
          p_amount: amount,
          p_currency: currency,
          p_payment_type: paymentType,
          p_gateway_response: gatewayResponse,
          p_paid_at: paidAt,
          p_raw_payload: payload,
        }
      )

      if (rpcError) {
        console.error('[flutterwave-webhook] Reconciliation RPC failed:', rpcError.message)
        // Return 500 to allow Flutterwave webhook retry mechanism
        return new Response(
          JSON.stringify({ error: 'Reconciliation failed. Delivery will retry.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Mark event as processed
      await supabaseAdmin
        .from('flutterwave_webhook_events')
        .update({ processed: true, processed_at: new Date().toISOString() })
        .eq('event_fingerprint', eventFingerprint)
        .catch(() => null)

      return new Response(
        JSON.stringify({
          success: true,
          status: reconciliationResult?.status || 'reconciled',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Always acknowledge event receipt to Flutterwave for other events
    return new Response(
      JSON.stringify({ success: true, message: `Event ${event} acknowledged` }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    console.error('[flutterwave-webhook] Unexpected error:', message)
    return new Response(
      JSON.stringify({ error: 'Webhook processing error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
