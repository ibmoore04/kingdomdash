export type AvatarType = 'doll' | 'anime'

export interface AvatarCharacter {
  id: string
  name: string
  title: string
  tagline: string
  type: AvatarType
  avatarUrl: string
  badgeColor: string
  accentBorder: string
  description: string
  recommendedRoles?: Array<'customer' | 'rider' | 'vendor' | 'admin'>
}

export const KINGDOMDASH_AVATAR_ROSTER: AvatarCharacter[] = [
  {
    id: 'royal-doll-prince',
    name: 'Prince Malik',
    title: 'Crown Sovereign',
    tagline: 'Regal 3D Vinyl Royalty',
    type: 'doll',
    avatarUrl: '/avatars/characters/royal-doll-prince.jpg',
    badgeColor: '#E50914',
    accentBorder: 'border-amber-400 ring-amber-400/30',
    description: 'Bespoke 3D vinyl royal prince with a miniature golden crown and ornate crimson tunic.',
    recommendedRoles: ['customer', 'admin'],
  },
  {
    id: 'royal-doll-princess',
    name: 'Princess Tiara',
    title: 'Royal Highness',
    tagline: 'Sparkling 3D Vinyl Princess',
    type: 'doll',
    avatarUrl: '/avatars/characters/royal-doll-princess.jpg',
    badgeColor: '#E50914',
    accentBorder: 'border-amber-400 ring-amber-400/30',
    description: 'Charming 3D collectible vinyl princess crowned with diamonds and royal crimson velvet.',
    recommendedRoles: ['customer', 'admin'],
  },
  {
    id: 'anime-swift-rider',
    name: 'Rider Kaze',
    title: 'Velocity Pilot',
    tagline: 'Urban Dispatch Courier',
    type: 'anime',
    avatarUrl: '/avatars/characters/anime-swift-rider.svg',
    badgeColor: '#E50914',
    accentBorder: 'border-primary ring-primary/30',
    description: 'Swift anime courier equipped with high-tech visor goggles, ready for fast campus deliveries.',
    recommendedRoles: ['rider'],
  },
  {
    id: 'anime-royal-queen',
    name: 'Queen Zara',
    title: 'Kingdom Regent',
    tagline: 'Modern Royal Icon',
    type: 'anime',
    avatarUrl: '/avatars/characters/anime-royal-queen.svg',
    badgeColor: '#E50914',
    accentBorder: 'border-amber-500 ring-amber-500/30',
    description: 'Graceful modern anime sovereign with crimson-gold regal styling and commanding poise.',
    recommendedRoles: ['customer', 'admin'],
  },
  {
    id: 'anime-master-chef',
    name: 'Chef Kenji',
    title: 'Culinary Master',
    tagline: 'Flavor Alchemist',
    type: 'anime',
    avatarUrl: '/avatars/characters/anime-master-chef.svg',
    badgeColor: '#E50914',
    accentBorder: 'border-emerald-500 ring-emerald-500/30',
    description: 'Passionate gourmet chef anime avatar in crisp culinary gear, dedicated to delicious meals.',
    recommendedRoles: ['vendor'],
  },
  {
    id: 'anime-student-foodie',
    name: 'Tobi Tech',
    title: 'Campus Foodie',
    tagline: 'TASUED Campus Explorer',
    type: 'anime',
    avatarUrl: '/avatars/characters/anime-student-foodie.svg',
    badgeColor: '#F59E0B',
    accentBorder: 'border-amber-400 ring-amber-400/30',
    description: 'Lively student with headphones always on the hunt for student-budget snacks and midnight bites.',
    recommendedRoles: ['customer'],
  },
  {
    id: 'anime-cyber-ninja',
    name: 'Ronin Dash',
    title: 'Night Dispatcher',
    tagline: 'Stealth Express Courier',
    type: 'anime',
    avatarUrl: '/avatars/characters/anime-cyber-ninja.svg',
    badgeColor: '#111111',
    accentBorder: 'border-neutral-700 ring-neutral-700/30',
    description: 'Sleek urban anime night rider navigating campus shortcuts with lightning-fast reflexes.',
    recommendedRoles: ['rider'],
  },
  {
    id: 'doll-chibi-knight',
    name: 'Sir Sterling',
    title: 'Palace Sentinel',
    tagline: 'Chibi Armor Guardian',
    type: 'doll',
    avatarUrl: '/avatars/characters/doll-chibi-knight.svg',
    badgeColor: '#B91C1C',
    accentBorder: 'border-red-400 ring-red-400/30',
    description: 'Cute miniature armored knight doll with an obsidian shield and ruby heraldry.',
    recommendedRoles: ['customer', 'admin'],
  },
  {
    id: 'anime-sunshine-baker',
    name: 'Maya Sweets',
    title: 'Artisan Confectioner',
    tagline: 'Golden Pastry Baker',
    type: 'anime',
    avatarUrl: '/avatars/characters/anime-sunshine-baker.svg',
    badgeColor: '#F59E0B',
    accentBorder: 'border-amber-300 ring-amber-300/30',
    description: 'Warm and cheerful anime bakery artisan crafting fresh rolls, pastries, and treats.',
    recommendedRoles: ['vendor'],
  },
  {
    id: 'doll-mecha-courier',
    name: 'Bolt-07',
    title: 'Smart Dispatch Unit',
    tagline: 'Autonomous Chibi Drone',
    type: 'doll',
    avatarUrl: '/avatars/characters/doll-mecha-courier.svg',
    badgeColor: '#E50914',
    accentBorder: 'border-cyan-400 ring-cyan-400/30',
    description: 'Futuristic high-gloss vinyl mecha courier with radar ears and crimson chest lights.',
    recommendedRoles: ['rider'],
  },
  {
    id: 'anime-golden-monarch',
    name: 'Monarch Dara',
    title: 'Grand Sovereign',
    tagline: 'Golden Era Monarch',
    type: 'anime',
    avatarUrl: '/avatars/characters/anime-golden-monarch.svg',
    badgeColor: '#D97706',
    accentBorder: 'border-amber-500 ring-amber-500/30',
    description: 'Charismatic anime monarch draped in royal crimson silk and radiant golden laurel crests.',
    recommendedRoles: ['customer', 'admin'],
  },
  {
    id: 'doll-blossom-princess',
    name: 'Princess Nia',
    title: 'Garden Royal',
    tagline: 'Chibi Blossom Royalty',
    type: 'doll',
    avatarUrl: '/avatars/characters/doll-blossom-princess.svg',
    badgeColor: '#E50914',
    accentBorder: 'border-rose-400 ring-rose-400/30',
    description: 'Sweet chibi royal princess doll surrounded by delicate petal wreaths and gold tiaras.',
    recommendedRoles: ['customer'],
  },
]

