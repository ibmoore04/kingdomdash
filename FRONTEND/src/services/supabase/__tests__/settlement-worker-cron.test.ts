import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

describe('Step 3 — Settlement Worker Automated Scheduling', () => {
  const rootMigrationPath = path.resolve(
    __dirname,
    '../../../../supabase/migrations/20261009000001_settlement_worker_cron.sql'
  )
  const backendMigrationPath = path.resolve(
    __dirname,
    '../../../../BACKEND/supabase/migrations/20261009000001_settlement_worker_cron.sql'
  )
  const workflowPath = path.resolve(
    __dirname,
    '../../../../.github/workflows/settlement-cron.yml'
  )

  it('verifies 20261009000001_settlement_worker_cron.sql exists in root and BACKEND with identical content', () => {
    expect(fs.existsSync(rootMigrationPath)).toBe(true)
    expect(fs.existsSync(backendMigrationPath)).toBe(true)

    const rootContent = fs.readFileSync(rootMigrationPath, 'utf8')
    const backendContent = fs.readFileSync(backendMigrationPath, 'utf8')
    expect(rootContent).toBe(backendContent)
  })

  it('verifies migration 20261009 contains defensive pg_cron and pg_net extension handling', () => {
    const content = fs.readFileSync(rootMigrationPath, 'utf8')
    expect(content).toContain('CREATE EXTENSION IF NOT EXISTS pg_cron')
    expect(content).toContain('CREATE EXTENSION IF NOT EXISTS pg_net')
    expect(content).toContain('CREATE OR REPLACE FUNCTION public.invoke_settlement_worker_http()')
    expect(content).toContain('cron.schedule')
    expect(content).toContain('process-settlement-worker-every-2m')
    expect(content).toContain('*/2 * * * *')
  })

  it('verifies invoke_settlement_worker_http RPC enforces strict security boundaries', () => {
    const content = fs.readFileSync(rootMigrationPath, 'utf8')
    expect(content).toContain('SECURITY DEFINER')
    expect(content).toContain('REVOKE ALL ON FUNCTION public.invoke_settlement_worker_http() FROM PUBLIC, anon, authenticated;')
    expect(content).toContain('GRANT EXECUTE ON FUNCTION public.invoke_settlement_worker_http() TO service_role;')
  })

  it('verifies GitHub Actions settlement cron workflow configuration exists and is well-formed', () => {
    expect(fs.existsSync(workflowPath)).toBe(true)
    const workflow = fs.readFileSync(workflowPath, 'utf8')
    expect(workflow).toContain('name: Automated Settlement Worker Cron')
    expect(workflow).toContain("cron: '*/5 * * * *'")
    expect(workflow).toContain('workflow_dispatch:')
    expect(workflow).toContain('https://kbrfaccrhmvgcdtdfjna.supabase.co/functions/v1/settlement-worker')
    expect(workflow).toContain('secrets.SUPABASE_SERVICE_ROLE_KEY')
  })
})
