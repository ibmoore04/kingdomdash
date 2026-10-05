import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

describe('Phase 2: Delivery Custody, PIN Lockout & Storage Security Hardening', () => {
  const rootMigrationPath = path.resolve(
    __dirname,
    '../../../../supabase/migrations/20261013000001_storage_bucket_security_policies.sql'
  )
  const backendMigrationPath = path.resolve(
    __dirname,
    '../../../../BACKEND/supabase/migrations/20261013000001_storage_bucket_security_policies.sql'
  )

  it('verifies 1:1 dual migration parity between root and BACKEND for storage policies', () => {
    expect(fs.existsSync(rootMigrationPath)).toBe(true)
    expect(fs.existsSync(backendMigrationPath)).toBe(true)

    const rootSql = fs.readFileSync(rootMigrationPath, 'utf8')
    const backendSql = fs.readFileSync(backendMigrationPath, 'utf8')
    expect(rootSql).toBe(backendSql)
  })

  it('verifies storage buckets are provisioned with 5MB limits and mime type restrictions', () => {
    const sql = fs.readFileSync(rootMigrationPath, 'utf8')

    // delivery-proofs bucket
    expect(sql).toContain("'delivery-proofs'")
    expect(sql).toContain('5242880')
    expect(sql).toContain("'image/jpeg', 'image/png', 'image/webp'")

    // vendor-assets bucket
    expect(sql).toContain("'vendor-assets'")
    expect(sql).toContain('ON CONFLICT (id) DO UPDATE SET')
  })

  it('verifies strict storage RLS policies for riders, vendors, and admins', () => {
    const sql = fs.readFileSync(rootMigrationPath, 'utf8')

    // Rider upload delivery-proofs
    expect(sql).toContain('Riders can upload delivery proofs')
    expect(sql).toContain("p.role IN ('rider', 'admin', 'super_admin')")
    // Authorized view delivery proofs
    expect(sql).toContain('Authorized users can view delivery proofs')
    // Vendor storefront upload
    expect(sql).toContain('Vendors can upload storefront assets')
    expect(sql).toContain("p.role IN ('vendor', 'admin', 'super_admin')")
    // Public view vendor assets
    expect(sql).toContain('Public can view vendor storefront assets')
  })

  it('verifies custody action bar implements 3-attempt lockout and override request trigger', () => {
    const srcComponentPath = path.resolve(
      __dirname,
      '../../../../src/components/rider/delivery/custody-action-bar.tsx'
    )
    const frontendComponentPath = path.resolve(
      __dirname,
      '../../../components/rider/delivery/custody-action-bar.tsx'
    )

    expect(fs.existsSync(srcComponentPath)).toBe(true)
    expect(fs.existsSync(frontendComponentPath)).toBe(true)

    const srcCode = fs.readFileSync(srcComponentPath, 'utf8')
    const frontendCode = fs.readFileSync(frontendComponentPath, 'utf8')

    // Strict parity
    expect(srcCode).toBe(frontendCode)

    // Lockout constants and states
    expect(srcCode).toContain('const MAX_ATTEMPTS = 3')
    expect(srcCode).toContain('const [failedAttempts, setFailedAttempts] = useState(0)')
    expect(srcCode).toContain('const isLocked = failedAttempts >= MAX_ATTEMPTS')

    // Security warning banner & override trigger
    expect(srcCode).toContain('PIN verification locked (3 failed attempts)')
    expect(srcCode).toContain('Request Override')
    expect(srcCode).toContain('onOpenIssueModal')
  })
})
