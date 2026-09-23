import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from './client'
import type { BusinessType, Vendor, VendorUpdate } from '@/types'

export async function getActiveVendors() {
  return supabase
    .from('vendors')
    .select('*')
    .eq('is_active', true)
    .order('business_name', { ascending: true })
}

export async function getVendorById(id: string) {
  return supabase
    .from('vendors')
    .select('*')
    .eq('id', id)
    .single()
}

export async function getVendorsByType(businessType: BusinessType) {
  return supabase
    .from('vendors')
    .select('*')
    .eq('business_type', businessType)
    .eq('is_active', true)
    .order('business_name', { ascending: true })
}

export async function getVendorsByService(serviceType: 'food' | 'grocery') {
  // Query vendors that have an active service in vendor_services
  const { data: serviceRows, error: serviceError } = await supabase
    .from('vendor_services')
    .select('vendor_id')
    .eq('service_type', serviceType)
    .eq('is_active', true)

  if (!serviceError && serviceRows && serviceRows.length > 0) {
    const vendorIds = Array.from(new Set(serviceRows.map((r) => r.vendor_id)))
    return supabase
      .from('vendors')
      .select('*')
      .in('id', vendorIds)
      .eq('is_active', true)
      .order('business_name', { ascending: true })
  }

  // Graceful fallback to legacy business_type mapping if vendor_services is empty/transitioning
  const fallbackType: BusinessType = serviceType === 'grocery' ? 'grocery_store' : 'restaurant'
  return getVendorsByType(fallbackType)
}

export async function getVendorServices(vendorId: string): Promise<('food' | 'grocery')[]> {
  const { data, error } = await supabase
    .from('vendor_services')
    .select('service_type')
    .eq('vendor_id', vendorId)
    .eq('is_active', true)

  if (!error && data && data.length > 0) {
    return data.map((r) => r.service_type as 'food' | 'grocery')
  }

  // Fallback: check vendor's business_type
  const { data: vendor } = await getVendorById(vendorId)
  if (vendor) {
    return [vendor.business_type === 'grocery_store' ? 'grocery' : 'food']
  }
  return ['food']
}

export async function setVendorServices(vendorId: string, services: ('food' | 'grocery')[]) {
  return supabase.rpc('set_vendor_services', {
    p_vendor_id: vendorId,
    p_service_types: services,
  })
}

export async function getVendorByProfileId(profileId: string) {
  return supabase
    .from('vendors')
    .select('*')
    .eq('profile_id', profileId)
    .maybeSingle()
}

export async function updateVendorProfile(
  vendorId: string,
  updates: VendorUpdate
): Promise<{ data: Vendor | null; error: PostgrestError | Error | null }> {
  // Defensive check: normalize operating_hours to valid json object if string
  let normalizedHours = updates.operating_hours
  if (typeof normalizedHours === 'string') {
    try {
      normalizedHours = JSON.parse(normalizedHours)
    } catch {
      normalizedHours = { display: normalizedHours }
    }
  }

  // Defensive check: strip immutable fields to prevent accidental payload rejection
  const safeUpdates: VendorUpdate = {
    phone: updates.phone,
    business_description: updates.business_description,
    business_address: updates.business_address,
    service_area: updates.service_area,
    operating_hours: normalizedHours,
    logo_url: updates.logo_url,
    cover_image_url: updates.cover_image_url,
    ...(updates.business_name !== undefined ? { business_name: updates.business_name } : {}),
    ...(updates.latitude !== undefined ? { latitude: updates.latitude } : {}),
    ...(updates.longitude !== undefined ? { longitude: updates.longitude } : {}),
    ...(updates.service_area_id !== undefined ? { service_area_id: updates.service_area_id } : {}),
  }

  const directResponse = await supabase
    .from('vendors')
    .update(safeUpdates)
    .eq('id', vendorId)
    .select()
    .single()

  if (directResponse.error) {
    // Attempt RPC fallback if direct table update encounters trigger or RLS resistance
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('update_vendor_profile_secure', {
        p_vendor_id: vendorId,
        p_business_name: updates.business_name ?? null,
        p_phone: updates.phone ?? null,
        p_business_address: updates.business_address ?? null,
        p_service_area: updates.service_area ?? null,
        p_business_description: updates.business_description ?? null,
        p_operating_hours: normalizedHours ?? null,
        p_logo_url: updates.logo_url ?? null,
        p_cover_image_url: updates.cover_image_url ?? null,
      })

      if (!rpcError && rpcData) {
        return { data: rpcData, error: null }
      }
    } catch {
      // Return original error if fallback RPC is unavailable
    }
  }

  return directResponse
}
