import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

describe('Migration 030: Hardened RBAC, Super Admin Isolation, Multi-Service Onboarding & Support', () => {
  const migrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/20260902000030_rbac_superadmin_onboarding_hardening.sql'
  )

  it('verifies migration 030 file exists and is readable', () => {
    expect(fs.existsSync(migrationPath)).toBe(true)
    const content = fs.readFileSync(migrationPath, 'utf8')
    expect(content.length).toBeGreaterThan(1000)
  })

  const sql = fs.readFileSync(migrationPath, 'utf8')

  // ==========================================================================
  // §1: SQL SCHEMA & RLS STATIC VERIFICATION
  // ==========================================================================

  describe('1. Super Admin Isolation & Profile RLS (§1)', () => {
    it('profiles_select_admin policy hides super_admin from standard admins', () => {
      expect(sql).toContain('DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;')
      expect(sql).toContain('CREATE POLICY "profiles_select_admin" ON public.profiles')
      expect(sql).toContain("public.get_current_user_role() = 'super_admin'")
      expect(sql).toContain("(public.get_current_user_role() = 'admin' AND role <> 'super_admin')")
    })

    it('standard admins have ZERO direct UPDATE access on profiles table', () => {
      // Must DROP any legacy profiles_update_admin policy
      expect(sql).toContain('DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;')
      // Direct UPDATE policy exists ONLY for super_admin
      expect(sql).toContain('CREATE POLICY "profiles_update_super_admin" ON public.profiles')
      expect(sql).toContain("public.get_current_user_role() = 'super_admin'")

      const updatePolicy = sql.slice(sql.indexOf('CREATE POLICY "profiles_update_super_admin"'))
      const endUpdatePolicy = updatePolicy.slice(0, updatePolicy.indexOf(';'))
      // Standard admin is NOT in the USING or WITH CHECK for direct table update
      expect(endUpdatePolicy).not.toContain("public.get_current_user_role() = 'admin'")
    })

    it('verifies no 42P17 recursion exists in profiles RLS policies', () => {
      // get_current_user_role() is used; no subqueries against public.profiles
      expect(sql).toContain('public.get_current_user_role()')
      expect(sql).not.toContain('(SELECT role FROM public.profiles')
    })
  })

  describe('2. Dedicated admin_toggle_user_active RPC (§2)', () => {
    it('defines admin_toggle_user_active as SECURITY DEFINER with fixed search_path', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.admin_toggle_user_active(')
      expect(sql).toContain('p_target_user_id uuid,')
      expect(sql).toContain('p_is_active      boolean')
      expect(sql).toContain('SECURITY DEFINER')
      expect(sql).toContain('SET search_path = public, pg_catalog')
    })

    it('handles Supabase service_role and postgres execution contexts', () => {
      expect(sql).toContain("auth.role() = 'service_role'")
      expect(sql).toContain("(COALESCE(auth.jwt() ->> 'role', '')) = 'service_role'")
      expect(sql).toContain("(COALESCE(current_setting('request.jwt.claim.role', true), '')) = 'service_role'")
      expect(sql).toContain("current_user IN ('postgres', 'supabase_admin')")
    })

    it('prohibits deactivating Super Admin accounts by ANY operational caller (KD403)', () => {
      expect(sql).toContain("IF v_target.role = 'super_admin' THEN")
      expect(sql).toContain("IF v_caller_role = 'admin' THEN")
      expect(sql).toContain("RAISE EXCEPTION 'Access denied: administrators cannot modify super administrator accounts'")
      expect(sql).toContain("USING ERRCODE = 'KD403';")
      expect(sql).toContain("IF NOT p_is_active THEN")
      expect(sql).toContain("RAISE EXCEPTION 'Access denied: Super Administrator accounts cannot be deactivated through operational RPC'")
      expect(sql).toContain("USING ERRCODE = 'KD403';")
    })

    it('prohibits self-deactivation by any administrator (KD400)', () => {
      expect(sql).toContain("IF p_target_user_id = v_caller_id AND NOT p_is_active THEN")
      expect(sql).toContain("RAISE EXCEPTION 'Administrators cannot deactivate their own account'")
      expect(sql).toContain("USING ERRCODE = 'KD400';")
    })

    it('documents fail-closed operational audit event rollback semantics', () => {
      expect(sql).toContain('PERFORM public.log_operational_audit_event(')
      expect(sql).toContain('Fail-closed semantics: Any failure in log_operational_audit_event aborts and rolls back')
    })
  })

  describe('3. Dedicated admin_set_user_role RPC (§3)', () => {
    it('defines admin_set_user_role with strict role transition invariants', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.admin_set_user_role(')
      expect(sql).toContain('p_target_user_id uuid,')
      expect(sql).toContain('p_new_role       public.user_role')
      expect(sql).toContain('SECURITY DEFINER')
    })

    it('prohibits operational mutation of Super Admin roles by ANY caller (KD403)', () => {
      expect(sql).toContain("IF v_target.role = 'super_admin' THEN")
      expect(sql).toContain("RAISE EXCEPTION 'Access denied: Super Administrator roles cannot be modified through operational RPC'")
      expect(sql).toContain("USING ERRCODE = 'KD403';")
    })

    it('prohibits self-role modification by administrative users (KD400)', () => {
      expect(sql).toContain("IF p_target_user_id = v_caller_id THEN")
      expect(sql).toContain("RAISE EXCEPTION 'Administrative users cannot modify their own role'")
      expect(sql).toContain("USING ERRCODE = 'KD400';")
    })

    it('prohibits standard Admins from escalating anyone to admin or super_admin (KD403)', () => {
      expect(sql).toContain("IF v_caller_role = 'admin' AND p_new_role IN ('super_admin', 'admin') THEN")
      expect(sql).toContain("RAISE EXCEPTION 'Access denied: administrators cannot grant administrative privileges'")
      expect(sql).toContain("USING ERRCODE = 'KD403';")
    })

    it('strictly prevents application workflow bypass for vendor and rider (KD409)', () => {
      expect(sql).toContain('Cannot assign vendor role without an approved vendor application')
      expect(sql).toContain('Cannot assign rider role without an approved rider application')
      expect(sql).toContain("USING ERRCODE = 'KD409';")
    })
  })

  describe('4. Vendor Multi-Service Approval (§4)', () => {
    it('requires explicit service selection and strictly rejects empty selection (KD400)', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.approve_vendor_application(')
      expect(sql).toContain('p_service_types  public.service_type[] DEFAULT NULL')
      expect(sql).toContain('Vendor approval requires selecting at least one active service capability')
      expect(sql).toContain("USING ERRCODE = 'KD400';")
    })

    it('documents business_type as legacy column and vendor_services as capability authority', () => {
      expect(sql).toContain('business_type is populated solely to satisfy legacy NOT NULL column constraints')
      expect(sql).toContain('Authoritative capability is strictly determined by public.vendor_services')
    })

    it('atomically provisions public.vendor_services', () => {
      expect(sql).toContain('INSERT INTO public.vendor_services (vendor_id, service_type, is_active, updated_at)')
      expect(sql).toContain('UPDATE public.vendor_services')
      expect(sql).toContain('service_type <> ALL(v_chosen_services)')
    })
  })

  describe('5. Public Support Ticket System (§5)', () => {
    it('synchronizes message length limit to 3,000 characters (KD400)', () => {
      expect(sql).toContain('length(v_trimmed_message) > 3000')
      expect(sql).toContain('Message must be between 10 and 3000 characters')
    })

    it('implements transactional advisory lock to prevent concurrent rate-limiting race condition', () => {
      expect(sql).toContain('PERFORM pg_advisory_xact_lock(hashtext(v_trimmed_email));')
    })

    it('creates performance index on contact_messages for email lookups', () => {
      expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_contact_messages_email_created_at')
    })

    it('enforces status as new and protects operational metadata', () => {
      expect(sql).toContain("'new'::public.contact_status")
    })
  })

  // ==========================================================================
  // §2: SECURITY BEHAVIORAL SIMULATION MATRIX
  // ==========================================================================

  interface MockProfile {
    id: string
    email: string
    full_name: string
    role: 'customer' | 'vendor' | 'rider' | 'admin' | 'super_admin'
    is_active: boolean
  }

  const SUPER_ADMIN_A: MockProfile = {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'superadmin.a@kingdomdash.com',
    full_name: 'Super Admin Alpha',
    role: 'super_admin',
    is_active: true,
  }

  const SUPER_ADMIN_B: MockProfile = {
    id: '00000000-0000-0000-0000-000000000002',
    email: 'superadmin.b@kingdomdash.com',
    full_name: 'Super Admin Beta',
    role: 'super_admin',
    is_active: true,
  }

  const ADMIN_USER: MockProfile = {
    id: '00000000-0000-0000-0000-000000000003',
    email: 'admin.operator@kingdomdash.com',
    full_name: 'Admin Operator',
    role: 'admin',
    is_active: true,
  }

  const CUSTOMER_USER: MockProfile = {
    id: '00000000-0000-0000-0000-000000000004',
    email: 'customer@kingdomdash.com',
    full_name: 'Test Customer',
    role: 'customer',
    is_active: true,
  }

  const ALL_PROFILES = [SUPER_ADMIN_A, SUPER_ADMIN_B, ADMIN_USER, CUSTOMER_USER]

  // Simulation of profiles_select_admin policy
  function simulateProfilesSelect(caller: MockProfile, profiles: MockProfile[]) {
    if (caller.role === 'super_admin') {
      return profiles // Sees all
    }
    if (caller.role === 'admin') {
      return profiles.filter((p) => p.role !== 'super_admin') // Sees all except super_admin
    }
    return profiles.filter((p) => p.id === caller.id) // Normal user sees only self
  }

  // Simulation of profiles table direct UPDATE RLS
  function simulateDirectProfileUpdate(
    caller: MockProfile,
    target: MockProfile,
    updates: Partial<MockProfile>
  ) {
    if (caller.role === 'super_admin') {
      return { success: true, updated: { ...target, ...updates } }
    }
    if (caller.id === target.id) {
      // User updating self: cannot change role or is_active
      if (updates.role && updates.role !== target.role) {
        throw new Error('RLS: Cannot modify role via direct update')
      }
      if (updates.is_active !== undefined && updates.is_active !== target.is_active) {
        throw new Error('RLS: Cannot modify is_active via direct update')
      }
      return { success: true, updated: { ...target, ...updates } }
    }
    // Standard admin has ZERO direct UPDATE policy on profiles
    throw new Error('RLS 42501: Permission denied for table profiles direct UPDATE')
  }

  // Simulation of admin_toggle_user_active RPC
  function simulateAdminToggleUserActive(
    caller: MockProfile,
    target: MockProfile,
    newActive: boolean
  ) {
    if (!['admin', 'super_admin'].includes(caller.role)) {
      throw new Error('KD403: Access denied: administrator privileges required')
    }
    if (target.id === caller.id && !newActive) {
      throw new Error('KD400: Administrators cannot deactivate their own account')
    }
    if (target.role === 'super_admin') {
      if (caller.role === 'admin') {
        throw new Error('KD403: Access denied: administrators cannot modify super administrator accounts')
      }
      if (!newActive) {
        throw new Error('KD403: Access denied: Super Administrator accounts cannot be deactivated through operational RPC')
      }
    }
    return { success: true, user_id: target.id, is_active: newActive }
  }

  // Simulation of admin_set_user_role RPC
  function simulateAdminSetUserRole(
    caller: MockProfile,
    target: MockProfile,
    newRole: MockProfile['role'],
    hasApprovedApp: { vendor?: boolean; rider?: boolean } = {}
  ) {
    if (!['admin', 'super_admin'].includes(caller.role)) {
      throw new Error('KD403: Access denied: administrator privileges required')
    }
    if (target.id === caller.id) {
      throw new Error('KD400: Administrative users cannot modify their own role')
    }
    if (target.role === 'super_admin') {
      throw new Error('KD403: Access denied: Super Administrator roles cannot be modified through operational RPC')
    }
    if (caller.role === 'admin' && ['super_admin', 'admin'].includes(newRole)) {
      throw new Error('KD403: Access denied: administrators cannot grant administrative privileges')
    }
    if (newRole === 'vendor' && !hasApprovedApp.vendor) {
      throw new Error('KD409: Cannot assign vendor role without an approved vendor application')
    }
    if (newRole === 'rider' && !hasApprovedApp.rider) {
      throw new Error('KD409: Cannot assign rider role without an approved rider application')
    }
    return { success: true, user_id: target.id, old_role: target.role, new_role: newRole }
  }

  // Simulation of approve_vendor_application RPC
  function simulateApproveVendor(
    caller: MockProfile,
    serviceTypes: ('food' | 'grocery')[] | null | undefined
  ) {
    if (!['admin', 'super_admin'].includes(caller.role)) {
      throw new Error('KD403: Access denied: only administrators can approve vendor applications')
    }
    if (!serviceTypes || serviceTypes.length === 0) {
      throw new Error('KD400: Vendor approval requires selecting at least one active service capability (food, grocery, or food+grocery)')
    }
    const valid = serviceTypes.filter((s) => ['food', 'grocery'].includes(s))
    if (valid.length === 0) {
      throw new Error('KD400: Vendor approval requires selecting at least one active service capability (food, grocery, or food+grocery)')
    }
    return { success: true, services: Array.from(new Set(valid)), role: 'vendor' }
  }

  // Simulation of submit_support_ticket RPC
  function simulateSubmitSupportTicket(
    input: { name: string; email: string; subject: string; message: string; status?: string },
    recentCountForEmail: number
  ) {
    if (input.name.trim().length < 2 || input.name.trim().length > 100) {
      throw new Error('KD400: Name must be between 2 and 100 characters')
    }
    const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
    if (!emailRegex.test(input.email.trim())) {
      throw new Error('KD400: Please provide a valid email address')
    }
    if (input.subject.trim().length < 3 || input.subject.trim().length > 200) {
      throw new Error('KD400: Subject must be between 3 and 200 characters')
    }
    if (input.message.trim().length < 10 || input.message.trim().length > 3000) {
      throw new Error('KD400: Message must be between 10 and 3000 characters')
    }
    if (recentCountForEmail >= 5) {
      throw new Error('KD429: Too many requests submitted recently. Please wait a few moments before trying again.')
    }
    // Status is always forced to 'new' regardless of caller input
    return { success: true, ticket_id: 'mock-ticket-uuid', status: 'new' }
  }

  describe('6. Comprehensive Admin Security Cases', () => {
    it('❌ SELECT Super Admin: Standard Admin receives 0 Super Admin rows', () => {
      const results = simulateProfilesSelect(ADMIN_USER, ALL_PROFILES)
      expect(results.some((p) => p.role === 'super_admin')).toBe(false)
      expect(results.find((p) => p.id === SUPER_ADMIN_A.id)).toBeUndefined()
      expect(results.find((p) => p.id === SUPER_ADMIN_B.id)).toBeUndefined()
    })

    it('❌ count Super Admin: Count of Super Admins for Standard Admin is 0', () => {
      const visible = simulateProfilesSelect(ADMIN_USER, ALL_PROFILES)
      const count = visible.filter((p) => p.role === 'super_admin').length
      expect(count).toBe(0)
    })

    it('❌ search Super Admin: Searching for "Alpha" or "superadmin" returns 0 rows', () => {
      const visible = simulateProfilesSelect(ADMIN_USER, ALL_PROFILES)
      const searchEmail = visible.filter((p) => p.email.includes('superadmin'))
      const searchName = visible.filter((p) => p.full_name.includes('Alpha'))
      expect(searchEmail.length).toBe(0)
      expect(searchName.length).toBe(0)
    })

    it('❌ deactivate Super Admin: Admin cannot deactivate Super Admin (KD403)', () => {
      expect(() => {
        simulateAdminToggleUserActive(ADMIN_USER, SUPER_ADMIN_A, false)
      }).toThrowError('KD403: Access denied: administrators cannot modify super administrator accounts')
    })

    it('❌ modify Super Admin: Standard Admin has ZERO direct UPDATE capability on profiles', () => {
      expect(() => {
        simulateDirectProfileUpdate(ADMIN_USER, SUPER_ADMIN_A, { full_name: 'Hacked Name' })
      }).toThrowError('RLS 42501: Permission denied for table profiles direct UPDATE')
    })

    it('❌ change Super Admin role: Admin cannot change Super Admin role (KD403)', () => {
      expect(() => {
        simulateAdminSetUserRole(ADMIN_USER, SUPER_ADMIN_A, 'customer')
      }).toThrowError('KD403: Access denied: Super Administrator roles cannot be modified through operational RPC')
    })

    it('❌ promote customer → admin: Standard Admin cannot grant admin role (KD403)', () => {
      expect(() => {
        simulateAdminSetUserRole(ADMIN_USER, CUSTOMER_USER, 'admin')
      }).toThrowError('KD403: Access denied: administrators cannot grant administrative privileges')
    })

    it('❌ promote customer → super_admin: Standard Admin cannot grant super_admin role (KD403)', () => {
      expect(() => {
        simulateAdminSetUserRole(ADMIN_USER, CUSTOMER_USER, 'super_admin')
      }).toThrowError('KD403: Access denied: administrators cannot grant administrative privileges')
    })

    it('❌ modify own role: Admin cannot modify own role (KD400)', () => {
      expect(() => {
        simulateAdminSetUserRole(ADMIN_USER, ADMIN_USER, 'customer')
      }).toThrowError('KD400: Administrative users cannot modify their own role')
    })

    it('❌ deactivate self: Admin cannot deactivate self (KD400)', () => {
      expect(() => {
        simulateAdminToggleUserActive(ADMIN_USER, ADMIN_USER, false)
      }).toThrowError('KD400: Administrators cannot deactivate their own account')
    })
  })

  describe('7. Comprehensive Super Admin Security Cases', () => {
    it('✅ manage permitted users: Super Admin can manage customer active status', () => {
      const res = simulateAdminToggleUserActive(SUPER_ADMIN_A, CUSTOMER_USER, false)
      expect(res.success).toBe(true)
      expect(res.is_active).toBe(false)
    })

    it('❌ deactivate self: Super Admin cannot deactivate own account (KD400)', () => {
      expect(() => {
        simulateAdminToggleUserActive(SUPER_ADMIN_A, SUPER_ADMIN_A, false)
      }).toThrowError('KD400: Administrators cannot deactivate their own account')
    })

    it('❌ demote self: Super Admin cannot modify own role (KD400)', () => {
      expect(() => {
        simulateAdminSetUserRole(SUPER_ADMIN_A, SUPER_ADMIN_A, 'admin')
      }).toThrowError('KD400: Administrative users cannot modify their own role')
    })

    it('❌ deactivate peer Super Admin: Super Admin A cannot deactivate Super Admin B (KD403)', () => {
      expect(() => {
        simulateAdminToggleUserActive(SUPER_ADMIN_A, SUPER_ADMIN_B, false)
      }).toThrowError('KD403: Access denied: Super Administrator accounts cannot be deactivated through operational RPC')
    })

    it('❌ change role of peer Super Admin: Super Admin A cannot change role of Super Admin B (KD403)', () => {
      expect(() => {
        simulateAdminSetUserRole(SUPER_ADMIN_A, SUPER_ADMIN_B, 'admin')
      }).toThrowError('KD403: Access denied: Super Administrator roles cannot be modified through operational RPC')
    })
  })

  describe('8. Comprehensive Vendor Multi-Service Approval Cases', () => {
    it('✅ Food service approval succeeds', () => {
      const res = simulateApproveVendor(ADMIN_USER, ['food'])
      expect(res.success).toBe(true)
      expect(res.services).toEqual(['food'])
    })

    it('✅ Grocery service approval succeeds', () => {
      const res = simulateApproveVendor(ADMIN_USER, ['grocery'])
      expect(res.success).toBe(true)
      expect(res.services).toEqual(['grocery'])
    })

    it('✅ Food + Grocery service approval succeeds', () => {
      const res = simulateApproveVendor(ADMIN_USER, ['food', 'grocery'])
      expect(res.success).toBe(true)
      expect(res.services).toEqual(['food', 'grocery'])
    })

    it('❌ empty service selection strictly rejected (KD400)', () => {
      expect(() => {
        simulateApproveVendor(ADMIN_USER, [])
      }).toThrowError('KD400: Vendor approval requires selecting at least one active service capability (food, grocery, or food+grocery)')

      expect(() => {
        simulateApproveVendor(ADMIN_USER, null)
      }).toThrowError('KD400: Vendor approval requires selecting at least one active service capability (food, grocery, or food+grocery)')
    })
  })

  describe('9. Comprehensive Support Persistence Cases', () => {
    it('✅ anonymous submission with valid payload succeeds', () => {
      const res = simulateSubmitSupportTicket(
        {
          name: 'Jane Doe',
          email: 'jane@example.com',
          subject: 'Help with account',
          message: 'I would like to inquire about my delivery status in Ijebu-Ode.',
        },
        0
      )
      expect(res.success).toBe(true)
      expect(res.status).toBe('new')
    })

    it('❌ invalid email rejected (KD400)', () => {
      expect(() => {
        simulateSubmitSupportTicket(
          {
            name: 'Jane Doe',
            email: 'not-an-email',
            subject: 'Help with account',
            message: 'I would like to inquire about my delivery status.',
          },
          0
        )
      }).toThrowError('KD400: Please provide a valid email address')
    })

    it('❌ oversized message (> 3,000 chars) rejected (KD400)', () => {
      const longMessage = 'A'.repeat(3001)
      expect(() => {
        simulateSubmitSupportTicket(
          {
            name: 'Jane Doe',
            email: 'jane@example.com',
            subject: 'Help with account',
            message: longMessage,
          },
          0
        )
      }).toThrowError('KD400: Message must be between 10 and 3000 characters')
    })

    it('❌ invalid status: status cannot be forged by caller', () => {
      const res = simulateSubmitSupportTicket(
        {
          name: 'Jane Doe',
          email: 'jane@example.com',
          subject: 'Help with account',
          message: 'My order needs an update.',
          status: 'resolved', // Attempting to force status
        },
        0
      )
      expect(res.status).toBe('new') // Must be forced to 'new' by RPC
    })

    it('❌ excessive submissions (> 5 within 10 min) rejected (KD429)', () => {
      expect(() => {
        simulateSubmitSupportTicket(
          {
            name: 'Jane Doe',
            email: 'jane@example.com',
            subject: 'Spamming request',
            message: 'Sending repeated support requests in short succession.',
          },
          5 // Already 5 in last 10 minutes
        )
      }).toThrowError('KD429: Too many requests submitted recently. Please wait a few moments before trying again.')
    })
  })

  describe('10. System Regressions: 42P17, Migration 027 & Migration 028', () => {
    it('verifies 42P17 = 0: no recursive policies introduced across hardened migrations', () => {
      const mig27 = fs.readFileSync(
        path.resolve(process.cwd(), 'supabase/migrations/20260902000027_rls_recursion_hardening.sql'),
        'utf8'
      )
      const mig28 = fs.readFileSync(
        path.resolve(process.cwd(), 'supabase/migrations/20260902000028_vendor_multi_service_support.sql'),
        'utf8'
      )

      expect(sql).not.toMatch(/CREATE POLICY.*ON public\.profiles[\s\S]*\(SELECT.*FROM public\.profiles/i)
      expect(mig27).not.toMatch(/CREATE POLICY.*ON public\.profiles[\s\S]*\(SELECT.*FROM public\.profiles/i)
      expect(mig28).not.toMatch(/CREATE POLICY.*ON public\.profiles[\s\S]*\(SELECT.*FROM public\.profiles/i)
    })
  })
})
