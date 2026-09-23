import { supabase } from './client'
import { appConfig } from '@/config/app.config'

// Scaffold compatibility cast
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

// ============================================================
// Types
// ============================================================
export interface PlatformSettings {
  commissionPercent: number
  baseDeliveryFee: number
  perKmRate: number
  serviceFeeNgn: number
  maxDeliveryRadiusKm: number
  maintenanceMode: boolean
  autoDispatchRiders: boolean
  surgePricingEnabled: boolean
  supportEmail: string
  emergencyHotline: string
}

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  commissionPercent: 7.5,
  baseDeliveryFee: 500,
  perKmRate: 120,
  serviceFeeNgn: 150,
  maxDeliveryRadiusKm: 25,
  maintenanceMode: false,
  autoDispatchRiders: true,
  surgePricingEnabled: true,
  supportEmail: appConfig.support.email,
  emergencyHotline: appConfig.support.phoneDisplay,
}

export interface VendorSettings {
  autoAcceptOrders: boolean
  prepTimeMinutes: number
  openTime: string
  closeTime: string
  openWeekends: boolean
  soundAlerts: boolean
  whatsAppAlerts: boolean
  dailySummaryEmail: boolean
  minimumOrderAmount: number
}

export const DEFAULT_VENDOR_SETTINGS: VendorSettings = {
  autoAcceptOrders: true,
  prepTimeMinutes: 25,
  openTime: '08:00',
  closeTime: '21:00',
  openWeekends: true,
  soundAlerts: true,
  whatsAppAlerts: true,
  dailySummaryEmail: true,
  minimumOrderAmount: 1500,
}

export interface RiderSettings {
  navigationApp: 'google_maps' | 'apple_maps' | 'waze'
  maxDeliveryRadiusKm: number
  autoAcceptNearby: boolean
  orderSoundAlerts: boolean
  vibrationAlerts: boolean
  keepScreenAwake: boolean
  offlineTripCache: boolean
}

export const DEFAULT_RIDER_SETTINGS: RiderSettings = {
  navigationApp: 'google_maps',
  maxDeliveryRadiusKm: 15,
  autoAcceptNearby: false,
  orderSoundAlerts: true,
  vibrationAlerts: true,
  keepScreenAwake: true,
  offlineTripCache: true,
}

export interface CustomerPreferences {
  deliveryNotes: string
  preferredDeliveryType: 'doorstep' | 'pickup_point' | 'building_security'
}

export const DEFAULT_CUSTOMER_PREFERENCES: CustomerPreferences = {
  deliveryNotes: 'Please ring bell and leave with security if unavailable.',
  preferredDeliveryType: 'doorstep',
}

// ============================================================
// 1. Platform Settings Service
// ============================================================
export async function fetchPlatformSettings(): Promise<{
  data: PlatformSettings
  error: string | null
}> {
  try {
    const { data, error } = await db
      .from('platform_settings')
      .select('*')
      .eq('id', 'default')
      .maybeSingle()

    if (error || !data) {
      return { data: DEFAULT_PLATFORM_SETTINGS, error: error?.message || null }
    }

    return {
      data: {
        commissionPercent: Number(data.platform_commission_rate ?? DEFAULT_PLATFORM_SETTINGS.commissionPercent),
        baseDeliveryFee: Number(data.base_delivery_fee_ngn ?? DEFAULT_PLATFORM_SETTINGS.baseDeliveryFee),
        perKmRate: Number(data.per_km_delivery_fee_ngn ?? DEFAULT_PLATFORM_SETTINGS.perKmRate),
        serviceFeeNgn: Number(data.service_fee_ngn ?? DEFAULT_PLATFORM_SETTINGS.serviceFeeNgn),
        maxDeliveryRadiusKm: Number(data.max_delivery_radius_km ?? DEFAULT_PLATFORM_SETTINGS.maxDeliveryRadiusKm),
        maintenanceMode: Boolean(data.maintenance_mode ?? DEFAULT_PLATFORM_SETTINGS.maintenanceMode),
        autoDispatchRiders: Boolean(data.auto_dispatch_riders ?? DEFAULT_PLATFORM_SETTINGS.autoDispatchRiders),
        surgePricingEnabled: Boolean(data.surge_pricing_enabled ?? DEFAULT_PLATFORM_SETTINGS.surgePricingEnabled),
        supportEmail: data.support_email || DEFAULT_PLATFORM_SETTINGS.supportEmail,
        emergencyHotline: data.emergency_hotline || DEFAULT_PLATFORM_SETTINGS.emergencyHotline,
      },
      error: null,
    }
  } catch (err: any) {
    return { data: DEFAULT_PLATFORM_SETTINGS, error: err?.message || 'Failed to fetch platform settings' }
  }
}

