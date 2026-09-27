import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { getCorsHeaders, corsHeaders } from '../../../../supabase/functions/_shared/cors'
import { sanitizeSafeUrl, isSafeUrl } from '../../../../src/utils/sanitize-url'
import { sanitizePostgrestSearch, buildOrFilter } from '../../../../src/utils/sanitize-postgrest'
import { validateRedirectPath, resolvePostLoginTarget } from '../../../../src/utils/safe-redirect'

describe('KingdomDash Security Remediation — Pre-Production Gate Verification', () => {
  const migrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/20260926000002_remediation_security_hardening.sql'
  )

  it('verifies migration 20260926000002 exists and is readable', () => {
    expect(fs.existsSync(migrationPath)).toBe(true)
    const content = fs.readFileSync(migrationPath, 'utf8')
    expect(content.length).toBeGreaterThan(1000)
  })

  const sql = fs.readFileSync(migrationPath, 'utf8')

  // ==========================================================================
  // §1: DATABASE COMPATIBILITY & RPC SIGNATURE VERIFICATION
  // ==========================================================================
  describe('1. Database Compatibility & RPC Signatures', () => {
    it('get_user_corporate_lead maintains identical parameter and return signatures', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.get_user_corporate_lead(')
      expect(sql).toContain('p_email text DEFAULT NULL,')
      expect(sql).toContain('p_phone text DEFAULT NULL')
      expect(sql).toContain('company_name text,')
      expect(sql).toContain('contact_name text,')
      expect(sql).toContain('estimated_volume text,')
      expect(sql).toContain('SET search_path = public, pg_catalog')
    })

    it('admin_direct_onboard_vendor maintains exact parameter signature and types', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.admin_direct_onboard_vendor(')
      expect(sql).toContain('p_profile_id           uuid,')
      expect(sql).toContain('p_business_name        text,')
      expect(sql).toContain('p_business_address     text,')
      expect(sql).toContain('p_phone                text,')
      expect(sql).toContain('p_email                text,')
      expect(sql).toContain('p_service_types        public.service_type[],')
      expect(sql).toContain('p_business_description text DEFAULT NULL,')
      expect(sql).toContain("p_business_type        public.business_type DEFAULT 'restaurant'")
      expect(sql).toContain('RETURNS jsonb')
      expect(sql).toContain('SET search_path = public, pg_catalog')
    })

    it('admin_direct_onboard_rider maintains EXACT parameter order from migration 031 (fixes 42P13)', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.admin_direct_onboard_rider(')
      expect(sql).toContain('p_profile_id    uuid,')
      expect(sql).toContain('p_full_name     text,')
      expect(sql).toContain('p_phone         text,')
      expect(sql).toContain('p_email         text,')
      expect(sql).toContain('p_vehicle_type  public.vehicle_type,')
      expect(sql).toContain('p_address       text DEFAULT NULL,')
      expect(sql).toContain('p_vehicle_make  text DEFAULT NULL,')
      expect(sql).toContain('p_vehicle_model text DEFAULT NULL,')
      expect(sql).toContain('p_vehicle_year  integer DEFAULT NULL,')
      expect(sql).toContain('p_license_plate text DEFAULT NULL')
      expect(sql).toContain('RETURNS jsonb')
      expect(sql).toContain('SET search_path = public, pg_catalog')

      // Verify parameter 6 is p_address (and NOT p_vehicle_make which caused 42P13)
      const riderFuncStart = sql.indexOf('CREATE OR REPLACE FUNCTION public.admin_direct_onboard_rider')
      const riderFuncSig = sql.slice(riderFuncStart, sql.indexOf('RETURNS jsonb', riderFuncStart))
      const addressIdx = riderFuncSig.indexOf('p_address')
      const vehicleMakeIdx = riderFuncSig.indexOf('p_vehicle_make')
      expect(addressIdx).toBeLessThan(vehicleMakeIdx)
    })
  })

  // ==========================================================================
  // §2: RPC AUTHORIZATION GATES & DEFENSE IN DEPTH
  // ==========================================================================
  describe('2. RPC Authorization Gates & IDOR Prevention', () => {
    it('get_user_corporate_lead revokes ALL privileges from PUBLIC and anon', () => {
      expect(sql).toContain('REVOKE ALL ON FUNCTION public.get_user_corporate_lead(text, text) FROM PUBLIC;')
      expect(sql).toContain('REVOKE ALL ON FUNCTION public.get_user_corporate_lead(text, text) FROM anon;')
      expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.get_user_corporate_lead(text, text) TO authenticated, service_role;')
    })

    it('get_user_corporate_lead binds non-admin callers strictly to verified JWT email and profile phone', () => {
      expect(sql).toContain("v_search_email := LOWER(COALESCE(auth.jwt()->>'email', ''));")
      expect(sql).toContain('SELECT TRIM(COALESCE(p.phone, \'\')) INTO v_search_phone')
      expect(sql).toContain('WHERE p.id = v_caller_id;')
    })

    it('admin_direct_onboard_vendor prevents self-reassignment and peer admin demotion', () => {
      expect(sql).toContain('IF v_caller_id IS NOT NULL AND p_profile_id = v_caller_id THEN')
      expect(sql).toContain("RAISE EXCEPTION 'Administrative callers cannot reassign their own account'")
      expect(sql).toContain("IF v_profile.role IN ('admin', 'super_admin') THEN")
      expect(sql).toContain("RAISE EXCEPTION 'Security violation: Cannot demote or reassign an administrative account (%) as vendor'")
    })

    it('admin_direct_onboard_rider prevents self-reassignment and peer admin demotion', () => {
      expect(sql).toContain('IF v_caller_id IS NOT NULL AND p_profile_id = v_caller_id THEN')
      expect(sql).toContain("RAISE EXCEPTION 'Administrative callers cannot reassign their own account'")
      expect(sql).toContain("IF v_profile.role IN ('admin', 'super_admin') THEN")
      expect(sql).toContain("RAISE EXCEPTION 'Security violation: Cannot demote or reassign an administrative account (%) as rider'")
    })

    it('admin RPCs allow service_role and postgres execution context', () => {
      expect(sql).toContain("(auth.jwt()->>'role') IS DISTINCT FROM 'service_role'")
      expect(sql).toContain("current_user NOT IN ('postgres', 'supabase_admin')")
    })
  })

  // ==========================================================================
  // §3: STORAGE SECURITY & RESTRICTIVE POLICIES
  // ==========================================================================
  describe('3. Storage Security Isolation', () => {
    it('defines storage policies AS RESTRICTIVE so no permissive policy can bypass isolation', () => {
      expect(sql).toContain('CREATE POLICY "sensitive_documents_isolation_restrictive" ON storage.objects')
      expect(sql).toContain('AS RESTRICTIVE')
      expect(sql).toContain('FOR ALL')
      expect(sql).toContain('TO authenticated, anon')
    })

    it('unrelated buckets evaluate to TRUE immediately without affecting public storage', () => {
      expect(sql).toContain("bucket_id NOT IN ('rider-licenses', 'kyc-documents', 'vendor-documents')")
    })

    it('sensitive buckets permit access ONLY to owner, user folder prefix, or admin roles', () => {
      expect(sql).toContain('owner = auth.uid()')
      expect(sql).toContain("(storage.foldername(name))[1] = auth.uid()::text")
      expect(sql).toContain("name LIKE auth.uid()::text || '/%'")
      expect(sql).toContain("public.get_current_user_role() IN ('admin', 'super_admin')")
    })

    it('does NOT execute ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY to avoid error 42501 (ownership requirement)', () => {
      expect(sql).not.toContain('ALTER TABLE storage.objects')
    })
  })

  // ==========================================================================
  // §4: SUPPORT TICKET SECURITY & PII REDACTION
  // ==========================================================================
  describe('4. Support Ticket Security & High Entropy Codes', () => {
    it('submit_support_ticket generates 12-hex high-entropy reference codes', () => {
      expect(sql).toContain("'KD-SUP-' || upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 12))")
    })

    it('submit_support_ticket revokes ALL from PUBLIC before granting roles', () => {
      expect(sql).toContain('REVOKE ALL ON FUNCTION public.submit_support_ticket(text, text, text, text, text) FROM PUBLIC;')
      expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.submit_support_ticket(text, text, text, text, text) TO anon, authenticated, service_role;')
    })

    it('submit_support_ticket preserves parameter defaults to avoid PostgreSQL error 42P13', () => {
      expect(sql).toContain('p_phone   text DEFAULT NULL')
      expect(sql).toContain("p_subject text DEFAULT 'Support Request'")
      expect(sql).toContain("p_message text DEFAULT ''")
    })

    it('get_support_ticket_by_ref rejects short reference codes (< 8 chars)', () => {
      expect(sql).toContain('IF LENGTH(v_clean_ref) < 8 THEN')
      expect(sql).toContain('RETURN NULL;')
    })

    it('get_support_ticket_by_ref redacts customer PII for unauthenticated/unrelated callers', () => {
      expect(sql).toContain('REVOKE ALL ON FUNCTION public.get_support_ticket_by_ref(text) FROM PUBLIC;')
      expect(sql).toContain('IF v_is_owner OR v_is_admin THEN')
      // Owner/Admin gets email, phone, message
      expect(sql).toContain("'email', v_rec.email,")
      expect(sql).toContain("'message', v_rec.message,")
      // Anonymous / public return excludes email, phone, and customer message
      const publicReturnStart = sql.indexOf('-- For public / anonymous lookups: return tracking status')
      const publicReturnBlock = sql.slice(publicReturnStart, sql.indexOf('END;', publicReturnStart))
      expect(publicReturnBlock).not.toContain("'email', v_rec.email")
      expect(publicReturnBlock).not.toContain("'phone', v_rec.phone")
      expect(publicReturnBlock).not.toContain("'message', v_rec.message")
    })
  })

  // ==========================================================================
  // §5: CORS ALLOWLIST TESTS
  // ==========================================================================
  describe('5. Edge Function CORS Security', () => {
    it('allows valid KingdomDash production origins', () => {
      const req1 = new Request('https://kingdomdash.net/api', {
        headers: { Origin: 'https://kingdomdash.net' },
      })
      const headers1 = getCorsHeaders(req1)
      expect(headers1['Access-Control-Allow-Origin']).toBe('https://kingdomdash.net')

      const req2 = new Request('https://www.kingdomdash.net/api', {
        headers: { Origin: 'https://www.kingdomdash.net' },
      })
      const headers2 = getCorsHeaders(req2)
      expect(headers2['Access-Control-Allow-Origin']).toBe('https://www.kingdomdash.net')
    })

    it('allows authorized localhost development origins', () => {
      const devOrigins = ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:4173']
      for (const origin of devOrigins) {
        const req = new Request(`${origin}/api`, { headers: { Origin: origin } })
        expect(getCorsHeaders(req)['Access-Control-Allow-Origin']).toBe(origin)
      }
    })

    it('strictly rejects arbitrary attacker origins and falls back to production domain', () => {
      const attackerOrigins = [
        'https://evil-attacker.com',
        'https://kingdomdash.net.attacker.com',
        'http://localhost:8080',
        'null',
      ]
      for (const origin of attackerOrigins) {
        const req = new Request('https://kingdomdash.net/api', { headers: { Origin: origin } })
        const headers = getCorsHeaders(req)
        // Never reflects attacker origin
        expect(headers['Access-Control-Allow-Origin']).toBe('https://kingdomdash.net')
        expect(headers['Access-Control-Allow-Origin']).not.toBe(origin)
      }
    })

    it('never returns wildcard * in CORS headers', () => {
      expect(corsHeaders['Access-Control-Allow-Origin']).not.toBe('*')
      const headers = getCorsHeaders()
      expect(headers['Access-Control-Allow-Origin']).not.toBe('*')
    })
  })

  // ==========================================================================
  // §6: POSTGREST SEARCH SANITIZER TESTS
  // ==========================================================================
  describe('6. PostgREST Search Sanitization', () => {
    it('preserves normal alphanumeric search terms', () => {
      expect(sanitizePostgrestSearch('John Doe')).toBe('John Doe')
      expect(sanitizePostgrestSearch('Order 12345')).toBe('Order 12345')
      expect(sanitizePostgrestSearch('Pizza Hut')).toBe('Pizza Hut')
    })

    it('strips SQL & PostgREST control characters: quotes, commas, parentheses, brackets, %', () => {
      const malicious = "admin',(\"test\")[0]%*"
      const cleaned = sanitizePostgrestSearch(malicious)
      expect(cleaned).not.toContain("'")
      expect(cleaned).not.toContain(',')
      expect(cleaned).not.toContain('(')
      expect(cleaned).not.toContain(')')
      expect(cleaned).not.toContain('[')
      expect(cleaned).not.toContain(']')
      expect(cleaned).not.toContain('%')
      expect(cleaned).not.toContain('*')
    })

    it('strips PostgREST operator injection patterns: .eq., .ilike., .or.', () => {
      expect(sanitizePostgrestSearch('test.ilike.malicious')).toBe('test malicious')
      expect(sanitizePostgrestSearch('role.eq.super_admin')).toBe('role super_admin')
    })

    it('enforces a strict 100 character cap to prevent DoS', () => {
      const hugeInput = 'A'.repeat(500)
      const sanitized = sanitizePostgrestSearch(hugeInput)
      expect(sanitized.length).toBe(100)
    })

    it('buildOrFilter produces syntactically safe filter string', () => {
      const filter = buildOrFilter('Burger King', ['name', 'description'])
      expect(filter).toBe('name.ilike.%Burger King%,description.ilike.%Burger King%')
    })
  })

  // ==========================================================================
  // §7: URL PROTOCOL SANITIZATION TESTS (XSS DEFENSE)
  // ==========================================================================
  describe('7. URL Protocol Sanitization (XSS Prevention)', () => {
    it('accepts legitimate HTTPS URLs and relative paths', () => {
      expect(isSafeUrl('https://kingdomdash.net/docs/license.pdf')).toBe(true)
      expect(sanitizeSafeUrl('https://kingdomdash.net/docs/license.pdf')).toBe('https://kingdomdash.net/docs/license.pdf')
      expect(isSafeUrl('/storage/licenses/doc.pdf')).toBe(true)
    })

    it('strictly blocks javascript: URI schemes and control character variants', () => {
      expect(isSafeUrl('javascript:alert(1)')).toBe(false)
      expect(isSafeUrl('JAVASCRIPT:alert(document.cookie)')).toBe(false)
      expect(isSafeUrl('java\tscript:alert(1)')).toBe(false)
      expect(isSafeUrl('java\nscript:alert(1)')).toBe(false)
      expect(sanitizeSafeUrl('javascript:alert(1)')).toBe('')
    })

    it('strictly blocks data:, vbscript:, and file: schemes', () => {
      expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
      expect(isSafeUrl('vbscript:msgbox(1)')).toBe(false)
      expect(isSafeUrl('file:///etc/passwd')).toBe(false)
    })
  })

  // ==========================================================================
  // §8: OPEN REDIRECT DEFENSE IN MFA CALLBACKS
  // ==========================================================================
  describe('8. Open Redirect Defense in Auth Navigation', () => {
    it('preserves valid relative application paths', () => {
      expect(validateRedirectPath('/admin/riders')).toBe('/admin/riders')
      expect(validateRedirectPath('/dashboard/orders')).toBe('/dashboard/orders')
      expect(validateRedirectPath('/vendor?tab=menu')).toBe('/vendor?tab=menu')
      expect(resolvePostLoginTarget('/admin/riders', { role: 'admin' })).toBe('/admin/riders')
    })

    it('strictly neutralizes external redirect attempts (open redirect attacks)', () => {
      expect(validateRedirectPath('https://evil-attacker.com')).toBeNull()
      expect(validateRedirectPath('//evil-attacker.com')).toBeNull()
      expect(validateRedirectPath('http://phishing.com/admin')).toBeNull()
      expect(validateRedirectPath('javascript:alert(1)')).toBeNull()

      // resolvePostLoginTarget falls back to safe root or role dashboard
      expect(resolvePostLoginTarget('https://evil-attacker.com', { role: 'admin' })).toBe('/')
      expect(resolvePostLoginTarget('//evil-attacker.com', { role: 'super_admin' })).toBe('/')
      expect(resolvePostLoginTarget('javascript:alert(1)', { role: 'customer' })).toBe('/')
    })
  })
})
