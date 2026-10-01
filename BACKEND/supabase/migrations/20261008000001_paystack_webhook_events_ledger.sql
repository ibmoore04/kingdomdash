-- =============================================================================
-- Migration: 20261008000001_paystack_webhook_events_ledger.sql
-- Module   : KingdomDash Webhook Durable Persistence & Fingerprint Idempotency
-- Contract : DOCS/SETTLEMENT_ENGINE_ARCHITECTURE.md (§11)
-- Purpose  : 1. paystack_webhook_events table for durable event deduplication
--            2. Composite SHA-256 fingerprint index preventing duplicate processing
--            3. RLS policies restricting webhook event ingestion to service_role
-- =============================================================================

-- 1. Table: paystack_webhook_events (§11)
CREATE TABLE IF NOT EXISTS public.paystack_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_fingerprint text NOT NULL UNIQUE,
  event_type text NOT NULL,
  reference text,
  transfer_code text,
  payload jsonb NOT NULL,
  processed boolean NOT NULL DEFAULT false,
  error_message text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_paystack_webhook_fingerprint ON public.paystack_webhook_events(event_fingerprint);
CREATE INDEX IF NOT EXISTS idx_paystack_webhook_reference ON public.paystack_webhook_events(reference);
CREATE INDEX IF NOT EXISTS idx_paystack_webhook_transfer_code ON public.paystack_webhook_events(transfer_code);

ALTER TABLE public.paystack_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.paystack_webhook_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.paystack_webhook_events TO service_role;
GRANT SELECT ON public.paystack_webhook_events TO authenticated;

-- RLS: SuperAdmin and Admin can view webhook events for audit
DROP POLICY IF EXISTS "Admins can view paystack webhook events" ON public.paystack_webhook_events;
CREATE POLICY "Admins can view paystack webhook events"
  ON public.paystack_webhook_events
  FOR SELECT
  TO authenticated
  USING (
    public.get_current_user_role() IN ('super_admin', 'admin')
  );
