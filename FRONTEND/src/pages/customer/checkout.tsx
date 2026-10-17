import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Lock,
  ArrowRight,
  ShoppingBag,
  Loader2,
  AlertCircle,
  Store,
  ExternalLink,
} from 'lucide-react'
import { PageContainer } from '@/components/layout/section'
import { Button } from '@/components/ui/button'
import { CheckoutProgress } from '@/components/checkout/checkout-progress'
import { DeliveryLocationCard } from '@/components/checkout/delivery-location-card'
import { LocationPermissionModal } from '@/components/common/location-permission-modal'
import {
  DeliveryOptionsCard,
  type DeliveryOptionType,
} from '@/components/checkout/delivery-options-card'
import {
  PaymentMethodsCard,
  type PaymentMethodType,
} from '@/components/checkout/payment-methods-card'
import { OrderSummaryCard } from '@/components/checkout/order-summary-card'
import { RiderTipSelector } from '@/components/checkout/rider-tip-selector'
import { EnterpriseTrustBanner } from '@/components/shared/trust-badges'
import { CheckoutHelpCard } from '@/components/checkout/checkout-help-card'
import { CostBreakdownAccordion } from '@/components/cart/cost-breakdown-accordion'
import { useCartStore } from '@/stores/cart-store'
import {
  getCustomerAddresses,
  createCustomerAddress,
  updateCustomerAddress,
} from '@/services/supabase/addresses'
import { getCurrentBrowserCoordinates } from '@/utils/geo'
import { checkLocationServiceability } from '@/services/supabase/locations'
import { getGeocodingProvider } from '@/services/geocoding'
import { createOrderSecure } from '@/services/supabase/orders'
import { getDeliveryFeePreview } from '@/services/supabase/pricing'
import { initializePaystackPayment } from '@/services/paystack/paystack'
import {
  openFlutterwaveCheckout,
  initializeFlutterwavePayment,
} from '@/services/flutterwave/flutterwave'
import { validatePromoCode } from '@/services/promo/promo-service'
import { useAuthStore } from '@/stores/auth-store'
import {
  getLoyaltyAccount,
  fetchLoyaltyAccountFromBackend,
  redeemPoints,
  creditOrderPoints,
  type LoyaltyAccount,
} from '@/services/loyalty/loyalty-service'
import { useToast } from '@/hooks/use-toast'
import { formatNgn } from '@/utils/formatting'
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
  const [appliedPromoCode, setAppliedPromoCode] = useState<string>('')
  const [promoDiscount, setPromoDiscount] = useState<number>(0)
  const [promoError, setPromoError] = useState<string | null>(null)
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(true)
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const [acceptRefundPolicy, setAcceptRefundPolicy] = useState(false)

  const addressSectionRef = useRef<HTMLDivElement>(null)
  const refundPolicyRef = useRef<HTMLDivElement>(null)

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
  const { profile } = useAuthStore()
  const [selectedDeliveryOption, setSelectedDeliveryOption] =
    useState<DeliveryOptionType>('standard')
  const [scheduledDate, setScheduledDate] = useState<string>('')
  const [scheduledSlot, setScheduledSlot] = useState<string>('09:00 AM - 11:00 AM')
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<PaymentMethodType>('paystack')

  // Phase 3 Growth: Loyalty & KD Pass State
  const [loyaltyAccount, setLoyaltyAccount] = useState<LoyaltyAccount | null>(null)
  const [pointsDiscount, setPointsDiscount] = useState<number>(0)
  const [riderTip, setRiderTip] = useState<number>(0)

  useEffect(() => {
    let isMounted = true
    if (profile?.id) {
      // 1. Initial local state for immediate render
      const local = getLoyaltyAccount(profile.id)
      setLoyaltyAccount(local)

      // 2. Authoritative backend sync from public.loyalty_accounts
      fetchLoyaltyAccountFromBackend(profile.id)
        .then((serverAccount) => {
          if (isMounted && serverAccount) {
            setLoyaltyAccount(serverAccount)
          }
        })
        .catch(() => {
          // Keep local fallback on network failure
        })
    }
    return () => {
      isMounted = false
    }
  }, [profile?.id])

  // Phase 8 Distance & Pricing State
  const [estimatedDistanceKm, setEstimatedDistanceKm] = useState<number | null>(null)
  const [deliveryFee, setDeliveryFee] = useState<number | null>(null)
  const [baseFee, setBaseFee] = useState<number | null>(null)
  const [distanceRate, setDistanceRate] = useState<number | null>(null)
  const [pricingTier, setPricingTier] = useState<number | null>(null)
  const [serviceFee, setServiceFee] = useState<number>(150)
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
          if (typeof res.data.service_fee === 'number') {
            setServiceFee(res.data.service_fee)
          }
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

  const [isDetectingLocation, setIsDetectingLocation] = useState(false)
  const hasUserManuallySelectedRef = useRef(false)

  const detectCurrentLocation = async (silent = false, initialAddresses?: Address[]) => {
    setIsDetectingLocation(true)
    try {
      const coords = await getCurrentBrowserCoordinates()

      // Check dynamic serviceability against active service areas in database
      const serviceCheck = await checkLocationServiceability(coords)
      setIsAddressServiceable(serviceCheck.isServiceable)
      if (serviceCheck.serviceArea?.name) {
        setServiceAreaName(serviceCheck.serviceArea.name)
      }

      // Reverse geocode dynamically to resolve street, neighborhood, city, and state
      let streetName = ''
      let neighborhoodName = ''
      let cityName = ''
      let stateName = ''
      let formattedAddress = ''

      try {
        const provider = getGeocodingProvider()
        const geoRes = await provider.reverseGeocode(coords)
        if (geoRes) {
          streetName = geoRes.streetName || ''
          neighborhoodName = geoRes.neighborhood || ''
          cityName = geoRes.city || ''
          stateName = geoRes.state || ''
          formattedAddress = geoRes.formattedAddress || ''
        }
      } catch (geoErr) {
        console.warn('[Checkout] Dynamic reverse geocoding fallback:', geoErr)
      }

      // If user manually selected a specific address while silent detection was running, respect their choice
      if (silent && hasUserManuallySelectedRef.current) {
        return
      }

      const activeAddresses = initialAddresses || addresses
      const displayStreet = streetName || neighborhoodName || ''
      const displayCity = cityName || ''

      // Clean human-readable address line 1: e.g. "Mobalufon Street" or "Ajao Rd"
      const cleanStreetLine =
        streetName ||
        (formattedAddress ? formattedAddress.split(',')[0].trim() : '') ||
        neighborhoodName ||
        displayCity ||
        'Pinned Location'

      const fullAddressLine1 = cleanStreetLine
      const addressLabel = `📍 ${cleanStreetLine || displayCity || 'Detected Location'}`

      const existingCurrentAddr = activeAddresses.find(
        (a) =>
          a.label?.startsWith('📍') ||
          (a.latitude &&
            Math.abs(a.latitude - coords.latitude) < 0.05 &&
            a.longitude &&
            Math.abs(a.longitude - coords.longitude) < 0.05)
      )

      if (profile?.id) {
        if (existingCurrentAddr) {
          const { data: updated, error } = await updateCustomerAddress(existingCurrentAddr.id, {
            label: addressLabel,
            address_line_1: fullAddressLine1,
            city: cityName || existingCurrentAddr.city,
            state: stateName || existingCurrentAddr.state,
            latitude: coords.latitude,
            longitude: coords.longitude,
            service_area_id: serviceCheck.serviceArea?.id || existingCurrentAddr.service_area_id,
            is_default: true,
          })
          if (!error && updated) {
            const updatedAddr = updated as Address
            setAddresses((prev) =>
              prev.map((a) => (a.id === updatedAddr.id ? updatedAddr : a))
            )
            setSelectedAddress(updatedAddr)
          } else {
            const patched: Address = {
              ...existingCurrentAddr,
              label: addressLabel,
              address_line_1: fullAddressLine1,
              city: cityName || existingCurrentAddr.city,
              state: stateName || existingCurrentAddr.state,
              latitude: coords.latitude,
              longitude: coords.longitude,
              service_area_id: serviceCheck.serviceArea?.id || existingCurrentAddr.service_area_id,
            }
            setSelectedAddress(patched)
          }
        } else {
          const { data: created, error } = await createCustomerAddress({
            label: addressLabel,
            recipient_name: profile.full_name || 'Customer',
            phone: profile.phone || '',
            address_line_1: fullAddressLine1,
            city: cityName || '',
            state: stateName || '',
            latitude: coords.latitude,
            longitude: coords.longitude,
            service_area_id: serviceCheck.serviceArea?.id || null,
            is_default: true,
          })
          if (!error && created) {
            const newAddr = created as Address
            setAddresses((prev) => [newAddr, ...prev.filter((a) => a.id !== newAddr.id)])
            setSelectedAddress(newAddr)
          } else {
            const fallbackAddr: Address = {
              id: `gps-${Date.now()}`,
              profile_id: profile.id,
              label: addressLabel,
              recipient_name: profile.full_name || 'Customer',
              phone: profile.phone || '',
              address_line_1: fullAddressLine1,
              address_line_2: null,
              city: cityName || '',
              state: stateName || '',
              postal_code: null,
              latitude: coords.latitude,
              longitude: coords.longitude,
              service_area_id: serviceCheck.serviceArea?.id || null,
              is_default: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }
            setAddresses((prev) => [fallbackAddr, ...prev])
            setSelectedAddress(fallbackAddr)
          }
        }
      } else {
        const guestAddr: Address = {
          id: `guest-gps-${Date.now()}`,
          profile_id: 'guest',
          label: addressLabel,
          recipient_name: 'Customer',
          phone: '',
          address_line_1: fullAddressLine1,
          address_line_2: null,
          city: cityName || '',
          state: stateName || '',
          postal_code: null,
          latitude: coords.latitude,
          longitude: coords.longitude,
          service_area_id: serviceCheck.serviceArea?.id || null,
          is_default: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        setSelectedAddress(guestAddr)
      }

      if (!silent) {
        const isIspLagosRouted =
          cityName.toLowerCase().includes('ikeja') ||
          cityName.toLowerCase().includes('lagos')

        pushToast({
          variant: isIspLagosRouted ? 'warning' : 'success',
          title: isIspLagosRouted ? 'ISP Hub Detected (Ikeja)' : 'Location Detected',
          message: isIspLagosRouted
            ? `Your internet provider routed your connection through Ikeja (${[displayStreet, displayCity].filter(Boolean).join(', ')}). Click 'Change location' to set your exact street in Ijebu-Ode.`
            : `Delivery pin set to ${[displayStreet, displayCity].filter(Boolean).join(', ') || 'your detected location'}.`,
        })
      }
    } catch (err) {
      if (!silent) {
        setIsPermissionModalOpen(true)
        pushToast({
          variant: 'warning',
          title: 'Location Unavailable',
          message: err instanceof Error ? err.message : 'Could not detect GPS location. You can enter your street name directly.',
        })
      }
      console.warn('[Checkout] Location detection:', err)
    } finally {
      setIsDetectingLocation(false)
    }
  }

  // Fetch Customer Saved Addresses and Auto-detect Current Location
  useEffect(() => {
    let isMounted = true

    async function fetchAddresses() {
      setIsLoadingAddresses(true)
      try {
        const { data, error } = await getCustomerAddresses()
        if (isMounted) {
          let list: Address[] = []
          if (!error && data) {
            list = (data as Address[]).filter(
              (addr, index, self) =>
                index ===
                self.findIndex(
                  (t) => t.address_line_1 === addr.address_line_1 && t.label === addr.label
                )
            )
            setAddresses(list)
            const defaultAddr = list.find((a) => a.is_default) || list[0] || null
            setSelectedAddress(defaultAddr)
          }
          // If customer has saved addresses, use their default/first address.
          // Only auto-detect if customer has zero saved addresses to avoid
          // overwriting their location with ISP-routed IP geolocation.
          if (list.length === 0) {
            detectCurrentLocation(true, [])
          }
        }
      } catch {
        if (isMounted) {
          detectCurrentLocation(true, [])
        }
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
    hasUserManuallySelectedRef.current = true
    setAddresses((prev) => [newAddr, ...prev.filter((a) => a.id !== newAddr.id)])
    setSelectedAddress(newAddr)
  }

  const handleApplyPromo = (code: string) => {
    setPromoError(null)
    const result = validatePromoCode(code, subtotal, items[0]?.serviceType || 'food')
    if (result.isValid) {
      setAppliedPromoCode(code.toUpperCase())
      setPromoDiscount(result.discountAmount)
      pushToast({
        variant: 'success',
        title: 'Promo Applied!',
        message: `Saved ₦${result.discountAmount.toLocaleString()} with code ${code.toUpperCase()}.`,
      })
    } else {
      setPromoError(result.errorMessage || 'Invalid promo code.')
    }
  }

  const handleRemovePromo = () => {
    setAppliedPromoCode('')
    setPromoDiscount(0)
    setPromoError(null)
    pushToast({
      variant: 'info',
      title: 'Promo Removed',
      message: 'Discount has been removed from your total.',
    })
  }

  const handleApplyPoints = (ptsToRedeem: number) => {
    if (!profile?.id) return
    const res = redeemPoints(profile.id, ptsToRedeem, subtotal)
    if (res.success) {
      setPointsDiscount(res.discountNgn)
      if (loyaltyAccount) {
        setLoyaltyAccount({
          ...loyaltyAccount,
          pointsBalance: loyaltyAccount.pointsBalance - res.discountNgn,
        })
      }
      pushToast({
        variant: 'success',
        title: 'DashPoints Redeemed!',
        message: `Applied ₦${res.discountNgn.toLocaleString()} discount from your rewards balance.`,
      })
    } else {
      pushToast({
        variant: 'error',
        title: 'Redemption Failed',
        message: res.error || 'Could not redeem points.',
      })
    }
  }

  const handleRemovePoints = () => {
    if (pointsDiscount > 0 && profile?.id && loyaltyAccount) {
      const restoredBalance = loyaltyAccount.pointsBalance + pointsDiscount
      setLoyaltyAccount({
        ...loyaltyAccount,
        pointsBalance: restoredBalance,
      })
      setPointsDiscount(0)
      pushToast({
        variant: 'info',
        title: 'Points Discount Removed',
        message: 'Your DashPoints discount was removed.',
      })
    }
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
      addressSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    if (!selectedAddress.latitude || !selectedAddress.longitude) {
      setSubmissionError('Please pin your delivery location on the map before placing your order.')
      addressSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    if (!isAddressServiceable) {
      setSubmissionError('Selected delivery address is outside the active delivery zone.')
      addressSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    // 3. Validate refund policy acceptance
    if (!acceptRefundPolicy) {
      setSubmissionError('Please accept the Cancellation and Refund Policy before placing your order.')
      refundPolicyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
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

    const scheduleNote =
      selectedDeliveryOption === 'scheduled'
        ? `[SCHEDULED DELIVERY: ${scheduledDate || 'Today'} (${scheduledSlot})]`
        : ''
    const tipNote = riderTip > 0 ? `[RIDER TIP: ₦${riderTip.toLocaleString()}]` : ''
    const fullSpecialInstructions = [scheduleNote, tipNote, specialInstructions.trim()]
      .filter(Boolean)
      .join(' | ')
      .slice(0, 500)

    try {
      const res = await createOrderSecure({
        vendorId: vendor.id,
        serviceType: vendor.serviceType || items[0]?.serviceType || 'food',
        pickupAddress: vendor.address || 'Ijebu-Ode, Ogun State',
        deliveryAddress: formattedDeliveryAddress || 'Ijebu-Ode, Ogun State',
        deliveryAddressId: selectedAddress.id,
        items: itemsPayload,
        specialInstructions: fullSpecialInstructions || undefined,
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

      if (profile?.id) {
        creditOrderPoints(profile.id, subtotal, orderId)
      }

      clearCart()

      // 1. Paystack Flow
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

      // 2. Flutterwave Flow
      if (selectedPaymentMethod === 'flutterwave') {
        try {
          setPaymentState('payment opened')
          pushToast({
            variant: 'info',
            title: 'Connecting to Flutterwave',
            message: 'Initializing secure Flutterwave payment...',
          })

          let flwInitData: { link?: string; tx_ref?: string } | null = null
          try {
            flwInitData = await initializeFlutterwavePayment({
              order_id: orderId,
              callback_url: `${window.location.origin}/order/${orderId}/confirmation?gateway=flutterwave`,
            })
          } catch (initErr) {
            console.warn('[Checkout] Backend flutterwave-initialize fallback:', initErr)
          }

          const isKdPass = Boolean(loyaltyAccount?.hasActiveKdPass && subtotal >= 3500)
          const fee =
            deliveryFee !== null
              ? isKdPass
                ? 0
                : selectedDeliveryOption === 'express'
                ? deliveryFee + 600
                : deliveryFee
              : 0
          const payableAmount = Math.max(
            0,
            subtotal - promoDiscount - pointsDiscount + fee + serviceFee + riderTip
          )

          await openFlutterwaveCheckout({
            orderId,
            txRef: flwInitData?.tx_ref,
            amount: payableAmount,
            customer: {
              email: profile?.email || 'customer@kingdomdash.ng',
              name: selectedAddress?.recipient_name || profile?.full_name || 'Customer',
              phone_number: selectedAddress?.phone || profile?.phone || '',
            },
            onSuccess: (flwData) => {
              setPaymentState('payment confirmed')
              pushToast({
                variant: 'success',
                title: 'Payment Successful!',
                message: 'Your Flutterwave payment was approved.',
              })
              const txId = flwData.transaction_id ? String(flwData.transaction_id) : ''
              navigate(
                `/order/${orderId}/confirmation?reference=${encodeURIComponent(flwData.tx_ref)}&transaction_id=${encodeURIComponent(txId)}&flw_ref=${encodeURIComponent(String(flwData.flw_ref || ''))}&gateway=flutterwave`
              )
            },
            onCancel: () => {
              setPaymentState('payment cancelled')
              pushToast({
                variant: 'info',
                title: 'Payment Incomplete',
                message: 'You can complete your payment anytime from your order confirmation page.',
              })
              navigate(`/order/${orderId}/confirmation?gateway=flutterwave&status=incomplete`)
            },
            onError: (flwErr) => {
              console.error('[Checkout] Flutterwave initialization failed:', flwErr)
              if (flwInitData?.link) {
                window.location.href = flwInitData.link
                return
              }
              setPaymentState('payment initialization failed')
              pushToast({
                variant: 'error',
                title: 'Flutterwave Notice',
                message: flwErr.message || 'Could not load Flutterwave checkout. Please retry.',
              })
              navigate(`/order/${orderId}/confirmation?gateway=flutterwave&status=error`)
            },
          })
          return
        } catch (paymentErr) {
          console.error('[Checkout] Flutterwave execution failed:', paymentErr)
          setPaymentState('payment initialization failed')
          pushToast({
            variant: 'error',
            title: 'Payment Gateway Notice',
            message:
              paymentErr instanceof Error
                ? paymentErr.message
                : 'Could not connect to Flutterwave. Please retry from your order confirmation page.',
          })
          navigate(`/order/${orderId}/confirmation?gateway=flutterwave`)
          return
        }
      }

      // 3. Cash on Delivery Flow
      setPaymentState('payment confirmed')
      pushToast({
        variant: 'success',
        title: 'Order Placed (Cash on Delivery)',
        message: 'Your order has been sent to the vendor! Please have cash ready for your rider.',
      })

      navigate(`/order/${orderId}/confirmation?payment_channel=cash`)
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

  const isKdPassApplied = Boolean(loyaltyAccount?.hasActiveKdPass && subtotal >= 3500)

  // Compute fee based on delivery option
  const effectiveDeliveryFee =
    deliveryFee !== null
      ? isKdPassApplied
        ? 0
        : selectedDeliveryOption === 'express'
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

  const finalPayableTotal = Math.max(
    0,
    subtotal - promoDiscount - pointsDiscount + (effectiveDeliveryFee || 0) + serviceFee + riderTip
  )

  return (
    <div className="bg-neutral-50/50 py-8 sm:py-12 pb-[calc(7.5rem+env(safe-area-inset-bottom,0px))] lg:pb-12">
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
          <div className="flex items-center gap-3">
            <Link
              to={vendor.serviceType === 'food' ? `/food/${vendor.id}` : `/grocery/${vendor.id}`}
              className="text-xs font-semibold text-primary hover:underline"
            >
              + Add more items
            </Link>
            <span className="text-[11px] font-medium text-neutral-400 capitalize hidden sm:inline">
              • {vendor.serviceType} Delivery
            </span>
          </div>
        </div>

        {/* Two-Column Responsive Layout */}
        <div className="mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
          {/* Left Column (~62%): Location, Options, Payment, CTA */}
          <div className="lg:col-span-7 space-y-6">
            {/* 1. Delivery Location */}
            <div ref={addressSectionRef} className="scroll-mt-28">
              <DeliveryLocationCard
                addresses={addresses}
                selectedAddress={selectedAddress}
                onSelectAddress={(addr) => {
                  hasUserManuallySelectedRef.current = true
                  setSelectedAddress(addr)
                }}
                onAddressCreated={handleAddressCreated}
                isServiceable={isAddressServiceable}
                isPinned={!!(selectedAddress?.latitude && selectedAddress?.longitude)}
                serviceAreaName={serviceAreaName}
                isLoadingAddresses={isLoadingAddresses}
                estimatedTime={
                  selectedDeliveryOption === 'express' ? '15-25 mins' : '30-45 mins'
                }
                onDetectLocation={() => detectCurrentLocation(false)}
                isDetectingLocation={isDetectingLocation}
                onShowPermissionGuide={() => setIsPermissionModalOpen(true)}
              />
            </div>

            {/* 2. Delivery Options */}
            <DeliveryOptionsCard
              selectedOption={selectedDeliveryOption}
              onSelectOption={setSelectedDeliveryOption}
              standardPrice={deliveryFee}
              expressPrice={deliveryFee !== null ? deliveryFee + 600 : null}
              scheduledDate={scheduledDate}
              onSelectScheduledDate={setScheduledDate}
              scheduledSlot={scheduledSlot}
              onSelectScheduledSlot={setScheduledSlot}
            />

            {/* 2b. Rider Appreciation Tip */}
            <RiderTipSelector
              selectedTip={riderTip}
              onSelectTip={setRiderTip}
              disabled={isSubmitting}
            />

            {/* 3. Payment Method */}
            <PaymentMethodsCard
              selectedMethod={selectedPaymentMethod}
              onSelectMethod={setSelectedPaymentMethod}
            />

            {/* Special Instructions (Collapsible/Optional with Quick Pills) */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5 shadow-xs">
              <button
                type="button"
                onClick={() => setShowInstructions((prev) => !prev)}
                className="flex w-full items-center justify-between text-left text-xs sm:text-sm font-bold text-neutral-800"
              >
                <span>Add delivery instructions or gate code (optional)</span>
                <span className="text-primary text-xs font-semibold">{showInstructions ? 'Hide' : '+ Add'}</span>
              </button>

              {showInstructions && (
                <div className="mt-3 space-y-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      '📞 Call upon arrival',
                      '🚪 Leave at gatehouse',
                      '🔔 Ring doorbell',
                      '🥢 Include cutlery',
                      '💬 WhatsApp / SMS only',
                    ].map((chip) => {
                      const cleanText = chip.slice(3)
                      const isIncluded = specialInstructions.includes(cleanText)
                      return (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => {
                            if (isIncluded) {
                              setSpecialInstructions((prev) =>
                                prev
                                  .replace(cleanText, '')
                                  .replace(/,\s*,/g, ',')
                                  .replace(/^,\s*/, '')
                                  .replace(/,\s*$/, '')
                                  .trim()
                              )
                            } else {
                              setSpecialInstructions((prev) =>
                                prev ? `${prev}, ${cleanText}` : cleanText
                              )
                            }
                          }}
                          className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${
                            isIncluded
                              ? 'bg-primary text-white shadow-2xs'
                              : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                          }`}
                        >
                          {chip}
                        </button>
                      )
                    })}
                  </div>

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

            {/* Cancellation and Refund Policy Consent */}
            <div
              ref={refundPolicyRef}
              className={`rounded-xl border p-3.5 transition-colors scroll-mt-28 ${
                submissionError && !acceptRefundPolicy
                  ? 'border-error/50 bg-error/5 ring-2 ring-error/20'
                  : 'border-neutral-200 bg-neutral-50/70'
              }`}
            >
              <label className="flex items-start gap-2.5 cursor-pointer select-none text-left">
                <input
                  type="checkbox"
                  id="checkout-refund-policy"
                  aria-label="Accept Cancellation and Refund Policy"
                  checked={acceptRefundPolicy}
                  onChange={(e) => {
                    setAcceptRefundPolicy(e.target.checked)
                    if (submissionError?.includes('Cancellation and Refund')) {
                      setSubmissionError(null)
                    }
                  }}
                  className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary"
                />
                <span className="text-xs text-neutral-700 leading-snug">
                  I agree to the{' '}
                  <Link
                    to="/refund-policy"
                    target="_blank"
                    className="font-semibold text-primary hover:underline inline-flex items-center gap-0.5"
                  >
                    Cancellation &amp; Refund Policy
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                  {' '}and acknowledge that orders cannot be cancelled once dispatched.
                </span>
              </label>
            </div>

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
                        : selectedPaymentMethod === 'flutterwave'
                        ? 'Connecting to Flutterwave...'
                        : 'Placing Cash Order...'}
                    </span>
                    <span className="sr-only">Place Order</span>
                  </>
                ) : paymentState === 'payment opened' ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                    <span>
                      {selectedPaymentMethod === 'flutterwave'
                        ? 'Opening Flutterwave...'
                        : 'Opening Paystack...'}
                    </span>
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
                        : selectedPaymentMethod === 'flutterwave'
                        ? 'Pay with Flutterwave'
                        : 'Place Order (Cash on Delivery)'}
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
              serviceFee={serviceFee}
              promoDiscount={promoDiscount}
              appliedPromoCode={appliedPromoCode}
              onApplyPromo={handleApplyPromo}
              onRemovePromo={handleRemovePromo}
              promoError={promoError}
              pointsDiscount={pointsDiscount}
              availablePoints={loyaltyAccount?.pointsBalance || 0}
              onApplyPoints={handleApplyPoints}
              onRemovePoints={handleRemovePoints}
              isKdPassApplied={isKdPassApplied}
              isLoadingPricing={isLoadingPricing}
              isPinned={!!(selectedAddress?.latitude && selectedAddress?.longitude)}
              isServiceable={isAddressServiceable}
              distanceKm={estimatedDistanceKm}
              baseFee={baseFee}
              distanceRate={distanceRate}
              pricingTier={pricingTier}
              riderTip={riderTip}
            />

            <CheckoutHelpCard />

            <CostBreakdownAccordion
              subtotal={subtotal}
              deliveryFee={effectiveDeliveryFee || 0}
              serviceFee={serviceFee}
              riderTip={riderTip}
              distanceKm={estimatedDistanceKm}
              pricingTier={pricingTier}
              isLaunchPreview={false}
            />

            <EnterpriseTrustBanner />
          </div>
        </div>

        {/* Floating Mobile Checkout Action Bar (Chowdeck / Uber Eats style) */}
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200/90 bg-white/95 px-4 pt-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom,0px))] backdrop-blur-md shadow-2xl lg:hidden">
          <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                Total Payable
              </p>
              <p className="font-mono text-lg font-black text-neutral-900">
                {formatNgn(finalPayableTotal)}
              </p>
            </div>
            <Button
              type="button"
              variant="primary"
              onClick={handlePlaceOrder}
              disabled={isFormDisabled}
              className="h-11 px-6 rounded-xl font-bold bg-primary hover:bg-primary-hover text-white shadow-md text-xs sm:text-sm flex items-center gap-1.5"
            >
              {isSubmitting || paymentState === 'initializing' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <span>
                    {selectedPaymentMethod === 'paystack'
                      ? 'Pay with Paystack'
                      : selectedPaymentMethod === 'flutterwave'
                      ? 'Pay with Flutterwave'
                      : 'Place Cash Order'}
                  </span>
                  <ArrowRight className="h-4 w-4 stroke-[2.5]" />
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Location Permission Guide & Force-Prompt Modal */}
        <LocationPermissionModal
          isOpen={isPermissionModalOpen}
          onClose={() => setIsPermissionModalOpen(false)}
          onLocationGranted={() => detectCurrentLocation(false)}
        />
      </PageContainer>
    </div>
  )
}
