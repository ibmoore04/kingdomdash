import { useState } from 'react'
import { MapPin, Plus, CheckCircle, Phone, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AddressFormModal } from './address-form-modal'
import type { Address } from '@/types'
import { cn } from '@/lib/cn'

export interface AddressSelectorProps {
  addresses: Address[]
  selectedAddressId: string | null
  onSelectAddress: (address: Address) => void
  onAddressCreated: (address: Address) => void
  isLoading?: boolean
}

export function AddressSelector({
  addresses,
  selectedAddressId,
  onSelectAddress,
  onAddressCreated,
  isLoading = false,
}: AddressSelectorProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleCreated = (newAddress: Address) => {
    onAddressCreated(newAddress)
    onSelectAddress(newAddress)
  }

  if (isLoading) {
    return (
      <div className="space-y-3 py-4">
        <div className="h-24 w-full animate-pulse rounded-xl bg-neutral-100 border border-border" />
        <div className="h-24 w-full animate-pulse rounded-xl bg-neutral-100 border border-border" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-h4 font-bold text-text-primary flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" aria-hidden="true" />
          <span>Delivery Address</span>
        </h3>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg text-caption font-semibold"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>Add New</span>
        </Button>
      </div>

      {addresses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center bg-white shadow-xs">
          <MapPin className="mx-auto h-8 w-8 text-text-muted" aria-hidden="true" />
          <p className="mt-2 text-body-small font-medium text-text-primary">No saved addresses found</p>
          <p className="mt-1 text-caption text-text-secondary">
            Please add your delivery address in Ijebu-Ode to proceed with checkout.
          </p>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => setIsModalOpen(true)}
            className="mt-4 rounded-lg bg-primary hover:bg-primary-hover text-white"
          >
            Add Delivery Address
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Select delivery address">
          {addresses.map((address) => {
            const isSelected = selectedAddressId === address.id

            return (
              <div
                key={address.id}
                role="radio"
                aria-checked={isSelected}
                tabIndex={0}
                onClick={() => onSelectAddress(address)}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault()
                    onSelectAddress(address)
                  }
                }}
                className={cn(
                  'relative cursor-pointer rounded-xl border p-4 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border bg-white hover:border-text-muted hover:shadow-xs'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-body-small text-text-primary">
                      {address.label}
                    </span>
                    {address.is_default && (
                      <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-primary/15 text-primary border-primary/20">
                        Default
                      </Badge>
                    )}
                    {address.latitude && address.longitude && (
                      <Badge variant="success" className="text-[10px] px-1.5 py-0">
                        GPS Pinned
                      </Badge>
                    )}
                  </div>

                  <div
                    className={cn(
                      'flex h-5 w-5 items-center justify-center rounded-full border transition-colors',
                      isSelected
                        ? 'border-primary bg-primary text-white'
                        : 'border-border bg-white text-transparent'
                    )}
                  >
                    <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  </div>
                </div>

                <div className="mt-2 space-y-1 text-caption text-text-secondary">
                  <p className="flex items-center gap-1.5 font-medium text-text-primary">
                    <User className="h-3.5 w-3.5 text-text-muted shrink-0" aria-hidden="true" />
                    <span>{address.recipient_name}</span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-text-muted shrink-0" aria-hidden="true" />
                    <span>{address.phone}</span>
                  </p>
                  <p className="pt-1 text-body-small text-text-primary line-clamp-2">
                    {address.address_line_1}
                    {address.address_line_2 ? `, ${address.address_line_2}` : ''}
                  </p>
                  <p className="text-caption text-text-muted">
                    {address.city}, {address.state}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <AddressFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleCreated}
      />
    </div>
  )
}
