import React, { useState } from 'react'
import { Sparkles, Crown } from 'lucide-react'
import { cn } from '@/lib/cn'
import { getDefaultAvatar, getAvatarByUrlOrId, type AvatarCharacter } from '@/constants/avatar-roster'

export type KingdomAvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'

export interface KingdomAvatarProps {
  userId?: string | null
  name?: string | null
  avatarUrl?: string | null
  role?: string | null
  size?: KingdomAvatarSize
  showBadge?: boolean
  showBorder?: boolean
  interactive?: boolean
  className?: string
  alt?: string
  onClick?: () => void
}

const SIZE_MAP: Record<
  KingdomAvatarSize,
  { container: string; img: string; badge: string; icon: string }
> = {
  xs: {
    container: 'h-6 w-6 min-w-6',
    img: 'h-6 w-6',
    badge: 'h-2.5 w-2.5 -top-0.5 -right-0.5',
    icon: 'h-1.5 w-1.5',
  },
  sm: {
    container: 'h-8 w-8 min-w-8',
    img: 'h-8 w-8',
    badge: 'h-3.5 w-3.5 -top-1 -right-1',
    icon: 'h-2 w-2',
  },
  md: {
    container: 'h-10 w-10 min-w-10',
    img: 'h-10 w-10',
    badge: 'h-4 w-4 -top-1 -right-1',
    icon: 'h-2.5 w-2.5',
  },
  lg: {
    container: 'h-14 w-14 min-w-14',
    img: 'h-14 w-14',
    badge: 'h-5 w-5 -top-1.5 -right-1.5',
    icon: 'h-3 w-3',
  },
  xl: {
    container: 'h-18 w-18 min-w-18',
    img: 'h-18 w-18',
    badge: 'h-6 w-6 -top-2 -right-2',
    icon: 'h-3.5 w-3.5',
  },
  '2xl': {
    container: 'h-24 w-24 min-w-24',
    img: 'h-24 w-24',
    badge: 'h-7 w-7 -top-2 -right-2',
    icon: 'h-4 w-4',
  },
}

export const KingdomAvatar: React.FC<KingdomAvatarProps> = ({
  userId,
  name,
  avatarUrl,
  role,
  size = 'md',
  showBadge = false,
  showBorder = true,
  interactive = false,
  className,
  alt,
  onClick,
}) => {
  const [hasError, setHasError] = useState(false)

  // Resolve character or deterministic fallback
  const character: AvatarCharacter =
    getAvatarByUrlOrId(avatarUrl) || getDefaultAvatar(userId, name, role)

  const activeSrc = hasError ? character.avatarUrl : avatarUrl || character.avatarUrl
  const sizeClasses = SIZE_MAP[size] || SIZE_MAP.md
  const displayName = name || character.name

  return (
    <div
      onClick={onClick}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? `Avatar for ${displayName}` : undefined}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-full select-none transition-transform duration-200',
        sizeClasses.container,
        showBorder && 'ring-2 ring-amber-400/30 border border-amber-300/40 shadow-xs',
        interactive &&
          'cursor-pointer hover:scale-105 hover:ring-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        className
      )}
    >
      <div className="overflow-hidden rounded-full h-full w-full bg-neutral-900 flex items-center justify-center">
        <img
          src={activeSrc}
          alt={alt || `${displayName} profile character`}
          onError={() => setHasError(true)}
          className={cn(
            'h-full w-full object-cover transition-opacity duration-300',
            sizeClasses.img
          )}
          loading="lazy"
        />
      </div>

      {showBadge && (
        <span
          className={cn(
            'absolute flex items-center justify-center rounded-full bg-gradient-to-tr from-amber-500 to-amber-300 text-neutral-950 font-bold shadow-md ring-2 ring-white',
            sizeClasses.badge
          )}
          title={character.title}
        >
          {character.type === 'doll' ? (
            <Crown className={sizeClasses.icon} />
          ) : (
            <Sparkles className={sizeClasses.icon} />
          )}
        </span>
      )}
    </div>
  )
}
