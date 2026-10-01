import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'

interface ResolveBankRequest {
  account_number: string
  bank_code: string
}

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY')

    if (!paystackSecretKey) {
      console.warn('[paystack-resolve-bank] PAYSTACK_SECRET_KEY is missing from environment secrets')
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Paystack Secret Key is not configured on the server. Please set PAYSTACK_SECRET_KEY in Supabase secrets.'
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[paystack-resolve-bank] Missing Supabase environment variables')
      return new Response(
        JSON.stringify({ error: 'Server configuration error: missing Supabase credentials' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 1. Authenticate caller session from JWT
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

    // 2. Parse and validate request parameters
    const body: ResolveBankRequest = await req.json().catch(() => ({} as ResolveBankRequest))
    const { account_number, bank_code } = body

    if (!account_number || typeof account_number !== 'string' || !/^\d{10}$/.test(account_number.trim())) {
      return new Response(
        JSON.stringify({ error: 'Invalid account number: Nigerian accounts must be 10 digits' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!bank_code || typeof bank_code !== 'string' || bank_code.trim().length < 3) {
      return new Response(
        JSON.stringify({ error: 'Invalid bank code: must be at least 3 digits' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Query Paystack Resolve API
    const cleanAccount = account_number.trim()
    const cleanBankCode = bank_code.trim()
    const resolveUrl = `https://api.paystack.co/bank/resolve?account_number=${encodeURIComponent(cleanAccount)}&bank_code=${encodeURIComponent(cleanBankCode)}`

    const paystackRes = await fetch(resolveUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json',
      },
    })

    const paystackData = await paystackRes.json()

    if (!paystackRes.ok || !paystackData.status) {
      const errorMsg = paystackData.message || 'Could not resolve account name. Please verify bank and account number.'
      return new Response(
        JSON.stringify({ success: false, error: errorMsg }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. Create or obtain Paystack transfer recipient code
    let recipientCode: string | null = null
    try {
      const recipientRes = await fetch('https://api.paystack.co/transferrecipient', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${paystackSecretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'nuban',
          name: paystackData.data.account_name,
          account_number: cleanAccount,
          bank_code: cleanBankCode,
          currency: 'NGN',
        }),
      })

      if (recipientRes.ok) {
        const recipData = await recipientRes.json()
        if (recipData.status && recipData.data?.recipient_code) {
          recipientCode = recipData.data.recipient_code
        }
      }
    } catch (recipErr) {
      console.warn('[paystack-resolve-bank] Non-blocking recipient creation error:', recipErr)
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          account_number: paystackData.data.account_number,
          account_name: paystackData.data.account_name,
          bank_id: paystackData.data.bank_id,
          recipient_code: recipientCode,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    console.error('[paystack-resolve-bank] Unexpected error:', message)
    return new Response(
      JSON.stringify({ error: 'Internal server error resolving bank account' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
