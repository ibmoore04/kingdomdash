import { describe, it, expect, vi } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { createCourierOrderSecure } from '../orders'
import { supabase } from '../client'

vi.mock('../client', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}))

describe('Migration 026: Multi-Service Architecture Alignment & Runtime Verification', () => {
  const migrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/20260902000026_multi_service_architecture_alignment.sql'
  )

  it('verifies migration 026 file exists and is readable', () => {
    expect(fs.existsSync(migrationPath)).toBe(true)
    const content = fs.readFileSync(migrationPath, 'utf8')
    expect(content.length).toBeGreaterThan(500)
  })

  const sql = fs.readFileSync(migrationPath, 'utf8')

  describe('1. Runtime Payment Confirmation Trigger Fix (§1)', () => {
    it('queries profiles.phone instead of non-existent profiles.phone_number', () => {
      expect(sql).toContain('SELECT full_name, phone')
      expect(sql).toContain('FROM public.profiles')
      expect(sql).not.toContain('SELECT full_name, phone_number')
    })

    it('queries vendors.business_name instead of non-existent vendors.name', () => {
      expect(sql).toContain('SELECT business_name INTO v_vendor_name')
      expect(sql).toContain('FROM public.vendors')
      expect(sql).not.toContain('SELECT name INTO v_vendor_name')
    })

    it('retains server-authoritative timestamps, addresses, and delivery creation logic', () => {
      expect(sql).toContain('NEW.confirmed_at := pg_catalog.now()')
      expect(sql).toContain('INSERT INTO public.deliveries')
      expect(sql).toContain('COALESCE(NEW.pickup_contact, v_vendor_name, \'Sender\')')
    })
  })

  describe('2. Cross-Service Integrity Constraints on Orders (§2)', () => {
    it('requires vendor_id and restaurant business_type for food orders', () => {
      expect(sql).toContain("IF NEW.service_type = 'food' THEN")
      expect(sql).toContain("RAISE EXCEPTION 'vendor_id is required for food orders'")
      expect(sql).toContain("business_type = 'restaurant'")
      expect(sql).toContain("Food orders can only be placed with restaurant vendors")
    })

    it('requires vendor_id and grocery_store business_type for grocery orders', () => {
      expect(sql).toContain("ELSIF NEW.service_type = 'grocery' THEN")
      expect(sql).toContain("RAISE EXCEPTION 'vendor_id is required for grocery orders'")
      expect(sql).toContain("business_type = 'grocery_store'")
      expect(sql).toContain("Grocery orders can only be placed with grocery store vendors")
    })

    it('strictly forbids vendor_id for courier orders', () => {
      expect(sql).toContain("ELSIF NEW.service_type = 'courier' THEN")
      expect(sql).toContain("IF NEW.vendor_id IS NOT NULL THEN")
      expect(sql).toContain("RAISE EXCEPTION 'vendor_id must be NULL for courier orders'")
    })
  })

  describe('3. Cross-Service Integrity Constraints on Deliveries (§3)', () => {
    it('enforces identical service-to-vendor constraints on deliveries table', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.validate_delivery_vendor_constraint()')
      expect(sql).toContain("Food deliveries can only be linked to restaurant vendors")
      expect(sql).toContain("Grocery deliveries can only be linked to grocery store vendors")
      expect(sql).toContain("RAISE EXCEPTION 'vendor_id must be NULL for courier deliveries'")
    })
  })

  describe('4. Cross-Service Vendor Validation in calculate_delivery_fee_preview (§4)', () => {
    it('verifies vendor business_type matches service_type before pricing calculations', () => {
      expect(sql).toContain("IF p_service_type = 'food' AND v_vendor.business_type <> 'restaurant' THEN")
      expect(sql).toContain("Food service delivery is only available for restaurant vendors")
      expect(sql).toContain("IF p_service_type = 'grocery' AND v_vendor.business_type <> 'grocery_store' THEN")
      expect(sql).toContain("Grocery service delivery is only available for grocery store vendors")
    })

    it('grants execute to authenticated users and revokes from public and anon', () => {
      expect(sql).toContain('REVOKE EXECUTE ON FUNCTION public.calculate_delivery_fee_preview(uuid, uuid, service_type) FROM PUBLIC;')
      expect(sql).toContain('REVOKE EXECUTE ON FUNCTION public.calculate_delivery_fee_preview(uuid, uuid, service_type) FROM anon;')
      expect(sql).toContain('GRANT  EXECUTE ON FUNCTION public.calculate_delivery_fee_preview(uuid, uuid, service_type) TO authenticated;')
    })
  })

  describe('5. Cross-Service Vendor Validation in create_order_secure (§5)', () => {
    it('rejects cross-service mismatches inside order placement transaction', () => {
      expect(sql).toContain("IF p_service_type = 'food' AND v_vendor.business_type <> 'restaurant' THEN")
      expect(sql).toContain("Food orders can only be placed with restaurant vendors")
      expect(sql).toContain("IF p_service_type = 'grocery' AND v_vendor.business_type <> 'grocery_store' THEN")
      expect(sql).toContain("Grocery orders can only be placed with grocery vendors")
    })
  })

  describe('6. Courier Client Service Layer', () => {
    it('createCourierOrderSecure transmits authorized parameters without vendor_id', async () => {
      const mockRpc = vi.mocked(supabase.rpc).mockResolvedValue({
        data: { order_id: 'courier-123', total: 1500 },
        error: null,
      } as any)

      const courierPayload = {
        pickupAddress: '10 Awujale St, Ijebu-Ode',
        pickupContact: 'Bisi Sender',
        pickupPhone: '+2348011111111',
        pickupLat: 6.820556,
        pickupLon: 3.920833,
        deliveryAddress: '24 Folagbade St, Ijebu-Ode',
        deliveryContact: 'Tunde Recipient',
        deliveryPhone: '+2348022222222',
        deliveryLat: 6.824000,
        deliveryLon: 3.925000,
        idempotencyKey: 'test-key-123',
        specialInstructions: 'Handle parcel with care',
      }

      await createCourierOrderSecure(courierPayload)

      expect(mockRpc).toHaveBeenCalledTimes(1)
      const [rpcName, rpcParams] = mockRpc.mock.calls[0]
      expect(rpcName).toBe('create_courier_order_secure')
      expect(rpcParams).toEqual({
        p_pickup_address: '10 Awujale St, Ijebu-Ode',
        p_pickup_contact: 'Bisi Sender',
        p_pickup_phone: '+2348011111111',
        p_pickup_lat: 6.820556,
        p_pickup_lon: 3.920833,
        p_delivery_address: '24 Folagbade St, Ijebu-Ode',
        p_delivery_contact: 'Tunde Recipient',
        p_delivery_phone: '+2348022222222',
        p_delivery_lat: 6.824000,
        p_delivery_lon: 3.925000,
        p_idempotency_key: 'test-key-123',
        p_special_instructions: 'Handle parcel with care',
      })

      // Zero vendor_id transmitted for courier dispatch!
      expect((rpcParams as any).p_vendor_id).toBeUndefined()
    })
  })

  describe('7. Vendor Profile Editability & Secure RPC (§6)', () => {
    it('migration 026 removes business_name restriction from protect_vendor_immutable_fields', () => {
      // business_type and email must still be protected
      expect(sql).toContain("IF NEW.business_type IS DISTINCT FROM OLD.business_type THEN")
      expect(sql).toContain("IF NEW.email IS DISTINCT FROM OLD.email THEN")
      // business_name restriction must NOT be present in section 6
      const section6Idx = sql.indexOf('§6  VENDOR PROFILE EDITABILITY')
      const section6Sql = sql.slice(section6Idx)
      expect(section6Sql).not.toContain("NEW.business_name IS DISTINCT FROM OLD.business_name")
    })

    it('migration 026 defines update_vendor_profile_secure RPC with ownership checks', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.update_vendor_profile_secure(')
      expect(sql).toContain("v_vendor.profile_id != v_caller_id AND (v_caller_role IS NULL OR v_caller_role NOT IN ('admin', 'super_admin'))")
      expect(sql).toContain('GRANT  EXECUTE ON FUNCTION public.update_vendor_profile_secure')
    })
  })
})

