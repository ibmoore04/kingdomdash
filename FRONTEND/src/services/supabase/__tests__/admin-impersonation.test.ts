import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { useAuthStore, type Profile } from '@/stores/auth-store'
import { supabase } from '@/services/supabase/client'

vi.mock('@/services/supabase/client', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
    auth: {
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      mfa: {
        getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({ data: { currentLevel: 'aal2' }, error: null }),
      },
    },
  },
}))

describe('Phase 2 — Admin View-As Role Impersonation Engine', () => {
  const rootMigrationPath = path.resolve(
    __dirname,
    '../../../../supabase/migrations/20261003000001_admin_impersonation_engine.sql'
  )
  const backendMigrationPath = path.resolve(
    __dirname,
    '../../../../BACKEND/supabase/migrations/20261003000001_admin_impersonation_engine.sql'
  )

  const sampleAdminProfile: Profile = {
    id: 'admin-uuid-1',
    email: 'admin@kingdomdash.com',
    full_name: 'Lead Admin',
    phone: '+2348011111111',
    avatar_url: null,
    role: 'admin',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const sampleCustomerProfile: Profile = {
    id: 'customer-uuid-2',
    email: 'customer@kingdomdash.com',
    full_name: 'Jane Customer',
    phone: '+2348022222222',
    avatar_url: null,
    role: 'customer',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    useAuthStore.setState({
      profile: sampleAdminProfile,
      session: { user: { id: 'admin-uuid-1' } } as any,
      impersonation: null,
      isImpersonating: false,
    })
  })

  // 1. Database & Migration Architecture
  it('verifies migration file exists in root and BACKEND directories and are synchronized', () => {
    expect(fs.existsSync(rootMigrationPath)).toBe(true)
    expect(fs.existsSync(backendMigrationPath)).toBe(true)
    const rootSql = fs.readFileSync(rootMigrationPath, 'utf8')
    const backendSql = fs.readFileSync(backendMigrationPath, 'utf8')
    expect(rootSql).toBe(backendSql)
  })

  it('verifies migration establishes admin_impersonation_logs with strict RLS and REVOKE boundaries', () => {
    const sql = fs.readFileSync(rootMigrationPath, 'utf8')
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.admin_impersonation_logs')
    expect(sql).toContain('action text NOT NULL CHECK (action IN (\'started\', \'ended\'))')
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY')
    expect(sql).toContain('REVOKE INSERT, UPDATE, DELETE ON public.admin_impersonation_logs FROM anon, authenticated;')
    expect(sql).toContain('GRANT SELECT ON public.admin_impersonation_logs TO authenticated;')
  })

  it('verifies admin_start_impersonation RPC enforces hierarchy and audit validation', () => {
    const sql = fs.readFileSync(rootMigrationPath, 'utf8')
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.admin_start_impersonation')
    expect(sql).toContain('A valid business reason (at least 5 characters) is strictly required')
    expect(sql).toContain('Super-admin accounts cannot be impersonated')
    expect(sql).toContain('Only super-administrators can view-as other administrators')
    expect(sql).toContain('Self-impersonation is redundant')
    expect(sql).toContain('admin_impersonation_started')
  })

  it('verifies admin_stop_impersonation RPC logs session conclusion', () => {
    const sql = fs.readFileSync(rootMigrationPath, 'utf8')
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.admin_stop_impersonation')
    expect(sql).toContain('Impersonation session concluded normally')
    expect(sql).toContain('admin_impersonation_ended')
  })

  // 2. Auth Store Impersonation State Machine
  it('startImpersonation transitions profile to target and persists session in storage', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: { success: true, log_id: 'log-123' },
      error: null,
    } as any)

    const res = await useAuthStore.getState().startImpersonation(sampleCustomerProfile, 'Support Ticket #991')

    expect(res.success).toBe(true)
    expect(supabase.rpc).toHaveBeenCalledWith('admin_start_impersonation', {
      p_target_user_id: 'customer-uuid-2',
      p_reason: 'Support Ticket #991',
    })

    const state = useAuthStore.getState()
    expect(state.isImpersonating).toBe(true)
    expect(state.profile?.id).toBe('customer-uuid-2')
    expect(state.profile?.role).toBe('customer')
    expect(state.impersonation?.originalAdminProfile.id).toBe('admin-uuid-1')

    // Stored in sessionStorage
    const stored = JSON.parse(sessionStorage.getItem('kingdomdash_impersonation_session') || '{}')
    expect(stored.targetProfile.id).toBe('customer-uuid-2')
    expect(stored.originalAdminProfile.id).toBe('admin-uuid-1')
  })

  it('stopImpersonation restores original admin profile and clears storage', async () => {
    // Start session first
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: { success: true }, error: null } as any)
    await useAuthStore.getState().startImpersonation(sampleCustomerProfile, 'Customer query')

    // End session
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: { success: true }, error: null } as any)
    const endRes = await useAuthStore.getState().stopImpersonation()

    expect(endRes.success).toBe(true)
    expect(supabase.rpc).toHaveBeenCalledWith('admin_stop_impersonation', {
      p_target_user_id: 'customer-uuid-2',
    })

    const state = useAuthStore.getState()
    expect(state.isImpersonating).toBe(false)
    expect(state.profile?.id).toBe('admin-uuid-1')
    expect(state.profile?.role).toBe('admin')
    expect(state.impersonation).toBeNull()
    expect(sessionStorage.getItem('kingdomdash_impersonation_session')).toBeNull()
  })

  it('rejects startImpersonation when called by non-administrative user', async () => {
    useAuthStore.setState({
      profile: sampleCustomerProfile,
      session: { user: { id: 'customer-uuid-2' } } as any,
    })

    const res = await useAuthStore.getState().startImpersonation(sampleAdminProfile, 'Unauthorized attempt')
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/Only administrators can impersonate roles/i)
  })
})
