-- Migration: 20260902000001_create_enums.sql
-- Creates all 13 PostgreSQL enums for KingdomDash
-- All enums are in the public schema

-- 1. user_role
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('customer', 'vendor', 'rider', 'admin', 'super_admin');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 2. business_type
DO $$ BEGIN
  CREATE TYPE public.business_type AS ENUM ('restaurant', 'grocery_store');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 3. application_status
DO $$ BEGIN
  CREATE TYPE public.application_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 4. vehicle_type
DO $$ BEGIN
  CREATE TYPE public.vehicle_type AS ENUM ('petrol', 'electric');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 5. vehicle_status
DO $$ BEGIN
  CREATE TYPE public.vehicle_status AS ENUM ('active', 'maintenance', 'retired');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 6. service_type
DO $$ BEGIN
  CREATE TYPE public.service_type AS ENUM ('food', 'grocery', 'courier');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 7. order_status
DO $$ BEGIN
  CREATE TYPE public.order_status AS ENUM (
    'pending',
    'payment_pending',
    'payment_processing',
    'payment_confirmed',
    'preparing',
    'ready_for_pickup',
    'picked_up',
    'in_transit',
    'delivered',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 8. payment_status
DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM ('pending', 'processing', 'successful', 'failed', 'refunded');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 9. delivery_status
DO $$ BEGIN
  CREATE TYPE public.delivery_status AS ENUM (
    'pending',
    'assigned',
    'picked_up',
    'in_transit',
    'delivered',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 10. assignment_status
DO $$ BEGIN
  CREATE TYPE public.assignment_status AS ENUM ('assigned', 'accepted', 'rejected', 'completed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 11. notification_type
DO $$ BEGIN
  CREATE TYPE public.notification_type AS ENUM ('info', 'success', 'warning', 'error');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 12. contact_status
DO $$ BEGIN
  CREATE TYPE public.contact_status AS ENUM ('new', 'in_progress', 'resolved');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 13. earning_payment_status
DO $$ BEGIN
  CREATE TYPE public.earning_payment_status AS ENUM ('pending', 'paid');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
