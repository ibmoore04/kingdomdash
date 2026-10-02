import { describe, it, expect, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import { markDeliveryDelivered } from '@/services/rider/custody-service'
import { supabase } from '@/services/supabase/client'

vi.mock('@/services/supabase/client', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn(),
  },
}))

describe('Migration 041 Security and Connectivity Hardening Verification', () => {
  const rootDir = path.resolve(__dirname, '../../../../')
  const migration041Path = path.join(
    rootDir,
    'supabase/migrations/20260902000041_security_and_connectivity_hardening.sql'
  )
  const backendMigration041Path = path.join(
    rootDir,
    'BACKEND/supabase/migrations/20260902000041_security_and_connectivity_hardening.sql'
  )

  it('1. Migration 041 files exist and are strictly synchronized across root and BACKEND', () => {
    expect(fs.existsSync(migration041Path)).toBe(true)
    expect(fs.existsSync(backendMigration041Path)).toBe(true)

    const rootContent = fs.readFileSync(migration041Path, 'utf8')
    const backendContent = fs.readFileSync(backendMigration041Path, 'utf8')
    expect(rootContent).toBe(backendContent)
  })

  it('2. SEC-01: Locks down add_dashpoints RPC and adds PostgreSQL server triggers', () => {
    const content = fs.readFileSync(migration041Path, 'utf8')

    // Revokes execution from authenticated & public
    expect(content).toContain(
      'REVOKE EXECUTE ON FUNCTION public.add_dashpoints(uuid, integer, text, text) FROM PUBLIC, anon, authenticated;'
    )
    expect(content).toContain(
      'GRANT  EXECUTE ON FUNCTION public.add_dashpoints(uuid, integer, text, text) TO service_role;'
    )

    // Checks caller authorization inside the function
    expect(content).toContain("auth.role() = 'authenticated'")
    expect(content).toContain("role IN ('admin', 'super_admin')")
    expect(content).toContain(
      "RAISE EXCEPTION 'Unauthorized to accrue DashPoints directly' USING ERRCODE = 'KD403';"
    )

    // Server-side trigger on reviews
    expect(content).toContain('CREATE TRIGGER trg_review_loyalty_points')
    expect(content).toContain('trg_award_review_dashpoints')

    // Server-side trigger on order completion
    expect(content).toContain('CREATE TRIGGER trg_order_completion_loyalty_points')
    expect(content).toContain('trg_award_order_completion_dashpoints')
  })

  it('3. SEC-02: Server-side delivery PIN verification in mark_delivery_delivered', () => {
    const content = fs.readFileSync(migration041Path, 'utf8')

    // Adds columns and auto-assignment triggers
    expect(content).toContain('ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_pin text;')
    expect(content).toContain('ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS delivery_pin text;')
    expect(content).toContain('CREATE TRIGGER trg_order_delivery_pin')
    expect(content).toContain('CREATE TRIGGER trg_delivery_pin_sync')

    // Replaces mark_delivery_delivered with PIN verification
    expect(content).toContain('CREATE OR REPLACE FUNCTION public.mark_delivery_delivered(')
    expect(content).toContain('p_pin         text DEFAULT NULL')
    expect(content).toContain('Invalid delivery confirmation PIN')
    expect(content).toContain("USING ERRCODE = 'KD403'")

    // Exposes has_delivery_pin in get_rider_active_delivery
    expect(content).toContain("'has_delivery_pin'")
  })

  it('4. SEC-03: Hardened RLS policy and unique constraint on order_reviews', () => {
    const content = fs.readFileSync(migration041Path, 'utf8')

    // Restricts reviews to verified delivered orders by the actual customer
    expect(content).toContain('CREATE POLICY "reviews_insert_customer"')
    expect(content).toContain('auth.uid() = customer_id')
    expect(content).toContain("o.status = 'delivered'")
    expect(content).toContain('o.customer_id = auth.uid()')

    // Single review constraint per order
    expect(content).toContain('CREATE UNIQUE INDEX IF NOT EXISTS idx_order_reviews_unique_order')
  })

  it('5. Frontend custody-service passes delivery PIN to mark_delivery_delivered RPC', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: null, error: null } as any)

    const res = await markDeliveryDelivered('del-test-1', 'Left at porch', '7842')
    expect(supabase.rpc).toHaveBeenCalledWith('mark_delivery_delivered', {
      p_delivery_id: 'del-test-1',
      p_notes: 'Left at porch',
      p_pin: '7842',
    })
    expect(res.success).toBe(true)
  })

  it('6. CONN-03: Canonical domain standardizations to kingdomdash.net', () => {
    const envPath = path.join(rootDir, '.env')
    const envContent = fs.readFileSync(envPath, 'utf8')
    expect(envContent).toContain('VITE_APP_URL=https://kingdomdash.net')

    const paystackFuncPath = path.join(
      rootDir,
      'supabase/functions/paystack-initialize/index.ts'
    )
    const paystackContent = fs.readFileSync(paystackFuncPath, 'utf8')
    expect(paystackContent).toContain("Deno.env.get('SITE_URL') || 'https://kingdomdash.net'")
  })
})
