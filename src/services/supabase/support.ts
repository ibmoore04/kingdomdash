import { supabase } from './client'

export interface SupportTicketPayload {
  name: string
  email: string
  phone?: string
  subject: string
  message: string
  category?: string
}

export interface SupportTicketResponse {
  success: boolean
  ticket_id?: string
  reference_code?: string
  message?: string
}

export interface SupportTicket {
  id: string
  reference_code: string
  name: string
  email: string
  phone?: string | null
  category: string
  subject: string
  message: string
  status: 'new' | 'in_progress' | 'resolved' | 'closed'
  admin_response?: string | null
  admin_responded_at?: string | null
  created_at: string
  updated_at: string
}

export interface GetSupportTicketsOptions {
  status?: string
  category?: string
  search?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

/**
 * Submit support ticket via Supabase RPC / contact_messages table
 */
export async function submitSupportTicket(
  payload: SupportTicketPayload
): Promise<{ data: SupportTicketResponse | null; error: Error | null }> {
  try {
    const trimmedName = payload.name.trim()
    const trimmedEmail = payload.email.trim().toLowerCase()
    const trimmedPhone = payload.phone?.trim() || null
    const trimmedSubject = payload.subject.trim()
    const trimmedMessage = payload.message.trim()

    // 1. Primary path: Call Supabase RPC submit_support_ticket
    const { data: rpcRes, error: rpcError } = await db.rpc('submit_support_ticket', {
      p_name: trimmedName,
      p_email: trimmedEmail,
      p_phone: trimmedPhone,
      p_subject: trimmedSubject,
      p_message: trimmedMessage,
    })

    if (!rpcError && rpcRes && rpcRes.success) {
      return {
        data: {
          success: true,
          ticket_id: rpcRes.ticket_id || rpcRes.reference_code,
          reference_code: rpcRes.reference_code || rpcRes.ticket_id,
          message: rpcRes.message || 'Support request submitted successfully.',
        },
        error: null,
      }
    }

    // 2. Direct Supabase insert fallback if RPC not installed
    const refCode = `KD-SUP-${Math.floor(100000 + Math.random() * 900000)}`
    let category = payload.category || 'general'
    const subjectMatch = trimmedSubject.match(/^\[(.*?)\]\s*(.*)$/)
    if (subjectMatch) {
      category = subjectMatch[1].toLowerCase()
    }

    const { data: insertData, error: insertError } = await db
      .from('contact_messages')
      .insert({
        name: trimmedName,
        email: trimmedEmail,
        phone: trimmedPhone,
        subject: trimmedSubject,
        message: trimmedMessage,
        category,
        reference_code: refCode,
        status: 'new',
      })
      .select('id, reference_code')
      .single()

    if (insertError) {
      return {
        data: null,
        error: new Error(insertError.message || 'Failed to submit support request'),
      }
    }

    return {
      data: {
        success: true,
        ticket_id: insertData.id || refCode,
        reference_code: insertData.reference_code || refCode,
        message: 'Your support request has been submitted successfully.',
      },
      error: null,
    }
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Network error submitting support request'),
    }
  }
}

/**
 * Get all support tickets directly from Supabase DB contact_messages table
 */
