-- =============================================================================
-- Migration: 20261013000001_storage_bucket_security_policies.sql
-- Description: Authoritative Storage Bucket Security & Access Governance
--              1. Provisions buckets for delivery proofs and merchant assets
--              2. Restricts uploads to authorized roles (riders, vendors, admins)
--              3. Caps file sizes and restricts MIME types to safe image formats
-- =============================================================================

-- ── 1. Bucket Provisioning ───────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  (
    'delivery-proofs',
    'delivery-proofs',
    false,
    5242880, -- 5 MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'vendor-assets',
    'vendor-assets',
    true,
    5242880, -- 5 MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp']
  )
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ── 2. Storage Objects Security Policies (delivery-proofs) ───────────────────
-- Authenticated active riders can upload proof of delivery photos
DROP POLICY IF EXISTS "Riders can upload delivery proofs" ON storage.objects;
CREATE POLICY "Riders can upload delivery proofs"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'delivery-proofs'
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role IN ('rider', 'admin', 'super_admin')
          AND p.is_active = true
      )
    )
  );

-- Riders, Admins, and SuperAdmins can read delivery proofs
DROP POLICY IF EXISTS "Authorized users can view delivery proofs" ON storage.objects;
CREATE POLICY "Authorized users can view delivery proofs"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'delivery-proofs'
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role IN ('rider', 'admin', 'super_admin')
      )
    )
  );

-- ── 3. Storage Objects Security Policies (vendor-assets) ─────────────────────
-- Active vendors and admins can upload storefront logos and menu item photos
DROP POLICY IF EXISTS "Vendors can upload storefront assets" ON storage.objects;
CREATE POLICY "Vendors can upload storefront assets"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'vendor-assets'
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role IN ('vendor', 'admin', 'super_admin')
          AND p.is_active = true
      )
    )
  );

-- Public can view vendor storefront assets (store banners, food photos)
DROP POLICY IF EXISTS "Public can view vendor storefront assets" ON storage.objects;
CREATE POLICY "Public can view vendor storefront assets"
  ON storage.objects
  FOR SELECT
  TO PUBLIC
  USING (bucket_id = 'vendor-assets');
