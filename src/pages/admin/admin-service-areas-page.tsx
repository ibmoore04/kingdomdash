import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  getServiceAreas,
  saveServiceArea,
  toggleServiceAreaActive,
} from '../../services/supabase/admin';
import type { ServiceAreaRow } from '../../types/admin';
import {
  MapPin,
  Plus,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

export const AdminServiceAreasPage: React.FC = () => {
  const [areas, setAreas] = useState<ServiceAreaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [lat, setLat] = useState('6.5244'); // Lagos default
  const [lng, setLng] = useState('3.3792');
  const [radiusKm, setRadiusKm] = useState(15);
  const [saving, setSaving] = useState(false);

  const loadAreas = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getServiceAreas();
      setAreas((res.data || []) as unknown as ServiceAreaRow[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to query service areas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAreas();
  }, [loadAreas]);

  const handleCreateArea = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await saveServiceArea({
        name: name.trim(),
        center_lat: parseFloat(lat),
        center_lng: parseFloat(lng),
        radius_km: Number(radiusKm),
        is_active: true,
      });
      setIsModalOpen(false);
      setName('');
      loadAreas();
    } catch (err: unknown) {
      alert(`Failed to save service area: ${err instanceof Error ? err.message : 'Unknown'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleArea = async (id: string, current: boolean) => {
    try {
      await toggleServiceAreaActive(id, !current);
      setAreas((prev) =>
        prev.map((a) => (a.id === id ? { ...a, is_active: !current } : a))
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
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Geographic Service Areas</h2>
            <p className="text-xs text-text-secondary">
              Authoritative delivery coverage polygons & operational radius boundaries
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
            <span>New Service Zone</span>
          </button>
          <button
            type="button"
            onClick={loadAreas}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-text-secondary bg-light-surface hover:bg-slate-100 rounded-xl transition-colors border border-border"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Reload</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-primary flex items-center gap-3 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-primary" />
          <span>{error}</span>
        </div>
      )}

      {/* Mobile Cards View (md:hidden) */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="p-8 text-center text-text-muted bg-white border border-border rounded-2xl shadow-xs">
            <RefreshCw className="w-5 h-5 animate-spin text-primary mx-auto mb-2" />
            <p className="text-xs">Loading service zones...</p>
          </div>
        ) : areas.length === 0 ? (
          <div className="p-8 text-center text-text-muted bg-white border border-border rounded-2xl shadow-xs">
            <p className="text-xs">No service areas registered in database.</p>
          </div>
        ) : (
          areas.map((area) => (
            <div
              key={area.id}
              className="p-4 bg-white border border-border rounded-2xl shadow-xs space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="font-semibold text-text-primary text-sm">{area.name}</div>
                  <div className="text-[11px] font-mono text-text-secondary">
                    {area.center_lat?.toFixed(4)}, {area.center_lng?.toFixed(4)}
                  </div>
                </div>
                <div>
                  {area.is_active ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3" />
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-light-surface text-text-muted border border-border">
                      <XCircle className="w-3 h-3" />
                      Suspended
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-2 border-t border-border">
                <div className="text-text-muted text-[11px]">
                  Coverage: <span className="font-semibold text-text-primary font-mono">{area.radius_km} km radius</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleArea(area.id, area.is_active)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors shadow-xs ${
                    area.is_active
                      ? 'bg-rose-50 text-primary hover:bg-rose-100 border border-rose-200'
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                  }`}
                >
                  {area.is_active ? 'Suspend Zone' : 'Activate Zone'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Table View (hidden md:block) */}
      <div className="hidden md:block rounded-2xl bg-white border border-border shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-text-secondary">
            <thead className="bg-light-surface/80 text-text-secondary font-semibold uppercase tracking-wider border-b border-border text-[11px]">
              <tr>
                <th className="px-4 py-3">Zone Name</th>
                <th className="px-4 py-3">Center Coordinates (Lat / Lng)</th>
                <th className="px-4 py-3">Operating Radius</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Toggle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-text-muted">
                    <RefreshCw className="w-4 h-4 animate-spin text-primary mx-auto mb-1" />
                    Loading zones...
                  </td>
                </tr>
              ) : areas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-text-muted">
                    No service areas registered in database.
                  </td>
                </tr>
              ) : (
                areas.map((area) => (
                  <tr key={area.id} className="hover:bg-light-surface/60 transition-colors">
                    <td className="px-4 py-3 font-semibold text-text-primary">{area.name}</td>
                    <td className="px-4 py-3 font-mono text-text-secondary">
                      {area.center_lat?.toFixed(4)}, {area.center_lng?.toFixed(4)}
                    </td>
                    <td className="px-4 py-3 font-mono text-text-secondary">
                      {area.radius_km} km radius
                    </td>
                    <td className="px-4 py-3">
                      {area.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          Active Zone
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-light-surface text-text-muted border border-border">
                          <XCircle className="w-3 h-3" />
                          Suspended
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleToggleArea(area.id, area.is_active)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                          area.is_active
                            ? 'bg-rose-50 text-primary hover:bg-rose-100 border border-rose-200'
                            : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                        }`}
                      >
                        {area.is_active ? 'Suspend' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Zone Modal */}
      {isModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-border rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-text-primary">Register Service Zone</h3>
            <form onSubmit={handleCreateArea} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1">
                  Zone / Hub Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Lagos Island Hub, Ikeja Operational Zone"
                  className="w-full p-2.5 bg-white border border-border rounded-xl text-xs text-text-primary placeholder:text-text-muted focus:outline-hidden focus:border-primary shadow-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    Center Latitude
                  </label>
                  <input
                    type="text"
                    required
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                    className="w-full p-2 bg-white border border-border rounded-xl text-xs text-text-primary font-mono focus:outline-hidden focus:border-primary shadow-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    Center Longitude
                  </label>
                  <input
                    type="text"
                    required
                    value={lng}
                    onChange={(e) => setLng(e.target.value)}
                    className="w-full p-2 bg-white border border-border rounded-xl text-xs text-text-primary font-mono focus:outline-hidden focus:border-primary shadow-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1">
                  Operating Radius (KM)
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  required
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(Number(e.target.value))}
                  className="w-full p-2.5 bg-white border border-border rounded-xl text-xs text-text-primary font-mono focus:outline-hidden focus:border-primary shadow-xs"
                />
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
                  {saving ? 'Saving...' : 'Register Zone'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default AdminServiceAreasPage;
