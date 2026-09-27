// Explicit origin allowlist for KingdomDash Edge Functions
const ALLOWED_ORIGINS = [
  'https://kingdomdash.net',
  'https://www.kingdomdash.net',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:4173',
]

/**
 * Returns origin-validated CORS headers.
 * Replaces wildcard '*' with strictly verified allowed domains.
 */
export function getCorsHeaders(req?: Request): Record<string, string> {
  const origin = req?.headers?.get('Origin') || ''
  const isAllowed = ALLOWED_ORIGINS.includes(origin)

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : 'https://kingdomdash.net',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-paystack-signature',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Vary': 'Origin',
  }
}

// Secure default export restricting wildcard to production origin
export const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://kingdomdash.net',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-paystack-signature',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Vary': 'Origin',
}
