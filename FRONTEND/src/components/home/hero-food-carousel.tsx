import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Flame,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/services/supabase/client'
import { formatNgn } from '@/utils/formatting'
import { cn } from '@/lib/cn'

export interface HeroFoodItem {
  id: string
  name: string
  description: string
  vendorName: string
  vendorId?: string
  price: number
  originalPrice?: number
  badgeText: string
  badgeVariant: 'hot' | 'special' | 'fresh' | 'bestseller'
  imageUrl: string
  glowGradient: string
}

const DEFAULT_HERO_FOOD_ITEMS: HeroFoodItem[] = [
  {
    id: 'jollof-chicken-co-1',
    name: 'Jollof Rice',
    description: 'So sweet',
    vendorName: 'Chicken & Co',
    price: 2500,
    originalPrice: 2950,
    badgeText: "Today's Pick",
    badgeVariant: 'hot',
    imageUrl: '/images/hero-jollof.jpg',
    glowGradient: 'from-primary/25 via-amber-500/10 to-transparent',
  },
  {
    id: 'shawarma-wings-2',
    name: 'Shawarma & BBQ Wings',
    description: 'Double sausage shawarma & 3 peppered wings',
    vendorName: 'Chicken & Co',
    price: 3800,
    originalPrice: 4500,
    badgeText: 'Bestseller',
    badgeVariant: 'bestseller',
    imageUrl: '/images/covers/grilled-feast.jpg',
    glowGradient: 'from-amber-500/25 via-rose-500/10 to-transparent',
  },
  {
    id: 'egusi-soup-3',
    name: 'Pounded Yam & Egusi Feast',
    description: 'Melon egusi soup with tender goat meat & pounded yam',
    vendorName: 'Lord Reigneth Foods',
    price: 3200,
    originalPrice: 3800,
    badgeText: "Chef's Special",
    badgeVariant: 'special',
    imageUrl: '/images/covers/traditional-soup.jpg',
    glowGradient: 'from-emerald-500/25 via-amber-500/10 to-transparent',
  },
  {
    id: 'bakery-pie-4',
    name: 'Crusty Meat Pies & Pastries',
    description: 'Flaky pastry loaded with minced beef & potatoes',
    vendorName: 'Reigneth Bakery & Cafe',
    price: 2200,
    originalPrice: 2600,
    badgeText: 'Fresh Oven',
    badgeVariant: 'fresh',
    imageUrl: '/images/covers/bakery-pastries.jpg',
    glowGradient: 'from-amber-600/25 via-orange-500/10 to-transparent',
  },
]

