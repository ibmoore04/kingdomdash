import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import {
  getPendingVendorApplications,
  approveVendorApplication,
  rejectVendorApplication,
} from '../../services/supabase/admin';
import type { VendorApplication } from '../../types/admin';
import {
  FileCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Eye,
  Store,
  MapPin,
  Mail,
  Phone,
  Plus,
} from 'lucide-react';
import { DirectOnboardVendorModal } from '@/components/admin/onboarding/direct-onboard-vendor-modal';

function formatDateSafe(val?: string | null): string {
  if (!val) return 'Recently';
  const d = new Date(val);
  return isNaN(d.getTime()) ? 'Recently' : d.toLocaleDateString();
}

function getAppContactPhone(app: VendorApplication): string {
  return app.phone || app.phone_number || app.profile?.phone || '—';
}

function getAppContactEmail(app: VendorApplication): string {
  return app.email || app.owner_email || app.profile?.email || '—';
}

function getAppAddress(app: VendorApplication): string {
  return app.business_address || app.address || '—';
}

function getAppDate(app: VendorApplication): string {
  return formatDateSafe(app.submitted_at || app.created_at);
}

export const AdminVendorApplicationsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [applications, setApplications] = useState<VendorApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOnboardModalOpen, setIsOnboardModalOpen] = useState(
    searchParams.get('action') === 'onboard' || searchParams.get('action') === 'new'
  );

  // Approval modal with multi-service configuration
  const [approvingApp, setApprovingApp] = useState<VendorApplication | null>(null);
  const [selectedServices, setSelectedServices] = useState<('food' | 'grocery')[]>(['food']);

  // Rejection modal
  const [selectedApp, setSelectedApp] = useState<VendorApplication | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);

  // Detail drawer
  const [detailApp, setDetailApp] = useState<VendorApplication | null>(null);

  const loadApplications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getPendingVendorApplications();
      setApplications((res.data || []) as unknown as VendorApplication[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to query vendor applications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

  const openApprovalModal = (app: VendorApplication) => {
    let initial: ('food' | 'grocery')[] = ['food'];
    if (app.service_types && app.service_types.length > 0) {
      initial = app.service_types as ('food' | 'grocery')[];
    } else if (app.business_type === 'grocery_store') {
      initial = ['grocery'];
    }
    setSelectedServices(initial);
    setApprovingApp(app);
  };

  const toggleServiceChoice = (service: 'food' | 'grocery') => {
    setSelectedServices((prev) => {
      if (prev.includes(service)) {
        return prev.filter((s) => s !== service);
      }
      return [...prev, service];
    });
  };

  const handleConfirmApprove = async () => {
    if (!approvingApp) return;
    if (selectedServices.length === 0) {
      alert('Please select at least one service capability (Food or Grocery).');
      return;
    }
    try {
      setActionLoading(approvingApp.id);
      const res = await approveVendorApplication(approvingApp.id, selectedServices);
      if (res.error) {
        alert(`Approval failed: ${res.error.message || 'Unknown error'}`);
        return;
      }
      setApplications((prev) => prev.filter((a) => a.id !== approvingApp.id));
      setApprovingApp(null);
      if (detailApp?.id === approvingApp.id) setDetailApp(null);
    } catch (err: unknown) {
      alert(`Approval failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleConfirmReject = async () => {
    if (!selectedApp) return;
    if (!rejectReason.trim()) {
      alert('Please specify a rejection reason.');
      return;
    }

    try {
      setActionLoading(selectedApp.id);
      await rejectVendorApplication(selectedApp.id, rejectReason.trim());
      setApplications((prev) => prev.filter((a) => a.id !== selectedApp.id));
      setIsRejectModalOpen(false);
      setSelectedApp(null);
      setRejectReason('');
      if (detailApp?.id === selectedApp.id) setDetailApp(null);
    } catch (err: unknown) {
      alert(`Rejection failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-border shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <FileCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Vendor Onboarding Applications</h2>
            <p className="text-xs text-text-secondary">
              {applications.length} pending merchant candidate reviews
            </p>
          </div>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsOnboardModalOpen(true)}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-primary hover:bg-primary-hover rounded-xl transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Direct Onboard Vendor</span>
          </button>
          <button
            type="button"
            onClick={loadApplications}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-text-secondary bg-white hover:bg-light-surface rounded-xl transition-colors border border-border shadow-xs cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-primary' : ''}`} />
            <span>Refresh Queue</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-3 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-primary" />
          <span>{error}</span>
        </div>
      )}

      {/* Applications Content */}
      {loading ? (
        <div className="rounded-2xl bg-white border border-border p-12 text-center text-text-muted shadow-xs">
          <div className="inline-flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-primary" />
            <span className="text-xs font-medium">Loading pending vendor applications...</span>
          </div>
        </div>
      ) : applications.length === 0 ? (
        <div className="rounded-2xl bg-white border border-border p-6 sm:p-10 text-center shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mx-auto mb-3">
            <Store className="w-6 h-6" />
          </div>
          <h3 className="font-semibold text-text-primary text-sm sm:text-base">No pending vendor applications in queue</h3>
          <p className="text-xs text-text-secondary mt-1 max-w-md mx-auto leading-relaxed">
            All applicant records have been reviewed. You can directly create and onboard a merchant partner into the live catalog below.
          </p>
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => setIsOnboardModalOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-primary hover:bg-primary-hover rounded-xl transition-colors shadow-xs cursor-pointer w-full sm:w-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Direct Onboard Vendor Now</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Mobile Card List (md:hidden) */}
          <div className="md:hidden space-y-3">
            {applications.map((app) => (
              <div key={app.id} className="p-4 rounded-2xl bg-white border border-border shadow-xs space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-text-primary truncate">{app.business_name}</h4>
                    <p className="text-[10px] font-mono text-text-muted truncate">{app.id}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1 shrink-0">
                    {(app.service_types && app.service_types.length > 0
                      ? app.service_types
                      : [app.business_type === 'restaurant' ? 'food' : 'grocery']
                    ).map((srv) => (
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
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-border/60">
                  <div>
                    <span className="text-[10px] text-text-muted uppercase tracking-wider block">Contact</span>
                    <span className="font-mono text-text-secondary truncate block">{getAppContactPhone(app)}</span>
                    <span className="text-[10px] text-text-muted truncate block">{getAppContactEmail(app)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-text-muted uppercase tracking-wider block">Address</span>
                    <span className="text-text-secondary truncate block">{getAppAddress(app)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-text-muted">
                    {getAppDate(app)}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setDetailApp(app)}
                      className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-page-background transition-colors cursor-pointer"
                      title="View Application Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading === app.id}
                      onClick={() => openApprovalModal(app)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Approve</span>
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading === app.id}
                      onClick={() => {
                        setSelectedApp(app);
                        setIsRejectModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-rose-50 text-primary hover:bg-rose-100 border border-rose-200 shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View (hidden md:block) */}
          <div className="hidden md:block rounded-2xl bg-white border border-border overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-text-secondary">
                <thead className="bg-light-surface/80 text-text-secondary font-semibold uppercase tracking-wider border-b border-border text-[11px]">
                  <tr>
                    <th className="px-4 py-3">Store Name</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">Address</th>
                    <th className="px-4 py-3">Submitted</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {applications.map((app) => (
                    <tr key={app.id} className="hover:bg-light-surface/60 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-text-primary">{app.business_name}</div>
                        <div className="text-[10px] text-text-muted font-mono">{app.id}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1">
                          {(app.service_types && app.service_types.length > 0
                            ? app.service_types
                            : [app.business_type === 'restaurant' ? 'food' : 'grocery']
                          ).map((srv) => (
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
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-text-secondary">
                        <div>{getAppContactPhone(app)}</div>
                        <div className="text-[10px] text-text-muted">{getAppContactEmail(app)}</div>
                      </td>
                      <td className="px-4 py-3 text-text-secondary max-w-[200px] truncate">
                        {getAppAddress(app)}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {getAppDate(app)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setDetailApp(app)}
                            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-page-background transition-colors cursor-pointer"
                            title="View Application Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            disabled={actionLoading === app.id}
                            onClick={() => openApprovalModal(app)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Approve</span>
                          </button>
                          <button
                            type="button"
                            disabled={actionLoading === app.id}
                            onClick={() => {
                              setSelectedApp(app);
                              setIsRejectModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-rose-50 text-primary hover:bg-rose-100 border border-rose-200 shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Details modal */}
      {detailApp && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-border rounded-2xl max-w-lg w-full p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <Store className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text-primary">Merchant Application Dossier</h3>
                  <p className="text-xs text-text-secondary font-mono">{detailApp.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailApp(null)}
                className="text-text-muted hover:text-text-primary text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4 p-3 rounded-xl bg-light-surface border border-border">
                <div>
                  <span className="text-text-secondary">Trading Name</span>
                  <p className="font-semibold text-text-primary mt-0.5">{detailApp.business_name}</p>
                </div>
                <div>
                  <span className="text-text-secondary">Requested Services</span>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {(detailApp.service_types && detailApp.service_types.length > 0
                      ? detailApp.service_types
                      : [detailApp.business_type === 'restaurant' ? 'food' : 'grocery']
                    ).map((srv) => (
                      <span
                        key={srv}
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                          srv === 'food'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        {srv}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-text-secondary">Contact Phone</span>
                  <p className="font-mono text-text-primary mt-0.5 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-text-muted" />
                    {getAppContactPhone(detailApp)}
                  </p>
                </div>
                <div>
                  <span className="text-text-secondary">Owner Email</span>
                  <p className="text-text-secondary mt-0.5 flex items-center gap-1 truncate">
                    <Mail className="w-3 h-3 text-text-muted shrink-0" />
                    {getAppContactEmail(detailApp)}
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-light-surface border border-border">
                <span className="text-text-secondary">Physical Address</span>
                <p className="text-text-primary mt-0.5 flex items-start gap-1">
                  <MapPin className="w-3.5 h-3.5 text-text-muted shrink-0 mt-0.5" />
                  {getAppAddress(detailApp)}
                </p>
              </div>

              {(detailApp.business_description || detailApp.description) && (
                <div className="p-3 rounded-xl bg-light-surface border border-border">
                  <span className="text-text-secondary">Business Concept / Bio</span>
                  <p className="text-text-secondary mt-1 italic">{detailApp.business_description || detailApp.description}</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => setDetailApp(null)}
                className="px-4 py-2 text-xs font-semibold text-text-secondary hover:text-text-primary rounded-lg transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedApp(detailApp);
                  setIsRejectModalOpen(true);
                }}
                className="px-4 py-2 text-xs font-semibold text-primary bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors shadow-xs"
              >
                Reject...
              </button>
              <button
                type="button"
                onClick={() => openApprovalModal(detailApp)}
                className="px-4 py-2 text-xs font-semibold text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors shadow-xs"
              >
                Approve Merchant
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Multi-Service Vendor Approval Modal */}
      {approvingApp && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-border rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center gap-3 border-b border-border pb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text-primary">Approve Merchant & Assign Services</h3>
                <p className="text-xs text-text-secondary">
                  {approvingApp.business_name} • Authoritative multi-service capability configuration
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-text-secondary">
                Select marketplace capabilities to enable for this merchant. The selected services are persisted directly to <code className="px-1.5 py-0.5 rounded bg-light-surface text-text-primary font-mono text-[11px]">public.vendor_services</code>.
              </p>

              <div className="space-y-2.5 pt-1">
                {/* Food Option */}
                <label className="flex items-start gap-3 p-3.5 rounded-xl border border-border hover:bg-light-surface/60 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={selectedServices.includes('food')}
                    onChange={() => toggleServiceChoice('food')}
                    className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <div>
                    <span className="font-semibold text-text-primary block">Food Delivery Service</span>
                    <span className="text-[11px] text-text-secondary block mt-0.5">
                      Merchant appears in the Food marketplace. Allows selling restaurant meals and prepared dining menu items.
                    </span>
                  </div>
                </label>

                {/* Grocery Option */}
                <label className="flex items-start gap-3 p-3.5 rounded-xl border border-border hover:bg-light-surface/60 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={selectedServices.includes('grocery')}
                    onChange={() => toggleServiceChoice('grocery')}
                    className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <div>
                    <span className="font-semibold text-text-primary block">Grocery Delivery Service</span>
                    <span className="text-[11px] text-text-secondary block mt-0.5">
                      Merchant appears in the Grocery marketplace. Allows cataloging fresh produce, packaged foods, and household essentials.
                    </span>
                  </div>
                </label>
              </div>

              {/* Service Selection Summary Badge */}
              <div className="p-3 rounded-xl bg-light-surface/80 border border-border flex items-center justify-between">
                <span className="text-text-secondary font-medium">Resulting Service Domain:</span>
                <span className="font-bold text-text-primary uppercase tracking-wide text-[11px] px-2.5 py-0.5 rounded-full bg-white border border-border">
                  {selectedServices.includes('food') && selectedServices.includes('grocery')
                    ? 'Food + Grocery (Both Marketplaces)'
                    : selectedServices.includes('food')
                    ? 'Food Only'
                    : selectedServices.includes('grocery')
                    ? 'Grocery Only'
                    : 'None Selected (Invalid)'}
                </span>
              </div>

              {selectedServices.length === 0 && (
                <p className="text-[11px] text-primary font-semibold flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  At least one marketplace service must be selected.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setApprovingApp(null)}
                className="px-3.5 py-2 text-xs text-text-secondary hover:text-text-primary rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading === approvingApp.id || selectedServices.length === 0}
                onClick={handleConfirmApprove}
                className="px-4 py-2 text-xs font-semibold text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors disabled:opacity-50 shadow-xs"
              >
                {actionLoading === approvingApp.id ? 'Approving...' : 'Confirm & Approve Merchant'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Reject Modal */}
      {isRejectModalOpen && selectedApp && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-border rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-text-primary">Reject Merchant Application</h3>
            <p className="text-xs text-text-secondary">
              Specify rejection reason for <strong className="text-text-primary">{selectedApp.business_name}</strong>.
            </p>

            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Incomplete business address, missing food hygiene certificate, outside delivery zones..."
              className="w-full p-3 bg-white border border-border rounded-xl text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary shadow-xs"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading === selectedApp.id}
                onClick={handleConfirmReject}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors disabled:opacity-50 shadow-xs"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Direct Onboard Vendor Modal */}
      <DirectOnboardVendorModal
        isOpen={isOnboardModalOpen}
        onClose={() => setIsOnboardModalOpen(false)}
        onSuccess={() => {
          loadApplications();
        }}
      />
    </div>
  );
};

export default AdminVendorApplicationsPage;
