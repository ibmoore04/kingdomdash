import { describe, it, expect } from 'vitest'
import { sanitizeSafeUrl, isSafeUrl } from './sanitize-url'

describe('sanitizeSafeUrl & isSafeUrl security tests', () => {
  it('allows safe https and http URLs', () => {
    expect(sanitizeSafeUrl('https://example.com/license.pdf')).toBe('https://example.com/license.pdf')
    expect(sanitizeSafeUrl('http://example.com/license.pdf')).toBe('http://example.com/license.pdf')
    expect(isSafeUrl('https://kingdomdash.net/storage/v1/object/public/licenses/doc.pdf')).toBe(true)
  })

  it('allows relative path URLs starting with /', () => {
    expect(sanitizeSafeUrl('/storage/licenses/doc.pdf')).toBe('/storage/licenses/doc.pdf')
    expect(isSafeUrl('/storage/licenses/doc.pdf')).toBe(true)
  })

  it('blocks javascript: URI schemes and returns empty string', () => {
    expect(sanitizeSafeUrl('javascript:alert(1)')).toBe('')
    expect(sanitizeSafeUrl('JAVASCRIPT:alert(document.cookie)')).toBe('')
    expect(sanitizeSafeUrl('  javascript:void(0)  ')).toBe('')
    expect(isSafeUrl('javascript:alert(1)')).toBe(false)
  })

  it('blocks data: URI schemes', () => {
    expect(sanitizeSafeUrl('data:text/html,<script>alert(1)</script>')).toBe('')
    expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
  })

  it('blocks vbscript: and file: schemes', () => {
    expect(sanitizeSafeUrl('vbscript:msgbox(1)')).toBe('')
    expect(sanitizeSafeUrl('file:///etc/passwd')).toBe('')
    expect(isSafeUrl('vbscript:msgbox(1)')).toBe(false)
  })

  it('handles null, undefined, and non-string inputs safely', () => {
    expect(sanitizeSafeUrl(null)).toBe('')
    expect(sanitizeSafeUrl(undefined)).toBe('')
    expect(sanitizeSafeUrl('')).toBe('')
    expect(isSafeUrl(null)).toBe(false)
    expect(isSafeUrl(undefined)).toBe(false)
  })

  it('strips control characters and tabs embedded in protocol', () => {
    expect(sanitizeSafeUrl('java\tscript:alert(1)')).toBe('')
    expect(isSafeUrl('java\tscript:alert(1)')).toBe(false)
  })
})