export async function getAllSupportTickets(
  options?: GetSupportTicketsOptions
): Promise<{ data: SupportTicket[]; error: Error | null }> {
  try {
    let query = db.from('contact_messages').select('*').order('created_at', { ascending: false })

    if (options?.status && options.status !== 'all') {
      query = query.eq('status', options.status)
    }

    if (options?.category && options.category !== 'all') {
      query = query.ilike('category', options.category)
    }

    if (options?.search && options.search.trim() !== '') {
      const q = `%${options.search.trim().toLowerCase()}%`
      query = query.or(
        `reference_code.ilike.${q},email.ilike.${q},name.ilike.${q},subject.ilike.${q},message.ilike.${q}`
      )
    }

    const { data, error } = await query

    if (error) {
      return { data: [], error: new Error(error.message) }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tickets: SupportTicket[] = (data || []).map((row: any) => ({
      id: String(row.id),
      reference_code: row.reference_code || `KD-SUP-${String(row.id).slice(0, 6).toUpperCase()}`,
      name: String(row.name || 'Anonymous'),
      email: String(row.email || ''),
      phone: row.phone ? String(row.phone) : null,
      category: row.category || 'general',
      subject: String(row.subject || 'Support Ticket'),
      message: String(row.message || ''),
      status: (row.status || 'new') as SupportTicket['status'],
      admin_response: row.admin_response || null,
      admin_responded_at: row.admin_responded_at || null,
      created_at: String(row.created_at || new Date().toISOString()),
      updated_at: String(row.updated_at || new Date().toISOString()),
    }))

    return { data: tickets, error: null }
  } catch (err) {
    return { data: [], error: err instanceof Error ? err : new Error('Failed to fetch support tickets') }
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Track/lookup a specific support ticket by Reference Code or UUID ID from Supabase
 */
export async function getSupportTicketByReference(
  refCodeOrId: string
): Promise<{ data: SupportTicket | null; error: Error | null }> {
  if (!refCodeOrId || !refCodeOrId.trim()) {
    return { data: null, error: new Error('Reference code is required') }
  }

  const cleanQuery = refCodeOrId.trim()
  const isUuid = UUID_REGEX.test(cleanQuery)

  try {
    // 1. Primary path: SECURITY DEFINER RPC get_support_ticket_by_ref
    const { data: rpcData, error: rpcErr } = await db.rpc('get_support_ticket_by_ref', {
      p_ref_code: cleanQuery,
    })

    if (!rpcErr && rpcData) {
      const ticket: SupportTicket = {
        id: String(rpcData.id),
        reference_code: rpcData.reference_code || `KD-SUP-${String(rpcData.id).slice(0, 6).toUpperCase()}`,
        name: String(rpcData.name || 'Anonymous'),
        email: String(rpcData.email || ''),
        phone: rpcData.phone ? String(rpcData.phone) : null,
        category: rpcData.category || 'general',
        subject: String(rpcData.subject || 'Support Ticket'),
        message: String(rpcData.message || ''),
        status: (rpcData.status || 'new') as SupportTicket['status'],
        admin_response: rpcData.admin_response || null,
        admin_responded_at: rpcData.admin_responded_at || null,
        created_at: String(rpcData.created_at || new Date().toISOString()),
        updated_at: String(rpcData.updated_at || new Date().toISOString()),
      }
      return { data: ticket, error: null }
    }

    // 2. Fallback table query
    let query = db.from('contact_messages').select('*')
    if (isUuid) {
      query = query.or(`reference_code.eq.${cleanQuery},id.eq.${cleanQuery}`)
    } else {
      query = query.eq('reference_code', cleanQuery)
    }

    const { data, error } = await query.maybeSingle()

    if (error) {
      return { data: null, error: new Error(error.message) }
    }

    if (!data) {
      // Fallback search via getAllSupportTickets
      const { data: all } = await getAllSupportTickets({ search: cleanQuery })
      const match = all.find(
        (t) =>
          t.reference_code.toLowerCase() === cleanQuery.toLowerCase() ||
          t.id.toLowerCase() === cleanQuery.toLowerCase()
      )
      if (!match) {
        return { data: null, error: new Error(`No support ticket found for reference "${refCodeOrId}"`) }
      }
      return { data: match, error: null }
    }

    const ticket: SupportTicket = {
      id: String(data.id),
      reference_code: data.reference_code || `KD-SUP-${String(data.id).slice(0, 6).toUpperCase()}`,
      name: String(data.name || 'Anonymous'),
      email: String(data.email || ''),
      phone: data.phone ? String(data.phone) : null,
      category: data.category || 'general',
      subject: String(data.subject || 'Support Ticket'),
      message: String(data.message || ''),
      status: (data.status || 'new') as SupportTicket['status'],
      admin_response: data.admin_response || null,
      admin_responded_at: data.admin_responded_at || null,
      created_at: String(data.created_at || new Date().toISOString()),
      updated_at: String(data.updated_at || new Date().toISOString()),
    }

    return { data: ticket, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error('Lookup error') }
  }
}

/**
 * Get all support tickets submitted by a specific user email directly from Supabase
 */
export async function getUserSupportTickets(
  email?: string
): Promise<{ data: SupportTicket[]; error: Error | null }> {
  if (!email || !email.trim()) {
    return getAllSupportTickets()
  }

  const cleanEmail = email.trim().toLowerCase()

  try {
    const { data, error } = await db
      .from('contact_messages')
      .select('*')
      .ilike('email', cleanEmail)
      .order('created_at', { ascending: false })

    if (error) {
      return getAllSupportTickets({ search: cleanEmail })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tickets: SupportTicket[] = (data || []).map((row: any) => ({
      id: String(row.id),
      reference_code: row.reference_code || `KD-SUP-${String(row.id).slice(0, 6).toUpperCase()}`,
      name: String(row.name || 'Anonymous'),
      email: String(row.email || ''),
      phone: row.phone ? String(row.phone) : null,
      category: row.category || 'general',
      subject: String(row.subject || 'Support Ticket'),
      message: String(row.message || ''),
      status: (row.status || 'new') as SupportTicket['status'],
      admin_response: row.admin_response || null,
      admin_responded_at: row.admin_responded_at || null,
      created_at: String(row.created_at || new Date().toISOString()),
      updated_at: String(row.updated_at || new Date().toISOString()),
    }))

    return { data: tickets, error: null }
  } catch (err) {
    return { data: [], error: err instanceof Error ? err : new Error('Failed to fetch user support tickets') }
  }
}

/**
 * Update support ticket status and admin response directly in Supabase DB contact_messages table
 */
export async function updateSupportTicketStatus(
  ticketIdOrRef: string,
  status: 'new' | 'in_progress' | 'resolved' | 'closed',
  adminResponse?: string
): Promise<{ data: SupportTicket | null; error: Error | null }> {
  try {
    const cleanQuery = ticketIdOrRef.trim()
    const nowIso = new Date().toISOString()
    const isUuid = UUID_REGEX.test(cleanQuery)

    // 1. Primary path: RPC call update_support_ticket_status
    try {
      const { data: rpcRes, error: rpcError } = await db.rpc('update_support_ticket_status', {
        p_ticket_id: cleanQuery,
        p_status: status,
        p_admin_response: adminResponse ? adminResponse.trim() : null,
      })

      if (!rpcError && rpcRes && rpcRes.success) {
        const { data: updatedRecord } = await getSupportTicketByReference(cleanQuery)
        return { data: updatedRecord, error: null }
      }
    } catch {
      // Fall through to table update
    }

    // 2. Direct table update fallback
    let updateQuery = db
      .from('contact_messages')
      .update({
        status,
        admin_response: adminResponse ? adminResponse.trim() : undefined,
        admin_responded_at: adminResponse ? nowIso : undefined,
        updated_at: nowIso,
      })

    if (isUuid) {
      updateQuery = updateQuery.or(`reference_code.eq.${cleanQuery},id.eq.${cleanQuery}`)
    } else {
      updateQuery = updateQuery.eq('reference_code', cleanQuery)
    }

    const { error: updateErr } = await updateQuery

    if (updateErr) {
      return { data: null, error: new Error(updateErr.message) }
    }

    // Re-query updated record
    const { data: updatedTicket } = await getSupportTicketByReference(cleanQuery)

    // Notify user via Supabase notifications table
    if (updatedTicket) {
      try {
        const { data: userProfile } = await db
          .from('profiles')
          .select('id, role')
          .ilike('email', updatedTicket.email)
          .maybeSingle()

        if (userProfile?.id) {
          const userRole = userProfile.role || 'customer'
          const actionUrl =
            userRole === 'vendor'
              ? `/vendor?tab=support&ref=${updatedTicket.reference_code}`
              : userRole === 'rider'
              ? `/rider/support?ref=${updatedTicket.reference_code}`
              : `/dashboard?tab=support&ref=${updatedTicket.reference_code}`

          const statusTitle =
            status === 'resolved'
              ? `Support Ticket Resolved (${updatedTicket.reference_code})`
              : status === 'in_progress'
              ? `Support Ticket Under Review (${updatedTicket.reference_code})`
              : status === 'closed'
              ? `Support Ticket Closed (${updatedTicket.reference_code})`
              : `Support Ticket Updated (${updatedTicket.reference_code})`

          const statusMsg = adminResponse
            ? `Official response for ticket ${updatedTicket.reference_code}: "${adminResponse}"`
            : `Your support request (${updatedTicket.reference_code}) status has been updated to "${status.replace('_', ' ').toUpperCase()}".`

          await db.from('notifications').insert({
            profile_id: userProfile.id,
            title: statusTitle,
            message: statusMsg,
            type: 'info',
            action_url: actionUrl,
          })
        }
      } catch {
        // Notification insert failure does not break ticket update
      }
    }

    return { data: updatedTicket, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error('Failed to update support ticket') }
  }
}
