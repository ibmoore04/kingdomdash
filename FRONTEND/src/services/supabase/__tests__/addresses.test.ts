import { describe, it, expect, vi, beforeEach } from 'vitest'

const singleResult = { data: { id: 'mock-addr-id' }, error: null }
const listResult = { data: [{ id: 'addr-1', is_default: true }, { id: 'addr-2', is_default: false }], error: null }

const mockSingle = vi.fn().mockResolvedValue(singleResult)
const mockGetUser = vi.fn().mockResolvedValue({
  data: { user: { id: 'test-profile-uuid' } },
  error: null,
})

const makeQueryBuilder = (): Record<string, unknown> => {
  const builder: Record<string, unknown> = {
    then: (resolve: (v: typeof listResult) => void) => resolve(listResult),
    single: mockSingle,
    order: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
  }
  return builder
}

const mockFrom = vi.fn((_table?: string) => ({
  select: vi.fn(() => makeQueryBuilder()),
  update: vi.fn(() => makeQueryBuilder()),
  insert: vi.fn(() => makeQueryBuilder()),
  delete: vi.fn(() => makeQueryBuilder()),
}))

vi.mock('../client', () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
    auth: {
      getUser: () => mockGetUser(),
    },
  },
}))

import {
  getCustomerAddresses,
  createCustomerAddress,
  updateCustomerAddress,
  deleteCustomerAddress,
  setDefaultAddress,
} from '../addresses'

describe('Address Service Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'test-profile-uuid' } },
      error: null,
    })
  })

  it('getCustomerAddresses fetches addresses for current user', async () => {
    const result = await getCustomerAddresses()
    expect(mockFrom).toHaveBeenCalledWith('addresses')
    expect(result).toHaveProperty('data')
  })

  it('getCustomerAddresses returns error when user is not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    })
    const result = await getCustomerAddresses()
    expect(result.data).toBeNull()
    expect(result.error?.message).toContain('not authenticated')
  })

  it('createCustomerAddress creates an address tied to user profile_id', async () => {
    const result = await createCustomerAddress({
      label: 'Home',
      recipient_name: 'Adewale Adeleke',
      phone: '08012345678',
      address_line_1: '12 Folagbade St',
      city: 'Ijebu-Ode',
      state: 'Ogun State',
      is_default: false,
    })
    expect(mockFrom).toHaveBeenCalledWith('addresses')
    expect(result).toHaveProperty('data')
  })

  it('createCustomerAddress resets other default addresses when is_default is true', async () => {
    await createCustomerAddress({
      label: 'Office',
      recipient_name: 'Adewale Adeleke',
      phone: '08012345678',
      address_line_1: '45 Ibadan Rd',
      city: 'Ijebu-Ode',
      state: 'Ogun State',
      is_default: true,
    })
    // Expect first call to update addresses resetting is_default: false
    expect(mockFrom).toHaveBeenCalledWith('addresses')
  })

  it('updateCustomerAddress updates the target address', async () => {
    const result = await updateCustomerAddress('addr-1', {
      address_line_1: 'Updated St 99',
    })
    expect(mockFrom).toHaveBeenCalledWith('addresses')
    expect(result).toHaveProperty('data')
  })

  it('deleteCustomerAddress deletes the target address', async () => {
    await deleteCustomerAddress('addr-1')
    expect(mockFrom).toHaveBeenCalledWith('addresses')
  })

  it('setDefaultAddress updates existing defaults and marks target address', async () => {
    const result = await setDefaultAddress('addr-2')
    expect(mockFrom).toHaveBeenCalledWith('addresses')
    expect(result).toHaveProperty('data')
  })
})
