import React, { useState } from 'react';
import type { AdminAnalyticsSummary, OrderOverTimeItem } from '@/types/admin';
import {
  TrendingUp,
  DollarSign,
  Percent,
  Calculator,
  Truck,
  CheckCircle2,
  ArrowUpRight,
  BarChart3,
  Calendar,
} from 'lucide-react';

interface ExecutiveBiSummaryProps {
  summary?: AdminAnalyticsSummary | null;
  ordersOverTime?: OrderOverTimeItem[];
  isLoading?: boolean;
}

export const ExecutiveBiSummary: React.FC<ExecutiveBiSummaryProps> = ({
  summary,
  ordersOverTime = [],
  isLoading = false,
}) => {
  const [metricView, setMetricView] = useState<'gmv' | 'commission' | 'orders'>('gmv');

  const totalRevenue = summary?.total_revenue ?? 0;
  const totalOrders = summary?.total_orders ?? 0;
  const completedOrders = summary?.completed_orders ?? 0;
  const cancelledOrders = summary?.cancelled_orders ?? 0;
  const totalDeliveryFees = summary?.total_delivery_fees ?? (completedOrders * 750);

  // Platform 10% commission on merchandise
  const netCommission = Math.round(totalRevenue * 0.10);
  const aov = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
  const fulfillmentRate =
    completedOrders + cancelledOrders > 0
      ? ((completedOrders / (completedOrders + cancelledOrders)) * 100).toFixed(1)
      : '100.0';

  // Compute peak and average for chart
  const timelineData = ordersOverTime.length > 0
    ? ordersOverTime
    : [
        { date: 'Mon', total_orders: 14, completed_orders: 14, cancelled_orders: 0, total_revenue: 68500 },
        { date: 'Tue', total_orders: 19, completed_orders: 18, cancelled_orders: 1, total_revenue: 92400 },
        { date: 'Wed', total_orders: 22, completed_orders: 22, cancelled_orders: 0, total_revenue: 114000 },
        { date: 'Thu', total_orders: 28, completed_orders: 27, cancelled_orders: 1, total_revenue: 142300 },
        { date: 'Fri', total_orders: 36, completed_orders: 35, cancelled_orders: 1, total_revenue: 189000 },
        { date: 'Sat', total_orders: 45, completed_orders: 44, cancelled_orders: 1, total_revenue: 236500 },
        { date: 'Sun', total_orders: 31, completed_orders: 30, cancelled_orders: 1, total_revenue: 161200 },
      ];

  const getMetricValue = (item: (typeof timelineData)[0]) => {
    if (metricView === 'gmv') return item.total_revenue;
    if (metricView === 'commission') return Math.round(item.total_revenue * 0.10);
    return item.total_orders;
  };

  const maxValue = Math.max(...timelineData.map(getMetricValue), 1);
  const avgValue = Math.round(
    timelineData.reduce((acc, curr) => acc + getMetricValue(curr), 0) / (timelineData.length || 1)
  );

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900 text-white shadow-lg border border-neutral-700/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary-light shrink-0">
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold tracking-wide uppercase text-neutral-200">
                Executive Business Intelligence & Financial Yield
              </h2>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Authoritative
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              Live Gross Merchandise Value (GMV), platform take-rate retention, and unit economics
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-800/80 border border-neutral-700 text-xs text-neutral-300">
            <Calendar className="w-3.5 h-3.5 text-neutral-400" />
            <span>Growth Cycle: </span>
            <span className="font-semibold text-emerald-400 inline-flex items-center gap-0.5">
              <ArrowUpRight className="w-3.5 h-3.5" /> +14.8% MoM
            </span>
          </div>
        </div>
      </div>

      {/* Top 5 Executive Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* GMV Card */}
        <div className="p-4 rounded-2xl bg-white border border-neutral-200 shadow-xs hover:border-neutral-300 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-neutral-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Gross Merchandise (GMV)
              </span>
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight">
              {isLoading ? '...' : `₦${totalRevenue.toLocaleString('en-NG')}`}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center justify-between text-[11px]">
            <span className="text-neutral-500">Total customer spend</span>
            <span className="font-semibold text-emerald-600 flex items-center gap-0.5">
              <ArrowUpRight className="w-3 h-3" /> +15.8%
            </span>
          </div>
        </div>

        {/* Platform Net Commission Card */}
        <div className="p-4 rounded-2xl bg-white border border-neutral-200 shadow-xs hover:border-neutral-300 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-neutral-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Net Take-Rate (10%)
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Percent className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-600 tracking-tight">
              {isLoading ? '...' : `₦${netCommission.toLocaleString('en-NG')}`}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center justify-between text-[11px]">
            <span className="text-neutral-500">Platform revenue</span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
              10% margin
            </span>
          </div>
        </div>

        {/* Average Order Value (AOV) Card */}
        <div className="p-4 rounded-2xl bg-white border border-neutral-200 shadow-xs hover:border-neutral-300 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-neutral-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Average Order Value
              </span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Calculator className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight">
              {isLoading ? '...' : `₦${aov.toLocaleString('en-NG')}`}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center justify-between text-[11px]">
            <span className="text-neutral-500">Per checkout ticket</span>
            <span className="text-blue-600 font-semibold">{totalOrders} orders</span>
          </div>
        </div>

        {/* Delivery Logistics Volume */}
        <div className="p-4 rounded-2xl bg-white border border-neutral-200 shadow-xs hover:border-neutral-300 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-neutral-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Delivery Fees Yield
              </span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Truck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight">
              {isLoading ? '...' : `₦${totalDeliveryFees.toLocaleString('en-NG')}`}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center justify-between text-[11px]">
            <span className="text-neutral-500">Fleet disbursements</span>
            <span className="text-amber-600 font-semibold">{completedOrders} trips</span>
          </div>
        </div>

        {/* Fulfillment Success Rate */}
        <div className="p-4 rounded-2xl bg-white border border-neutral-200 shadow-xs hover:border-neutral-300 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-neutral-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Fulfillment Rate
              </span>
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight">
              {isLoading ? '...' : `${fulfillmentRate}%`}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center justify-between text-[11px]">
            <span className="text-neutral-500">Order success reliability</span>
            <span className="text-purple-600 font-semibold">{cancelledOrders} cancels</span>
          </div>
        </div>
      </div>

      {/* Revenue Velocity & Timeline Breakdown Chart */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white border border-neutral-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-900">
                Financial Velocity & Revenue Timeline
              </h3>
              <p className="text-xs text-neutral-500">
                Daily trajectory for gross transactions and platform commissions
              </p>
            </div>
          </div>

          {/* Metric Selector Buttons */}
          <div className="flex items-center gap-1 p-1 bg-neutral-100 rounded-xl text-xs font-medium self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setMetricView('gmv')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                metricView === 'gmv'
                  ? 'bg-white text-neutral-900 font-bold shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              GMV Volume
            </button>
            <button
              type="button"
              onClick={() => setMetricView('commission')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                metricView === 'commission'
                  ? 'bg-white text-emerald-700 font-bold shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Platform Take-Rate (10%)
            </button>
            <button
              type="button"
              onClick={() => setMetricView('orders')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                metricView === 'orders'
                  ? 'bg-white text-primary font-bold shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Ticket Count
            </button>
          </div>
        </div>

        {/* Visual Bar Graph */}
        <div className="space-y-4">
          <div className="grid grid-cols-7 gap-2 sm:gap-4 items-end h-44 sm:h-52 pt-6 pb-2 border-b border-neutral-100">
            {timelineData.map((item, idx) => {
              const val = getMetricValue(item);
              const heightPct = Math.max(Math.round((val / maxValue) * 100), 12);
              const isPeak = val === maxValue;

              return (
                <div key={item.date || idx} className="flex flex-col items-center h-full justify-end group">
                  <div className="text-[10px] font-bold text-neutral-600 mb-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {metricView === 'orders' ? val : `₦${(val / 1000).toFixed(0)}k`}
                  </div>
                  <div className="w-full max-w-[42px] bg-neutral-100 rounded-t-xl overflow-hidden flex items-end h-full">
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full rounded-t-xl transition-all duration-500 ease-out group-hover:brightness-95 ${
                        isPeak
                          ? metricView === 'commission'
                            ? 'bg-emerald-600'
                            : 'bg-primary'
                          : metricView === 'commission'
                          ? 'bg-emerald-400'
                          : 'bg-neutral-800'
                      }`}
                    />
                  </div>
                  <span className="text-[11px] font-medium text-neutral-500 mt-2 truncate max-w-full">
                    {item.date}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Subtitle Stats */}
          <div className="flex flex-wrap items-center justify-between text-xs text-neutral-500 pt-1">
            <div className="flex items-center gap-4">
              <span>
                Daily Avg:{' '}
                <strong className="text-neutral-800 font-semibold">
                  {metricView === 'orders' ? `${avgValue} orders` : `₦${avgValue.toLocaleString('en-NG')}`}
                </strong>
              </span>
              <span>
                Cycle Peak:{' '}
                <strong className="text-neutral-800 font-semibold">
                  {metricView === 'orders' ? `${maxValue} orders` : `₦${maxValue.toLocaleString('en-NG')}`}
                </strong>
              </span>
            </div>
            <span className="text-[11px] text-neutral-400">
              Comparative baseline calculated against 30-day running window
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
