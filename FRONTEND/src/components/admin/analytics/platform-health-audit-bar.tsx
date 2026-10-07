import React, { useState } from 'react';
import {
  Activity,
  Database,
  CreditCard,
  Zap,
  HardDrive,
  RefreshCw,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Clock,
} from 'lucide-react';

export interface AuditStreamItem {
  id: string;
  timestamp: string;
  category: 'FINANCIAL' | 'DISPATCH' | 'SECURITY' | 'MERCHANT';
  actor: string;
  event: string;
}

const DEFAULT_AUDIT_STREAM: AuditStreamItem[] = [
  {
    id: 'ev-1',
    timestamp: 'Just now',
    category: 'FINANCIAL',
    actor: 'Settlement Engine',
    event: 'Automated 10% platform take-rate ledger computed for Chicken & Co (₦41,200 retained)',
  },
  {
    id: 'ev-2',
    timestamp: '3m ago',
    category: 'DISPATCH',
    actor: 'Dispatch Console',
    event: 'Authoritative assignment: Courier Ibrahim Babatunde accepted Order #KD-FD084',
  },
  {
    id: 'ev-3',
    timestamp: '7m ago',
    category: 'FINANCIAL',
    actor: 'Paystack Gateway',
    event: 'Authoritative payment confirmed ₦5,200 (Ref: kd_tx_998124) via Webhook',
  },
  {
    id: 'ev-4',
    timestamp: '15m ago',
    category: 'MERCHANT',
    actor: 'Admin Reviewer',
    event: 'Merchant menu catalog synchronization validated for Lord Reigneth Foods',
  },
  {
    id: 'ev-5',
    timestamp: '28m ago',
    category: 'SECURITY',
    actor: 'Auth Guard',
    event: 'PostgreSQL row-level security policy handshake verified across all service tables',
  },
];

interface PlatformHealthAuditBarProps {
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const PlatformHealthAuditBar: React.FC<PlatformHealthAuditBarProps> = ({
  onRefresh,
  isRefreshing = false,
}) => {
  const [isStreamOpen, setIsStreamOpen] = useState(false);
  const [auditFilter, setAuditFilter] = useState<string>('ALL');
  const [stream] = useState<AuditStreamItem[]>(DEFAULT_AUDIT_STREAM);

  const filteredStream = stream.filter((item) =>
    auditFilter === 'ALL' ? true : item.category === auditFilter
  );

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white shadow-xs overflow-hidden transition-all">
      {/* Top Health Status Bar */}
      <div className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left: Overall Health Summary */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
            <Activity className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-neutral-900">Platform System Health</span>
              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                100% OPERATIONAL
              </span>
            </div>
            <p className="text-[11px] text-neutral-500">
              Zero downtime • Authoritative database RPCs & gateway webhooks
            </p>
          </div>
        </div>

        {/* Center: Real-time Infrastructure Micro-badges */}
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          {/* PostgreSQL DB */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-50 border border-neutral-200">
            <Database className="w-3.5 h-3.5 text-neutral-600" />
            <span className="text-neutral-500 font-medium">Supabase DB:</span>
            <span className="font-semibold text-emerald-700 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> 34ms
            </span>
          </div>

          {/* Paystack Webhook */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-50 border border-neutral-200">
            <CreditCard className="w-3.5 h-3.5 text-neutral-600" />
            <span className="text-neutral-500 font-medium">Paystack Webhooks:</span>
            <span className="font-semibold text-emerald-700 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> TLS 1.3 Active
            </span>
          </div>

          {/* Settlement Cron */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-50 border border-neutral-200">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-neutral-500 font-medium">Settlement Cron:</span>
            <span className="font-semibold text-emerald-700 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Syncing
            </span>
          </div>

          {/* Storage CDN */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-50 border border-neutral-200">
            <HardDrive className="w-3.5 h-3.5 text-neutral-600" />
            <span className="text-neutral-500 font-medium">Asset CDN:</span>
            <span className="font-semibold text-neutral-800">Edge Cached</span>
          </div>
        </div>

        {/* Right: Drawer Toggle & Refresh */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="p-1.5 rounded-lg border border-neutral-200 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-50 transition-colors"
              title="Ping all platform endpoints"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-primary' : ''}`} />
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsStreamOpen(!isStreamOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-neutral-900 text-white hover:bg-neutral-800 transition-colors shadow-xs"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Audit Activity</span>
            {isStreamOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expandable Live Audit Trail Drawer */}
      {isStreamOpen && (
        <div className="border-t border-neutral-200 bg-neutral-50/70 p-4 sm:p-5 space-y-4 animate-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-800">
                Live Forensic Audit Feed
              </h4>
              <p className="text-[11px] text-neutral-500">
                Append-only event stream tracking transactions, state mutations, and courier handoffs
              </p>
            </div>

            {/* Filter buttons */}
            <div className="flex items-center gap-1 p-0.5 bg-neutral-200/60 rounded-lg text-[10px] font-bold">
              {['ALL', 'FINANCIAL', 'DISPATCH', 'MERCHANT', 'SECURITY'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setAuditFilter(cat)}
                  className={`px-2 py-1 rounded-md transition-all ${
                    auditFilter === cat
                      ? 'bg-white text-neutral-900 shadow-xs'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {filteredStream.map((item) => {
              const badgeColors = {
                FINANCIAL: 'bg-emerald-100 text-emerald-800 border-emerald-200',
                DISPATCH: 'bg-blue-100 text-blue-800 border-blue-200',
                MERCHANT: 'bg-purple-100 text-purple-800 border-purple-200',
                SECURITY: 'bg-amber-100 text-amber-800 border-amber-200',
              }[item.category];

              return (
                <div
                  key={item.id}
                  className="p-2.5 rounded-xl bg-white border border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-start sm:items-center gap-2 min-w-0">
                    <span
                      className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border uppercase shrink-0 ${badgeColors}`}
                    >
                      {item.category}
                    </span>
                    <span className="font-semibold text-neutral-800 shrink-0">{item.actor}:</span>
                    <span className="text-neutral-600 truncate">{item.event}</span>
                  </div>

                  <div className="flex items-center gap-1 text-[10px] text-neutral-400 shrink-0 self-end sm:self-auto font-mono">
                    <Clock className="w-3 h-3" />
                    <span>{item.timestamp}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
