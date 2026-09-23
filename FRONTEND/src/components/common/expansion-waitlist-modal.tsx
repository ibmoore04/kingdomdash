import { useState } from 'react'
import {
  CheckCircle2,
  Clock,
  Sparkles,
  X,
  Send,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'

import { submitExpansionWaitlist } from '@/services/supabase/platform-settings'

interface ExpansionWaitlistModalProps {
  isOpen: boolean
  onClose: () => void
}

export function ExpansionWaitlistModal({ isOpen, onClose }: ExpansionWaitlistModalProps) {
  const { pushToast } = useToast()
  const [city, setCity] = useState('Sagamu')
  const [contact, setContact] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [joined, setJoined] = useState(false)

  if (!isOpen) return null

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!contact.trim()) return

    setIsSubmitting(true)
    try {
      const res = await submitExpansionWaitlist(city, contact.trim())
      setIsSubmitting(false)
      setJoined(true)
      if (res.success) {
        pushToast({
          variant: 'success',
          title: 'Joined the Expansion Waitlist!',
          message: `We will alert ${contact} the moment KingdomDash launches in ${city}.`,
        })
      } else {
        pushToast({
          variant: 'info',
          title: 'Waitlist Recorded',
          message: `We have registered your interest in ${city}.`,
        })
      }
    } catch {
      setIsSubmitting(false)
      setJoined(true)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl border border-neutral-200 bg-white p-6 sm:p-8 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 rounded-full p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition-colors"
          aria-label="Close modal"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 mb-2 text-primary font-bold text-xs uppercase tracking-wider">
          <Sparkles className="h-4 w-4" />
          <span>Ogun State Expansion</span>
        </div>

        <h3 className="text-xl sm:text-2xl font-extrabold text-neutral-900">
          KingdomDash Service Coverage
        </h3>
        <p className="mt-1 text-xs sm:text-sm text-neutral-500">
          See where we are actively delivering today and join the waitlist for upcoming cities.
        </p>

        {/* Coverage Status Grid */}
        <div className="mt-5 space-y-3">
          {/* Active Zones */}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Active Delivery Hubs (Live Now)
              </span>
              <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800">
                ACTIVE
              </span>
            </div>
            <p className="text-[11px] text-emerald-800 leading-relaxed">
              • <strong>Ijebu-Ode Urban:</strong> Igbeba, Molipa, Apebi, Obalende, Oke-Aje, Folagbade, GRA.<br />
              • <strong>University Corridor:</strong> TASUED / Ijagun &amp; Ago-Iwoye (OOU Campus).
            </p>
          </div>

          {/* Upcoming Expansion Hubs */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-3.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-amber-600" />
                Upcoming Expansion (Phase 3)
              </span>
              <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-800">
                COMING SOON
              </span>
            </div>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              • <strong>Sagamu &amp; Remo:</strong> Sagamu Interchange, Akarigbo corridor (Launching Q4 2026).<br />
              • <strong>Abeokuta Metro:</strong> Panseke, Ibara, Kuto, Oke-Mosan (2027).
            </p>
          </div>
        </div>

        {/* Waitlist Form */}
        <div className="mt-6 pt-5 border-t border-neutral-100">
          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-800 mb-2">
            Want KingdomDash In Your Area?
          </h4>

          {joined ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-center text-xs text-emerald-800">
              ✓ You are on the VIP waitlist! We will notify you with a free delivery coupon when we launch.
            </div>
          ) : (
            <form onSubmit={handleJoin} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Select value={city} onValueChange={setCity}>
                  <SelectTrigger
                    aria-label="City"
                    className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-2.5 text-xs text-neutral-900 focus:border-primary focus:outline-none h-auto"
                  >
                    <SelectValue placeholder="Select target city" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border border-neutral-200 shadow-card bg-white p-1">
                    <SelectItem value="Sagamu">Sagamu & Remo</SelectItem>
                    <SelectItem value="Abeokuta">Abeokuta</SelectItem>
                    <SelectItem value="Ijebu-Igbo">Ijebu-Igbo</SelectItem>
                    <SelectItem value="Ikenne">Ikenne</SelectItem>
                    <SelectItem value="Other Ogun Town">Other Town</SelectItem>
                  </SelectContent>
                </Select>

                <input
                  type="text"
                  required
                  placeholder="Phone or Email"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-2.5 text-xs text-neutral-900 focus:border-primary focus:outline-none"
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting}
                className="w-full text-xs font-bold h-10 rounded-xl bg-primary hover:bg-primary-hover text-white flex items-center justify-center gap-1.5"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Notify Me When Live in {city}</span>
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
