-- Migration: 20260902000009_create_functions_triggers.sql
-- Creates all database functions and triggers
-- Security rules:
--   SECURITY DEFINER functions: handle_new_user, get_current_user_role
--   SECURITY INVOKER functions: set_updated_at, validate_order_vendor_constraint,
--                                validate_delivery_vendor_constraint, increment_rider_deliveries
-- Every SECURITY DEFINER function includes SET search_path = public (or public, auth)

-- ============================================================
-- Function 1: set_updated_at()
-- Sets NEW.updated_at = now() before any UPDATE.
-- SECURITY INVOKER — runs as the calling user, not the function owner.
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Attach set_updated_at as BEFORE UPDATE trigger on all 16 tables with updated_at.
-- Use DROP TRIGGER IF EXISTS ... ; CREATE TRIGGER ... for idempotency.

DROP TRIGGER IF EXISTS set_updated_at_profiles ON public.profiles;
CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_vendor_applications ON public.vendor_applications;
CREATE TRIGGER set_updated_at_vendor_applications
  BEFORE UPDATE ON public.vendor_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_vendors ON public.vendors;
CREATE TRIGGER set_updated_at_vendors
  BEFORE UPDATE ON public.vendors
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_rider_applications ON public.rider_applications;
CREATE TRIGGER set_updated_at_rider_applications
  BEFORE UPDATE ON public.rider_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_riders ON public.riders;
CREATE TRIGGER set_updated_at_riders
  BEFORE UPDATE ON public.riders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_addresses ON public.addresses;
CREATE TRIGGER set_updated_at_addresses
  BEFORE UPDATE ON public.addresses
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_categories ON public.categories;
CREATE TRIGGER set_updated_at_categories
  BEFORE UPDATE ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_products ON public.products;
CREATE TRIGGER set_updated_at_products
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_orders ON public.orders;
CREATE TRIGGER set_updated_at_orders
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_payments ON public.payments;
CREATE TRIGGER set_updated_at_payments
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_service_areas ON public.service_areas;
CREATE TRIGGER set_updated_at_service_areas
  BEFORE UPDATE ON public.service_areas
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_delivery_pricing_rules ON public.delivery_pricing_rules;
CREATE TRIGGER set_updated_at_delivery_pricing_rules
  BEFORE UPDATE ON public.delivery_pricing_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_vehicles ON public.vehicles;
CREATE TRIGGER set_updated_at_vehicles
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_deliveries ON public.deliveries;
CREATE TRIGGER set_updated_at_deliveries
  BEFORE UPDATE ON public.deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_delivery_assignments ON public.delivery_assignments;
CREATE TRIGGER set_updated_at_delivery_assignments
  BEFORE UPDATE ON public.delivery_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_contact_messages ON public.contact_messages;
CREATE TRIGGER set_updated_at_contact_messages
  BEFORE UPDATE ON public.contact_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- Function 2: handle_new_user()
-- Automatically provisions a profiles row whenever a new user
-- is created in auth.users.
-- SECURITY DEFINER — runs as the function owner (postgres) so it
-- can write to public.profiles regardless of RLS.
-- SET search_path = public, auth ensures auth.uid() resolves correctly.
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'customer'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- Function 3: get_current_user_role()
-- Returns the application role for the currently authenticated user.
-- SECURITY DEFINER STABLE — bypasses RLS on profiles so that RLS
-- policies on other tables can call this function without triggering
-- recursive RLS evaluation on profiles itself.
-- All role-checking RLS policies MUST use this function instead of
-- directly querying profiles.role.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS user_role
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- ============================================================
-- Function 4: validate_order_vendor_constraint()
-- Enforces the food/grocery/courier vendor_id business rule on orders.
-- Raises an exception if the rule is violated, preventing the DML.
-- SECURITY INVOKER — executes with the permissions of the calling user.
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_order_vendor_constraint()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.service_type IN ('food', 'grocery') AND NEW.vendor_id IS NULL THEN
    RAISE EXCEPTION 'vendor_id is required for food and grocery orders';
  END IF;
  IF NEW.service_type = 'courier' AND NEW.vendor_id IS NOT NULL THEN
    RAISE EXCEPTION 'vendor_id must be NULL for courier orders';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_order_vendor ON public.orders;
CREATE TRIGGER validate_order_vendor
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_order_vendor_constraint();

-- ============================================================
-- Function 5: validate_delivery_vendor_constraint()
-- Identical logic to validate_order_vendor_constraint() but applied
-- to the deliveries table.
-- SECURITY INVOKER — executes with the permissions of the calling user.
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_delivery_vendor_constraint()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.service_type IN ('food', 'grocery') AND NEW.vendor_id IS NULL THEN
    RAISE EXCEPTION 'vendor_id is required for food and grocery deliveries';
  END IF;
  IF NEW.service_type = 'courier' AND NEW.vendor_id IS NOT NULL THEN
    RAISE EXCEPTION 'vendor_id must be NULL for courier deliveries';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_delivery_vendor ON public.deliveries;
CREATE TRIGGER validate_delivery_vendor
  BEFORE INSERT OR UPDATE ON public.deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_delivery_vendor_constraint();

-- ============================================================
-- Function 6: increment_rider_deliveries()
-- Increments riders.total_deliveries when a delivery_assignments row
-- transitions to status = 'completed'.
-- Handles both INSERT (new completed assignment) and UPDATE (status
-- transition to completed). OLD is only referenced inside the
-- ELSIF TG_OP = 'UPDATE' branch to avoid null reference on INSERT.
-- SECURITY INVOKER — executes with the permissions of the calling user.
-- ============================================================
CREATE OR REPLACE FUNCTION public.increment_rider_deliveries()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'completed' THEN
      UPDATE public.riders SET total_deliveries = total_deliveries + 1
      WHERE id = NEW.rider_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
      UPDATE public.riders SET total_deliveries = total_deliveries + 1
      WHERE id = NEW.rider_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_assignment_completed ON public.delivery_assignments;
CREATE TRIGGER on_assignment_completed
  AFTER INSERT OR UPDATE ON public.delivery_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_rider_deliveries();
