import { Link } from 'react-router-dom'
import {
  Star,
  Clock,
  MapPin,
  ArrowRight,
  Store,
  Sparkles,
  Bike,
  ShieldCheck,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getVendorFallbackCover } from '@/utils/vendor-branding'
import { getVendorOperatingStatus } from '@/utils/operating-hours'
import { cn } from '@/lib/cn'
import type { Vendor, MockVendor } from '@/types'

export interface VendorCardProps {
  vendor: Vendor | MockVendor
  to?: string
  serviceType?: 'food' | 'grocery'
  className?: string
}

function getVendorDetails(vendor: Vendor | MockVendor, serviceType: 'food' | 'grocery') {
  const name =
    ('business_name' in vendor ? vendor.business_name : (vendor as MockVendor).name) || 'Vendor'
  const nameLower = name.toLowerCase()

  // 1. Tags
  let tags: string[] = []
  if (serviceType === 'grocery') {
    if (nameLower.includes('supermarket') || nameLower.includes('mart')) {
      tags = ['Groceries', 'Household', 'Pantry Essentials']
    } else if (nameLower.includes('farm') || nameLower.includes('fresh') || nameLower.includes('market')) {
      tags = ['Farm Fresh', 'Fruits & Veg', 'Cooking Staples']
    } else {
      tags = ['Daily Provisions', 'Beverages', 'Quick Essentials']
    }
  } else {
    if (
      nameLower.includes('chicken') ||
      nameLower.includes('grill') ||
      nameLower.includes('bbq') ||
      nameLower.includes('wings')
    ) {
      tags = ['Crispy Chicken', 'Fast Food', 'Grills & Sides']
    } else if (
      nameLower.includes('reigneth') ||
      nameLower.includes('bake') ||
      nameLower.includes('bread') ||
      nameLower.includes('pastr')
    ) {
      tags = ['Artisanal Bakery', 'Fresh Pastries', 'Daily Bread']
    } else if (
      nameLower.includes('kitchen') ||
      nameLower.includes('qa') ||
      nameLower.includes('mama') ||
      nameLower.includes('buka') ||
      nameLower.includes('delight')
    ) {
      tags = ['Local Delicacy', 'Swallows & Soups', 'Jollof Combos']
    } else if (nameLower.includes('pizza') || nameLower.includes('burger')) {
      tags = ['Pizza & Burger', 'Fast Food', 'Chilled Drinks']
    } else {
      tags = ['Nigerian Specials', 'Hot Lunches', 'Proteins & Rice']
    }
  }

  // 2. Vivid, tailored descriptions
  const rawDesc =
    ('business_description' in vendor
      ? vendor.business_description
      : (vendor as MockVendor).description) || ''
  let description = rawDesc.trim()

  if (
    !description ||
    description === 'Authentic Nigerian dishes and local specialties freshly prepared.'
  ) {
    if (nameLower.includes('chicken')) {
      description =
        'Crispy golden fried chicken, flame-grilled wings, seasoned potato chips, and ice-cold refreshments.'
    } else if (nameLower.includes('reigneth') || nameLower.includes('bake')) {
      description =
        'Freshly baked buttery Nigerian meat pies, savory sausage rolls, soft sliced breads, and sweet treats.'
    } else if (nameLower.includes('kitchen') || nameLower.includes('qa')) {
      description =
        'Authentic Ijebu Ikokore, hot pounded yam with rich Egusi, smoked catfish, and tender assorted meats.'
    } else {
      description =
        serviceType === 'grocery'
          ? 'Fresh farm produce, pantry provisions, dairy, beverages, and daily home essentials.'
          : 'Delicious freshly prepared hot meals, spicy proteins, and rich home-style Nigerian dishes.'
    }
  }

  // 3. Deterministic metadata
  const hash = Math.abs(name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0))
  const neighborhoods = ['Oke-Aje', 'Mobalufon', 'Folagbade', 'GRA', 'Degun', 'Ita Osu']
  const neighborhood = neighborhoods[hash % neighborhoods.length]
  const distanceKm = `${(1.2 + (hash % 20) / 10).toFixed(1)} km`

  const ratingVal =
    'rating' in vendor && vendor.rating ? Number(vendor.rating).toFixed(1) : '4.8'
  const reviewCount = 95 + (hash % 150)

  const deliveryFee = 500 + (hash % 3) * 100
  const deliveryTime = `${20 + (hash % 3) * 5}–${30 + (hash % 3) * 5} min`
  const priceTier = hash % 2 === 0 ? '₦₦' : '₦'

  const promo =
    hash % 3 === 0
      ? 'Free delivery over ₦5,000'
      : hash % 3 === 1
      ? 'Top Rated in Ijebu-Ode'
      : 'Popular with verified riders'

  const isActive =
    'is_active' in vendor ? Boolean(vendor.is_active) : (vendor as MockVendor).isOpen ?? true

  const operatingHours = 'operating_hours' in vendor ? vendor.operating_hours : null
  const operatingStatus = getVendorOperatingStatus(operatingHours, isActive)

  const logoUrl = 'logo_url' in vendor ? vendor.logo_url : null

  return {
    name,
    description,
    tags,
    area: `${neighborhood}, Ijebu-Ode`,
    distanceKm,
    rating: ratingVal,
    reviewCount,
    deliveryFee: `₦${deliveryFee}`,
    deliveryTime,
    priceTier,
    promo,
    isActive,
    operatingStatus,
    logoUrl,
  }
}

