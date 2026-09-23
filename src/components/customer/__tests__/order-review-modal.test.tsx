import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { OrderReviewModal } from '../order-review-modal'
import * as reviewsService from '@/services/supabase/reviews'

vi.mock('@/services/supabase/reviews', () => ({
  submitOrderReview: vi.fn().mockResolvedValue({
    data: {
      id: 'rev-1',
      orderId: 'ord-1',
      rating: 5,
      tags: ['⚡ Fast Delivery'],
      comment: 'Delicious meal and prompt delivery!',
      createdAt: new Date().toISOString(),
    },
    error: null,
  }),
  getOrderReview: vi.fn().mockReturnValue(null),
}))

describe('OrderReviewModal Component', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(
      <OrderReviewModal
        isOpen={false}
        onClose={vi.fn()}
        orderId="ord-1"
        onReviewSubmitted={vi.fn()}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders rating stars, feedback tags, and submits review', async () => {
    const handleSubmitted = vi.fn()
    const handleClose = vi.fn()

    render(
      <OrderReviewModal
        isOpen={true}
        onClose={handleClose}
        orderId="ord-1"
        orderNumber="ORD-12345"
        onReviewSubmitted={handleSubmitted}
      />
    )

    expect(screen.getByText(/Rate Your Delivery Experience/i)).toBeInTheDocument()
    expect(screen.getByText(/Order #ORD-12345/i)).toBeInTheDocument()

    // Rate 5 stars
    const star5 = screen.getByRole('button', { name: /Rate 5 stars/i })
    fireEvent.click(star5)

    // Fill comment
    const textarea = screen.getByPlaceholderText(/Share details about meal quality/i)
    fireEvent.change(textarea, { target: { value: 'Delicious meal and prompt delivery!' } })

    // Submit
    const submitBtn = screen.getByRole('button', { name: /Submit Review/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(reviewsService.submitOrderReview).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 'ord-1',
          rating: 5,
          comment: 'Delicious meal and prompt delivery!',
        })
      )
      expect(handleSubmitted).toHaveBeenCalled()
    })
  })
})