export const HeroFoodCarousel: React.FC = () => {
  const [items, setItems] = useState<HeroFoodItem[]>(DEFAULT_HERO_FOOD_ITEMS)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Live scan from Supabase database to dynamically incorporate actual vendor menu items
  useEffect(() => {
    let isMounted = true

    async function scanVendorDishes() {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('id, name, description, price, image_url, vendor_id, vendors(id, business_name)')
          .eq('is_available', true)
          .limit(4)

        if (isMounted && !error && data && data.length > 0) {
          const scannedItems: HeroFoodItem[] = data.map((prod, idx) => {
            const fallback = DEFAULT_HERO_FOOD_ITEMS[idx % DEFAULT_HERO_FOOD_ITEMS.length]
            const vendor = (prod as any).vendors
            const vName = vendor?.business_name || fallback.vendorName

            return {
              id: prod.id,
              name: prod.name,
              description: prod.description || fallback.description,
              vendorName: vName,
              vendorId: prod.vendor_id || vendor?.id,
              price: prod.price || fallback.price,
              originalPrice: prod.price ? Math.round(prod.price * 1.18) : fallback.originalPrice,
              badgeText: idx === 0 ? "Today's Pick" : idx % 2 === 0 ? 'Bestseller' : "Chef's Special",
              badgeVariant: idx === 0 ? 'hot' : idx % 2 === 0 ? 'bestseller' : 'special',
              imageUrl: prod.image_url || fallback.imageUrl,
              glowGradient: fallback.glowGradient,
            }
          })

          // Ensure Jollof Rice from Chicken & Co is always the #1 primary opening slide
          const jollofIdx = scannedItems.findIndex((i) => i.name.toLowerCase().includes('jollof'))
          if (jollofIdx > 0) {
            const [jollofItem] = scannedItems.splice(jollofIdx, 1)
            scannedItems.unshift(jollofItem)
          } else if (jollofIdx === -1) {
            scannedItems.unshift(DEFAULT_HERO_FOOD_ITEMS[0])
          }

          setItems(scannedItems.slice(0, 4))
        }
      } catch {
        // Retain default curated lineup gracefully
      }
    }

    scanVendorDishes()
    return () => {
      isMounted = false
    }
  }, [])

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % items.length)
  }, [items.length])

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length)
  }, [items.length])

  // Fast & snappy auto-rotation every 2.8 seconds
  useEffect(() => {
    if (isPaused) return
    timerRef.current = setInterval(nextSlide, 2800)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isPaused, nextSlide])

  const currentItem = items[currentIndex] || items[0]

  return (
    <div
      className="relative w-full max-w-sm md:max-w-none group"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
      role="region"
      aria-label="Live vendor food dishes showcase"
    >
      {/* Subtle Ambient Background Glow matching the active dish */}
      <div
        className={cn(
          'absolute -inset-2 rounded-3xl blur-2xl opacity-40 transition-all duration-500 pointer-events-none bg-gradient-to-tr',
          currentItem.glowGradient
        )}
      />

      {/* Main Image Frame - Identical clean rounded-3xl border and shadow from original design */}
      <div className="relative overflow-hidden rounded-3xl border border-neutral-200/90 bg-neutral-900 shadow-xl aspect-square select-none">
        {items.map((item, index) => {
          const isActive = index === currentIndex
          return (
            <div
              key={item.id}
              className={cn(
                'absolute inset-0 h-full w-full transition-all duration-500 ease-out',
                isActive
                  ? 'opacity-100 scale-105 z-10'
                  : 'opacity-0 scale-100 pointer-events-none z-0'
              )}
            >
              <img
                src={item.imageUrl}
                alt={`${item.name} from ${item.vendorName}`}
                className="h-full w-full object-cover object-center brightness-[0.98]"
                loading={index === 0 ? 'eager' : 'lazy'}
              />
              {/* Soft bottom gradient to improve readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/10 pointer-events-none" />
            </div>
          )
        })}

        {/* Minimal Frosted Capsule Dots in top-right corner - Zero visual clutter */}
        <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 rounded-full bg-black/40 px-2 py-1 backdrop-blur-md border border-white/15">
          {items.map((item, idx) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setCurrentIndex(idx)}
              aria-label={`Show ${item.name}`}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300 cursor-pointer',
                idx === currentIndex
                  ? 'w-4 bg-white shadow-xs'
                  : 'w-1.5 bg-white/40 hover:bg-white/70'
              )}
            />
          ))}
        </div>

        {/* Clean Minimal Controls (Revealed on desktop hover only, never obscuring food on mobile) */}
        <button
          type="button"
          onClick={prevSlide}
          aria-label="Previous food dish"
          className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 z-20 h-8 w-8 items-center justify-center rounded-full bg-black/40 hover:bg-black/70 text-white border border-white/20 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-105 focus-visible:opacity-100"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={nextSlide}
          aria-label="Next food dish"
          className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 z-20 h-8 w-8 items-center justify-center rounded-full bg-black/40 hover:bg-black/70 text-white border border-white/20 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-105 focus-visible:opacity-100"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Floating Animated Card - Matches the beloved original card design, perfectly bounded on mobile */}
      <div className="absolute -bottom-4 right-2 sm:right-4 left-2 sm:left-auto sm:w-72 rounded-2xl border border-neutral-200 bg-white/95 p-3.5 shadow-lg backdrop-blur-md space-y-2 z-30 transition-all duration-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
            <Flame className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
            <span>{currentItem.badgeText}</span>
          </div>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-extrabold text-primary">
            {currentItem.badgeVariant === 'hot' ? 'HOT' : 'POPULAR'}
          </span>
        </div>

        <div>
          <div className="flex items-center justify-between gap-1">
            <h3 className="text-xs sm:text-sm font-bold text-neutral-900 line-clamp-1">
              {currentItem.name}
            </h3>
            <span className="text-[10px] text-neutral-400 shrink-0 font-medium truncate max-w-[100px]">
              {currentItem.vendorName}
            </span>
          </div>
          <p className="text-[11px] text-neutral-500 line-clamp-1">
            {currentItem.description}
          </p>
        </div>

        <div className="flex items-center justify-between pt-0.5">
          <div className="flex items-baseline gap-1.5">
            <span className="text-xs sm:text-sm font-extrabold text-neutral-900">
              {formatNgn(currentItem.price)}
            </span>
            {currentItem.originalPrice && (
              <span className="text-[11px] text-neutral-400 line-through">
                {formatNgn(currentItem.originalPrice)}
              </span>
            )}
          </div>
          <Button
            asChild
            size="sm"
            variant="primary"
            className="h-7 rounded-lg px-2.5 text-xs font-bold text-white bg-primary hover:bg-primary-hover shadow-xs"
          >
            <Link
              to={currentItem.vendorId ? `/food?vendor=${currentItem.vendorId}` : '/food'}
              className="text-white"
            >
              Order Now
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
