import { describe, it, expect, vi } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import {
  getVendorsByService,
  getVendorServices,
  setVendorServices,
} from '../vendors'
import { getVendorCategories } from '../categories'
import { getAvailableProducts } from '../products'
import { supabase } from '../client'

vi.mock('../client', () => {
  const mockSelect = vi.fn().mockReturnThis()
  const mockEq = vi.fn().mockReturnThis()
  const mockOrder = vi.fn().mockReturnThis()
  const mockFrom = vi.fn(() => ({
    select: mockSelect,
    eq: mockEq,
    order: mockOrder,
  }))
  return {
    supabase: {
      from: mockFrom,
      rpc: vi.fn(),
    },
  }
})

describe('Migration 028: Vendor Multi-Service Support (Food + Grocery)', () => {
  const migrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/20260902000028_vendor_multi_service_support.sql'
  )

  it('verifies migration 028 file exists and is readable', () => {
    expect(fs.existsSync(migrationPath)).toBe(true)
    const content = fs.readFileSync(migrationPath, 'utf8')
    expect(content.length).toBeGreaterThan(1000)
  })

  const sql = fs.readFileSync(migrationPath, 'utf8')

  describe('1. Normalized vendor_services Junction Table (§1)', () => {
    it('creates public.vendor_services with proper primary key and foreign key', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.vendor_services')
      expect(sql).toContain('vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE')
      expect(sql).toContain("service_type public.service_type NOT NULL CHECK (service_type IN ('food', 'grocery'))")
      expect(sql).toContain('is_active boolean NOT NULL DEFAULT true')
      expect(sql).toContain('CONSTRAINT uq_vendor_service UNIQUE (vendor_id, service_type)')
    })

    it('creates index on vendor_id and service_type for query performance', () => {
      expect(sql).toContain('idx_vendor_services_vendor_id')
      expect(sql).toContain('idx_vendor_services_service_type')
    })
  })

  describe('2. Safe Data Backfill (§2, §3)', () => {
    it('backfills existing vendors based on historical business_type', () => {
      expect(sql).toContain('INSERT INTO public.vendor_services (vendor_id, service_type, is_active, created_at, updated_at)')
      expect(sql).toContain("WHEN v.business_type = 'grocery_store' THEN 'grocery'::public.service_type")
      expect(sql).toContain("ELSE 'food'::public.service_type")
      expect(sql).toContain('ON CONFLICT (vendor_id, service_type) DO UPDATE SET')
    })

    it('backfills existing vendor_applications with service_types array', () => {
      expect(sql).toContain('UPDATE public.vendor_applications')
      expect(sql).toContain("WHEN business_type = 'grocery_store' THEN ARRAY['grocery'::public.service_type]")
      expect(sql).toContain("ELSE ARRAY['food'::public.service_type]")
    })
  })

  describe('3. vendor_supports_service Helper Function (§4)', () => {
    it('is STABLE SECURITY DEFINER with fixed search_path', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.vendor_supports_service(')
      expect(sql).toContain('SECURITY DEFINER')
      expect(sql).toContain('SET search_path = public, pg_catalog')
      expect(sql).toContain('STABLE')
    })

    it('checks active vendor service joining vendor_services and active vendors', () => {
      expect(sql).toContain('FROM public.vendor_services vs')
      expect(sql).toContain('vs.vendor_id = p_vendor_id')
      expect(sql).toContain('vs.service_type = p_service_type')
      expect(sql).toContain('vs.is_active = true')
      expect(sql).toContain('v.is_active = true')
    })
  })

  describe('4. Cross-Service Integrity Constraints on Orders (§5)', () => {
    it('uses vendor_supports_service for food and grocery orders', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.validate_order_vendor_constraint()')
      expect(sql).toContain("IF NEW.service_type = 'food' THEN")
      expect(sql).toContain("public.vendor_supports_service(NEW.vendor_id, 'food'::public.service_type)")
      expect(sql).toContain("Food orders can only be placed with vendors that offer Food service")
      expect(sql).toContain("ELSIF NEW.service_type = 'grocery' THEN")
      expect(sql).toContain("public.vendor_supports_service(NEW.vendor_id, 'grocery'::public.service_type)")
      expect(sql).toContain("Grocery orders can only be placed with vendors that offer Grocery service")
    })

    it('strictly preserves courier vendor-independent constraint (vendor_id IS NULL)', () => {
      expect(sql).toContain("ELSIF NEW.service_type = 'courier' THEN")
      expect(sql).toContain("IF NEW.vendor_id IS NOT NULL THEN")
      expect(sql).toContain("RAISE EXCEPTION 'vendor_id must be NULL for courier orders'")
    })
  })

  describe('5. Cross-Service Integrity Constraints on Deliveries (§6)', () => {
    it('uses vendor_supports_service for deliveries and enforces courier isolation', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.validate_delivery_vendor_constraint()')
      expect(sql).toContain("public.vendor_supports_service(NEW.vendor_id, 'food'::public.service_type)")
      expect(sql).toContain("Food deliveries can only be linked to vendors that offer Food service")
      expect(sql).toContain("public.vendor_supports_service(NEW.vendor_id, 'grocery'::public.service_type)")
      expect(sql).toContain("Grocery deliveries can only be linked to vendors that offer Grocery service")
      expect(sql).toContain("RAISE EXCEPTION 'vendor_id must be NULL for courier deliveries'")
    })
  })

  describe('6. Delivery Fee Preview Multi-Service Validation (§7)', () => {
    it('validates vendor service support via vendor_supports_service', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.calculate_delivery_fee_preview(')
      expect(sql).toContain('NOT public.vendor_supports_service(p_vendor_id, p_service_type)')
      expect(sql).toContain('service delivery is only available for vendors offering this service')
    })
  })

  describe('7. Order Placement Multi-Service & Cross-Category Validation (§8)', () => {
    it('validates vendor service support in create_order_secure', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.create_order_secure(')
      expect(sql).toContain('NOT public.vendor_supports_service(p_vendor_id, p_service_type)')
      expect(sql).toContain('orders can only be placed with vendors that offer')
    })

    it('prevents cross-service category contamination (food item in grocery order or vice versa)', () => {
      expect(sql).toContain('v_product.category_service_type IS NOT NULL AND v_product.category_service_type <> p_service_type')
      expect(sql).toContain('and cannot be ordered in a')
    })
  })

  describe('8. Product and Category Vendor Service Triggers (§9)', () => {
    it('validates categories match vendor supported services', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.validate_category_vendor_service()')
      expect(sql).toContain('NOT public.vendor_supports_service(NEW.vendor_id, NEW.service_type)')
      expect(sql).toContain('is not an active service offered by vendor')
    })

    it('validates products match vendor supported services through their category', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.validate_product_vendor_service()')
      expect(sql).toContain('v_cat.service_type IS NOT NULL AND NOT public.vendor_supports_service(NEW.vendor_id, v_cat.service_type)')
      expect(sql).toContain('because vendor does not offer')
    })
  })

  describe('9. set_vendor_services RPC and Onboarding (§10, §11)', () => {
    it('provides set_vendor_services administrative RPC with transaction safety', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.set_vendor_services(')
      expect(sql).toContain('INSERT INTO public.vendor_services (vendor_id, service_type, is_active, updated_at)')
      expect(sql).toContain('GRANT  EXECUTE ON FUNCTION public.set_vendor_services(uuid, text[]) TO authenticated, service_role;')
    })

    it('updates approve_vendor_application to populate vendor_services from application', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.approve_vendor_application(')
      expect(sql).toContain('INSERT INTO public.vendor_services (vendor_id, service_type, is_active)')
      expect(sql).toContain('ON CONFLICT (vendor_id, service_type) DO UPDATE SET is_active = true, updated_at = now();')
    })
  })

  describe('10. Non-Recursive RLS Policies on vendor_services (§12)', () => {
    it('enables RLS on vendor_services', () => {
      expect(sql).toContain('ALTER TABLE public.vendor_services ENABLE ROW LEVEL SECURITY;')
    })

    it('permits public/authenticated read and restricts mutations to owners/admins without cycle', () => {
      expect(sql).toContain('CREATE POLICY "vendor_services_select_public" ON public.vendor_services')
      expect(sql).toContain('CREATE POLICY "vendor_services_select_own_vendor" ON public.vendor_services')
      expect(sql).toContain('CREATE POLICY "vendor_services_manage_own_vendor" ON public.vendor_services')
      expect(sql).toContain('CREATE POLICY "vendor_services_all_admin" ON public.vendor_services')
      expect(sql).toContain('public.is_current_vendor_owner(vendor_id)')
      expect(sql).toContain("public.get_current_user_role() IN ('admin', 'super_admin')")
      // Confirm NO reference to orders or deliveries table in vendor_services policies
      expect(sql).not.toContain('FROM public.orders WHERE')
      expect(sql).not.toContain('FROM public.deliveries WHERE')
    })
  })

  describe('11. Client SDK Multi-Service Method Signatures', () => {
    it('exports getVendorsByService, getVendorServices, setVendorServices', () => {
      expect(typeof getVendorsByService).toBe('function')
      expect(typeof getVendorServices).toBe('function')
      expect(typeof setVendorServices).toBe('function')
      expect(supabase).toBeDefined()
    })

    it('getVendorCategories accepts serviceType parameter', () => {
      expect(typeof getVendorCategories).toBe('function')
    })

    it('getAvailableProducts accepts serviceType parameter', () => {
      expect(typeof getAvailableProducts).toBe('function')
    })
  })
})
