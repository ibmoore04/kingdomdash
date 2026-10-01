import { supabase } from '@/services/supabase/client'

export interface BankOption {
  name: string
  code: string
}

export const NIGERIAN_BANKS: BankOption[] = [
  { name: 'Access Bank', code: '044' },
  { name: 'Guaranty Trust Bank (GTBank)', code: '058' },
  { name: 'Zenith Bank', code: '057' },
  { name: 'First Bank of Nigeria', code: '011' },
  { name: 'United Bank for Africa (UBA)', code: '033' },
  { name: 'Kuda Bank', code: '50211' },
  { name: 'Moniepoint MFB', code: '50515' },
  { name: 'OPay (PayCom)', code: '999992' },
  { name: 'PalmPay', code: '999991' },
  { name: 'Stanbic IBTC Bank', code: '221' },
  { name: 'Sterling Bank', code: '232' },
  { name: 'First City Monument Bank (FCMB)', code: '214' },
  { name: 'Fidelity Bank', code: '070' },
  { name: 'Wema Bank (ALAT)', code: '035' },
  { name: 'Union Bank of Nigeria', code: '032' },
  { name: 'Polaris Bank', code: '076' },
  { name: 'Keystone Bank', code: '082' },
  { name: 'Providus Bank', code: '101' },
  { name: 'Jaiz Bank', code: '100004' },
  { name: 'Taj Bank', code: '100033' },
  { name: 'Lotus Bank', code: '100034' },
  { name: 'Unity Bank', code: '215' },
  { name: 'VFD Microfinance Bank', code: '566' },
  { name: 'Carbon', code: '500004' },
]

export interface ResolveAccountParams {
  accountNumber: string
  bankCode: string
}

export interface ResolveAccountResult {
  account_number: string
  account_name: string
  bank_id?: number
  recipient_code?: string | null
}

export interface PartnerBankAccount {
  id: string
  vendor_id: string
  bank_name: string
  bank_code: string
  account_number: string
  account_name: string
  recipient_code?: string | null
  is_verified: boolean
  verified_at: string
  created_at: string
  updated_at: string
}

export interface VendorEarningsSummary {
  vendor_id: string
  gross_revenue: number
  net_settled: number
  pending_balance: number
  total_orders: number
  settled_orders: number
  pending_orders: number
}

export interface SettlementStatementItem {
  order_id: string
  created_at: string
  order_status: string
  vendor_entitlement: number
  platform_service_fee: number
  delivery_fee: number
  customer_total: number
  settlement_status: 'payable_pending' | 'settlement_queued' | 'disbursing' | 'settled' | 'failed'
  net_payable: number
  settlement_updated_at?: string
  payment_reference?: string
  items?: Array<{
    name: string
    quantity: number
    unit_price: number
    total_price: number
  }>
}

/**
 * Returns the list of standard Nigerian banks for payout settlement.
 */
export function getNigerianBanks(): BankOption[] {
  return [...NIGERIAN_BANKS].sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Resolves a Nigerian bank account number with Paystack via Edge Function.
 */
export async function resolveBankAccount(params: ResolveAccountParams): Promise<ResolveAccountResult> {
  const { accountNumber, bankCode } = params

  if (!accountNumber || accountNumber.trim().length !== 10) {
    throw new Error('Account number must be exactly 10 digits')
  }

  if (!bankCode) {
    throw new Error('Please select a destination bank')
  }

  try {
    const { data, error } = await supabase.functions.invoke<{
      success: boolean
      data?: ResolveAccountResult
      error?: string
    }>('paystack-resolve-bank', {
      body: {
        account_number: accountNumber.trim(),
        bank_code: bankCode.trim(),
      },
    })

    if (error) {
      throw new Error(error.message || 'Bank resolution request failed')
    }

    if (!data?.success || !data.data?.account_name) {
      throw new Error(data?.error || 'Could not verify account name with bank')
    }

    return data.data
  } catch (err: unknown) {
    console.error('[BankResolution] Paystack resolution failed:', err)
    throw err instanceof Error ? err : new Error('Unable to resolve account name')
  }
}

/**
 * Saves a verified bank account for a vendor via authoritative RPC.
 */
export async function saveVendorBankAccount(params: {
  vendorId: string
  bankName: string
  bankCode: string
  accountNumber: string
  accountName: string
  recipientCode?: string | null
}): Promise<PartnerBankAccount> {
  const rpcParams: Record<string, unknown> = {
    p_vendor_id: params.vendorId,
    p_bank_name: params.bankName,
    p_bank_code: params.bankCode,
    p_account_number: params.accountNumber,
    p_account_name: params.accountName,
  }

  if (params.recipientCode) {
    rpcParams.p_recipient_code = params.recipientCode
  }

  const { data, error } = await supabase.rpc('save_partner_bank_account', rpcParams as any)

  if (error) {
    throw new Error(error.message || 'Failed to save bank account')
  }

  return data as PartnerBankAccount
}

/**
 * Retrieves the linked bank account for a vendor.
 */
export async function getVendorBankAccount(vendorId: string): Promise<PartnerBankAccount | null> {
  const { data, error } = await supabase.rpc('get_partner_bank_account', {
    p_vendor_id: vendorId,
  })

  if (error) {
    console.error('[BankService] Failed to load bank account:', error.message)
    return null
  }

  return data as PartnerBankAccount | null
}

/**
 * Retrieves the aggregated financial earnings summary for a vendor.
 */
export async function getVendorEarningsSummary(vendorId: string): Promise<VendorEarningsSummary> {
  const { data, error } = await supabase.rpc('get_vendor_earnings_summary', {
    p_vendor_id: vendorId,
  })

  if (error) {
    console.error('[BankService] Failed to load earnings summary:', error.message)
    return {
      vendor_id: vendorId,
      gross_revenue: 0,
      net_settled: 0,
      pending_balance: 0,
      total_orders: 0,
      settled_orders: 0,
      pending_orders: 0,
    }
  }

  return data as VendorEarningsSummary
}

/**
 * Retrieves the historical settlement statements and order breakdowns for a vendor.
 */
export async function getVendorSettlementStatements(
  vendorId: string,
  limit = 50,
  offset = 0
): Promise<SettlementStatementItem[]> {
  const { data, error } = await supabase.rpc('get_vendor_settlement_statements', {
    p_vendor_id: vendorId,
    p_limit: limit,
    p_offset: offset,
  })

  if (error) {
    console.error('[BankService] Failed to load settlement statements:', error.message)
    return []
  }

  return (data || []) as SettlementStatementItem[]
}
