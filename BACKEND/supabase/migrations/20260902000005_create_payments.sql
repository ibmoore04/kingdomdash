-- Migration: 20260902000005_create_payments.sql
-- Creates payments table
-- UNIQUE on order_id enforces one payment record per order
-- No frontend role may directly set status = 'successful' — payment transitions are server-side only (Phase 9)
-- Enables RLS and adds performance indexes

-- ============================================================
-- Table: payments
-- order_id is UNIQUE — one payment record per order enforced at DB level
-- paystack_reference is UNIQUE — prevents duplicate Paystack entries
-- Payment status transitions to 'successful' are server-side only (Phase 9 Edge Function)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  paystack_reference text UNIQUE,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'NGN',
  status payment_status NOT NULL DEFAULT 'pending',
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Enable Row Level Security
-- ============================================================
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Performance indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
