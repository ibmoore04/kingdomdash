import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  getPendingRiderApplications,
  approveRiderApplication,
  rejectRiderApplication,
} from '../../services/supabase/admin';
import type { RiderApplication } from '../../types/admin';
import {
  ClipboardList,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Eye,
  FileText,
  Truck,
  Shield,
  Phone,
  Plus,
  Bike,
} from 'lucide-react';
import { DirectOnboardRiderModal } from '@/components/admin/onboarding/direct-onboard-rider-modal';

function formatDateSafe(val?: string | null): string {
  if (!val) return 'Recently';
  const d = new Date(val);
  return isNaN(d.getTime()) ? 'Recently' : d.toLocaleDateString();
}

function getRiderContactPhone(app: RiderApplication): string {
  return app.phone || app.phone_number || app.profile?.phone || '—';
}

function getRiderDate(app: RiderApplication): string {
  return formatDateSafe(app.submitted_at || app.created_at);
}

export const AdminRiderApplicationsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [applications, setApplications] = useState<RiderApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOnboardModalOpen, setIsOnboardModalOpen] = useState(
    searchParams.get('action') === 'onboard' || searchParams.get('action') === 'new'
  );

  // Approval modal state
  const [approvingRiderApp, setApprovingRiderApp] = useState<RiderApplication | null>(null);

  // Rejection modal state
  const [selectedApp, setSelectedApp] = useState<RiderApplication | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);

  // Detail drawer
  const [detailApp, setDetailApp] = useState<RiderApplication | null>(null);

  const loadApplications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getPendingRiderApplications();
      setApplications((res.data || []) as unknown as RiderApplication[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to retrieve applications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

  const openApprovalModal = (app: RiderApplication) => {
    setApprovingRiderApp(app);
  };

  const handleConfirmApprove = async () => {
    if (!approvingRiderApp) return;
    try {
      setActionLoading(approvingRiderApp.id);
      const res = await approveRiderApplication(approvingRiderApp.id);
      if (res.error) {
        alert(`Approval failed: ${res.error.message || 'Unknown error'}`);
        return;
      }
      setApplications((prev) => prev.filter((a) => a.id !== approvingRiderApp.id));
      setApprovingRiderApp(null);
      if (detailApp?.id === approvingRiderApp.id) setDetailApp(null);
    } catch (err: unknown) {
      alert(`Approval failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleConfirmReject = async () => {
    if (!selectedApp) return;
    if (!rejectReason.trim()) {
      alert('Please specify a rejection reason for the applicant.');
      return;
    }

    try {
      setActionLoading(selectedApp.id);
      await rejectRiderApplication(selectedApp.id, rejectReason.trim());
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
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Rider Onboarding Applications</h2>
            <p className="text-xs text-text-secondary">
              {applications.length} pending candidate reviews • Authoritative approval RPC executes atomic role promotion
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
            <span>Direct Onboard Rider</span>
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
            <span className="text-xs font-medium">Loading pending applications...</span>
          </div>
        </div>
      ) : applications.length === 0 ? (
        <div className="rounded-2xl bg-white border border-border p-6 sm:p-10 text-center shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mx-auto mb-3">
            <Bike className="w-6 h-6" />
          </div>
          <h3 className="font-semibold text-text-primary text-sm sm:text-base">No pending rider applications in queue</h3>
          <p className="text-xs text-text-secondary mt-1 max-w-md mx-auto leading-relaxed">
            All courier candidate records have been vetted. You can directly create, assign vehicle, and onboard a new delivery rider below.
          </p>
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => setIsOnboardModalOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-primary hover:bg-primary-hover rounded-xl transition-colors shadow-xs cursor-pointer w-full sm:w-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Direct Onboard Rider Now</span>
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
                    <h4 className="text-sm font-semibold text-text-primary truncate">{app.full_name || 'Unnamed Applicant'}</h4>
                    <p className="text-[10px] font-mono text-text-muted truncate">{app.id}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-light-surface text-text-secondary border border-border shrink-0">
                    <Truck className="w-2.5 h-2.5 text-text-muted" />
                    {app.vehicle_type}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-border/60">
                  <div>
                    <span className="text-[10px] text-text-muted uppercase tracking-wider block">Phone</span>
                    <span className="font-mono text-text-secondary truncate block">{getRiderContactPhone(app)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-text-muted uppercase tracking-wider block">Plate / Details</span>
                    <span className="font-mono text-text-secondary truncate block">{app.plate_number || '—'}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-text-muted">
                    {getRiderDate(app)}
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
                    <th className="px-4 py-3">Applicant Name</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Vehicle Class</th>
                    <th className="px-4 py-3">Plate / Details</th>
                    <th className="px-4 py-3">Submitted</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {applications.map((app) => (
                    <tr key={app.id} className="hover:bg-light-surface/60 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-text-primary">{app.full_name || 'Unnamed Applicant'}</div>
                        <div className="text-[10px] text-text-muted font-mono">{app.id}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-text-secondary">{getRiderContactPhone(app)}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-light-surface text-text-secondary border border-border">
                          <Truck className="w-2.5 h-2.5 text-text-muted" />
                          {app.vehicle_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-text-secondary">{app.plate_number || '—'}</td>
                      <td className="px-4 py-3 text-text-secondary">
                        {getRiderDate(app)}
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

      {/* Details Modal / Drawer */}
      {detailApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white border border-border rounded-2xl max-w-lg w-full p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text-primary">Applicant Dossier</h3>
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
                  <span className="text-text-secondary">Full Legal Name</span>
                  <p className="font-semibold text-text-primary mt-0.5">{detailApp.full_name}</p>
                </div>
                <div>
                  <span className="text-text-secondary">Phone Contact</span>
                  <p className="font-mono text-text-primary mt-0.5 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-text-muted" />
                    {getRiderContactPhone(detailApp)}
                  </p>
                </div>
                <div>
                  <span className="text-text-secondary">Vehicle Type</span>
                  <p className="font-semibold text-text-primary uppercase mt-0.5">{detailApp.vehicle_type}</p>
                </div>
                <div>
                  <span className="text-text-secondary">Registration Plate</span>
                  <p className="font-mono text-text-primary mt-0.5">{detailApp.plate_number || 'N/A'}</p>
                </div>
              </div>

              {detailApp.vehicle_make && (
                <div className="p-3 rounded-xl bg-light-surface border border-border">
                  <span className="text-text-secondary">Vehicle Make / Model / Year</span>
                  <p className="font-medium text-text-primary mt-0.5">
                    {detailApp.vehicle_make} {detailApp.vehicle_model} ({detailApp.vehicle_year || 'Year N/A'})
                  </p>
                </div>
              )}

              {/* Documents */}
              <div className="space-y-2">
                <span className="text-text-secondary font-semibold uppercase tracking-wider text-[10px]">
                  Uploaded Compliance Documents
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {detailApp.license_number && (
                    <div className="p-2.5 rounded-lg bg-light-surface border border-border flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-text-muted">Driver License</span>
                        <div className="font-mono text-text-primary">{detailApp.license_number}</div>
                      </div>
                      <FileText className="w-4 h-4 text-text-muted" />
                    </div>
                  )}
                  {detailApp.license_url && (
                    <a
                      href={detailApp.license_url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2.5 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/20 flex items-center justify-between text-primary"
                    >
                      <span>View License Image</span>
                      <Eye className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
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
                Approve Candidate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rider Approval Modal */}
      {approvingRiderApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white border border-border rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center gap-3 border-b border-border pb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text-primary">Approve Courier Candidate</h3>
                <p className="text-xs text-text-secondary font-mono">{approvingRiderApp.id}</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-text-secondary">
                Confirm approval for this candidate. Authoritative database RPC will promote their profile role to <code className="px-1.5 py-0.5 rounded bg-light-surface text-text-primary font-mono text-[11px]">rider</code> and initialize their operational courier record.
              </p>

              <div className="p-3.5 rounded-xl bg-light-surface border border-border space-y-2">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Candidate Name:</span>
                  <span className="font-semibold text-text-primary">{approvingRiderApp.full_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Phone Number:</span>
                  <span className="font-mono text-text-primary">{approvingRiderApp.phone_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Vehicle Class:</span>
                  <span className="font-semibold text-text-primary capitalize">{approvingRiderApp.vehicle_type}</span>
                </div>
                {approvingRiderApp.plate_number && (
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Plate / Identification:</span>
                    <span className="font-mono text-text-primary uppercase">{approvingRiderApp.plate_number}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setApprovingRiderApp(null)}
                className="px-3.5 py-2 text-xs text-text-secondary hover:text-text-primary rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading === approvingRiderApp.id}
                onClick={handleConfirmApprove}
                className="px-4 py-2 text-xs font-semibold text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors disabled:opacity-50 shadow-xs"
              >
                {actionLoading === approvingRiderApp.id ? 'Approving...' : 'Confirm & Approve Rider'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {isRejectModalOpen && selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white border border-border rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-text-primary">Reject Rider Application</h3>
            <p className="text-xs text-text-secondary">
              Provide an authoritative rejection reason for <strong className="text-text-primary">{selectedApp.full_name}</strong>.
            </p>

            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Invalid driver's license documentation, unreadable photos, or vehicle age exceeds platform limits..."
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
        </div>
      )}

      {/* Direct Onboard Rider Modal */}
      <DirectOnboardRiderModal
        isOpen={isOnboardModalOpen}
        onClose={() => setIsOnboardModalOpen(false)}
        onSuccess={() => {
          loadApplications();
        }}
      />
    </div>
  );
};

export default AdminRiderApplicationsPage;
