import { supabase } from '@/services/supabase/client'

export type LoyaltyTier = 'Bronze' | 'Silver' | 'Gold'

export interface PointTransaction {
  id: string
  date: string
  description: string
  points: number
  type: 'earned' | 'redeemed' | 'bonus'
}

export interface LoyaltyAccount {
  userId: string
  pointsBalance: number
  lifetimePoints: number
  tier: LoyaltyTier
  referralCode: string
  referredCount: number
  referralCreditsNgn: number
  hasActiveKdPass: boolean
  kdPassExpiry?: string | null
  transactions: PointTransaction[]
}

const STORAGE_KEY_PREFIX = 'kingdomdash_loyalty_'
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(id: string): boolean {
  return UUID_REGEX.test(id)
}

export function getTierForPoints(lifetimePoints: number): LoyaltyTier {
  if (lifetimePoints >= 1500) return 'Gold'
  if (lifetimePoints >= 500) return 'Silver'
  return 'Bronze'
}

export function getTierMultiplier(tier: LoyaltyTier): number {
  switch (tier) {
    case 'Gold':
      return 1.5
    case 'Silver':
      return 1.2
    case 'Bronze':
    default:
      return 1.0
  }
}

/**
 * Generates a clean, memorable referral code for a user
 */
export function generateReferralCode(userId: string): string {
  const cleanId = userId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  const suffix = cleanId.slice(-4) || 'DASH'
  return `KD-${suffix}`
}

/**
 * Fetch or initialize a user's loyalty account
 */
export function getLoyaltyAccount(userId: string): LoyaltyAccount {
  if (!userId) {
    return {
      userId: 'guest',
      pointsBalance: 0,
      lifetimePoints: 0,
      tier: 'Bronze',
      referralCode: 'KD-GUEST',
      referredCount: 0,
      referralCreditsNgn: 0,
      hasActiveKdPass: false,
      transactions: [],
    }
  }

  const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${userId}`)
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as LoyaltyAccount
      parsed.tier = getTierForPoints(parsed.lifetimePoints)
      return parsed
    } catch {
      // fallback to default
    }
  }

  const initialAccount: LoyaltyAccount = {
    userId,
    pointsBalance: 150, // Welcome gift of 150 DashPoints
    lifetimePoints: 150,
    tier: 'Bronze',
    referralCode: generateReferralCode(userId),
    referredCount: 0,
    referralCreditsNgn: 0,
    hasActiveKdPass: false,
    kdPassExpiry: null,
    transactions: [
      {
        id: `tx_${Date.now()}`,
        date: new Date().toISOString(),
        description: 'Welcome to KingdomDash Rewards',
        points: 150,
        type: 'bonus',
      },
    ],
  }

  saveLoyaltyAccount(initialAccount)
  return initialAccount
}

export function saveLoyaltyAccount(account: LoyaltyAccount): void {
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${account.userId}`, JSON.stringify(account))
  } catch (err) {
    console.error('[LoyaltyService] Failed to persist loyalty account:', err)
  }
}

/**
 * Calculate DashPoints earned from an order subtotal
 * Rule: 1 DashPoint per ₦100 spent * tier multiplier
/**
 * Background synchronization to Supabase loyalty tables/RPCs
 */
export async function syncLoyaltyToDatabase(
  userId: string,
  points: number,
  type: 'earned' | 'redeemed' | 'bonus',
  description: string
): Promise<{ success: boolean; data?: unknown }> {
  if (!userId || !isUuid(userId)) {
    return { success: false }
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc('add_dashpoints', {
      p_user_id: userId,
      p_points: points,
      p_type: type,
      p_description: description,
    })

    if (error) {
      console.warn('[LoyaltyService] Failed to sync points to Supabase:', error.message)
      return { success: false }
    }

    return { success: true, data }
  } catch (err) {
    console.warn('[LoyaltyService] Error in syncLoyaltyToDatabase:', err)
    return { success: false }
  }
}

/**
 * Fetch and reconcile loyalty account from Supabase database
 */
