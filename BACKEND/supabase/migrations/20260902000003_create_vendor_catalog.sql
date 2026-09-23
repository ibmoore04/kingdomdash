-- Migration: 20260902000003_create_vendor_catalog.sql
-- Creates reference_categories, vendors, categories, products tables
-- Two-table category design: reference_categories (global) + categories (vendor-specific)
-- Enables RLS on all four tables and adds performance indexes

-- ============================================================
-- Table 1: reference_categories
-- Global lookup table — no vendor_id column, seeded once
-- ============================================================
CREATE TABLE IF NOT EXISTS public.reference_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  service_type service_type NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true
);

-- ============================================================
-- Table 2: vendors
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  business_name text NOT NULL,
  business_type business_type NOT NULL,
  business_description text,
  business_address text NOT NULL,
  phone text NOT NULL,
  email text NOT NULL,
  logo_url text,
  cover_image_url text,
  operating_hours jsonb,
  service_area text,
  is_active boolean NOT NULL DEFAULT true,
  rating numeric(3,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Table 3: categories
-- Vendor-specific categories with optional reference link
-- ============================================================
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  name text NOT NULL,
  reference_category_id uuid REFERENCES public.reference_categories(id) ON DELETE SET NULL,
  service_type service_type,
  description text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Table 4: products
-- ============================================================
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  image_url text,
  is_available boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Enable Row Level Security on all four tables
-- ============================================================
ALTER TABLE public.reference_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Performance indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_vendors_profile_id ON public.vendors(profile_id);
CREATE INDEX IF NOT EXISTS idx_vendors_business_type ON public.vendors(business_type);
CREATE INDEX IF NOT EXISTS idx_vendors_is_active ON public.vendors(is_active);
CREATE INDEX IF NOT EXISTS idx_categories_vendor_id ON public.categories(vendor_id);
CREATE INDEX IF NOT EXISTS idx_categories_is_active ON public.categories(is_active);
CREATE INDEX IF NOT EXISTS idx_products_vendor_id ON public.products(vendor_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_is_available ON public.products(is_available);
