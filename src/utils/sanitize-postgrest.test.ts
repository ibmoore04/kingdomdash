import { describe, it, expect } from 'vitest'
import { sanitizePostgrestSearch, buildOrFilter } from './sanitize-postgrest'

describe('sanitizePostgrestSearch & buildOrFilter security tests', () => {
  it('strips PostgREST filter operator keywords', () => {
    expect(sanitizePostgrestSearch('test.ilike.%')).toBe('test')
    expect(sanitizePostgrestSearch('admin,role.eq.admin')).toBe('admin role admin')
    expect(sanitizePostgrestSearch('or(id.gt.0)')).toBe('or id 0')
  })

  it('strips injection metacharacters % and , and parenthesis', () => {
    const raw = '%malicious%,or(1=1)'
    const cleaned = sanitizePostgrestSearch(raw)
    expect(cleaned).not.toContain('%')
    expect(cleaned).not.toContain(',')
    expect(cleaned).not.toContain('(')
    expect(cleaned).not.toContain(')')
  })

  it('limits search term length to 100 characters', () => {
    const longString = 'a'.repeat(200)
    expect(sanitizePostgrestSearch(longString).length).toBe(100)
  })

  it('returns empty string for null, undefined, or empty search terms', () => {
    expect(sanitizePostgrestSearch('')).toBe('')
    expect(sanitizePostgrestSearch(null as unknown as string)).toBe('')
    expect(sanitizePostgrestSearch(undefined as unknown as string)).toBe('')
  })

  it('buildOrFilter produces well-formed PostgREST filter strings', () => {
    const filter = buildOrFilter('john', ['full_name', 'email', 'phone'])
    expect(filter).toBe('full_name.ilike.%john%,email.ilike.%john%,phone.ilike.%john%')
  })

  it('buildOrFilter returns empty string when sanitized search term is empty', () => {
    const filter = buildOrFilter('%,,,%', ['full_name', 'email'])
    expect(filter).toBe('')
  })
})
