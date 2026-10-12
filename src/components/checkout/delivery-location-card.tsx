import { useState } from 'react'
import { MapPin, X, Locate, CheckCircle, AlertTriangle } from 'lucide-react'
import { LocationMap } from '@/components/map'
import { AddressFormModal } from './address-form-modal'
import type { Address } from '@/types'
import { formatAddressDisplay } from '@/utils/geo'

export interface DeliveryLocationCardProps {
  addresses: Address[]
  selectedAddress: Address | null
  onSelectAddress: (address: Address) => void
  onAddressCreated: (address: Address) => void
  onDetectLocation?: () => void
  isDetectingLocation?: boolean
  isServiceable?: boolean
  isPinned?: boolean
  serviceAreaName?: string
  estimatedTime?: string
  isLoadingAddresses?: boolean
  onShowPermissionGuide?: () => void
}

export function DeliveryLocationCard({
  addresses,
  selectedAddress,
  onSelectAddress,
  onAddressCreated,
  onDetectLocation,
  isDetectingLocation = false,
  isServiceable = true,
  isPinned = true,
  serviceAreaName = 'Active Operating Zone',
  estimatedTime = '30-45 mins',
  isLoadingAddresses = false,
}: DeliveryLocationCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [showAddressDropdown, setShowAddressDropdown] = useState(false)

  const formattedAddressText = selectedAddress
    ? formatAddressDisplay(selectedAddress)
    : 'Select or detect delivery location'

  const handleClear = () => {
    if (addresses.length > 1) {
      setShowAddressDropdown(true)
    } else {
      setIsModalOpen(true)
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6 shadow-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-neutral-900">
            1. Delivery Location
          </h2>
          <p className="mt-0.5 text-xs sm:text-sm text-neutral-500">
            Enter your address or select a location on the map
          </p>
        </div>
        {onDetectLocation && (
          <button
            type="button"
            onClick={onDetectLocation}
            disabled={isDetectingLocation}
            className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-full border border-primary/30 bg-primary/5 hover:bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            title="Automatically detect my current location via GPS"
          >
            <Locate className={`h-3.5 w-3.5 ${isDetectingLocation ? 'animate-spin' : ''}`} />
            <span>{isDetectingLocation ? 'Detecting...' : 'Detect Location'}</span>
          </button>
        )}
      </div>

      {/* Address Search / Input Bar */}
      <div className="relative mb-4">
        <div className="flex items-center rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 shadow-2xs transition-colors hover:border-neutral-300 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
          <MapPin className="h-5 w-5 text-primary shrink-0 mr-3" aria-hidden="true" />

          <button
            type="button"
            onClick={() => {
              if (addresses.length > 1) {
                setShowAddressDropdown((prev) => !prev)
              } else {
                setIsModalOpen(true)
              }
            }}
            className="flex-1 text-left text-sm font-medium text-neutral-800 truncate focus:outline-none"
            title="Click to select or change address"
          >
            {isLoadingAddresses ? (
              <span className="text-neutral-400">Loading delivery addresses...</span>
            ) : selectedAddress ? (
              <span>{formattedAddressText}</span>
            ) : (
              <span className="text-neutral-400">Add or select delivery address...</span>
            )}
          </button>

          <div className="flex items-center gap-1.5 ml-2">
            {onDetectLocation && (
              <button
                type="button"
                onClick={onDetectLocation}
                disabled={isDetectingLocation}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
                aria-label="Detect current location"
                title="Detect current location via GPS"
              >
                <Locate className={`h-4 w-4 ${isDetectingLocation ? 'animate-spin' : ''}`} aria-hidden="true" />
              </button>
            )}

            {selectedAddress && (
              <button
                type="button"
                onClick={handleClear}
                className="rounded-md p-1 text-neutral-400 hover:text-neutral-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="Clear or change address"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 text-primary hover:border-primary hover:bg-primary/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Set pinpoint location on map"
              title="Pin exact location on map"
            >
              <MapPin className="h-4 w-4 text-primary" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Dropdown for saved addresses if multiple exist */}
        {showAddressDropdown && addresses.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-20 mt-1.5 rounded-xl border border-neutral-200 bg-white p-2 shadow-lg">
            <p className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              Select a saved address:
            </p>
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {addresses.map((addr) => (
                <button
                  key={addr.id}
                  type="button"
                  onClick={() => {
                    onSelectAddress(addr)
                    setShowAddressDropdown(false)
                  }}
                  className={`w-full rounded-lg px-3 py-2 text-left text-xs transition-colors flex items-center justify-between ${
                    addr.id === selectedAddress?.id
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  <span className="truncate">
                    <strong>{addr.label}:</strong> {addr.address_line_1}
                  </span>
                  {addr.id === selectedAddress?.id && (
                    <CheckCircle className="h-3.5 w-3.5 text-primary shrink-0 ml-2" />
                  )}
                </button>
              ))}
            </div>
            <div className="border-t border-neutral-100 pt-1.5 mt-1.5">
              <button
                type="button"
                onClick={() => {
                  setShowAddressDropdown(false)
                  setIsModalOpen(true)
                }}
                className="w-full rounded-lg px-3 py-1.5 text-center text-xs font-bold text-primary hover:bg-primary/5 transition-colors"
              >
                + Add New Address
              </button>
            </div>
          </div>
        )}
      </div>


      {/* Detecting Location Banner */}
      {isDetectingLocation && (
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-primary/5 border border-primary/20 px-3.5 py-2 text-xs text-primary animate-pulse">
          <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
          <span className="font-semibold">Detecting your current location via GPS...</span>
        </div>
      )}

      {/* Map Preview */}
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50">
        <LocationMap
          marker={
            selectedAddress?.latitude && selectedAddress?.longitude
              ? {
                  coords: {
                    latitude: Number(selectedAddress.latitude),
                    longitude: Number(selectedAddress.longitude),
                  },
                  label: `Delivery: ${selectedAddress.address_line_1}`,
                }
              : undefined
          }
          height={180}
        />
      </div>

      {/* Confirmation & Status Banner Below Map */}
      <div className="mt-3.5">
        {!selectedAddress ? (
          <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-600">
            <span>No delivery address selected.</span>
            <div className="flex items-center gap-2">
              {onDetectLocation && (
                <button
                  type="button"
                  onClick={onDetectLocation}
                  disabled={isDetectingLocation}
                  className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 font-bold text-primary hover:bg-primary/20 transition-colors"
                >
                  <Locate className="h-3.5 w-3.5" />
                  <span>Detect Location</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 font-bold text-white shadow-xs hover:bg-primary-hover transition-colors"
              >
                + Add Address
              </button>
            </div>
          </div>
        ) : !isPinned ? (
          <div
            role="alert"
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" aria-hidden="true" />
              <span>Please pin your delivery location on the map to calculate distance and delivery fee.</span>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              {onDetectLocation && (
                <button
                  type="button"
                  onClick={onDetectLocation}
                  disabled={isDetectingLocation}
                  className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1 text-[11px] shadow-2xs transition-colors"
                  title="Detect and pin your exact location via GPS"
                >
                  📍 Detect GPS
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="font-bold text-primary hover:underline ml-1"
              >
                Pin on Map
              </button>
            </div>
          </div>
        ) : !isServiceable ? (
          <div
            role="alert"
            className="flex items-center justify-between rounded-xl border border-error/30 bg-error/5 px-4 py-3 text-xs text-error"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-error shrink-0" aria-hidden="true" />
              <span>
                Your delivery address is outside the <strong>{serviceAreaName}</strong> zone. Deliveries outside this active zone cannot be processed.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="font-bold text-primary hover:underline shrink-0 ml-3"
            >
              Change location
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                <CheckCircle className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-bold text-neutral-900">
                  Great! We deliver to this location.
                </p>
                <p className="text-[11px] sm:text-xs text-neutral-500">
                  Estimated delivery time: {estimatedTime}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (addresses.length > 1) {
                  setShowAddressDropdown(true)
                } else {
                  setIsModalOpen(true)
                }
              }}
              className="text-xs font-bold text-primary hover:text-primary-hover hover:underline transition-colors shrink-0 ml-3"
            >
              Change location
            </button>
          </div>
        )}
      </div>

      {/* Address modal */}
      <AddressFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={(newAddr) => {
          onAddressCreated(newAddr)
          onSelectAddress(newAddr)
          setIsModalOpen(false)
        }}
      />
    </div>
  )
}
