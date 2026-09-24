import { describe, it, expect, beforeEach, vi } from 'vitest'
import { supabase } from '../client'
import {
  submitSupportTicket,
  getAllSupportTickets,
  getSupportTicketByReference,
  getUserSupportTickets,
  updateSupportTicketStatus,
} from '../support'

vi.mock('../client', () => {
  const mockTickets = new Map<string, any>()
  return {
    supabase: {
      rpc: vi.fn().mockImplementation(async (method: string, params: any) => {
        if (method === 'submit_support_ticket') {
          const refCode = `KD-SUP-123456`
          const ticket = {
            id: 'mock-uuid-1',
            reference_code: refCode,
            name: params.p_name,
            email: params.p_email,
            phone: params.p_phone,
            subject: params.p_subject,
            message: params.p_message,
            category: 'general',
            status: 'new',
            created_at: new Date().toISOString(),
          }
          mockTickets.set(refCode, ticket)
          mockTickets.set('mock-uuid-1', ticket)

          return {
            data: {
              success: true,
              ticket_id: 'mock-uuid-1',
              reference_code: refCode,
              message: 'Your support request has been submitted successfully.',
            },
            error: null,
          }
        }
        if (method === 'update_support_ticket_status') {
          const existing = mockTickets.get(params.p_ticket_id) || {
            id: 'mock-uuid-1',
            reference_code: params.p_ticket_id,
            name: 'Test',
            email: 'test@example.com',
            subject: 'Subject',
            message: 'Msg',
            category: 'general',
          }
          existing.status = params.p_status
          existing.admin_response = params.p_admin_response
          mockTickets.set(params.p_ticket_id, existing)

          return {
            data: {
              success: true,
              ticket_id: existing.id,
              reference_code: existing.reference_code,
              status: params.p_status,
              admin_response: params.p_admin_response,
            },
            error: null,
          }
        }
        return { data: null, error: null }
      }),
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'contact_messages') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: Array.from(mockTickets.values()),
                error: null,
              }),
              or: vi.fn().mockImplementation(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: Array.from(mockTickets.values())[0] || null,
                  error: null,
                }),
              })),
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: Array.from(mockTickets.values())[0] || null,
                  error: null,
                }),
              }),
              ilike: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: Array.from(mockTickets.values()),
                  error: null,
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      ...Array.from(mockTickets.values())[0],
                      status: 'resolved',
                      admin_response: 'Refund credited',
                    },
                    error: null,
                  }),
                }),
              }),
              or: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      ...Array.from(mockTickets.values())[0],
                      status: 'resolved',
                      admin_response: 'Refund credited',
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          }
        }
        if (table === 'profiles' || table === 'notifications') {
          return {
            select: vi.fn().mockReturnValue({
              ilike: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'prof-1' }, error: null }),
              }),
            }),
            insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          }
        }
        return {}
      }),
    },
  }
})

describe('Supabase Support Ticket System & Reference Tracking', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('submits support ticket via Supabase RPC and returns reference code', async () => {
    const res = await submitSupportTicket({
      name: 'Oluwaseun Bakare',
      email: 'seun@example.com',
      phone: '+2348012345678',
      subject: 'Issue with delivery address',
      message: 'My order delivery pin did not match the rider location pin.',
    })

    expect(res.data?.success).toBe(true)
    expect(res.data?.reference_code).toBe('KD-SUP-123456')
    expect(supabase.rpc).toHaveBeenCalledWith('submit_support_ticket', expect.any(Object))
  })

  it('queries support tickets directly from Supabase DB contact_messages', async () => {
    const allRes = await getAllSupportTickets()
    expect(allRes.data).toBeDefined()

    const userRes = await getUserSupportTickets('seun@example.com')
    expect(userRes.data).toBeDefined()

    const refRes = await getSupportTicketByReference('KD-SUP-123456')
    expect(refRes.data).toBeDefined()
  })

  it('updates support ticket status via Supabase RPC update_support_ticket_status', async () => {
    const updateRes = await updateSupportTicketStatus(
      'KD-SUP-123456',
      'resolved',
      'Refund credited'
    )

    expect(updateRes).toBeDefined()
    expect(supabase.rpc).toHaveBeenCalledWith('update_support_ticket_status', expect.any(Object))
  })
})
