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

// In-memory runtime cache for instant component lookups
const memoryReviews = new Map<string, OrderReview>()

export function setMemoryReview(review: OrderReview) {
  memoryReviews.set(review.orderId, review)
}

export async function submitOrderReview(params: {
  orderId: string
  customerId?: string
  rating: number
  tags: string[]
  comment: string
}): Promise<{ data: OrderReview | null; error: string | null }> {
  const reviewId = `rev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const trimmedComment = params.comment.trim()

  try {
    const { data, error } = await db
      .from('order_reviews')
      .insert({
        id: reviewId,
        order_id: params.orderId,
        customer_id: params.customerId || null,
        rating: params.rating,
        tags: params.tags,
        comment: trimmedComment,
      })
      .select()
      .maybeSingle()

    if (error) {
      console.error('[submitOrderReview] Supabase insert error:', error)
      return { data: null, error: error.message }
    }

    const review: OrderReview = {
      id: data?.id || reviewId,
      orderId: data?.order_id || params.orderId,
      customerId: data?.customer_id || params.customerId,
      rating: data?.rating ?? params.rating,
      tags: data?.tags || params.tags,
      comment: data?.comment || trimmedComment,
      createdAt: data?.created_at || new Date().toISOString(),
    }

    memoryReviews.set(review.orderId, review)

    // DashPoints loyalty bonus (+50 points) is awarded automatically by PostgreSQL
    // server-side trigger (trg_review_loyalty_points) upon insert of order_reviews.

    return { data: review, error: null }
  } catch (err: any) {
    return { data: null, error: err?.message || 'Failed to submit review' }
  }
}

export function getOrderReview(orderId: string): OrderReview | null {
  return memoryReviews.get(orderId) || null
}

export async function fetchOrderReview(orderId: string): Promise<OrderReview | null> {
  const cached = memoryReviews.get(orderId)
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
      memoryReviews.set(review.orderId, review)
      return review
    }
  } catch (err) {
    console.warn('[fetchOrderReview] Supabase select error:', err)
  }
  return null
}

export async function fetchCustomerReviews(customerId: string): Promise<OrderReview[]> {
  if (!customerId) return []
  try {
    const { data, error } = await db
      .from('order_reviews')
      .select('*')
      .eq('customer_id', customerId)

    if (!error && Array.isArray(data)) {
      const reviews = data.map((d: any) => ({
        id: d.id,
        orderId: d.order_id,
        customerId: d.customer_id,
        rating: d.rating,
        tags: d.tags || [],
        comment: d.comment || '',
        createdAt: d.created_at || new Date().toISOString(),
      }))
      reviews.forEach((r) => memoryReviews.set(r.orderId, r))
      return reviews
    }
  } catch (err) {
    console.warn('[fetchCustomerReviews] Supabase select error:', err)
  }
  return []
}
