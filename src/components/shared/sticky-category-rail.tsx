import React, { useRef } from 'react'
import { Utensils } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface CategoryRailItem {
  id: string
  name: string
  count?: number
}

export interface StickyCategoryRailProps {
  categories: CategoryRailItem[]
  activeId?: string
  onSelect: (id: string) => void
  icon?: React.ComponentType<{ className?: string }>
  className?: string
}

export function StickyCategoryRail({
  categories,
  activeId,
  onSelect,
  icon: IconComponent = Utensils,
  className,
}: StickyCategoryRailProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  if (!categories || categories.length <= 1) {
    return null
  }

  const handleSelect = (id: string, e: React.MouseEvent<HTMLButtonElement>) => {
    onSelect(id)
    // Auto-scroll selected button into center of the rail
    e.currentTarget.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    })
  }

  return (
    <nav
      aria-label="Menu categories"
      className={cn(
        'sticky top-14 sm:top-16 z-20 -mx-4 px-4 sm:mx-0 sm:px-0 py-3 bg-white/95 backdrop-blur-md border-b border-neutral-100 shadow-2xs transition-all duration-200',
        className
      )}
    >
      <div
        ref={scrollRef}
        className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth py-0.5"
      >
        {categories.map((cat) => {
          const isActive = activeId === cat.id
          return (
            <button
              key={cat.id}
              type="button"
              onClick={(e) => handleSelect(cat.id, e)}
              className={cn(
                'group flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
                isActive
                  ? 'bg-neutral-900 text-white shadow-sm scale-[1.02]'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200/80 hover:text-neutral-900'
              )}
              aria-current={isActive ? 'true' : undefined}
            >
              <IconComponent
                className={cn(
                  'h-3 w-3 transition-colors',
                  isActive ? 'text-primary' : 'text-neutral-400 group-hover:text-neutral-600'
                )}
                aria-hidden="true"
              />
              <span>{cat.name}</span>
              {typeof cat.count === 'number' && (
                <span
                  className={cn(
                    'ml-0.5 rounded-full px-1.5 py-0.2 text-[10px] font-semibold',
                    isActive ? 'bg-neutral-800 text-neutral-200' : 'bg-white/80 text-neutral-500'
                  )}
                >
                  {cat.count}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
