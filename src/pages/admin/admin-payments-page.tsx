import React, { useState, useEffect, useCallback } from 'react';
import {
  getPaymentTransactions,
  getRefundReviewQueue,
  getAdminSettlementControlData,
  retryFailedSettlementJob,
  triggerSettlementWorkerRun,
  type AdminSettlementControlData,
} from '../../services/supabase/admin';
import type { PaymentTransactionRow, RefundReviewRow } from '../../types/admin';
import {
  CreditCard,
  RefreshCw,
  AlertCircle,
  Clock,
  CheckCircle2,
  ShieldCheck,
  Building2,
  Wallet,
  Play,
  RotateCcw,
  Zap,
} from 'lucide-react';

export const AdminPaymentsPage: React.FC = () => {
  const [tab, setTab] = useState<'transactions' | 'refunds' | 'settlements'>('settlements');
  const [transactions, setTransactions] = useState<PaymentTransactionRow[]>([]);
  const [refundQueue, setRefundQueue] = useState<RefundReviewRow[]>([]);
  const [settlementData, setSettlementData] = useState<AdminSettlementControlData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTriggeringWorker, setIsTriggeringWorker] = useState(false);
  const [workerMessage, setWorkerMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      if (tab === 'transactions') {
        const txs = await getPaymentTransactions();
        setTransactions((txs.data || []) as unknown as PaymentTransactionRow[]);
      } else if (tab === 'refunds') {
        const queue = await getRefundReviewQueue();
        setRefundQueue((queue.data || []) as unknown as RefundReviewRow[]);
      } else if (tab === 'settlements') {
        const { data, error: sErr } = await getAdminSettlementControlData();
        if (sErr) throw sErr;
        setSettlementData(data);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to query financial records');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  const handleRunWorker = async () => {
    setIsTriggeringWorker(true);
    setWorkerMessage(null);
    try {
      const { data, error: wErr } = await triggerSettlementWorkerRun({ limit: 10 });
      if (wErr) throw wErr;
      setWorkerMessage(`Worker run dispatched: processed ${data?.processed_count ?? 0} jobs`);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to trigger settlement worker');
    } finally {
      setIsTriggeringWorker(false);
    }
  };

  const handleRetryJob = async (orderId: string) => {
    try {
      const { error: rErr } = await retryFailedSettlementJob(orderId);
      if (rErr) throw rErr;
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to retry job');
    }
  };

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
          onClick={() => setTab('settlements')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
            tab === 'settlements'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 font-semibold shadow-xs'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          <Building2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>Automated Settlements</span>
          {settlementData && settlementData.queue_metrics.action_required_jobs > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
              {settlementData.queue_metrics.action_required_jobs} action
            </span>
          )}
        </button>
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

      {/* Worker message toast/alert */}
      {workerMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-600" />
            <span>{workerMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setWorkerMessage(null)}
            className="text-emerald-700 font-bold hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Settlements HQ Overview Tab */}
      {tab === 'settlements' && settlementData && (
        <div className="space-y-6">
          {/* Float Control & Worker Trigger Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white border border-border shadow-xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-text-secondary">Available Float</span>
                <Wallet className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-xl font-bold font-mono text-text-primary">
                ₦{settlementData.float_control.available_float.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-text-muted mt-1 flex items-center gap-1">
                <span>Polled: ₦{settlementData.float_control.last_polled_balance.toLocaleString()}</span>
                {settlementData.float_control.is_stale && (
                  <span className="text-amber-600 font-semibold">(Stale: &gt;60s)</span>
                )}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-border shadow-xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-text-secondary">Pending Queue</span>
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-xl font-bold font-mono text-amber-600">
                {settlementData.queue_metrics.pending_jobs}
              </div>
              <div className="text-[11px] text-text-muted mt-1">Awaiting worker lease</div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-border shadow-xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-text-secondary">Action Required</span>
                <AlertCircle className="w-4 h-4 text-rose-500" />
              </div>
              <div className="text-xl font-bold font-mono text-rose-600">
                {settlementData.queue_metrics.action_required_jobs}
              </div>
              <div className="text-[11px] text-text-muted mt-1">Failed transfers or holds</div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-border shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold text-text-secondary block mb-1">Disburse Queue</span>
                <span className="text-[11px] text-text-muted">Process eligible payables</span>
              </div>
              <button
                type="button"
                onClick={handleRunWorker}
                disabled={isTriggeringWorker}
                className="mt-2 w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50"
              >
                {isTriggeringWorker ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current" />
                )}
                <span>{isTriggeringWorker ? 'Dispatching...' : 'Run Settlement Worker'}</span>
              </button>
            </div>
          </div>

          {/* Settlement Queue Section */}
          <div className="rounded-2xl bg-white border border-border overflow-hidden shadow-xs">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                  Settlement Queue (Single-Job-Per-Order)
                </h3>
                <p className="text-[11px] text-text-secondary">
                  Track delivery confirmation, partner bank eligibility, and automatic disbursements
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-text-secondary">
                <thead className="bg-light-surface/80 text-text-secondary font-semibold uppercase tracking-wider border-b border-border text-[11px]">
                  <tr>
                    <th className="px-4 py-3">Order ID</th>
                    <th className="px-4 py-3">Order Status</th>
                    <th className="px-4 py-3">Vendor Share</th>
                    <th className="px-4 py-3">Rider Share</th>
                    <th className="px-4 py-3">Settlement Status</th>
                    <th className="px-4 py-3">Queue Status</th>
                    <th className="px-4 py-3">Attempts</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {settlementData.recent_jobs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-text-muted">
                        No orders currently in the settlement pipeline.
                      </td>
                    </tr>
                  ) : (
                    settlementData.recent_jobs.map((job) => (
                      <tr key={job.id} className="hover:bg-light-surface/60 transition-colors">
                        <td className="px-4 py-3 font-mono text-[11px] text-text-primary font-semibold">
                          {job.order_id.slice(0, 8)}...
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-800">
                            {job.order_status}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono font-semibold text-text-primary">
                          ₦{Number(job.vendor_gross_amount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 font-mono text-text-secondary">
                          ₦{Number(job.rider_gross_amount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              job.settlement_status === 'settled'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : job.settlement_status === 'settlement_queued'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : job.settlement_status === 'disbursement_failed'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-slate-50 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {job.settlement_status || 'pending'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              job.status === 'completed'
                                ? 'bg-emerald-50 text-emerald-700'
                                : job.status === 'processing'
                                ? 'bg-blue-50 text-blue-700 animate-pulse'
                                : job.status === 'action_required'
                                ? 'bg-rose-50 text-rose-700 font-extrabold'
                                : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {job.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-text-muted">
                          {job.attempts} / {job.max_attempts}
                        </td>
                        <td className="px-4 py-3">
                          {job.status === 'action_required' || job.status === 'held_cooldown' ? (
                            <button
                              type="button"
                              onClick={() => handleRetryJob(job.order_id)}
                              className="px-2.5 py-1 text-[11px] font-bold bg-white border border-border hover:bg-light-surface text-text-primary rounded-lg transition-colors flex items-center gap-1 shadow-xs"
                            >
                              <RotateCcw className="w-3 h-3 text-primary" />
                              <span>Retry</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-text-muted">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Payout Transactions History */}
          <div className="rounded-2xl bg-white border border-border overflow-hidden shadow-xs">
            <div className="p-4 border-b border-border">
              <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                Recent Paystack Payout Dispatches
              </h3>
              <p className="text-[11px] text-text-secondary">
                Immutable attempt-versioned payout transactions via Paystack Transfers API
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-text-secondary">
                <thead className="bg-light-surface/80 text-text-secondary font-semibold uppercase tracking-wider border-b border-border text-[11px]">
                  <tr>
                    <th className="px-4 py-3">Transfer Reference</th>
                    <th className="px-4 py-3">Recipient</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Net Disbursed</th>
                    <th className="px-4 py-3">Transfer Code</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {settlementData.recent_payouts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-text-muted">
                        No payout transactions logged yet.
                      </td>
                    </tr>
                  ) : (
                    settlementData.recent_payouts.map((payout) => (
                      <tr key={payout.id} className="hover:bg-light-surface/60 transition-colors">
                        <td className="px-4 py-3 font-mono text-[11px] text-text-primary font-semibold">
                          {payout.transfer_reference}
                        </td>
                        <td className="px-4 py-3 font-medium text-text-primary">
                          {payout.recipient_name || payout.recipient_email || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="capitalize text-caption font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-800">
                            {payout.recipient_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-text-primary">
                          ₦{Number(payout.amount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 font-mono text-text-muted text-[11px]">
                          {payout.paystack_transfer_code || 'Pending'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              payout.status === 'success'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : payout.status === 'failed'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : payout.status === 'reversed'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}
                          >
                            {payout.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-text-secondary text-[11px]">
                          {new Date(payout.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Settlements Skeleton & Fallback State */}
      {tab === 'settlements' && !settlementData && (
        <div className="space-y-6">
          {loading ? (
            <div className="space-y-6 animate-pulse">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-28 rounded-2xl bg-white border border-border p-4 space-y-3">
                    <div className="h-4 w-24 bg-slate-100 rounded" />
                    <div className="h-7 w-32 bg-slate-200 rounded" />
                    <div className="h-3 w-40 bg-slate-100 rounded" />
                  </div>
                ))}
              </div>
              <div className="h-64 rounded-2xl bg-white border border-border p-6 flex flex-col items-center justify-center gap-3">
                <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                <p className="text-xs text-text-secondary">Loading settlement ledger and float balance...</p>
              </div>
            </div>
          ) : (
            <div className="p-8 rounded-2xl bg-white border border-border text-center space-y-4 shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mx-auto">
                <Building2 className="w-6 h-6" />
              </div>
              <div className="max-w-md mx-auto">
                <h3 className="text-sm font-semibold text-text-primary">Settlement Engine Ready</h3>
                <p className="text-xs text-text-secondary mt-1">
                  Could not retrieve settlement control metrics from the authoritative database procedure. Ensure migrations are applied or click below to refresh.
                </p>
              </div>
              <button
                type="button"
                onClick={loadData}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Connection</span>
              </button>
            </div>
          )}
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

      {/* Mobile Cards View (md:hidden) for transactions and refunds */}
      {tab !== 'settlements' && (
        <div className="md:hidden space-y-3">
          {loading ? (
            <div className="p-8 text-center text-text-muted bg-white border border-border rounded-2xl shadow-xs">
              <RefreshCw className="w-5 h-5 animate-spin text-primary mx-auto mb-2" />
              <p className="text-xs">
                {tab === 'transactions' ? 'Loading transactions...' : 'Querying refund queue...'}
              </p>
            </div>
          ) : tab === 'transactions' ? (
            transactions.length === 0 ? (
              <div className="p-8 text-center text-text-muted bg-white border border-border rounded-2xl shadow-xs">
                <p className="text-xs">No payment transactions found.</p>
              </div>
            ) : (
              transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="p-4 bg-white border border-border rounded-2xl shadow-xs space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-mono font-semibold text-text-primary">
                        Tx: {tx.id.slice(0, 8)}...
                      </div>
                      <div className="text-[10px] text-text-muted font-mono">
                        Ref: {tx.paystack_reference || 'N/A'}
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      {tx.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <div>
                      <span className="text-[10px] text-text-muted block">Order:</span>
                      <span className="text-xs font-mono text-text-secondary">
                        {tx.order_id ? `${tx.order_id.slice(0, 8)}...` : '—'}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm font-bold text-text-primary">
                        ₦{Number(tx.amount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-[10px] text-text-muted">
                        {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )
          ) : refundQueue.length === 0 ? (
            <div className="p-8 text-center text-text-muted bg-white border border-border rounded-2xl shadow-xs space-y-1">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-1" />
              <p className="text-xs font-semibold text-text-primary">Refund queue is clear</p>
              <p className="text-[11px]">No paid cancelled orders awaiting manual review.</p>
            </div>
          ) : (
            refundQueue.map((item) => (
              <div
                key={item.id}
                className="p-4 bg-white border border-border rounded-2xl shadow-xs space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="text-xs font-mono font-semibold text-text-primary">
                    Order: {item.id.slice(0, 8)}...
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">
                    <Clock className="w-2.5 h-2.5" />
                    Review Needed
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <div>
                    <span className="text-[10px] text-text-muted block">Status:</span>
                    <span className="text-[11px] font-bold uppercase text-primary">
                      {item.status}
                    </span>
                  </div>
                  <div className="text-right font-mono text-sm font-bold text-primary">
                    ₦{Number(item.total_amount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Desktop Table View (hidden md:block) for transactions and refunds */}
      {tab !== 'settlements' && (
        <div className="hidden md:block rounded-2xl bg-white border border-border overflow-hidden shadow-xs">
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
      )}
    </div>
  );
};

export default AdminPaymentsPage;
