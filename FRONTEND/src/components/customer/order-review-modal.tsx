import { useState } from 'react'
import { Star, X, CheckCircle2 } from 'lucide-react'
import { submitOrderReview, type OrderReview } from '@/services/supabase/reviews'

export interface OrderReviewModalProps {
  isOpen: boolean
  onClose: () => void
  orderId: string
  orderNumber?: string
  customerId?: string
  onReviewSubmitted: (review: OrderReview) => void
}

const REVIEW_TAGS = [
  '⚡ Fast Delivery',
  '🍲 Hot & Fresh Food',
  '📦 Neat Packaging',
  '🛵 Polite Rider',
  '✅ Accurate Items',
  '📞 Good Communication',
]

const RATING_DESCRIPTIONS: Record<number, string> = {
  1: 'Poor experience',
  2: 'Fair / Needed improvement',
  3: 'Good delivery',
  4: 'Very good experience',
  5: 'Excellent service!',
}

export function OrderReviewModal({
  isOpen,
  onClose,
  orderId,
  orderNumber,
  customerId,
  onReviewSubmitted,
}: OrderReviewModalProps) {
  const [rating, setRating] = useState<number>(5)
  const [hoverRating, setHoverRating] = useState<number>(0)
  const [selectedTags, setSelectedTags] = useState<string[]>(['⚡ Fast Delivery'])
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  if (!isOpen) return null

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (rating < 1) return

    setIsSubmitting(true)
    try {
      const res = await submitOrderReview({
        orderId,
        customerId,
        rating,
        tags: selectedTags,
        comment,
      })

      if (res.data) {
        setSubmitted(true)
        onReviewSubmitted(res.data)
        setTimeout(() => {
          setSubmitted(false)
          onClose()
        }, 1200)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white border border-neutral-200 rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl space-y-6">
        {submitted ? (
          <div className="py-8 text-center space-y-3">
            <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto animate-bounce" />
            <h3 className="text-lg font-bold text-neutral-900">Thank You For Your Feedback!</h3>
            <p className="text-xs text-neutral-500">
              Your rating helps improve merchant standards and rewards our dispatch riders across Ijebu-Ode.
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-start justify-between border-b border-neutral-100 pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                  Order Review
                </span>
                <h3 className="text-base sm:text-lg font-bold text-neutral-900">
                  Rate Your Delivery Experience
                </h3>
                <p className="text-xs text-neutral-500 font-mono mt-0.5">
                  Order #{orderNumber || orderId.slice(0, 8)}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                aria-label="Close review dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Star Selector */}
              <div className="text-center space-y-2">
                <div className="flex items-center justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const activeRating = hoverRating || rating
                    const isFilled = star <= activeRating
                    return (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="p-1 focus:outline-none transform transition-transform hover:scale-110"
                        aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                      >
                        <Star
                          className={`w-8 h-8 ${
                            isFilled
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-neutral-200'
                          } transition-colors`}
                        />
                      </button>
                    )
                  })}
                </div>
                <p className="text-xs font-semibold text-neutral-700 h-4">
                  {RATING_DESCRIPTIONS[hoverRating || rating]}
                </p>
              </div>

              {/* Tag Highlights */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-neutral-700">
                  What went well?
                </label>
                <div className="flex flex-wrap gap-2">
                  {REVIEW_TAGS.map((tag) => {
                    const isSelected = selectedTags.includes(tag)
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                          isSelected
                            ? 'border-primary bg-primary/5 text-primary font-semibold'
                            : 'border-neutral-200 text-neutral-600 hover:border-neutral-300'
                        }`}
                      >
                        {tag}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Comments Textarea */}
              <div className="space-y-1.5">
                <label
                  htmlFor="review-comment"
                  className="block text-xs font-bold text-neutral-700"
                >
                  Feedback or Notes (Optional)
                </label>
                <textarea
                  id="review-comment"
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Share details about meal quality, rider courtesy, or delivery speed..."
                  className="w-full rounded-xl border border-neutral-200 p-3 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:outline-none transition-colors"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl border border-neutral-200 text-xs font-bold text-neutral-700 hover:bg-neutral-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Review'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
