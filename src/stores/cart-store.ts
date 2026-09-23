import { create } from 'zustand'
import { supabase } from '@/services/supabase/client'

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
  activeUserId: string | null
  isSyncing: boolean

  // Actions
  addItem: (item: Omit<CartItem, 'quantity'>, vendor: CartVendor) => AddItemResult
  forceAddItem: (item: Omit<CartItem, 'quantity'>, vendor: CartVendor) => void
  updateQuantity: (productId: string, quantity: number) => void
  removeItem: (productId: string) => void
  clearCart: () => void
  setCartOpen: (open: boolean) => void
  setUser: (userId: string | null) => void
  syncFromDatabase: (userId: string) => Promise<void>

  // Selectors
  getItemCount: () => number
  getSubtotal: () => number
}

function isUuid(id: string | null | undefined): boolean {
  if (!id) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}

function getLocalStorage(): Storage | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage
  }
  if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
    return (globalThis as any).localStorage
  }
  return null
}

export function getCartStorageKey(userId: string | null): string {
  return userId ? `kingdomdash_cart_${userId}` : 'kingdomdash_cart_guest'
}

export function loadCartFromStorage(userId: string | null): { items: CartItem[]; vendor: CartVendor | null } {
  try {
    const storage = getLocalStorage()
    if (!storage) return { items: [], vendor: null }
    const key = getCartStorageKey(userId)
    const raw = storage.getItem(key)
    if (!raw) return { items: [], vendor: null }
    const parsed = JSON.parse(raw)
    const data = parsed?.state ? parsed.state : parsed
    return {
      items: Array.isArray(data?.items) ? data.items : [],
      vendor: data?.vendor || null,
    }
  } catch {
    return { items: [], vendor: null }
  }
}

export function saveCartToStorage(userId: string | null, items: CartItem[], vendor: CartVendor | null): void {
  try {
    const storage = getLocalStorage()
    if (!storage) return
    const key = getCartStorageKey(userId)
    storage.setItem(key, JSON.stringify({ items, vendor }))
  } catch {
    // Ignore storage errors or quota limits
  }
}

/**
 * Asynchronously persist cart to Supabase user_carts table
 */
export async function syncCartToDatabase(
  userId: string | null,
  items: CartItem[],
  vendor: CartVendor | null
): Promise<void> {
  if (!userId || !isUuid(userId)) return
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any
    if (items.length === 0) {
      await db.from('user_carts').delete().eq('user_id', userId)
    } else {
      await db.from('user_carts').upsert({
        user_id: userId,
        vendor_id: vendor?.id || null,
        vendor_data: vendor,
        items: items,
        updated_at: new Date().toISOString(),
      })
    }
  } catch (err) {
    console.warn('[CartStore] Failed to sync cart to Supabase:', err)
  }
}

/**
 * Asynchronously fetch cart from Supabase user_carts table
 */
export async function fetchCartFromDatabase(
  userId: string | null
): Promise<{ items: CartItem[]; vendor: CartVendor | null } | null> {
  if (!userId || !isUuid(userId)) return null
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any
    const { data, error } = await db
      .from('user_carts')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (!error && data) {
      return {
        items: Array.isArray(data.items) ? data.items : [],
        vendor: (data.vendor_data as CartVendor) || null,
      }
    }
  } catch (err) {
    console.warn('[CartStore] Failed to fetch cart from Supabase:', err)
  }
  return null
}

export function removeLegacyGlobalCart(): void {
  try {
    const storage = getLocalStorage()
    if (storage?.getItem('kingdomdash_cart_v1')) {
      storage.removeItem('kingdomdash_cart_v1')
    }
  } catch {
    // Ignore
  }
}

export function getInitialUserId(): string | null {
  try {
    const storage = getLocalStorage()
    if (!storage) return null
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i)
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const raw = storage.getItem(key)
        if (raw) {
          const parsed = JSON.parse(raw)
          const userId = parsed?.user?.id || parsed?.currentSession?.user?.id
          if (userId && typeof userId === 'string') return userId
        }
      }
    }
  } catch {}
  return null
}

// Clean up legacy global key safely on module load
removeLegacyGlobalCart()

