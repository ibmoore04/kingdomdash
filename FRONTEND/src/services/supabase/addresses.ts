import { supabase } from './client'
import type { AddressInsert, AddressUpdate } from '@/types'

export type CreateAddressInput = Omit<AddressInsert, 'id' | 'profile_id' | 'created_at' | 'updated_at'>
export type UpdateAddressInput = Omit<AddressUpdate, 'id' | 'profile_id' | 'created_at' | 'updated_at'>

/**
 * Fetch all saved delivery addresses for the currently authenticated customer.
 * Ordered by default address first, then by creation date.
 */
export async function getCustomerAddresses() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { data: null, error: new Error('User not authenticated') }
  }

  return supabase
    .from('addresses')
    .select('*')
    .eq('profile_id', user.id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })
}

/**
 * Create a new delivery address for the authenticated customer.
 * If marked as default, resets existing default addresses for this user first.
 */
export async function createCustomerAddress(input: CreateAddressInput) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { data: null, error: new Error('User not authenticated') }
  }

  if (input.is_default) {
    // Clear any existing default for this user
    await supabase
      .from('addresses')
      .update({ is_default: false })
      .eq('profile_id', user.id)
      .eq('is_default', true)
  }

  const city = input.city ? input.city.trim() : 'Ijebu-Ode'
  const state = input.state ? input.state.trim() : 'Ogun State'

  const payload: AddressInsert = {
    profile_id: user.id,
    label: input.label.trim(),
    recipient_name: input.recipient_name.trim(),
    phone: input.phone.trim(),
    address_line_1: input.address_line_1.trim(),
    address_line_2: input.address_line_2?.trim() || null,
    city,
    state,
    postal_code: input.postal_code?.trim() || null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    service_area_id: input.service_area_id ?? null,
    is_default: input.is_default ?? false,
  }

  return supabase
    .from('addresses')
    .insert(payload)
    .select()
    .single()
}

/**
 * Update an existing delivery address belonging to the authenticated customer.
 * If setting as default, resets other defaults first.
 */
export async function updateCustomerAddress(addressId: string, input: UpdateAddressInput) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { data: null, error: new Error('User not authenticated') }
  }

  if (input.is_default) {
    await supabase
      .from('addresses')
      .update({ is_default: false })
      .eq('profile_id', user.id)
      .eq('is_default', true)
  }

  const payload: AddressUpdate = {
    label: input.label !== undefined ? input.label.trim() : undefined,
    recipient_name: input.recipient_name !== undefined ? input.recipient_name.trim() : undefined,
    phone: input.phone !== undefined ? input.phone.trim() : undefined,
    address_line_1: input.address_line_1 !== undefined ? input.address_line_1.trim() : undefined,
    address_line_2: input.address_line_2 !== undefined ? (input.address_line_2?.trim() || null) : undefined,
    city: input.city !== undefined ? input.city.trim() : undefined,
    state: input.state !== undefined ? input.state.trim() : undefined,
    postal_code: input.postal_code !== undefined ? (input.postal_code?.trim() || null) : undefined,
    latitude: input.latitude !== undefined ? input.latitude : undefined,
    longitude: input.longitude !== undefined ? input.longitude : undefined,
    service_area_id: input.service_area_id !== undefined ? input.service_area_id : undefined,
    is_default: input.is_default,
  }

  return supabase
    .from('addresses')
    .update(payload)
    .eq('id', addressId)
    .eq('profile_id', user.id)
    .select()
    .single()
}

/**
 * Delete a delivery address belonging to the authenticated customer.
 */
export async function deleteCustomerAddress(addressId: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { data: null, error: new Error('User not authenticated') }
  }

  return supabase
    .from('addresses')
    .delete()
    .eq('id', addressId)
    .eq('profile_id', user.id)
}

/**
 * Set an existing address as the default address for the authenticated customer.
 */
export async function setDefaultAddress(addressId: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { data: null, error: new Error('User not authenticated') }
  }

  // 1. Reset all existing defaults for this customer
  const resetRes = await supabase
    .from('addresses')
    .update({ is_default: false })
    .eq('profile_id', user.id)
    .eq('is_default', true)

  if (resetRes.error) {
    return resetRes
  }

  // 2. Set the target address as default
  return supabase
    .from('addresses')
    .update({ is_default: true })
    .eq('id', addressId)
    .eq('profile_id', user.id)
    .select()
    .single()
}
