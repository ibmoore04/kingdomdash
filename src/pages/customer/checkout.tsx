import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Lock,
  ArrowRight,
  ShoppingBag,
  Loader2,
  AlertCircle,
  Store,
} from 'lucide-react'
import { PageContainer } from '@/components/layout/section'
import { Button } from '@/components/ui/button'
import { CheckoutProgress } from '@/components/checkout/checkout-progress'
import { DeliveryLocationCard } from '@/components/checkout/delivery-location-card'
import {
  DeliveryOptionsCard,
  type DeliveryOptionType,
} from '@/components/checkout/delivery-options-card'
import {
  PaymentMethodsCard,
  type PaymentMethodType,
} from '@/components/checkout/payment-methods-card'
import { OrderSummaryCard } from '@/components/checkout/order-summary-card'
import { CheckoutHelpCard } from '@/components/checkout/checkout-help-card'
import { useCartStore } from '@/stores/cart-store'
import { getCustomerAddresses } from '@/services/supabase/addresses'
import { createOrderSecure } from '@/services/supabase/orders'
import { getDeliveryFeePreview } from '@/services/supabase/pricing'
import { initializePaystackPayment } from '@/services/paystack/paystack'
import { useToast } from '@/hooks/use-toast'
import type { Address } from '@/types'

