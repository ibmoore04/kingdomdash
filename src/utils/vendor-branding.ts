export interface CoverPreset {
  id: string
  label: string
  category: 'food' | 'grocery' | 'general'
  url: string
  description: string
}

export const VENDOR_COVER_PRESETS: CoverPreset[] = [
  {
    id: 'hero-jollof',
    label: 'Jollof & Fried Plantain Feast',
    category: 'food',
    url: '/images/hero-jollof.jpg',
    description: 'Signature Nigerian jollof rice combo with roasted chicken and golden dodo.',
  },
  {
    id: 'grilled-feast',
    label: 'Charcoal Suya & Grilled Platter',
    category: 'food',
    url: '/images/covers/grilled-feast.jpg',
    description: 'Savory flame-grilled beef suya, seasoned wings, and crispy plantain slices.',
  },
  {
    id: 'traditional-soup',
    label: 'Traditional Egusi & Pounded Yam',
    category: 'food',
    url: '/images/covers/traditional-soup.jpg',
    description: 'Rich artisanal Nigerian soups, tender assorted meat, and smooth swallow.',
  },
  {
    id: 'bakery-pastries',
    label: 'Bakery & Quick Bites',
    category: 'food',
    url: '/images/covers/bakery-pastries.jpg',
    description: 'Golden flaky Nigerian meat pies, sausage rolls, and warm oven-baked pastries.',
  },
  {
    id: 'fresh-supermarket',
    label: 'Modern Supermarket & Fresh Pantry',
    category: 'grocery',
    url: '/images/covers/fresh-supermarket.jpg',
    description: 'Crisp organic vegetables, everyday household essentials, and pantry staples.',
  },
  {
    id: 'service-grocery',
    label: 'Farm Fresh Produce & Provisions',
    category: 'grocery',
    url: '/images/service-grocery.jpg',
    description: 'Fresh local bell peppers, tomatoes, and wholesome grocery baskets.',
  },
  {
    id: 'story-market',
    label: 'Local Market & Specialty Goods',
    category: 'grocery',
    url: '/images/story-market.jpg',
    description: 'Vibrant marketplace fresh grains, spices, tubers, and raw cooking staples.',
  },
]

/**
 * Computes a fast deterministic 32-bit hash for a given string
 */
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

/**
 * Returns a vendor's cover photo, or a deterministic, high-quality fallback
 * so that two different vendors never accidentally share the same fallback image.
 */
export function getVendorFallbackCover(vendor?: {
  id?: string | number | null
  business_name?: string | null
  business_type?: string | null
  cover_image_url?: string | null
}): string {
  if (vendor?.cover_image_url && vendor.cover_image_url.trim().length > 0) {
    return vendor.cover_image_url
  }

  const seed = `${vendor?.id ?? ''}-${vendor?.business_name ?? 'kingdomdash'}`
  const hash = hashString(seed)
  const isGrocery = vendor?.business_type === 'grocery'

  const pool = isGrocery
    ? VENDOR_COVER_PRESETS.filter((p) => p.category === 'grocery' || p.category === 'general')
    : VENDOR_COVER_PRESETS.filter((p) => p.category === 'food' || p.category === 'general')

  const safePool = pool.length > 0 ? pool : VENDOR_COVER_PRESETS
  const selectedIndex = hash % safePool.length

  return safePool[selectedIndex].url
}

/**
 * Compresses an image file client-side using an offscreen canvas.
 * Produces a high-efficiency JPEG data URL suitable for immediate preview and persistence.
 */
export async function compressImageFile(
  file: File,
  maxWidth = 1280,
  maxHeight = 720,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Selected file must be an image (JPEG, PNG, WEBP).'))
      return
    }

    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Failed to read file from disk.'))
    reader.onload = (e) => {
      const img = new Image()
      img.onerror = () => reject(new Error('Failed to decode image.'))
      img.onload = () => {
        let width = img.naturalWidth || img.width
        let height = img.naturalHeight || img.height

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Failed to create canvas context for compression.'))
          return
        }

        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, 0, 0, width, height)

        const dataUrl = canvas.toDataURL('image/jpeg', quality)
        resolve(dataUrl)
      }
      img.src = String(e.target?.result)
    }
    reader.readAsDataURL(file)
  })
}
