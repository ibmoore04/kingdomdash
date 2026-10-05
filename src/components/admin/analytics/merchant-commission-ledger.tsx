import React, { useState, useMemo } from 'react';
import {
  Building2,
  Download,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  DollarSign,
  Send,
  X,
  CreditCard,
} from 'lucide-react';

export interface VendorSettlementRow {
  id: string;
  vendorName: string;
  category: 'restaurant' | 'grocery' | 'supermarket' | 'cloud_kitchen';
  zone: string;
  ordersFulfilled: number;
  grossSales: number;
  commissionRatePct: number;
  commissionAmount: number;
  netPayable: number;
  bankName: string;
  accountNumberMasked: string;
  status: 'settled' | 'pending' | 'processing';
  lastPayoutDate?: string;
}

const DEFAULT_VENDORS: VendorSettlementRow[] = [
  {
    id: 'v-01',
    vendorName: 'Chicken & Co',
    category: 'restaurant',
    zone: 'Molipa Express',
    ordersFulfilled: 84,
    grossSales: 412000,
    commissionRatePct: 10,
    commissionAmount: 41200,
    netPayable: 370800,
    bankName: 'Zenith Bank',
    accountNumberMasked: '•••• 4192',
    status: 'settled',
    lastPayoutDate: '2026-10-04',
  },
  {
    id: 'v-02',
    vendorName: 'Lord Reigneth Foods',
    category: 'restaurant',
    zone: 'Igbeba Secretariat',
    ordersFulfilled: 68,
    grossSales: 334500,
    commissionRatePct: 10,
    commissionAmount: 33450,
    netPayable: 301050,
    bankName: 'First Bank of Nigeria',
    accountNumberMasked: '•••• 8821',
    status: 'pending',
  },
  {
    id: 'v-03',
    vendorName: 'KingdomDash QA Kitchen',
    category: 'cloud_kitchen',
    zone: 'TASUED Main Campus',
    ordersFulfilled: 112,
    grossSales: 548000,
    commissionRatePct: 10,
    commissionAmount: 54800,
    netPayable: 493200,
    bankName: 'Access Bank',
    accountNumberMasked: '•••• 6033',
    status: 'pending',
  },
  {
    id: 'v-04',
    vendorName: 'FreshMart Supermarket',
    category: 'grocery',
    zone: 'Degun Commercial',
    ordersFulfilled: 51,
    grossSales: 289400,
    commissionRatePct: 10,
    commissionAmount: 28940,
    netPayable: 260460,
    bankName: 'Guaranty Trust Bank',
    accountNumberMasked: '•••• 1928',
    status: 'settled',
    lastPayoutDate: '2026-10-02',
  },
  {
    id: 'v-05',
    vendorName: 'Ijebu Fishery & Market Hub',
    category: 'supermarket',
    zone: 'Oke-Aje Market',
    ordersFulfilled: 39,
    grossSales: 198500,
    commissionRatePct: 10,
    commissionAmount: 19850,
    netPayable: 178650,
    bankName: 'United Bank for Africa',
    accountNumberMasked: '•••• 7340',
    status: 'processing',
  },
];

interface MerchantCommissionLedgerProps {
  customVendors?: VendorSettlementRow[];
  onDisbursePayout?: (vendorId: string) => Promise<void> | void;
}

