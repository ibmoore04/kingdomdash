import { supabase } from './client'

// Scaffold compatibility cast
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export interface OrderReview {
  id: string
  orderId: string
  customerId?: string
  rating: number // 1 to 5
  tags: string[]
  comment: string
  createdAt: string
}

const LOCAL_STORAGE_REVIEWS_KEY = 'kingdomdash_order_reviews'

function getLocalReviews(): Record<string, OrderReview> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_REVIEWS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveLocalReview(review: OrderReview) {
  try {
    const existing = getLocalReviews()
    existing[review.orderId] = review
    localStorage.setItem(LOCAL_STORAGE_REVIEWS_KEY, JSON.stringify(existing))
  } catch {
    // Ignore localStorage write failures
  }
}

export async function submitOrderReview(params: {
  orderId: string
  customerId?: string
  rating: number
  tags: string[]
  comment: string
}): Promise<{ data: OrderReview | null; error: string | null }> {
  const reviewId = `rev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const newReview: OrderReview = {
    id: reviewId,
    orderId: params.orderId,
    customerId: params.customerId,
    rating: params.rating,
    tags: params.tags,
    comment: params.comment.trim(),
    createdAt: new Date().toISOString(),
  }

  // Always cache locally so customer immediately sees reviewed status
  saveLocalReview(newReview)

  // Try persisting to database if table exists
  try {
    await db.from('order_reviews').insert({
      id: reviewId,
      order_id: params.orderId,
      customer_id: params.customerId,
      rating: params.rating,
      tags: params.tags,
      comment: params.comment.trim(),
    })
  } catch {
    // Graceful fallback to client persistence
  }

  return { data: newReview, error: null }
}

export function getOrderReview(orderId: string): OrderReview | null {
  const reviews = getLocalReviews()
  return reviews[orderId] || null
}

export async function fetchOrderReview(orderId: string): Promise<OrderReview | null> {
  // First check local cache
  const cached = getOrderReview(orderId)
  if (cached) return cached

  try {
    const { data, error } = await db
      .from('order_reviews')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle()

    if (!error && data) {
      const review: OrderReview = {
        id: data.id,
        orderId: data.order_id,
        customerId: data.customer_id,
        rating: data.rating,
        tags: data.tags || [],
        comment: data.comment || '',
        createdAt: data.created_at || new Date().toISOString(),
      }
      saveLocalReview(review)
      return review
    }
  } catch {
    // Fallback to null
  }
  return null
}
