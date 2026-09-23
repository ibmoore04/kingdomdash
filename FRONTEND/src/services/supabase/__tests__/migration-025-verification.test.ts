import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Migration 025: Notifications & Supporting Systems Structural Verification', () => {
  const migrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/20260902000025_notifications_and_supporting_systems.sql'
  );

  it('verifies migration 025 file exists and is readable', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    const content = fs.readFileSync(migrationPath, 'utf8');
    expect(content.length).toBeGreaterThan(500);
  });

  it('defines notification_category enum with all required domains', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    expect(sql).toContain("CREATE TYPE public.notification_category AS ENUM");
    expect(sql).toContain("'order'");
    expect(sql).toContain("'delivery'");
    expect(sql).toContain("'payment'");
    expect(sql).toContain("'application'");
    expect(sql).toContain("'system'");
    expect(sql).toContain("'promotional'");
  });

  it('enhances public.notifications with category, metadata, and idempotency_key', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS category public.notification_category');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS idempotency_key text');
  });

  it('enforces deterministic idempotency via partial unique index', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    expect(sql).toContain('idx_notifications_profile_idempotency');
    expect(sql).toContain('ON public.notifications (profile_id, idempotency_key)');
    expect(sql).toContain('WHERE idempotency_key IS NOT NULL');
  });

  it('creates performance and partial unread indexes on public.notifications', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    expect(sql).toContain('idx_notifications_profile_created');
    expect(sql).toContain('idx_notifications_profile_unread');
    expect(sql).toContain('WHERE is_read = false');
    expect(sql).toContain('idx_notifications_profile_category');
  });

  it('creates public.notification_preferences table with RLS enabled, application_updates, and policies', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.notification_preferences');
    expect(sql).toContain('profile_id uuid PRIMARY KEY REFERENCES public.profiles(id)');
    expect(sql).toContain('order_updates boolean NOT NULL DEFAULT true');
    expect(sql).toContain('delivery_updates boolean NOT NULL DEFAULT true');
    expect(sql).toContain('payment_updates boolean NOT NULL DEFAULT true');
    expect(sql).toContain('application_updates boolean NOT NULL DEFAULT true');
    expect(sql).toContain('promotional boolean NOT NULL DEFAULT false');
    expect(sql).toContain('operational_alerts boolean NOT NULL DEFAULT true');
    expect(sql).toContain('ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('notification_preferences_select_own');
    expect(sql).toContain('notification_preferences_insert_own');
    expect(sql).toContain('notification_preferences_update_own');
  });

  it('creates notifications_delete_own_read policy protecting unread notifications', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    expect(sql).toContain('notifications_delete_own_read');
    expect(sql).toContain('FOR DELETE USING (profile_id = auth.uid() AND is_read = true)');
  });

  it('implements centralized emit_notification procedure with preference evaluation and strict failure semantics', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.emit_notification');
    expect(sql).toContain('SECURITY DEFINER');
    expect(sql).toContain('SET search_path = public, pg_catalog');
    expect(sql).toContain('ON CONFLICT (profile_id, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING');
    expect(sql).toContain('application_updates');
    // Verify blanket exception swallowing was removed
    expect(sql).not.toContain('WHEN OTHERS THEN\n      PERFORM public.log_operational_audit_event');
  });

  it('implements atomic management RPCs: mark_all_notifications_read, clear_read_notifications, get_unread_notification_count', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()');
    expect(sql).toContain('SET is_read = true');
    expect(sql).toContain('WHERE profile_id = auth.uid() AND is_read = false');

    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.clear_read_notifications()');
    expect(sql).toContain('DELETE FROM public.notifications');
    expect(sql).toContain('WHERE profile_id = auth.uid() AND is_read = true');

    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.get_unread_notification_count()');
    expect(sql).toContain('SELECT count(*)::integer');
  });

  it('implements lifecycle triggers for orders, assignments, and onboarding applications', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.trg_fn_order_notification_lifecycle()');
    expect(sql).toContain('CREATE TRIGGER trg_order_notification_lifecycle');
    expect(sql).toContain('AFTER INSERT OR UPDATE OF status ON public.orders');
    expect(sql).toContain('public.delivery_assignments da');

    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.trg_fn_delivery_assignment_notification()');
    expect(sql).toContain('CREATE TRIGGER trg_delivery_assignment_notification');
    expect(sql).toContain('AFTER INSERT OR UPDATE OF status ON public.delivery_assignments');

    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.trg_fn_application_notification()');
    expect(sql).toContain('CREATE TRIGGER trg_rider_application_notification');
    expect(sql).toContain('CREATE TRIGGER trg_vendor_application_notification');
  });

  it('safely registers public.notifications in supabase_realtime with REPLICA IDENTITY FULL', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    expect(sql).toContain('ALTER TABLE public.notifications REPLICA IDENTITY FULL');
    expect(sql).toContain("pubname = 'supabase_realtime' AND tablename = 'notifications'");
    expect(sql).toContain('ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications');
  });
});
