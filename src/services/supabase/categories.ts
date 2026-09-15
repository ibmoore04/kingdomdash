import { supabase } from './client'
import type { CategoryInsert, CategoryUpdate, ServiceType } from '@/types'

export async function getVendorCategories(vendorId: string, serviceType?: ServiceType) {
  let query = supabase
    .from('categories')
    .select('*')
    .eq('vendor_id', vendorId)
    .order('display_order', { ascending: true })
    .order('name', { ascending: true })

  if (serviceType) {
    query = query.eq('service_type', serviceType)
  }

  return query
}

export async function getReferenceCategories(serviceType?: ServiceType) {
  let query = supabase
    .from('reference_categories')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  if (serviceType) {
    query = query.eq('service_type', serviceType)
  }

  return query
}

export async function createCategory(category: CategoryInsert) {
  return supabase
    .from('categories')
    .insert({
      vendor_id: category.vendor_id,
      name: category.name.trim(),
      description: category.description?.trim() || null,
      reference_category_id: category.reference_category_id || null,
      service_type: category.service_type || null,
      display_order: category.display_order ?? 0,
      is_active: category.is_active ?? true,
    })
    .select()
    .single()
}

export async function updateCategory(categoryId: string, updates: CategoryUpdate) {
  // Defensive check: strip immutable vendor_id / id
  const safeUpdates: CategoryUpdate = {
    name: updates.name !== undefined ? updates.name.trim() : undefined,
    description: updates.description !== undefined ? (updates.description?.trim() || null) : undefined,
    reference_category_id: updates.reference_category_id !== undefined ? (updates.reference_category_id || null) : undefined,
    service_type: updates.service_type !== undefined ? (updates.service_type || null) : undefined,
    display_order: updates.display_order,
    is_active: updates.is_active,
  }

  return supabase
    .from('categories')
    .update(safeUpdates)
    .eq('id', categoryId)
    .select()
    .single()
}

export async function deleteCategory(categoryId: string) {
  return supabase
    .from('categories')
    .delete()
    .eq('id', categoryId)
}
