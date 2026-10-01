import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'

interface SettlementWorkerPayload {
  limit?: number
  order_id?: string
  worker_id?: string
  sync_float_only?: boolean
}

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Supabase configuration error: missing service credentials' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Verify caller is admin or service_role
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    const serviceRoleKey = (supabaseServiceKey || '').trim()
    const secretKeys = (Deno.env.get('SUPABASE_SECRET_KEYS') || '').trim()

    let isServiceRole = (token === serviceRoleKey || (secretKeys && secretKeys.includes(token)))
    if (!isServiceRole) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        if (payload.role === 'service_role' && payload.ref === 'kbrfaccrhmvgcdtdfjna') {
          isServiceRole = true
        }
      } catch {
        // Not a service_role JWT, proceed to user check
      }
    }

    if (!isServiceRole) {
      const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
      if (authErr || !user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized invocation' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // High-Assurance MFA check: if administrator has verified MFA factors, require AAL2 (§16)
      const enrolledFactors = user.factors?.filter((f: any) => f.status === 'verified') || []
      const currentAal = (user as any).aal || user.app_metadata?.aal
      if (enrolledFactors.length > 0 && currentAal && currentAal !== 'aal2') {
        return new Response(
          JSON.stringify({ error: 'Access denied: high-assurance multi-factor authentication (AAL2) required' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role, is_active')
        .eq('id', user.id)
        .single()

      if (!profile || !profile.is_active || !['super_admin', 'admin'].includes(profile.role)) {
        return new Response(
          JSON.stringify({ error: 'Access denied: active administrator privileges required' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    const body: SettlementWorkerPayload = await req.json().catch(() => ({} as SettlementWorkerPayload))
    const workerId = body.worker_id || `worker_${crypto.randomUUID().slice(0, 8)}`
    const batchLimit = Math.min(Math.max(Number(body.limit) || 10, 1), 50)

    // 1. Sync Platform Float with Paystack if secret key is present
    let polledBalanceKobo = 0
    if (paystackSecretKey) {
      try {
        const balanceRes = await fetch('https://api.paystack.co/balance', {
          headers: {
            'Authorization': `Bearer ${paystackSecretKey}`,
            'Content-Type': 'application/json',
          },
        })
        if (balanceRes.ok) {
          const balData = await balanceRes.json()
          const ngnBalance = balData.data?.find((b: any) => b.currency === 'NGN')
          if (ngnBalance) {
            polledBalanceKobo = Number(ngnBalance.balance) || 0
            await supabaseAdmin.rpc('sync_platform_float_balance', {
              p_balance_kobo: polledBalanceKobo,
              p_polled_by: workerId,
            })
          }
        }
      } catch (balErr) {
        console.warn('[settlement-worker] Float balance poll non-blocking error:', balErr)
      }
    }

    if (body.sync_float_only) {
      return new Response(
        JSON.stringify({
          success: true,
          worker_id: workerId,
          polled_balance_kobo: polledBalanceKobo,
          synced_at: new Date().toISOString(),
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Fetch pending or retry_ready settlement queue jobs
    let queueQuery = supabaseAdmin
      .from('settlement_queue')
      .select('id, order_id, attempts, max_attempts, status, scheduled_at')
      .in('status', ['pending', 'retry_ready'])
      .lte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(batchLimit)

    if (body.order_id) {
      queueQuery = supabaseAdmin
        .from('settlement_queue')
        .select('id, order_id, attempts, max_attempts, status, scheduled_at')
        .eq('order_id', body.order_id)
        .limit(1)
    }

    const { data: queueJobs, error: queueError } = await queueQuery

    if (queueError) {
      console.error('[settlement-worker] Failed to fetch queue jobs:', queueError.message)
      return new Response(
        JSON.stringify({ error: queueError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const jobResults: Array<{
      order_id: string
      status: string
      transfers_initiated: number
      details: string
    }> = []

    for (const job of queueJobs || []) {
      const orderId = job.order_id

      // Claim job with 90s worker lease
      const leaseExpires = new Date(Date.now() + 90000).toISOString()
      const { error: leaseErr } = await supabaseAdmin
        .from('settlement_queue')
        .update({
          status: 'processing',
          locked_by: workerId,
          locked_until: leaseExpires,
          last_heartbeat_at: new Date().toISOString(),
          attempts: job.attempts + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id)
        .in('status', ['pending', 'retry_ready'])

      if (leaseErr) {
        continue // Leased by concurrent worker
      }

      // Read payables for this order
      const { data: payables, error: pError } = await supabaseAdmin
        .from('order_payables')
        .select('id, recipient_type, recipient_id, net_payable_kobo, status')
        .eq('order_id', orderId)

      if (pError || !payables || payables.length === 0) {
        await supabaseAdmin
          .from('settlement_queue')
          .update({
            status: 'action_required',
            last_error: 'No order payables found for order',
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id)

        jobResults.push({
          order_id: orderId,
          status: 'action_required',
          transfers_initiated: 0,
          details: 'No payables found',
        })
        continue
      }

      let transfersInitiated = 0
      let allSettledOrOffset = true
      let encounteredHold = false
      let encounteredError = false
      let lastErrorMessage = ''

      for (const payable of payables) {
        if (['settled', 'clawback_offset'].includes(payable.status)) {
          continue
        }

        allSettledOrOffset = false

        // Check can_disburse_payable RPC
        const { data: eligibilityData, error: eligErr } = await supabaseAdmin.rpc('can_disburse_payable', {
          p_payable_id: payable.id,
        })

        if (eligErr) {
          encounteredError = true
          lastErrorMessage = eligErr.message
          continue
        }

        const eligibility = Array.isArray(eligibilityData) ? eligibilityData[0] : eligibilityData

        if (!eligibility || !eligibility.eligible) {
          const reason = eligibility?.ineligibility_reason || 'Ineligible for disbursement'
          if (reason.includes('hold') || reason.includes('cooldown')) {
            encounteredHold = true
          }
          lastErrorMessage = reason
          continue
        }

        const recipientCode = eligibility.paystack_recipient_code
        const netKobo = Number(eligibility.net_payable_kobo)

        if (!recipientCode || netKobo <= 0) {
          encounteredError = true
          lastErrorMessage = 'Invalid transfer recipient code or non-positive net payable'
          continue
        }

        // Acquire float reservation
        const { data: floatRes, error: floatErr } = await supabaseAdmin.rpc('acquire_platform_float_reservation', {
          p_worker_id: workerId,
          p_order_id: orderId,
          p_payable_id: payable.id,
          p_net_payable_kobo: netKobo,
        })

        if (floatErr || !floatRes?.success) {
          const reason = floatRes?.reason || floatErr?.message || 'Insufficient float'
          encounteredHold = true
          lastErrorMessage = `Float reservation failed: ${reason}`
          break
        }

        // Inspect existing payout transaction attempts (§4, §8)
        const { data: existingTxs } = await supabaseAdmin
          .from('payout_transactions')
          .select('id, attempt_number, transfer_reference, status, paystack_transfer_code')
          .eq('payable_id', payable.id)
          .order('attempt_number', { ascending: false })
          .limit(1)

        const latestTx = existingTxs && existingTxs.length > 0 ? existingTxs[0] : null

        // §8 In-Flight Recovery: If previous attempt is pending, verify against Paystack before re-attempting
        if (latestTx && latestTx.status === 'pending' && paystackSecretKey) {
          try {
            const verifyRes = await fetch(`https://api.paystack.co/transfer/verify/${encodeURIComponent(latestTx.transfer_reference)}`, {
              headers: {
                'Authorization': `Bearer ${paystackSecretKey}`,
                'Content-Type': 'application/json',
              },
            })
            if (verifyRes.ok) {
              const verifyData = await verifyRes.json()
              const vStatus = verifyData.data?.status
              if (vStatus === 'success') {
                await supabaseAdmin
                  .from('payout_transactions')
                  .update({
                    status: 'success',
                    paystack_transfer_code: verifyData.data?.transfer_code || latestTx.paystack_transfer_code,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', latestTx.id)

                await supabaseAdmin
                  .from('order_payables')
                  .update({ status: 'settled', settled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
                  .eq('id', payable.id)

                continue // Reconciled as settled without duplicate transfer
              } else if (vStatus === 'failed') {
                await supabaseAdmin
                  .from('payout_transactions')
                  .update({ status: 'failed', failure_reason: verifyData.data?.reason || 'Verified as failed', updated_at: new Date().toISOString() })
                  .eq('id', latestTx.id)
              }
            }
          } catch (vErr) {
            console.warn('[settlement-worker] In-flight transfer verification warning:', vErr)
          }
        }

        // Generate deterministic attempt-versioned transfer reference (§4): kd_ord_<uuid32>_<type>_v{attempt}
        const cleanOrderId = orderId.replace(/-/g, '')
        const typeAbbr = payable.recipient_type === 'vendor' ? 'vnd' : 'rdr'
        const attemptNum = (latestTx?.attempt_number || 0) + 1
        const transferRef = `kd_ord_${cleanOrderId.slice(0, 20)}_${typeAbbr}_v${attemptNum}`

        // Insert pending payout_transaction
        const { data: txRow, error: txErr } = await supabaseAdmin
          .from('payout_transactions')
          .insert({
            payable_id: payable.id,
            attempt_number: attemptNum,
            transfer_reference: transferRef,
            paystack_recipient_code: recipientCode,
            amount_kobo: netKobo,
            expected_transfer_fee_kobo: floatRes.fee_kobo || 0,
            expected_stamp_duty_kobo: floatRes.stamp_duty_kobo || 0,
            status: 'pending',
          })
          .select('id')
          .single()

        if (txErr) {
          lastErrorMessage = `Failed to create payout transaction row: ${txErr.message}`
          encounteredError = true
          continue
        }

        // Dispatch transfer to Paystack API if secret key is configured
        if (paystackSecretKey) {
          try {
            const transferPayload = {
              source: 'balance',
              amount: netKobo,
              recipient: recipientCode,
              reference: transferRef,
              reason: `KingdomDash payout: ${orderId.slice(0, 8)}`,
            }

            const transferRes = await fetch('https://api.paystack.co/transfer', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${paystackSecretKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(transferPayload),
            })

            const transferData = await transferRes.json()

            if (transferRes.ok && transferData.status) {
              const transferCode = transferData.data?.transfer_code

              await supabaseAdmin
                .from('payout_transactions')
                .update({
                  paystack_transfer_code: transferCode,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', txRow.id)

              await supabaseAdmin
                .from('order_payables')
                .update({
                  status: 'disbursing',
                  updated_at: new Date().toISOString(),
                })
                .eq('id', payable.id)

              transfersInitiated++
            } else {
              // Transfer rejection
              const failReason = transferData.message || 'Paystack transfer rejected'
              await supabaseAdmin
                .from('payout_transactions')
                .update({
                  status: 'failed',
                  failure_reason: failReason,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', txRow.id)

              encounteredError = true
              lastErrorMessage = failReason
            }
          } catch (netErr) {
            console.error('[settlement-worker] Network error initiating Paystack transfer:', netErr)
            encounteredError = true
            lastErrorMessage = netErr instanceof Error ? netErr.message : 'Network error'
          }
        } else {
          // Local/test environment without secret key: simulate disbursing status
          await supabaseAdmin
            .from('order_payables')
            .update({
              status: 'disbursing',
              updated_at: new Date().toISOString(),
            })
            .eq('id', payable.id)

          transfersInitiated++
        }
      }

      // Conclude settlement queue status
      let finalQueueStatus = 'processing'
      if (allSettledOrOffset) {
        finalQueueStatus = 'completed'
      } else if (encounteredHold) {
        finalQueueStatus = 'held_cooldown'
      } else if (encounteredError && job.attempts + 1 >= job.max_attempts) {
        finalQueueStatus = 'action_required'
      } else if (encounteredError) {
        finalQueueStatus = 'retry_ready'
      }

      await supabaseAdmin
        .from('settlement_queue')
        .update({
          status: finalQueueStatus,
          locked_by: null,
          locked_until: null,
          last_error: lastErrorMessage || null,
          completed_at: finalQueueStatus === 'completed' ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id)

      jobResults.push({
        order_id: orderId,
        status: finalQueueStatus,
        transfers_initiated: transfersInitiated,
        details: lastErrorMessage || 'Processing',
      })
    }

    return new Response(
      JSON.stringify({
        success: true,
        worker_id: workerId,
        processed_count: jobResults.length,
        results: jobResults,
        polled_balance_kobo: polledBalanceKobo,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal settlement worker error'
    console.error('[settlement-worker] Unexpected error:', message)
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
