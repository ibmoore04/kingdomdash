-- =============================================================================
-- Migration: 20261009000001_settlement_worker_cron.sql
-- Module   : KingdomDash Automated Settlement Engine - Worker Cron Scheduler
-- Contract : DOCS/SETTLEMENT_ENGINE_ARCHITECTURE.md (§7, §8, §13)
-- Purpose  : 1. Defensively configure pg_cron and pg_net extensions
--            2. Register recurring 2-minute cron job to invoke settlement-worker
--            3. Create helper RPC invoke_settlement_worker_http()
-- =============================================================================

-- 1. Defensively enable pg_cron and pg_net extensions if permitted
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron extension could not be enabled: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_net extension could not be enabled: %', SQLERRM;
END $$;

-- 2. Privileged Helper to Trigger Settlement Worker via HTTP POST
CREATE OR REPLACE FUNCTION public.invoke_settlement_worker_http()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
  v_url text := 'https://kbrfaccrhmvgcdtdfjna.supabase.co/functions/v1/settlement-worker';
  v_service_key text := NULL;
  v_request_id bigint;
BEGIN
  -- Attempt to retrieve service_role_key from vault if configured
  BEGIN
    SELECT decrypted_secret INTO v_service_key
    FROM vault.decrypted_secrets
    WHERE name = 'service_role_key'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_service_key := NULL;
  END;

  -- Fallback to current_setting if configured in custom settings
  IF v_service_key IS NULL THEN
    BEGIN
      v_service_key := current_setting('app.settings.service_role_key', true);
    EXCEPTION WHEN OTHERS THEN
      v_service_key := NULL;
    END IF;
  END IF;

  -- If key is available, dispatch asynchronous HTTP POST via pg_net
  IF v_service_key IS NOT NULL THEN
    BEGIN
      SELECT net.http_post(
        url := v_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_service_key
        ),
        body := jsonb_build_object(
          'source', 'pg_cron',
          'scheduled_at', now()
        )
      ) INTO v_request_id;

      RETURN jsonb_build_object(
        'status', 'dispatched',
        'request_id', v_request_id,
        'dispatched_at', now()
      );
    EXCEPTION WHEN OTHERS THEN
      RETURN jsonb_build_object(
        'status', 'error',
        'message', SQLERRM,
        'evaluated_at', now()
      );
    END;
  ELSE
    RETURN jsonb_build_object(
      'status', 'skipped_no_key',
      'message', 'Service role key not configured in vault or app.settings. External cron runner active.',
      'evaluated_at', now()
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.invoke_settlement_worker_http() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invoke_settlement_worker_http() TO service_role;

-- 3. Idempotently Schedule the Cron Job (every 2 minutes)
DO $$
BEGIN
  -- Check if cron extension is active
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Unschedule existing job if already registered to avoid duplicates
    BEGIN
      PERFORM cron.unschedule('process-settlement-worker-every-2m');
    EXCEPTION WHEN OTHERS THEN
      -- Ignore if not registered yet
    END;

    -- Schedule to run every 2 minutes
    PERFORM cron.schedule(
      'process-settlement-worker-every-2m',
      '*/2 * * * *',
      'SELECT public.invoke_settlement_worker_http();'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron scheduling skipped: %', SQLERRM;
END $$;
