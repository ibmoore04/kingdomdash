import { describe, it, expect } from 'vitest'
import {
  normalizePhoneNumber,
  validatePhoneNumber,
  formatPhoneDisplay,
} from '../phone'

describe('Phone utility', () => {
  describe('normalizePhoneNumber', () => {
    it('normalizes local Nigerian 11-digit numbers starting with 0', () => {
      expect(normalizePhoneNumber('08031234567')).toBe('+2348031234567')
      expect(normalizePhoneNumber('09012345678')).toBe('+2349012345678')
      expect(normalizePhoneNumber('07089876543')).toBe('+2347089876543')
    })

    it('handles whitespace, hyphens, and parentheses in Nigerian numbers', () => {
      expect(normalizePhoneNumber('0803 123 4567')).toBe('+2348031234567')
      expect(normalizePhoneNumber('(0803) 123-4567')).toBe('+2348031234567')
      expect(normalizePhoneNumber('+234 803 123 4567')).toBe('+2348031234567')
      expect(normalizePhoneNumber('2348031234567')).toBe('+2348031234567')
    })

    it('normalizes 10-digit Nigerian mobile numbers without leading zero', () => {
      expect(normalizePhoneNumber('8031234567')).toBe('+2348031234567')
    })

    it('normalizes valid international E.164 numbers', () => {
      expect(normalizePhoneNumber('+12125551234')).toBe('+12125551234')
      expect(normalizePhoneNumber('+447911123456')).toBe('+447911123456')
      expect(normalizePhoneNumber('+233201234567')).toBe('+233201234567')
    })

    it('returns null for invalid inputs', () => {
      expect(normalizePhoneNumber('')).toBeNull()
      expect(normalizePhoneNumber('abc12345')).toBeNull()
      expect(normalizePhoneNumber('12345')).toBeNull() // too short
      expect(normalizePhoneNumber('++2348031234567')).toBeNull()
      expect(normalizePhoneNumber('0803123456789012345')).toBeNull() // too long
    })
  })

  describe('validatePhoneNumber', () => {
    it('validates correct Nigerian phone numbers', () => {
      const res = validatePhoneNumber('08031234567')
      expect(res.isValid).toBe(true)
      expect(res.normalized).toBe('+2348031234567')
      expect(res.error).toBeUndefined()
    })

    it('validates correct formatted Nigerian phone numbers', () => {
      const res = validatePhoneNumber('+234 803 123 4567')
      expect(res.isValid).toBe(true)
      expect(res.normalized).toBe('+2348031234567')
    })

    it('validates international phone numbers', () => {
      const res = validatePhoneNumber('+1 212 555 0199')
      expect(res.isValid).toBe(true)
      expect(res.normalized).toBe('+12125550199')
    })

    it('rejects empty phone input', () => {
      const res = validatePhoneNumber('')
      expect(res.isValid).toBe(false)
      expect(res.error).toBe('Phone number is required')
    })

    it('rejects numbers with non-numeric characters', () => {
      const res = validatePhoneNumber('0803abc1234')
      expect(res.isValid).toBe(false)
      expect(res.error).toContain('only numbers')
    })

    it('rejects incomplete numbers', () => {
      const res = validatePhoneNumber('080312')
      expect(res.isValid).toBe(false)
    })
  })

  describe('formatPhoneDisplay', () => {
    it('formats 14-character Nigerian international number with clean spaces', () => {
      expect(formatPhoneDisplay('+2348031234567')).toBe('+234 803 123 4567')
    })

    it('formats 11-digit local Nigerian number with clean spaces', () => {
      expect(formatPhoneDisplay('08031234567')).toBe('0803 123 4567')
    })

    it('returns original if non-standard or empty', () => {
      expect(formatPhoneDisplay('')).toBe('')
      expect(formatPhoneDisplay('+12125551234')).toBe('+12125551234')
    })
  })
})
