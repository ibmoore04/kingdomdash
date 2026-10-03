import { Gift, Sparkles, Trophy, CheckCircle2 } from 'lucide-react'
import { formatNgn } from '@/utils/formatting'
import { cn } from '@/lib/cn'

export interface CartMilestoneMeterProps {
  subtotal: number
  className?: string
}

export function CartMilestoneMeter({ subtotal, className }: CartMilestoneMeterProps) {
  const TIER_1_TARGET = 5000
  const TIER_2_TARGET = 10000

  const isTier1Unlocked = subtotal >= TIER_1_TARGET
  const isTier2Unlocked = subtotal >= TIER_2_TARGET

  const remainingToTier1 = Math.max(0, TIER_1_TARGET - subtotal)
  const remainingToTier2 = Math.max(0, TIER_2_TARGET - subtotal)

  const progressPercentage = Math.min(
    100,
    Math.round((subtotal / TIER_2_TARGET) * 100)
  )

  return (
    <div
      data-testid="cart-milestone-meter"
      className={cn(
        'relative overflow-hidden rounded-2xl border p-4 transition-all duration-300',
        isTier2Unlocked
          ? 'border-amber-400/60 bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-primary/10 shadow-xs'
          : isTier1Unlocked
          ? 'border-primary/30 bg-primary/5 shadow-xs'
          : 'border-neutral-200 bg-neutral-50/80',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors shadow-2xs',
              isTier2Unlocked
                ? 'bg-amber-500 text-white'
                : isTier1Unlocked
                ? 'bg-primary text-white'
                : 'bg-neutral-200 text-neutral-600'
            )}
          >
            {isTier2Unlocked ? (
              <Trophy className="h-4 w-4" aria-hidden="true" />
            ) : isTier1Unlocked ? (
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Gift className="h-4 w-4" aria-hidden="true" />
            )}
          </div>

          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-primary block">
              {isTier2Unlocked
                ? 'VIP Rewards Unlocked'
                : isTier1Unlocked
                ? 'Milestone 1 Unlocked'
                : 'Loyalty Rewards'}
            </span>
            <p className="text-xs font-bold text-neutral-900 leading-snug">
              {isTier2Unlocked ? (
                <span className="text-amber-800">
                  🎉 VIP Tier Achieved: 350 Loyalty Points + Priority Dispatch!
                </span>
              ) : isTier1Unlocked ? (
                <span>
                  150 Points Unlocked! Add{' '}
                  <strong className="text-primary font-mono">{formatNgn(remainingToTier2)}</strong>{' '}
                  for VIP Dispatch
                </span>
              ) : (
                <span>
                  Add{' '}
                  <strong className="text-primary font-mono">{formatNgn(remainingToTier1)}</strong>{' '}
                  more to earn <strong className="text-neutral-900">150 Loyalty Points</strong>
                </span>
              )}
            </p>
          </div>
        </div>

        {isTier1Unlocked && (
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200 shadow-2xs shrink-0">
            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            <span>Unlocked</span>
          </span>
        )}
      </div>

      {/* Progress Bar */}
      <div className="mt-3.5 space-y-1">
        <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200/90 shadow-inner">
          <div
            data-testid="milestone-progress-bar"
            className={cn(
              'h-full rounded-full transition-all duration-500 ease-out',
              isTier2Unlocked
                ? 'bg-gradient-to-r from-primary via-amber-500 to-amber-400'
                : 'bg-gradient-to-r from-primary to-primary-hover'
            )}
            style={{ width: `${progressPercentage}%` }}
          />
        </div>

        {/* Milestone Threshold Labels */}
        <div className="flex items-center justify-between text-[10px] font-semibold text-neutral-400 px-0.5 pt-0.5">
          <span>₦0</span>
          <span
            className={cn(
              'transition-colors',
              isTier1Unlocked ? 'text-primary font-bold' : ''
            )}
          >
            ₦5,000 (150 Pts)
          </span>
          <span
            className={cn(
              'transition-colors',
              isTier2Unlocked ? 'text-amber-700 font-bold' : ''
            )}
          >
            ₦10,000 (VIP)
          </span>
        </div>
      </div>
    </div>
  )
}
