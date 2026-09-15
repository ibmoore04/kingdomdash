import { supabase } from './client'

export interface SupportTicketPayload {
  name: string
  email: string
  phone?: string
  subject: string
  message: string
}

export interface SupportTicketResponse {
  success: boolean
  ticket_id?: string
  message?: string
}

// Scaffold compatibility: cast to any until npm run db:types is executed with live DB.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export async function submitSupportTicket(
  payload: SupportTicketPayload
): Promise<{ data: SupportTicketResponse | null; error: Error | null }> {
  try {
    const { data, error } = await db.rpc('submit_support_ticket', {
      p_name: payload.name.trim(),
      p_email: payload.email.trim(),
      p_phone: payload.phone?.trim() || null,
      p_subject: payload.subject.trim(),
      p_message: payload.message.trim(),
    })

    if (error) {
      return { data: null, error: new Error(error.message || 'Failed to submit support request') }
    }

    return { data: data as unknown as SupportTicketResponse, error: null }
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Network error submitting support request'),
    }
  }
}