export async function fetchLoyaltyAccountFromBackend(userId: string): Promise<LoyaltyAccount> {
  const localAccount = getLoyaltyAccount(userId)
  if (!userId || !isUuid(userId)) {
    return localAccount
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any
    const { data: dbAccount, error: accError } = await db
      .from('loyalty_accounts')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (!accError && dbAccount) {
      localAccount.pointsBalance = dbAccount.points_balance ?? localAccount.pointsBalance
      localAccount.lifetimePoints = dbAccount.lifetime_points ?? localAccount.lifetimePoints
      localAccount.tier = (dbAccount.tier as LoyaltyTier) || getTierForPoints(localAccount.lifetimePoints)
      localAccount.referralCreditsNgn = Number(dbAccount.referral_credits_ngn) || localAccount.referralCreditsNgn
      localAccount.referredCount = dbAccount.referred_count ?? localAccount.referredCount
      localAccount.hasActiveKdPass = Boolean(dbAccount.has_active_kd_pass)
      localAccount.kdPassExpiry = dbAccount.kd_pass_expiry || null
    }

    // Also fetch transactions if available
    const { data: dbTxs } = await db
      .from('loyalty_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)

    if (dbTxs && dbTxs.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      localAccount.transactions = dbTxs.map((t: any) => ({
        id: t.id,
        date: t.created_at,
        description: t.description,
        points: t.points,
        type: t.type,
      }))
    }

    saveLoyaltyAccount(localAccount)
  } catch (err) {
    console.warn('[LoyaltyService] Error fetching loyalty account from backend:', err)
  }

  return localAccount
}

/**
 * Calculate DashPoints earned from an order subtotal
 * Rule: 1 DashPoint per ₦100 spent * tier multiplier
 */
export function calculatePointsEarned(subtotalNgn: number, tier: LoyaltyTier = 'Bronze'): number {
  if (subtotalNgn <= 0) return 0
  const basePoints = Math.floor(subtotalNgn / 100)
  const multiplier = getTierMultiplier(tier)
  return Math.round(basePoints * multiplier)
}

/**
 * Credit DashPoints upon order completion
 */
export function creditOrderPoints(
  userId: string,
  subtotalNgn: number,
  orderId: string
): { pointsEarned: number; newBalance: number } {
  const account = getLoyaltyAccount(userId)
  const earned = calculatePointsEarned(subtotalNgn, account.tier)

  if (earned <= 0) return { pointsEarned: 0, newBalance: account.pointsBalance }

  account.pointsBalance += earned
  account.lifetimePoints += earned
  account.tier = getTierForPoints(account.lifetimePoints)
  const desc = `Order #${orderId.slice(-6).toUpperCase()} points`
  account.transactions.unshift({
    id: `tx_${Date.now()}`,
    date: new Date().toISOString(),
    description: desc,
    points: earned,
    type: 'earned',
  })

  saveLoyaltyAccount(account)

  if (isUuid(userId)) {
    void syncLoyaltyToDatabase(userId, earned, 'earned', desc)
  }

  return { pointsEarned: earned, newBalance: account.pointsBalance }
}

/**
 * Redeem DashPoints at checkout (1 DashPoint = ₦1 discount)
 */
export function redeemPoints(
  userId: string,
  pointsToRedeem: number,
  maxAllowedDiscount: number
): { success: boolean; discountNgn: number; error?: string } {
  const account = getLoyaltyAccount(userId)

  if (pointsToRedeem <= 0) {
    return { success: false, discountNgn: 0, error: 'Points to redeem must be greater than 0.' }
  }

  if (pointsToRedeem > account.pointsBalance) {
    return { success: false, discountNgn: 0, error: `You only have ${account.pointsBalance} DashPoints available.` }
  }

  const requestedDiscount = pointsToRedeem // 1 pt = ₦1
  const effectiveDiscount = Math.min(requestedDiscount, maxAllowedDiscount)
  const effectivePoints = effectiveDiscount

  account.pointsBalance -= effectivePoints
  const desc = `Checkout discount applied`
  account.transactions.unshift({
    id: `tx_${Date.now()}`,
    date: new Date().toISOString(),
    description: desc,
    points: -effectivePoints,
    type: 'redeemed',
  })

  saveLoyaltyAccount(account)

  if (isUuid(userId)) {
    void syncLoyaltyToDatabase(userId, -effectivePoints, 'redeemed', desc)
  }

  return { success: true, discountNgn: effectiveDiscount }
}

/**
 * Toggle or subscribe to KD Pass
 */
export function toggleKdPassSubscription(userId: string, enable: boolean): LoyaltyAccount {
  const account = getLoyaltyAccount(userId)
  account.hasActiveKdPass = enable
  if (enable) {
    const nextMonth = new Date()
    nextMonth.setDate(nextMonth.getDate() + 30)
    account.kdPassExpiry = nextMonth.toISOString()
  } else {
    account.kdPassExpiry = null
  }

  saveLoyaltyAccount(account)
  return account
}

/**
 * Claim referral reward
 */
export function applyReferralBonus(userId: string, friendName: string): LoyaltyAccount {
  const account = getLoyaltyAccount(userId)
  const bonusCredits = 500 // ₦500 referral credit
  const bonusPoints = 250 // + 250 DashPoints

  account.referredCount += 1
  account.referralCreditsNgn += bonusCredits
  account.pointsBalance += bonusPoints
  account.lifetimePoints += bonusPoints
  account.tier = getTierForPoints(account.lifetimePoints)

  const desc = `Referral bonus for ${friendName}`
  account.transactions.unshift({
    id: `tx_${Date.now()}`,
    date: new Date().toISOString(),
    description: desc,
    points: bonusPoints,
    type: 'bonus',
  })

  saveLoyaltyAccount(account)

  if (isUuid(userId)) {
    void syncLoyaltyToDatabase(userId, bonusPoints, 'bonus', desc)
  }

  return account
}
