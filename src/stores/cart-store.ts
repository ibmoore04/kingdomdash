import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface CartItem {
  productId: string
  vendorId: string
  serviceType: 'food' | 'grocery'
  name: string
  price: number // Display only — authoritative price determined by DB
  quantity: number
  imageUrl: string | null
}

export interface CartVendor {
  id: string
  name: string
  address: string
  serviceType: 'food' | 'grocery'
  latitude?: number | null
  longitude?: number | null
}

export interface AddItemResult {
  conflict: boolean
  currentVendorName?: string
}

export interface CartState {
  items: CartItem[]
  vendor: CartVendor | null
  isOpen: boolean

  // Actions
  addItem: (item: Omit<CartItem, 'quantity'>, vendor: CartVendor) => AddItemResult
  forceAddItem: (item: Omit<CartItem, 'quantity'>, vendor: CartVendor) => void
  updateQuantity: (productId: string, quantity: number) => void
  removeItem: (productId: string) => void
  clearCart: () => void
  setCartOpen: (open: boolean) => void

  // Selectors
  getItemCount: () => number
  getSubtotal: () => number
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      vendor: null,
      isOpen: false,

      addItem: (item, vendor) => {
        const state = get()

        // 1. Single-vendor rule check
        if (state.vendor && state.items.length > 0 && state.vendor.id !== vendor.id) {
          return { conflict: true, currentVendorName: state.vendor.name }
        }

        const existingIndex = state.items.findIndex((i) => i.productId === item.productId)

        if (existingIndex > -1) {
          // Increment quantity up to 999
          const updatedItems = [...state.items]
          const currentQty = updatedItems[existingIndex].quantity
          updatedItems[existingIndex] = {
            ...updatedItems[existingIndex],
            quantity: Math.min(999, currentQty + 1),
          }
          set({ items: updatedItems, vendor: state.vendor || vendor })
          return { conflict: false }
        }

        // Check 50 distinct items limit (matches DB create_order_secure guard)
        if (state.items.length >= 50) {
          return { conflict: false }
        }

        set({
          items: [...state.items, { ...item, quantity: 1 }],
          vendor,
        })
        return { conflict: false }
      },

      forceAddItem: (item, vendor) => {
        set({
          vendor,
          items: [{ ...item, quantity: 1 }],
        })
      },

      updateQuantity: (productId, quantity) => {
        const state = get()
        if (quantity <= 0) {
          get().removeItem(productId)
          return
        }

        const clampedQuantity = Math.min(999, Math.max(1, Math.floor(quantity)))
        const updatedItems = state.items.map((i) =>
          i.productId === productId ? { ...i, quantity: clampedQuantity } : i
        )
        set({ items: updatedItems })
      },

      removeItem: (productId) => {
        const state = get()
        const updatedItems = state.items.filter((i) => i.productId !== productId)
        set({
          items: updatedItems,
          vendor: updatedItems.length === 0 ? null : state.vendor,
        })
      },

      clearCart: () => {
        set({ items: [], vendor: null })
      },

      setCartOpen: (open) => {
        set({ isOpen: open })
      },

      getItemCount: () => {
        return get().items.reduce((total, item) => total + item.quantity, 0)
      },

      getSubtotal: () => {
        return get().items.reduce((total, item) => total + item.price * item.quantity, 0)
      },
    }),
    {
      name: 'kingdomdash_cart_v1',
      partialize: (state) => ({ items: state.items, vendor: state.vendor }),
      storage: createJSONStorage(() => {
        if (typeof window !== 'undefined' && window.localStorage) {
          return window.localStorage
        }
        if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
          return (globalThis as any).localStorage
        }
        return {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        }
      }),
    }
  )
)
