import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getOrders, getOrderDetails } from '../../services/supabase/admin';
import type { AdminOrderRow, OrderDetailsData, OrderItemLine } from '../../types/admin';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ShoppingBag,
  Search,
  RefreshCw,
  AlertCircle,
  Eye,
  ChevronLeft,
  ChevronRight,
  Package,
  Clock,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

export const AdminOrdersPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStatus = searchParams.get('status') || '';
  const initialService = searchParams.get('service') || '';

  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [serviceFilter, setServiceFilter] = useState(initialService);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Detail drawer
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [orderDetails, setOrderDetails] = useState<OrderDetailsData | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const pageSize = 15;

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getOrders({
        page,
        limit: pageSize,
        status: statusFilter || undefined,
        serviceType: serviceFilter || undefined,
        search: search || undefined,
      });
      const rows = ((res.data || []) as unknown as any[]).map((row) => {
        const prof = row.profiles || row.customers || {};
        const totalAmount = Number(row.total_amount ?? row.total ?? 0);
        return {
          ...row,
          total_amount: totalAmount,
          total: totalAmount,
          customer_name: row.customer_name || prof.full_name || 'Customer',
          customer_phone: row.customer_phone || prof.phone || null,
          customer_email: row.customer_email || prof.email || null,
          vendor_name: row.vendor_name || row.vendors?.business_name || null,
        };
      });
      setOrders(rows as unknown as AdminOrderRow[]);
      setTotalCount(res.count || 0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to query orders');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, serviceFilter, search]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const loadDetails = async (id: string) => {
    try {
      setSelectedOrderId(id);
      setDetailsLoading(true);
      const details = await getOrderDetails(id);
      setOrderDetails(details);
    } catch (err: unknown) {
      setOrderDetails(null);
      alert(`Failed to load order details: ${err instanceof Error ? err.message : 'Unknown'}`);
    } finally {
      setDetailsLoading(false);
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  const getStatusBadge = (status: string) => {
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
    if (s === 'pending' || s === 'placed') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">
          <Clock className="w-2.5 h-2.5" />
          {status}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-light-surface text-text-secondary border border-border">
        <Package className="w-2.5 h-2.5" />
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
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Platform Order Operations</h2>
            <p className="text-xs text-text-secondary">
              {totalCount} orders • 10-state authoritative order lifecycle
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadOrders}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-text-secondary bg-white hover:bg-light-surface rounded-lg transition-colors border border-border shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-primary' : ''}`} />
          <span>Reload</span>
        </button>
      </div>

      {/* Filter toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search order ID..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-2 bg-white border border-border rounded-xl text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-xs"
          />
        </div>

        <Select
          value={statusFilter || 'all'}
          onValueChange={(val) => {
            const nextStatus = val === 'all' ? '' : val;
            setStatusFilter(nextStatus);
            setSearchParams({ status: nextStatus, service: serviceFilter });
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full bg-white border border-border rounded-xl text-xs text-text-primary focus:border-primary shadow-xs capitalize h-9">
            <SelectValue placeholder="All 10 Order States" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All 10 Order States</SelectItem>
            <SelectItem value="placed">placed</SelectItem>
            <SelectItem value="confirmed">confirmed</SelectItem>
            <SelectItem value="preparing">preparing</SelectItem>
            <SelectItem value="ready">ready</SelectItem>
            <SelectItem value="dispatched">dispatched</SelectItem>
            <SelectItem value="in_transit">in_transit</SelectItem>
            <SelectItem value="delivered">delivered</SelectItem>
            <SelectItem value="completed">completed</SelectItem>
            <SelectItem value="cancelled">cancelled</SelectItem>
            <SelectItem value="failed">failed</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={serviceFilter || 'all'}
          onValueChange={(val) => {
            const nextService = val === 'all' ? '' : val;
            setServiceFilter(nextService);
            setSearchParams({ status: statusFilter, service: nextService });
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full bg-white border border-border rounded-xl text-xs text-text-primary focus:border-primary shadow-xs capitalize h-9">
            <SelectValue placeholder="All Services (Food, Grocery, Courier)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Services (Food, Grocery, Courier)</SelectItem>
            <SelectItem value="food">Food Delivery</SelectItem>
            <SelectItem value="grocery">Grocery Delivery</SelectItem>
            <SelectItem value="courier">Courier Dispatch</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-3 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-primary" />
          <span>{error}</span>
        </div>
      )}

      {/* Orders Table */}
      <div className="rounded-2xl bg-white border border-border overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-xs text-text-secondary">
            <thead className="bg-light-surface/80 text-text-secondary font-semibold uppercase tracking-wider border-b border-border text-[11px]">
              <tr>
                <th className="px-4 py-3">Order Reference</th>
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Total Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-text-muted">
                    <div className="inline-flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                      <span>Loading orders...</span>
                    </div>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-text-muted">
                    No orders found matching filters.
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="hover:bg-light-surface/60 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-mono font-semibold text-text-primary">{order.id.slice(0, 8)}...</div>
                      <div className="text-[10px] text-text-muted font-mono">{order.id}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-light-surface text-text-secondary border border-border">
                        {order.service_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-text-primary font-medium">
                        {order.customer_name || (order as any).profiles?.full_name || 'Customer'}
                      </div>
                      <div className="text-[10px] text-text-muted font-mono">
                        {order.customer_phone || (order as any).profiles?.phone || '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-text-primary font-mono">
                      ₦{Number(order.total_amount ?? order.total ?? 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(order.status)}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {new Date(order.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => loadDetails(order.id)}
                        className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-page-background transition-colors"
                        title="View Full Order Dossier"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
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

      {/* Order Detail Dossier Drawer / Modal */}
      {selectedOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white border border-border rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text-primary">Order Operational Dossier</h3>
                  <p className="text-xs text-text-secondary font-mono">{selectedOrderId}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrderId(null)}
                className="text-text-muted hover:text-text-primary text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {detailsLoading || !orderDetails || !orderDetails.order ? (
              <div className="py-12 text-center text-text-muted">
                <RefreshCw className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
                <p className="text-xs">Fetching order snapshots & delivery status...</p>
              </div>
            ) : (
              <div className="space-y-6 text-xs">
                {/* Status & Service header */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-light-surface border border-border">
                  <div>
                    <span className="text-text-secondary">Service Category</span>
                    <p className="font-bold text-text-primary uppercase mt-0.5">
                      {orderDetails.order.service_type}
                    </p>
                  </div>
                  <div>
                    <span className="text-text-secondary">Current Status</span>
                    <div className="mt-0.5">{getStatusBadge(orderDetails.order.status)}</div>
                  </div>
                  <div>
                    <span className="text-text-secondary">Placed Timestamp</span>
                    <p className="text-text-primary mt-0.5">
                      {new Date(orderDetails.order.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Financial breakdown */}
                <div className="p-3 rounded-xl bg-light-surface border border-border space-y-2">
                  <span className="font-bold uppercase tracking-wider text-[10px] text-text-secondary">
                    Immutable Financial Snapshot
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono">
                    <div>
                      <span className="text-text-muted text-[10px]">Subtotal</span>
                      <p className="text-text-primary">
                        ₦{Number(orderDetails.order.subtotal || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <span className="text-text-muted text-[10px]">Delivery Fee</span>
                      <p className="text-text-primary">
                        ₦{Number(orderDetails.order.delivery_fee || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <span className="text-text-muted text-[10px]">Tax / Surcharge</span>
                      <p className="text-text-primary">
                        ₦{Number(orderDetails.order.tax_amount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <span className="text-text-muted text-[10px]">Total Order</span>
                      <p className="text-primary font-bold">
                        ₦{Number(orderDetails.order.total_amount ?? orderDetails.order.total ?? 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Order items */}
                {orderDetails.items && orderDetails.items.length > 0 && (
                  <div className="space-y-2">
                    <span className="font-bold uppercase tracking-wider text-[10px] text-text-secondary">
                      Line Items ({orderDetails.items.length})
                    </span>
                    <div className="border border-border rounded-xl overflow-hidden divide-y divide-border bg-white">
                      {orderDetails.items.map((item: OrderItemLine, idx: number) => (
                        <div key={idx} className="p-3 flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-text-primary">{item.product_name}</div>
                            <div className="text-[10px] text-text-muted">
                              Qty: {item.quantity} × ₦{Number(item.unit_price).toLocaleString('en-NG')}
                            </div>
                          </div>
                          <div className="font-mono font-semibold text-text-primary">
                            ₦{Number(item.total_price).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Delivery Information */}
                {orderDetails.delivery && (
                  <div className="p-3 rounded-xl bg-light-surface border border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold uppercase tracking-wider text-[10px] text-text-secondary">
                        Linked Delivery Operations
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-white text-text-secondary border border-border">
                        {orderDetails.delivery.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                      <div>
                        <span className="text-text-muted">Delivery ID:</span>
                        <div className="font-mono text-text-primary">{orderDetails.delivery.id}</div>
                      </div>
                      <div>
                        <span className="text-text-muted">Assigned Rider ID:</span>
                        <div className="font-mono text-text-primary">{orderDetails.delivery.rider_id || 'None'}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-end pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => setSelectedOrderId(null)}
                className="px-4 py-2 text-xs font-semibold text-text-primary bg-light-surface hover:bg-surface-muted rounded-lg transition-colors border border-border shadow-xs"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminOrdersPage;
