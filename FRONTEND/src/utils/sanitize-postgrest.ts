/**
 * PostgREST Search Term Sanitizer
 *
 * Strips special grammar characters (commas, parentheses, quotes, backslashes, percent signs)
 * and PostgREST operator keywords that alter PostgREST filter interpretation or cause
 * 400 Bad Request query parse errors / filter injection.
 */
export function sanitizePostgrestSearch(input?: string | null): string {
  if (!input || typeof input !== 'string') return ''

  let cleaned = input
    // Strip PostgREST filter operator patterns like .ilike. or .eq.
    .replace(/\.(eq|neq|gt|gte|lt|lte|like|ilike|is|in|cs|cd|ov|sl|sr|nxr|nxl|adj)\./gi, ' ')
    // Strip control grammar characters that affect PostgREST AST parsing, quotes, or wildcards
    .replace(/[,()'"\\[\]%*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  // Cap at 100 characters to prevent excessive query complexity
  if (cleaned.length > 100) {
    cleaned = cleaned.slice(0, 100).trim()
  }

  return cleaned
}

/**
 * Helper to construct safe PostgREST `.or(...)` query strings
 */
export function buildOrFilter(searchTerm: string, columns: string[]): string {
  const sanitized = sanitizePostgrestSearch(searchTerm)
  if (!sanitized || columns.length === 0) return ''

  return columns
    .map((col) => `${col}.ilike.%${sanitized}%`)
    .join(',')
}
