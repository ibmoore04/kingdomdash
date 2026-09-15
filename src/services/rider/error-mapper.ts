/**
 * Translates PostgreSQL custom SQLSTATE codes and error objects from
 * authoritative KingdomDash RPCs into user-friendly error messages.
 */
export function mapRiderRpcError(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return 'An unexpected error occurred. Please retry.'
  }

  const pgError = error as { code?: string; message?: string; details?: string }
  const message = pgError.message || ''

  switch (pgError.code) {
    case 'KD400':
      return message || 'Invalid operation parameters. Please check your input.'
    case 'KD403':
      if (message.includes('not verified or active')) {
        return 'Your rider account is not yet verified or has been suspended. Please contact support.'
      }
      return message || 'Access denied. You are not authorized to perform this operation.'
    case 'KD404':
      return message || 'The requested assignment or delivery could not be found.'
    case 'KD409':
      if (message.includes('still being prepared')) {
        return 'The vendor is still preparing this order. Pickup is not yet permitted.'
      }
      if (message.includes('already has an active')) {
        return 'You already have an active delivery in progress. Complete it before taking another.'
      }
      if (message.includes('Cannot accept assignment')) {
        return 'This delivery assignment is no longer available or was already processed.'
      }
      if (message.includes('Cannot become available while active delivery is in flight')) {
        return 'Cannot set status to available while an active delivery is currently in flight.'
      }
      return message || 'Operation conflict. The delivery state has changed.'
    default:
      return message || 'Network error or server timeout. Please check your connection.'
  }
}
