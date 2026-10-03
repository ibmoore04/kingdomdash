import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StickyCategoryRail } from '../sticky-category-rail'

describe('StickyCategoryRail', () => {
  it('does not render when categories list has 1 or fewer items', () => {
    const { container: emptyContainer } = render(
      <StickyCategoryRail categories={[]} onSelect={vi.fn()} />
    )
    expect(emptyContainer.firstChild).toBeNull()

    const { container: singleContainer } = render(
      <StickyCategoryRail
        categories={[{ id: 'cat-1', name: 'Soups' }]}
        onSelect={vi.fn()}
      />
    )
    expect(singleContainer.firstChild).toBeNull()
  })

  it('renders categories with badges and active state', () => {
    const mockCategories = [
      { id: 'cat-1', name: 'Soups', count: 5 },
      { id: 'cat-2', name: 'Swallows', count: 3 },
      { id: 'cat-3', name: 'Drinks', count: 12 },
    ]

    render(
      <StickyCategoryRail
        categories={mockCategories}
        activeId="cat-2"
        onSelect={vi.fn()}
      />
    )

    expect(screen.getByText('Soups')).toBeDefined()
    expect(screen.getByText('Swallows')).toBeDefined()
    expect(screen.getByText('Drinks')).toBeDefined()
    expect(screen.getByText('5')).toBeDefined()
    expect(screen.getByText('3')).toBeDefined()
    expect(screen.getByText('12')).toBeDefined()

    const swallowBtn = screen.getByRole('button', { name: /Swallows/i })
    expect(swallowBtn.getAttribute('aria-current')).toBe('true')

    const soupBtn = screen.getByRole('button', { name: /Soups/i })
    expect(soupBtn.getAttribute('aria-current')).toBeNull()
  })

  it('fires onSelect when a category is clicked', () => {
    const onSelect = vi.fn()
    const mockCategories = [
      { id: 'cat-1', name: 'Soups' },
      { id: 'cat-2', name: 'Drinks' },
    ]

    // Mock scrollIntoView
    window.HTMLElement.prototype.scrollIntoView = vi.fn()

    render(
      <StickyCategoryRail
        categories={mockCategories}
        activeId="cat-1"
        onSelect={onSelect}
      />
    )

    const drinksBtn = screen.getByRole('button', { name: /Drinks/i })
    fireEvent.click(drinksBtn)

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith('cat-2')
  })
})
