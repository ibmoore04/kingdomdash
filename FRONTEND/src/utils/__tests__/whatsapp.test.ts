import * as fc from 'fast-check'
import { generateWhatsAppLink } from '@/utils/whatsapp'

describe('generateWhatsAppLink', () => {
  // Feature: kingdomdash-phase1-foundation, Property 1: WhatsApp link always starts with the correct base URL
  it('always returns a string starting with https://wa.me/', () => {
    fc.assert(
      fc.property(fc.string(), (message) => {
        const link = generateWhatsAppLink(message)
        return link.startsWith('https://wa.me/')
      }),
      { numRuns: 100 },
    )
  })

  // Feature: kingdomdash-phase1-foundation, Property 2: WhatsApp number segment contains no + or space characters
  it('number segment contains no + or space characters', () => {
    fc.assert(
      fc.property(fc.string(), (message) => {
        const link = generateWhatsAppLink(message)
        const numberSegment = link.slice('https://wa.me/'.length).split('?')[0]
        return !numberSegment.includes('+') && !numberSegment.includes(' ')
      }),
      { numRuns: 100 },
    )
  })

  // Feature: kingdomdash-phase1-foundation, Property 3: Message round-trip encoding
  it('message decodes back to original via searchParams', () => {
    fc.assert(
      fc.property(fc.string(), (message) => {
        const link = generateWhatsAppLink(message)
        const textParam = new URL(link).searchParams.get('text') ?? ''
        return textParam === message
      }),
      { numRuns: 100 },
    )
  })

  // Feature: kingdomdash-phase1-foundation, Property 4: Empty message produces a valid URL without a malformed query string
  it('empty message produces a valid, parseable URL with empty text param', () => {
    const link = generateWhatsAppLink('')
    expect(link.startsWith('https://wa.me/')).toBe(true)
    const url = new URL(link) // throws if malformed
    expect(decodeURIComponent(url.searchParams.get('text') ?? '')).toBe('')
  })
})
