import React, { useState, useEffect, useCallback } from 'react';
import {
  getPaymentTransactions,
  getRefundReviewQueue,
} from '../../services/supabase/admin';
import type { PaymentTransactionRow, RefundReviewRow } from '../../types/admin';
import {
  CreditCard,
  RefreshCw,
  AlertCircle,
  Clock,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';

export const AdminPaymentsPage: React.FC = () => {
  const [tab, setTab] = useState<'transactions' | 'refunds'>('transactions');
  const [transactions, setTransactions] = useState<PaymentTransactionRow[]>([]);
  const [refundQueue, setRefundQueue] = useState<RefundReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      if (tab === 'transactions') {
        const txs = await getPaymentTransactions();
        setTransactions((txs.data || []) as unknown as PaymentTransactionRow[]);
      } else {
        const queue = await getRefundReviewQueue();
        setRefundQueue((queue.data || []) as unknown as RefundReviewRow[]);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to query financial records');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-border shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Payment Operations & Refund Review</h2>
            <p className="text-xs text-text-secondary">
              Authoritative transaction records • Manual review queue for cancelled paid orders
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadData}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-text-secondary bg-white hover:bg-light-surface rounded-lg transition-colors border border-border shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-primary' : ''}`} />
          <span>Reload Ledger</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <button
          type="button"
          onClick={() => setTab('transactions')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            tab === 'transactions'
              ? 'bg-primary/10 text-primary border border-primary/20 font-semibold shadow-xs'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Captured Transactions
        </button>
        <button
          type="button"
          onClick={() => setTab('refunds')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
            tab === 'refunds'
              ? 'bg-amber-50 text-amber-800 border border-amber-200 font-semibold shadow-xs'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          <span>Refund Review Queue</span>
          {refundQueue.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
              {refundQueue.length}
            </span>
          )}
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-3 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-primary" />
          <span>{error}</span>
        </div>
      )}

      {/* Security Note on Refunds */}
      {tab === 'refunds' && (
        <div className="p-4 rounded-xl bg-light-surface border border-border text-xs text-text-secondary space-y-1">
          <div className="font-semibold text-text-primary flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span>Manual Paystack Refund Verification Protocol</span>
          </div>
          <p className="text-text-secondary">
            Per KingdomDash architecture, automatic client-side refund triggers are prohibited to prevent unauthorized payouts. 
            Review the Paystack transaction reference below, verify cancellation validity, and process directly via the merchant gateway dashboard.
          </p>
        </div>
      )}

      {/* Content Table */}
      <div className="rounded-2xl bg-white border border-border overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          {tab === 'transactions' ? (
            <table className="w-full text-left text-xs text-text-secondary">
              <thead className="bg-light-surface/80 text-text-secondary font-semibold uppercase tracking-wider border-b border-border text-[11px]">
                <tr>
                  <th className="px-4 py-3">Transaction ID</th>
                  <th className="px-4 py-3">Order ID</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Gateway Reference</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                      <div className="inline-flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                        <span>Loading transactions...</span>
                      </div>
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                      No payment transactions found.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-light-surface/60 transition-colors">
                      <td className="px-4 py-3 font-mono text-[11px] text-text-primary">
                        {tx.id.slice(0, 8)}...
                      </td>
                      <td className="px-4 py-3 font-mono text-text-secondary">
                        {tx.order_id ? `${tx.order_id.slice(0, 8)}...` : '—'}
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-text-primary">
                        ₦{Number(tx.amount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 font-mono text-text-muted">
                        {tx.paystack_reference || 'N/A'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {new Date(tx.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left text-xs text-text-secondary">
              <thead className="bg-light-surface/80 text-text-secondary font-semibold uppercase tracking-wider border-b border-border text-[11px]">
                <tr>
                  <th className="px-4 py-3">Order ID</th>
                  <th className="px-4 py-3">Order Amount</th>
                  <th className="px-4 py-3">Cancellation Status</th>
                  <th className="px-4 py-3">Refund State</th>
                  <th className="px-4 py-3">Cancelled At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-text-muted">
                      <div className="inline-flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
                        <span>Querying refund queue...</span>
                      </div>
                    </td>
                  </tr>
                ) : refundQueue.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-text-muted">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
                      Refund queue is clear. No paid cancelled orders awaiting review.
                    </td>
                  </tr>
                ) : (
                  refundQueue.map((item) => (
                    <tr key={item.id} className="hover:bg-light-surface/60 transition-colors">
                      <td className="px-4 py-3 font-mono font-semibold text-text-primary">
                        {item.id}
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-primary">
                        ₦{Number(item.total_amount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-50 text-primary border border-rose-200">
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">
                          <Clock className="w-2.5 h-2.5" />
                          Manual Review Required
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {new Date(item.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPaymentsPage;
