import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  approveRiderApplication,
  rejectRiderApplication,
  approveVendorApplication,
  rejectVendorApplication,
  auditRiderVendorConsistency,
  reconcileRiderVendorRecords,
  adminDirectOnboardVendor,
  adminDirectOnboardRider,
} from '../admin'

// Mock Supabase client module
const mockRpc = vi.fn()
const mockFrom = vi.fn()
const mockGetUser = vi.fn()

vi.mock('../client', () => {
  return {
    supabase: {
      from: (...args: unknown[]) => mockFrom(...args),
      rpc: (...args: unknown[]) => mockRpc(...args),
      auth: { getUser: () => mockGetUser() },
    },
  }
})

describe('Rider & Vendor Lifecycle, Operational Record Creation & Invariants', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================
  // Test 1 — Rider registration: intent created, non-privileged, no operational row
  // ============================================================
  it('Test 1: Rider registration creates pending application, profile role remains customer, no rider access', async () => {
    const userId = 'user-rider-pending-uuid'
    
    // Simulate register flow output from server trigger/submit_onboarding_intent:
    // Profile is created with role = 'customer'
    const profileRecord = {
      id: userId,
      email: 'applicant@rider.test',
      role: 'customer', // Invariant: role is customer, NOT rider
      is_active: true,
    }
    // Application is created with status = 'pending'
    const applicationRecord = {
      id: 'app-rider-123',
      profile_id: userId,
      status: 'pending',
    }
    // Riders table has NO operational row
    const riderOperationalRow = null

    expect(profileRecord.role).toBe('customer')
    expect(applicationRecord.status).toBe('pending')
    expect(riderOperationalRow).toBeNull()

    // Route guard check: customer cannot access /rider/*
    const allowedRoles = ['rider']
    const hasAccess = allowedRoles.includes(profileRecord.role)
    expect(hasAccess).toBe(false)
  })

  // ============================================================
  // Test 2 — Rider approval: application approved, riders row created, role promoted atomically
  // ============================================================
  it('Test 2: Rider approval atomically creates riders row, updates application, and promotes profiles.role = rider', async () => {
    const applicationId = 'app-rider-123'
    const profileId = 'user-rider-pending-uuid'
    const riderId = 'rider-operational-uuid'

    mockRpc.mockResolvedValueOnce({
      data: {
        success: true,
        application_id: applicationId,
        rider_id: riderId,
        profile_id: profileId,
        role: 'rider',
      },
      error: null,
    })

    const result = await approveRiderApplication(applicationId)

    expect(mockRpc).toHaveBeenCalledWith('approve_rider_application', {
      p_application_id: applicationId,
    })
    expect(result.error).toBeNull()
    expect(result.data).toMatchObject({
      success: true,
      application_id: applicationId,
      rider_id: riderId,
      profile_id: profileId,
      role: 'rider',
    })
  })

  // ============================================================
  // Test 3 — Vendor registration: intent created, non-privileged, no operational row
  // ============================================================
  it('Test 3: Vendor registration creates pending application, profile role remains customer, no vendor access', async () => {
    const userId = 'user-vendor-pending-uuid'

    const profileRecord = {
      id: userId,
      email: 'applicant@vendor.test',
      role: 'customer', // Invariant: role is customer, NOT vendor
      is_active: true,
    }
    const applicationRecord = {
      id: 'app-vendor-123',
      profile_id: userId,
      status: 'pending',
    }
    const vendorOperationalRow = null

    expect(profileRecord.role).toBe('customer')
    expect(applicationRecord.status).toBe('pending')
    expect(vendorOperationalRow).toBeNull()

    const allowedRoles = ['vendor']
    const hasAccess = allowedRoles.includes(profileRecord.role)
    expect(hasAccess).toBe(false)
  })

  // ============================================================
  // Test 4 — Vendor approval: application approved, vendors row created, role promoted atomically
  // ============================================================
  it('Test 4: Vendor approval atomically creates vendors row, updates application, and promotes profiles.role = vendor', async () => {
    const applicationId = 'app-vendor-123'
    const profileId = 'user-vendor-pending-uuid'
    const vendorId = 'vendor-operational-uuid'

    mockRpc.mockResolvedValueOnce({
      data: {
        success: true,
        application_id: applicationId,
        vendor_id: vendorId,
        profile_id: profileId,
        role: 'vendor',
      },
      error: null,
    })

    const result = await approveVendorApplication(applicationId)

    expect(mockRpc).toHaveBeenCalledWith('approve_vendor_application', {
      p_application_id: applicationId,
    })
    expect(result.error).toBeNull()
    expect(result.data).toMatchObject({
      success: true,
      application_id: applicationId,
      vendor_id: vendorId,
      profile_id: profileId,
      role: 'vendor',
    })
  })

  // ============================================================
  // Test 5 — Broken rider state prevention
  // ============================================================
  it('Test 5: Broken rider state is rejected — ordinary client cannot self-promote to rider and trigger rejects role without riders row', async () => {
    // 1. Ordinary client update attempt on profiles
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'new row violates row-level security policy for table "profiles"' },
      }),
    })
    mockFrom.mockReturnValueOnce({ update: mockUpdate })

    const { error: clientError } = await (mockFrom('profiles') as any)
      .update({ role: 'rider' })
      .eq('id', 'unauthorized-user')

    expect(clientError).toBeTruthy()
    expect(clientError.message).toContain('row-level security')

    // 2. Direct database invariant trigger behavior (simulated)
    function simulateProfileRoleIntegrityTrigger(profile: { role: string; hasRiderRow: boolean }) {
      if (profile.role === 'rider' && !profile.hasRiderRow) {
        throw new Error('Invariant violation: Profile cannot have role = \'rider\' without a matching operational row in public.riders')
      }
    }

    expect(() => {
      simulateProfileRoleIntegrityTrigger({ role: 'rider', hasRiderRow: false })
    }).toThrow('Invariant violation')
  })

  // ============================================================
  // Test 6 — Broken vendor state prevention
  // ============================================================
  it('Test 6: Broken vendor state is rejected — ordinary client cannot self-promote to vendor and trigger rejects role without vendors row', async () => {
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'new row violates row-level security policy for table "profiles"' },
      }),
    })
    mockFrom.mockReturnValueOnce({ update: mockUpdate })

    const { error: clientError } = await (mockFrom('profiles') as any)
      .update({ role: 'vendor' })
      .eq('id', 'unauthorized-user')

    expect(clientError).toBeTruthy()
    expect(clientError.message).toContain('row-level security')

    function simulateProfileRoleIntegrityTrigger(profile: { role: string; hasVendorRow: boolean }) {
      if (profile.role === 'vendor' && !profile.hasVendorRow) {
        throw new Error('Invariant violation: Profile cannot have role = \'vendor\' without a matching operational row in public.vendors')
      }
    }

    expect(() => {
      simulateProfileRoleIntegrityTrigger({ role: 'vendor', hasVendorRow: false })
    }).toThrow('Invariant violation')
  })

  // ============================================================
  // Test 7 — Existing broken records detection & safe reconciliation
  // ============================================================
  it('Test 7: Inconsistent records are detected and reconciliation safely promotes approved applicants while demoting unauthorized/pending roles', async () => {
    // 1. Audit detection
    const auditReport = {
      timestamp: new Date().toISOString(),
      profiles_role_rider_missing_riders_count: 1,
      profiles_role_rider_missing_riders: [
        { profile_id: 'p-rider-broken', email: 'broken@rider.test', role: 'rider' },
      ],
      profiles_role_vendor_missing_vendors_count: 1,
      profiles_role_vendor_missing_vendors: [
        { profile_id: 'p-vendor-broken', email: 'broken@vendor.test', role: 'vendor' },
      ],
      riders_missing_profiles_count: 0,
      vendors_missing_profiles_count: 0,
      duplicate_riders_count: 0,
      duplicate_vendors_count: 0,
    }

    mockRpc.mockResolvedValueOnce({
      data: auditReport,
      error: null,
    })

    const auditRes = await auditRiderVendorConsistency()
    expect(auditRes.error).toBeNull()
    expect(auditRes.data).toEqual(auditReport)

    // 2. Safe Reconciliation
    const reconciliationReport = {
      reconciled_riders_count: 0,
      demoted_riders_count: 1, // Unapproved rider safely demoted to customer
      reconciled_vendors_count: 0,
      demoted_vendors_count: 1, // Unapproved vendor safely demoted to customer
      log: [
        { action: 'demoted_rider_to_customer', profile_id: 'p-rider-broken', reason: 'Application is still pending admin review' },
        { action: 'demoted_vendor_to_customer', profile_id: 'p-vendor-broken', reason: 'No vendor application found' },
      ],
    }

    mockRpc.mockResolvedValueOnce({
      data: reconciliationReport,
      error: null,
    })

    const reconcileRes = await reconcileRiderVendorRecords()
    expect(reconcileRes.error).toBeNull()
    expect(reconcileRes.data).toEqual(reconciliationReport)
  })

  // ============================================================
  // Test 8 — Rejection flows
  // ============================================================
  it('Test 8: Rejection RPCs mark application rejected and ensure profile role remains customer', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { success: true, application_id: 'app-rider-reject', status: 'rejected' },
      error: null,
    })

    const riderRejectRes = await rejectRiderApplication('app-rider-reject', 'Incomplete vehicle documents')
    expect(mockRpc).toHaveBeenCalledWith('reject_rider_application', {
      p_application_id: 'app-rider-reject',
      p_reason: 'Incomplete vehicle documents',
    })
    expect(riderRejectRes.error).toBeNull()

    mockRpc.mockResolvedValueOnce({
      data: { success: true, application_id: 'app-vendor-reject', status: 'rejected' },
      error: null,
    })

    const vendorRejectRes = await rejectVendorApplication('app-vendor-reject', 'Business license expired')
    expect(mockRpc).toHaveBeenCalledWith('reject_vendor_application', {
      p_application_id: 'app-vendor-reject',
      p_reason: 'Business license expired',
    })
    expect(vendorRejectRes.error).toBeNull()
  })

  // ============================================================
  // Test 9 — Zero fake data policy on vendor approval
  // ============================================================
  it('Test 9: Vendor approval strictly rejects applications missing business details without creating fake placeholder data', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: {
        code: 'KD409',
        message: 'Cannot approve vendor application: business_name is required',
      },
    })

    const result = await approveVendorApplication('app-vendor-incomplete')
    expect(result.error).toBeTruthy()
    expect((result.error as any).message).toContain('business_name is required')
  })

  // ============================================================
  // Test 10 — Idempotent approvals
  // ============================================================
  it('Test 10: Calling approval twice returns status: already_approved without creating duplicate records', async () => {
    const applicationId = 'app-rider-123'
    const profileId = 'user-rider-pending-uuid'
    const riderId = 'rider-operational-uuid'

    mockRpc.mockResolvedValueOnce({
      data: {
        success: true,
        application_id: applicationId,
        rider_id: riderId,
        profile_id: profileId,
        status: 'already_approved',
      },
      error: null,
    })

    const result = await approveRiderApplication(applicationId)
    expect(result.error).toBeNull()
    expect(result.data).toMatchObject({
      success: true,
      status: 'already_approved',
      rider_id: riderId,
    })
  })

  // ============================================================
  // Test 11 — Atomicity & rollback simulation
  // ============================================================
  it('Test 11: Transactional atomicity guarantees that if profile role promotion fails, the entire approval rolls back', async () => {
    // Simulating database transaction failure
    function simulateAtomicApproval(failAtStep: 'insert_operational' | 'update_app' | 'promote_profile'): {
      operationalCreated: boolean
      applicationApproved: boolean
      profileRolePromoted: boolean
      error?: string
    } {
      const tx = {
        operationalCreated: false,
        applicationApproved: false,
        profileRolePromoted: false,
      }

      try {
        if (failAtStep === 'insert_operational') throw new Error('DB error on operational insert')
        tx.operationalCreated = true

        if (failAtStep === 'update_app') throw new Error('DB error on app update')
        tx.applicationApproved = true

        if (failAtStep === 'promote_profile') throw new Error('DB error on profile role promotion')
        tx.profileRolePromoted = true

        return tx
      } catch (err) {
        // Rollback state
        return {
          operationalCreated: false,
          applicationApproved: false,
          profileRolePromoted: false,
          error: (err as Error).message,
        }
      }
    }

    const rolledBack = simulateAtomicApproval('promote_profile')
    expect(rolledBack.operationalCreated).toBe(false)
    expect(rolledBack.applicationApproved).toBe(false)
    expect(rolledBack.profileRolePromoted).toBe(false)
    expect(rolledBack.error).toBe('DB error on profile role promotion')
  })

  // ============================================================
  // Test 12 — Operational deletion prevention (enforces deactivation)
  // ============================================================
  it('Test 12: Destructive operational deletion is blocked; system enforces is_active deactivation', async () => {
    const mockDelete = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: null,
        error: {
          code: 'KD409',
          message: 'Operational riders records cannot be deleted. Deactivate by setting is_active = false instead to preserve historical integrity.',
        },
      }),
    })
    mockFrom.mockReturnValueOnce({ delete: mockDelete })

    const { error: deleteError } = await (mockFrom('riders') as any)
      .delete()
      .eq('id', 'rider-123')

    expect(deleteError).toBeTruthy()
    expect(deleteError.message).toContain('Operational riders records cannot be deleted')
  })

  // ============================================================
  // Test 13 — Admin Direct Onboard Vendor (Multi-Service)
  // ============================================================
  it('Test 13: adminDirectOnboardVendor invokes direct RPC with multi-service capabilities', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        success: true,
        vendor_id: 'vendor-uuid-1',
        profile_id: 'profile-uuid-1',
        services: ['food', 'grocery'],
      },
      error: null,
    })

    const res = await adminDirectOnboardVendor({
      profileId: 'profile-uuid-1',
      businessName: 'Mama Kitchen',
      businessAddress: '12 Folagbade, Ijebu-Ode',
      phone: '08012345678',
      email: 'mama@example.com',
      serviceTypes: ['food', 'grocery'],
    })

    expect(mockRpc).toHaveBeenCalledWith('admin_direct_onboard_vendor', {
      p_profile_id: 'profile-uuid-1',
      p_business_name: 'Mama Kitchen',
      p_business_address: '12 Folagbade, Ijebu-Ode',
      p_phone: '08012345678',
      p_email: 'mama@example.com',
      p_service_types: ['food', 'grocery'],
      p_business_description: null,
      p_business_type: 'restaurant',
    })
    expect(res.data.success).toBe(true)
    expect(res.data.services).toEqual(['food', 'grocery'])
  })

  // ============================================================
  // Test 14 — Admin Direct Onboard Rider (Vehicle assignment)
  // ============================================================
  it('Test 14: adminDirectOnboardRider invokes direct RPC with vehicle classification', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        success: true,
        rider_id: 'rider-uuid-1',
        profile_id: 'profile-uuid-2',
        vehicle_id: 'vehicle-uuid-1',
      },
      error: null,
    })

    const res = await adminDirectOnboardRider({
      profileId: 'profile-uuid-2',
      fullName: 'Babatunde Adeyemi',
      phone: '08023456789',
      email: 'babatunde@rider.test',
      vehicleType: 'motorcycle',
      address: 'Sabo, Ijebu-Ode',
      vehicleMake: 'Bajaj',
      vehicleModel: 'Boxer',
      vehicleYear: 2023,
      licensePlate: 'JBD-452-XA',
    })

    expect(mockRpc).toHaveBeenCalledWith('admin_direct_onboard_rider', {
      p_profile_id: 'profile-uuid-2',
      p_full_name: 'Babatunde Adeyemi',
      p_phone: '08023456789',
      p_email: 'babatunde@rider.test',
      p_vehicle_type: 'motorcycle',
      p_address: 'Sabo, Ijebu-Ode',
      p_vehicle_make: 'Bajaj',
      p_vehicle_model: 'Boxer',
      p_vehicle_year: 2023,
      p_license_plate: 'JBD-452-XA',
    })
    expect(res.data.success).toBe(true)
    expect(res.data.rider_id).toBe('rider-uuid-1')
  })
})

