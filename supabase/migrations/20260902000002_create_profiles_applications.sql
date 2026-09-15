-- Migration: 20260902000002_create_profiles_applications.sql
-- Creates profiles, vendor_applications, rider_applications, rider_application_private tables
-- Enables RLS on all four tables and adds performance indexes

-- ============================================================
-- Table 1: profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  phone text,
  avatar_url text,
  role user_role NOT NULL DEFAULT 'customer',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Table 2: vendor_applications
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vendor_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  business_name text NOT NULL,
  business_type business_type NOT NULL,
  business_description text,
  business_address text NOT NULL,
  phone text NOT NULL,
  email text NOT NULL,
  operating_hours jsonb,
  service_area text,
  status application_status NOT NULL DEFAULT 'pending',
  rejection_reason text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- ============================================================
-- Table 3: rider_applications
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rider_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text NOT NULL,
  email text NOT NULL,
  address text NOT NULL,
  vehicle_type vehicle_type NOT NULL,
  vehicle_make text NOT NULL,
  vehicle_model text NOT NULL,
  vehicle_year integer NOT NULL,
  status application_status NOT NULL DEFAULT 'pending',
  rejection_reason text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- ============================================================
-- Table 4: rider_application_private
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rider_application_private (
  application_id uuid PRIMARY KEY REFERENCES public.rider_applications(id) ON DELETE CASCADE,
  date_of_birth date NOT NULL,
  license_number text NOT NULL,
  license_expiry date NOT NULL,
  emergency_contact_name text NOT NULL,
  emergency_contact_phone text NOT NULL,
  bank_name text NOT NULL,
  bank_account_number text NOT NULL
);

-- ============================================================
-- Enable Row Level Security on all four tables
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rider_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rider_application_private ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Performance indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_vendor_applications_profile_id ON public.vendor_applications(profile_id);
CREATE INDEX IF NOT EXISTS idx_vendor_applications_status ON public.vendor_applications(status);
CREATE INDEX IF NOT EXISTS idx_rider_applications_profile_id ON public.rider_applications(profile_id);
CREATE INDEX IF NOT EXISTS idx_rider_applications_status ON public.rider_applications(status);
