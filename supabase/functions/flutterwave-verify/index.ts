import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'

interface VerifyRequest {
  transaction_id?: string | number
  tx_ref?: string
}

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const flutterwaveSecretKey = Deno.env.get('FLUTTERWAVE_SECRET_KEY')

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey || !flutterwaveSecretKey) {
      console.error('[flutterwave-verify] Missing server configuration environment variables')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 1. Authenticate user session from JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUserClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: userError } = await supabaseUserClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: invalid or expired session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Parse and validate request payload
    const body: VerifyRequest = await req.json().catch(() => ({} as VerifyRequest))
    const { transaction_id, tx_ref } = body

    if (!transaction_id && !tx_ref) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: transaction_id or tx_ref' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // 3. Look up payment and associated order to verify caller ownership
    let query = supabaseAdmin
      .from('payments')
      .select('id, order_id, status, flutterwave_ref, flutterwave_transaction_id, customer_id')

    if (tx_ref) {
      query = query.eq('flutterwave_ref', tx_ref)
    } else if (transaction_id) {
      query = query.eq('flutterwave_transaction_id', String(transaction_id))
    }

    const { data: payments, error: paymentError } = await query
    const payment = payments && payments.length > 0 ? payments[0] : null

    if (paymentError || !payment) {
      return new Response(
        JSON.stringify({ error: 'Payment transaction reference not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, customer_id, status, total')
      .eq('id', payment.order_id)
      .single()

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: 'Associated order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (order.customer_id !== user.id && payment.customer_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: you do not own this order' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. If order is already payment_confirmed and payment successful, return verified state immediately
    if (order.status === 'payment_confirmed' && payment.status === 'successful') {
      return new Response(
        JSON.stringify({
          success: true,
          status: 'payment_confirmed',
          order_id: order.id,
          tx_ref: payment.flutterwave_ref || tx_ref,
          message: 'Payment is confirmed',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 5. Query Flutterwave API directly
    let flwVerifyUrl = ''
    if (transaction_id) {
      flwVerifyUrl = `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(String(transaction_id))}/verify`
    } else {
      flwVerifyUrl = `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(tx_ref!)}`
    }

    const flwResponse = await fetch(flwVerifyUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${flutterwaveSecretKey}`,
        'Content-Type': 'application/json',
      },
    })

    const flwData = await flwResponse.json().catch(() => null)

    if (!flwResponse.ok || !flwData || flwData.status !== 'success') {
      return new Response(
        JSON.stringify({
          error: flwData?.message || 'Failed to verify transaction with Flutterwave gateway',
          status: payment.status,
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const gatewayData = flwData.data || {}
    const gatewayStatus = gatewayData.status // 'successful', 'failed', 'cancelled'

    // 6. If Flutterwave confirmed success, execute authoritative reconciliation
    if (gatewayStatus === 'successful') {
      const resolvedTxRef = gatewayData.tx_ref || payment.flutterwave_ref || tx_ref
      const { data: reconciliationResult, error: rpcError } = await supabaseAdmin.rpc(
        'reconcile_flutterwave_payment',
        {
          p_tx_ref: resolvedTxRef,
          p_flutterwave_transaction_id: String(gatewayData.id),
          p_flw_ref: gatewayData.flw_ref || null,
          p_amount: Number(gatewayData.amount),
          p_currency: gatewayData.currency || 'NGN',
          p_payment_type: gatewayData.payment_type || 'flutterwave',
          p_gateway_response: gatewayData.processor_response || 'Successful',
          p_paid_at: gatewayData.created_at || new Date().toISOString(),
          p_raw_payload: flwData,
        }
      )

      if (rpcError) {
        console.error('[flutterwave-verify] Reconciliation RPC failed:', rpcError.message)
        return new Response(
          JSON.stringify({ error: 'Payment reconciliation could not be completed' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({
          success: true,
          status: 'payment_confirmed',
          order_id: order.id,
          tx_ref: resolvedTxRef,
          result: reconciliationResult,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 7. If failed or cancelled
    if (['failed', 'cancelled'].includes(gatewayStatus)) {
      await supabaseAdmin
        .from('payments')
        .update({
          status: 'failed',
          gateway_response: gatewayData.processor_response || `Gateway status: ${gatewayStatus}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', payment.id)
        .catch((e) => console.warn('[flutterwave-verify] Failed to update payment status:', e))

      return new Response(
        JSON.stringify({
          success: false,
          status: 'failed',
          order_id: order.id,
          tx_ref: payment.flutterwave_ref || tx_ref,
          message: gatewayData.processor_response || `Payment ${gatewayStatus}`,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 8. Still pending
    return new Response(
      JSON.stringify({
        success: true,
        status: 'payment_pending',
        order_id: order.id,
        tx_ref: payment.flutterwave_ref || tx_ref,
        message: 'Payment is still processing on Flutterwave gateway',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    console.error('[flutterwave-verify] Unexpected error:', message)
    return new Response(
      JSON.stringify({ error: 'Payment verification failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
