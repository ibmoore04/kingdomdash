import { supabase } from './client'

export interface CorporateLead {
  id: string
  company_name: string
  contact_name: string
  email: string
  phone: string
  address?: string | null
  business_type: string
  estimated_volume?: string | null
  notes?: string | null
  status: 'pending' | 'contacted' | 'onboarded' | 'rejected'
  created_at: string
  updated_at: string
}

export async function getUserCorporateLead(userEmail: string, userPhone?: string | null): Promise<{ data: CorporateLead | null; error: Error | null }> {
  if (!userEmail && !userPhone) {
    return { data: null, error: null }
  }

  const cleanEmail = userEmail?.trim().toLowerCase()
  const cleanPhone = userPhone?.trim()

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // 1. Try SECURITY DEFINER RPC first (bypasses RLS timing/permission gaps)
    try {
      const rpcRes = await db.rpc('get_user_corporate_lead', {
        p_email: cleanEmail || null,
        p_phone: cleanPhone || null,
      })
      if (!rpcRes.error && Array.isArray(rpcRes.data) && rpcRes.data.length > 0) {
        return { data: rpcRes.data[0] as CorporateLead, error: null }
      }
    } catch (rpcErr) {
      console.warn('[getUserCorporateLead] RPC fallback to table select:', rpcErr)
    }

    // 2. Direct table fallback query
    let query = db.from('corporate_leads').select('*')

    if (cleanEmail && cleanPhone) {
      query = query.or(`email.ilike.${cleanEmail},phone.eq.${cleanPhone}`)
    } else if (cleanEmail) {
      query = query.ilike('email', cleanEmail)
    } else if (cleanPhone) {
      query = query.eq('phone', cleanPhone)
    }

    const { data, error } = await query.order('created_at', { ascending: false }).limit(1).maybeSingle()

    if (error) {
      return { data: null, error: new Error(error.message) }
    }

    return { data: data as CorporateLead | null, error: null }
  } catch (err: unknown) {
    return { data: null, error: err instanceof Error ? err : new Error('Failed to fetch corporate lead') }
  }
}

export async function submitCorporateLeadInquiry(payload: {
  company_name: string
  contact_name: string
  email: string
  phone: string
  address?: string | null
  business_type: string
  estimated_volume?: string | null
  notes?: string | null
}): Promise<{ data: CorporateLead | null; error: Error | null }> {
  try {
    // 1. Pre-submission check: check if active lead already exists for user
    const { data: existingLead } = await getUserCorporateLead(payload.email, payload.phone)
    if (existingLead && ['pending', 'contacted', 'onboarded'].includes(existingLead.status)) {
      const msg =
        existingLead.status === 'onboarded'
          ? 'Your corporate account is already approved and onboarded!'
          : `You already have an active corporate account application under review (Status: ${existingLead.status.toUpperCase()}). Please wait for admin response.`
      return { data: existingLead, error: new Error(msg) }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // 2. Try RPC
    try {
      const rpcRes = await db.rpc('submit_corporate_lead', {
        p_company_name: payload.company_name,
        p_contact_name: payload.contact_name,
        p_email: payload.email,
        p_phone: payload.phone,
        p_address: payload.address || null,
        p_business_type: payload.business_type,
        p_estimated_volume: payload.estimated_volume || null,
        p_notes: payload.notes || null,
      })
      if (rpcRes.error) {
        return { data: null, error: new Error(rpcRes.error.message || 'Submission error') }
      }
      if (rpcRes.data) {
        return getUserCorporateLead(payload.email, payload.phone)
      }
    } catch (rpcError: any) {
      if (rpcError?.message?.includes('already exists') || rpcError?.message?.includes('KD409')) {
        return { data: existingLead, error: new Error(rpcError.message) }
      }
    }

    // 3. Direct table insert fallback
    const { data, error } = await db
      .from('corporate_leads')
      .insert({
        company_name: payload.company_name.trim(),
        contact_name: payload.contact_name.trim(),
        email: payload.email.trim().toLowerCase(),
        phone: payload.phone.trim(),
        address: payload.address?.trim() || null,
        business_type: payload.business_type,
        estimated_volume: payload.estimated_volume || null,
        notes: payload.notes?.trim() || null,
        status: 'pending',
      })
      .select()
      .maybeSingle()

    if (error) {
      return { data: null, error: new Error(error.message) }
    }

    return { data: data as CorporateLead, error: null }
  } catch (err: unknown) {
    return { data: null, error: err instanceof Error ? err : new Error('Failed to submit corporate account request') }
  }
}
