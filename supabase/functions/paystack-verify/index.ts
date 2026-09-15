import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface VerifyRequest {
  reference: string
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY')

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey || !paystackSecretKey) {
      console.error('[paystack-verify] Missing server configuration environment variables')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 1. Authenticate user session from JWT (§4)
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
    const { reference } = body

    if (!reference || typeof reference !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: reference' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // 3. Look up payment and associated order to verify caller ownership (§5)
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('payments')
      .select('id, order_id, status, paystack_reference, customer_id')
      .eq('paystack_reference', reference)
      .single()

    if (paymentError || !payment) {
      return new Response(
        JSON.stringify({ error: 'Payment reference not found' }),
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

    // 4. If order is already payment_confirmed and payment successful, return current verified state immediately
    if (order.status === 'payment_confirmed' && payment.status === 'successful') {
      return new Response(
        JSON.stringify({
          success: true,
          status: 'payment_confirmed',
          order_id: order.id,
          reference,
          message: 'Payment is confirmed',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 5. Query Paystack API to verify transaction status directly (§24)
    const paystackResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
          'Content-Type': 'application/json',
        },
      }
    )

    const paystackData = await paystackResponse.json().catch(() => null)

    if (!paystackResponse.ok || !paystackData || !paystackData.status) {
      return new Response(
        JSON.stringify({
          error: 'Failed to verify transaction with gateway',
          status: payment.status,
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const gatewayData = paystackData.data || {}
    const gatewayStatus = gatewayData.status // 'success', 'failed', 'abandoned'

    // 6. If Paystack confirmed success, execute authoritative reconciliation
    if (gatewayStatus === 'success') {
      const { data: reconciliationResult, error: rpcError } = await supabaseAdmin.rpc(
        'reconcile_paystack_payment',
        {
          p_reference: reference,
          p_paystack_transaction_id: gatewayData.id ? String(gatewayData.id) : null,
          p_kobo_amount: Number(gatewayData.amount),
          p_currency: gatewayData.currency || 'NGN',
          p_channel: gatewayData.channel || 'unknown',
          p_gateway_response: gatewayData.gateway_response || 'Successful',
          p_paid_at: gatewayData.paid_at || new Date().toISOString(),
          p_raw_payload: paystackData,
        }
      )

      if (rpcError) {
        console.error('[paystack-verify] Reconciliation RPC failed:', rpcError.message)
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
          reference,
          result: reconciliationResult,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 7. If failed or abandoned
    if (['failed', 'abandoned'].includes(gatewayStatus)) {
      await supabaseAdmin
        .from('payments')
        .update({
          status: 'failed',
          gateway_response: gatewayData.gateway_response || `Gateway status: ${gatewayStatus}`,
          updated_at: new Date().toISOString(),
        })
        .eq('paystack_reference', reference)
        .catch((e) => console.warn('[paystack-verify] Failed to update payment status:', e))

      return new Response(
        JSON.stringify({
          success: false,
          status: 'failed',
          order_id: order.id,
          reference,
          message: gatewayData.gateway_response || `Payment ${gatewayStatus}`,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 8. Payment still pending on gateway (§25)
    return new Response(
      JSON.stringify({
        success: true,
        status: 'payment_pending',
        order_id: order.id,
        reference,
        message: 'Payment is still processing on gateway',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    console.error('[paystack-verify] Unexpected error:', message)
    return new Response(
      JSON.stringify({ error: 'Payment verification failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
