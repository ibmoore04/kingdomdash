import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Wallet,
  Building2,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowUpRight,
  TrendingUp,
  Receipt,
  Download,
  Search,
  RefreshCw,
  ShieldCheck,
  Info,
  ChevronRight,
  HelpCircle,
  Landmark,
  FileSpreadsheet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { formatNgn } from '@/utils/formatting'
import type { Vendor } from '@/types'
import {
  getNigerianBanks,
  resolveBankAccount,
  saveVendorBankAccount,
  getVendorBankAccount,
  getVendorEarningsSummary,
  getVendorSettlementStatements,
  type BankOption,
  type PartnerBankAccount,
  type VendorEarningsSummary,
  type SettlementStatementItem,
} from '@/services/paystack/bank'

interface VendorEarningsTabProps {
  vendor: Vendor
}

export function VendorEarningsTab({ vendor }: VendorEarningsTabProps) {
  const { pushToast } = useToast()

  // Data states
  const [bankAccount, setBankAccount] = useState<PartnerBankAccount | null>(null)
  const [earnings, setEarnings] = useState<VendorEarningsSummary>({
    vendor_id: vendor.id,
    gross_revenue: 0,
    net_settled: 0,
    pending_balance: 0,
    total_orders: 0,
    settled_orders: 0,
    pending_orders: 0,
  })
  const [statements, setStatements] = useState<SettlementStatementItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Bank setup form states
  const [showBankForm, setShowBankForm] = useState(false)
  const [selectedBankCode, setSelectedBankCode] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountNameInput, setAccountNameInput] = useState('')
  const [resolvedAccountName, setResolvedAccountName] = useState<string | null>(null)
  const [resolvedRecipientCode, setResolvedRecipientCode] = useState<string | null>(null)
  const [isPaystackVerified, setIsPaystackVerified] = useState(false)
  const [isResolving, setIsResolving] = useState(false)
  const [resolveError, setResolveError] = useState<string | null>(null)
  const [isSavingBank, setIsSavingBank] = useState(false)

  // Filters & search
  const [statusFilter, setStatusFilter] = useState<'all' | 'settled' | 'pending'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const nigerianBanks = useMemo(() => getNigerianBanks(), [])

  // Load all earnings and banking data
  const loadData = useCallback(async () => {
    if (!vendor?.id) return
    try {
      const [bankRes, summaryRes, stmtRes] = await Promise.all([
        getVendorBankAccount(vendor.id),
        getVendorEarningsSummary(vendor.id),
        getVendorSettlementStatements(vendor.id, 100),
      ])
      setBankAccount(bankRes)
      setEarnings(summaryRes)
      setStatements(stmtRes)
    } catch (err) {
      console.error('[VendorEarnings] Failed to load data:', err)
      pushToast({
        title: 'Error loading earnings',
        description: 'Unable to load real-time financial statements. Please refresh.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [vendor.id, pushToast])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await loadData()
    pushToast({
      title: 'Earnings Refreshed',
      description: 'Financial ledger and settlement balances are up to date.',
      variant: 'default',
    })
  }

  // Account number change
  const handleAccountNumberChange = (val: string) => {
    const cleaned = val.replace(/\D/g, '').slice(0, 10)
    setAccountNumber(cleaned)
    setResolvedAccountName(null)
    setIsPaystackVerified(false)
    setResolveError(null)

    if (cleaned.length === 10 && selectedBankCode) {
      triggerResolve(cleaned, selectedBankCode)
    }
  }

  const handleBankSelectChange = (code: string) => {
    setSelectedBankCode(code)
    setResolvedAccountName(null)
    setIsPaystackVerified(false)
    setResolveError(null)

    if (accountNumber.length === 10 && code) {
      triggerResolve(accountNumber, code)
    }
  }

  const triggerResolve = async (acc: string, bankCode: string) => {
    if (!acc || acc.length !== 10) {
      setResolveError('Please enter a 10-digit account number')
      return
    }
    if (!bankCode) {
      setResolveError('Please select a destination bank')
      return
    }

    setIsResolving(true)
    setResolveError(null)
    try {
      const res = await resolveBankAccount({
        accountNumber: acc,
        bankCode: bankCode,
      })
      setResolvedAccountName(res.account_name)
      setResolvedRecipientCode(res.recipient_code || null)
      setAccountNameInput(res.account_name)
      setIsPaystackVerified(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not resolve account name'
      setResolveError(msg)
      setResolvedAccountName(null)
      setResolvedRecipientCode(null)
      setIsPaystackVerified(false)
    } finally {
      setIsResolving(false)
    }
  }

  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault()
    const finalAccountName = (accountNameInput || resolvedAccountName || '').trim()

    if (!selectedBankCode || accountNumber.length !== 10 || !finalAccountName || finalAccountName.length < 3) {
      pushToast({
        title: 'Verification Incomplete',
        description: 'Please select your bank, enter your 10-digit account number, and specify your account name.',
        variant: 'destructive',
      })
      return
    }

    const bank = nigerianBanks.find((b) => b.code === selectedBankCode)
    if (!bank) return

    setIsSavingBank(true)
    try {
      const saved = await saveVendorBankAccount({
        vendorId: vendor.id,
        bankName: bank.name,
        bankCode: bank.code,
        accountNumber: accountNumber,
        accountName: finalAccountName,
        recipientCode: resolvedRecipientCode,
      })

      setBankAccount(saved)
      setShowBankForm(false)
      pushToast({
        title: 'Payout Bank Account Linked',
        description: `${bank.name} (${accountNumber}) has been verified and saved for automated settlements.`,
        variant: 'default',
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save bank account'
      pushToast({
        title: 'Save Failed',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setIsSavingBank(false)
    }
  }

  // Filter statements
  const filteredStatements = useMemo(() => {
    return statements.filter((stmt) => {
      // Status filter
      if (statusFilter === 'settled' && stmt.settlement_status !== 'settled') return false
      if (statusFilter === 'pending' && stmt.settlement_status === 'settled') return false

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const matchesId = stmt.order_id.toLowerCase().includes(query)
        const matchesRef = stmt.payment_reference?.toLowerCase().includes(query)
        const matchesItem = stmt.items?.some((it) => it.name.toLowerCase().includes(query))
        return matchesId || matchesRef || matchesItem
      }

      return true
    })
  }, [statements, statusFilter, searchQuery])

  // CSV export helper
  const handleExportCsv = () => {
    if (statements.length === 0) return

    const headers = [
      'Order ID',
      'Date',
      'Order Status',
      'Vendor Entitlement (NGN)',
      'Platform Fee (NGN)',
      'Customer Total (NGN)',
      'Settlement Status',
      'Payment Reference',
    ]

    const rows = statements.map((s) => [
      s.order_id,
      new Date(s.created_at).toLocaleString(),
      s.order_status,
      s.vendor_entitlement.toFixed(2),
      s.platform_service_fee.toFixed(2),
      s.customer_total.toFixed(2),
      s.settlement_status,
      s.payment_reference || 'N/A',
    ])

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute(
      'download',
      `KingdomDash_${vendor.business_name.replace(/\s+/g, '_')}_Settlement_Statement.csv`
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[360px] space-y-4">
        <RefreshCw className="w-8 h-8 text-[#00875A] animate-spin" />
        <p className="text-sm font-medium text-slate-500">Loading financial ledger & settlement portal...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Title & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Wallet className="w-7 h-7 text-[#00875A]" />
            Earnings & Settlement Portal
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Track your gross product revenue, pending disbursement queue, and verified bank payout statements.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin text-[#00875A]' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={statements.length === 0}
            className="border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            <Download className="w-4 h-4 mr-2 text-slate-500" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* 4 Financial Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Gross Revenue */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Gross Merchandise Value
            </span>
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-3">{formatNgn(earnings.gross_revenue)}</p>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>{earnings.total_orders} total orders fulfilled</span>
          </div>
        </div>

        {/* Net Settled */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Net Settled Payouts
            </span>
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <Landmark className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-black text-blue-600 mt-3">{formatNgn(earnings.net_settled)}</p>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
            <span>{earnings.settled_orders} orders settled to bank</span>
          </div>
        </div>

        {/* Pending Balance */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Pending Settlement
            </span>
            <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-black text-amber-600 mt-3">{formatNgn(earnings.pending_balance)}</p>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
            <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
            <span>{earnings.pending_orders} orders queued for transfer</span>
          </div>
        </div>

        {/* Bank Status Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Payout Bank Account
            </span>
            <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            {bankAccount ? (
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 font-semibold text-xs">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                Verified & Ready
              </Badge>
            ) : (
              <Badge className="bg-amber-100 text-amber-800 border-amber-200 font-semibold text-xs">
                <AlertCircle className="w-3.5 h-3.5 mr-1" />
                Action Required
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-2 truncate">
            {bankAccount ? `${bankAccount.bank_name} (••${bankAccount.account_number.slice(-4)})` : 'No verified bank account linked'}
          </p>
        </div>
      </div>

      {/* Bank Account Verification & Configuration Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 sm:p-7">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-emerald-50 rounded-xl text-emerald-700 hidden sm:block">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="text-lg font-bold text-slate-900">Designated Settlement Bank Account</h3>
                  {bankAccount?.is_verified && (
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs">
                      <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                      NIP Verified
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-slate-500 mt-1 max-w-2xl">
                  Automated payouts from completed orders are disbursed directly to this account via the Paystack NIP rail.
                  KingdomDash verifies your account name in real time before enabling settlement transfers.
                </p>
              </div>
            </div>
            <div>
              <Button
                variant={bankAccount ? 'outline' : 'default'}
                onClick={() => setShowBankForm(!showBankForm)}
                className={!bankAccount ? 'bg-[#00875A] hover:bg-[#007048] text-white' : 'border-slate-300'}
              >
                {bankAccount ? 'Change Bank Details' : 'Link Payout Account'}
              </Button>
            </div>
          </div>

          {/* Current Bank Details Display */}
          {bankAccount && !showBankForm && (
            <div className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50/70 p-4 rounded-lg">
              <div>
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Bank Name</span>
                <p className="text-sm font-bold text-slate-900 mt-0.5">{bankAccount.bank_name}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Account Number</span>
                <p className="text-sm font-bold text-slate-900 mt-0.5 tracking-wider font-mono">
                  ••••••{bankAccount.account_number.slice(-4)}
                </p>
              </div>
              <div>
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Account Holder Name</span>
                <p className="text-sm font-bold text-emerald-700 mt-0.5 uppercase">{bankAccount.account_name}</p>
              </div>
            </div>
          )}

          {/* Bank Account Verification Form */}
          {showBankForm && (
            <form onSubmit={handleSaveBank} className="mt-6 pt-6 border-t border-slate-200 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Bank Select */}
                <div>
                  <Label htmlFor="bank-select" className="text-sm font-semibold text-slate-700">
                    Select Bank
                  </Label>
                  <select
                    id="bank-select"
                    value={selectedBankCode}
                    onChange={(e) => handleBankSelectChange(e.target.value)}
                    required
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">-- Choose your Nigerian bank --</option>
                    {nigerianBanks.map((b) => (
                      <option key={b.code} value={b.code}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Account Number */}
                <div>
                  <Label htmlFor="account-number" className="text-sm font-semibold text-slate-700">
                    10-Digit NUBAN Account Number
                  </Label>
                  <div className="flex gap-2 mt-1.5">
                    <div className="relative flex-1">
                      <Input
                        id="account-number"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={10}
                        value={accountNumber}
                        onChange={(e) => handleAccountNumberChange(e.target.value)}
                        placeholder="e.g. 0123456789"
                        required
                        className="font-mono text-base tracking-wider"
                      />
                      {isResolving && (
                        <div className="absolute right-3 top-2.5">
                          <RefreshCw className="w-4 h-4 text-emerald-600 animate-spin" />
                        </div>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isResolving || accountNumber.length !== 10 || !selectedBankCode}
                      onClick={() => triggerResolve(accountNumber, selectedBankCode)}
                      className="border-slate-300 text-slate-700 text-xs shrink-0"
                    >
                      {isResolving ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          Checking...
                        </>
                      ) : (
                        'Verify with Paystack'
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Account Holder Name Field */}
              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="account-name-input" className="text-sm font-semibold text-slate-700">
                    Official Account Holder Name
                  </Label>
                  {isPaystackVerified && (
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] font-semibold">
                      <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                      Paystack NIBSS Verified
                    </Badge>
                  )}
                </div>
                <Input
                  id="account-name-input"
                  type="text"
                  value={accountNameInput}
                  onChange={(e) => {
                    setAccountNameInput(e.target.value)
                    if (e.target.value !== resolvedAccountName) {
                      setIsPaystackVerified(false)
                    }
                  }}
                  placeholder="e.g. ADEKUNLE OLUWASEUN BABATUNDE"
                  required
                  className="mt-1.5 uppercase font-medium text-slate-900"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Must match the official registered name on your Nigerian bank account statement.
                </p>
              </div>

              {/* Resolution Feedback */}
              {resolvedAccountName && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-emerald-900 uppercase tracking-wide">
                        Live Bank Resolution Match
                      </p>
                      <p className="text-sm font-black text-emerald-800 uppercase tracking-wider">
                        {resolvedAccountName}
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-emerald-600 text-white font-medium text-xs">Verified</Badge>
                </div>
              )}

              {resolveError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-rose-700">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-rose-900">
                      Bank Resolution Note
                    </p>
                    <p className="text-xs text-rose-700 mt-0.5">{resolveError}</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      You can confirm your account holder name manually in the field above to proceed with linking.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowBankForm(false)}
                  className="border-slate-300 text-slate-700"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!resolvedAccountName || isSavingBank}
                  className="bg-[#00875A] hover:bg-[#007048] text-white px-6 font-semibold"
                >
                  {isSavingBank ? 'Saving & Securing...' : 'Confirm & Save Payout Account'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Platform Entitlement & Service Fee Transparency Alert */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-xl p-5 shadow-sm">
        <div className="flex items-start gap-3.5">
          <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg shrink-0 mt-0.5">
            <Info className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
              100% Product Entitlement Guarantee
            </h4>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Your settlement earnings equal <strong>100% of your listed menu product prices</strong> for all completed orders.
              The <strong>₦150 Platform Service Fee</strong> and <strong>Delivery Fees</strong> paid by the customer are collected
              separately by KingdomDash to maintain dispatch operations and rider payouts, and are <strong>never deducted from your merchandise payout</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Settlement Statements & Orders Breakdown Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-slate-600" />
                Settlement Statements & Order Financials
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Statements are immutable legal ledger entries permanently preserved in the PostgreSQL financial vault.
              </p>
            </div>

            {/* Filter Tabs & Search */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <Input
                  type="text"
                  placeholder="Search order ID or item..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 w-[180px] sm:w-[220px] text-xs"
                />
              </div>
              <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-md transition-colors ${
                    statusFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All ({statements.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('settled')}
                  className={`px-3 py-1.5 rounded-md transition-colors ${
                    statusFilter === 'settled' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Settled
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('pending')}
                  className={`px-3 py-1.5 rounded-md transition-colors ${
                    statusFilter === 'pending' ? 'bg-white text-amber-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Pending
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Table Content */}
        {filteredStatements.length === 0 ? (
          <div className="text-center py-12 px-4">
            <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700">No settlement records found</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Completed and delivered orders will automatically generate itemized settlement statement records here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Order ID & Date</th>
                  <th className="py-3 px-4">Order Items</th>
                  <th className="py-3 px-4 text-right">Vendor Entitlement</th>
                  <th className="py-3 px-4 text-right">Customer Total</th>
                  <th className="py-3 px-4 text-center">Settlement Status</th>
                  <th className="py-3 px-4 text-right">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {filteredStatements.map((stmt) => (
                  <tr key={stmt.order_id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Order ID & Date */}
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-semibold text-slate-900">
                        #{stmt.order_id.slice(0, 8)}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {new Date(stmt.created_at).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </td>

                    {/* Order Items */}
                    <td className="py-3.5 px-4 max-w-xs">
                      {stmt.items && stmt.items.length > 0 ? (
                        <div className="truncate">
                          <span className="font-medium text-slate-800">
                            {stmt.items[0].quantity}x {stmt.items[0].name}
                          </span>
                          {stmt.items.length > 1 && (
                            <span className="text-slate-400 text-[11px] ml-1">
                              +{stmt.items.length - 1} more
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Menu items</span>
                      )}
                      <div className="text-[10px] text-slate-400 uppercase mt-0.5">
                        Status: <span className="font-medium text-slate-600">{stmt.order_status}</span>
                      </div>
                    </td>

                    {/* Vendor Entitlement */}
                    <td className="py-3.5 px-4 text-right">
                      <span className="font-bold text-slate-900 text-sm">
                        {formatNgn(stmt.vendor_entitlement)}
                      </span>
                      <div className="text-[10px] text-emerald-600 font-semibold">100% Payout</div>
                    </td>

                    {/* Customer Total */}
                    <td className="py-3.5 px-4 text-right">
                      <span className="font-medium text-slate-600">
                        {formatNgn(stmt.customer_total)}
                      </span>
                      <div className="text-[10px] text-slate-400">
                        incl. ₦{stmt.platform_service_fee.toFixed(0)} fee
                      </div>
                    </td>

                    {/* Settlement Status */}
                    <td className="py-3.5 px-4 text-center">
                      {stmt.settlement_status === 'settled' ? (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[11px] font-semibold">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Settled
                        </Badge>
                      ) : stmt.settlement_status === 'disbursing' ? (
                        <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-[11px] font-semibold">
                          <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                          Disbursing
                        </Badge>
                      ) : stmt.settlement_status === 'failed' ? (
                        <Badge className="bg-rose-100 text-rose-800 border-rose-200 text-[11px] font-semibold">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          Failed
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[11px] font-semibold">
                          <Clock className="w-3 h-3 mr-1" />
                          Queued
                        </Badge>
                      )}
                    </td>

                    {/* Payment Reference */}
                    <td className="py-3.5 px-4 text-right">
                      <span className="font-mono text-[11px] text-slate-500">
                        {stmt.payment_reference ? stmt.payment_reference.slice(0, 16) : 'pstk_pending'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer Note */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>Showing {filteredStatements.length} statements</span>
          <span className="flex items-center gap-1 text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            KingdomDash Dual Conservation Ledger
          </span>
        </div>
      </div>
    </div>
  )
}