export async function updatePlatformSettings(
  settings: PlatformSettings
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await db.rpc('update_platform_settings', {
      p_commission_rate: settings.commissionPercent,
      p_base_delivery_fee: settings.baseDeliveryFee,
      p_per_km_fee: settings.perKmRate,
      p_service_fee: settings.serviceFeeNgn,
      p_max_delivery_radius_km: settings.maxDeliveryRadiusKm,
      p_maintenance_mode: settings.maintenanceMode,
      p_auto_dispatch_riders: settings.autoDispatchRiders,
      p_surge_pricing: settings.surgePricingEnabled,
      p_support_email: settings.supportEmail,
      p_emergency_hotline: settings.emergencyHotline,
    })

    if (error) {
      // Fallback direct upsert if RPC is unavailable
      const { error: upsertError } = await db.from('platform_settings').upsert({
        id: 'default',
        platform_commission_rate: settings.commissionPercent,
        base_delivery_fee_ngn: settings.baseDeliveryFee,
        per_km_delivery_fee_ngn: settings.perKmRate,
        service_fee_ngn: settings.serviceFeeNgn,
        max_delivery_radius_km: settings.maxDeliveryRadiusKm,
        maintenance_mode: settings.maintenanceMode,
        auto_dispatch_riders: settings.autoDispatchRiders,
        surge_pricing_enabled: settings.surgePricingEnabled,
        support_email: settings.supportEmail,
        emergency_hotline: settings.emergencyHotline,
        updated_at: new Date().toISOString(),
      })
      if (upsertError) return { success: false, error: upsertError.message }
    }

    return { success: true, error: null }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update platform settings' }
  }
}

// ============================================================
// 2. Expansion Waitlist Service
// ============================================================
export async function submitExpansionWaitlist(
  city: string,
  contact: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await db.rpc('submit_expansion_waitlist', {
      p_city: city,
      p_contact: contact.trim(),
    })

    if (error) {
      // Direct table insert fallback
      const { error: insertError } = await db.from('expansion_waitlist').insert({
        city,
        contact: contact.trim(),
      })
      if (insertError) return { success: false, error: insertError.message }
    }

    return { success: true, error: null }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to join waitlist' }
  }
}

// ============================================================
// 3. Vendor Settings Service
// ============================================================
export async function fetchVendorSettings(
  vendorId: string
): Promise<{ data: VendorSettings; error: string | null }> {
  if (!vendorId) return { data: DEFAULT_VENDOR_SETTINGS, error: null }
  try {
    const { data, error } = await db
      .from('vendor_settings')
      .select('*')
      .eq('vendor_id', vendorId)
      .maybeSingle()

    if (error || !data) {
      return { data: DEFAULT_VENDOR_SETTINGS, error: error?.message || null }
    }

    return {
      data: {
        autoAcceptOrders: Boolean(data.auto_accept_orders),
        prepTimeMinutes: Number(data.prep_time_minutes ?? DEFAULT_VENDOR_SETTINGS.prepTimeMinutes),
        openTime: data.open_time || DEFAULT_VENDOR_SETTINGS.openTime,
        closeTime: data.close_time || DEFAULT_VENDOR_SETTINGS.closeTime,
        openWeekends: Boolean(data.open_weekends),
        soundAlerts: Boolean(data.sound_alerts),
        whatsAppAlerts: Boolean(data.whatsapp_alerts),
        dailySummaryEmail: Boolean(data.daily_summary_email),
        minimumOrderAmount: Number(data.minimum_order_amount ?? DEFAULT_VENDOR_SETTINGS.minimumOrderAmount),
      },
      error: null,
    }
  } catch (err: any) {
    return { data: DEFAULT_VENDOR_SETTINGS, error: err?.message || null }
  }
}

export async function updateVendorSettings(
  vendorId: string,
  updates: Partial<VendorSettings>
): Promise<{ success: boolean; error: string | null }> {
  if (!vendorId) return { success: false, error: 'Vendor ID required' }
  try {
    const payload: Record<string, any> = {
      vendor_id: vendorId,
      updated_at: new Date().toISOString(),
    }
    if (updates.autoAcceptOrders !== undefined) payload.auto_accept_orders = updates.autoAcceptOrders
    if (updates.prepTimeMinutes !== undefined) payload.prep_time_minutes = updates.prepTimeMinutes
    if (updates.openTime !== undefined) payload.open_time = updates.openTime
    if (updates.closeTime !== undefined) payload.close_time = updates.closeTime
    if (updates.openWeekends !== undefined) payload.open_weekends = updates.openWeekends
    if (updates.soundAlerts !== undefined) payload.sound_alerts = updates.soundAlerts
    if (updates.whatsAppAlerts !== undefined) payload.whatsapp_alerts = updates.whatsAppAlerts
    if (updates.dailySummaryEmail !== undefined) payload.daily_summary_email = updates.dailySummaryEmail
    if (updates.minimumOrderAmount !== undefined) payload.minimum_order_amount = updates.minimumOrderAmount

    const { error } = await db.from('vendor_settings').upsert(payload)
    if (error) return { success: false, error: error.message }
    return { success: true, error: null }
  } catch (err: any) {
    return { success: false, error: err?.message || null }
  }
}

