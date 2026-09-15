import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getDeliveries } from '../../services/supabase/admin';
import type { AdminDeliveryRow } from '../../types/admin';
import {
  Truck,
  Filter,
  RefreshCw,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Send,
  User,
} from 'lucide-react';

export const AdminDeliveriesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStatus = searchParams.get('status') || '';

  const [deliveries, setDeliveries] = useState<AdminDeliveryRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pageSize = 15;

  const loadDeliveries = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getDeliveries({
        page,
        limit: pageSize,
        status: statusFilter || undefined,
      });
      setDeliveries((res.data || []) as unknown as AdminDeliveryRow[]);
      setTotalCount(res.count || 0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to query deliveries');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    loadDeliveries();
  }, [loadDeliveries]);

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  const getDeliveryStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'delivered') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-2.5 h-2.5" />
          {status}
        </span>
      );
    }
    if (s === 'cancelled') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-50 text-primary border border-rose-200">
          <XCircle className="w-2.5 h-2.5" />
          {status}
        </span>
      );
    }
    if (s === 'in_transit' || s === 'picked_up') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-light-surface text-text-primary border border-border">
          <Truck className="w-2.5 h-2.5 animate-pulse text-primary" />
          {status}
        </span>
      );
    }
    if (s === 'assigned') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-light-surface text-text-secondary border border-border">
          <Send className="w-2.5 h-2.5" />
          {status}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">
        <Clock className="w-2.5 h-2.5" />
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-border shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Delivery Fleet Tracking</h2>
            <p className="text-xs text-text-secondary">
              {totalCount} total deliveries • Independent 6-state courier delivery lifecycle
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadDeliveries}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-text-secondary bg-white hover:bg-light-surface rounded-lg transition-colors border border-border shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-primary' : ''}`} />
          <span>Reload Deliveries</span>
        </button>
      </div>

      {/* Filter toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Filter className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setSearchParams({ status: e.target.value });
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-2 bg-white border border-border rounded-xl text-xs text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary capitalize shadow-xs"
          >
            <option value="">All 6 Delivery States</option>
            <option value="pending">Pending</option>
            <option value="assigned">Assigned</option>
            <option value="picked_up">Picked Up</option>
            <option value="in_transit">In Transit</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-3 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-primary" />
          <span>{error}</span>
        </div>
      )}

      {/* Deliveries Table */}
      <div className="rounded-2xl bg-white border border-border overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-text-secondary">
            <thead className="bg-light-surface/80 text-text-secondary font-semibold uppercase tracking-wider border-b border-border text-[11px]">
              <tr>
                <th className="px-4 py-3">Delivery Ref</th>
                <th className="px-4 py-3">Order ID</th>
                <th className="px-4 py-3">Assigned Courier</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Pickup Time</th>
                <th className="px-4 py-3">Delivered Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-text-muted">
                    <div className="inline-flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                      <span>Loading delivery records...</span>
                    </div>
                  </td>
                </tr>
              ) : deliveries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                    No delivery records found matching filters.
                  </td>
                </tr>
              ) : (
                deliveries.map((delivery) => (
                  <tr key={delivery.id} className="hover:bg-light-surface/60 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-mono font-semibold text-text-primary">{delivery.id.slice(0, 8)}...</div>
                      <div className="text-[10px] text-text-muted font-mono">{delivery.id}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-text-secondary">
                      {delivery.order_id ? `${delivery.order_id.slice(0, 8)}...` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {delivery.rider ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-light-surface border border-border flex items-center justify-center text-text-secondary">
                            <User className="w-3 h-3" />
                          </div>
                          <div>
                            <div className="font-medium text-text-primary">{delivery.rider.full_name}</div>
                            <div className="text-[10px] text-text-muted font-mono">
                              {delivery.rider.phone_number || 'No phone'}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-primary italic font-medium">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {getDeliveryStatusBadge(delivery.status)}
                    </td>
                    <td className="px-4 py-3 text-text-secondary font-mono text-[11px]">
                      {delivery.picked_up_at ? new Date(delivery.picked_up_at).toLocaleTimeString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-text-secondary font-mono text-[11px]">
                      {delivery.delivered_at ? new Date(delivery.delivered_at).toLocaleTimeString() : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border text-xs text-text-secondary bg-white">
          <div>
            Showing Page <span className="font-semibold text-text-primary">{page}</span> of{' '}
            <span className="font-semibold text-text-primary">{totalPages}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => p - 1)}
              className="p-1.5 rounded-lg bg-white border border-border text-text-secondary hover:text-text-primary hover:bg-light-surface disabled:opacity-40 transition-colors shadow-xs"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
              className="p-1.5 rounded-lg bg-white border border-border text-text-secondary hover:text-text-primary hover:bg-light-surface disabled:opacity-40 transition-colors shadow-xs"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDeliveriesPage;
