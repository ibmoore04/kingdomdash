import { useState, useEffect } from 'react'
import {
  Gift,
  Award,
  Copy,
  Check,
  Crown,
  Sparkles,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  getLoyaltyAccount,
  fetchLoyaltyAccountFromBackend,
  type LoyaltyAccount,
} from '@/services/loyalty/loyalty-service'
import { formatNgn } from '@/utils/formatting'
import { useToast } from '@/hooks/use-toast'

interface CustomerRewardsTabProps {
  userId: string
  userName?: string
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  // 1. Modern clipboard API
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Fallback below
    }
  }

  // 2. Mobile fallback using temporary textarea
  try {
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.setAttribute('readonly', '')
    textArea.style.position = 'fixed'
    textArea.style.top = '0'
    textArea.style.left = '0'
    textArea.style.width = '2em'
    textArea.style.height = '2em'
    textArea.style.padding = '0'
    textArea.style.border = 'none'
    textArea.style.outline = 'none'
    textArea.style.boxShadow = 'none'
    textArea.style.background = 'transparent'
    textArea.style.opacity = '0.01'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    textArea.setSelectionRange(0, 99999)
    const successful = document.execCommand('copy')
    document.body.removeChild(textArea)
    return successful
  } catch {
    return false
  }
}

export function CustomerRewardsTab({ userId, userName }: CustomerRewardsTabProps) {
  const { pushToast } = useToast()
  const [account, setAccount] = useState<LoyaltyAccount>(() => getLoyaltyAccount(userId))
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  useEffect(() => {
    let isMounted = true
    setAccount(getLoyaltyAccount(userId))

    if (userId) {
      fetchLoyaltyAccountFromBackend(userId).then((serverAccount) => {
        if (isMounted && serverAccount) {
          setAccount(serverAccount)
        }
      }).catch(() => {
        // Keep local cache on network failure
      })
    }

    return () => {
      isMounted = false
    }
  }, [userId])

  const referralUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/register?ref=${account.referralCode}`

  const handleCopyCode = async () => {
    const success = await copyTextToClipboard(account.referralCode)
    if (success) {
      setCopiedCode(true)
      pushToast({
        variant: 'success',
        title: 'Referral Code Copied!',
        message: `${account.referralCode} copied to clipboard.`,
      })
      setTimeout(() => setCopiedCode(false), 2500)
    } else {
      pushToast({
        variant: 'info',
        title: 'Referral Code',
        message: account.referralCode,
      })
    }
  }

  const handleCopyLink = async () => {
    const success = await copyTextToClipboard(referralUrl)
    if (success) {
      setCopiedLink(true)
      pushToast({
        variant: 'success',
        title: 'Referral Link Copied!',
        message: 'Share this link with friends to earn ₦500 credit.',
      })
      setTimeout(() => setCopiedLink(false), 2500)
    } else {
      pushToast({
        variant: 'info',
        title: 'Referral Link',
        message: referralUrl,
      })
    }
  }

  const handleShareWhatsApp = () => {
    const messageLines = [
      '⚡ *Order Food & Groceries in Ijebu-Ode on KingdomDash!*',
      '',
      `Hey! I'm gifting you *₦500 FREE delivery credit* on your first order with KingdomDash.`,
      '',
      '🍔 Fast 30-min deliveries from top restaurants',
      '🛒 Fresh groceries from Oke-Aje & Ita-Osu markets',
      '📦 On-demand courier dispatches across Ijebu-Ode',
      '',
      `🎁 Use My Referral Code: *${account.referralCode}*`,
      '',
      '👉 *Claim your ₦500 bonus credit here:*',
      referralUrl,
    ]
    const text = encodeURIComponent(messageLines.join('\n'))
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer')
  }

  // Tier progress calculation
  const currentLifetime = account.lifetimePoints
  const nextTierPoints = account.tier === 'Bronze' ? 500 : account.tier === 'Silver' ? 1500 : 3000
  const progressPercent = Math.min(100, Math.round((currentLifetime / nextTierPoints) * 100))

  return (
    <div className="space-y-6">
      {/* 1. Header Banner: Tier & Points Overview */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-neutral-900 via-neutral-850 to-neutral-900 text-white p-6 sm:p-8 shadow-md">
        <div className="absolute -right-8 -bottom-8 h-48 w-48 rounded-full bg-primary/20 blur-2xl pointer-events-none" />
        <div className="absolute right-6 top-6 opacity-10">
          <Crown className="h-28 w-28 text-white" />
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-primary backdrop-blur-xs mb-3">
              <Sparkles className="h-3.5 w-3.5" />
              <span>KingdomDash Rewards</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {userName ? `${userName}'s Rewards` : 'My Rewards & Loyalty'}
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-neutral-300 max-w-md">
              Earn DashPoints on every order in Ijebu-Ode and redeem for delivery discounts.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5 backdrop-blur-md min-w-[200px] text-center sm:text-right">
            <span className="text-[11px] uppercase tracking-wider text-neutral-400 font-bold block">
              Available DashPoints
            </span>
            <div className="mt-1 flex items-baseline justify-center sm:justify-end gap-1.5">
              <span className="text-3xl sm:text-4xl font-extrabold text-primary">
                {account.pointsBalance}
              </span>
              <span className="text-xs text-neutral-300 font-semibold">pts</span>
            </div>
            <p className="mt-1 text-[11px] text-neutral-400">
              Worth {formatNgn(account.pointsBalance)} at checkout
            </p>
          </div>
        </div>

        {/* Tier Progress Bar */}
        <div className="relative z-10 mt-6 pt-6 border-t border-white/10">
          <div className="flex items-center justify-between text-xs mb-2">
            <div className="flex items-center gap-1.5 font-bold">
              <Award className="h-4 w-4 text-primary" />
              <span>Current Tier: {account.tier} Member</span>
            </div>
            <span className="text-neutral-400">
              {account.lifetimePoints} / {nextTierPoints} lifetime pts
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="mt-2 text-[11px] text-neutral-400">
            {account.tier === 'Gold'
              ? '★ You have achieved Gold status! Enjoy 1.5x points and free priority dispatch.'
              : `Earn ${nextTierPoints - currentLifetime} more points to reach ${
                  account.tier === 'Bronze' ? 'Silver' : 'Gold'
                } status.`}
          </p>
        </div>
      </div>

      {/* 2. Referral Programme */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-800 shrink-0">
                <Gift className="h-5 w-5" />
              </div>
              <span className="rounded-full bg-amber-50 border border-amber-200 px-3 py-0.5 text-xs font-bold text-amber-800">
                Give ₦500, Get ₦500
              </span>
            </div>

            <h3 className="text-xl font-bold text-neutral-900">
              Refer Friends in Ijebu-Ode
            </h3>
            <p className="mt-1 text-xs sm:text-sm text-neutral-500 max-w-xl">
              Share your referral code with friends and family. When they sign up and place their first order, they get ₦500 off and you earn ₦500 delivery credits + 250 DashPoints!
            </p>

            {/* Code Box & Selectable Link */}
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold block">
                    Your Referral Code
                  </span>
                  <span className="font-mono text-base font-extrabold text-neutral-900 tracking-wider">
                    {account.referralCode}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyCode}
                  className="h-8 gap-1.5 text-xs font-bold"
                >
                  {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                </Button>
              </div>

              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 flex items-center justify-between">
                <div className="min-w-0 flex-1 mr-2">
                  <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold block truncate">
                    Shareable Link
                  </span>
                  <input
                    type="text"
                    readOnly
                    value={referralUrl}
                    onFocus={(e) => e.target.select()}
                    className="w-full bg-transparent text-xs font-mono text-neutral-700 select-all focus:outline-none truncate"
                    aria-label="Your shareable referral link"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyLink}
                  className="h-8 shrink-0 px-2.5 text-xs font-bold gap-1"
                >
                  {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Stats and WhatsApp Action */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-4 lg:w-72 shrink-0 border-t lg:border-t-0 lg:border-l border-neutral-100 pt-5 lg:pt-0 lg:pl-6 justify-center">
            <div className="grid grid-cols-2 gap-3 text-center flex-1">
              <div className="rounded-xl bg-neutral-50 p-3 border border-neutral-100">
                <span className="text-[10px] text-neutral-400 font-semibold block uppercase">
                  Friends Invited
                </span>
                <span className="text-xl font-extrabold text-neutral-900">
                  {account.referredCount}
                </span>
              </div>
              <div className="rounded-xl bg-neutral-50 p-3 border border-neutral-100">
                <span className="text-[10px] text-neutral-400 font-semibold block uppercase">
                  Bonus Earned
                </span>
                <span className="text-xl font-extrabold text-primary">
                  {formatNgn(account.referralCreditsNgn)}
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="primary"
              onClick={handleShareWhatsApp}
              className="w-full bg-[#25D366] hover:bg-[#1EBE5D] text-white text-xs font-bold gap-2 border-none h-11 shadow-xs"
            >
              <ExternalLink className="h-4 w-4" />
              <span>Share on WhatsApp (+₦500 Bonus)</span>
            </Button>
          </div>
        </div>
      </div>

      {/* 3. Transaction History */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6 shadow-xs">
        <h3 className="text-base font-bold text-neutral-900 mb-4">
          DashPoints Activity History
        </h3>

        {account.transactions.length === 0 ? (
          <p className="text-xs text-neutral-400 py-6 text-center">
            No points activity recorded yet. Place your first order to start earning!
          </p>
        ) : (
          <div className="divide-y divide-neutral-100">
            {account.transactions.map((tx) => (
              <div key={tx.id} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <p className="font-semibold text-neutral-900">{tx.description}</p>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    {new Date(tx.date).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <span
                  className={`font-bold font-mono text-xs ${
                    tx.points > 0 ? 'text-emerald-600' : 'text-neutral-700'
                  }`}
                >
                  {tx.points > 0 ? `+${tx.points}` : tx.points} pts
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
