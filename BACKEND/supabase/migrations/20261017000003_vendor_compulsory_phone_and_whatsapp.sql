-- ============================================================================
-- Migration: 20261017000003_vendor_compulsory_phone_and_whatsapp.sql
-- Description: Add whatsapp_number to vendors and provide update_vendor_contact_info()
--              RPC for immediate compulsory contact enforcement.
-- ============================================================================

-- 1. Schema Extensions
ALTER TABLE public.vendors 
  ADD COLUMN IF NOT EXISTS whatsapp_number text;

-- 2. Update Vendor Contact Info RPC
CREATE OR REPLACE FUNCTION public.update_vendor_contact_info(
  p_vendor_id uuid,
  p_phone text,
  p_whatsapp_number text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_clean_phone text;
  v_clean_whatsapp text;
  v_updated jsonb;
  v_profile_id uuid;
BEGIN
  -- Authenticate caller owns the vendor or is admin
  SELECT v.profile_id INTO v_profile_id
  FROM public.vendors v
  WHERE v.id = p_vendor_id;

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Vendor not found';
  END IF;

  IF v_profile_id <> auth.uid() AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Access denied: caller does not own this vendor';
  END IF;

  v_clean_phone := trim(p_phone);
  IF length(v_clean_phone) < 7 THEN
    RAISE EXCEPTION 'A valid operational phone number is required';
  END IF;

  v_clean_whatsapp := NULLIF(trim(p_whatsapp_number), '');

  -- Update vendors table
  UPDATE public.vendors
  SET phone = v_clean_phone,
      whatsapp_number = COALESCE(v_clean_whatsapp, v_clean_phone),
      updated_at = now()
  WHERE id = p_vendor_id;

  -- Sync to owner profile so all communications align
  UPDATE public.profiles
  SET phone = v_clean_phone,
      whatsapp_number = COALESCE(v_clean_whatsapp, v_clean_phone),
      updated_at = now()
  WHERE id = v_profile_id;

  SELECT jsonb_build_object(
    'id', v.id,
    'phone', v.phone,
    'whatsapp_number', v.whatsapp_number
  ) INTO v_updated
  FROM public.vendors v
  WHERE v.id = p_vendor_id;

  RETURN jsonb_build_object('success', true, 'data', v_updated);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_vendor_contact_info(uuid, text, text) TO authenticated;
