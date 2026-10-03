import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProductCustomizationModal } from '../product-customization-modal'
import { useCartStore, type CartVendor } from '@/stores/cart-store'
import type { ProductCardItem } from '../product-card'

const mockVendor: CartVendor = {
  id: 'v-qa-kitchen',
  name: 'KingdomDash QA Kitchen',
  address: '12 Degun Street, Ijebu-Ode',
  serviceType: 'food',
}

const mockProduct: ProductCardItem = {
  id: 'prod-amala',
  name: 'Amala with Egusi & Ewedu',
  description: 'Piping hot amala swallow',
  price: 2500,
  image_url: 'https://example.com/amala.jpg',
  is_available: true,
}

describe('ProductCustomizationModal', () => {
  beforeEach(() => {
    useCartStore.getState().clearCart()
    vi.clearAllMocks()
  })

  it('renders product details and modifier groups when open', () => {
    render(
      <ProductCustomizationModal
        isOpen={true}
        onClose={vi.fn()}
        product={mockProduct}
        vendor={mockVendor}
      />
    )

    expect(screen.getByText(/Customize Amala with Egusi & Ewedu/i)).toBeInTheDocument()
    expect(screen.getByText(/Choice of Protein/i)).toBeInTheDocument()
    expect(screen.getByText(/Extra Sides & Add-ons/i)).toBeInTheDocument()
    expect(screen.getByText(/Special Instructions/i)).toBeInTheDocument()
  })

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <ProductCustomizationModal
        isOpen={false}
        onClose={vi.fn()}
        product={mockProduct}
        vendor={mockVendor}
      />
    )

    expect(container.firstChild).toBeNull()
  })

  it('updates total price dynamically when selecting extra modifier options', () => {
    render(
      <ProductCustomizationModal
        isOpen={true}
        onClose={vi.fn()}
        product={mockProduct}
        vendor={mockVendor}
      />
    )

    // Initially includes base price ₦2,500 (with default ₦0 protein)
    expect(screen.getAllByText('₦2,500').length).toBeGreaterThanOrEqual(1)

    // Select Tender Goat Meat (extra ₦1,000)
    const goatOption = screen.getByText(/Tender Goat Meat/i)
    fireEvent.click(goatOption)

    // Base ₦2,500 + ₦1,000 = ₦3,500
    expect(screen.getByText('₦3,500')).toBeInTheDocument()

    // Select Fried Plantain (Dodo) (extra ₦600)
    const dodoOption = screen.getByText(/Fried Plantain/i)
    fireEvent.click(dodoOption)

    // Base ₦2,500 + ₦1,000 + ₦600 = ₦4,100
    expect(screen.getByText('₦4,100')).toBeInTheDocument()
  })

  it('adds customized item to cart store and calls onClose on submit', () => {
    const handleClose = vi.fn()

    render(
      <ProductCustomizationModal
        isOpen={true}
        onClose={handleClose}
        product={mockProduct}
        vendor={mockVendor}
      />
    )

    // Select Goat Meat
    fireEvent.click(screen.getByText(/Tender Goat Meat/i))

    // Enter special cooking instructions
    const textarea = screen.getByPlaceholderText(/pack stew separately/i)
    fireEvent.change(textarea, { target: { value: 'Pack sauce separately please' } })

    // Click Add to Cart button
    const submitBtn = screen.getByRole('button', { name: /add to cart/i })
    fireEvent.click(submitBtn)

    const cart = useCartStore.getState()
    expect(cart.items).toHaveLength(1)
    expect(cart.items[0].name).toBe('Amala with Egusi & Ewedu')
    expect(cart.items[0].price).toBe(3500) // 2500 + 1000
    expect(cart.items[0].specialInstructions).toBe('Pack sauce separately please')
    expect(cart.items[0].selectedModifiers?.some((m) => m.optionName.includes('Goat Meat'))).toBe(true)
    expect(handleClose).toHaveBeenCalled()
  })

  it('allows customers to select 2 or more choices of protein', () => {
    const handleClose = vi.fn()

    render(
      <ProductCustomizationModal
        isOpen={true}
        onClose={handleClose}
        product={mockProduct}
        vendor={mockVendor}
      />
    )

    // Initially has 1 default protein (Assorted Beef & Shaki at ₦0)
    // Select second protein: Tender Goat Meat (Ogufe) (+₦1,000)
    fireEvent.click(screen.getByText(/Tender Goat Meat/i))
    // Select third protein: Crispy Fried Catfish (+₦1,200)
    fireEvent.click(screen.getByText(/Crispy Fried Catfish/i))

    // Requirement badge should show Selected (3/4)
    expect(screen.getByText(/Selected \(3\/4\)/i)).toBeInTheDocument()

    // Base price ₦2,500 + Goat (₦1,000) + Catfish (₦1,200) = ₦4,700
    expect(screen.getByText('₦4,700')).toBeInTheDocument()

    const submitBtn = screen.getByRole('button', { name: /add to cart/i })
    fireEvent.click(submitBtn)

    const cart = useCartStore.getState()
    expect(cart.items).toHaveLength(1)
    const proteins = cart.items[0].selectedModifiers?.filter((m) => m.groupId === 'protein_choice')
    expect(proteins).toHaveLength(3)
    expect(cart.items[0].price).toBe(4700)
    expect(handleClose).toHaveBeenCalled()
  })
})

