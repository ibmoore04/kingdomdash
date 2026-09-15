import React, { useState, useEffect, useCallback } from 'react';
import {
  getPricingRules,
  savePricingRule,
  togglePricingRuleActive,
} from '../../services/supabase/admin';
import type { DeliveryPricingRuleRow } from '../../types/admin';
import {
  DollarSign,
  Plus,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ShieldAlert,
} from 'lucide-react';

export const AdminPricingPage: React.FC = () => {
  const [rules, setRules] = useState<DeliveryPricingRuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [serviceType, setServiceType] = useState<'food' | 'grocery' | 'courier'>('food');
  const [baseFee, setBaseFee] = useState(500);
  const [perKmFee, setPerKmFee] = useState(100);
  const [minFee, setMinFee] = useState(500);
  const [surgeMult, setSurgeMult] = useState(1.0);
  const [saving, setSaving] = useState(false);

  const loadRules = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getPricingRules();
      setRules((res.data || []) as unknown as DeliveryPricingRuleRow[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load pricing rules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await savePricingRule({
        service_type: serviceType,
        base_fee: Number(baseFee),
        distance_rate: Number(perKmFee),
        min_fee: Number(minFee),
        is_active: true,
      });
      setIsModalOpen(false);
      loadRules();
    } catch (err: unknown) {
      alert(`Failed to save pricing rule: ${err instanceof Error ? err.message : 'Unknown'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleRule = async (id: string, current: boolean) => {
    try {
      await togglePricingRuleActive(id, !current);
      setRules((prev) =>
        prev.map((r) => (r.id === id ? { ...r, is_active: !current } : r))
      );
    } catch (err: unknown) {
      alert(`Toggle failed: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-border shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Server-Authoritative Pricing Rules</h2>
            <p className="text-xs text-text-secondary">
              Authoritative formula: <code className="text-primary font-mono">GREATEST(min_fee, (base_fee + dist_km * per_km_fee) * surge)</code>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-primary hover:bg-primary-hover rounded-xl transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Pricing Tier</span>
          </button>
          <button
            type="button"
            onClick={loadRules}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-text-secondary bg-light-surface hover:bg-slate-100 rounded-xl transition-colors border border-border"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Reload</span>
          </button>
        </div>
      </div>

      {/* Immutability & Audit Guarantee Notice */}
      <div className="p-4 rounded-xl bg-light-surface border border-border text-xs text-text-secondary space-y-1">
        <div className="font-semibold text-text-primary flex items-center gap-1.5">
          <ShieldAlert className="w-4 h-4 text-primary" />
          <span>Historical Financial Immutability & Audit Trigger</span>
        </div>
        <p className="text-text-secondary">
          Modifying active pricing tiers only affects newly calculated checkouts. All historical orders retain immutable financial snapshots.
          Every configuration change is automatically recorded in <code className="text-primary font-mono">public.audit_logs</code> via migration 024.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-primary flex items-center gap-3 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-primary" />
          <span>{error}</span>
        </div>
      )}

      {/* Rules Table */}
      <div className="rounded-2xl bg-white border border-border shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs text-text-secondary">
            <thead className="bg-light-surface/80 text-text-secondary font-semibold uppercase tracking-wider border-b border-border text-[11px]">
              <tr>
                <th className="px-4 py-3">Service Type</th>
                <th className="px-4 py-3">Base Fee</th>
                <th className="px-4 py-3">Per KM Fee</th>
                <th className="px-4 py-3">Minimum Fee</th>
                <th className="px-4 py-3">Surge Multiplier</th>
                <th className="px-4 py-3">Active</th>
                <th className="px-4 py-3 text-right">Toggle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-text-muted">
                    <RefreshCw className="w-4 h-4 animate-spin text-primary mx-auto mb-1" />
                    Loading pricing rules...
                  </td>
                </tr>
              ) : rules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-text-muted">
                    No pricing rules registered in database.
                  </td>
                </tr>
              ) : (
                rules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-light-surface/60 transition-colors">
                    <td className="px-4 py-3 font-semibold text-text-primary uppercase">
                      {rule.service_type}
                    </td>
                    <td className="px-4 py-3 font-mono text-text-primary font-semibold">
                      ₦{Number(rule.base_fee).toLocaleString('en-NG')}
                    </td>
                    <td className="px-4 py-3 font-mono text-text-primary font-semibold">
                      ₦{Number(rule.per_km_fee).toLocaleString('en-NG')}
                    </td>
                    <td className="px-4 py-3 font-mono text-text-secondary">
                      ₦{Number(rule.min_fee).toLocaleString('en-NG')}
                    </td>
                    <td className="px-4 py-3 font-mono text-amber-600 font-semibold">
                      {Number(rule.surge_multiplier).toFixed(2)}x
                    </td>
                    <td className="px-4 py-3">
                      {rule.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-light-surface text-text-muted border border-border">
                          <XCircle className="w-3 h-3" />
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleToggleRule(rule.id, rule.is_active)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                          rule.is_active
                            ? 'bg-rose-50 text-primary hover:bg-rose-100 border border-rose-200'
                            : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                        }`}
                      >
                        {rule.is_active ? 'Disable' : 'Enable'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Rule Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white border border-border rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-text-primary">Create Authoritative Pricing Tier</h3>
            <form onSubmit={handleCreateRule} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1">
                  Target Service Type
                </label>
                <select
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value as 'food' | 'grocery' | 'courier')}
                  className="w-full p-2.5 bg-white border border-border rounded-xl text-xs text-text-primary focus:outline-hidden focus:border-primary shadow-xs capitalize"
                >
                  <option value="food">Food Delivery</option>
                  <option value="grocery">Grocery Delivery</option>
                  <option value="courier">Courier Dispatch</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    Base Fee (₦)
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={baseFee}
                    onChange={(e) => setBaseFee(Number(e.target.value))}
                    className="w-full p-2 bg-white border border-border rounded-xl text-xs text-text-primary font-mono focus:outline-hidden focus:border-primary shadow-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    Per KM Fee (₦)
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={perKmFee}
                    onChange={(e) => setPerKmFee(Number(e.target.value))}
                    className="w-full p-2 bg-white border border-border rounded-xl text-xs text-text-primary font-mono focus:outline-hidden focus:border-primary shadow-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    Minimum Fee (₦)
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={minFee}
                    onChange={(e) => setMinFee(Number(e.target.value))}
                    className="w-full p-2 bg-white border border-border rounded-xl text-xs text-text-primary font-mono focus:outline-hidden focus:border-primary shadow-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    Surge Multiplier
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="1.0"
                    max="5.0"
                    required
                    value={surgeMult}
                    onChange={(e) => setSurgeMult(Number(e.target.value))}
                    className="w-full p-2 bg-white border border-border rounded-xl text-xs text-text-primary font-mono focus:outline-hidden focus:border-primary shadow-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold text-white bg-primary hover:bg-primary-hover rounded-xl transition-colors disabled:opacity-50 shadow-xs"
                >
                  {saving ? 'Registering...' : 'Save Pricing Tier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPricingPage;
