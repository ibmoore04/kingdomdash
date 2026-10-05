import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAdminAnalytics } from '../../services/supabase/admin';
import type { AdminAnalyticsResponse, DateRangePreset } from '../../types/admin';
import { AdminKpiCard } from '../../components/admin/analytics/admin-kpi-card';
import { AnalyticsDatePicker } from '../../components/admin/analytics/analytics-date-picker';
import { OrderVolumeChart } from '../../components/admin/analytics/order-volume-chart';
import { ServiceDistributionChart } from '../../components/admin/analytics/service-distribution-chart';
import { formatNgn } from '@/utils/formatting';
import {
  ShoppingBag,
  Truck,
  Bike,
  Store,
  Clock,
  TrendingUp,
  AlertCircle,
  Send,
  RefreshCw,
  ArrowRight,
  CreditCard,
  Users,
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
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // Derive ISO dates from preset or custom
  const computeDateRange = useCallback(() => {
    const end = new Date();
    const start = new Date();

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
      setLastRefreshed(new Date());
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

  const totalPendingApps =
    (summary?.pending_rider_applications ?? 0) + (summary?.pending_vendor_applications ?? 0);

  return (
    <div className="space-y-5 sm:space-y-6 animate-fadeIn pb-12 min-w-0 max-w-full overflow-x-hidden">
      {/* ── COMPACT OPERATIONAL CONTROL BAR ───────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-3.5 sm:p-4 rounded-2xl bg-white border border-border shadow-xs">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
            Live Dispatch Telemetry
          </span>
          <span className="text-xs text-text-muted hidden md:inline">
            Ijebu-Ode Operational Grid
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* Date Filter */}
          <AnalyticsDatePicker
            preset={datePreset}
            onRangeChange={handleDateChange}
            startDate={customRange.startDate}
            endDate={customRange.endDate}
          />

          {/* Refresh Button */}
          <button
            type="button"
            onClick={loadAnalytics}
            disabled={loading}
            title={`Last refreshed at ${lastRefreshed.toLocaleTimeString()}`}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-primary' : ''}`} />
          </button>

          {/* Quick Onboarding Triggers */}
          <button
            type="button"
            onClick={() => setIsVendorModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover transition-colors shadow-xs cursor-pointer min-h-[36px]"
          >
            <Store className="w-3.5 h-3.5" />
            <span>+ Vendor</span>
          </button>

          <button
            type="button"
            onClick={() => setIsRiderModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold bg-neutral-900 text-white hover:bg-neutral-800 transition-colors border border-neutral-800 shadow-xs cursor-pointer min-h-[36px]"
          >
            <Bike className="w-3.5 h-3.5" />
            <span>+ Rider</span>
          </button>
        </div>
      </div>

      {/* ── ACTIONABLE ATTENTION BANNERS (Only shown when action needed) ── */}
      {((live?.unassigned_deliveries_live ?? 0) > 0 ||
        (live?.pending_orders_live ?? 0) > 0 ||
        totalPendingApps > 0) && (
        <div className="space-y-2.5">
          {(live?.unassigned_deliveries_live ?? 0) > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 shadow-xs">
              <div className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>
                  <strong>{live?.unassigned_deliveries_live} delivery order(s)</strong> currently require courier dispatch.
                </span>
              </div>
              <button
                type="button"
                onClick={() => navigate('/admin/dispatch')}
                className="self-start sm:self-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                <span>Open Dispatch Console</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {(live?.pending_orders_live ?? 0) > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 shadow-xs">
              <div className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold">
                <Clock className="h-4 w-4 shrink-0 text-amber-600" />
                <span>
                  <strong>{live?.pending_orders_live} order(s)</strong> awaiting restaurant/merchant preparation.
                </span>
              </div>
              <button
                type="button"
                onClick={() => navigate('/admin/orders?status=pending')}
                className="self-start sm:self-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                <span>View Pending Orders</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {totalPendingApps > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-blue-50 border border-blue-200 text-blue-900 shadow-xs">
              <div className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold">
                <Users className="h-4 w-4 shrink-0 text-blue-600" />
                <span>
                  <strong>{totalPendingApps} partner application(s)</strong> awaiting verification review.
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  navigate(
                    summary?.pending_vendor_applications
                      ? '/admin/vendor-applications'
                      : '/admin/rider-applications'
                  )
                }
                className="self-start sm:self-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                <span>Review Applications</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── ERROR ALERT IF ANY ────────────────────────────────────────── */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-medium">Failed to load platform analytics</p>
              <p className="text-xs text-rose-600">{error}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={loadAnalytics}
            className="px-3 py-1.5 text-xs font-semibold bg-rose-100 hover:bg-rose-200 text-rose-900 rounded-lg transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── CORE REAL-TIME & OPERATIONAL METRICS (Balanced 8-Card Grid) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4.5">
        <AdminKpiCard
          title="Active Deliveries"
          value={live?.active_deliveries_live ?? 0}
          subtitle="Couriers currently in transit"
          icon={<Truck className="w-4 h-4 text-emerald-600" />}
          badgeVariant="success"
          isLive
          isLoading={loading}
          onClick={() => navigate('/admin/deliveries')}
        />
        <AdminKpiCard
          title="Pending Orders"
          value={live?.pending_orders_live ?? 0}
          subtitle="Awaiting kitchen or store prep"
          icon={<Clock className="w-4 h-4 text-amber-500" />}
          badgeVariant={(live?.pending_orders_live ?? 0) > 0 ? 'warning' : 'default'}
          isLive
          isLoading={loading}
          onClick={() => navigate('/admin/orders?status=pending')}
        />
        <AdminKpiCard
          title="Unassigned Deliveries"
          value={live?.unassigned_deliveries_live ?? 0}
          subtitle="Awaiting courier dispatch"
          icon={<Send className="w-4 h-4 text-rose-600" />}
          badgeVariant={(live?.unassigned_deliveries_live ?? 0) > 0 ? 'critical' : 'default'}
          isLive={(live?.unassigned_deliveries_live ?? 0) > 0}
          isLoading={loading}
          onClick={() => navigate('/admin/dispatch')}
        />
        <AdminKpiCard
          title="Available Couriers"
          value={live?.available_riders_live ?? 0}
          subtitle="Couriers online and ready"
          icon={<Bike className="w-4 h-4 text-emerald-600" />}
          badgeVariant="success"
          isLive
          isLoading={loading}
          onClick={() => navigate('/admin/riders')}
        />
        <AdminKpiCard
          title="Period Orders"
          value={summary?.total_orders ?? 0}
          subtitle={`${summary?.completed_orders ?? 0} delivered • ${summary?.cancelled_orders ?? 0} cancelled`}
          icon={<ShoppingBag className="w-4 h-4 text-text-secondary" />}
          badgeVariant="default"
          isLoading={loading}
          onClick={() => navigate('/admin/orders')}
        />
        <AdminKpiCard
          title="Gross Revenue"
          value={formatNgn(summary?.total_revenue ?? 0)}
          subtitle="Authoritative Paystack ledger"
          icon={<TrendingUp className="w-4 h-4 text-primary" />}
          badgeVariant="default"
          isLoading={loading}
          onClick={() => navigate('/admin/payments')}
        />
        <AdminKpiCard
          title="Courier Fleet"
          value={summary?.active_riders_count ?? 0}
          subtitle="Total approved courier roster"
          icon={<Users className="w-4 h-4 text-blue-600" />}
          badgeVariant="default"
          isLoading={loading}
          onClick={() => navigate('/admin/riders')}
        />
        <AdminKpiCard
          title="Active Storefronts"
          value={summary?.active_vendors_count ?? 0}
          subtitle="Restaurants & grocery partners"
          icon={<Store className="w-4 h-4 text-primary" />}
          badgeVariant="default"
          isLoading={loading}
          onClick={() => navigate('/admin/vendors')}
        />
      </div>

      {/* ── CORE VISUAL ANALYTICS (2 High-Value Real Charts) ───────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <OrderVolumeChart
            data={data?.orders_over_time || []}
            isLoading={loading}
            activePreset={datePreset}
            onPresetChange={setDatePreset}
          />
        </div>
        <div className="lg:col-span-4">
          <ServiceDistributionChart
            data={data?.orders_by_service || []}
            isLoading={loading}
            onSelectService={(service) => navigate(`/admin/orders?service=${service}`)}
          />
        </div>
      </div>

      {/* ── QUICK OPERATIONAL SHORTCUTS ─────────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-white p-5 sm:p-6 shadow-xs">
        <h2 className="text-sm font-bold text-neutral-900 mb-4 uppercase tracking-wider text-[11px] text-neutral-400">
          Essential Operational Shortcuts
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <button
            type="button"
            onClick={() => navigate('/admin/dispatch')}
            className="flex flex-col items-start p-3.5 sm:p-4 rounded-xl border border-neutral-200 bg-neutral-50/60 hover:bg-neutral-100 hover:border-neutral-300 transition-all text-left cursor-pointer group"
          >
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
              <Send className="h-4 w-4" />
            </div>
            <span className="font-bold text-xs sm:text-sm text-neutral-900">Dispatch Console</span>
            <span className="text-[11px] text-neutral-500 mt-0.5">Assign & track riders</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/admin/orders')}
            className="flex flex-col items-start p-3.5 sm:p-4 rounded-xl border border-neutral-200 bg-neutral-50/60 hover:bg-neutral-100 hover:border-neutral-300 transition-all text-left cursor-pointer group"
          >
            <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
              <ShoppingBag className="h-4 w-4" />
            </div>
            <span className="font-bold text-xs sm:text-sm text-neutral-900">All Orders</span>
            <span className="text-[11px] text-neutral-500 mt-0.5">Search & inspect orders</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/admin/payments')}
            className="flex flex-col items-start p-3.5 sm:p-4 rounded-xl border border-neutral-200 bg-neutral-50/60 hover:bg-neutral-100 hover:border-neutral-300 transition-all text-left cursor-pointer group"
          >
            <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
              <CreditCard className="h-4 w-4" />
            </div>
            <span className="font-bold text-xs sm:text-sm text-neutral-900">Payments & Refunds</span>
            <span className="text-[11px] text-neutral-500 mt-0.5">Paystack settlements</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/admin/vendors')}
            className="flex flex-col items-start p-3.5 sm:p-4 rounded-xl border border-neutral-200 bg-neutral-50/60 hover:bg-neutral-100 hover:border-neutral-300 transition-all text-left cursor-pointer group"
          >
            <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
              <Store className="h-4 w-4" />
            </div>
            <span className="font-bold text-xs sm:text-sm text-neutral-900">Vendor Directory</span>
            <span className="text-[11px] text-neutral-500 mt-0.5">Hours, menus & stores</span>
          </button>
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
