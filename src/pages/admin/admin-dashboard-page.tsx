import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAdminAnalytics } from '../../services/supabase/admin';
import type { AdminAnalyticsResponse, DateRangePreset } from '../../types/admin';
import { AdminKpiCard } from '../../components/admin/analytics/admin-kpi-card';
import { AnalyticsDatePicker } from '../../components/admin/analytics/analytics-date-picker';
import { OrderVolumeChart } from '../../components/admin/analytics/order-volume-chart';
import { ServiceDistributionChart } from '../../components/admin/analytics/service-distribution-chart';
import { OrderStatusChart } from '../../components/admin/analytics/order-status-chart';
import { DeliveryStatusChart } from '../../components/admin/analytics/delivery-status-chart';
import { CompletionTrendChart } from '../../components/admin/analytics/completion-trend-chart';
import {
  ShoppingBag,
  Truck,
  Bike,
  Store,
  Clock,
  CheckCircle2,
  XCircle,
  TrendingUp,
  AlertCircle,
  Radio,
  Send,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import { DirectOnboardVendorModal } from '@/components/admin/onboarding/direct-onboard-vendor-modal';
import { DirectOnboardRiderModal } from '@/components/admin/onboarding/direct-onboard-rider-modal';

export const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [datePreset, setDatePreset] = useState<DateRangePreset>('30d');
  const [customRange, setCustomRange] = useState<{ startDate: string; endDate: string }>({
    startDate: '',
    endDate: '',
  });

  const [data, setData] = useState<AdminAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [isRiderModalOpen, setIsRiderModalOpen] = useState(false);

  // Derive ISO dates from preset or custom
  const computeDateRange = useCallback(() => {
    const end = new Date();
    let start = new Date();

    if (datePreset === 'today') {
      start.setHours(0, 0, 0, 0);
    } else if (datePreset === '7d') {
      start.setDate(end.getDate() - 7);
    } else if (datePreset === '30d') {
      start.setDate(end.getDate() - 30);
    } else if (datePreset === '90d') {
      start.setDate(end.getDate() - 90);
    } else if (datePreset === 'custom' && customRange.startDate && customRange.endDate) {
      return {
        startDate: new Date(customRange.startDate).toISOString(),
        endDate: new Date(customRange.endDate).toISOString(),
      };
    }

    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    };
  }, [datePreset, customRange]);

  const loadAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { startDate, endDate } = computeDateRange();
      const res = await getAdminAnalytics(startDate, endDate);
      if (res.error) {
        throw res.error;
      }
      setData(res.data);
    } catch (err: unknown) {
      console.error('Failed to load admin analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to query platform analytics');
    } finally {
      setLoading(false);
    }
  }, [computeDateRange]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const handleDateChange = (preset: DateRangePreset, start?: string, end?: string) => {
    setDatePreset(preset);
    if (start && end) {
      setCustomRange({ startDate: start, endDate: end });
    }
  };

  const summary = data?.summary;
  const live = data?.live_metrics;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Platform Status Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-border shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-text-primary">Live Platform Health</h2>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                ACTIVE
              </span>
            </div>
            <p className="text-xs text-text-secondary">
              PostgreSQL authoritative metrics • Auto-synchronized across services
            </p>
          </div>
        </div>

        {/* Date Filter Component */}
        <AnalyticsDatePicker
          preset={datePreset}
          onRangeChange={handleDateChange}
          startDate={customRange.startDate}
          endDate={customRange.endDate}
        />
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-medium">Failed to retrieve authoritative analytics</p>
              <p className="text-xs text-rose-600">{error}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={loadAnalytics}
            className="px-3 py-1.5 text-xs font-semibold bg-rose-100 hover:bg-rose-200 text-rose-900 rounded-lg transition-colors"
          >
            Retry Query
          </button>
        </div>
      )}

      {/* SECTION 1: LIVE OPERATIONAL METRICS */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-text-secondary">
              Live Operational State
            </h3>
          </div>
          <span className="text-[11px] text-text-muted font-mono">Real-time snapshot</span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <AdminKpiCard
            title="Pending Orders"
            value={live?.pending_orders_live ?? 0}
            subtitle="Awaiting preparation / confirmation"
            icon={<Clock className="w-4 h-4 text-amber-500" />}
            badgeVariant="warning"
            isLive
            isLoading={loading}
            onClick={() => navigate('/admin/orders?status=pending')}
          />
          <AdminKpiCard
            title="Active Deliveries"
            value={live?.active_deliveries_live ?? 0}
            subtitle="Dispatched, picked up, or in transit"
            icon={<Truck className="w-4 h-4 text-text-secondary" />}
            badgeVariant="default"
            isLive
            isLoading={loading}
            onClick={() => navigate('/admin/deliveries')}
          />
          <AdminKpiCard
            title="Unassigned Deliveries"
            value={live?.unassigned_deliveries_live ?? 0}
            subtitle="Requires rider assignment"
            icon={<Send className="w-4 h-4 text-primary" />}
            badgeVariant="critical"
            isLive
            isLoading={loading}
            onClick={() => navigate('/admin/dispatch')}
          />
          <AdminKpiCard
            title="Available Couriers"
            value={live?.available_riders_live ?? 0}
            subtitle="Verified, active, and online"
            icon={<Bike className="w-4 h-4 text-emerald-600" />}
            badgeVariant="success"
            isLive
            isLoading={loading}
            onClick={() => navigate('/admin/riders')}
          />
        </div>
      </div>

      {/* SECTION 2: HISTORICAL METRICS OVER SELECTED PERIOD */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-text-secondary">
            Historical Summary (Selected Range)
          </h3>
          <span className="text-[11px] text-text-muted font-mono">Aggregated over period</span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <AdminKpiCard
            title="Total Orders"
            value={summary?.total_orders ?? 0}
            subtitle="Cumulative customer orders"
            icon={<ShoppingBag className="w-4 h-4 text-text-secondary" />}
            badgeVariant="default"
            isLoading={loading}
            onClick={() => navigate('/admin/orders')}
          />
          <AdminKpiCard
            title="Fulfilled Orders"
            value={summary?.completed_orders ?? 0}
            subtitle="Successfully delivered"
            icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />}
            badgeVariant="success"
            isLoading={loading}
            onClick={() => navigate('/admin/orders?status=delivered')}
          />
          <AdminKpiCard
            title="Cancelled Orders"
            value={summary?.cancelled_orders ?? 0}
            subtitle="Operational & customer cancels"
            icon={<XCircle className="w-4 h-4 text-primary" />}
            badgeVariant="critical"
            isLoading={loading}
            onClick={() => navigate('/admin/orders?status=cancelled')}
          />
          <AdminKpiCard
            title="Paid Volume"
            value={`₦${((summary?.total_revenue ?? 0)).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`}
            subtitle="Authoritative completed payments"
            icon={<TrendingUp className="w-4 h-4 text-primary" />}
            badgeVariant="default"
            isLoading={loading}
            onClick={() => navigate('/admin/payments')}
          />
        </div>
      </div>

      {/* SECTION 3: ONBOARDING QUEUE & ACTIONS */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-text-secondary">
                Partner Onboarding & Applications
              </h3>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              Review and onboard new restaurant/grocery merchants and delivery couriers
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsVendorModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover transition-colors shadow-xs cursor-pointer"
            >
              <Store className="w-3.5 h-3.5" />
              <span>Onboard Vendors</span>
            </button>
            <button
              type="button"
              onClick={() => setIsRiderModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-near-black text-white hover:bg-neutral-800 transition-colors border border-border shadow-xs cursor-pointer"
            >
              <Bike className="w-3.5 h-3.5" />
              <span>Onboard Riders</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <AdminKpiCard
          title="Active Riders"
          value={summary?.active_riders_count ?? 0}
          subtitle="Total verified fleet roster"
          icon={<Bike className="w-4 h-4 text-text-muted" />}
          badgeVariant="default"
          isLoading={loading}
          onClick={() => navigate('/admin/riders')}
        />
        <AdminKpiCard
          title="Active Vendors"
          value={summary?.active_vendors_count ?? 0}
          subtitle="Merchants with live storefronts"
          icon={<Store className="w-4 h-4 text-text-muted" />}
          badgeVariant="default"
          isLoading={loading}
          onClick={() => navigate('/admin/vendors')}
        />
        <AdminKpiCard
          title="Pending Rider Apps"
          value={summary?.pending_rider_applications ?? 0}
          subtitle="Awaiting document vetting"
          icon={<Bike className="w-4 h-4 text-amber-500" />}
          badgeVariant="warning"
          isLoading={loading}
          onClick={() => navigate('/admin/rider-applications')}
        />
        <AdminKpiCard
          title="Pending Vendor Apps"
          value={summary?.pending_vendor_applications ?? 0}
          subtitle="Awaiting merchant review"
          icon={<Store className="w-4 h-4 text-amber-500" />}
          badgeVariant="warning"
          isLoading={loading}
          onClick={() => navigate('/admin/vendor-applications')}
        />
      </div>
      </div>

      {/* SECTION 4: INTERACTIVE VISUAL ANALYTICS */}
      <div className="space-y-6">
        {/* Row 1: Order volume over time */}
        <OrderVolumeChart
          data={data?.orders_over_time || []}
          isLoading={loading}
          activePreset={datePreset}
          onPresetChange={setDatePreset}
        />

        {/* Row 2: Service Distribution & Completion Trends */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ServiceDistributionChart
            data={data?.orders_by_service || []}
            isLoading={loading}
            onSelectService={(service) => navigate(`/admin/orders?service=${service}`)}
          />
          <CompletionTrendChart
            data={data?.completion_trends || []}
            isLoading={loading}
          />
        </div>

        {/* Row 3: Order State Distribution & Delivery State Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <OrderStatusChart
            data={data?.order_status_distribution || []}
            isLoading={loading}
            onSelectStatus={(status) => navigate(`/admin/orders?status=${status}`)}
          />
          <DeliveryStatusChart
            data={data?.delivery_status_distribution || []}
            isLoading={loading}
            onSelectStatus={(status) => navigate(`/admin/deliveries?status=${status}`)}
          />
        </div>
      </div>

      {/* Direct Partner Onboarding Modals */}
      <DirectOnboardVendorModal
        isOpen={isVendorModalOpen}
        onClose={() => setIsVendorModalOpen(false)}
        onSuccess={() => {
          loadAnalytics();
        }}
      />
      <DirectOnboardRiderModal
        isOpen={isRiderModalOpen}
        onClose={() => setIsRiderModalOpen(false)}
        onSuccess={() => {
          loadAnalytics();
        }}
      />
    </div>
  );
};

export default AdminDashboardPage;
