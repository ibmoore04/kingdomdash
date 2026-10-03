import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  VendorCardSkeleton,
  ProductCardSkeleton,
  OrderTrackingSkeleton,
  OrderCardSkeleton,
} from '../index'

describe('Skeleton Suite Components (Phase 4)', () => {
  it('renders VendorCardSkeleton with correct count', () => {
    render(<VendorCardSkeleton count={3} />)

    const skeletons = screen.getAllByTestId('vendor-card-skeleton')
    expect(skeletons).toHaveLength(3)
  })

  it('renders ProductCardSkeleton with correct count', () => {
    render(<ProductCardSkeleton count={4} />)

    const skeletons = screen.getAllByTestId('product-card-skeleton')
    expect(skeletons).toHaveLength(4)
  })

  it('renders OrderTrackingSkeleton with radar and pin placeholders', () => {
    render(<OrderTrackingSkeleton />)

    expect(screen.getByTestId('order-tracking-skeleton')).toBeInTheDocument()
  })

  it('renders OrderCardSkeleton with correct count and shimmer blocks', () => {
    render(<OrderCardSkeleton count={2} />)

    const skeletons = screen.getAllByTestId('order-card-skeleton')
    expect(skeletons).toHaveLength(2)
    expect(skeletons[0].querySelectorAll('.animate-shimmer').length).toBeGreaterThan(5)
  })
})
