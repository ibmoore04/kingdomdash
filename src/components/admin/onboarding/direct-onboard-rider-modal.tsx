import React, { useState, useEffect } from 'react'
import {
  Bike,
  Car,
  Truck,
  X,
  UserPlus,
  UserCheck,
  User,
  Phone,
  Mail,
  MapPin,
  FileCheck2,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  Check,
} from 'lucide-react'
import {
  adminDirectOnboardRider,
  getEligibleUserProfiles,
} from '@/services/supabase/admin'

interface DirectOnboardRiderModalProps {
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

export const DirectOnboardRiderModal: React.FC<DirectOnboardRiderModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [vehicleType, setVehicleType] = useState<'bicycle' | 'motorcycle' | 'car' | 'van'>('motorcycle')
  const [vehicleMake, setVehicleMake] = useState('')
  const [vehicleModel, setVehicleModel] = useState('')
  const [vehicleYear, setVehicleYear] = useState<number>(new Date().getFullYear())
  const [licensePlate, setLicensePlate] = useState('')

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
      setFullName(found.full_name || '')
      setEmail(found.email || '')
      if (found.phone) setPhone(found.phone)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)

    if (!fullName.trim()) {
      setError('Courier full legal name is required.')
      return
    }
    if (!phone.trim()) {
      setError('Contact phone number is required.')
      return
    }
    if (!email.trim() || !email.includes('@')) {
      setError('A valid email address is required.')
      return
    }

    try {
      setLoading(true)
      const res = await adminDirectOnboardRider({
        profileId: accountMode === 'link' && selectedProfileId ? selectedProfileId : undefined,
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim().toLowerCase(),
        address: address.trim() || undefined,
        vehicleType,
        vehicleMake: vehicleMake.trim() || undefined,
        vehicleModel: vehicleModel.trim() || undefined,
        vehicleYear: vehicleYear || undefined,
        licensePlate: licensePlate.trim() || undefined,
      })

      if (res.error) {
        throw new Error(res.error.message || 'Rider onboarding failed')
      }

      setSuccessMessage(
        `Successfully onboarded courier "${fullName.trim()}" into verified fleet roster!`
      )
      setTimeout(() => {
        onSuccess()
        onClose()
      }, 1000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to onboard rider')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rider-modal-title"
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
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-neutral-900 text-white flex items-center justify-center shrink-0">
              <Bike className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h2 id="rider-modal-title" className="text-sm sm:text-base font-bold text-neutral-900 truncate">
                  Onboard Delivery Courier
                </h2>
                <span className="hidden xs:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  Verified Fleet
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-neutral-500 truncate">
                Direct fleet registration & dispatch readiness
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

          {/* Section 1: Courier Profile Details */}
          <div className="rounded-2xl bg-neutral-50/70 border border-neutral-200/80 p-3 sm:p-4 space-y-3">
            <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-neutral-900 text-white text-[10px] font-bold flex items-center justify-center">1</span>
                <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-neutral-700">
                  Courier Identity & Account
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
                  <span>New Courier</span>
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
                  Select Registered Customer Account
                </label>
                <input
                  type="text"
                  placeholder="Type name or email to filter users..."
                  value={profileSearch}
                  onChange={(e) => setProfileSearch(e.target.value)}
                  className="w-full px-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs"
                />
                <select
                  value={selectedProfileId}
                  onChange={(e) => handleSelectProfile(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg text-xs font-medium text-neutral-900 truncate"
                >
                  <option value="">-- Choose registered user to onboard as rider --</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name || 'Unnamed'} ({p.email}) - {p.role}
                    </option>
                  ))}
                </select>
                {loadingProfiles && (
                  <p className="text-[10px] text-neutral-400 italic">Searching profiles...</p>
                )}
              </div>
            ) : (
              <div>
                <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                  Full Legal Name <span className="text-primary">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Babatunde Adeyemi"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-white border border-neutral-200 rounded-xl text-xs sm:text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors shadow-xs"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 xs:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                  Phone Number <span className="text-primary">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 08023456789"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-white border border-neutral-200 rounded-xl text-xs sm:text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-xs font-mono transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                  Email Address <span className="text-primary">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    required
                    placeholder="e.g. rider@kingdomdash.ng"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-white border border-neutral-200 rounded-xl text-xs sm:text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-xs transition-colors"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                Base Operating Area / Address
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="e.g. Sabo / Obalende, Ijebu-Ode"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-neutral-200 rounded-xl text-xs sm:text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-xs transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Vehicle Information */}
          <div className="rounded-2xl bg-neutral-50/70 border border-neutral-200/80 p-3 sm:p-4 space-y-3">
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-neutral-900 text-white text-[10px] font-bold flex items-center justify-center">2</span>
              <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-neutral-700">
                Vehicle & Fleet Asset Details
              </span>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-neutral-700 mb-1.5">
                Vehicle Class <span className="text-primary">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { type: 'motorcycle' as const, label: 'Motorcycle', icon: Bike, desc: 'Express deliveries' },
                  { type: 'bicycle' as const, label: 'Bicycle', icon: Bike, desc: 'Short-range' },
                  { type: 'car' as const, label: 'Sedan / Car', icon: Car, desc: 'Catering & groceries' },
                  { type: 'van' as const, label: 'Cargo Van', icon: Truck, desc: 'Bulk orders' },
                ].map(({ type, label, icon: Icon, desc }) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setVehicleType(type)}
                    className={`relative flex flex-col items-center justify-center p-2 sm:p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      vehicleType === type
                        ? 'border-neutral-900 bg-neutral-900 text-white shadow-xs'
                        : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                    }`}
                  >
                    <Icon className="w-4 h-4 mb-1" />
                    <span className="text-xs font-bold leading-tight">{label}</span>
                    <span className={`text-[10px] truncate mt-0.5 max-w-full px-1 ${vehicleType === type ? 'text-neutral-300' : 'text-neutral-400'}`}>
                      {desc}
                    </span>
                    {vehicleType === type && (
                      <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                        <Check className="w-2 h-2 stroke-[3]" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                  Make & Brand
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bajaj / TVS"
                  value={vehicleMake}
                  onChange={(e) => setVehicleMake(e.target.value)}
                  className="w-full px-2.5 py-2 bg-white border border-neutral-200 rounded-xl text-xs sm:text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-xs transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                  Model
                </label>
                <input
                  type="text"
                  placeholder="e.g. Boxer 150"
                  value={vehicleModel}
                  onChange={(e) => setVehicleModel(e.target.value)}
                  className="w-full px-2.5 py-2 bg-white border border-neutral-200 rounded-xl text-xs sm:text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-xs transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                  Year
                </label>
                <input
                  type="number"
                  min={2000}
                  max={new Date().getFullYear() + 1}
                  value={vehicleYear}
                  onChange={(e) => setVehicleYear(parseInt(e.target.value, 10) || new Date().getFullYear())}
                  className="w-full px-2.5 py-2 bg-white border border-neutral-200 rounded-xl text-xs sm:text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-xs font-mono transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                  License Plate
                </label>
                <input
                  type="text"
                  placeholder="e.g. JBD-452-XA"
                  value={licensePlate}
                  onChange={(e) => setLicensePlate(e.target.value)}
                  className="w-full px-2.5 py-2 bg-white border border-neutral-200 rounded-xl text-xs sm:text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-xs uppercase font-mono transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Automatic Readiness */}
          <div className="p-3 sm:p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 text-xs text-emerald-950 flex items-start gap-2.5">
            <FileCheck2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Instant Fleet Verification</span>
              <p className="text-[11px] text-emerald-800 mt-0.5 leading-snug">
                Upon submission, the courier profile is verified, activated, and linked to this vehicle in the dispatch pool.
              </p>
            </div>
          </div>
        </form>

        {/* Sticky Footer Actions */}
        <div className="sticky bottom-0 z-20 flex items-center justify-between gap-2.5 px-4 py-3 sm:px-6 sm:py-3.5 border-t border-neutral-200/80 bg-white/95 backdrop-blur-md">
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-neutral-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Authoritative rider & vehicle assignment</span>
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
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 text-xs font-bold text-white bg-neutral-900 hover:bg-black rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer text-center whitespace-nowrap"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span className="sm:hidden">
                {loading ? 'Provisioning...' : 'Onboard Rider'}
              </span>
              <span className="hidden sm:inline">
                {loading ? 'Provisioning...' : 'Complete Rider Onboarding'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
