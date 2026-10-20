import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { RiderLayout } from '@/components/rider/layout/rider-layout'
import { useCurrentRider } from '@/hooks/use-current-rider'
import { useAuthStore } from '@/stores/auth-store'
import { supabase } from '@/services/supabase/client'
import { updateRiderContactInfo } from '@/services/rider/rider-service'
import { mapAuthError } from '@/utils/auth-errors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { KingdomAvatar } from '@/components/common/kingdom-avatar'
import { AvatarPickerModal } from '@/components/common/avatar-picker-modal'
import {
  Camera,
  Sparkles,
  Star,
  Inbox,
  Check,
  Copy,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Save,
} from 'lucide-react'

export default function RiderProfilePage() {
  const { rider, refreshRider } = useCurrentRider()
  const { profile } = useAuthStore()

  const [profileName, setProfileName] = useState(rider?.full_name || profile?.full_name || '')
  const [profilePhone, setProfilePhone] = useState(rider?.phone || profile?.phone || '')
  const [profileCity, setProfileCity] = useState('Ijebu-Ode, Ogun State')
  const [profileCountry, setProfileCountry] = useState('Nigeria')
  const [vehicleType, setVehicleType] = useState(rider?.vehicle_type || 'motorcycle')
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [profileFeedback, setProfileFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [hasCopiedRef, setHasCopiedRef] = useState(false)
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false)

  const isInitialized = useRef(false)

  useEffect(() => {
    if (!isInitialized.current && (rider || profile)) {
      if (rider?.full_name || profile?.full_name) {
        setProfileName(rider?.full_name || profile?.full_name || '')
      }
      if (rider?.phone || profile?.phone) {
        setProfilePhone(rider?.phone || profile?.phone || '')
      }
      if (rider?.vehicle_type) {
        setVehicleType(rider.vehicle_type)
      }
      isInitialized.current = true
    }
  }, [rider?.id, profile?.id])

  const riderRefCode = `https://kingdomdash.com/courier?ref=${rider?.id?.slice(0, 8) || profile?.id?.slice(0, 8) || 'kdash'}`

  const handleCopyRef = () => {
    navigator.clipboard.writeText(riderRefCode)
    setHasCopiedRef(true)
    setTimeout(() => setHasCopiedRef(false), 2500)
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.id) return

    if (!profileName.trim()) {
      setProfileFeedback({ type: 'error', message: 'Full name cannot be empty.' })
      return
    }

    setIsSavingProfile(true)
    setProfileFeedback(null)
    try {
      const cleanName = profileName.trim()
      const cleanPhone = profilePhone.trim()

      // 1. Update authoritative profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: cleanName,
          phone: cleanPhone,
        })
        .eq('id', profile.id)

      if (profileError) throw profileError

      // 2. Update rider contact info in dispatch fleet records
      if (cleanPhone) {
        await updateRiderContactInfo(cleanPhone)
      }

      // 3. Update auth store local state
      useAuthStore.setState({
        profile: {
          ...profile,
          full_name: cleanName,
          phone: cleanPhone,
        },
      })

      // 4. Refresh operational rider profile
      await refreshRider()

      setProfileFeedback({ type: 'success', message: 'Rider profile details successfully updated.' })
    } catch (err: unknown) {
      const errObj = err as { code?: string; message?: string; details?: string }
      let userFriendlyMessage = mapAuthError(err, 'Profile update')
      if (errObj?.code === '23505' || String(errObj?.message || '').includes('duplicate') || String(errObj?.details || '').includes('already exists')) {
        userFriendlyMessage = 'A profile with this phone number or credential already exists in the system.'
      }
      setProfileFeedback({
        type: 'error',
        message: userFriendlyMessage,
      })
    } finally {
      setIsSavingProfile(false)
    }
  }

  return (
    <RiderLayout title="Profile & Account Settings">
      <div className="grid grid-cols-1 lg:grid-cols-9 gap-6 items-start">
        {/* Card 2: Profile Identity Card (Matches Customer Profile Card 2) */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-neutral-200/90 shadow-md p-6 sm:p-7 flex flex-col items-center text-center space-y-4">
          {/* Circular Avatar with Camera Overlay */}
          <div
            className="relative group cursor-pointer"
            onClick={() => setIsAvatarPickerOpen(true)}
            title="Click to customize your character avatar"
          >
            <KingdomAvatar
              size="2xl"
              userId={profile?.id}
              name={rider?.full_name || profile?.full_name}
              avatarUrl={rider?.avatar_url || profile?.avatar_url}
              role="rider"
              showBadge={false}
              className="ring-4 ring-white shadow-xl hover:scale-105 transition-transform"
            />
            <button
              type="button"
              aria-label="Change character avatar"
              className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white shadow-md border-2 border-white hover:bg-primary-hover transition-transform cursor-pointer"
              onClick={(e) => {
                e.stopPropagation()
                setIsAvatarPickerOpen(true)
              }}
            >
              <Camera className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Name & Persona */}
          <div className="w-full">
            <h1 className="text-lg font-bold text-neutral-900 leading-tight">
              {rider?.full_name || profile?.full_name || 'Verified Rider'}
            </h1>
            <p className="text-xs text-neutral-500 font-medium truncate max-w-[220px] mx-auto mt-1">
              {rider?.email || profile?.email || 'rider@kingdomdash.com'}
            </p>
            <div className="mt-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200/70">
                <Sparkles className="h-3 w-3 text-amber-500" />
                Royal Courier • Ijebu-Ode Fleet
              </span>
            </div>
          </div>

          {/* Bordered Metrics Rows */}
          <div className="w-full divide-y divide-neutral-100 border-y border-neutral-100 text-xs">
            <div className="py-3 flex items-center justify-between text-neutral-600">
              <span className="font-medium">Total Deliveries</span>
              <span className="font-bold text-neutral-900 text-sm">{rider?.total_deliveries ?? 0}</span>
            </div>
            <div className="py-3 flex items-center justify-between text-neutral-600">
              <span className="font-medium">Customer Rating</span>
              <span className="font-bold text-amber-500 text-sm flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                {Number(rider?.rating || 5.0).toFixed(1)}
              </span>
            </div>
            <div className="py-3 flex items-center justify-between text-neutral-600">
              <span className="font-medium">Vehicle Registered</span>
              <span className="font-bold text-neutral-900 text-sm capitalize">{vehicleType}</span>
            </div>
            <div className="py-3 flex items-center justify-between text-neutral-600">
              <span className="font-medium">Duty Availability</span>
              <span className={`font-bold text-xs ${rider?.is_available ? 'text-emerald-600' : 'text-neutral-500'}`}>
                {rider?.is_available ? 'Available / On-Duty' : 'Offline'}
              </span>
            </div>
          </div>

          {/* Direct Action Button */}
          <Button
            asChild
            variant="outline"
            size="sm"
            className="w-full rounded-xl border-neutral-200 hover:border-primary/50 text-neutral-800 hover:text-primary font-bold text-xs h-10 shadow-2xs"
          >
            <Link to="/rider/assignments" className="flex items-center justify-center gap-2">
              <Inbox className="h-3.5 w-3.5 text-primary" />
              <span>View Dispatch Inbox</span>
            </Link>
          </Button>

          {/* Shareable Link Box */}
          <div className="w-full pt-1">
            <div className="flex items-center rounded-xl border border-neutral-200 bg-neutral-50/80 px-3 py-2 text-xs">
              <span className="truncate text-neutral-500 font-mono text-[11px] flex-1 text-left">
                {riderRefCode}
              </span>
              <button
                type="button"
                onClick={handleCopyRef}
                title="Copy fleet reference code"
                className="ml-2 p-1 text-neutral-500 hover:text-primary transition-colors cursor-pointer shrink-0"
              >
                {hasCopiedRef ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
            {hasCopiedRef && (
              <span className="text-[10px] text-emerald-600 font-bold mt-1 block">
                Copied to clipboard!
              </span>
            )}
          </div>
        </div>

        {/* Card 3: Account Settings Form Card (Matches Customer Profile Card 3) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-neutral-200/90 shadow-md overflow-hidden">
          {/* Horizontal Navigation Tabs */}
          <div className="flex items-center border-b border-neutral-200 px-6 sm:px-8 bg-white overflow-x-auto scrollbar-none">
            <button
              type="button"
              className="py-4 px-2 text-xs font-bold border-b-2 border-primary text-primary transition-colors whitespace-nowrap cursor-pointer"
            >
              Account Settings
            </button>
            <Link
              to="/rider/settings"
              className="py-4 px-4 text-xs font-semibold text-neutral-500 hover:text-neutral-900 transition-colors whitespace-nowrap cursor-pointer"
            >
              Fleet Preferences
            </Link>
            <Link
              to="/rider/history"
              className="py-4 px-4 text-xs font-semibold text-neutral-500 hover:text-neutral-900 transition-colors whitespace-nowrap cursor-pointer"
            >
              Trip History
            </Link>
            <Link
              to="/rider/notifications"
              className="py-4 px-4 text-xs font-semibold text-neutral-500 hover:text-neutral-900 transition-colors whitespace-nowrap cursor-pointer"
            >
              Notifications
            </Link>
            <Link
              to="/rider/support"
              className="py-4 px-4 text-xs font-semibold text-neutral-500 hover:text-neutral-900 transition-colors whitespace-nowrap cursor-pointer"
            >
              Support Desk
            </Link>
          </div>

          {/* Account Form Body */}
          <form onSubmit={handleSaveProfile} className="p-6 sm:p-8 space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="rider-full-name" className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                  Full Name <span className="text-rose-600">*</span>
                </Label>
                <Input
                  id="rider-full-name"
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="Rider Full Name"
                  required
                  className="rounded-xl bg-white border-neutral-200 focus:border-primary text-neutral-900 text-xs h-10 px-3.5 shadow-2xs font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="rider-phone" className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                  Contact Phone Number
                </Label>
                <Input
                  id="rider-phone"
                  type="tel"
                  value={profilePhone}
                  onChange={(e) => setProfilePhone(e.target.value)}
                  placeholder="+234 801 234 5678"
                  className="rounded-xl bg-white border-neutral-200 focus:border-primary text-neutral-900 text-xs h-10 px-3.5 shadow-2xs font-medium"
                />
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="rider-email" className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                  Registered Email Address
                </Label>
                <Input
                  id="rider-email"
                  type="email"
                  value={rider?.email || profile?.email || ''}
                  disabled
                  className="rounded-xl bg-neutral-50 border-neutral-200 text-neutral-500 text-xs h-10 px-3.5 shadow-2xs font-medium cursor-not-allowed"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="rider-city" className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                  City / Fleet Base
                </Label>
                <Input
                  id="rider-city"
                  type="text"
                  value={profileCity}
                  onChange={(e) => setProfileCity(e.target.value)}
                  placeholder="Ijebu-Ode, Ogun State"
                  className="rounded-xl bg-white border-neutral-200 focus:border-primary text-neutral-900 text-xs h-10 px-3.5 shadow-2xs font-medium"
                />
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="rider-country" className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                  Country
                </Label>
                <Input
                  id="rider-country"
                  type="text"
                  value={profileCountry}
                  onChange={(e) => setProfileCountry(e.target.value)}
                  placeholder="Nigeria"
                  className="rounded-xl bg-white border-neutral-200 focus:border-primary text-neutral-900 text-xs h-10 px-3.5 shadow-2xs font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="rider-vehicle" className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                  Vehicle Registered
                </Label>
                <Input
                  id="rider-vehicle"
                  type="text"
                  value={vehicleType}
                  disabled
                  className="rounded-xl bg-neutral-50 border-neutral-200 text-neutral-500 text-xs h-10 px-3.5 shadow-2xs font-medium capitalize cursor-not-allowed"
                />
              </div>
            </div>

            {profileFeedback && (
              <div
                className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                  profileFeedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
                role="alert"
              >
                {profileFeedback.type === 'success' ? (
                  <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                )}
                <span>{profileFeedback.message}</span>
              </div>
            )}

            <div className="pt-2 flex items-center justify-between">
              <Button
                type="submit"
                variant="primary"
                disabled={isSavingProfile}
                aria-label="Save Changes"
                className="bg-primary hover:bg-primary-hover text-white font-bold px-7 h-10 rounded-xl shadow-xs transition-all gap-2 cursor-pointer"
              >
                {isSavingProfile ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>Save Changes</span>
                  </>
                )}
              </Button>

              <span className="text-[11px] text-neutral-400 font-medium hidden sm:inline">
                Ijebu-Ode Dispatch Network
              </span>
            </div>
          </form>
        </div>
      </div>

      {/* Royal Character Avatar Picker Modal */}
      <AvatarPickerModal
        open={isAvatarPickerOpen}
        onOpenChange={setIsAvatarPickerOpen}
        onAvatarSaved={refreshRider}
      />
    </RiderLayout>
  )
}