export const MerchantCommissionLedger: React.FC<MerchantCommissionLedgerProps> = ({
  customVendors,
  onDisbursePayout,
}) => {
  const [vendors, setVendors] = useState<VendorSettlementRow[]>(customVendors || DEFAULT_VENDORS);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'settled' | 'pending' | 'processing'>('all');
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [singleDisburseVendor, setSingleDisburseVendor] = useState<VendorSettlementRow | null>(null);

  // Filtered vendor list
  const filteredVendors = useMemo(() => {
    return vendors.filter((v) => {
      const matchesSearch =
        v.vendorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.zone.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.bankName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || v.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [vendors, searchQuery, statusFilter]);

  // Aggregate totals
  const totalGross = vendors.reduce((sum, v) => sum + v.grossSales, 0);
  const totalCommission = vendors.reduce((sum, v) => sum + v.commissionAmount, 0);
  const totalPending = vendors
    .filter((v) => v.status === 'pending')
    .reduce((sum, v) => sum + v.netPayable, 0);
  const pendingCount = vendors.filter((v) => v.status === 'pending').length;

  // Single payout handler
  const handleSingleDisburse = async (vendor: VendorSettlementRow) => {
    if (onDisbursePayout) {
      await onDisbursePayout(vendor.id);
    }
    setVendors((prev) =>
      prev.map((item) => (item.id === vendor.id ? { ...item, status: 'settled', lastPayoutDate: new Date().toISOString().split('T')[0] } : item))
    );
    setSingleDisburseVendor(null);
  };

  // Batch payout execution
  const handleConfirmBatchPayout = async () => {
    setIsBatchProcessing(true);
    await new Promise((resolve) => setTimeout(resolve, 800));
    setVendors((prev) =>
      prev.map((item) =>
        item.status === 'pending'
          ? { ...item, status: 'settled', lastPayoutDate: new Date().toISOString().split('T')[0] }
          : item
      )
    );
    setIsBatchProcessing(false);
    setIsBatchModalOpen(false);
  };

  // Export CSV for accountant
  const handleExportCsv = () => {
    const headers = [
      'Vendor ID',
      'Merchant Store',
      'Category',
      'Zone',
      'Fulfilled Orders',
      'Gross Sales (NGN)',
      'Commission Rate (%)',
      'Platform Commission (NGN)',
      'Net Merchant Payable (NGN)',
      'Bank Name',
      'Account Number',
      'Settlement Status',
      'Last Payout Date',
    ];

    const rows = filteredVendors.map((v) => [
      v.id,
      `"${v.vendorName}"`,
      v.category,
      `"${v.zone}"`,
      v.ordersFulfilled,
      v.grossSales,
      `${v.commissionRatePct}%`,
      v.commissionAmount,
      v.netPayable,
      `"${v.bankName}"`,
      `"${v.accountNumberMasked}"`,
      v.status,
      v.lastPayoutDate || 'N/A',
    ]);

    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `KingdomDash_Merchant_Settlements_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Component Header with Export & Batch Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-neutral-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-neutral-900">
                Merchant Commission & Automated Settlement Ledger
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                10% Take-Rate
              </span>
            </div>
            <p className="text-xs text-neutral-500">
              Audit-ready merchant revenues, commission deductions, and verified banking payouts
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <button
              type="button"
              onClick={() => setIsBatchModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover transition-colors shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Batch Disburse ({pendingCount})</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border border-neutral-200 transition-colors"
            title="Export CSV for accountants"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Aggregate Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white border border-neutral-200 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">
            Total Merchant Gross
          </div>
          <div className="text-xl sm:text-2xl font-black text-neutral-900">
            ₦{totalGross.toLocaleString('en-NG')}
          </div>
          <p className="text-[11px] text-neutral-400 mt-1">Across all registered storefronts</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-neutral-200 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">
            Platform Commissions Retained
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-600">
            ₦{totalCommission.toLocaleString('en-NG')}
          </div>
          <p className="text-[11px] text-emerald-600/80 mt-1">10% Authoritative margin locked</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-neutral-200 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">
            Pending Merchant Disbursements
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-600">
            ₦{totalPending.toLocaleString('en-NG')}
          </div>
          <p className="text-[11px] text-amber-600/80 mt-1">{pendingCount} merchant(s) awaiting payout</p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Search merchant, zone, or bank..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-neutral-200 bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto overflow-x-auto pb-1 sm:pb-0">
          {(['all', 'pending', 'settled', 'processing'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all ${
                statusFilter === status
                  ? 'bg-neutral-900 text-white shadow-xs'
                  : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4 font-bold">Merchant Store</th>
                <th className="py-3 px-4 font-bold">Zone</th>
                <th className="py-3 px-4 font-bold text-center">Fulfilled</th>
                <th className="py-3 px-4 font-bold text-right">Gross Sales</th>
                <th className="py-3 px-4 font-bold text-right">Take-Rate (10%)</th>
                <th className="py-3 px-4 font-bold text-right">Net Payable</th>
                <th className="py-3 px-4 font-bold">Bank Account</th>
                <th className="py-3 px-4 font-bold">Status</th>
                <th className="py-3 px-4 font-bold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredVendors.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-neutral-500">
                    No merchant settlements found matching query.
                  </td>
                </tr>
              ) : (
                filteredVendors.map((vendor) => (
                  <tr key={vendor.id} className="hover:bg-neutral-50/70 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-neutral-900">{vendor.vendorName}</div>
                      <div className="text-[10px] text-neutral-500 capitalize">{vendor.category.replace('_', ' ')}</div>
                    </td>
                    <td className="py-3.5 px-4 text-neutral-600">{vendor.zone}</td>
                    <td className="py-3.5 px-4 text-center font-semibold text-neutral-800">
                      {vendor.ordersFulfilled}
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-neutral-900">
                      ₦{vendor.grossSales.toLocaleString('en-NG')}
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold text-emerald-600">
                      -₦{vendor.commissionAmount.toLocaleString('en-NG')}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-neutral-900">
                      ₦{vendor.netPayable.toLocaleString('en-NG')}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-neutral-800">{vendor.bankName}</div>
                      <div className="text-[10px] text-neutral-500 font-mono">{vendor.accountNumberMasked}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      {vendor.status === 'settled' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> Settled
                        </span>
                      )}
                      {vendor.status === 'pending' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <Clock className="w-3 h-3" /> Pending
                        </span>
                      )}
                      {vendor.status === 'processing' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          Processing
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {vendor.status === 'pending' ? (
                        <button
                          type="button"
                          onClick={() => setSingleDisburseVendor(vendor)}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-primary text-white hover:bg-primary-hover transition-colors shadow-xs"
                        >
                          Disburse
                        </button>
                      ) : (
                        <span className="text-[11px] text-neutral-400 font-medium">
                          {vendor.lastPayoutDate ? `Paid ${vendor.lastPayoutDate}` : 'Completed'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Single Disburse Confirmation Modal */}
      {singleDisburseVendor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-neutral-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" />
                <h4 className="text-base font-bold text-neutral-900">Authorize Merchant Payout</h4>
              </div>
              <button
                type="button"
                onClick={() => setSingleDisburseVendor(null)}
                className="p-1 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-600">
              You are authorizing direct bank settlement for{' '}
              <strong className="text-neutral-900">{singleDisburseVendor.vendorName}</strong>.
            </p>

            <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-2 text-xs">
              <div className="flex justify-between text-neutral-500">
                <span>Gross Revenue:</span>
                <span className="font-semibold text-neutral-800">
                  ₦{singleDisburseVendor.grossSales.toLocaleString('en-NG')}
                </span>
              </div>
              <div className="flex justify-between text-neutral-500">
                <span>Platform Commission (10%):</span>
                <span className="font-semibold text-emerald-600">
                  -₦{singleDisburseVendor.commissionAmount.toLocaleString('en-NG')}
                </span>
              </div>
              <div className="pt-2 border-t border-neutral-200 flex justify-between font-bold text-sm text-neutral-900">
                <span>Net Transfer Amount:</span>
                <span className="text-primary">
                  ₦{singleDisburseVendor.netPayable.toLocaleString('en-NG')}
                </span>
              </div>
              <div className="text-[11px] text-neutral-500 pt-1">
                Destination: {singleDisburseVendor.bankName} ({singleDisburseVendor.accountNumberMasked})
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSingleDisburseVendor(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-600 hover:bg-neutral-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSingleDisburse(singleDisburseVendor)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover shadow-xs transition-colors"
              >
                Confirm & Disburse Funds
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Payout Modal */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-neutral-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-primary" />
                <h4 className="text-base font-bold text-neutral-900">Batch Disburse Pending Merchants</h4>
              </div>
              <button
                type="button"
                onClick={() => setIsBatchModalOpen(false)}
                className="p-1 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-600">
              Disburse net settlement funds to all <strong className="text-neutral-900">{pendingCount}</strong> pending
              merchants in a single batch operation.
            </p>

            <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 text-xs space-y-1.5">
              <div className="flex justify-between text-neutral-500">
                <span>Total Net Batch Amount:</span>
                <span className="font-bold text-neutral-900 text-sm">
                  ₦{totalPending.toLocaleString('en-NG')}
                </span>
              </div>
              <div className="flex justify-between text-neutral-500">
                <span>Recipient Accounts:</span>
                <span className="font-semibold text-neutral-800">{pendingCount} verified vendors</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsBatchModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-600 hover:bg-neutral-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isBatchProcessing}
                onClick={handleConfirmBatchPayout}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover shadow-xs transition-colors disabled:opacity-50"
              >
                {isBatchProcessing ? 'Processing Batch...' : 'Execute Batch Payout'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
