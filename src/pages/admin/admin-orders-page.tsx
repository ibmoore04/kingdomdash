import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import {
  getOrders,
  getOrderDetails,
  getPersonalShopperRequests,
  updateOrderStatusAdmin,
  updatePersonalShopperStatus,
  getAllRiders,
  assignOrderToRider,
  resetDeliveryForOrder,
} from '../../services/supabase/admin';
import type { AdminOrderRow, OrderDetailsData, OrderItemLine, AdminRiderRow } from '../../types/admin';

import { useToast } from '@/hooks/use-toast';
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
  Check,
  Bike,
} from 'lucide-react';


export const AdminOrdersPage: React.FC = () => {
  const { pushToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStatus = searchParams.get('status') || '';
  const initialService = searchParams.get('service') || searchParams.get('type') || '';

  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [serviceFilter, setServiceFilter] = useState(initialService);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Detail drawer & action loading state
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [orderDetails, setOrderDetails] = useState<OrderDetailsData | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  // Dedicated Rider Assignment Modal
  const [assigningOrder, setAssigningOrder] = useState<AdminOrderRow | null>(null);
  const [availableRiders, setAvailableRiders] = useState<AdminRiderRow[]>([]);
  const [ridersLoading, setRidersLoading] = useState(false);
  const [selectedRiderId, setSelectedRiderId] = useState<string>('');
  const [riderSearch, setRiderSearch] = useState('');
  const [assigningInProgress, setAssigningInProgress] = useState(false);

  const pageSize = 15;


  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. If serviceFilter is specifically 'shopper'
      if (serviceFilter === 'shopper') {
        const res = await getPersonalShopperRequests({
          page,
          limit: pageSize,
          status: statusFilter || undefined,
        });
        const rows = (res.data || []).map((r) => ({
          id: r.id,
          order_number: `SHOP-${r.id.slice(0, 6).toUpperCase()}`,
          status: r.status,
          service_type: 'custom' as any,
          total_amount: Number(r.estimated_total || r.budget_cap || 0),
          total: Number(r.estimated_total || r.budget_cap || 0),
          customer_name: r.customer_name,
          customer_phone: r.customer_phone,
          customer_email: null,
          vendor_name: r.market_name,
          delivery_address: r.delivery_address,
          created_at: r.created_at,
          items: r.items,
        }));
        setOrders(rows as unknown as AdminOrderRow[]);
        setTotalCount(res.count || 0);
        return;
      }

      // 2. If serviceFilter is specific to a vendor service ('food', 'grocery', 'courier')
      if (serviceFilter && serviceFilter !== 'all') {
        const res = await getOrders({
          page,
          limit: pageSize,
          status: statusFilter || undefined,
          serviceType: serviceFilter,
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
        return;
      }

      // 3. When serviceFilter is '' or 'all': Fetch BOTH standard orders AND shopper requests!
      const [standardRes, shopperRes] = await Promise.all([
        getOrders({
          page: 1,
          limit: 100,
          status: statusFilter || undefined,
          search: search || undefined,
        }),
        getPersonalShopperRequests({
          page: 1,
          limit: 50,
          status: statusFilter || undefined,
        }),
      ]);

      const rawShoppers = (shopperRes.data || []) as any[];

      const shopperRows = rawShoppers.map((r) => ({
        id: r.id,
        order_id: r.order_id || null,
        order_number: `SHOP-${r.id.slice(0, 6).toUpperCase()}`,
        status: r.status,
        service_type: 'custom' as any,
        total_amount: Number(r.estimated_total || r.budget_cap || 0),
        total: Number(r.estimated_total || r.budget_cap || 0),
        customer_name: r.customer_name,
        customer_phone: r.customer_phone,
        customer_email: null,
        vendor_name: r.market_name,
        delivery_address: r.delivery_address,
        created_at: r.created_at,
        items: r.items,
      }));

      const standardRows = ((standardRes.data || []) as unknown as any[]).map((row) => {
        const prof = row.profiles || row.customers || {};
        const totalAmount = Number(row.total_amount ?? row.total ?? 0);

        // Check if this standard order is linked to a personal shopper request
        const matchedShopper = (row.service_type === 'custom' || !row.vendor_id)
          ? rawShoppers.find((s) => s.order_id === row.id || s.id === row.id)
          : null;

        const orderNumber = matchedShopper
          ? `SHOP-${matchedShopper.id.slice(0, 6).toUpperCase()}`
          : row.order_number || `${row.id.slice(0, 8)}...`;

        return {
          ...row,
          order_number: orderNumber,
          total_amount: totalAmount,
          total: totalAmount,
          customer_name: row.customer_name || matchedShopper?.customer_name || prof.full_name || 'Customer',
          customer_phone: row.customer_phone || matchedShopper?.customer_phone || prof.phone || null,
          customer_email: row.customer_email || prof.email || null,
          vendor_name: row.vendor_name || matchedShopper?.market_name || (row.service_type === 'custom' ? row.pickup_address : null) || row.vendors?.business_name || null,
          items: matchedShopper?.items || row.items,
        };
      });

      // Filter shopper rows if search is active
      const q = search.trim().toLowerCase();
      const filteredShoppers = q
        ? shopperRows.filter(
            (s) =>
              s.order_number.toLowerCase().includes(q) ||
              s.customer_name.toLowerCase().includes(q) ||
              (s.customer_phone && s.customer_phone.includes(q)) ||
              (s.vendor_name && s.vendor_name.toLowerCase().includes(q))
          )
        : shopperRows;

      // De-duplicate shopper rows that already have a synced standard order row
      const dedupedShoppers = filteredShoppers.filter((s) => {
        const linkedId = s.order_id;
        if (linkedId && standardRows.some((std) => std.id === linkedId)) return false;
        if (standardRows.some((std) => std.id === s.id)) return false;
        return true;
      });

      const mergedAll = [...standardRows, ...dedupedShoppers].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      const startIndex = (page - 1) * pageSize;
      const paginated = mergedAll.slice(startIndex, startIndex + pageSize);

      setOrders(paginated as unknown as AdminOrderRow[]);
      setTotalCount(mergedAll.length);
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

      // 1. Check if matching order exists in current orders list and is a shopper order
      const matchingOrder = orders.find((o) => o.id === id) as any;
      if (
        matchingOrder &&
        (matchingOrder.service_type === 'custom' ||
          matchingOrder.order_number?.startsWith('SHOP-') ||
          id.startsWith('shopper_') ||
          serviceFilter === 'shopper')
      ) {
        const shopperLines: OrderItemLine[] = (matchingOrder.items || []).map((item: any, idx: number) => ({
          id: item.id || `line-${idx}`,
          order_id: matchingOrder.id,
          product_id: item.id || `prod-${idx}`,
          product_name: item.name,
          quantity: item.quantity,
          unit_price: Number(item.estimatedCost || 0),
          total_price: Number(item.estimatedCost || 0),
        }));
        setOrderDetails({
          order: {
            id: matchingOrder.id,
            order_number: matchingOrder.order_number,
            status: matchingOrder.status,
            service_type: 'custom' as any,
            total_amount: matchingOrder.total_amount,
            total: matchingOrder.total_amount,
            subtotal: matchingOrder.total_amount,
            delivery_fee: 600,
            tax_amount: 0,
            customer_name: matchingOrder.customer_name,
            customer_phone: matchingOrder.customer_phone,
            delivery_address: matchingOrder.delivery_address,
            vendor_name: matchingOrder.vendor_name,
            created_at: matchingOrder.created_at,
          } as any,
          items: shopperLines,
          delivery: null,
        } as any);
        return;
      }

      // 2. Check if ID matches a shopper request in database or cache
      try {
        const shopperRes = await getPersonalShopperRequests();
        const matchedShopper = (shopperRes.data || []).find(
          (r) => r.id === id || `SHOP-${r.id.slice(0, 6).toUpperCase()}` === id
        );
        if (matchedShopper) {
          const shopperLines: OrderItemLine[] = (matchedShopper.items || []).map((item: any, idx: number) => ({
            id: item.id || `line-${idx}`,
            order_id: matchedShopper.id,
            product_id: item.id || `prod-${idx}`,
            product_name: item.name,
            quantity: item.quantity,
            unit_price: Number(item.estimatedCost || 0),
            total_price: Number(item.estimatedCost || 0),
          }));
          const totalAmt = Number(matchedShopper.estimated_total || matchedShopper.budget_cap || 0);
          setOrderDetails({
            order: {
              id: matchedShopper.id,
              order_number: `SHOP-${matchedShopper.id.slice(0, 6).toUpperCase()}`,
              status: matchedShopper.status,
              service_type: 'custom' as any,
              total_amount: totalAmt,
              total: totalAmt,
              subtotal: totalAmt,
              delivery_fee: 600,
              tax_amount: 0,
              customer_name: matchedShopper.customer_name,
              customer_phone: matchedShopper.customer_phone,
              delivery_address: matchedShopper.delivery_address,
              vendor_name: matchedShopper.market_name,
              created_at: matchedShopper.created_at,
            } as any,
            items: shopperLines,
            delivery: null,
          } as any);
          return;
        }
      } catch (shopperErr) {
        console.warn('Failed querying shopper request by id:', shopperErr);
      }

      // 3. Fallback to standard order details
      const details = await getOrderDetails(id);
      setOrderDetails(details);
    } catch (err: unknown) {
      setOrderDetails(null);
      console.error('Failed to load order details:', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  const getAvailableStatuses = (serviceType: string) => {
    if (serviceType === 'custom') {
      return [
        { value: 'pending', label: 'Pending' },
        { value: 'assigned', label: 'Assigned' },
        { value: 'shopping', label: 'Shopping' },
        { value: 'in_transit', label: 'In Transit' },
        { value: 'completed', label: 'Completed' },
        { value: 'delivered', label: 'Delivered' },
        { value: 'cancelled', label: 'Cancelled' },
      ];
    }
    return [
      { value: 'pending', label: 'Pending' },
      { value: 'payment_pending', label: 'Payment Pending' },
      { value: 'payment_processing', label: 'Payment Processing' },
      { value: 'payment_confirmed', label: 'Payment Confirmed' },
      { value: 'preparing', label: 'Preparing' },
      { value: 'ready_for_pickup', label: 'Ready for Pickup' },
      { value: 'picked_up', label: 'Picked Up' },
      { value: 'in_transit', label: 'In Transit' },
      { value: 'delivered', label: 'Delivered' },
      { value: 'cancelled', label: 'Cancelled' },
    ];
  };

  const getNextAction = (status: string, serviceType?: string) => {
    const s = (status || '').toLowerCase();
    if (serviceType === 'custom') {
      if (s === 'pending') return { nextStatus: 'assigned', label: 'Assign', variant: 'blue' as const };
      if (s === 'assigned') return { nextStatus: 'shopping', label: 'Shop', variant: 'amber' as const };
      if (s === 'shopping') return { nextStatus: 'completed', label: 'Complete', variant: 'emerald' as const };
      return null;
    }
    if (s === 'placed' || s === 'pending') {
      return { nextStatus: 'confirmed', label: 'Confirm', variant: 'emerald' as const };
    }
    if (s === 'confirmed' || s === 'payment_confirmed') {
      return { nextStatus: 'preparing', label: 'Prepare', variant: 'amber' as const };
    }
    if (s === 'preparing') {
      return { nextStatus: 'ready_for_pickup', label: 'Ready', variant: 'blue' as const };
    }
    if (s === 'ready_for_pickup' || s === 'ready') {
      return { nextStatus: 'in_transit', label: 'Dispatch', variant: 'purple' as const };
    }
    if (s === 'picked_up' || s === 'in_transit' || s === 'dispatched') {
      return { nextStatus: 'delivered', label: 'Deliver', variant: 'emerald' as const };
    }
    return null;
  };

  const canAssignRider = (status: string) => {
    const s = (status || '').toLowerCase();
    // After an order is successfully assigned to a rider, the assign button must be closed
    // unless the status is changed to pending again.
    return s === 'pending';
  };

  const openAssignModal = async (order: AdminOrderRow) => {
    setAssigningOrder(order);
    setSelectedRiderId('');
    setRiderSearch('');
    setRidersLoading(true);
    try {
      const res = await getAllRiders();
      setAvailableRiders((res.data || []) as unknown as AdminRiderRow[]);
    } catch (err) {
      console.error('Failed to query courier riders:', err);
    } finally {
      setRidersLoading(false);
    }
  };

  const handleConfirmAssignment = async () => {
    if (!assigningOrder || !selectedRiderId) return;
    try {
      setAssigningInProgress(true);
      const res = await assignOrderToRider(
        assigningOrder.id,
        selectedRiderId,
        (assigningOrder as any).service_type
      );
      if (res.error) throw res.error;

      const chosenRider = availableRiders.find((r) => r.id === selectedRiderId);
      const riderName = chosenRider?.full_name || (chosenRider as any)?.profiles?.full_name || 'Courier';

      pushToast({
        title: 'Courier Dispatched & Assigned',
        message: `Order #${assigningOrder.order_number || assigningOrder.id.slice(0, 8)} allocated to ${riderName}.`,
        variant: 'success',
      });

      // Transition out of pending status to assigned / in_transit so the Assign button immediately closes
      // All orders transition to 'assigned' after dispatch (rider hasn't physically picked up yet)
      const nextAssignedStatus = 'assigned';

      // Update local orders list
      setOrders((prev) =>
        prev.map((o) => (o.id === assigningOrder.id ? { ...o, status: nextAssignedStatus } : o))
      );

      // If details are open for this order, refresh details
      if (orderDetails && orderDetails.order && orderDetails.order.id === assigningOrder.id) {
        setOrderDetails((prev) =>
          prev
            ? {
                ...prev,
                order: { ...prev.order, status: nextAssignedStatus },
                delivery: prev.delivery
                  ? { ...prev.delivery, rider_id: selectedRiderId, status: 'assigned' }
                  : { id: 'auto', rider_id: selectedRiderId, status: 'assigned' },
              }
            : null
        );
      }

      setAssigningOrder(null);
    } catch (err: unknown) {
      pushToast({
        title: 'Assignment Failed',
        message: err instanceof Error ? err.message : 'Could not assign courier rider.',
        variant: 'error',
      });
    } finally {
      setAssigningInProgress(false);
    }
  };

  const handleUpdateOrderStatus = async (
    orderId: string,
    newStatus: string,
    serviceType?: string
  ) => {
    try {
      setUpdatingOrderId(orderId);
      setError(null);

      if (serviceType === 'custom') {
        const res = await updatePersonalShopperStatus(
          orderId,
          newStatus as any
        );
        if (res && (res as any).error) {
          throw new Error((res as any).error.message || 'Failed to update personal shopper request status');
        }
        try {
          await updateOrderStatusAdmin(orderId, newStatus);
        } catch {}
      } else {
        const res = await updateOrderStatusAdmin(orderId, newStatus);
        if (res.error) {
          throw res.error;
        }
      }

      // If changed back to pending, reset delivery assignment state so it can be cleanly assigned again
      if (newStatus === 'pending') {
        try {
          await resetDeliveryForOrder(orderId);
        } catch (resetErr) {
          console.warn('Could not reset delivery on pending status:', resetErr);
        }
      }

      setOrders((prev) =>
        prev.map((ord) => (ord.id === orderId ? { ...ord, status: newStatus } : ord))
      );

      if (orderDetails && orderDetails.order && orderDetails.order.id === orderId) {
        setOrderDetails((prev) =>
          prev
            ? {
                ...prev,
                order: {
                  ...prev.order,
                  status: newStatus,
                },
                delivery: newStatus === 'pending'
                  ? prev.delivery ? { ...prev.delivery, status: 'pending', rider_id: null } : null
                  : prev.delivery,
              }
            : null
        );
      }

      pushToast({
        title: 'Order Status Updated',
        message: `Status successfully updated to "${newStatus.replace(/_/g, ' ')}".`,
        variant: 'success',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update order status';
      setError(msg);
      pushToast({
        title: 'Status Update Failed',
        message: msg,
        variant: 'error',
      });
    } finally {
      setUpdatingOrderId(null);
    }
  };

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
            <SelectItem value="all">All Services (Food, Grocery, Courier, Shopper)</SelectItem>
            <SelectItem value="food">Food Delivery</SelectItem>
            <SelectItem value="grocery">Grocery Delivery</SelectItem>
            <SelectItem value="courier">Courier Dispatch</SelectItem>
            <SelectItem value="shopper">Personal Shopper</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-3 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-primary" />
          <span>{error}</span>
        </div>
      )}

      {/* Orders List: Responsive Mobile Cards (md:hidden) & Desktop Table (hidden md:block) */}
      {loading ? (
        <div className="rounded-2xl bg-white border border-border p-8 text-center text-text-muted shadow-xs">
          <RefreshCw className="w-5 h-5 animate-spin text-primary mx-auto mb-2" />
          <p className="text-xs">Loading orders & dispatches...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl bg-white border border-border p-8 text-center text-text-muted shadow-xs">
          <p className="text-xs font-semibold text-neutral-700">No orders found matching filters.</p>
          <p className="text-[11px] text-neutral-400 mt-1">Try adjusting status, service type, or search terms.</p>
        </div>
      ) : (
        <>
          {/* Mobile Card List (md:hidden) - Uncluttered, fits perfectly on small screens */}
          <div className="md:hidden space-y-3">
            {orders.map((order) => (
              <div key={order.id} className="p-4 rounded-2xl bg-white border border-border shadow-xs space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-mono font-bold text-text-primary text-sm block truncate">
                      {order.order_number || `${order.id.slice(0, 8)}...`}
                    </span>
                    <span className="text-[11px] text-text-muted block mt-0.5">
                      {new Date(order.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-light-surface text-text-secondary border border-border">
                      {order.service_type}
                    </span>
                    {getStatusBadge(order.status)}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs py-2.5 border-y border-border/60">
                  <div>
                    <span className="text-[10px] text-text-muted uppercase tracking-wider block font-semibold">Customer</span>
                    <span className="font-semibold text-text-primary truncate block mt-0.5">
                      {order.customer_name || (order as any).profiles?.full_name || 'Customer'}
                    </span>
                    <span className="text-[10px] text-text-muted font-mono block">
                      {order.customer_phone || (order as any).profiles?.phone || '—'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-text-muted uppercase tracking-wider block font-semibold">Total Amount</span>
                    <span className="font-bold text-text-primary font-mono text-sm block mt-0.5">
                      ₦{Number(order.total_amount ?? order.total ?? 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-0.5">
                  {canAssignRider(order.status) ? (
                    <button
                      type="button"
                      onClick={() => openAssignModal(order)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white bg-neutral-900 hover:bg-black shadow-xs transition-colors cursor-pointer"
                    >
                      <Bike className="w-3.5 h-3.5" />
                      <span>Assign Rider</span>
                    </button>
                  ) : (
                    <div className="text-[11px] text-text-muted font-medium">
                      Lifecycle state: <span className="font-semibold capitalize text-neutral-700">{order.status}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    aria-label="Inspect order"
                    onClick={() => loadDetails(order.id)}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-text-primary bg-light-surface hover:bg-surface-muted border border-border shadow-xs transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-text-secondary" />
                    <span>Manage Dossier</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table (hidden md:block) - Clean, spacious columns without horizontal squishing */}
          <div className="hidden md:block rounded-2xl bg-white border border-border overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-text-secondary">
                <thead className="bg-light-surface/80 text-text-secondary font-semibold uppercase tracking-wider border-b border-border text-[11px]">
                  <tr>
                    <th className="px-4 py-3 w-40">Order Ref</th>
                    <th className="px-3 py-3 w-28">Service</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3 w-32">Total</th>
                    <th className="px-4 py-3 w-36">Status</th>
                    <th className="px-4 py-3 w-28">Date</th>
                    <th className="px-4 py-3 text-right w-64">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-light-surface/60 transition-colors">
                      <td className="px-4 py-3 font-mono">
                        <div className="font-semibold text-text-primary">
                          {order.order_number || `${order.id.slice(0, 8)}...`}
                        </div>
                        <div className="text-[10px] text-text-muted truncate max-w-[120px]">{order.id}</div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-light-surface text-text-secondary border border-border">
                          {order.service_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-text-primary font-medium truncate max-w-[180px]">
                          {order.customer_name || (order as any).profiles?.full_name || 'Customer'}
                        </div>
                        <div className="text-[10px] text-text-muted font-mono">
                          {order.customer_phone || (order as any).profiles?.phone || '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-text-primary font-mono whitespace-nowrap">
                        ₦{Number(order.total_amount ?? order.total ?? 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3">
                        {getStatusBadge(order.status)}
                      </td>
                      <td className="px-4 py-3 text-text-secondary whitespace-nowrap">
                        {new Date(order.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-nowrap">
                          {/* Assign Rider Button (If unassigned/active) */}
                          {canAssignRider(order.status) && (
                            <button
                              type="button"
                              onClick={() => openAssignModal(order)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-white bg-neutral-900 hover:bg-black shadow-xs transition-colors cursor-pointer shrink-0"
                              title="Assign courier rider to this order"
                            >
                              <Bike className="w-3.5 h-3.5" />
                              <span>Assign</span>
                            </button>
                          )}

                          {/* Quick Status Dropdown */}
                          <Select
                            value={order.status}
                            onValueChange={(val) =>
                              handleUpdateOrderStatus(order.id, val, (order as any).service_type)
                            }
                            disabled={updatingOrderId === order.id}
                          >
                            <SelectTrigger className="w-28 h-8 text-[11px] bg-white border border-border rounded-lg capitalize focus:border-primary shadow-xs shrink-0">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="z-[10002] bg-white text-neutral-900 border border-neutral-200 shadow-2xl">
                              {getAvailableStatuses((order as any).service_type || 'food').map((s) => (
                                <SelectItem key={s.value} value={s.value}>
                                  {s.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {/* Primary Manage Button */}
                          <button
                            type="button"
                            aria-label="Inspect order"
                            onClick={() => loadDetails(order.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-light-surface hover:bg-neutral-200 text-neutral-800 border border-neutral-200 shadow-xs transition-colors cursor-pointer shrink-0"
                            title="View Full Order Dossier & Manage"
                          >
                            <Eye className="w-3.5 h-3.5 text-neutral-600" />
                            <span>Manage</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-white border border-border text-xs text-text-secondary shadow-xs">
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
        </>
      )}

      {/* Order Detail Dossier Drawer / Modal Portal */}
      {selectedOrderId && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
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

                {/* Interactive Status & Action Controls */}
                <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-700">
                      Order Lifecycle & Quick Actions
                    </span>
                    {updatingOrderId === orderDetails.order.id && (
                      <span className="text-[11px] text-primary font-medium animate-pulse flex items-center gap-1">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        Updating status...
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Advance to next state button */}
                    {(() => {
                      const next = getNextAction(orderDetails.order.status, orderDetails.order.service_type);
                      if (!next) return null;
                      return (
                        <button
                          type="button"
                          disabled={updatingOrderId === orderDetails.order.id}
                          onClick={() =>
                            handleUpdateOrderStatus(
                              orderDetails.order.id,
                              next.nextStatus,
                              orderDetails.order.service_type
                            )
                          }
                          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50 ${
                            next.variant === 'emerald'
                              ? 'bg-emerald-600 hover:bg-emerald-700'
                              : next.variant === 'amber'
                              ? 'bg-amber-500 hover:bg-amber-600'
                              : next.variant === 'purple'
                              ? 'bg-purple-600 hover:bg-purple-700'
                              : 'bg-blue-600 hover:bg-blue-700'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Advance: {next.label} ({next.nextStatus})</span>
                        </button>
                      );
                    })()}

                    {/* Dedicated Assign Rider Button */}
                    {canAssignRider(orderDetails.order.status) && (
                      <button
                        type="button"
                        onClick={() => openAssignModal(orderDetails.order)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-neutral-900 hover:bg-black shadow-xs transition-colors cursor-pointer"
                      >
                        <Bike className="w-3.5 h-3.5" />
                        <span>{orderDetails.delivery?.rider_id ? 'Reassign Courier' : 'Assign Courier Rider'}</span>
                      </button>
                    )}

                    {/* Full Status Selector */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-neutral-500">Set status:</span>
                      <Select
                        value={orderDetails.order.status}
                        onValueChange={(val) =>
                          handleUpdateOrderStatus(
                            orderDetails.order.id,
                            val,
                            orderDetails.order.service_type
                          )
                        }
                        disabled={updatingOrderId === orderDetails.order.id}
                      >
                        <SelectTrigger className="w-36 h-8 text-xs bg-white border border-neutral-200 rounded-xl capitalize font-semibold shadow-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="z-[10002] bg-white text-neutral-900 border border-neutral-200 shadow-2xl">
                          {getAvailableStatuses(orderDetails.order.service_type || 'food').map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Cancel Order Button */}
                    {!['delivered', 'completed', 'cancelled', 'failed'].includes(
                      (orderDetails.order.status || '').toLowerCase()
                    ) && (
                      <button
                        type="button"
                        disabled={updatingOrderId === orderDetails.order.id}
                        onClick={() => {
                          if (window.confirm('Are you sure you want to cancel this order?')) {
                            handleUpdateOrderStatus(
                              orderDetails.order.id,
                              'cancelled',
                              orderDetails.order.service_type
                            );
                          }
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Cancel Order</span>
                      </button>
                    )}
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

                {/* Customer & Destination info */}
                <div className="p-3 rounded-xl bg-light-surface border border-border space-y-2">
                  <span className="font-bold uppercase tracking-wider text-[10px] text-text-secondary">
                    Customer & Destination
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                    <div>
                      <span className="text-text-muted text-[10px]">Customer:</span>
                      <p className="text-text-primary font-semibold">{orderDetails.order.customer_name || 'Anonymous'}</p>
                    </div>
                    <div>
                      <span className="text-text-muted text-[10px]">Phone:</span>
                      <p className="text-text-primary font-mono">{orderDetails.order.customer_phone || 'None provided'}</p>
                    </div>
                    <div>
                      <span className="text-text-muted text-[10px]">Origin / Market:</span>
                      <p className="text-text-primary font-semibold">{orderDetails.order.vendor_name || 'Direct Order'}</p>
                    </div>
                    <div className="sm:col-span-3">
                      <span className="text-text-muted text-[10px]">Delivery Address:</span>
                      <p className="text-text-primary">{orderDetails.order.delivery_address || 'Ijebu-Ode'}</p>
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
        </div>,
        document.body
      )}

      {/* Dedicated Rider Assignment Modal Portal */}
      {assigningOrder && typeof document !== 'undefined' && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget && !assigningInProgress) setAssigningOrder(null);
          }}
          className="fixed inset-0 z-[10000] flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
        >
          <div className="relative w-full sm:max-w-xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border-t sm:border border-neutral-200 overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[85vh] animate-slideUp sm:animate-none">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-white">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-neutral-900 text-white flex items-center justify-center shrink-0">
                  <Bike className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-text-primary truncate">Assign Courier Rider</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-neutral-100 text-neutral-800 border border-neutral-200 font-mono">
                      #{assigningOrder.order_number || assigningOrder.id.slice(0, 8)}
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary truncate">
                    Select an active courier to assign & dispatch this delivery
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={assigningInProgress}
                onClick={() => setAssigningOrder(null)}
                className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-500 flex items-center justify-center transition-colors cursor-pointer shrink-0"
              >
                ✕
              </button>
            </div>

            {/* Order Target Info Bar */}
            <div className="px-5 py-3 bg-neutral-50 border-b border-border text-xs flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-[10px] text-text-muted uppercase tracking-wider block font-semibold">Customer & Destination</span>
                <span className="font-semibold text-text-primary">{assigningOrder.customer_name || 'Customer'}</span>
                <span className="text-text-secondary text-[11px] block">{assigningOrder.delivery_address || 'Ijebu-Ode'}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-text-muted uppercase tracking-wider block font-semibold">Order Total</span>
                <span className="font-bold text-text-primary font-mono text-xs">
                  ₦{Number(assigningOrder.total_amount ?? assigningOrder.total ?? 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Search Filter Bar */}
            <div className="p-4 border-b border-border bg-white">
              <div className="relative">
                <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter by courier name, phone, or vehicle class..."
                  value={riderSearch}
                  onChange={(e) => setRiderSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-neutral-50 border border-border rounded-xl text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-xs transition-colors"
                />
              </div>
            </div>

            {/* Riders List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {ridersLoading ? (
                <div className="py-12 text-center text-text-muted text-xs">
                  <RefreshCw className="w-5 h-5 animate-spin text-primary mx-auto mb-2" />
                  <span>Loading fleet roster...</span>
                </div>
              ) : availableRiders.length === 0 ? (
                <div className="py-10 text-center text-text-muted text-xs">
                  <Bike className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                  <p className="font-semibold text-neutral-700">No courier riders registered</p>
                  <p className="text-[11px] text-neutral-400 mt-0.5">Onboard a courier from the direct onboarding menu</p>
                </div>
              ) : (() => {
                const q = riderSearch.toLowerCase().trim();
                const filtered = availableRiders.filter((r) => {
                  const name = (r.full_name || (r as any).profiles?.full_name || '').toLowerCase();
                  const phone = (r.phone || (r as any).profiles?.phone || '').toLowerCase();
                  const vMake = ((r as any).vehicle_make || r.vehicle?.make || (r as any).vehicles?.make || '').toLowerCase();
                  const vType = ((r as any).vehicle_type || r.vehicle?.vehicle_type || (r as any).vehicles?.vehicle_type || '').toLowerCase();
                  return !q || name.includes(q) || phone.includes(q) || vMake.includes(q) || vType.includes(q);
                });

                if (filtered.length === 0) {
                  return (
                    <div className="py-8 text-center text-text-muted text-xs">
                      No couriers matching &quot;{riderSearch}&quot;
                    </div>
                  );
                }

                return filtered.map((rider) => {
                  const isSelected = selectedRiderId === rider.id;
                  const name = rider.full_name || (rider as any).profiles?.full_name || 'Courier Rider';
                  const phone = rider.phone || (rider as any).profiles?.phone || 'No phone';
                  const vehicleType = (rider as any).vehicle_type || rider.vehicle?.vehicle_type || (rider as any).vehicles?.vehicle_type || 'Motorcycle';
                  const plate = (rider as any).license_plate || rider.vehicle?.license_plate || (rider as any).vehicles?.license_plate;
                  const isOnline = rider.is_available !== false;

                  return (
                    <button
                      key={rider.id}
                      type="button"
                      onClick={() => setSelectedRiderId(rider.id)}
                      className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between gap-3 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-neutral-900 bg-neutral-900 text-white shadow-md ring-2 ring-neutral-900/20'
                          : 'border-border bg-white hover:bg-neutral-50 text-neutral-800'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-neutral-100 text-neutral-700'
                          }`}
                        >
                          <Bike className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs truncate">{name}</span>
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase ${
                                isSelected
                                  ? 'bg-white/20 text-white'
                                  : isOnline
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-neutral-100 text-neutral-500'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-neutral-400'}`} />
                              {isOnline ? 'Online' : 'Offline'}
                            </span>
                          </div>
                          <div className={`text-[11px] truncate mt-0.5 ${isSelected ? 'text-neutral-300' : 'text-neutral-500'}`}>
                            {phone} • <span className="capitalize">{vehicleType}</span> {plate ? `(${plate})` : ''}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        {rider.rating && (
                          <span className={`text-[11px] font-bold ${isSelected ? 'text-amber-300' : 'text-amber-600'}`}>
                            ★ {Number(rider.rating).toFixed(1)}
                          </span>
                        )}
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'border-white bg-white text-neutral-900'
                              : 'border-neutral-300 bg-white'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </div>
                    </button>
                  );
                });
              })()}
            </div>

            {/* Sticky Modal Footer */}
            <div className="p-4 border-t border-border bg-white flex items-center justify-between gap-3">
              <button
                type="button"
                disabled={assigningInProgress}
                onClick={() => setAssigningOrder(null)}
                className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!selectedRiderId || assigningInProgress}
                onClick={handleConfirmAssignment}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-neutral-900 hover:bg-black transition-colors disabled:opacity-40 cursor-pointer shadow-xs"
              >
                {assigningInProgress && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{assigningInProgress ? 'Dispatching...' : 'Confirm Assignment & Dispatch'}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};


export default AdminOrdersPage;
