import { supabase } from './client'
import type { ProductInsert, ProductUpdate } from '@/types'

export async function getProductsByVendor(vendorId: string) {
  return supabase
    .from('products')
    .select('*')
    .eq('vendor_id', vendorId)
    .order('display_order', { ascending: true })
    .order('name', { ascending: true })
}

export async function getAvailableProducts(vendorId: string, serviceType?: 'food' | 'grocery') {
  if (serviceType) {
    const { data: catRows } = await supabase
      .from('categories')
      .select('id')
      .eq('vendor_id', vendorId)
      .eq('service_type', serviceType)

    if (catRows && catRows.length > 0) {
      const categoryIds = catRows.map((c) => c.id)
      return supabase
        .from('products')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('is_available', true)
        .in('category_id', categoryIds)
        .order('display_order', { ascending: true })
        .order('name', { ascending: true })
    }
  }

  return supabase
    .from('products')
    .select('*')
    .eq('vendor_id', vendorId)
    .eq('is_available', true)
    .order('display_order', { ascending: true })
    .order('name', { ascending: true })
}

export async function getVendorProducts(
  vendorId: string,
  options?: { categoryId?: string; search?: string }
) {
  let query = supabase
    .from('products')
    .select('*')
    .eq('vendor_id', vendorId)
    .order('display_order', { ascending: true })
    .order('name', { ascending: true })

  if (options?.categoryId) {
    query = query.eq('category_id', options.categoryId)
  }

  if (options?.search) {
    query = query.ilike('name', `%${options.search}%`)
  }

  return query
}

export async function createProduct(product: ProductInsert) {
  if (product.price < 0) {
    throw new Error('Product price cannot be negative.')
  }

  return supabase
    .from('products')
    .insert({
      vendor_id: product.vendor_id,
      category_id: product.category_id || null,
      name: product.name.trim(),
      description: product.description?.trim() || null,
      price: product.price,
      image_url: product.image_url?.trim() || null,
      is_available: product.is_available ?? true,
      display_order: product.display_order ?? 0,
    })
    .select()
    .single()
}

export async function updateProduct(productId: string, updates: ProductUpdate) {
  if (updates.price !== undefined && updates.price < 0) {
    throw new Error('Product price cannot be negative.')
  }

  // Defensive check: strip immutable vendor_id / id
  const safeUpdates: ProductUpdate = {
    category_id: updates.category_id !== undefined ? (updates.category_id || null) : undefined,
    name: updates.name !== undefined ? updates.name.trim() : undefined,
    description: updates.description !== undefined ? (updates.description?.trim() || null) : undefined,
    price: updates.price,
    image_url: updates.image_url !== undefined ? (updates.image_url?.trim() || null) : undefined,
    is_available: updates.is_available,
    display_order: updates.display_order,
  }

  return supabase
    .from('products')
    .update(safeUpdates)
    .eq('id', productId)
    .select()
    .single()
}

export async function toggleProductAvailability(productId: string, isAvailable: boolean) {
  return supabase
    .from('products')
    .update({ is_available: isAvailable })
    .eq('id', productId)
    .select()
    .single()
}

export async function deleteProduct(productId: string) {
  return supabase
    .from('products')
    .delete()
    .eq('id', productId)
}
