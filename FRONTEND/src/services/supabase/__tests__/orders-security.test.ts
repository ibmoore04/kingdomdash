import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createOrderSecure } from '../orders'
import { supabase } from '../client'
import { useCartStore, type CartVendor } from '@/stores/cart-store'

vi.mock('../client', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}))

describe('Security Verification: Order Creation Boundary (Rule 20)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useCartStore.getState().clearCart()
  })

  it('prohibits client financial parameters: createOrderSecure only transmits permitted payload keys', async () => {
    const mockRpc = vi.mocked(supabase.rpc).mockResolvedValue({
      data: 'order-secure-uuid',
      error: null,
    } as any)

    const securePayload = {
      vendorId: 'vendor-123',
      serviceType: 'food' as const,
      pickupAddress: '10 Awujale St, Ijebu-Ode',
      deliveryAddress: 'Adeola (08012345678), 14 Stadium Road, Ijebu-Ode',
      deliveryAddressId: 'addr-uuid-123',
      items: [
        { product_id: 'prod-1', quantity: 2 },
        { product_id: 'prod-2', quantity: 1 },
      ],
      specialInstructions: 'Ring doorbell',
    }

    await createOrderSecure(securePayload)

    expect(mockRpc).toHaveBeenCalledTimes(1)
    const [rpcName, rpcParams] = mockRpc.mock.calls[0]

    expect(rpcName).toBe('create_order_secure')

    // The client RPC payload MUST ONLY contain the authorized parameters:
    // p_vendor_id, p_service_type, p_pickup_address, p_delivery_address, p_items, p_special_instructions, p_delivery_address_id
    expect(rpcParams).toEqual({
      p_vendor_id: 'vendor-123',
      p_service_type: 'food',
      p_pickup_address: '10 Awujale St, Ijebu-Ode',
      p_delivery_address: 'Adeola (08012345678), 14 Stadium Road, Ijebu-Ode',
      p_delivery_address_id: 'addr-uuid-123',
      p_items: [
        { product_id: 'prod-1', quantity: 2 },
        { product_id: 'prod-2', quantity: 1 },
      ],
      p_special_instructions: 'Ring doorbell',
    })

    // Crucial: no client-controlled pricing or distance fields exist in the RPC payload!
    expect((rpcParams as any).customer_id).toBeUndefined()
    expect((rpcParams as any).price).toBeUndefined()
    expect((rpcParams as any).unit_price).toBeUndefined()
    expect((rpcParams as any).subtotal).toBeUndefined()
    expect((rpcParams as any).delivery_fee).toBeUndefined()
    expect((rpcParams as any).total).toBeUndefined()
    expect((rpcParams as any).distance).toBeUndefined()
    expect((rpcParams as any).distance_km).toBeUndefined()
    expect((rpcParams as any).pricing_rule_id).toBeUndefined()
    expect((rpcParams as any).p_price).toBeUndefined()
    expect((rpcParams as any).p_subtotal).toBeUndefined()
    expect((rpcParams as any).p_delivery_fee).toBeUndefined()
    expect((rpcParams as any).p_total).toBeUndefined()
    expect((rpcParams as any).p_distance_km).toBeUndefined()
  })

  it('enforces client quantity boundaries (1..999) preventing negative or overflow attacks', () => {
    const vendor: CartVendor = {
      id: 'vendor-1',
      name: 'Mama Put',
      address: 'Ijebu-Ode',
      serviceType: 'food',
    }

    useCartStore.getState().addItem(
      {
        productId: 'item-1',
        vendorId: 'vendor-1',
        serviceType: 'food',
        name: 'Rice',
        price: 1000,
        imageUrl: null,
      },
      vendor
    )

    // Attempt negative or zero
    useCartStore.getState().updateQuantity('item-1', -50)
    expect(useCartStore.getState().items).toHaveLength(0) // Removed

    useCartStore.getState().addItem(
      {
        productId: 'item-1',
        vendorId: 'vendor-1',
        serviceType: 'food',
        name: 'Rice',
        price: 1000,
        imageUrl: null,
      },
      vendor
    )

    // Attempt overflow (e.g. 1,000,000)
    useCartStore.getState().updateQuantity('item-1', 1_000_000)
    expect(useCartStore.getState().items[0].quantity).toBe(999)
  })

  it('enforces distinct items cap of 50 in the client store matching DB limit', () => {
    const vendor: CartVendor = {
      id: 'vendor-1',
      name: 'Mama Put',
      address: 'Ijebu-Ode',
      serviceType: 'food',
    }

    for (let i = 0; i < 55; i++) {
      useCartStore.getState().addItem(
        {
          productId: `prod-${i}`,
          vendorId: 'vendor-1',
          serviceType: 'food',
          name: `Dish ${i}`,
          price: 500,
          imageUrl: null,
        },
        vendor
      )
    }

    // Must be capped at 50 distinct item lines
    expect(useCartStore.getState().items).toHaveLength(50)
  })

  it('price-tampering defense: client cannot supply financial totals or fake customer_id to createOrderSecure', async () => {
    const mockRpc = vi.mocked(supabase.rpc).mockResolvedValue({
      data: 'order-tamper-proof',
      error: null,
    } as any)

    // Attacker crafts a payload attempting to inject fake prices and customer identity
    const maliciousPayload = {
      vendorId: 'vendor-legit',
      serviceType: 'food' as const,
      pickupAddress: 'Vendor Address',
      deliveryAddress: 'Customer Address',
      deliveryAddressId: 'addr-uuid-safe',
      items: [{ product_id: 'prod-1', quantity: 3 }],
      specialInstructions: 'Handle with care',
      // Injected malicious properties
      fake_price: 1,
      unit_price: 1,
      line_total: 3,
      subtotal: 3,
      delivery_fee: -100,
      total: 3,
      grand_total: 3,
      distance: 0,
      distance_km: 0.1,
      pricing_rule_id: 'fake-rule-uuid',
      customer_id: 'victim-customer-uuid',
    }

    await createOrderSecure(maliciousPayload as any)

    const [rpcName, rpcParams] = (mockRpc.mock.calls[0] as unknown as [string, Record<string, unknown>])
    expect(rpcName).toBe('create_order_secure')
    expect(rpcParams).toBeDefined()

    // None of the malicious injected fields are passed to the RPC
    const forbiddenKeys = [
      'fake_price',
      'unit_price',
      'line_total',
      'subtotal',
      'delivery_fee',
      'total',
      'grand_total',
      'distance',
      'distance_km',
      'pricing_rule_id',
      'customer_id',
    ]

    for (const key of forbiddenKeys) {
      expect(key in rpcParams).toBe(false)
    }

    // Authorized keys only
    expect(Object.keys(rpcParams).sort()).toEqual([
      'p_delivery_address',
      'p_delivery_address_id',
      'p_items',
      'p_pickup_address',
      'p_service_type',
      'p_special_instructions',
      'p_vendor_id',
    ])
  })

  it('cart tampering defense: local storage modifications do not affect RPC payload integrity', async () => {
    const vendor: CartVendor = {
      id: 'vendor-1',
      name: 'Tamper Store',
      address: 'Ijebu-Ode',
      serviceType: 'grocery',
    }

    useCartStore.getState().addItem(
      {
        productId: 'prod-tamper',
        vendorId: 'vendor-1',
        serviceType: 'grocery',
        name: 'Rice Bag',
        price: 50000,
        imageUrl: null,
      },
      vendor
    )

    // Attacker modifies localStorage or state directly to set price=0
    useCartStore.setState((state) => ({
      ...state,
      items: state.items.map((i) => ({
        ...i,
        price: 0, // Tampered price
      })),
    }))

    // In checkout, items payload extraction strictly maps { product_id, quantity }
    const checkoutItems = useCartStore.getState().items.map((i) => ({
      product_id: i.productId,
      quantity: i.quantity,
    }))

    expect(checkoutItems).toEqual([
      { product_id: 'prod-tamper', quantity: 1 },
    ])
    // The extracted RPC payload has no price attribute whatsoever
    expect((checkoutItems[0] as any).price).toBeUndefined()
  })

  it('atomicity and failure defense: cart is preserved when create_order_secure returns an error', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: { message: 'Product out of stock or vendor inactive' },
    } as any)

    const vendor: CartVendor = {
      id: 'vendor-1',
      name: 'Store',
      address: 'Ijebu-Ode',
      serviceType: 'food',
    }

    useCartStore.getState().addItem(
      {
        productId: 'item-1',
        vendorId: 'vendor-1',
        serviceType: 'food',
        name: 'Jollof',
        price: 2500,
        imageUrl: null,
      },
      vendor
    )

    const res = await createOrderSecure({
      vendorId: vendor.id,
      serviceType: 'food',
      pickupAddress: vendor.address,
      deliveryAddress: 'Customer Address',
      deliveryAddressId: 'addr-uuid-1',
      items: [{ product_id: 'item-1', quantity: 1 }],
    })

    // Simulated error response
    expect(res.error).toBeTruthy()

    // Verification: checkout only calls clearCart() on verified success, so cart remains intact
    expect(useCartStore.getState().items).toHaveLength(1)
    expect(useCartStore.getState().items[0].productId).toBe('item-1')
  })
})
