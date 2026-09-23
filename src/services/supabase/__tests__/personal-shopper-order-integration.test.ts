import { describe, it, expect, vi } from 'vitest'
import { assignOrderToRider } from '../admin'
import { supabase } from '../client'
import * as fs from 'fs'
import * as path from 'path'

vi.mock('../client', () => {
  const mockFrom = vi.fn()
  const mockRpc = vi.fn()
  const mockAuth = {
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: 'admin-user-uuid-123' } },
      error: null,
    }),
  }

  return {
    supabase: {
      from: mockFrom,
      rpc: mockRpc,
      auth: mockAuth,
    },
  }
})

describe('Personal Shopper Orders Full Lifecycle & Rider Inbox Integration', () => {
  const migrationPath = path.resolve(
    __dirname,
    '../../../../supabase/migrations/20260902000037_integrate_personal_shopper_as_orders.sql'
  )

  it('verifies migration 37 defines custom service type and integrates personal shopper requests as orders and deliveries', () => {
    expect(fs.existsSync(migrationPath)).toBe(true)
    const sql = fs.readFileSync(migrationPath, 'utf8')

    // 1. Enum extension
    expect(sql).toContain("ALTER TYPE public.service_type ADD VALUE IF NOT EXISTS 'custom'")

    // 2. Schema alterations
    expect(sql).toContain('ALTER TABLE public.orders ALTER COLUMN customer_id DROP NOT NULL')
    expect(sql).toContain('ALTER TABLE public.deliveries ALTER COLUMN created_by DROP NOT NULL')
    expect(sql).toContain('ALTER TABLE public.personal_shopper_requests ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id)')

    // 3. Atomicity in submit_personal_shopper_request
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.submit_personal_shopper_request')
    expect(sql).toContain('INSERT INTO public.orders')
    expect(sql).toContain('INSERT INTO public.order_items')
    expect(sql).toContain('INSERT INTO public.deliveries')

    // 4. Authoritative assignment function
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.assign_delivery_to_rider')
    expect(sql).toContain('INSERT INTO public.delivery_assignments')
    expect(sql).toContain("UPDATE public.deliveries\n  SET status = 'assigned'")
  })

  it('assignOrderToRider creates orders, deliveries, and delivery_assignments so the rider receives the offer', async () => {
    const mockShopperId = '77777777-7777-4777-8777-777777777777'
    const mockRiderId = '88888888-8888-4888-8888-888888888888'
    const mockOrderId = '99999999-9999-4999-8999-999999999999'
    const mockDeliveryId = '11111111-1111-4111-8111-111111111111'

    const shopperRecord = {
      id: mockShopperId,
      order_id: mockOrderId,
      customer_name: 'Bisi Adeleke',
      customer_phone: '08022233344',
      delivery_address: '22 Oke-Owa, Ijebu-Ode',
      market_name: 'Oke-Aje Market',
      estimated_total: 12000,
      budget_cap: 15000,
      status: 'pending',
      items: [
        { name: 'Yam Tubers', quantity: '3 tubers', estimatedCost: 6000 },
        { name: 'Fresh Peppers', quantity: '1 bag', estimatedCost: 6000 },
      ],
    }

    const insertedRows: Record<string, any[]> = {
      delivery_assignments: [],
      notifications: [],
      deliveries: [],
      orders: [],
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      const builder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        update: vi.fn().mockImplementation((_data: any) => ({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
        insert: vi.fn().mockImplementation((data: any) => {
          if (!insertedRows[table]) insertedRows[table] = []
          insertedRows[table].push(data)
          return {
            select: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: mockDeliveryId, ...data },
                error: null,
              }),
            }),
          }
        }),
        maybeSingle: vi.fn().mockImplementation(async () => {
          if (table === 'personal_shopper_requests') return { data: shopperRecord, error: null }
          if (table === 'riders') return { data: { profile_id: 'rider-profile-uuid' }, error: null }
          if (table === 'deliveries') return { data: { id: mockDeliveryId, status: 'pending' }, error: null }
          if (table === 'orders') return { data: { id: mockOrderId, status: 'payment_confirmed' }, error: null }
          return { data: null, error: null }
        }),
      }
      return builder
    })

    vi.mocked(supabase.rpc).mockResolvedValue({ data: 'assign-uuid-ok', error: null } as any)

    const result = await assignOrderToRider(mockShopperId, mockRiderId, 'custom')

    expect(result.error).toBeNull()
    expect(result.data).toBeDefined()
    expect(result.data.orderId).toBe(mockOrderId)
    expect(result.data.deliveryId).toBe(mockDeliveryId)
    expect(result.data.riderId).toBe(mockRiderId)
    expect(result.data.status).toBe('in_transit')
  })
})
