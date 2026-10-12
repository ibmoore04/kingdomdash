import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'

interface InitializeRequest {
  order_id: string
  callback_url?: string
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
    const siteUrl = Deno.env.get('SITE_URL') || 'https://kingdomdash.net'

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey || !flutterwaveSecretKey) {
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

    // 3. Invoke authoritative database stored procedure: create_flutterwave_payment_attempt
    const { data: attemptData, error: attemptError } = await supabaseUserClient.rpc(
      'create_flutterwave_payment_attempt',
      { p_order_id: order_id }
    )

    if (attemptError || !attemptData) {
      const errMsg = attemptError?.message || 'Failed to create Flutterwave payment attempt'
      console.warn(`[flutterwave-initialize] create_flutterwave_payment_attempt failed for order ${order_id}:`, errMsg)

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
      tx_ref,
      amount,
      customer_email,
      customer_name,
      customer_phone,
      currency,
    } = attemptData as {
      payment_id: string
      order_id: string
      tx_ref: string
      amount: number
      currency: string
      customer_email: string
      customer_name: string
      customer_phone: string
    }

    // 4. Validate authoritative parameters
    if (!tx_ref || typeof tx_ref !== 'string' || !tx_ref.startsWith('kd_flw_')) {
      return new Response(
        JSON.stringify({ error: 'Server error: invalid Flutterwave transaction reference generated' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (currency !== 'NGN') {
      return new Response(
        JSON.stringify({ error: 'Server error: unsupported payment currency' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const resolvedEmail = customer_email || user.email
    if (!resolvedEmail || !resolvedEmail.includes('@')) {
      return new Response(
        JSON.stringify({ error: 'Customer email is required for payment processing' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 5. Call Flutterwave Standard API to initialize transaction
    const resolvedCallbackUrl = callback_url || `${siteUrl}/order/${order_id}/confirmation?gateway=flutterwave`
    const flwPayload = {
      tx_ref,
      amount,
      currency: 'NGN',
      redirect_url: resolvedCallbackUrl,
      customer: {
        email: resolvedEmail,
        phonenumber: customer_phone || '',
        name: customer_name || 'Valued Customer',
      },
      customizations: {
        title: 'KingdomDash',
        description: `Order #${order_id.slice(0, 8).toUpperCase()}`,
        logo: `${siteUrl}/logo.png`,
      },
      meta: {
        order_id,
        customer_id: user.id,
        platform: 'kingdomdash',
      },
    }

    const flwResponse = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${flutterwaveSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(flwPayload),
    })

    const flwData = await flwResponse.json().catch(() => null)

    if (!flwResponse.ok || !flwData || flwData.status !== 'success' || !flwData.data?.link) {
      console.error('[flutterwave-initialize] Flutterwave API error:', flwData?.message || flwResponse.statusText)

      // Service-role client used strictly to mark the attempt as failed in DB
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
      await supabaseAdmin
        .from('payments')
        .update({
          status: 'failed',
          gateway_response: flwData?.message || 'Flutterwave initialization failed',
          updated_at: new Date().toISOString(),
        })
        .eq('flutterwave_ref', tx_ref)

      return new Response(
        JSON.stringify({
          error: flwData?.message || 'Flutterwave payment gateway initialization failed. Please try again.',
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 6. Return safe public checkout parameters to client
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          link: flwData.data.link,
          tx_ref,
          order_id,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    console.error('[flutterwave-initialize] Unexpected error:', message)
    return new Response(
      JSON.stringify({ error: 'Payment initialization failed. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