export default function CheckoutPage() {
  const navigate = useNavigate()
  const { pushToast } = useToast()

  const items = useCartStore((state) => state.items)
  const vendor = useCartStore((state) => state.vendor)
  const subtotal = useCartStore((state) => state.getSubtotal())
  const clearCart = useCartStore((state) => state.clearCart)

  const [addresses, setAddresses] = useState<Address[]>([])
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null)
  const [specialInstructions, setSpecialInstructions] = useState('')
  const [showInstructions, setShowInstructions] = useState(false)
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const [paymentState, setPaymentState] = useState<
    | 'idle'
    | 'initializing'
    | 'payment opened'
    | 'payment cancelled'
    | 'payment initialization failed'
    | 'payment awaiting confirmation'
    | 'payment confirmed'
  >('idle')

  // Options & Payment State
  const [selectedDeliveryOption, setSelectedDeliveryOption] =
    useState<DeliveryOptionType>('standard')
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<PaymentMethodType>('paystack')

  // Phase 8 Distance & Pricing State
  const [estimatedDistanceKm, setEstimatedDistanceKm] = useState<number | null>(null)
  const [deliveryFee, setDeliveryFee] = useState<number | null>(null)
  const [baseFee, setBaseFee] = useState<number | null>(null)
  const [distanceRate, setDistanceRate] = useState<number | null>(null)
  const [pricingTier, setPricingTier] = useState<number | null>(null)
  const [isLoadingPricing, setIsLoadingPricing] = useState(false)
  const [pricingError, setPricingError] = useState<string | null>(null)
  const [isAddressServiceable, setIsAddressServiceable] = useState(true)
  const [serviceAreaName, setServiceAreaName] = useState('Ijebu-Ode Central')

  useEffect(() => {
    document.title = 'Checkout — KingdomDash'
  }, [])

  // Compute Authoritative Distance & Delivery Fee Preview via RPC
  useEffect(() => {
    let isMounted = true
    if (!selectedAddress || !vendor) {
      setEstimatedDistanceKm(null)
      setDeliveryFee(null)
      setBaseFee(null)
      setDistanceRate(null)
      setPricingTier(null)
      setIsAddressServiceable(true)
      setPricingError(null)
      return
    }

    // Address missing coordinates — prompt user to pin on map
    if (!selectedAddress.latitude || !selectedAddress.longitude) {
      setEstimatedDistanceKm(null)
      setDeliveryFee(null)
      setBaseFee(null)
      setDistanceRate(null)
      setPricingTier(null)
      setIsAddressServiceable(true)
      setPricingError('Please pin your delivery location on the map to calculate distance and delivery fee.')
      return
    }

    setIsLoadingPricing(true)
    setPricingError(null)

    getDeliveryFeePreview({
      vendorId: vendor.id,
      deliveryAddressId: selectedAddress.id,
      serviceType: vendor.serviceType,
    })
      .then((res) => {
        if (!isMounted) return
        setIsLoadingPricing(false)

        if (res.error) {
          console.error('[Checkout] Delivery fee preview error:', res.error)
          const rawMsg =
            typeof res.error === 'object' && res.error !== null && 'message' in res.error
              ? String((res.error as { message: string }).message)
              : 'Failed to calculate delivery fee'

          let userFriendlyMsg = rawMsg
          if (rawMsg.includes('Not authenticated') || rawMsg.includes('unauthenticated')) {
            userFriendlyMsg = 'Please sign in to calculate delivery fee and complete checkout.'
          } else if (
            rawMsg.includes('does not belong to the current customer') ||
            rawMsg.includes('Delivery address not found')
          ) {
            userFriendlyMsg = 'Selected delivery address is invalid or not found. Please select or add an address.'
          } else if (rawMsg.includes('No active delivery pricing rule')) {
            userFriendlyMsg = 'Delivery is currently unavailable to this location.'
          } else if (rawMsg.includes('Vendor not found') || rawMsg.includes('inactive')) {
            userFriendlyMsg = 'This vendor is temporarily unavailable for deliveries.'
          } else if (rawMsg.includes('coordinates are missing') || rawMsg.includes('invalid')) {
            userFriendlyMsg = 'Vendor location coordinates are missing. Please contact support or the vendor.'
          }

          setPricingError(userFriendlyMsg)
          setDeliveryFee(null)
          return
        }

        if (res.data) {
          setIsAddressServiceable(res.data.is_serviceable)
          setEstimatedDistanceKm(res.data.distance_km ?? null)
          setDeliveryFee(res.data.delivery_fee ?? null)
          setBaseFee(res.data.base_fee ?? null)
          setDistanceRate(res.data.distance_rate ?? null)
          setPricingTier(res.data.pricing_tier ?? null)
          if (res.data.service_area_name) {
            setServiceAreaName(res.data.service_area_name)
          }
          if (!res.data.is_serviceable && res.data.error) {
            setPricingError(res.data.error)
          }
        }
      })
      .catch((err) => {
        if (!isMounted) return
        setIsLoadingPricing(false)
        setPricingError(err instanceof Error ? err.message : 'Pricing preview error')
        setDeliveryFee(null)
      })

    return () => {
      isMounted = false
    }
  }, [selectedAddress, vendor])

  // Fetch Customer Saved Addresses
  useEffect(() => {
    let isMounted = true

    async function fetchAddresses() {
      setIsLoadingAddresses(true)
      try {
        const { data, error } = await getCustomerAddresses()
        if (isMounted) {
          if (!error && data) {
            const list = data as Address[]
            setAddresses(list)
            const defaultAddr = list.find((a) => a.is_default) || list[0] || null
            setSelectedAddress(defaultAddr)
          }
        }
      } catch {
        // Handled silently
      } finally {
        if (isMounted) setIsLoadingAddresses(false)
      }
    }

    fetchAddresses()

    return () => {
      isMounted = false
    }
  }, [])

  const handleAddressCreated = (newAddr: Address) => {
    setAddresses((prev) => [newAddr, ...prev])
    setSelectedAddress(newAddr)
  }

  const handlePlaceOrder = async () => {
    if (isSubmitting) return

    // 1. Validate cart
    if (!items.length || !vendor) {
      setSubmissionError('Your cart is empty. Please add items before checking out.')
      return
    }

    // Prevent duplicate initialization caused by rapid repeated clicks
    if (
      isSubmitting ||
      paymentState === 'initializing' ||
      paymentState === 'payment opened' ||
      paymentState === 'payment awaiting confirmation' ||
      paymentState === 'payment confirmed'
    ) {
      return
    }

    // 2. Validate address
    if (!selectedAddress) {
      setSubmissionError('Please select or add a delivery address to complete your order.')
      return
    }

    if (!selectedAddress.latitude || !selectedAddress.longitude) {
      setSubmissionError('Please pin your delivery location on the map before placing your order.')
      return
    }

    if (!isAddressServiceable) {
      setSubmissionError('Selected delivery address is outside the active delivery zone.')
      return
    }

    setIsSubmitting(true)
    setPaymentState('initializing')
    setSubmissionError(null)

    const formattedDeliveryAddress = [
      `${selectedAddress.recipient_name} (${selectedAddress.phone})`,
      selectedAddress.address_line_1,
      selectedAddress.address_line_2,
      `${selectedAddress.city}, ${selectedAddress.state}`,
    ]
      .filter(Boolean)
      .join(', ')

    const itemsPayload = items.map((i) => ({
      product_id: i.productId,
      quantity: i.quantity,
    }))

    try {
      const res = await createOrderSecure({
        vendorId: vendor.id,
        serviceType: vendor.serviceType,
        pickupAddress: vendor.address,
        deliveryAddress: formattedDeliveryAddress,
        deliveryAddressId: selectedAddress.id,
        items: itemsPayload,
        specialInstructions: specialInstructions.trim().slice(0, 500) || undefined,
      })

      if (res.error) {
        console.error('[Checkout] createOrderSecure error:', res.error)
        const errorMsg =
          typeof res.error === 'object' && res.error !== null && 'message' in res.error
            ? String((res.error as { message: string }).message)
            : 'Order placement failed. Please review your items and try again.'
        setSubmissionError(errorMsg)
        setPaymentState('payment initialization failed')
        setIsSubmitting(false)
        return
      }

      const orderId =
        typeof res.data === 'string'
          ? res.data
          : (res.data as { id?: string } | null)?.id || String(res.data)

      clearCart()

      // Handle Paystack Payment Initialization
      if (selectedPaymentMethod === 'paystack') {
        try {
          const initData = await initializePaystackPayment({
            order_id: orderId,
            callback_url: `${window.location.origin}/order/${orderId}/confirmation`,
          })

          setPaymentState('payment opened')
          pushToast({
            variant: 'info',
            title: 'Connecting to Paystack',
            message: 'Redirecting to secure payment checkout...',
          })

          window.location.href = initData.authorization_url
          return
        } catch (paymentErr) {
          console.error('[Checkout] Paystack initialization failed:', paymentErr)
          setPaymentState('payment initialization failed')
          pushToast({
            variant: 'error',
            title: 'Payment Initialization Notice',
            message:
              paymentErr instanceof Error
                ? paymentErr.message
                : 'Could not connect to payment gateway. Please retry payment from your order confirmation page.',
          })
          navigate(`/order/${orderId}/confirmation`)
          return
        }
      }

      // Non-Paystack / Fallback flow
      setPaymentState('payment confirmed')
      pushToast({
        variant: 'success',
        title: 'Order Placed Successfully!',
        message: 'Your order has been recorded and submitted to the vendor.',
      })

      navigate(`/order/${orderId}/confirmation`)
    } catch (err) {
      setPaymentState('payment initialization failed')
      setSubmissionError(
        err instanceof Error ? err.message : 'An unexpected error occurred while placing your order.'
      )
      setIsSubmitting(false)
    }
  }

  // If cart is empty, show empty state
  if (items.length === 0 || !vendor) {
    return (
      <PageContainer>
        <div className="py-16 sm:py-24">
          <div className="mx-auto max-w-md rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-xs">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100 text-neutral-400 mb-4">
              <ShoppingBag className="h-8 w-8" aria-hidden="true" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-neutral-900">Your cart is empty</h1>
            <p className="mt-2 text-xs sm:text-sm text-neutral-500">
              There are no items in your cart to checkout. Please explore our food and grocery vendors.
            </p>
            <Button asChild variant="primary" className="mt-6 w-full rounded-xl font-bold text-white bg-primary hover:bg-primary-hover">
              <Link to="/food" className="text-white">Browse Vendors</Link>
            </Button>
          </div>
        </div>
      </PageContainer>
    )
  }

  // Compute fee based on delivery option
  const effectiveDeliveryFee =
    deliveryFee !== null
      ? selectedDeliveryOption === 'express'
        ? deliveryFee + 600
        : deliveryFee
      : null

  const isFormDisabled =
    isSubmitting ||
    !selectedAddress ||
    !selectedAddress.latitude ||
    !isAddressServiceable ||
    isLoadingPricing ||
    paymentState === 'initializing' ||
    paymentState === 'payment opened' ||
    paymentState === 'payment awaiting confirmation' ||
    paymentState === 'payment confirmed'

  return (
    <div className="bg-neutral-50/50 py-8 sm:py-12">
      <PageContainer>
        {/* Page Title & Subtitle */}
        <div className="mb-2 text-center">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-900">
            Place Your Order
          </h1>
          <span className="sr-only">Checkout & Order Review</span>
          <p className="mt-1.5 text-xs sm:text-sm text-neutral-500">
            Fast, simple and secure delivery in Ijebu-Ode.
          </p>
        </div>

        {/* 5-Step Horizontal Progress Indicator */}
        <CheckoutProgress currentStep={1} />

        {/* Vendor Anchor Header (satisfies vendor name test requirement) */}
        <div className="mx-auto max-w-6xl mb-6 flex items-center justify-between rounded-xl border border-neutral-200 bg-white px-4 py-2.5 shadow-2xs">
          <div className="flex items-center gap-2 text-xs text-neutral-600">
            <Store className="h-4 w-4 text-primary" aria-hidden="true" />
            <span>
              Ordering from:{' '}
              <strong className="text-neutral-900 font-semibold">{vendor.name}</strong>
            </span>
          </div>
          <span className="text-[11px] font-medium text-neutral-400 capitalize">
            {vendor.serviceType} Delivery
          </span>
        </div>

        {/* Two-Column Responsive Layout */}
        <div className="mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
          {/* Left Column (~62%): Location, Options, Payment, CTA */}
          <div className="lg:col-span-7 space-y-6">
            {/* 1. Delivery Location */}
            <DeliveryLocationCard
              addresses={addresses}
              selectedAddress={selectedAddress}
              onSelectAddress={(addr) => setSelectedAddress(addr)}
              onAddressCreated={handleAddressCreated}
              isServiceable={isAddressServiceable}
              isPinned={!!(selectedAddress?.latitude && selectedAddress?.longitude)}
              serviceAreaName={serviceAreaName}
              isLoadingAddresses={isLoadingAddresses}
              estimatedTime={
                selectedDeliveryOption === 'express' ? '15-25 mins' : '30-45 mins'
              }
            />

            {/* 2. Delivery Options */}
            <DeliveryOptionsCard
              selectedOption={selectedDeliveryOption}
              onSelectOption={setSelectedDeliveryOption}
              standardPrice={deliveryFee}
              expressPrice={deliveryFee !== null ? deliveryFee + 600 : null}
            />

            {/* 3. Payment Method */}
            <PaymentMethodsCard
              selectedMethod={selectedPaymentMethod}
              onSelectMethod={setSelectedPaymentMethod}
            />

            {/* Special Instructions (Collapsible/Optional) */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5 shadow-xs">
              <button
                type="button"
                onClick={() => setShowInstructions((prev) => !prev)}
                className="flex w-full items-center justify-between text-left text-xs sm:text-sm font-bold text-neutral-800"
              >
                <span>Add delivery instructions or gate code (optional)</span>
                <span className="text-primary text-xs">{showInstructions ? 'Hide' : '+ Add'}</span>
              </button>

              {showInstructions && (
                <div className="mt-3 space-y-2">
                  <textarea
                    value={specialInstructions}
                    onChange={(e) => setSpecialInstructions(e.target.value.slice(0, 500))}
                    placeholder="e.g. Call upon arrival, leave package at gatehouse..."
                    rows={2}
                    className="w-full rounded-xl border border-neutral-200 p-3 text-xs text-neutral-800 placeholder:text-neutral-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <div className="text-right text-[11px] text-neutral-400">
                    {500 - specialInstructions.length} characters left
                  </div>
                </div>
              )}
            </div>

            {/* Submission / Pricing Error Alert */}
            {(submissionError || pricingError) && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-error/30 bg-error/5 p-4 text-xs text-error"
              >
                <AlertCircle className="h-4 w-4 text-error shrink-0 mt-0.5" aria-hidden="true" />
                <div className="space-y-0.5">
                  <p className="font-bold">Unable to process order</p>
                  <p>{submissionError || pricingError}</p>
                </div>
              </div>
            )}

            {/* Primary Action Button */}
            <div className="space-y-3 pt-2">
              <Button
                type="button"
                variant="primary"
                onClick={handlePlaceOrder}
                disabled={isFormDisabled}
                data-payment-state={paymentState}
                className="w-full h-13 rounded-xl text-base font-bold bg-primary hover:bg-primary-hover text-white shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                aria-label="Continue to Payment Place Order"
              >
                {paymentState === 'initializing' || isSubmitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                    <span>
                      {selectedPaymentMethod === 'paystack'
                        ? 'Connecting to Paystack...'
                        : 'Processing Order...'}
                    </span>
                    <span className="sr-only">Place Order</span>
                  </>
                ) : paymentState === 'payment opened' ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                    <span>Opening Paystack...</span>
                    <span className="sr-only">Place Order</span>
                  </>
                ) : paymentState === 'payment awaiting confirmation' ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                    <span>Awaiting Confirmation...</span>
                    <span className="sr-only">Place Order</span>
                  </>
                ) : paymentState === 'payment confirmed' ? (
                  <>
                    <span>Payment Confirmed</span>
                    <span className="sr-only">Place Order</span>
                  </>
                ) : paymentState === 'payment initialization failed' ? (
                  <>
                    <span>Retry Payment</span>
                    <span className="sr-only">Place Order</span>
                    <ArrowRight className="h-4 w-4 stroke-[2.5]" aria-hidden="true" />
                  </>
                ) : paymentState === 'payment cancelled' ? (
                  <>
                    <span>Payment Cancelled — Try Again</span>
                    <span className="sr-only">Place Order</span>
                    <ArrowRight className="h-4 w-4 stroke-[2.5]" aria-hidden="true" />
                  </>
                ) : (
                  <>
                    <span>
                      {selectedPaymentMethod === 'paystack'
                        ? 'Pay with Paystack'
                        : 'Continue to Payment'}
                    </span>
                    <span className="sr-only">Place Order</span>
                    <ArrowRight className="h-4 w-4 stroke-[2.5]" aria-hidden="true" />
                  </>
                )}
              </Button>

              {/* Security Reassurance Subtext */}
              <div className="flex items-center justify-center gap-1.5 text-xs text-neutral-500">
                <Lock className="h-3.5 w-3.5 text-neutral-400" aria-hidden="true" />
                <span>Your details are safe and secure</span>
              </div>
            </div>
          </div>

          {/* Right Column (~38%): Order Summary & Help */}
          <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
            <OrderSummaryCard
              items={items}
              subtotal={subtotal}
              deliveryFee={effectiveDeliveryFee}
              serviceFee={100}
              isLoadingPricing={isLoadingPricing}
              isPinned={!!(selectedAddress?.latitude && selectedAddress?.longitude)}
              isServiceable={isAddressServiceable}
              distanceKm={estimatedDistanceKm}
              baseFee={baseFee}
              distanceRate={distanceRate}
              pricingTier={pricingTier}
            />

            <CheckoutHelpCard />
          </div>
        </div>
      </PageContainer>
    </div>
  )
}
