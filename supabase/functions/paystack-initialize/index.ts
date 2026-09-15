import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface InitializeRequest {
  order_id: string
  callback_url?: string
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
    const siteUrl = Deno.env.get('SITE_URL') || 'https://kingdomdash.ng'

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey || !paystackSecretKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error: missing required environment variables' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 1. Authenticate user from JWT
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

    // 2. Parse request payload
    const body: InitializeRequest = await req.json().catch(() => ({} as InitializeRequest))
    const { order_id, callback_url } = body

    if (!order_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: order_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Invoke authoritative database stored procedure: create_payment_attempt(order_id)
    // Runs inside Postgres with row locks: validates customer ownership (auth.uid() = customer_id),
    // payable status, checks no prior successful payment, reads authoritative order total,
    // generates server-authoritative Paystack reference, inserts pending payment, and updates order.
    const { data: attemptData, error: attemptError } = await supabaseUserClient.rpc(
      'create_payment_attempt',
      { p_order_id: order_id }
    )

    if (attemptError || !attemptData) {
      const errMsg = attemptError?.message || 'Failed to create payment attempt'
      console.warn(`[paystack-initialize] create_payment_attempt failed for order ${order_id}:`, errMsg)

      let status = 400
      let clientMsg = 'Payment attempt creation failed'

      if (errMsg.includes('not found')) {
        status = 404
        clientMsg = 'Order not found'
      } else if (errMsg.includes('Access denied') || errMsg.includes('caller does not own')) {
        status = 403
        clientMsg = 'Forbidden: you do not own this order'
      } else if (errMsg.includes('already been paid')) {
        status = 409
        clientMsg = 'Order has already been paid successfully'
      } else if (errMsg.includes('cannot be paid')) {
        status = 400
        clientMsg = 'Order cannot be paid in its current status'
      } else if (errMsg.includes('invalid total')) {
        status = 400
        clientMsg = 'Order total is invalid'
      }

      return new Response(
        JSON.stringify({ error: clientMsg }),
        { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const {
      reference,
      kobo_amount: koboAmount,
      customer_email: customerEmail,
      currency,
    } = attemptData as {
      payment_id: string
      order_id: string
      reference: string
      amount: number
      kobo_amount: number
      currency: string
      customer_email: string
    }

    // 4. Validate authoritative parameters before contacting gateway
    if (!reference || typeof reference !== 'string' || !reference.startsWith('kd_')) {
      return new Response(
        JSON.stringify({ error: 'Server error: invalid payment reference generated' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!Number.isSafeInteger(koboAmount) || koboAmount <= 0) {
      return new Response(
        JSON.stringify({ error: 'Server error: invalid authoritative amount calculation' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (currency !== 'NGN') {
      return new Response(
        JSON.stringify({ error: 'Server error: unsupported payment currency' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const resolvedEmail = customerEmail || user.email
    if (!resolvedEmail || !resolvedEmail.includes('@')) {
      return new Response(
        JSON.stringify({ error: 'Customer email is required for payment processing' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 5. Call Paystack API to initialize transaction with server-authoritative parameters
    const resolvedCallbackUrl = callback_url || `${siteUrl}/order/${order_id}/confirmation`
    const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: resolvedEmail,
        amount: koboAmount,
        currency: 'NGN',
        reference,
        callback_url: resolvedCallbackUrl,
        metadata: {
          order_id,
          customer_id: user.id,
          platform: 'kingdomdash',
        },
      }),
    })

    const paystackData = await paystackResponse.json().catch(() => null)

    if (!paystackResponse.ok || !paystackData || !paystackData.status) {
      console.error('[paystack-initialize] Paystack API error:', paystackData?.message || paystackResponse.statusText)

      // Service-role client used strictly to mark the attempt as failed in DB
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
      await supabaseAdmin
        .from('payments')
        .update({
          status: 'failed',
          gateway_response: paystackData?.message || 'Paystack initialization failed',
          updated_at: new Date().toISOString(),
        })
        .eq('paystack_reference', reference)

      return new Response(
        JSON.stringify({
          error: 'Payment gateway initialization failed. Please try again.',
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 6. Return only safe public checkout parameters to client
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          authorization_url: paystackData.data.authorization_url,
          access_code: paystackData.data.access_code,
          reference: paystackData.data.reference,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    console.error('[paystack-initialize] Unexpected error:', message)
    return new Response(
      JSON.stringify({ error: 'Payment initialization failed. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
