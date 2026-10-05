import { describe, it, expect, beforeEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import {
  enqueueOfflineDeliveryAction,
  getQueuedDeliveryActions,
  removeQueuedDeliveryAction,
  clearOfflineDeliveryQueue,
  cacheOrderGateDetails,
  getCachedOrderGateDetails,
  syncQueuedDeliveryActions,
} from '@/services/rider/offline-delivery-queue'

describe('Phase 5: Gate Network Resilience & Optimistic Offline Delivery Queue', () => {
  const srcServicePath = path.resolve(__dirname, '../../../services/rider/offline-delivery-queue.ts')
  const frontendServicePath = path.resolve(
    __dirname,
    '../../../../FRONTEND/src/services/rider/offline-delivery-queue.ts'
  )

  beforeEach(() => {
    localStorage.clear()
  })

  it('verifies 1:1 dual directory parity for offline-delivery-queue service', () => {
    expect(fs.existsSync(srcServicePath)).toBe(true)
    expect(fs.existsSync(frontendServicePath)).toBe(true)

    const srcCode = fs.readFileSync(srcServicePath, 'utf8')
    const frontendCode = fs.readFileSync(frontendServicePath, 'utf8')
    expect(srcCode).toBe(frontendCode)
  })

  it('enqueues, retrieves, and removes offline delivery custody actions', () => {
    expect(getQueuedDeliveryActions()).toHaveLength(0)

    const action = enqueueOfflineDeliveryAction({
      orderId: 'ord-tasued-001',
      actionType: 'pickup',
    })

    expect(action.id).toBeDefined()
    expect(action.orderId).toBe('ord-tasued-001')
    expect(action.actionType).toBe('pickup')
    expect(getQueuedDeliveryActions()).toHaveLength(1)

    const action2 = enqueueOfflineDeliveryAction({
      orderId: 'ord-tasued-001',
      actionType: 'delivered',
      pin: '4821',
    })
    expect(getQueuedDeliveryActions()).toHaveLength(2)

    removeQueuedDeliveryAction(action.id)
    const remaining = getQueuedDeliveryActions()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].id).toBe(action2.id)

    clearOfflineDeliveryQueue()
    expect(getQueuedDeliveryActions()).toHaveLength(0)
  })

  it('caches order gate details and survives offline retrieval', () => {
    cacheOrderGateDetails('ord-oou-777', {
      customerName: 'Adeola Balogun',
      customerPhone: '08012345678',
      deliveryAddress: 'TASUED Main Campus Gate, Ijagun',
      pickupAddress: 'Buka Central Kitchen, Ijebu Ode',
    })

    const cached = getCachedOrderGateDetails('ord-oou-777')
    expect(cached).not.toBeNull()
    expect(cached?.customerName).toBe('Adeola Balogun')
    expect(cached?.customerPhone).toBe('08012345678')
    expect(cached?.deliveryAddress).toContain('TASUED Main Campus Gate')
    expect(cached?.cachedAt).toBeDefined()
  })

  it('syncQueuedDeliveryActions flushes queued actions via processor callback', async () => {
    enqueueOfflineDeliveryAction({
      orderId: 'ord-sync-1',
      actionType: 'pickup',
    })
    enqueueOfflineDeliveryAction({
      orderId: 'ord-sync-2',
      actionType: 'transit',
    })

    expect(getQueuedDeliveryActions()).toHaveLength(2)

    const processedIds: string[] = []
    const result = await syncQueuedDeliveryActions(async (action) => {
      processedIds.push(action.orderId)
      return true
    })

    expect(result.synced).toBe(2)
    expect(result.failed).toBe(0)
    expect(processedIds).toEqual(['ord-sync-1', 'ord-sync-2'])
    expect(getQueuedDeliveryActions()).toHaveLength(0)
  })
})
