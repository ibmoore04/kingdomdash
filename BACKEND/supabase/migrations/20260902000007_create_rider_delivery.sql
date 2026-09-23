-- Migration: 20260902000007_create_rider_delivery.sql
-- Creates vehicles, deliveries, delivery_assignments, delivery_status_updates, rider_earnings tables
-- delivery_status_updates and rider_earnings are append-only (no updated_at)
-- vendor_id on deliveries is nullable — service_type/vendor_id constraint enforced by trigger
-- Enables RLS on all five tables and adds performance indexes

-- ============================================================
-- Table: vehicles
-- KingdomDash fleet vehicles (petrol or electric motorcycles)
-- assigned_rider_id UNIQUE enforces one vehicle per rider
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assigned_rider_id uuid UNIQUE REFERENCES public.riders(id) ON DELETE SET NULL,
  vehicle_type vehicle_type NOT NULL,
  make text NOT NULL,
  model text NOT NULL,
  year integer NOT NULL CHECK (year >= 2000),
  license_plate text NOT NULL UNIQUE,
  vin text,
  purchase_date date,
  status vehicle_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Table: deliveries
-- Operational record tracking fulfilment of a customer order
-- from pickup through drop-off.
-- vendor_id is nullable — the service_type/vendor_id constraint
-- is enforced by the validate_delivery_vendor_constraint() trigger.
-- order_id is nullable (UNIQUE) to allow standalone courier
-- deliveries not linked to an order row.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid UNIQUE REFERENCES public.orders(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  service_type service_type NOT NULL,
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  pickup_address text NOT NULL,
  pickup_contact text NOT NULL,
  delivery_address text NOT NULL,
  delivery_contact text NOT NULL,
  special_instructions text,
  status delivery_status NOT NULL DEFAULT 'pending',
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Table: delivery_assignments
-- Links a delivery to a rider for a specific pickup/delivery task.
-- Multiple assignments may exist per delivery (e.g. reassignments).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.delivery_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  rider_id uuid NOT NULL REFERENCES public.riders(id),
  assigned_by uuid NOT NULL REFERENCES public.profiles(id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  status assignment_status NOT NULL DEFAULT 'assigned',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Table: delivery_status_updates
-- Append-only audit log of delivery status transitions.
-- No updated_at — rows are never mutated after insertion.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.delivery_status_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  old_status delivery_status,
  new_status delivery_status NOT NULL,
  updated_by uuid NOT NULL REFERENCES public.profiles(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Table: rider_earnings
-- Authoritative financial record of a rider's per-delivery
-- compensation. Append-only — amendments create new rows rather
-- than mutating existing records. No updated_at.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rider_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id uuid NOT NULL REFERENCES public.riders(id),
  delivery_id uuid NOT NULL REFERENCES public.deliveries(id),
  delivery_assignment_id uuid NOT NULL REFERENCES public.delivery_assignments(id),
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'NGN',
  payment_status earning_payment_status NOT NULL DEFAULT 'pending',
  paid_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Enable Row Level Security
-- ============================================================
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_status_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rider_earnings ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Indexes for query performance
-- ============================================================

-- deliveries
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON public.deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_service_type ON public.deliveries(service_type);
CREATE INDEX IF NOT EXISTS idx_deliveries_vendor_id ON public.deliveries(vendor_id);

-- delivery_assignments
CREATE INDEX IF NOT EXISTS idx_delivery_assignments_delivery_id ON public.delivery_assignments(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_assignments_rider_id ON public.delivery_assignments(rider_id);
CREATE INDEX IF NOT EXISTS idx_delivery_assignments_status ON public.delivery_assignments(status);

-- rider_earnings
CREATE INDEX IF NOT EXISTS idx_rider_earnings_rider_id ON public.rider_earnings(rider_id);
CREATE INDEX IF NOT EXISTS idx_rider_earnings_payment_status ON public.rider_earnings(payment_status);
