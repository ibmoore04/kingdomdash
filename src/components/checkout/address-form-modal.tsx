import { useState, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { FormField } from '@/components/ui/form-field'
import {
  createCustomerAddress,
  updateCustomerAddress,
  type CreateAddressInput,
} from '@/services/supabase/addresses'
import { checkLocationServiceability } from '@/services/supabase/locations'
import { getGeocodingProvider, type GeocodeResult } from '@/services/geocoding'
import { LocationPickerMap } from '@/components/map'
import type { Address, Coordinates } from '@/types'
import {
  IJEBU_ODE_CENTER,
  isValidCoordinates,
  formatCoordinates,
} from '@/utils/geo'
import { AlertTriangle, CheckCircle2, MapPin, Search } from 'lucide-react'

export interface AddressFormModalProps {
  isOpen: boolean
  editingAddress?: Address | null
  onClose: () => void
  onSuccess: (savedAddress: Address) => void
}

function isValidNigerianPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-()]/g, '')
  return /^(?:\+?234|0)[789]\d{9}$/.test(cleaned)
}

export function AddressFormModal({
  isOpen,
  editingAddress,
  onClose,
  onSuccess,
}: AddressFormModalProps) {
  const [label, setLabel] = useState('Home')
  const [recipientName, setRecipientName] = useState('')
  const [phone, setPhone] = useState('')
  const [addressLine1, setAddressLine1] = useState('')
  const [addressLine2, setAddressLine2] = useState('')
  const [city, setCity] = useState('Ijebu-Ode')
  const [stateVal, setStateVal] = useState('Ogun State')
  const [postalCode, setPostalCode] = useState('')
  const [isDefault, setIsDefault] = useState(false)

  // Geolocation & Serviceability state
  const [coords, setCoords] = useState<Coordinates | null>(null)
  const [serviceAreaId, setServiceAreaId] = useState<string | null>(null)
  const [isServiceable, setIsServiceable] = useState<boolean>(true)
  const [activeZoneName, setActiveZoneName] = useState<string>('Ijebu-Ode Central')

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<GeocodeResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inFlightAbortRef = useRef<AbortController | null>(null)

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  // Cleanup pending search timer and abort in-flight fetch on close/unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
      if (inFlightAbortRef.current) {
        inFlightAbortRef.current.abort()
      }
    }
  }, [isOpen])

  useEffect(() => {
    if (editingAddress) {
      setLabel(editingAddress.label || 'Home')
      setRecipientName(editingAddress.recipient_name)
      setPhone(editingAddress.phone)
      setAddressLine1(editingAddress.address_line_1)
      setAddressLine2(editingAddress.address_line_2 || '')
      setCity(editingAddress.city || 'Ijebu-Ode')
      setStateVal(editingAddress.state || 'Ogun State')
      setPostalCode(editingAddress.postal_code || '')
      setIsDefault(editingAddress.is_default)

      if (editingAddress.latitude && editingAddress.longitude) {
        const initialCoords = {
          latitude: Number(editingAddress.latitude),
          longitude: Number(editingAddress.longitude),
        }
        setCoords(initialCoords)
        setServiceAreaId(editingAddress.service_area_id || null)
        checkLocationServiceability(initialCoords, editingAddress.service_area_id || undefined)
          .then((res) => {
            setIsServiceable(res.isServiceable)
            if (res.serviceArea?.name) setActiveZoneName(res.serviceArea.name)
          })
          .catch(() => {})
      } else {
        setCoords(IJEBU_ODE_CENTER)
      }
    } else {
      setLabel('Home')
      setRecipientName('')
      setPhone('')
      setAddressLine1('')
      setAddressLine2('')
      setCity('Ijebu-Ode')
      setStateVal('Ogun State')
      setPostalCode('')
      setIsDefault(false)
      setCoords(IJEBU_ODE_CENTER)
      setServiceAreaId(null)
      setIsServiceable(true)
      setActiveZoneName('Ijebu-Ode Central')
    }

    setSuggestions([])
    setShowSuggestions(false)
    setErrors({})
    setServerError(null)
  }, [editingAddress, isOpen])

  // Handle Debounced Geocoding Autocomplete with Cancellation
  const handleAddressLine1Change = (value: string) => {
    setAddressLine1(value)

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    // Abort any active in-flight request
    if (inFlightAbortRef.current) {
      inFlightAbortRef.current.abort()
      inFlightAbortRef.current = null
    }

    const trimmed = value.trim()
    if (trimmed.length < 3) {
      setSuggestions([])
      setShowSuggestions(false)
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    searchTimeoutRef.current = setTimeout(async () => {
      const abortController = new AbortController()
      inFlightAbortRef.current = abortController

      try {
        const provider = getGeocodingProvider()
        const results = await provider.forwardGeocode(trimmed, {
          countryCode: 'ng',
          limit: 4,
          signal: abortController.signal,
        })
        if (!abortController.signal.aborted) {
          setSuggestions(results)
          setShowSuggestions(results.length > 0)
        }
      } catch (err) {
        if ((err as Error)?.name !== 'AbortError') {
          console.debug('Geocoding search failed:', err)
          setSuggestions([])
        }
      } finally {
        if (!abortController.signal.aborted) {
          setIsSearching(false)
        }
      }
    }, 400)
  }

  // Handle Candidate Selection from Autocomplete
  const handleSelectCandidate = async (candidate: GeocodeResult) => {
    setAddressLine1(candidate.streetName || candidate.formattedAddress.split(',')[0])
    if (candidate.city) setCity(candidate.city)
    if (candidate.state) setStateVal(candidate.state)
    setCoords(candidate.coordinates)
    setShowSuggestions(false)

    // Verify serviceability
    const checkRes = await checkLocationServiceability(candidate.coordinates)
    setIsServiceable(checkRes.isServiceable)
    if (checkRes.serviceArea) {
      setServiceAreaId(checkRes.serviceArea.id)
      setActiveZoneName(checkRes.serviceArea.name)
    }
  }

  // Handle Pin Drag/Click on Map
  const handleMapPinChange = async (newCoords: Coordinates) => {
    setCoords(newCoords)
    const checkRes = await checkLocationServiceability(newCoords)
    setIsServiceable(checkRes.isServiceable)
    if (checkRes.serviceArea) {
      setServiceAreaId(checkRes.serviceArea.id)
      setActiveZoneName(checkRes.serviceArea.name)
    }
  }

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!label.trim()) errs.label = 'Label is required (e.g. Home, Office)'
    if (!recipientName.trim()) errs.recipientName = 'Recipient name is required'
    if (!phone.trim()) {
      errs.phone = 'Phone number is required'
    } else if (!isValidNigerianPhone(phone)) {
      errs.phone = 'Enter a valid Nigerian phone number (e.g. 08012345678 or +234...)'
    }
    if (!addressLine1.trim()) errs.addressLine1 = 'Street address is required'
    if (!city.trim()) errs.city = 'City is required'
    if (!stateVal.trim()) errs.state = 'State is required'

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setIsSubmitting(true)
    setServerError(null)

    const payload: CreateAddressInput = {
      label: label.trim(),
      recipient_name: recipientName.trim(),
      phone: phone.trim(),
      address_line_1: addressLine1.trim(),
      address_line_2: addressLine2.trim() || null,
      city: city.trim(),
      state: stateVal.trim(),
      postal_code: postalCode.trim() || null,
      latitude: coords && isValidCoordinates(coords) ? coords.latitude : null,
      longitude: coords && isValidCoordinates(coords) ? coords.longitude : null,
      service_area_id: serviceAreaId,
      is_default: isDefault,
    }

    try {
      if (editingAddress) {
        const { data, error } = await updateCustomerAddress(editingAddress.id, payload)
        if (error || !data) {
          setServerError(error instanceof Error ? error.message : 'Failed to update address')
          return
        }
        onSuccess(data as Address)
      } else {
        const { data, error } = await createCustomerAddress(payload)
        if (error || !data) {
          setServerError(error instanceof Error ? error.message : 'Failed to create address')
          return
        }
        onSuccess(data as Address)
      }
      onClose()
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl p-6 max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-h4 font-bold text-text-primary flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            <span>{editingAddress ? 'Edit Delivery Address' : 'Add New Delivery Address'}</span>
          </DialogTitle>
        </DialogHeader>

        {serverError && (
          <div className="mt-2 rounded-lg bg-error/10 border border-error/20 p-3 text-caption text-error">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField id="address-label" label="Address Label" required error={errors.label}>
              <Input
                id="address-label"
                placeholder="e.g. Home, Office"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                disabled={isSubmitting}
              />
            </FormField>

            <FormField id="recipient-name" label="Recipient Name" required error={errors.recipientName}>
              <Input
                id="recipient-name"
                placeholder="Full name"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                disabled={isSubmitting}
              />
            </FormField>
          </div>

          <FormField id="phone" label="Phone Number" required error={errors.phone}>
            <Input
              id="phone"
              type="tel"
              placeholder="08012345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={isSubmitting}
            />
          </FormField>

          {/* Street Address with Autocomplete suggestions */}
          <div className="relative">
            <FormField id="address-line-1" label="Street Address / Landmark" required error={errors.addressLine1}>
              <div className="relative">
                <Input
                  id="address-line-1"
                  placeholder="e.g. Awujale Street, Folagbade, Degun..."
                  value={addressLine1}
                  onChange={(e) => handleAddressLine1Change(e.target.value)}
                  disabled={isSubmitting}
                  className="pr-9"
                />
                <div className="absolute right-2.5 top-2.5 text-text-muted">
                  {isSearching ? (
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                </div>
              </div>
            </FormField>

            {/* Candidate Autocomplete Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white dark:bg-slate-900 rounded-lg border border-border shadow-lg overflow-hidden divide-y divide-border">
                {suggestions.map((cand, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectCandidate(cand)}
                    className="w-full text-left px-3 py-2.5 hover:bg-primary/5 transition-colors flex items-start gap-2.5 text-xs text-text-primary"
                  >
                    <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">{cand.streetName || cand.formattedAddress.split(',')[0]}</p>
                      <p className="text-text-muted text-[11px] line-clamp-1">{cand.formattedAddress}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <FormField id="address-line-2" label="Apartment / Suite / Landmark Note (Optional)">
            <Input
              id="address-line-2"
              placeholder="Flat 3, Near Mosque, Behind Market, etc."
              value={addressLine2}
              onChange={(e) => setAddressLine2(e.target.value)}
              disabled={isSubmitting}
            />
          </FormField>

          {/* Interactive Doorstep Pin Map */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-xs">
              <Label className="font-semibold text-text-primary flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-primary" />
                Pinpoint Delivery Doorstep
              </Label>
              {coords && isValidCoordinates(coords) && (
                <span className="text-text-muted font-mono text-[11px]">
                  {formatCoordinates(coords)}
                </span>
              )}
            </div>

            <LocationPickerMap
              value={coords}
              onChange={handleMapPinChange}
              serviceArea={{
                center: IJEBU_ODE_CENTER,
                radiusKm: 12.5,
                name: activeZoneName,
              }}
              height={200}
              readOnly={isSubmitting}
            />

            {/* Serviceability Banner */}
            {!isServiceable ? (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs mt-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p>
                  <strong>Notice:</strong> This location appears to be outside our primary Ijebu-Ode delivery perimeter. You can save this address, but delivery availability will be confirmed at checkout.
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 mt-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Delivery confirmed within <strong>{activeZoneName}</strong>.</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <FormField id="city" label="City" required error={errors.city}>
              <Input
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                disabled={isSubmitting}
              />
            </FormField>

            <FormField id="state" label="State" required error={errors.state}>
              <Input
                id="state"
                value={stateVal}
                onChange={(e) => setStateVal(e.target.value)}
                disabled={isSubmitting}
              />
            </FormField>
          </div>

          <div className="flex items-center space-x-2 pt-1">
            <Checkbox
              id="is-default"
              checked={isDefault}
              onCheckedChange={(checked) => setIsDefault(checked === true)}
              disabled={isSubmitting}
            />
            <Label htmlFor="is-default" className="text-body-small cursor-pointer font-medium text-text-primary">
              Set as my default delivery address
            </Label>
          </div>

          <div className="mt-6 flex justify-end gap-3 pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              className="bg-primary hover:bg-primary-hover text-white"
            >
              {isSubmitting ? 'Saving...' : editingAddress ? 'Update Address' : 'Save Address'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