/**
 * Fast deterministic FNV-1a hash of a string seed.
 */
function hashString(str: string): number {
  let hash = 2166136261
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash)
}

/**
 * Deterministically retrieves a default avatar character for any user,
 * seeded by their unique ID, name, or role.
 */
export function getDefaultAvatar(
  userId?: string | null,
  name?: string | null,
  role?: string | null
): AvatarCharacter {
  const seed = userId || name || 'kingdomdash-royal-guest'

  // If role is specified, filter matching candidates first
  if (role) {
    const roleRoster = KINGDOMDASH_AVATAR_ROSTER.filter((char) =>
      char.recommendedRoles?.includes(role as any)
    )
    if (roleRoster.length > 0) {
      const roleIndex = hashString(seed) % roleRoster.length
      return roleRoster[roleIndex]
    }
  }

  const index = hashString(seed) % KINGDOMDASH_AVATAR_ROSTER.length
  return KINGDOMDASH_AVATAR_ROSTER[index]
}

/**
 * Resolves a character by ID or avatar URL.
 */
export function getAvatarByUrlOrId(avatarUrlOrId?: string | null): AvatarCharacter | undefined {
  if (!avatarUrlOrId) return undefined
  return KINGDOMDASH_AVATAR_ROSTER.find(
    (c) => c.id === avatarUrlOrId || c.avatarUrl === avatarUrlOrId
  )
}

/**
 * Checks if a given URL is an official KingdomDash generated character avatar.
 */
export function isGeneratedAvatar(avatarUrl?: string | null): boolean {
  if (!avatarUrl) return false
  return (
    avatarUrl.startsWith('/avatars/characters/') ||
    KINGDOMDASH_AVATAR_ROSTER.some((c) => c.id === avatarUrl || c.avatarUrl === avatarUrl)
  )
}
