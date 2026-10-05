import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  X,
  Store,
  UtensilsCrossed,
  ShoppingBag,
  Sparkles,
  ArrowRight,
  Clock,
  Star,
  Flame,
  CornerDownLeft,
} from 'lucide-react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { getActiveVendors } from '@/services/supabase/vendors'
import { formatNgn } from '@/utils/formatting'
import { getVendorFallbackCover } from '@/utils/vendor-branding'
import { getVendorOperatingStatus } from '@/utils/operating-hours'
import type { Vendor } from '@/types'

// Quick suggestion search pills
const POPULAR_SEARCH_PILLS = [
  { label: 'Jollof Rice', icon: Flame, query: 'jollof' },
  { label: 'Fried Chicken', icon: Sparkles, query: 'chicken' },
  { label: 'Reigneth Bakery', icon: UtensilsCrossed, query: 'reigneth' },
  { label: 'Shawarma & Grills', icon: Flame, query: 'shawarma' },
  { label: 'Catfish & Soups', icon: UtensilsCrossed, query: 'soup' },
  { label: 'Fresh Groceries', icon: ShoppingBag, query: 'grocery' },
]

// Catalog of standout dishes available on KingdomDash for instant discovery
const CURATED_DISH_CATALOG = [
  {
    id: 'dish-jollof-combo',
    name: 'Party Jollof Rice & Crispy Chicken Combo',
    category: 'Food',
    vendorName: 'QA Kitchen & Lounge',
    vendorId: 'qa-kitchen',
    serviceType: 'food',
    price: 3500,
    imageUrl: '/images/hero-jollof.jpg',
    tags: ['jollof', 'rice', 'chicken', 'lunch', 'dinner'],
  },
  {
    id: 'dish-fried-chicken',
    name: 'Golden Crispy Fried Chicken (2 Pcs)',
    category: 'Food',
    vendorName: 'Crispy Crunch Grill',
    vendorId: 'crispy-crunch',
    serviceType: 'food',
    price: 2800,
    imageUrl: '/images/hero-jollof.jpg',
    tags: ['chicken', 'crispy', 'fast food', 'grill'],
  },
  {
    id: 'dish-meat-pie',
    name: 'Freshly Baked Nigerian Beef Meat Pie',
    category: 'Bakery',
    vendorName: 'Reigneth Bakery & Treats',
    vendorId: 'reigneth-bakery',
    serviceType: 'food',
    price: 900,
    imageUrl: '/images/hero-jollof.jpg',
    tags: ['pie', 'meat pie', 'pastry', 'bakery', 'reigneth', 'bread'],
  },
  {
    id: 'dish-beef-shawarma',
    name: 'Special Double-Sausage Beef Shawarma',
    category: 'Food',
    vendorName: 'Sizzle Shawarma Spot',
    vendorId: 'sizzle-shawarma',
    serviceType: 'food',
    price: 2500,
    imageUrl: '/images/hero-jollof.jpg',
    tags: ['shawarma', 'beef', 'wrap', 'snack', 'fast food'],
  },
  {
    id: 'dish-fresh-eggs',
    name: 'Farm Fresh Large Eggs (Crate of 30)',
    category: 'Groceries',
    vendorName: 'Oke-Aje Fresh Mart',
    vendorId: 'oke-aje-market',
    serviceType: 'grocery',
    price: 4200,
    imageUrl: '/images/service-grocery.jpg',
    tags: ['eggs', 'crate', 'grocery', 'farm', 'cooking'],
  },
  {
    id: 'dish-tuber-yam',
    name: 'Premium Abuja White Yam Tuber',
    category: 'Groceries',
    vendorName: 'Oke-Aje Fresh Mart',
    vendorId: 'oke-aje-market',
    serviceType: 'grocery',
    price: 2600,
    imageUrl: '/images/service-grocery.jpg',
    tags: ['yam', 'tuber', 'staple', 'grocery'],
  },
]

export interface OmniboxSearchModalProps {
  isOpen: boolean
  onClose: () => void
}

