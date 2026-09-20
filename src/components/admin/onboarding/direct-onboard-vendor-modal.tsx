import React, { useState, useEffect } from 'react'
import {
  Store,
  UtensilsCrossed,
  ShoppingBasket,
  X,
  UserPlus,
  UserCheck,
  Building2,
  Phone,
  Mail,
  MapPin,
  FileText,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Check,
} from 'lucide-react'
import {
  adminDirectOnboardVendor,
  getEligibleUserProfiles,
} from '@/services/supabase/admin'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface DirectOnboardVendorModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

interface UserProfileOption {
  id: string
  full_name: string
  email: string
  phone?: string | null
  role: string
}

export const DirectOnboardVendorModal: React.FC<DirectOnboardVendorModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [businessName, setBusinessName] = useState('')
  const [businessAddress, setBusinessAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [description, setDescription] = useState('')
  const [serviceTypes, setServiceTypes] = useState<('food' | 'grocery')[]>(['food'])

  // Account mode: 'new' | 'link'
  const [accountMode, setAccountMode] = useState<'new' | 'link'>('new')
  const [profiles, setProfiles] = useState<UserProfileOption[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState<string>('')
  const [profileSearch, setProfileSearch] = useState('')
  const [loadingProfiles, setLoadingProfiles] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Escape key & body overflow lock
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  useEffect(() => {
    if (isOpen && accountMode === 'link') {
      let isMounted = true
      const fetchProfiles = async () => {
        setLoadingProfiles(true)
        try {
          const res = await getEligibleUserProfiles(profileSearch)
          if (isMounted && res.data) {
            setProfiles(res.data as UserProfileOption[])
          }
        } catch {
          // Ignore lookup errors
        } finally {
          if (isMounted) setLoadingProfiles(false)
        }
      }
      fetchProfiles()
      return () => {
        isMounted = false
      }
    }
  }, [isOpen, accountMode, profileSearch])

  const handleSelectProfile = (profileId: string) => {
    setSelectedProfileId(profileId)
    const found = profiles.find((p) => p.id === profileId)
    if (found) {
      setOwnerName(found.full_name || '')
      setEmail(found.email || '')
      if (found.phone) setPhone(found.phone)
    }
  }

  const toggleService = (type: 'food' | 'grocery') => {
    setServiceTypes((prev) => {
      if (prev.includes(type)) {
        if (prev.length === 1) return prev // Must keep at least one active
        return prev.filter((t) => t !== type)
      }
      return [...prev, type]
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)

    if (!businessName.trim()) {
      setError('Business / Store trading name is required.')
      return
    }
    if (serviceTypes.length === 0) {
      setError('Select at least one marketplace service capability (Food, Grocery, or both).')
      return
    }
    if (!businessAddress.trim()) {
      setError('Physical storefront address is required.')
      return
    }
    if (!phone.trim()) {
      setError('Contact phone number is required.')
      return
    }
    if (!email.trim() || !email.includes('@')) {
      setError('A valid business contact email address is required.')
      return
    }

    try {
      setLoading(true)
      const res = await adminDirectOnboardVendor({
        profileId: accountMode === 'link' && selectedProfileId ? selectedProfileId : undefined,
        businessName: businessName.trim(),
        businessAddress: businessAddress.trim(),
        phone: phone.trim(),
        email: email.trim().toLowerCase(),
        ownerName: ownerName.trim() || businessName.trim(),
        description: description.trim() || undefined,
        serviceTypes,
      })

      if (res.error) {
        throw new Error(res.error.message || 'Vendor onboarding failed')
      }

      setSuccessMessage(
        `Successfully onboarded "${businessName.trim()}" with [${serviceTypes.map(s => s.toUpperCase()).join(' + ')}] capabilities!`
      )
      setTimeout(() => {
        onSuccess()
        onClose()
      }, 1000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to onboard vendor')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="vendor-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
    >
      <div className="relative w-full sm:max-w-xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border-t sm:border border-neutral-200/80 overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[88vh] animate-slideUp sm:animate-none">
        {/* Mobile Pull Handle Indicator */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1 bg-white">
          <div className="w-10 h-1 rounded-full bg-neutral-300" />
        </div>

        {/* Sticky Header */}
        <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-neutral-200/80 bg-white/95 backdrop-blur-md">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <Store className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h2 id="vendor-modal-title" className="text-sm sm:text-base font-bold text-neutral-900 truncate">
                  Onboard Merchant Partner
                </h2>
                <span className="hidden xs:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 text-neutral-700 border border-neutral-200 shrink-0">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  Multi-Service
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-neutral-500 truncate">
                Direct merchant provisioning into live network
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-500 hover:text-neutral-800 flex items-center justify-center transition-colors cursor-pointer shrink-0 ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-4 py-3.5 sm:px-6 sm:py-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0 text-primary" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5 font-semibold animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Section 1: Marketplace Service Capabilities */}
          <div className="rounded-2xl bg-neutral-50/70 border border-neutral-200/80 p-3 sm:p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-neutral-900 text-white text-[10px] font-bold flex items-center justify-center">1</span>
                <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-neutral-700">
                  Service Capabilities <span className="text-primary">*</span>
                </span>
              </div>
              <span className="text-[10px] text-neutral-500 font-medium">Select one or both</span>
            </div>

            <div className="grid grid-cols-1 xs:grid-cols-2 gap-2 sm:gap-2.5">
              {/* Food Delivery Card */}
              <button
                type="button"
                aria-pressed={serviceTypes.includes('food')}
                onClick={() => toggleService('food')}
                className={`relative flex items-center gap-2.5 p-2.5 sm:p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  serviceTypes.includes('food')
                    ? 'border-amber-400 bg-amber-50/90 text-amber-950 shadow-xs ring-1 ring-amber-400/40'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                <div
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                    serviceTypes.includes('food')
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'bg-neutral-100 text-neutral-400'
                  }`}
                >
                  <UtensilsCrossed className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <div className="flex-1 min-w-0 pr-6">
                  <div className="text-xs font-bold leading-tight">Food Delivery</div>
                  <p className="text-[10px] sm:text-[11px] text-neutral-500 mt-0.5 truncate">
                    Restaurants & hot meals
                  </p>
                </div>
                {serviceTypes.includes('food') && (
                  <div className="absolute right-2.5 flex items-center gap-1">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-amber-700">Active</span>
                    <div className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                  </div>
                )}
              </button>

              {/* Grocery Delivery Card */}
              <button
                type="button"
                aria-pressed={serviceTypes.includes('grocery')}
                onClick={() => toggleService('grocery')}
                className={`relative flex items-center gap-2.5 p-2.5 sm:p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  serviceTypes.includes('grocery')
                    ? 'border-emerald-400 bg-emerald-50/90 text-emerald-950 shadow-xs ring-1 ring-emerald-400/40'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                <div
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                    serviceTypes.includes('grocery')
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-neutral-100 text-neutral-400'
                  }`}
                >
                  <ShoppingBasket className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <div className="flex-1 min-w-0 pr-6">
                  <div className="text-xs font-bold leading-tight">Grocery Delivery</div>
                  <p className="text-[10px] sm:text-[11px] text-neutral-500 mt-0.5 truncate">
                    Supermarkets & produce
                  </p>
                </div>
                {serviceTypes.includes('grocery') && (
                  <div className="absolute right-2.5 flex items-center gap-1">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-700">Active</span>
                    <div className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                  </div>
                )}
              </button>
            </div>

            {serviceTypes.includes('food') && serviceTypes.includes('grocery') && (
              <div className="p-2 sm:p-2.5 rounded-xl bg-emerald-100/70 border border-emerald-200/80 text-emerald-900 text-[11px] flex items-center gap-1.5 font-medium animate-fadeIn">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Dual-Service Merchant: Storefront will be featured across both Food and Grocery marketplaces.</span>
              </div>
            )}
          </div>

          {/* Section 2: Storefront Details */}
          <div className="rounded-2xl bg-neutral-50/70 border border-neutral-200/80 p-3 sm:p-4 space-y-3">
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-neutral-900 text-white text-[10px] font-bold flex items-center justify-center">2</span>
              <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-neutral-700">
                Storefront Information
              </span>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                Store / Trading Name <span className="text-primary">*</span>
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Mama Put Deluxe / Royal Mart"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-neutral-200 rounded-xl text-xs sm:text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-xs transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                Physical Store Address <span className="text-primary">*</span>
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  required
                  placeholder="e.g. 14 Folagbade Street, Ijebu-Ode, Ogun State"
                  value={businessAddress}
                  onChange={(e) => setBusinessAddress(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-neutral-200 rounded-xl text-xs sm:text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-xs transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                Concept & Specialties (Optional)
              </label>
              <div className="relative">
                <FileText className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5 pointer-events-none" />
                <textarea
                  rows={2}
                  placeholder="e.g. Traditional Nigerian soups, fresh local bakery, and dairy provisions."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-neutral-200 rounded-xl text-xs sm:text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-xs resize-none transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Partner Contact & Ownership */}
          <div className="rounded-2xl bg-neutral-50/70 border border-neutral-200/80 p-3 sm:p-4 space-y-3">
            <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-neutral-900 text-white text-[10px] font-bold flex items-center justify-center">3</span>
                <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-neutral-700">
                  Ownership & Contact
                </span>
              </div>

              {/* Segmented Mode Switcher */}
              <div className="flex p-0.5 bg-neutral-200/80 rounded-xl self-start xs:self-auto text-[11px]">
                <button
                  type="button"
                  onClick={() => setAccountMode('new')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    accountMode === 'new'
                      ? 'bg-white text-neutral-900 shadow-xs'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  <UserPlus className="w-3 h-3" />
                  <span>New Contact</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAccountMode('link')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    accountMode === 'link'
                      ? 'bg-white text-neutral-900 shadow-xs'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  <UserCheck className="w-3 h-3" />
                  <span>Link Profile</span>
                </button>
              </div>
            </div>

            {accountMode === 'link' ? (
              <div className="space-y-2 bg-white p-3 rounded-xl border border-neutral-200">
                <label className="block text-[11px] font-semibold text-neutral-700">
                  Select Registered User Account
                </label>
                <input
                  type="text"
                  placeholder="Type name or email to filter users..."
                  value={profileSearch}
                  onChange={(e) => setProfileSearch(e.target.value)}
                  className="w-full px-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs"
                />
                <Select
                  value={selectedProfileId || 'none'}
                  onValueChange={(val) => handleSelectProfile(val === 'none' ? '' : val)}
                >
                  <SelectTrigger className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg text-xs font-medium text-neutral-900 truncate h-10">
                    <SelectValue placeholder="-- Choose registered customer to elevate --" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- Choose registered customer to elevate --</SelectItem>
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name || 'Unnamed'} ({p.email}) - {p.role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {loadingProfiles && (
                  <p className="text-[10px] text-neutral-400 italic">Searching profiles...</p>
                )}
              </div>
            ) : (
              <div>
                <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                  Manager / Owner Legal Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Adebayo Ogunlesi"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-xl text-xs sm:text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-xs transition-colors"
                />
              </div>
            )}

            <div className="grid grid-cols-1 xs:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                  Contact Phone <span className="text-primary">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 08012345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-white border border-neutral-200 rounded-xl text-xs sm:text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-xs font-mono transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                  Official Email <span className="text-primary">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    required
                    placeholder="e.g. orders@mamaput.ng"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-white border border-neutral-200 rounded-xl text-xs sm:text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-xs transition-colors"
                  />
                </div>
              </div>
            </div>
          </div>
        </form>

        {/* Sticky Footer Actions */}
        <div className="sticky bottom-0 z-20 flex items-center justify-between gap-2.5 px-4 py-3 sm:px-6 sm:py-3.5 border-t border-neutral-200/80 bg-white/95 backdrop-blur-md">
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-neutral-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Authoritative catalog & service sync</span>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-3.5 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 text-xs font-bold text-white bg-primary hover:bg-primary-hover rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer text-center whitespace-nowrap"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span className="sm:hidden">
                {loading ? 'Provisioning...' : 'Onboard Merchant'}
              </span>
              <span className="hidden sm:inline">
                {loading ? 'Provisioning...' : 'Complete Vendor Onboarding'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
