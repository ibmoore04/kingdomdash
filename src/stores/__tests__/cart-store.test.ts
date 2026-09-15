import { describe, it, expect, beforeEach } from 'vitest'
import { useCartStore, type CartVendor, type CartItem } from '../cart-store'

const mockVendorA: CartVendor = {
  id: 'vendor-111',
  name: 'Tasty Bites',
  address: '12 Hospital Road, Ijebu-Ode',
  serviceType: 'food',
}

const mockVendorB: CartVendor = {
  id: 'vendor-222',
  name: 'Super Grocers',
  address: '45 Ibadan Road, Ijebu-Ode',
  serviceType: 'grocery',
}

const mockItemA1: Omit<CartItem, 'quantity'> = {
  productId: 'prod-1',
  vendorId: 'vendor-111',
  serviceType: 'food',
  name: 'Jollof Rice Special',
  price: 2500,
  imageUrl: 'https://example.com/jollof.jpg',
}

const mockItemA2: Omit<CartItem, 'quantity'> = {
  productId: 'prod-2',
  vendorId: 'vendor-111',
  serviceType: 'food',
  name: 'Fried Plantain',
  price: 800,
  imageUrl: null,
}

const mockItemB1: Omit<CartItem, 'quantity'> = {
  productId: 'prod-3',
  vendorId: 'vendor-222',
  serviceType: 'grocery',
  name: 'Golden Penny Semovita 2kg',
  price: 3200,
  imageUrl: null,
}

describe('CartStore', () => {
  beforeEach(() => {
    useCartStore.getState().clearCart()
    useCartStore.getState().setCartOpen(false)
  })

  it('initializes with empty state', () => {
    const state = useCartStore.getState()
    expect(state.items).toEqual([])
    expect(state.vendor).toBeNull()
    expect(state.isOpen).toBe(false)
    expect(state.getItemCount()).toBe(0)
    expect(state.getSubtotal()).toBe(0)
  })

  it('adds an item to empty cart and sets vendor', () => {
    const res = useCartStore.getState().addItem(mockItemA1, mockVendorA)
    expect(res).toEqual({ conflict: false })

    const state = useCartStore.getState()
    expect(state.items).toHaveLength(1)
    expect(state.items[0]).toEqual({ ...mockItemA1, quantity: 1 })
    expect(state.vendor).toEqual(mockVendorA)
    expect(state.getItemCount()).toBe(1)
    expect(state.getSubtotal()).toBe(2500)
  })

  it('increments quantity when adding same product again', () => {
    useCartStore.getState().addItem(mockItemA1, mockVendorA)
    const res = useCartStore.getState().addItem(mockItemA1, mockVendorA)
    expect(res).toEqual({ conflict: false })

    const state = useCartStore.getState()
    expect(state.items).toHaveLength(1)
    expect(state.items[0].quantity).toBe(2)
    expect(state.getItemCount()).toBe(2)
    expect(state.getSubtotal()).toBe(5000)
  })

  it('adds multiple different items from same vendor', () => {
    useCartStore.getState().addItem(mockItemA1, mockVendorA)
    useCartStore.getState().addItem(mockItemA2, mockVendorA)

    const state = useCartStore.getState()
    expect(state.items).toHaveLength(2)
    expect(state.getItemCount()).toBe(2)
    expect(state.getSubtotal()).toBe(3300)
  })

  it('detects vendor conflict when adding product from different vendor', () => {
    useCartStore.getState().addItem(mockItemA1, mockVendorA)
    const res = useCartStore.getState().addItem(mockItemB1, mockVendorB)

    expect(res.conflict).toBe(true)
    expect(res.currentVendorName).toBe('Tasty Bites')

    // Cart remains untouched
    const state = useCartStore.getState()
    expect(state.items).toHaveLength(1)
    expect(state.items[0].productId).toBe('prod-1')
    expect(state.vendor?.id).toBe(mockVendorA.id)
  })

  it('forceAddItem overrides existing cart with new vendor and item', () => {
    useCartStore.getState().addItem(mockItemA1, mockVendorA)
    useCartStore.getState().forceAddItem(mockItemB1, mockVendorB)

    const state = useCartStore.getState()
    expect(state.items).toHaveLength(1)
    expect(state.items[0].productId).toBe('prod-3')
    expect(state.items[0].quantity).toBe(1)
    expect(state.vendor).toEqual(mockVendorB)
    expect(state.getSubtotal()).toBe(3200)
  })

  it('clamps item quantity between 1 and 999 on updateQuantity', () => {
    useCartStore.getState().addItem(mockItemA1, mockVendorA)

    useCartStore.getState().updateQuantity('prod-1', 10)
    expect(useCartStore.getState().items[0].quantity).toBe(10)

    useCartStore.getState().updateQuantity('prod-1', 1500)
    expect(useCartStore.getState().items[0].quantity).toBe(999)

    useCartStore.getState().updateQuantity('prod-1', 5.8)
    expect(useCartStore.getState().items[0].quantity).toBe(5)
  })

  it('removes item if updated quantity is 0 or negative', () => {
    useCartStore.getState().addItem(mockItemA1, mockVendorA)
    useCartStore.getState().updateQuantity('prod-1', 0)

    const state = useCartStore.getState()
    expect(state.items).toHaveLength(0)
    expect(state.vendor).toBeNull()
  })

  it('removes specific item by productId and resets vendor if cart becomes empty', () => {
    useCartStore.getState().addItem(mockItemA1, mockVendorA)
    useCartStore.getState().addItem(mockItemA2, mockVendorA)

    useCartStore.getState().removeItem('prod-1')
    let state = useCartStore.getState()
    expect(state.items).toHaveLength(1)
    expect(state.items[0].productId).toBe('prod-2')
    expect(state.vendor).toEqual(mockVendorA)

    useCartStore.getState().removeItem('prod-2')
    state = useCartStore.getState()
    expect(state.items).toHaveLength(0)
    expect(state.vendor).toBeNull()
  })

  it('clearCart resets all items and vendor', () => {
    useCartStore.getState().addItem(mockItemA1, mockVendorA)
    useCartStore.getState().clearCart()

    const state = useCartStore.getState()
    expect(state.items).toEqual([])
    expect(state.vendor).toBeNull()
  })

  it('controls drawer open state', () => {
    expect(useCartStore.getState().isOpen).toBe(false)
    useCartStore.getState().setCartOpen(true)
    expect(useCartStore.getState().isOpen).toBe(true)
    useCartStore.getState().setCartOpen(false)
    expect(useCartStore.getState().isOpen).toBe(false)
  })

  it('enforces maximum 50 distinct items limit', () => {
    for (let i = 1; i <= 50; i++) {
      useCartStore.getState().addItem(
        {
          productId: `prod-bulk-${i}`,
          vendorId: mockVendorA.id,
          serviceType: 'food',
          name: `Item ${i}`,
          price: 100,
          imageUrl: null,
        },
        mockVendorA
      )
    }

    expect(useCartStore.getState().items).toHaveLength(50)

    // Attempt to add 51st distinct item
    const res51 = useCartStore.getState().addItem(
      {
        productId: 'prod-bulk-51',
        vendorId: mockVendorA.id,
        serviceType: 'food',
        name: 'Item 51',
        price: 100,
        imageUrl: null,
      },
      mockVendorA
    )

    expect(res51.conflict).toBe(false)
    expect(useCartStore.getState().items).toHaveLength(50)
  })
})
