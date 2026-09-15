import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  getAllRiders,
  toggleRiderVerified,
  toggleRiderActive,
} from '../../services/supabase/admin';
import type { AdminRiderRow } from '../../types/admin';
import {
  Bike,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Truck,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { DirectOnboardRiderModal } from '@/components/admin/onboarding/direct-onboard-rider-modal';

export const AdminRidersPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [riders, setRiders] = useState<AdminRiderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOnboardModalOpen, setIsOnboardModalOpen] = useState(
    searchParams.get('action') === 'onboard' || searchParams.get('action') === 'new'
  );

  // Filters
  const [search, setSearch] = useState('');
  const [verifiedFilter, setVerifiedFilter] = useState<boolean | undefined>(undefined);
  const [activeFilter, setActiveFilter] = useState<boolean | undefined>(undefined);
  const [availableFilter, setAvailableFilter] = useState<boolean | undefined>(undefined);

  const loadRiders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getAllRiders({
        isVerified: verifiedFilter,
        isAvailable: availableFilter,
      });
      const rows = ((res.data || []) as unknown as any[]).map((r) => {
        const prof = r.profiles || {};
        const v = Array.isArray(r.vehicles) ? r.vehicles[0] : (r.vehicles || r.vehicle);
        return {
          ...r,
          full_name: r.full_name || prof.full_name || 'Courier Rider',
          phone: r.phone || r.phone_number || prof.phone || null,
          phone_number: r.phone_number || r.phone || prof.phone || null,
          vehicle: r.vehicle || (v ? { ...v, plate_number: v.license_plate || v.plate_number } : null),
        };
      });
      setRiders(rows as unknown as AdminRiderRow[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to query rider roster');
    } finally {
      setLoading(false);
    }
  }, [verifiedFilter, availableFilter]);

  useEffect(() => {
    loadRiders();
  }, [loadRiders]);

  const handleToggleVerified = async (riderId: string, currentStatus: boolean) => {
    try {
      setActionId(riderId);
      await toggleRiderVerified(riderId, !currentStatus);
      setRiders((prev) =>
        prev.map((r) => (r.id === riderId ? { ...r, is_verified: !currentStatus } : r))
      );
    } catch (err: unknown) {
      alert(`Verification toggle failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setActionId(null);
    }
  };

  const handleToggleActive = async (riderId: string, currentStatus: boolean) => {
    try {
      setActionId(riderId);
      await toggleRiderActive(riderId, !currentStatus);
      setRiders((prev) =>
        prev.map((r) => (r.id === riderId ? { ...r, is_active: !currentStatus } : r))
      );
    } catch (err: unknown) {
      alert(`Status toggle failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setActionId(null);
    }
  };

  const filteredRiders = riders.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.full_name?.toLowerCase().includes(q) ||
      (r.phone_number || r.phone)?.toLowerCase().includes(q) ||
      r.vehicle?.plate_number?.toLowerCase().includes(q) ||
      (r as any).profiles?.full_name?.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-border shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Bike className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Courier Fleet Directory</h2>
            <p className="text-xs text-text-secondary">
              {riders.length} registered couriers • Authoritative vehicle & verification status
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsOnboardModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-primary hover:bg-primary-hover rounded-xl transition-colors shadow-xs cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Onboard New Rider</span>
          </button>
          <button
            type="button"
            onClick={loadRiders}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-text-secondary bg-white hover:bg-light-surface rounded-xl transition-colors border border-border shadow-xs cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-primary' : ''}`} />
            <span>Reload Fleet</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search name, phone, plate..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white border border-border rounded-xl text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-xs"
          />
        </div>

        <div className="relative">
          <Filter className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <select
            value={verifiedFilter === undefined ? '' : String(verifiedFilter)}
            onChange={(e) => {
              const v = e.target.value;
              setVerifiedFilter(v === '' ? undefined : v === 'true');
            }}
            className="w-full pl-9 pr-3 py-2 bg-white border border-border rounded-xl text-xs text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-xs"
          >
            <option value="">All Verification States</option>
            <option value="true">Verified Couriers Only</option>
            <option value="false">Unverified Couriers Only</option>
          </select>
        </div>

        <select
          value={activeFilter === undefined ? '' : String(activeFilter)}
          onChange={(e) => {
            const v = e.target.value;
            setActiveFilter(v === '' ? undefined : v === 'true');
          }}
          className="w-full px-3 py-2 bg-white border border-border rounded-xl text-xs text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-xs"
        >
          <option value="">All Active States</option>
          <option value="true">Active Couriers</option>
          <option value="false">Suspended Couriers</option>
        </select>

        <select
          value={availableFilter === undefined ? '' : String(availableFilter)}
          onChange={(e) => {
            const v = e.target.value;
            setAvailableFilter(v === '' ? undefined : v === 'true');
          }}
          className="w-full px-3 py-2 bg-white border border-border rounded-xl text-xs text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-xs"
        >
          <option value="">All Availability</option>
          <option value="true">Online / Available</option>
          <option value="false">Offline</option>
        </select>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-3 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-primary" />
          <span>{error}</span>
        </div>
      )}

      {/* Roster Table */}
      <div className="rounded-2xl bg-white border border-border overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-text-secondary">
            <thead className="bg-light-surface/80 text-text-secondary font-semibold uppercase tracking-wider border-b border-border text-[11px]">
              <tr>
                <th className="px-4 py-3">Rider Name</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Assigned Vehicle</th>
                <th className="px-4 py-3">Verification</th>
                <th className="px-4 py-3">Availability</th>
                <th className="px-4 py-3">Active State</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-text-muted">
                    <div className="inline-flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                      <span>Loading fleet roster...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredRiders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-text-muted">
                    No riders found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredRiders.map((rider) => (
                  <tr key={rider.id} className="hover:bg-light-surface/60 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-text-primary">
                        {rider.full_name || (rider as any).profiles?.full_name || 'Courier Rider'}
                      </div>
                      <div className="text-[10px] text-text-muted font-mono">{rider.id}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-text-secondary">
                      {rider.phone_number || rider.phone || (rider as any).profiles?.phone || '—'}
                    </td>
                    <td className="px-4 py-3">
                      {rider.vehicle ? (
                        <div className="flex items-center gap-1.5">
                          <Truck className="w-3.5 h-3.5 text-text-muted" />
                          <div>
                            <span className="font-medium text-text-primary capitalize">
                              {rider.vehicle.vehicle_type}
                            </span>
                            {rider.vehicle.plate_number && (
                              <span className="ml-1.5 px-1.5 py-0.5 rounded bg-light-surface text-[10px] font-mono text-text-secondary border border-border">
                                {rider.vehicle.plate_number}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-text-muted italic">No vehicle bound</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {rider.is_verified ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Pending Review
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {rider.is_available ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          Online
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[11px] text-text-muted">
                          <span className="w-2 h-2 rounded-full bg-slate-300" />
                          Offline
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {rider.is_active ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-primary font-semibold">
                          <XCircle className="w-3.5 h-3.5" />
                          Suspended
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={actionId === rider.id}
                          onClick={() => handleToggleVerified(rider.id, rider.is_verified)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors disabled:opacity-50 ${
                            rider.is_verified
                              ? 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 shadow-xs'
                              : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 shadow-xs'
                          }`}
                        >
                          {rider.is_verified ? 'Unverify' : 'Verify'}
                        </button>
                        <button
                          type="button"
                          disabled={actionId === rider.id}
                          onClick={() => handleToggleActive(rider.id, rider.is_active)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors disabled:opacity-50 ${
                            rider.is_active
                              ? 'bg-rose-50 text-primary hover:bg-rose-100 border border-rose-200 shadow-xs'
                              : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 shadow-xs'
                          }`}
                        >
                          {rider.is_active ? 'Suspend' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Direct Onboard Rider Modal */}
      <DirectOnboardRiderModal
        isOpen={isOnboardModalOpen}
        onClose={() => setIsOnboardModalOpen(false)}
        onSuccess={() => {
          loadRiders();
        }}
      />
    </div>
  );
};

export default AdminRidersPage;
