import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  Flame,
  Sparkles,
  ShoppingBag,
  ArrowRight,
  UtensilsCrossed,
  Package,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface PromoSlide {
  id: string
  badgeText: string
  badgeIcon: typeof Flame
  headline: string
  highlightedText: string
  description: string
  primaryCta: { label: string; to: string }
  secondaryCta?: { label: string; to: string }
  gradientClass: string
  glowColor: string
  imageUrl: string
  imageAlt: string
}

const PROMO_SLIDES: PromoSlide[] = [
  {
    id: 'launch-flat-delivery',
    badgeText: 'LAUNCH PROMOTION • IJEBU-ODE',
    badgeIcon: Flame,
    headline: 'Doorstep Delivery.',
    highlightedText: 'Flat ₦500 Across All Zones.',
    description:
      'From Molipa to GRA, Degun, and Central. Order from top dining spots and markets with guaranteed swift delivery.',
    primaryCta: { label: 'Order Food Now', to: '/food' },
    secondaryCta: { label: 'Shop Groceries', to: '/groceries' },
    gradientClass: 'from-[#120a0a] via-[#1a0f0f] to-[#0c0909]',
    glowColor: 'bg-primary/25',
    imageUrl: '/images/hero-jollof.jpg',
    imageAlt: 'Smoky party jollof rice and grilled chicken platter',
  },
  {
    id: 'campus-express',
    badgeText: 'STUDENT & CAMPUS EXPRESS',
    badgeIcon: Sparkles,
    headline: 'Lunch Delivered Swift.',
    highlightedText: 'Direct to TASUED & Hostels.',
    description:
      'Affordable student meal packs, shawarmas, and ice-cold refreshments dispatched on schedule between lectures.',
    primaryCta: { label: 'Explore Quick Meals', to: '/food' },
    secondaryCta: { label: 'Send Parcel', to: '/courier' },
    gradientClass: 'from-[#07130f] via-[#091a14] to-[#06100c]',
    glowColor: 'bg-emerald-500/20',
    imageUrl: '/images/promo-rider.jpg',
    imageAlt: 'KingdomDash express delivery rider on dispatch',
  },
  {
    id: 'fresh-morning-bakery',
    badgeText: 'FRESH OVEN PICKS & MARKET',
    badgeIcon: ShoppingBag,
    headline: 'Warm Bread & Pastries.',
    highlightedText: 'Delivered Fresh from 7:00 AM.',
    description:
      'Buttery meat pies, soft sliced bread from Reigneth Bakery, and farm-fresh market staples right to your kitchen.',
    primaryCta: { label: 'Order Bakery Treats', to: '/food' },
    secondaryCta: { label: 'Personal Shopper', to: '/personal-shopper' },
    gradientClass: 'from-[#170e06] via-[#1c1208] to-[#0d0904]',
    glowColor: 'bg-amber-500/25',
    imageUrl: '/images/service-grocery.jpg',
    imageAlt: 'Fresh groceries, fruits, and bakery items',
  },
]

export function PromoHeroCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % PROMO_SLIDES.length)
  }, [])

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + PROMO_SLIDES.length) % PROMO_SLIDES.length)
  }, [])

  // Auto-play timer
  useEffect(() => {
    if (isPaused) return
    timerRef.current = setInterval(nextSlide, 6500)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isPaused, nextSlide])

  const slide = PROMO_SLIDES[currentIndex]
  const BadgeIcon = slide.badgeIcon

  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-white/10 shadow-2xl transition-all duration-500"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      role="region"
      aria-label="Promotional highlights carousel"
    >
      {/* Background Gradient & Glow */}
      <div
        className={`relative bg-gradient-to-br ${slide.gradientClass} p-6 sm:p-10 lg:p-12 text-white transition-all duration-700`}
      >
        <div
          className={`absolute -top-12 -right-12 h-80 w-80 rounded-full ${slide.glowColor} blur-3xl pointer-events-none transition-all duration-700`}
        />

        <div className="grid items-center gap-8 lg:grid-cols-12 relative z-10">
          {/* Left Column: Promotion Copy & CTAs */}
          <div className="lg:col-span-7 space-y-4 sm:space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-3.5 py-1 text-xs font-bold text-white backdrop-blur-md">
              <BadgeIcon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              <span>{slide.badgeText}</span>
            </div>

            <h3 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.1]">
              {slide.headline}{' '}
              <span className="text-primary block sm:inline">{slide.highlightedText}</span>
            </h3>

            <p className="text-sm sm:text-base text-white/75 leading-relaxed max-w-xl">
              {slide.description}
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                asChild
                size="lg"
                variant="primary"
                className="rounded-xl px-6 py-3 text-xs sm:text-sm font-bold bg-primary hover:bg-primary-hover text-white shadow-lg cursor-pointer"
              >
                <Link to={slide.primaryCta.to} className="flex items-center gap-2 text-white">
                  <UtensilsCrossed className="h-4 w-4" />
                  <span>{slide.primaryCta.label}</span>
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>

              {slide.secondaryCta && (
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="rounded-xl px-5 py-3 text-xs sm:text-sm font-bold border-white/20 bg-white/5 hover:bg-white/10 text-white backdrop-blur-md cursor-pointer"
                >
                  <Link to={slide.secondaryCta.to} className="flex items-center gap-2 text-white">
                    <Package className="h-4 w-4 text-primary" />
                    <span>{slide.secondaryCta.label}</span>
                  </Link>
                </Button>
              )}
            </div>
          </div>

          {/* Right Column: Hero Visual Platter */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative h-56 sm:h-64 lg:h-72 w-full max-w-sm overflow-hidden rounded-2xl border border-white/15 shadow-2xl bg-neutral-900 group">
              <img
                src={slide.imageUrl}
                alt={slide.imageAlt}
                className="h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
                loading="eager"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-white/90">
                <span className="font-bold flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                  <Flame className="h-3.5 w-3.5 text-primary fill-primary" />
                  <span>Verified Doorstep Dispatch</span>
                </span>
                <span className="text-[11px] font-semibold text-white/80 bg-primary/80 px-2 py-0.5 rounded-full">
                  Fast &amp; Insulated
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Carousel Bottom Bar: Dots & Controls */}
        <div className="mt-8 pt-4 border-t border-white/10 flex items-center justify-between">
          {/* Dot Indicators */}
          <div className="flex items-center gap-2">
            {PROMO_SLIDES.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                aria-label={`Go to slide ${idx + 1}`}
                className={`h-2 transition-all rounded-full ${
                  currentIndex === idx
                    ? 'w-8 bg-primary shadow-xs'
                    : 'w-2 bg-white/30 hover:bg-white/60'
                }`}
              />
            ))}
          </div>

          {/* Prev / Next Arrows */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={prevSlide}
              aria-label="Previous promotional slide"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors border border-white/10"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={nextSlide}
              aria-label="Next promotional slide"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors border border-white/10"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
