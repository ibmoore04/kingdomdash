import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  getUnassignedDeliveries,
  getAllRiders,
  assignDelivery,
} from '../../services/supabase/admin';
import type { AdminDeliveryRow, AdminRiderRow } from '../../types/admin';
import {
  Send,
  Bike,
  RefreshCw,
  AlertCircle,
  Clock,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react';

export const AdminDispatchPage: React.FC = () => {
  const [deliveries, setDeliveries] = useState<AdminDeliveryRow[]>([]);
  const [riders, setRiders] = useState<AdminRiderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dispatch modal
  const [selectedDelivery, setSelectedDelivery] = useState<AdminDeliveryRow | null>(null);
  const [selectedRiderId, setSelectedRiderId] = useState<string>('');
  const [assigning, setAssigning] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [unassignedRes, availableRidersRes] = await Promise.all([
        getUnassignedDeliveries(),
        getAllRiders({ isAvailable: true, isVerified: true }),
      ]);
      setDeliveries((unassignedRes.data || []) as unknown as AdminDeliveryRow[]);
      setRiders((availableRidersRes.data || []) as unknown as AdminRiderRow[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load dispatch queue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAssign = async () => {
    if (!selectedDelivery || !selectedRiderId) return;

    try {
      setAssigning(true);
      await assignDelivery(selectedDelivery.id, selectedRiderId);
      // Remove from unassigned queue
      setDeliveries((prev) => prev.filter((d) => d.id !== selectedDelivery.id));
      setSelectedDelivery(null);
      setSelectedRiderId('');
      alert('Delivery successfully dispatched to courier via assign_delivery_to_rider RPC.');
    } catch (err: unknown) {
      alert(`Dispatch failed: ${err instanceof Error ? err.message : 'Server rejected assignment'}`);
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-border shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Manual Dispatch Console</h2>
            <p className="text-xs text-text-secondary">
              {deliveries.length} unassigned orders • {riders.length} eligible online couriers
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadData}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-text-secondary bg-white hover:bg-light-surface rounded-lg transition-colors border border-border shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-primary' : ''}`} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-3 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-primary" />
          <span>{error}</span>
        </div>
      )}

      {/* Unassigned Deliveries List */}
      <div className="rounded-2xl bg-white border border-border overflow-hidden shadow-xs">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 bg-light-surface/80">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500 shrink-0" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
              Unassigned Deliveries Awaiting Dispatch
            </h3>
          </div>
          <span className="text-[11px] font-mono text-text-muted">
            Authoritative state: pending / unassigned
          </span>
        </div>

        <div className="divide-y divide-border">
          {loading ? (
            <div className="p-8 text-center text-text-muted text-xs">
              <RefreshCw className="w-4 h-4 animate-spin text-primary mx-auto mb-2" />
              Scanning for pending delivery jobs...
            </div>
          ) : deliveries.length === 0 ? (
            <div className="p-8 text-center text-text-muted text-xs">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-2" />
              All deliveries are actively assigned or completed. No pending dispatch backlog.
            </div>
          ) : (
            deliveries.map((delivery) => (
              <div
                key={delivery.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-light-surface/60 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-text-primary text-xs">
                      Delivery #{delivery.id.slice(0, 8)}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">
                      {delivery.status}
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary">
                    Linked Order ID: <span className="font-mono text-text-primary">{delivery.order_id || 'N/A'}</span>
                  </p>
                  <p className="text-[11px] text-text-muted">
                    Created {new Date(delivery.created_at).toLocaleTimeString()}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedDelivery(delivery);
                    setSelectedRiderId('');
                  }}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-primary hover:bg-primary-hover transition-colors shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Assign Courier</span>
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Assignment Modal */}
      {selectedDelivery && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-border rounded-2xl max-w-lg w-full p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <Bike className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text-primary">Allocate Courier</h3>
                  <p className="text-xs text-text-secondary font-mono">Delivery #{selectedDelivery.id.slice(0, 8)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDelivery(null)}
                className="text-text-muted hover:text-text-primary font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-light-surface border border-border text-xs">
                <p className="text-text-secondary">
                  Select a verified, active, and currently online courier from the roster. The assignment is guaranteed atomic via <code className="text-primary font-mono">assign_delivery_to_rider</code>.
                </p>
              </div>

              {riders.length === 0 ? (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>No couriers are currently verified, active, and online.</span>
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {riders.map((rider) => (
                    <label
                      key={rider.id}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                        selectedRiderId === rider.id
                          ? 'bg-primary/5 border-primary text-text-primary'
                          : 'bg-white border-border text-text-secondary hover:bg-light-surface'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="dispatchRider"
                          value={rider.id}
                          checked={selectedRiderId === rider.id}
                          onChange={(e) => setSelectedRiderId(e.target.value)}
                          className="accent-primary focus:ring-0"
                        />
                        <div>
                          <div className="text-xs font-semibold text-text-primary">{rider.full_name}</div>
                          <div className="text-[10px] text-text-muted font-mono">{rider.phone_number || 'No contact'}</div>
                        </div>
                      </div>

                      {rider.vehicle && (
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-text-muted">
                            {rider.vehicle.vehicle_type}
                          </span>
                          <div className="text-[10px] font-mono text-text-secondary">{rider.vehicle.plate_number}</div>
                        </div>
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => setSelectedDelivery(null)}
                className="px-4 py-2 text-xs font-semibold text-text-secondary hover:text-text-primary rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!selectedRiderId || assigning}
                onClick={handleAssign}
                className="px-4 py-2 text-xs font-semibold text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors disabled:opacity-50 shadow-xs"
              >
                {assigning ? 'Assigning...' : 'Confirm Dispatch'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default AdminDispatchPage;
