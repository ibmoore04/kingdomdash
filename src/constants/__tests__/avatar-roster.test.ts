import { describe, it, expect } from 'vitest'
import {
  KINGDOMDASH_AVATAR_ROSTER,
  getDefaultAvatar,
  getAvatarByUrlOrId,
  isGeneratedAvatar,
} from '../avatar-roster'

describe('KingdomDash Avatar Roster & Generator Engine', () => {
  it('contains 12 curated characters with both 3D vinyl dolls and anime personas', () => {
    expect(KINGDOMDASH_AVATAR_ROSTER.length).toBe(12)

    const dolls = KINGDOMDASH_AVATAR_ROSTER.filter((c) => c.type === 'doll')
    const anime = KINGDOMDASH_AVATAR_ROSTER.filter((c) => c.type === 'anime')

    expect(dolls.length).toBeGreaterThanOrEqual(4)
    expect(anime.length).toBeGreaterThanOrEqual(5)

    // Ensure all characters have unique IDs and valid avatar URLs
    const ids = new Set()
    for (const char of KINGDOMDASH_AVATAR_ROSTER) {
      expect(ids.has(char.id)).toBe(false)
      ids.add(char.id)
      expect(char.name).toBeTruthy()
      expect(char.avatarUrl).toMatch(/^\/avatars\/characters\/.+\.(jpg|svg|png)$/)
      expect(char.title).toBeTruthy()
      expect(char.description).toBeTruthy()
    }
  })

  it('deterministically assigns the same avatar for the same user ID', () => {
    const userA = 'user-uuid-12345'
    const char1 = getDefaultAvatar(userA)
    const char2 = getDefaultAvatar(userA)

    expect(char1.id).toBe(char2.id)
    expect(char1.name).toBe(char2.name)
  })

  it('distributes avatars across different user IDs', () => {
    const avatars = new Set<string>()
    for (let i = 0; i < 20; i++) {
      const char = getDefaultAvatar(`user-test-id-${i}`)
      avatars.add(char.id)
    }

    // Should assign multiple distinct characters
    expect(avatars.size).toBeGreaterThan(1)
  })

  it('respects role biasing for riders and vendors', () => {
    const riderChar = getDefaultAvatar('any-rider-id', 'Rider Dave', 'rider')
    expect(riderChar.recommendedRoles).toContain('rider')

    const vendorChar = getDefaultAvatar('any-vendor-id', 'Vendor Mama', 'vendor')
    expect(vendorChar.recommendedRoles).toContain('vendor')
  })

  it('correctly resolves characters by ID or URL', () => {
    const foundById = getAvatarByUrlOrId('royal-doll-prince')
    expect(foundById?.name).toBe('Prince Malik')

    const foundByUrl = getAvatarByUrlOrId('/avatars/characters/royal-doll-princess.jpg')
    expect(foundByUrl?.name).toBe('Princess Tiara')

    expect(getAvatarByUrlOrId('unknown-id')).toBeUndefined()
  })

  it('identifies official KingdomDash generated avatars', () => {
    expect(isGeneratedAvatar('/avatars/characters/royal-doll-prince.jpg')).toBe(true)
    expect(isGeneratedAvatar('anime-swift-rider')).toBe(true)
    expect(isGeneratedAvatar('https://external.com/my-pic.jpg')).toBe(false)
    expect(isGeneratedAvatar(null)).toBe(false)
  })
})
