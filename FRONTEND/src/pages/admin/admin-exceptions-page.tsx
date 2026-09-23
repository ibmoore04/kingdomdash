import React, { useState } from 'react';
import { cancelOrderOperational } from '../../services/supabase/admin';
import {
  AlertTriangle,
  XCircle,
  ShieldAlert,
  CheckCircle2,
} from 'lucide-react';

export const AdminExceptionsPage: React.FC = () => {
  const [orderId, setOrderId] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleCancelOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId.trim() || !reason.trim()) {
      alert('Order ID and a detailed operational incident reason are mandatory.');
      return;
    }

    if (!window.confirm(`CONFIRM INCIDENT CANCELLATION: Are you sure you want to operationally cancel order ${orderId}? If payment was captured, refund_required will be flagged automatically.`)) {
      return;
    }

    try {
      setLoading(true);
      setResult(null);
      await cancelOrderOperational(orderId.trim(), reason.trim());
      setResult({
        success: true,
        message: `Order ${orderId} successfully marked as cancelled via cancel_order_operational RPC. Linked delivery was cancelled and refund flag updated.`,
      });
      setOrderId('');
      setReason('');
    } catch (err: unknown) {
      setResult({
        success: false,
        message: err instanceof Error ? err.message : 'Server rejected cancellation RPC',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-border shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Operational Incident & Exception Center</h2>
            <p className="text-xs text-text-secondary">
              Authoritative order cancellation • Post-pickup mitigation • Automated refund queue flagging
            </p>
          </div>
        </div>
      </div>

      {/* Safety Notice */}
      <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
        <div className="flex items-center gap-2 font-semibold text-amber-800">
          <ShieldAlert className="w-4 h-4 text-amber-600" />
          <span>Strict Operational Cancellation Protocol</span>
        </div>
        <p className="text-text-secondary">
          Invoking operational cancellation directly executes the server-side <code className="text-primary font-mono font-bold">cancel_order_operational()</code> RPC. 
          If the customer has completed payment, the order will automatically have <code className="text-amber-700 font-mono font-bold">refund_required = true</code> set, 
          queuing it in the Payment & Refund Center.
        </p>
      </div>

      {/* Action Card */}
      <div className="rounded-2xl bg-white border border-border shadow-xs p-6 max-w-xl">
        <form onSubmit={handleCancelOrder} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">
              Order UUID Reference
            </label>
            <input
              type="text"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
              className="w-full p-2.5 bg-white border border-border rounded-xl text-xs text-text-primary font-mono placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-xs"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">
              Incident Report & Cancellation Reason (Mandatory)
            </label>
            <textarea
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Document the exact operational issue: e.g. Merchant kitchen closed unexpectedly, severe courier vehicle breakdown post-pickup, duplicate payment dispute..."
              className="w-full p-2.5 bg-white border border-border rounded-xl text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-xs"
              required
            />
          </div>

          {result && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                result.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {result.success ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              ) : (
                <XCircle className="w-4 h-4 shrink-0 text-primary mt-0.5" />
              )}
              <span>{result.message}</span>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-primary hover:bg-primary-hover transition-colors shadow-xs disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" />
              <span>{loading ? 'Processing RPC...' : 'Execute Operational Cancellation'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminExceptionsPage;