export function OmniboxSearchModal({ isOpen, onClose }: OmniboxSearchModalProps) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Fetch vendors once for fast client-side indexing
  useEffect(() => {
    let isMounted = true
    async function loadData() {
      try {
        const { data, error } = await getActiveVendors()
        if (isMounted && !error && data) {
          setVendors(data as Vendor[])
        }
      } catch {
        // Fallback gracefully
      }
    }
    loadData()
    return () => {
      isMounted = false
    }
  }, [])

  // Auto-focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => {
        inputRef.current?.focus()
      }, 50)
    }
  }, [isOpen])

  // Filter vendors based on query
  const matchedVendors = useMemo(() => {
    if (!query.trim()) return vendors.slice(0, 4)
    const q = query.toLowerCase().trim()
    return vendors.filter((v) => {
      const name = (v.business_name || '').toLowerCase()
      const desc = (v.business_description || '').toLowerCase()
      const area = (v.service_area || v.business_address || '').toLowerCase()
      return name.includes(q) || desc.includes(q) || area.includes(q)
    })
  }, [vendors, query])

  // Filter curated dishes based on query
  const matchedDishes = useMemo(() => {
    if (!query.trim()) return CURATED_DISH_CATALOG.slice(0, 4)
    const q = query.toLowerCase().trim()
    return CURATED_DISH_CATALOG.filter((item) => {
      const name = item.name.toLowerCase()
      const vendor = item.vendorName.toLowerCase()
      const tagMatch = item.tags.some((t) => t.includes(q))
      return name.includes(q) || vendor.includes(q) || tagMatch
    })
  }, [query])

  // Flat list for keyboard arrow navigation
  const totalItems = matchedVendors.length + matchedDishes.length

  const handleSelectVendor = (vendor: Vendor) => {
    onClose()
    const path =
      vendor.business_type === 'grocery'
        ? `/groceries/${vendor.id}`
        : `/food/${vendor.id}`
    navigate(path)
  }

  const handleSelectDish = (dish: (typeof CURATED_DISH_CATALOG)[0]) => {
    onClose()
    navigate(
      dish.serviceType === 'grocery'
        ? `/groceries`
        : `/food`
    )
  }

  // Handle keyboard events (Up, Down, Enter, Esc)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % (totalItems || 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + (totalItems || 1)) % (totalItems || 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedIndex < matchedVendors.length) {
        const vendor = matchedVendors[selectedIndex]
        if (vendor) handleSelectVendor(vendor)
      } else {
        const dishIndex = selectedIndex - matchedVendors.length
        const dish = matchedDishes[dishIndex]
        if (dish) handleSelectDish(dish)
      }
    }
  }

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-200" />
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[5vh] sm:pt-[8vh] p-3 sm:p-4 pointer-events-none">
          <DialogPrimitive.Content
            className="pointer-events-auto relative w-full max-w-2xl max-h-[82vh] flex flex-col rounded-3xl border border-neutral-200/90 bg-white shadow-2xl overflow-hidden focus:outline-none focus-visible:outline-none animate-in fade-in zoom-in-95 duration-150"
            onKeyDown={handleKeyDown}
          >
            <DialogPrimitive.Title className="sr-only">Universal Search</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              Search dishes, restaurants, groceries, and services in Ijebu-Ode
            </DialogPrimitive.Description>

            {/* Header Search Input */}
            <div className="relative flex items-center border-b border-neutral-100 px-4 sm:px-6 py-3.5 sm:py-4 bg-neutral-50/50 shrink-0">
              <Search className="h-5 w-5 text-primary shrink-0 mr-3" aria-hidden="true" />
              <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setSelectedIndex(0)
              }}
              placeholder="Search dishes, restaurants, groceries, bakeries..."
              className="flex-1 bg-transparent text-sm sm:text-base font-semibold text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-0 border-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="p-1 rounded-full text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/50 transition-colors mr-2"
                aria-label="Clear search input"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <kbd className="hidden sm:inline-flex items-center gap-1 rounded-lg border border-neutral-300 bg-white px-2 py-0.5 text-[11px] font-mono text-neutral-500 shadow-2xs">
              ESC
            </kbd>
          </div>

          {/* Quick Category & Food Suggestion Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto px-4 sm:px-6 py-2.5 border-b border-neutral-100 bg-white no-scrollbar shrink-0">
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider shrink-0 mr-1">
              Popular:
            </span>
            {POPULAR_SEARCH_PILLS.map((pill) => {
              const Icon = pill.icon
              return (
                <button
                  key={pill.label}
                  type="button"
                  onClick={() => {
                    setQuery(pill.query)
                    setSelectedIndex(0)
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50/80 px-3 py-1 text-xs font-semibold text-neutral-700 hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-all shrink-0 cursor-pointer"
                >
                  <Icon className="h-3 w-3 text-primary" />
                  <span>{pill.label}</span>
                </button>
              )
            })}
          </div>

          {/* Results Container */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4 space-y-6">
            {/* Section 1: Restaurants & Vendors */}
            {matchedVendors.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                    <Store className="h-3.5 w-3.5 text-primary" />
                    <span>Restaurants &amp; Stores ({matchedVendors.length})</span>
                  </h4>
                  <span className="text-[11px] text-neutral-400">Ijebu-Ode</span>
                </div>

                <div className="grid gap-2">
                  {matchedVendors.map((vendor, idx) => {
                    const isSelected = selectedIndex === idx
                    const opStatus = getVendorOperatingStatus(
                      vendor.operating_hours,
                      vendor.is_active
                    )

                    return (
                      <div
                        key={vendor.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleSelectVendor(vendor)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`group flex items-center justify-between p-2.5 sm:p-3 rounded-2xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'border-primary/40 bg-primary/5 shadow-xs'
                            : 'border-neutral-200/70 hover:border-neutral-300 hover:bg-neutral-50/60'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-12 w-12 rounded-xl overflow-hidden bg-neutral-100 shrink-0 border border-neutral-200">
                            <img
                              src={getVendorFallbackCover(vendor)}
                              alt={vendor.business_name}
                              className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                              onError={(e) => {
                                e.currentTarget.src = getVendorFallbackCover(vendor)
                              }}
                            />
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h5 className="text-sm font-bold text-neutral-900 group-hover:text-primary transition-colors truncate">
                                {vendor.business_name}
                              </h5>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  opStatus.isOpen
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-neutral-100 text-neutral-600'
                                }`}
                              >
                                {opStatus.statusText}
                              </span>
                            </div>

                            <p className="text-xs text-neutral-500 truncate mt-0.5">
                              {vendor.business_description ||
                                `${vendor.business_type} • Ijebu-Ode Central`}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 pl-3">
                          <div className="text-right hidden sm:block">
                            <div className="flex items-center justify-end gap-1 text-xs font-bold text-neutral-900">
                              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                              <span>4.8</span>
                            </div>
                            <span className="text-[11px] text-neutral-400 flex items-center gap-1 justify-end">
                              <Clock className="h-3 w-3 text-neutral-400" />
                              <span>25-35 min</span>
                            </span>
                          </div>

                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
                              isSelected
                                ? 'bg-primary text-white'
                                : 'bg-neutral-100 text-neutral-400 group-hover:bg-primary group-hover:text-white'
                            }`}
                          >
                            <ArrowRight className="h-4 w-4" />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Section 2: Popular Dishes & Items */}
            {matchedDishes.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                    <UtensilsCrossed className="h-3.5 w-3.5 text-primary" />
                    <span>Popular Dishes &amp; Items ({matchedDishes.length})</span>
                  </h4>
                  <span className="text-[11px] text-neutral-400">Direct Menu Discovery</span>
                </div>

                <div className="grid gap-2">
                  {matchedDishes.map((dish, idx) => {
                    const globalIdx = matchedVendors.length + idx
                    const isSelected = selectedIndex === globalIdx

                    return (
                      <div
                        key={dish.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleSelectDish(dish)}
                        onMouseEnter={() => setSelectedIndex(globalIdx)}
                        className={`group flex items-center justify-between p-2.5 sm:p-3 rounded-2xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'border-primary/40 bg-primary/5 shadow-xs'
                            : 'border-neutral-200/70 hover:border-neutral-300 hover:bg-neutral-50/60'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-11 w-11 rounded-xl overflow-hidden bg-neutral-100 shrink-0 border border-neutral-200">
                            <img
                              src={dish.imageUrl}
                              alt={dish.name}
                              className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                            />
                          </div>

                          <div className="min-w-0">
                            <h5 className="text-sm font-bold text-neutral-900 group-hover:text-primary transition-colors truncate">
                              {dish.name}
                            </h5>
                            <p className="text-xs text-neutral-500 truncate mt-0.5">
                              Available from <strong className="font-semibold text-neutral-700">{dish.vendorName}</strong>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 pl-3">
                          <span className="text-sm font-extrabold text-neutral-900">
                            {formatNgn(dish.price)}
                          </span>

                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
                              isSelected
                                ? 'bg-primary text-white'
                                : 'bg-neutral-100 text-neutral-400 group-hover:bg-primary group-hover:text-white'
                            }`}
                          >
                            <ArrowRight className="h-4 w-4" />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Empty State */}
            {matchedVendors.length === 0 && matchedDishes.length === 0 && (
              <div className="text-center py-10 space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400">
                  <Search className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-neutral-900">No matches found for &ldquo;{query}&rdquo;</h4>
                  <p className="text-xs text-neutral-500 max-w-sm mx-auto mt-1">
                    Try searching for &ldquo;jollof&rdquo;, &ldquo;chicken&rdquo;, &ldquo;bakery&rdquo;, or explore all food vendors.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    navigate('/food')
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary-hover shadow-xs"
                >
                  <span>Explore All Restaurants</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Footer Guide */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 sm:py-3 border-t border-neutral-100 bg-neutral-50 text-[11px] text-neutral-400 shrink-0">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-neutral-300 bg-white px-1.5 py-0.5 font-mono text-[10px] text-neutral-600">↑</kbd>
                <kbd className="rounded border border-neutral-300 bg-white px-1.5 py-0.5 font-mono text-[10px] text-neutral-600">↓</kbd>
                <span>Navigate</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-neutral-300 bg-white px-1.5 py-0.5 font-mono text-[10px] text-neutral-600">
                  <CornerDownLeft className="h-3 w-3 inline" />
                </kbd>
                <span>Select</span>
              </span>
            </div>
            <span>Powered by KingdomDash</span>
          </div>
        </DialogPrimitive.Content>
      </div>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>
)
}
