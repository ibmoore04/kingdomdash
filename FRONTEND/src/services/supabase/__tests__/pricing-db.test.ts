/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

describe('Phase 8 Database Pricing & Snapshot Verification (Migration 018)', () => {
  const migrationsDir = path.resolve(process.cwd(), 'supabase/migrations')
  const mig018Path = path.join(migrationsDir, '20260902000018_distance_based_delivery_pricing.sql')

  it('Migration 018 file exists and has valid header', () => {
    expect(fs.existsSync(mig018Path)).toBe(true)
    const content = fs.readFileSync(mig018Path, 'utf-8')
    expect(content).toContain('Migration: 20260902000018_distance_based_delivery_pricing.sql')
    expect(content).toContain('Phase 8 Distance-Based Delivery Pricing Engine')
  })

  describe('Section 1: Orders Snapshot Extension', () => {
    it('extends public.orders with distance_km, pricing_rule_id, and delivery_address_id', () => {
      const content = fs.readFileSync(mig018Path, 'utf-8')

      // Column additions
      expect(content).toContain('ALTER TABLE public.orders')
      expect(content).toContain('ADD COLUMN IF NOT EXISTS distance_km numeric(10,3)')
      expect(content).toContain('ADD COLUMN IF NOT EXISTS pricing_rule_id uuid REFERENCES public.delivery_pricing_rules(id) ON DELETE SET NULL')
      expect(content).toContain('ADD COLUMN IF NOT EXISTS delivery_address_id uuid REFERENCES public.addresses(id) ON DELETE SET NULL')

      // Non-negativity check
      expect(content).toContain('chk_orders_distance_km_nonneg')
      expect(content).toContain('CHECK (distance_km IS NULL OR distance_km >= 0)')

      // Indexes for performance
      expect(content).toContain('CREATE INDEX IF NOT EXISTS idx_orders_pricing_rule_id')
      expect(content).toContain('ON public.orders(pricing_rule_id)')
      expect(content).toContain('CREATE INDEX IF NOT EXISTS idx_orders_delivery_address_id')
      expect(content).toContain('ON public.orders(delivery_address_id)')
    })
  })

  describe('Section 2: calculate_delivery_fee_preview RPC', () => {
    it('implements calculate_delivery_fee_preview with secure parameters and attributes', () => {
      const content = fs.readFileSync(mig018Path, 'utf-8')

      expect(content).toContain('CREATE OR REPLACE FUNCTION public.calculate_delivery_fee_preview(')
      expect(content).toContain('p_vendor_id            uuid,')
      expect(content).toContain('p_delivery_address_id  uuid,')
      expect(content).toContain('p_service_type         service_type')
      expect(content).toContain('RETURNS jsonb')
      expect(content).toContain('LANGUAGE plpgsql')
      expect(content).toContain('STABLE')
      expect(content).toContain('SECURITY DEFINER')
      expect(content).toContain('SET search_path = public')
    })

    it('enforces authentication and caller address ownership in preview', () => {
      const content = fs.readFileSync(mig018Path, 'utf-8')

      // Authentication
      expect(content).toContain('v_user_id := auth.uid();')
      expect(content).toContain("IF v_user_id IS NULL THEN")
      expect(content).toContain("RAISE EXCEPTION 'Not authenticated';")

      // Address ownership check (profile_id = v_user_id)
      expect(content).toContain('FROM public.addresses')
      expect(content).toContain('WHERE id = p_delivery_address_id AND profile_id = v_user_id;')
      expect(content).toContain("RAISE EXCEPTION 'Delivery address not found or does not belong to the current customer';")
    })

    it('calls authoritative Haversine distance and point-in-radius serviceability in preview', () => {
      const content = fs.readFileSync(mig018Path, 'utf-8')

      expect(content).toContain('public.is_location_in_service_area(')
      expect(content).toContain('public.calculate_distance_km(')
    })

    it('enforces 4-tier deterministic pricing rule resolution in preview', () => {
      const content = fs.readFileSync(mig018Path, 'utf-8')

      // 4-tier CASE expression
      expect(content).toContain('WHEN service_type = p_service_type AND service_area_id = v_address.service_area_id THEN 1')
      expect(content).toContain('WHEN service_type = p_service_type AND service_area_id IS NULL THEN 2')
      expect(content).toContain('WHEN service_type IS NULL AND service_area_id = v_address.service_area_id THEN 3')
      expect(content).toContain('WHEN service_type IS NULL AND service_area_id IS NULL THEN 4')
      expect(content).toContain('ORDER BY')
      expect(content).toContain('tier ASC,')
      expect(content).toContain('effective_date DESC,')
      expect(content).toContain('created_at DESC')
      expect(content).toContain('LIMIT 1;')
    })

    it('applies rounding, min_fee floor, and max_fee ceiling', () => {
      const content = fs.readFileSync(mig018Path, 'utf-8')

      expect(content).toContain('v_raw_fee := v_rule.base_fee + (v_distance_km * v_rule.distance_rate);')
      expect(content).toContain('v_delivery_fee := round(v_raw_fee, 2);')
      expect(content).toContain('IF v_rule.min_fee IS NOT NULL AND v_delivery_fee < v_rule.min_fee THEN')
      expect(content).toContain('IF v_rule.max_fee IS NOT NULL AND v_delivery_fee > v_rule.max_fee THEN')
    })

    it('enforces least-privilege permissions: revoked from PUBLIC and anon, granted to authenticated', () => {
      const content = fs.readFileSync(mig018Path, 'utf-8')

      expect(content).toContain('REVOKE EXECUTE ON FUNCTION public.calculate_delivery_fee_preview(uuid, uuid, service_type) FROM PUBLIC;')
      expect(content).toContain('REVOKE EXECUTE ON FUNCTION public.calculate_delivery_fee_preview(uuid, uuid, service_type) FROM anon;')
      expect(content).toContain('GRANT  EXECUTE ON FUNCTION public.calculate_delivery_fee_preview(uuid, uuid, service_type) TO authenticated;')
    })
  })

  describe('Section 3: create_order_secure RPC Hardening', () => {
    it('drops the obsolete 6-argument version and installs the 7-argument version', () => {
      const content = fs.readFileSync(mig018Path, 'utf-8')

      expect(content).toContain('DROP FUNCTION IF EXISTS public.create_order_secure(uuid, service_type, text, text, jsonb, text);')
      expect(content).toContain('CREATE OR REPLACE FUNCTION public.create_order_secure(')
      expect(content).toContain('p_delivery_address_id  uuid DEFAULT NULL')
    })

    it('verifies customer ownership of p_delivery_address_id', () => {
      const content = fs.readFileSync(mig018Path, 'utf-8')

      expect(content).toContain("IF p_delivery_address_id IS NULL THEN")
      expect(content).toContain("RAISE EXCEPTION 'p_delivery_address_id is required for food and grocery delivery orders';")
      expect(content).toContain('FROM public.addresses')
      expect(content).toContain('WHERE id = p_delivery_address_id AND profile_id = v_user_id;')
    })

    it('enforces serviceability and coordinate presence before order placement', () => {
      const content = fs.readFileSync(mig018Path, 'utf-8')

      expect(content).toContain("IF v_address.latitude IS NULL OR v_address.longitude IS NULL THEN")
      expect(content).toContain("RAISE EXCEPTION 'Delivery address coordinates are missing. Please pin your location on the map.';")
      expect(content).toContain('IF NOT public.is_location_in_service_area(v_address.latitude, v_address.longitude, v_address.service_area_id) THEN')
      expect(content).toContain("RAISE EXCEPTION 'Delivery address is outside the active service area';")
    })

    it('snapshots distance_km, pricing_rule_id, and delivery_address_id on orders', () => {
      const content = fs.readFileSync(mig018Path, 'utf-8')

      expect(content).toContain('INSERT INTO public.orders (')
      expect(content).toContain('distance_km, pricing_rule_id, delivery_address_id')
      expect(content).toContain('v_distance_km, v_rule.id, v_address.id')
    })

    it('calculates total as subtotal + delivery_fee from server values only', () => {
      const content = fs.readFileSync(mig018Path, 'utf-8')

      expect(content).toContain('v_total := v_subtotal + v_delivery_fee;')
      expect(content).toContain('UPDATE public.orders')
      expect(content).toContain('SET subtotal = v_subtotal,')
      expect(content).toContain('total    = v_total')
    })

    it('enforces least-privilege permissions: revoked from PUBLIC and anon, granted to authenticated', () => {
      const content = fs.readFileSync(mig018Path, 'utf-8')

      expect(content).toContain('REVOKE EXECUTE ON FUNCTION public.create_order_secure(uuid, service_type, text, text, jsonb, text, uuid) FROM PUBLIC;')
      expect(content).toContain('REVOKE EXECUTE ON FUNCTION public.create_order_secure(uuid, service_type, text, text, jsonb, text, uuid) FROM anon;')
      expect(content).toContain('GRANT  EXECUTE ON FUNCTION public.create_order_secure(uuid, service_type, text, text, jsonb, text, uuid) TO authenticated;')
    })
  })
})