const initialUserId = getInitialUserId()
const initialData = loadCartFromStorage(initialUserId)

export const useCartStore = create<CartState>((set, get) => ({
  items: initialData.items,
  vendor: initialData.vendor,
  isOpen: false,
  activeUserId: initialUserId,
  isSyncing: false,

  syncFromDatabase: async (userId: string) => {
    if (!userId || !isUuid(userId)) return
    set({ isSyncing: true })
    try {
      const remote = await fetchCartFromDatabase(userId)
      if (remote && remote.items.length > 0) {
        set({
          items: remote.items,
          vendor: remote.vendor,
        })
        saveCartToStorage(userId, remote.items, remote.vendor)
      }
    } finally {
      set({ isSyncing: false })
    }
  },

  setUser: (newUserId: string | null) => {
    const current = get()
    if (current.activeUserId === newUserId) {
      return
    }

    if (newUserId) {
      // 1. Immediately load local store for fast synchronous UI rendering
      const loaded = loadCartFromStorage(newUserId)
      set({
        activeUserId: newUserId,
        items: loaded.items,
        vendor: loaded.vendor,
      })

      // 2. Asynchronously reconcile with Supabase user_carts backend
      if (isUuid(newUserId)) {
        void fetchCartFromDatabase(newUserId).then((remote) => {
          if (remote && remote.items.length > 0) {
            // Remote cart exists — use authoritative remote cart
            set({
              items: remote.items,
              vendor: remote.vendor,
            })
            saveCartToStorage(newUserId, remote.items, remote.vendor)
          } else if (loaded.items.length > 0) {
            // Local cart had items, push up to database
            void syncCartToDatabase(newUserId, loaded.items, loaded.vendor)
          }
        })
      }
    } else {
      // Logging out / switching to guest:
      saveCartToStorage(null, [], null)
      set({
        activeUserId: null,
        items: [],
        vendor: null,
      })
    }
  },

  addItem: (item, vendor) => {
    const state = get()

    // 1. Single-vendor rule check
    if (state.vendor && state.items.length > 0 && state.vendor.id !== vendor.id) {
      return { conflict: true, currentVendorName: state.vendor.name }
    }

    const existingIndex = state.items.findIndex((i) => i.productId === item.productId)

    let newItems: CartItem[]
    const newVendor = state.vendor || vendor

    if (existingIndex > -1) {
      newItems = [...state.items]
      const currentQty = newItems[existingIndex].quantity
      newItems[existingIndex] = {
        ...newItems[existingIndex],
        quantity: Math.min(999, currentQty + 1),
      }
    } else {
      // Check 50 distinct items limit (matches DB create_order_secure guard)
      if (state.items.length >= 50) {
        return { conflict: false }
      }
      newItems = [...state.items, { ...item, quantity: 1 }]
    }

    set({ items: newItems, vendor: newVendor })
    saveCartToStorage(state.activeUserId, newItems, newVendor)
    void syncCartToDatabase(state.activeUserId, newItems, newVendor)
    return { conflict: false }
  },

  forceAddItem: (item, vendor) => {
    const state = get()
    const newItems = [{ ...item, quantity: 1 }]
    set({
      vendor,
      items: newItems,
    })
    saveCartToStorage(state.activeUserId, newItems, vendor)
    void syncCartToDatabase(state.activeUserId, newItems, vendor)
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
    saveCartToStorage(state.activeUserId, updatedItems, state.vendor)
    void syncCartToDatabase(state.activeUserId, updatedItems, state.vendor)
  },

  removeItem: (productId) => {
    const state = get()
    const updatedItems = state.items.filter((i) => i.productId !== productId)
    const newVendor = updatedItems.length === 0 ? null : state.vendor
    set({
      items: updatedItems,
      vendor: newVendor,
    })
    saveCartToStorage(state.activeUserId, updatedItems, newVendor)
    void syncCartToDatabase(state.activeUserId, updatedItems, newVendor)
  },

  clearCart: () => {
    const state = get()
    set({ items: [], vendor: null })
    saveCartToStorage(state.activeUserId, [], null)
    void syncCartToDatabase(state.activeUserId, [], null)
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
}))
