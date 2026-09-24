-- Migration: 20260902000043_enforce_server_financial_authority.sql
-- Description: Enforce 100% server-side financial authority on orders, preventing direct client financial field insertion.

CREATE OR REPLACE FUNCTION public.trg_enforce_order_financial_authority()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  -- Prevent unprivileged direct client inserts from populating financial values
  -- unless executed via a server RPC (SECURITY DEFINER) or service_role.
  IF current_setting('role', true) = 'authenticated' AND pg_trigger_depth() = 1 THEN
    IF NEW.subtotal IS NOT NULL OR NEW.delivery_fee IS NOT NULL OR NEW.total IS NOT NULL THEN
      RAISE EXCEPTION 'Direct client financial calculation on orders table is strictly prohibited. Orders must be submitted via authoritative server RPCs.'
        USING ERRCODE = 'KD403';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_financial_authority ON public.orders;
CREATE TRIGGER trg_order_financial_authority
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_enforce_order_financial_authority();
