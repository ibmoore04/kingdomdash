import { useState, useEffect } from 'react'
import {
  Building2,
  ShieldCheck,
  TrendingDown,
  CheckCircle2,
  ArrowRight,
  Calculator,
  Send,
  Sparkles,
  PhoneCall,
  Users,
} from 'lucide-react'
import { PageContainer } from '@/components/layout/section'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatNgn } from '@/utils/formatting'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/services/supabase/client'
import { appConfig } from '@/config/app.config'
import { generateWhatsAppLink } from '@/utils/whatsapp'

interface VolumeTier {
  range: string
  minVolume: number
  discountPercent: number
  ratePerDelivery: number
}

const VOLUME_TIERS: VolumeTier[] = [
  { range: '20 - 50 parcels / mo', minVolume: 35, discountPercent: 10, ratePerDelivery: 720 },
  { range: '51 - 150 parcels / mo', minVolume: 100, discountPercent: 18, ratePerDelivery: 650 },
  { range: '151 - 400 parcels / mo', minVolume: 250, discountPercent: 25, ratePerDelivery: 600 },
  { range: '400+ parcels / mo', minVolume: 500, discountPercent: 32, ratePerDelivery: 540 },
]

export default function BusinessPage() {
  const { pushToast } = useToast()

  useEffect(() => {
    document.title = 'Corporate & Business Courier — KingdomDash'
  }, [])

  // Calculator state
  const [selectedTierIndex, setSelectedTierIndex] = useState(1) // 51 - 150
  const [monthlyVolume, setMonthlyVolume] = useState(100)
  const [businessType, setBusinessType] = useState('E-commerce & Retail')

  // Form state
  const [companyName, setCompanyName] = useState('')
  const [contactName, setContactName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const activeTier = VOLUME_TIERS[selectedTierIndex]
  const standardCost = monthlyVolume * 800
  const discountedCost = monthlyVolume * activeTier.ratePerDelivery
  const estimatedSavings = standardCost - discountedCost

  const handleTierChange = (index: number) => {
    setSelectedTierIndex(index)
    setMonthlyVolume(VOLUME_TIERS[index].minVolume)
  }

  const handleSubmitInquiry = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyName.trim() || !contactName.trim() || !phone.trim()) {
      pushToast({
        variant: 'error',
        title: 'Required Fields',
        message: 'Please provide company name, contact person and phone number.',
      })
      return
    }

    setIsSubmitting(true)
    try {
      const leadPayload = {
        company_name: companyName.trim(),
        contact_name: contactName.trim(),
        email: email.trim() || 'contact@business.com',
        phone: phone.trim(),
        address: address.trim() || null,
        business_type: businessType,
        estimated_volume: `${monthlyVolume} deliveries/mo`,
        notes: notes.trim() || null,
        status: 'pending' as const,
      }

      // 1. Submit lead directly to Supabase (RPC first, then table insert fallback)
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rpcRes = await (supabase.rpc as any)('submit_corporate_lead', {
          p_company_name: leadPayload.company_name,
          p_contact_name: leadPayload.contact_name,
          p_email: leadPayload.email,
          p_phone: leadPayload.phone,
          p_address: leadPayload.address,
          p_business_type: leadPayload.business_type,
          p_estimated_volume: leadPayload.estimated_volume,
          p_notes: leadPayload.notes,
        })
        if (rpcRes?.error) {
          // Direct table insert fallback
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).from('corporate_leads').insert(leadPayload)
        }
      } catch (err) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).from('corporate_leads').insert(leadPayload)
        } catch (tableErr) {
          console.warn('Failed to submit corporate lead to Supabase:', tableErr)
        }
      }

      // 2. Persist corporate lead to local storage as client cache (both camelCase and snake_case)
      const existingLeads = JSON.parse(localStorage.getItem('kingdomdash_corporate_leads') || '[]')
      const newLead = {
        id: `corp_${Date.now()}`,
        ...leadPayload,
        companyName: leadPayload.company_name,
        contactName: leadPayload.contact_name,
        businessType: leadPayload.business_type,
        estimatedVolume: monthlyVolume,
        createdAt: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      existingLeads.unshift(newLead)
      localStorage.setItem('kingdomdash_corporate_leads', JSON.stringify(existingLeads))

      // 3. Dispatch local notification cache
      try {
        const notifs = JSON.parse(localStorage.getItem('kd_admin_notifications_cache') || '[]')
        notifs.unshift({
          id: `notif_${newLead.id}`,
          title: `🏢 Corporate Account Lead: ${companyName}`,
          message: `${contactName} (${phone} • ${email || 'No email'}) requested business courier account for ${businessType} (~${monthlyVolume} deliveries/mo). Address: ${address || 'Ijebu-Ode'}${notes ? `. Notes: ${notes}` : ''}`,
          severity: 'info',
          is_read: false,
          category: 'application',
          action_href: '/admin/users?tab=corporate',
          action_label: 'View Corporate Leads',
          created_at: new Date().toISOString(),
        })
        localStorage.setItem('kd_admin_notifications_cache', JSON.stringify(notifs))
      } catch (e) {
        console.error('Failed to dispatch corporate admin notification cache', e)
      }

      setIsSubmitting(false)
      setSubmitted(true)
      pushToast({
        variant: 'success',
        title: 'Inquiry Received!',
        message: 'Our corporate account manager will contact you within 2 business hours.',
      })
    } catch {
      setIsSubmitting(false)
      setSubmitted(true)
    }
  }

  const handleDirectWhatsApp = () => {
    const text = `Hello KingdomDash Corporate Team, I am interested in opening a business courier account for ${companyName || 'my company'} in Ijebu-Ode. Estimated monthly volume: ${monthlyVolume} deliveries.`
    window.open(generateWhatsAppLink(text), '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="bg-neutral-50/40 min-h-screen py-10 sm:py-16">
      <PageContainer>
        {/* ─── 1. HERO SECTION ────────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-3xl bg-neutral-900 text-white p-8 sm:p-12 lg:p-16 mb-12 shadow-xl">
          <div className="absolute -right-16 -top-16 h-80 w-80 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
          <div className="absolute left-1/2 -bottom-20 h-72 w-72 rounded-full bg-primary/15 blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-primary backdrop-blur-xs mb-4">
              <Building2 className="h-4 w-4" />
              <span>Enterprise Logistics &amp; Courier Portal</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Scale Your Business Deliveries in Ijebu-Ode.
            </h1>

            <p className="mt-4 text-sm sm:text-base text-neutral-300 leading-relaxed max-w-2xl">
              From boutiques and pharmacies to supermarkets and corporate offices, KingdomDash provides dedicated riders, volume discounts, consolidated monthly billing, and priority dispatch.
            </p>

            <div className="mt-8 flex flex-wrap gap-4 items-center">
              <Button
                asChild
                variant="primary"
                size="lg"
                className="rounded-xl font-bold bg-primary hover:bg-primary-hover text-white px-6 h-12 shadow-md hover:shadow-lg"
              >
                <a href="#quote-calculator">
                  <span>Calculate Business Rates</span>
                  <ArrowRight className="h-4 w-4 ml-2" />
                </a>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={handleDirectWhatsApp}
                className="rounded-xl border-white/20 bg-white/10 hover:bg-white/20 text-white font-bold px-6 h-12 backdrop-blur-xs gap-2"
              >
                <PhoneCall className="h-4 w-4 text-[#25D366]" />
                <span>Talk to Corporate Desk</span>
              </Button>
            </div>
          </div>
        </div>

        {/* ─── 2. KEY VALUE PROPOSITIONS ──────────────────────────────────── */}
        <div className="mb-14">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-bold uppercase tracking-wider text-primary block mb-1">
              Why Choose KingdomDash Corporate
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-neutral-900">
              Built for High-Volume Dispatch &amp; Merchants
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-4">
                <TrendingDown className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-neutral-900">Up to 32% Volume Savings</h3>
              <p className="mt-2 text-xs sm:text-sm text-neutral-500 leading-relaxed">
                Unlock tiered rates as low as ₦540 per dispatch. The more packages your business sends, the more your margin improves.
              </p>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-4">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-neutral-900">Digital Proof of Delivery</h3>
              <p className="mt-2 text-xs sm:text-sm text-neutral-500 leading-relaxed">
                Receive instant confirmation, recipient signature, and photo proof upon package drop-off to safeguard your inventory and documents.
              </p>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-4">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-neutral-900">Dedicated Dispatch Fleet</h3>
              <p className="mt-2 text-xs sm:text-sm text-neutral-500 leading-relaxed">
                Priority allocation of verified riders in Ijebu-Ode, TASUED, and Ago-Iwoye with dedicated account management and monthly invoicing.
              </p>
            </div>
          </div>
        </div>

        {/* ─── 3. INTERACTIVE RATE CALCULATOR & INQUIRY FORM ──────────────── */}
        <div id="quote-calculator" className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-16">
          {/* Rate Calculator (7 cols) */}
          <div className="lg:col-span-7 rounded-2xl border border-neutral-200 bg-white p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex items-center gap-2.5">
              <Calculator className="h-5 w-5 text-primary" />
              <h2 className="text-lg sm:text-xl font-bold text-neutral-900">
                Corporate Rate &amp; Savings Calculator
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-neutral-500">
              Estimate your monthly logistics expenditure and savings based on your dispatch frequency in Ijebu-Ode.
            </p>

            {/* Business Sector */}
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                Industry / Business Sector
              </label>
              <Select value={businessType} onValueChange={setBusinessType}>
                <SelectTrigger
                  aria-label="Industry / Business Sector"
                  className="w-full rounded-xl border border-neutral-200 bg-neutral-50/50 px-3.5 py-3 text-xs sm:text-sm font-medium text-neutral-900 focus:border-primary focus:bg-white focus:ring-1 focus:ring-primary shadow-2xs h-auto"
                >
                  <SelectValue placeholder="Select industry / sector" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border border-neutral-200 shadow-card bg-white p-1">
                  <SelectItem value="E-commerce & Retail">E-commerce, Boutique & Fashion</SelectItem>
                  <SelectItem value="Pharmacy & Healthcare">Pharmacy, Medical Supplies & Health</SelectItem>
                  <SelectItem value="Restaurant & Bakery">Restaurant, Bakery & Food Services</SelectItem>
                  <SelectItem value="Legal & Corporate Office">Legal, Financial & Corporate Office</SelectItem>
                  <SelectItem value="Campus & Student Services">Campus Merchant (TASUED / OOU / College of Health)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tier Selector Buttons */}
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-2">
                Monthly Parcel Volume Tier
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {VOLUME_TIERS.map((tier, idx) => {
                  const isSelected = selectedTierIndex === idx
                  return (
                    <button
                      key={tier.range}
                      type="button"
                      onClick={() => handleTierChange(idx)}
                      className={`rounded-xl border p-3 text-center transition-all cursor-pointer ${
                        isSelected
                          ? 'border-primary bg-primary/[0.04] ring-1 ring-primary shadow-2xs'
                          : 'border-neutral-200 bg-neutral-50/60 hover:bg-neutral-50 text-neutral-700'
                      }`}
                    >
                      <span className="block text-xs font-bold text-neutral-900">
                        {tier.range.split(' ')[0]}
                      </span>
                      <span className="text-[10px] text-neutral-500 block mt-0.5">
                        {tier.discountPercent}% Off
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Custom volume slider */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold text-neutral-700">Estimated Deliveries:</span>
                <span className="font-extrabold text-primary font-mono text-sm">
                  {monthlyVolume} parcels / month
                </span>
              </div>
              <input
                type="range"
                min="20"
                max="600"
                step="10"
                value={monthlyVolume}
                onChange={(e) => setMonthlyVolume(Number(e.target.value))}
                className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-[11px] text-neutral-400 mt-1">
                <span>20 parcels</span>
                <span>300 parcels</span>
                <span>600+ parcels</span>
              </div>
            </div>

            {/* Dynamic Results Card */}
            <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.03] via-primary/[0.01] to-transparent p-5 space-y-3">
              <div className="flex items-center justify-between text-xs text-neutral-600">
                <span>Standard Individual Dispatch Cost:</span>
                <span className="font-medium line-through text-neutral-400">{formatNgn(standardCost)}</span>
              </div>

              <div className="flex items-center justify-between text-sm sm:text-base font-bold text-neutral-900 pt-1 border-t border-neutral-200/60">
                <span>Corporate Tier Rate ({formatNgn(activeTier.ratePerDelivery)} / parcel):</span>
                <span className="text-neutral-900 font-extrabold">{formatNgn(discountedCost)}</span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs sm:text-sm text-emerald-900 font-bold">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-emerald-600" />
                  <span>Your Estimated Monthly Savings:</span>
                </span>
                <span className="text-base sm:text-lg font-extrabold text-emerald-700">
                  {formatNgn(estimatedSavings)} ({activeTier.discountPercent}% Off)
                </span>
              </div>
            </div>
          </div>

          {/* Account Application Form (5 cols) */}
          <div className="lg:col-span-5 rounded-2xl border border-neutral-200 bg-white p-6 sm:p-8 shadow-xs">
            <h3 className="text-lg font-bold text-neutral-900 mb-1">
              Open a Business Account
            </h3>
            <p className="text-xs text-neutral-500 mb-5">
              Submit your company details for immediate corporate verification and onboarding.
            </p>

            {submitted ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-6 text-center space-y-3">
                <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto" />
                <h4 className="text-base font-bold text-emerald-950">Application Submitted!</h4>
                <p className="text-xs text-emerald-800 leading-relaxed">
                  Thank you, <strong>{companyName}</strong>. Our business relations manager will reach out to <strong>{phone}</strong> to activate your discounted corporate account.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSubmitted(false)}
                  className="mt-2 text-xs"
                >
                  Submit Another Inquiry
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmitInquiry} className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                    Company / Business Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Apex Pharmacy &amp; Stores"
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50/50 p-2.5 text-xs text-neutral-900 focus:border-primary focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                      Contact Person *
                    </label>
                    <input
                      type="text"
                      required
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="Full name"
                      className="w-full rounded-xl border border-neutral-200 bg-neutral-50/50 p-2.5 text-xs text-neutral-900 focus:border-primary focus:bg-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                      Phone / WhatsApp *
                    </label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="08012345678"
                      className="w-full rounded-xl border border-neutral-200 bg-neutral-50/50 p-2.5 text-xs text-neutral-900 focus:border-primary focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                    Business Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contact@company.com"
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50/50 p-2.5 text-xs text-neutral-900 focus:border-primary focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                    Pickup Location in Ijebu-Ode
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. 15 Folagbade Street, Ijebu-Ode"
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50/50 p-2.5 text-xs text-neutral-900 focus:border-primary focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                    Dispatch Requirements / Notes
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any specific delivery hours, delicate goods, or multi-stop needs..."
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50/50 p-2.5 text-xs text-neutral-900 focus:border-primary focus:bg-white focus:outline-none"
                  />
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  disabled={isSubmitting}
                  className="w-full h-11 rounded-xl text-xs font-bold bg-primary hover:bg-primary-hover text-white flex items-center justify-center gap-2 mt-2"
                >
                  <Send className="h-4 w-4" />
                  <span>{isSubmitting ? 'Submitting...' : 'Request Corporate Account'}</span>
                </Button>

                <p className="text-[10px] text-center text-neutral-400">
                  Prefer direct phone conversation? Call {appConfig.support.phoneDisplay}
                </p>
              </form>
            )}
          </div>
        </div>
      </PageContainer>
    </div>
  )
}
