import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import {
  getLoyaltyAccount,
  fetchLoyaltyAccountFromBackend,
  syncLoyaltyToDatabase,
} from '@/services/loyalty/loyalty-service'
import { supabase } from '@/services/supabase/client'

describe('Phase 1: Authoritative Loyalty & Financial Data Hardening', () => {
  const rootMigrationPath = path.resolve(
    __dirname,
    '../../../../supabase/migrations/20261012000001_authoritative_loyalty_redemption_and_sync.sql'
  )
  const backendMigrationPath = path.resolve(
    __dirname,
    '../../../../BACKEND/supabase/migrations/20261012000001_authoritative_loyalty_redemption_and_sync.sql'
  )

  it('verifies 1:1 dual migration parity between root and BACKEND', () => {
    expect(fs.existsSync(rootMigrationPath)).toBe(true)
    expect(fs.existsSync(backendMigrationPath)).toBe(true)

    const rootSql = fs.readFileSync(rootMigrationPath, 'utf8')
    const backendSql = fs.readFileSync(backendMigrationPath, 'utf8')
    expect(rootSql).toBe(backendSql)
  })

  it('verifies redeem_dashpoints RPC contains pessimistic row-locking and ledger audit logging', () => {
    const sql = fs.readFileSync(rootMigrationPath, 'utf8')

    // 1. Function declaration with SECURITY DEFINER
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.redeem_dashpoints(')
    expect(sql).toContain('SECURITY DEFINER')
    expect(sql).toContain('SET search_path = public, pg_catalog')

    // 2. Caller authentication check
    expect(sql).toContain('v_user_id := auth.uid();')
    expect(sql).toContain('Authentication required to redeem DashPoints')

    // 3. Pessimistic row-locking to prevent race conditions
    expect(sql).toContain('FROM public.loyalty_accounts')
    expect(sql).toContain('WHERE user_id = v_user_id')
    expect(sql).toContain('FOR UPDATE;')

    // 4. Solvency verification
    expect(sql).toContain('IF v_current_balance < p_points THEN')
    expect(sql).toContain('Insufficient DashPoints balance')

    // 5. Immutable ledger insertion
    expect(sql).toContain('INSERT INTO public.loyalty_transactions (user_id, points, type, description)')
    expect(sql).toContain("-p_points, 'redeemed'")

    // 6. Security grants
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.redeem_dashpoints(integer, text) FROM PUBLIC, anon;')
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.redeem_dashpoints(integer, text) TO authenticated, service_role;')
  })

  it('verifies get_or_create_loyalty_account provisions initial welcome points securely', () => {
    const sql = fs.readFileSync(rootMigrationPath, 'utf8')

    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.get_or_create_loyalty_account(p_user_id uuid)')
    expect(sql).toContain('INSERT INTO public.loyalty_accounts (user_id, points_balance, lifetime_points, tier)')
    expect(sql).toContain("VALUES (p_user_id, 150, 150, 'Bronze')")
    expect(sql).toContain('ON CONFLICT (user_id) DO NOTHING;')
  })

  describe('Client Integration & Sync Service', () => {
    beforeEach(() => {
      localStorage.clear()
      vi.clearAllMocks()
    })

    it('returns default welcome account on first read and caches locally', () => {
      const account = getLoyaltyAccount('user-123')
      expect(account.pointsBalance).toBe(150)
      expect(account.tier).toBe('Bronze')
    })

    it('syncs loyalty account from backend RPC when available', async () => {
      const mockRpc = vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: {
          user_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          points_balance: 750,
          lifetime_points: 900,
          tier: 'Silver',
          referral_credits_ngn: 500,
          referred_count: 2,
          has_active_kd_pass: true,
          kd_pass_expiry: '2026-11-01T00:00:00Z',
        },
        error: null,
      } as any)

      const serverAccount = await fetchLoyaltyAccountFromBackend('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')
      expect(serverAccount.pointsBalance).toBe(750)
      expect(serverAccount.tier).toBe('Silver')
      expect(serverAccount.hasActiveKdPass).toBe(true)

      mockRpc.mockRestore()
    })

    it('syncLoyaltyToDatabase invokes redeem_dashpoints RPC for negative points', async () => {
      const mockRpc = vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: { success: true, points_redeemed: 200, points_balance: 550 },
        error: null,
      } as any)

      const res = await syncLoyaltyToDatabase(
        'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        -200,
        'redeemed',
        'Discount test'
      )

      expect(res.success).toBe(true)
      expect(mockRpc).toHaveBeenCalledWith('redeem_dashpoints', {
        p_points: 200,
        p_description: 'Discount test',
      })

      mockRpc.mockRestore()
    })
  })
})