// ============================================================
// 4. Rider Settings Service
// ============================================================
export async function fetchRiderSettings(
  riderId: string
): Promise<{ data: RiderSettings; error: string | null }> {
  if (!riderId) return { data: DEFAULT_RIDER_SETTINGS, error: null }
  try {
    const { data, error } = await db
      .from('rider_settings')
      .select('*')
      .eq('rider_id', riderId)
      .maybeSingle()

    if (error || !data) {
      return { data: DEFAULT_RIDER_SETTINGS, error: error?.message || null }
    }

    return {
      data: {
        navigationApp: data.navigation_app || DEFAULT_RIDER_SETTINGS.navigationApp,
        maxDeliveryRadiusKm: Number(data.max_delivery_radius_km ?? DEFAULT_RIDER_SETTINGS.maxDeliveryRadiusKm),
        autoAcceptNearby: Boolean(data.auto_accept_nearby),
        orderSoundAlerts: Boolean(data.order_sound_alerts),
        vibrationAlerts: Boolean(data.vibration_alerts),
        keepScreenAwake: Boolean(data.keep_screen_awake),
        offlineTripCache: Boolean(data.offline_trip_cache),
      },
      error: null,
    }
  } catch (err: any) {
    return { data: DEFAULT_RIDER_SETTINGS, error: err?.message || null }
  }
}

export async function updateRiderSettings(
  riderId: string,
  updates: Partial<RiderSettings>
): Promise<{ success: boolean; error: string | null }> {
  if (!riderId) return { success: false, error: 'Rider ID required' }
  try {
    const payload: Record<string, any> = {
      rider_id: riderId,
      updated_at: new Date().toISOString(),
    }
    if (updates.navigationApp !== undefined) payload.navigation_app = updates.navigationApp
    if (updates.maxDeliveryRadiusKm !== undefined) payload.max_delivery_radius_km = updates.maxDeliveryRadiusKm
    if (updates.autoAcceptNearby !== undefined) payload.auto_accept_nearby = updates.autoAcceptNearby
    if (updates.orderSoundAlerts !== undefined) payload.order_sound_alerts = updates.orderSoundAlerts
    if (updates.vibrationAlerts !== undefined) payload.vibration_alerts = updates.vibrationAlerts
    if (updates.keepScreenAwake !== undefined) payload.keep_screen_awake = updates.keepScreenAwake
    if (updates.offlineTripCache !== undefined) payload.offline_trip_cache = updates.offlineTripCache

    const { error } = await db.from('rider_settings').upsert(payload)
    if (error) return { success: false, error: error.message }
    return { success: true, error: null }
  } catch (err: any) {
    return { success: false, error: err?.message || null }
  }
}

// ============================================================
// 5. Customer Preferences Service
// ============================================================
export async function fetchCustomerPreferences(
  profileId: string
): Promise<{ data: CustomerPreferences; error: string | null }> {
  if (!profileId) return { data: DEFAULT_CUSTOMER_PREFERENCES, error: null }
  try {
    const { data, error } = await db
      .from('customer_preferences')
      .select('*')
      .eq('profile_id', profileId)
      .maybeSingle()

    if (error || !data) {
      return { data: DEFAULT_CUSTOMER_PREFERENCES, error: error?.message || null }
    }

    return {
      data: {
        deliveryNotes: data.delivery_notes || DEFAULT_CUSTOMER_PREFERENCES.deliveryNotes,
        preferredDeliveryType: data.preferred_delivery_type || DEFAULT_CUSTOMER_PREFERENCES.preferredDeliveryType,
      },
      error: null,
    }
  } catch (err: any) {
    return { data: DEFAULT_CUSTOMER_PREFERENCES, error: err?.message || null }
  }
}

export async function updateCustomerPreferences(
  profileId: string,
  updates: Partial<CustomerPreferences>
): Promise<{ success: boolean; error: string | null }> {
  if (!profileId) return { success: false, error: 'Profile ID required' }
  try {
    const payload: Record<string, any> = {
      profile_id: profileId,
      updated_at: new Date().toISOString(),
    }
    if (updates.deliveryNotes !== undefined) payload.delivery_notes = updates.deliveryNotes
    if (updates.preferredDeliveryType !== undefined) payload.preferred_delivery_type = updates.preferredDeliveryType

    const { error } = await db.from('customer_preferences').upsert(payload)
    if (error) return { success: false, error: error.message }
    return { success: true, error: null }
  } catch (err: any) {
    return { success: false, error: err?.message || null }
  }
}