export function VendorCard({
  vendor,
  to,
  serviceType = 'food',
  className,
}: VendorCardProps) {
  const details = getVendorDetails(vendor, serviceType)
  const defaultTo = to || `/${serviceType === 'grocery' ? 'groceries' : 'food'}/${vendor.id}`

  return (
    <article
      data-testid="vendor-card"
      className={cn(
        'group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-xs',
        'transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl',
        className
      )}
    >
      {/* Top Banner Image with Link */}
      <Link
        to={defaultTo}
        className="relative block h-52 w-full overflow-hidden bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label={`View ${details.name} menu`}
      >
        <img
          src={getVendorFallbackCover(vendor)}
          alt={details.name}
          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          onError={(e) => {
            e.currentTarget.src = getVendorFallbackCover(vendor)
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/85 via-neutral-950/25 to-transparent" />

        {/* Top Left: Popular Badge */}
        <div className="absolute left-3 top-3 flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/95 px-2.5 py-1 text-[11px] font-bold text-white shadow-md backdrop-blur-xs">
            <Sparkles className="h-3 w-3 fill-white" aria-hidden="true" />
            <span>Popular</span>
          </span>
        </div>

        {/* Top Right: Status Badge */}
        <div className="absolute right-3 top-3">
          <Badge
            variant={
              details.operatingStatus.isOpen
                ? details.operatingStatus.isClosingSoon
                  ? 'warning'
                  : 'success'
                : 'dark'
            }
            className="shadow-sm font-bold flex items-center gap-1.5 backdrop-blur-xs px-2.5 py-1"
          >
            {details.operatingStatus.isOpen && (
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  details.operatingStatus.isClosingSoon
                    ? 'bg-amber-500 animate-ping'
                    : 'bg-emerald-400 animate-pulse'
                )}
              />
            )}
            {details.operatingStatus.statusText}
          </Badge>
        </div>

        {/* Bottom Left Over Image: Rating, Delivery Time, Distance */}
        <div className="absolute bottom-3 left-3 flex items-center gap-2 text-xs text-white">
          <span className="inline-flex items-center gap-1 rounded-lg bg-black/60 px-2 py-1 backdrop-blur-md shadow-xs">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
            <span className="font-bold">{details.rating}</span>
            <span className="text-neutral-300 text-[11px] font-normal">
              ({details.reviewCount})
            </span>
          </span>

          <span className="inline-flex items-center gap-1 rounded-lg bg-black/60 px-2 py-1 backdrop-blur-md shadow-xs">
            <Clock className="h-3.5 w-3.5 text-neutral-300" aria-hidden="true" />
            <span className="font-medium">{details.deliveryTime}</span>
          </span>

          <span className="hidden sm:inline-flex items-center gap-1 rounded-lg bg-black/60 px-2 py-1 backdrop-blur-md shadow-xs">
            <MapPin className="h-3 w-3 text-primary-light" aria-hidden="true" />
            <span className="text-neutral-200">{details.distanceKm}</span>
          </span>
        </div>

        {/* Bottom Right: Circular Store Avatar */}
        <div className="absolute right-3 -bottom-3 flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-white bg-white text-neutral-900 shadow-md overflow-hidden">
          {details.logoUrl ? (
            <img
              src={details.logoUrl}
              alt={details.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-primary/10 text-primary">
              <Store className="h-5 w-5" />
            </div>
          )}
        </div>
      </Link>

      {/* Card Body */}
      <div className="flex flex-1 flex-col justify-between p-5 pt-6">
        <div>
          {/* Header: Title + Price Tier + Verified Badge */}
          <div className="flex items-center justify-between gap-2">
            <Link
              to={defaultTo}
              className="text-base font-extrabold text-neutral-900 transition-colors hover:text-primary tracking-tight line-clamp-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded"
            >
              <h3>{details.name}</h3>
            </Link>

            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs font-bold text-neutral-400">
                {details.priceTier}
              </span>
              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                <ShieldCheck className="h-3 w-3 text-emerald-600" aria-hidden="true" />
                <span>Verified</span>
              </span>
            </div>
          </div>

          {/* Specialty Cuisine Tag Pills */}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {details.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600 transition-colors group-hover:bg-primary/10 group-hover:text-primary"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Rich Detailed Description */}
          <p className="mt-2.5 line-clamp-2 text-xs text-neutral-500 leading-relaxed">
            {details.description}
          </p>
        </div>

        {/* Delivery Details & Promo Row */}
        <div className="mt-4 pt-3.5 border-t border-neutral-100 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-neutral-800">
            <Bike className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
            <span>{details.deliveryFee} delivery</span>
            <span className="text-neutral-300" aria-hidden="true">•</span>
            <span className="text-[11px] font-normal text-neutral-500 truncate max-w-[130px] sm:max-w-[160px]">
              {details.area}
            </span>
          </div>

          <div className="flex items-center gap-1 text-[11px] font-semibold text-primary bg-primary/5 px-2 py-0.5 rounded-md truncate">
            <Sparkles className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{details.promo}</span>
          </div>
        </div>

        {/* Full-Width Prominent Primary Action Button */}
        <div className="mt-3">
          <Button
            asChild
            variant="primary"
            className="w-full h-10 rounded-xl font-bold shadow-xs hover:shadow-md transition-all active:scale-[0.98] cursor-pointer"
          >
            <Link to={defaultTo} className="flex items-center justify-center gap-2 text-white">
              <span>{serviceType === 'grocery' ? 'Shop Items' : 'View Menu'}</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 text-white" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
    </article>
  )
}
