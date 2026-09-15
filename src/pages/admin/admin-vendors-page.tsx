import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getAllVendors, toggleVendorActive } from '../../services/supabase/admin';
import { setVendorServices } from '../../services/supabase/vendors';
import type { AdminVendorRow } from '../../types/admin';
import {
  Store,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  MapPin,
  Phone,
  UserPlus,
} from 'lucide-react';
import { DirectOnboardVendorModal } from '@/components/admin/onboarding/direct-onboard-vendor-modal';

export const AdminVendorsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [vendors, setVendors] = useState<AdminVendorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOnboardModalOpen, setIsOnboardModalOpen] = useState(
    searchParams.get('action') === 'onboard' || searchParams.get('action') === 'new'
  );

  // Manage services modal state
  const [managingVendor, setManagingVendor] = useState<AdminVendorRow | null>(null);
  const [editServices, setEditServices] = useState<('food' | 'grocery')[]>([]);
  const [serviceSaving, setServiceSaving] = useState(false);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState<boolean | undefined>(undefined);

  const loadVendors = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getAllVendors({
        businessType: typeFilter || undefined,
      });
      const rows = ((res.data || []) as unknown as Array<AdminVendorRow & { vendor_services?: Array<{ service_type: string; is_active: boolean }> }>).map((v) => {
        const activeServices = (v.vendor_services || [])
          .filter((s) => s.is_active)
          .map((s) => s.service_type as 'food' | 'grocery');
        const fallback: ('food' | 'grocery')[] = v.business_type === 'restaurant' ? ['food'] : ['grocery'];
        const address = v.business_address || v.address || '';
        const phone = v.phone || v.phone_number || '';
        return {
          ...v,
          address,
          business_address: address,
          phone,
          phone_number: phone,
          services: activeServices.length > 0 ? activeServices : fallback,
        };
      });
      setVendors(rows);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to query vendors');
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => {
    loadVendors();
  }, [loadVendors]);

  const handleToggleActive = async (vendorId: string, currentStatus: boolean) => {
    try {
      setActionId(vendorId);
      await toggleVendorActive(vendorId, !currentStatus);
      setVendors((prev) =>
        prev.map((v) => (v.id === vendorId ? { ...v, is_active: !currentStatus } : v))
      );
    } catch (err: unknown) {
      alert(`Vendor status toggle failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setActionId(null);
    }
  };

  const openServiceModal = (v: AdminVendorRow) => {
    setManagingVendor(v);
    setEditServices(((v as unknown as { services?: ('food' | 'grocery')[] }).services) || ['food']);
  };

  const toggleEditService = (srv: 'food' | 'grocery') => {
    setEditServices((prev) => {
      if (prev.includes(srv)) {
        return prev.filter((s) => s !== srv);
      }
      return [...prev, srv];
    });
  };

  const handleSaveServices = async () => {
    if (!managingVendor) return;
    if (editServices.length === 0) {
      alert('Select at least one active marketplace service (Food or Grocery).');
      return;
    }
    try {
      setServiceSaving(true);
      const res = await setVendorServices(managingVendor.id, editServices);
      if (res.error) {
        alert(`Failed to update services: ${res.error.message || 'Unknown error'}`);
        return;
      }
      setVendors((prev) =>
        prev.map((v) =>
          v.id === managingVendor.id
            ? { ...v, services: editServices } as unknown as AdminVendorRow
            : v
        )
      );
      setManagingVendor(null);
    } catch (err: unknown) {
      alert(`Failed to update services: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setServiceSaving(false);
    }
  };


  const filteredVendors = vendors.filter((v) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      v.business_name?.toLowerCase().includes(q) ||
      (v.business_address || v.address)?.toLowerCase().includes(q) ||
      (v.phone || v.phone_number)?.toLowerCase().includes(q) ||
      (v.email || v.owner_email)?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-border shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Merchant Directory</h2>
            <p className="text-xs text-text-secondary">
              {vendors.length} registered restaurant & grocery storefronts
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
            <span>Onboard New Vendor</span>
          </button>
          <button
            type="button"
            onClick={loadVendors}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-text-secondary bg-white hover:bg-light-surface rounded-xl transition-colors border border-border shadow-xs cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-primary' : ''}`} />
            <span>Reload Stores</span>
          </button>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search store name, address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white border border-border rounded-xl text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-xs"
          />
        </div>

        <div className="relative">
          <Filter className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white border border-border rounded-xl text-xs text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary capitalize shadow-xs"
          >
            <option value="">All Business Types</option>
            <option value="restaurant">Restaurant</option>
            <option value="grocery">Grocery Store</option>
            <option value="pharmacy">Pharmacy</option>
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
          <option value="">All Store Statuses</option>
          <option value="true">Active & Visible Stores</option>
          <option value="false">Suspended Stores</option>
        </select>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-3 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-primary" />
          <span>{error}</span>
        </div>
      )}

      {/* Vendors Table */}
      <div className="rounded-2xl bg-white border border-border overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-text-secondary">
            <thead className="bg-light-surface/80 text-text-secondary font-semibold uppercase tracking-wider border-b border-border text-[11px]">
              <tr>
                <th className="px-4 py-3">Store / Brand</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                    <div className="inline-flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                      <span>Loading vendors...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredVendors.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                    No vendors found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredVendors.map((vendor) => (
                  <tr key={vendor.id} className="hover:bg-light-surface/60 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-text-primary">{vendor.business_name}</div>
                      <div className="text-[10px] text-text-muted font-mono">{vendor.id}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1">
                        {vendor.services && vendor.services.length > 0 ? (
                          vendor.services.map((srv) => (
                            <span
                              key={srv}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                                srv === 'food'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              }`}
                            >
                              {srv}
                            </span>
                          ))
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-light-surface text-text-secondary border border-border">
                            {vendor.business_type}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-text-muted shrink-0" />
                        <span className="truncate max-w-[200px]">
                          {vendor.business_address || vendor.address || '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-text-secondary">
                      <div className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-text-muted shrink-0" />
                        <span>
                          {vendor.phone || vendor.phone_number || (vendor as any).profiles?.phone || '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {vendor.is_active ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
                          <XCircle className="w-3.5 h-3.5" />
                          Suspended
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openServiceModal(vendor)}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-light-surface text-text-secondary hover:text-text-primary hover:bg-slate-100 border border-border transition-colors shadow-xs"
                        >
                          Services
                        </button>
                        <button
                          type="button"
                          disabled={actionId === vendor.id}
                          onClick={() => handleToggleActive(vendor.id, vendor.is_active)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-50 ${
                            vendor.is_active
                              ? 'bg-rose-50 text-primary hover:bg-rose-100 border border-rose-200 shadow-xs'
                              : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 shadow-xs'
                          }`}
                        >
                          {actionId === vendor.id
                            ? 'Updating...'
                            : vendor.is_active
                            ? 'Suspend Store'
                            : 'Activate Store'}
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

      {/* Manage Services Modal */}
      {managingVendor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white border border-border rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center gap-3 border-b border-border pb-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <Store className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text-primary">Manage Store Services</h3>
                <p className="text-xs text-text-secondary">{managingVendor.business_name}</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-text-secondary">
                Configure which marketplace domains this vendor is permitted to operate in.
              </p>

              <div className="space-y-2 pt-1">
                <label className="flex items-start gap-3 p-3 rounded-xl border border-border hover:bg-light-surface/60 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={editServices.includes('food')}
                    onChange={() => toggleEditService('food')}
                    className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <div>
                    <span className="font-semibold text-text-primary block">Food Delivery</span>
                    <span className="text-[11px] text-text-secondary block">
                      Enables listing restaurant meals in the Food marketplace.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-xl border border-border hover:bg-light-surface/60 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={editServices.includes('grocery')}
                    onChange={() => toggleEditService('grocery')}
                    className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <div>
                    <span className="font-semibold text-text-primary block">Grocery Delivery</span>
                    <span className="text-[11px] text-text-secondary block">
                      Enables listing supermarket goods in the Grocery marketplace.
                    </span>
                  </div>
                </label>
              </div>

              {editServices.length === 0 && (
                <p className="text-[11px] text-primary font-semibold flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  At least one marketplace service must be active.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setManagingVendor(null)}
                className="px-3.5 py-2 text-xs text-text-secondary hover:text-text-primary rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={serviceSaving || editServices.length === 0}
                onClick={handleSaveServices}
                className="px-4 py-2 text-xs font-semibold text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors disabled:opacity-50 shadow-xs"
              >
                {serviceSaving ? 'Saving...' : 'Save Services'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Direct Onboard Vendor Modal */}
      <DirectOnboardVendorModal
        isOpen={isOnboardModalOpen}
        onClose={() => setIsOnboardModalOpen(false)}
        onSuccess={() => {
          loadVendors();
        }}
      />
    </div>
  );
};

export default AdminVendorsPage;
