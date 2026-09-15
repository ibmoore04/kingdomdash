-- Migration: 20260902000006_create_service_areas_pricing.sql
-- Creates service_areas and delivery_pricing_rules tables
-- service_type is nullable on delivery_pricing_rules — NULL means applies to all service types
-- Enables RLS on both tables

-- ============================================================
-- Table: service_areas
-- Named geographic coverage zones for service availability
-- and (future) distance-pricing lookups
-- ============================================================
CREATE TABLE IF NOT EXISTS public.service_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  coverage_polygon jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Table: delivery_pricing_rules
-- Configurable rules defining base fee, per-km rate, service
-- type, and optional date range for computing delivery fees.
-- service_type is nullable — NULL means the rule applies to
-- all service types.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.delivery_pricing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type service_type,
  base_fee numeric(12,2) NOT NULL CHECK (base_fee >= 0),
  distance_rate numeric(10,4) NOT NULL CHECK (distance_rate >= 0),
  min_fee numeric(12,2) CHECK (min_fee >= 0),
  max_fee numeric(12,2) CHECK (max_fee >= 0),
  service_area_id uuid REFERENCES public.service_areas(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  expiry_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Enable Row Level Security
-- ============================================================
ALTER TABLE public.service_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_pricing_rules ENABLE ROW LEVEL SECURITY;
