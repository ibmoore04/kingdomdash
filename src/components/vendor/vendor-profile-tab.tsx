import { useState, useRef } from 'react'
import {
  Store,
  ShieldCheck,
  MapPin,
  Phone,
  Mail,
  Clock,
  Save,
  Image as ImageIcon,
  Upload,
  Sparkles,
  Link2,
  CheckCircle2,
  X,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import type { Vendor, VendorUpdate } from '@/types'
import { appConfig } from '@/config/app.config'
import {
  VENDOR_COVER_PRESETS,
  getVendorFallbackCover,
  compressImageFile,
} from '@/utils/vendor-branding'

interface VendorProfileTabProps {
  vendor: Vendor
  isSaving?: boolean
  onUpdateProfile: (updates: VendorUpdate) => Promise<void>
}

export function VendorProfileTab({
  vendor,
  isSaving,
  onUpdateProfile,
}: VendorProfileTabProps) {
  const [businessName, setBusinessName] = useState(vendor.business_name || '')
  const [phone, setPhone] = useState(vendor.phone || '')
  const [address, setAddress] = useState(vendor.business_address || '')
  const [serviceArea, setServiceArea] = useState(vendor.service_area || appConfig.launchMarket)
  const [description, setDescription] = useState(vendor.business_description || '')
  const [coverImageUrl, setCoverImageUrl] = useState(vendor.cover_image_url || '')
  const [logoUrl, setLogoUrl] = useState(vendor.logo_url || '')
  const [isCompressingCover, setIsCompressingCover] = useState(false)
  const [isCompressingLogo, setIsCompressingLogo] = useState(false)
  const [showUrlInput, setShowUrlInput] = useState(false)

  const coverInputRef = useRef<HTMLInputElement>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)

  const [operatingHours, setOperatingHours] = useState(() => {
    if (!vendor.operating_hours) return '8:00 AM - 9:00 PM (Mon - Sat)'
    if (typeof vendor.operating_hours === 'string') {
      try {
        const parsed = JSON.parse(vendor.operating_hours)
        if (typeof parsed === 'object' && parsed !== null && 'display' in parsed) {
          return String((parsed as { display: unknown }).display)
        }
        return vendor.operating_hours
      } catch {
        return vendor.operating_hours
      }
    }
    if (
      typeof vendor.operating_hours === 'object' &&
      vendor.operating_hours !== null &&
      'display' in vendor.operating_hours
    ) {
      return String((vendor.operating_hours as { display: unknown }).display)
    }
    return JSON.stringify(vendor.operating_hours, null, 2)
  })
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Current effective cover preview
  const currentCoverPreview =
    coverImageUrl.trim() ||
    getVendorFallbackCover({
      id: vendor.id,
      business_name: businessName || vendor.business_name,
      business_type: vendor.business_type,
    })

  const handleCoverFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setIsCompressingCover(true)
      setFeedback(null)
      const compressedDataUrl = await compressImageFile(file, 1440, 720, 0.85)
      setCoverImageUrl(compressedDataUrl)
      setFeedback({ type: 'success', message: 'Cover photo loaded! Remember to click "Save Business Changes" below to persist.' })
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Could not process image file.',
      })
    } finally {
      setIsCompressingCover(false)
      if (coverInputRef.current) coverInputRef.current.value = ''
    }
  }

  const handleLogoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setIsCompressingLogo(true)
      setFeedback(null)
      const compressedLogo = await compressImageFile(file, 400, 400, 0.88)
      setLogoUrl(compressedLogo)
      setFeedback({ type: 'success', message: 'Store logo loaded! Remember to click "Save Business Changes" below to persist.' })
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Could not process logo file.',
      })
    } finally {
      setIsCompressingLogo(false)
      if (logoInputRef.current) logoInputRef.current.value = ''
    }
  }

  const handleSelectPreset = (url: string) => {
    setCoverImageUrl(url)
    setFeedback({ type: 'success', message: 'Preset cover selected! Click "Save Business Changes" below to confirm.' })
  }

  const handleResetCover = () => {
    setCoverImageUrl('')
    setFeedback({ type: 'success', message: 'Cover photo reset to system smart default.' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!businessName.trim() || !phone.trim() || !address.trim()) {
      setFeedback({ type: 'error', message: 'Business name, phone number, and business address are required.' })
      return
    }

    try {
      setFeedback(null)
      let parsedHours: unknown = operatingHours.trim() || null
      if (typeof parsedHours === 'string') {
        try {
          parsedHours = JSON.parse(parsedHours)
        } catch {
          parsedHours = { display: parsedHours }
        }
      }

      await onUpdateProfile({
        business_name: businessName.trim(),
        phone: phone.trim(),
        business_address: address.trim(),
        service_area: serviceArea.trim() || null,
        business_description: description.trim() || null,
        operating_hours: parsedHours as VendorUpdate['operating_hours'],
        cover_image_url: coverImageUrl.trim() || null,
        logo_url: logoUrl.trim() || null,
      })
      setFeedback({ type: 'success', message: 'Business profile & cover branding successfully updated!' })
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to update profile.',
      })
    }
  }

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h2 className="text-h3 font-bold text-text-primary">Business Profile & Branding</h2>
        <p className="text-body-small text-text-secondary">
          Customize your storefront hero cover photo, store logo, and update your operational contact details in {appConfig.launchMarket}.
        </p>
      </div>

      {feedback && (
        <div
          className={`rounded-xl border p-4 text-body-small ${
            feedback.type === 'success'
              ? 'border-status-success/20 bg-status-success/10 text-status-success'
              : 'border-status-error/20 bg-status-error/10 text-status-error'
          }`}
          role="alert"
        >
          {feedback.message}
        </div>
      )}

      {/* ── Store Visual Branding (Cover Photo & Logo) ────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <div className="border-b border-border bg-neutral-light/50 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ImageIcon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-h4 font-bold text-text-primary">Storefront Cover Photo & Branding</h3>
              <p className="text-body-small text-text-secondary">
                This image appears on the homepage vendor card, food/grocery catalogs, and as your store’s hero banner.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Live Storefront Hero Preview */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-caption font-semibold uppercase tracking-wider text-text-muted">
                Live Storefront Preview
              </span>
              {coverImageUrl && (
                <button
                  type="button"
                  onClick={handleResetCover}
                  className="flex items-center gap-1 text-caption text-text-muted hover:text-status-error transition-colors"
                >
                  <RefreshCw className="h-3 w-3" /> Reset to auto-suggested cover
                </button>
              )}
            </div>

            <div className="relative h-48 w-full overflow-hidden rounded-xl border border-border sm:h-56 bg-neutral-light shadow-inner">
              <img
                src={currentCoverPreview}
                alt={`${businessName || vendor.business_name} cover preview`}
                className="h-full w-full object-cover"
              />
              {/* High-contrast multi-layer dark scrim for crisp preview legibility */}
              <div className="absolute inset-0 bg-black/40" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />

              {/* Badges on preview */}
              <div className="absolute left-4 top-4">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-md px-3 py-1 text-xs font-semibold text-white border border-white/20 shadow-sm">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  {vendor.business_type === 'restaurant' ? 'Restaurant Cover' : 'Grocery Store Cover'}
                </span>
              </div>

              {/* Vendor Hero Identity in Preview */}
              <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative h-14 w-14 overflow-hidden rounded-xl border-2 border-white/40 bg-white shadow-md flex items-center justify-center shrink-0">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Store logo" className="h-full w-full object-cover" />
                    ) : (
                      <Store className="h-7 w-7 text-primary" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
                      {businessName || vendor.business_name}
                    </h4>
                    <p className="text-xs text-white/95 font-medium drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                      {serviceArea || appConfig.launchMarket} • {operatingHours}
                    </p>
                  </div>
                </div>

                <Badge variant={vendor.is_active ? 'success' : 'warning'} className="hidden sm:inline-flex shadow">
                  {vendor.is_active ? 'Active on Storefront' : 'In Review'}
                </Badge>
              </div>
            </div>
          </div>

          {/* Action Buttons: Upload from Device or Paste Link */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleCoverFileUpload}
              />
              <button
                type="button"
                disabled={isCompressingCover}
                onClick={() => coverInputRef.current?.click()}
                className="group flex w-full items-center justify-center gap-2.5 rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50/70 py-4 px-4 text-xs sm:text-sm font-semibold text-neutral-700 transition-all duration-200 hover:border-primary hover:bg-red-50/60 hover:text-primary active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50 cursor-pointer shadow-2xs"
              >
                <Upload className="h-4 w-4 text-neutral-400 transition-colors group-hover:text-primary" />
                <span>{isCompressingCover ? 'Compressing Image…' : 'Upload Cover from Device'}</span>
              </button>
              <p className="mt-1.5 text-center text-[11px] text-text-muted">
                Supports JPG, PNG, WEBP. Automatically optimized for swift loading.
              </p>
            </div>

            <div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleLogoFileUpload}
              />
              <button
                type="button"
                disabled={isCompressingLogo}
                onClick={() => logoInputRef.current?.click()}
                className="group flex w-full items-center justify-center gap-2.5 rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50/70 py-4 px-4 text-xs sm:text-sm font-semibold text-neutral-700 transition-all duration-200 hover:border-primary hover:bg-red-50/60 hover:text-primary active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50 cursor-pointer shadow-2xs"
              >
                <Store className="h-4 w-4 text-neutral-400 transition-colors group-hover:text-primary" />
                <span>{isCompressingLogo ? 'Processing Logo…' : 'Upload Store Logo / Avatar'}</span>
              </button>
              <p className="mt-1.5 text-center text-[11px] text-text-muted">
                Square format icon (e.g. 1:1) shown beside your store name.
              </p>
            </div>
          </div>

          {/* Direct URL input toggle */}
          <div>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowUrlInput(!showUrlInput)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
              >
                <Link2 className="h-3.5 w-3.5" />
                {showUrlInput ? 'Hide direct image URL field' : 'Use a custom web image URL instead'}
              </button>
            </div>

            {showUrlInput && (
              <div className="mt-3 space-y-3 rounded-lg border border-border bg-neutral-light/50 p-4">
                <div>
                  <Label htmlFor="vendor-cover-url" className="text-caption font-semibold text-text-primary">
                    Custom Cover Photo Image URL
                  </Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      id="vendor-cover-url"
                      value={coverImageUrl}
                      onChange={(e) => setCoverImageUrl(e.target.value)}
                      placeholder="https://images.unsplash.com/photo-... or /images/..."
                      className="text-body-small"
                    />
                    {coverImageUrl && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setCoverImageUrl('')}
                        title="Clear URL"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor="vendor-logo-url" className="text-caption font-semibold text-text-primary">
                    Custom Store Logo URL
                  </Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      id="vendor-logo-url"
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      placeholder="https://example.com/my-logo.png"
                      className="text-body-small"
                    />
                    {logoUrl && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setLogoUrl('')}
                        title="Clear Logo URL"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Curated Presets Library */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-body font-bold text-text-primary">Curated High-Res Cover Library</h4>
                <p className="text-caption text-text-muted">
                  Choose one of our premium, professionally shot covers tailored for Nigerian food and retail.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {VENDOR_COVER_PRESETS.map((preset) => {
                const isSelected =
                  coverImageUrl === preset.url ||
                  (!coverImageUrl && currentCoverPreview === preset.url)

                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset.url)}
                    className={`group relative overflow-hidden rounded-xl border-2 text-left transition-all hover:scale-[1.02] ${
                      isSelected
                        ? 'border-primary ring-2 ring-primary/20 shadow-md'
                        : 'border-border hover:border-text-secondary'
                    }`}
                  >
                    <div className="aspect-[16/10] w-full overflow-hidden bg-neutral-light">
                      <img
                        src={preset.url}
                        alt={preset.label}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>
                    <div className="p-2 bg-white">
                      <p className="text-xs font-semibold text-text-primary line-clamp-1">
                        {preset.label}
                      </p>
                      <span className="text-[10px] text-text-muted capitalize">
                        {preset.category}
                      </span>
                    </div>

                    {isSelected && (
                      <div className="absolute top-1.5 right-1.5 rounded-full bg-primary p-0.5 text-white shadow">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Store Identity Card (Protected fields) ──────────────────────────── */}
      <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <Store className="h-6 w-6 text-primary" aria-hidden="true" />
            <h3 className="text-h4 font-bold text-text-primary">Store Identity & Verification</h3>
          </div>
          <Badge variant={vendor.is_active ? 'success' : 'warning'}>
            {vendor.is_active ? 'Verified & Active' : 'Under Review'}
          </Badge>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <span className="text-caption font-semibold uppercase tracking-wider text-text-muted">Business Name</span>
            <p className="mt-1 text-body font-semibold text-text-primary">{businessName || vendor.business_name}</p>
            <p className="text-caption text-text-muted">Registered business identifier</p>
          </div>

          <div>
            <span className="text-caption font-semibold uppercase tracking-wider text-text-muted">Service Type</span>
            <p className="mt-1 text-body font-semibold text-text-primary">
              {vendor.business_type === 'restaurant' ? 'Food & Kitchen Delivery' : 'Grocery & Staples Delivery'}
            </p>
            <p className="text-caption text-text-muted">Locked to business application</p>
          </div>

          <div>
            <span className="text-caption font-semibold uppercase tracking-wider text-text-muted">Account Email</span>
            <p className="mt-1 flex items-center gap-2 text-body text-text-primary">
              <Mail className="h-4 w-4 text-text-muted" aria-hidden="true" />
              {vendor.email}
            </p>
          </div>

          <div>
            <span className="text-caption font-semibold uppercase tracking-wider text-text-muted">Quality Rating</span>
            <p className="mt-1 flex items-center gap-2 text-body font-bold text-text-primary">
              <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
              {vendor.rating ? `${vendor.rating} / 5.0` : 'New Partner (Pending Reviews)'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Operational Form (Editable fields) ───────────────────────────────── */}
      <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
        <h3 className="border-b border-border pb-4 text-h4 font-bold text-text-primary">
          Operational Contact & Details
        </h3>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="vendor-business-name" className="text-label font-semibold text-text-primary">
              Store Business Name <span className="text-status-error">*</span>
            </Label>
            <div className="relative mt-1">
              <Store className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
              <Input
                id="vendor-business-name"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Delicious Bites Restaurant"
                className="pl-9"
                required
              />
            </div>
            <p className="text-caption text-text-muted">
              The public brand name of your store displayed to customers.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="vendor-phone" className="text-label font-semibold text-text-primary">
                Store Phone Number <span className="text-status-error">*</span>
              </Label>
              <div className="relative mt-1">
                <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
                <Input
                  id="vendor-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 08012345678"
                  className="pl-9"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="vendor-service-area" className="text-label font-semibold text-text-primary">
                Service Delivery Area
              </Label>
              <div className="relative mt-1">
                <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
                <Input
                  id="vendor-service-area"
                  value={serviceArea}
                  onChange={(e) => setServiceArea(e.target.value)}
                  placeholder="e.g. Molipa, Awujale, Ijebu-Ode"
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="vendor-address" className="text-label font-semibold text-text-primary">
              Physical Store Address <span className="text-status-error">*</span>
            </Label>
            <Input
              id="vendor-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. 14 Awujale Street, Ijebu-Ode, Ogun State"
              className="mt-1"
              required
            />
          </div>

          <div>
            <Label htmlFor="vendor-description" className="text-label font-semibold text-text-primary">
              Store Description (Public Customer Bio)
            </Label>
            <Textarea
              id="vendor-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell customers about your kitchen specialties, fresh farm produce, or operating highlights…"
              className="mt-1 resize-none"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="vendor-hours" className="text-label font-semibold text-text-primary">
              Operating Hours
            </Label>
            <div className="relative mt-1">
              <Clock className="absolute left-3 top-3 h-4 w-4 text-text-muted" aria-hidden="true" />
              <Input
                id="vendor-hours"
                value={operatingHours}
                onChange={(e) => setOperatingHours(e.target.value)}
                placeholder="e.g. 8:00 AM - 9:00 PM (Daily)"
                className="pl-9"
              />
            </div>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              disabled={isSaving || isCompressingCover || isCompressingLogo}
              className="gap-2 font-bold text-white bg-primary hover:bg-primary-hover"
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              {isSaving ? 'Saving Changes…' : 'Save Business & Branding Changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
