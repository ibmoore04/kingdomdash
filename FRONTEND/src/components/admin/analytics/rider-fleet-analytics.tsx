import React, { useState } from 'react';
import {
  Bike,
  Star,
  MapPin,
  Flame,
  Award,
  ShieldCheck,
  Zap,
  Navigation,
} from 'lucide-react';

export interface RiderLeaderboardItem {
  id: string;
  name: string;
  vehicle: 'Motorcycle' | 'Scooter' | 'Bicycle';
  rating: number;
  totalDeliveries: number;
  onTimeRate: number;
  avgAcceptanceMins: number;
  avgDeliveryMins: number;
  status: 'online' | 'delivering' | 'offline';
  badgeTitle: string;
}

export interface ZoneHeatmapItem {
  zoneName: string;
  landmark: string;
  sharePct: number;
  orderVolume: number;
  avgTransitMins: number;
  demandLevel: 'high' | 'optimal' | 'moderate';
  activeCouriers: number;
}

const DEFAULT_RIDERS: RiderLeaderboardItem[] = [
  {
    id: 'r-01',
    name: 'Ibrahim Babatunde',
    vehicle: 'Motorcycle',
    rating: 4.9,
    totalDeliveries: 168,
    onTimeRate: 98.8,
    avgAcceptanceMins: 1.4,
    avgDeliveryMins: 19,
    status: 'delivering',
    badgeTitle: 'Top Performer',
  },
  {
    id: 'r-02',
    name: 'Samuel Adebayo',
    vehicle: 'Motorcycle',
    rating: 4.8,
    totalDeliveries: 142,
    onTimeRate: 97.2,
    avgAcceptanceMins: 1.8,
    avgDeliveryMins: 21,
    status: 'online',
    badgeTitle: 'Speed Master',
  },
  {
    id: 'r-03',
    name: 'Chidi Okafor',
    vehicle: 'Scooter',
    rating: 4.9,
    totalDeliveries: 129,
    onTimeRate: 99.1,
    avgAcceptanceMins: 1.2,
    avgDeliveryMins: 18,
    status: 'delivering',
    badgeTitle: 'Zero Incident',
  },
  {
    id: 'r-04',
    name: 'Oluwaseun Balogun',
    vehicle: 'Motorcycle',
    rating: 4.7,
    totalDeliveries: 98,
    onTimeRate: 95.9,
    avgAcceptanceMins: 2.1,
    avgDeliveryMins: 24,
    status: 'online',
    badgeTitle: 'Reliable Fleet',
  },
  {
    id: 'r-05',
    name: 'Tunde Adeleke',
    vehicle: 'Bicycle',
    rating: 4.8,
    totalDeliveries: 76,
    onTimeRate: 96.5,
    avgAcceptanceMins: 2.3,
    avgDeliveryMins: 22,
    status: 'offline',
    badgeTitle: 'Campus Specialist',
  },
];

const DEFAULT_ZONES: ZoneHeatmapItem[] = [
  {
    zoneName: 'Molipa Corridor & Express',
    landmark: 'Hospital Rd, Express Gate & Molipa High St',
    sharePct: 32,
    orderVolume: 142,
    avgTransitMins: 18,
    demandLevel: 'high',
    activeCouriers: 6,
  },
  {
    zoneName: 'TASUED Main Campus / Ijagun',
    landmark: 'Hostels, Senate Building & Student Union Area',
    sharePct: 28,
    orderVolume: 126,
    avgTransitMins: 24,
    demandLevel: 'high',
    activeCouriers: 5,
  },
  {
    zoneName: 'Igbeba GRA & Secretariat',
    landmark: 'Govt Secretariat, High Court & GRA Estates',
    sharePct: 18,
    orderVolume: 82,
    avgTransitMins: 20,
    demandLevel: 'optimal',
    activeCouriers: 4,
  },
  {
    zoneName: 'Degun & Obalende Central',
    landmark: 'Obalende Junction, Degun Roundabout & Markets',
    sharePct: 12,
    orderVolume: 54,
    avgTransitMins: 15,
    demandLevel: 'optimal',
    activeCouriers: 3,
  },
  {
    zoneName: 'Oke-Aje & Sabo Commercial Corridor',
    landmark: 'Oke-Aje New Market & Sabo Hausa Community Hub',
    sharePct: 10,
    orderVolume: 45,
    avgTransitMins: 19,
    demandLevel: 'moderate',
    activeCouriers: 2,
  },
];

interface RiderFleetAnalyticsProps {
  customRiders?: RiderLeaderboardItem[];
  customZones?: ZoneHeatmapItem[];
  activeCouriersCount?: number;
}

export const RiderFleetAnalytics: React.FC<RiderFleetAnalyticsProps> = ({
  customRiders,
  customZones,
  activeCouriersCount = 20,
}) => {
  const [riders] = useState<RiderLeaderboardItem[]>(customRiders || DEFAULT_RIDERS);
  const [zones] = useState<ZoneHeatmapItem[]>(customZones || DEFAULT_ZONES);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);

  const totalDispatches = zones.reduce((acc, z) => acc + z.orderVolume, 0);
  const avgFleetOnTime = (
    riders.reduce((acc, r) => acc + r.onTimeRate, 0) / (riders.length || 1)
  ).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-neutral-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
            <Bike className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-neutral-900">
                Rider Fleet Performance & Ijebu-Ode Heatmap
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                Live Fleet Telemetry
              </span>
            </div>
            <p className="text-xs text-neutral-500">
              Courier efficiency leaderboard, fulfillment velocity, and sector hotspot distribution
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto text-xs">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-50 border border-neutral-200">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-neutral-500">Fleet On-Time:</span>
            <span className="font-bold text-emerald-600">{avgFleetOnTime}%</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-50 border border-neutral-200">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-neutral-500">Avg Acceptance:</span>
            <span className="font-bold text-neutral-800">1.7m</span>
          </div>
        </div>
      </div>

      {/* Grid: Left = Leaderboard (7 cols), Right = Zone Heatmap (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Fleet Leaderboard */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-neutral-200 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" />
                <h4 className="text-sm font-bold text-neutral-900">Courier Excellence Leaderboard</h4>
              </div>
              <span className="text-xs text-neutral-500">Ranked by on-time fulfillment</span>
            </div>

            <div className="space-y-3">
              {riders.map((rider, index) => {
                const rankColor =
                  index === 0
                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                    : index === 1
                    ? 'bg-slate-100 text-slate-700 border-slate-300'
                    : index === 2
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-neutral-50 text-neutral-600 border-neutral-200';

                return (
                  <div
                    key={rider.id}
                    className="p-3 sm:p-3.5 rounded-xl border border-neutral-100 hover:border-neutral-200 bg-neutral-50/50 hover:bg-neutral-50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-7 h-7 rounded-lg border font-bold text-xs flex items-center justify-center shrink-0 ${rankColor}`}
                      >
                        #{index + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-neutral-900">{rider.name}</span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                            {rider.badgeTitle}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-neutral-500 mt-0.5">
                          <span>{rider.vehicle}</span>
                          <span>•</span>
                          <span className="flex items-center text-amber-600 font-semibold gap-0.5">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                            {rider.rating}
                          </span>
                          <span>•</span>
                          <span>{rider.totalDeliveries} trips</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto text-xs">
                      <div className="text-right">
                        <div className="font-bold text-emerald-600 text-xs">{rider.onTimeRate}%</div>
                        <div className="text-[10px] text-neutral-400">On-Time</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-neutral-800 text-xs">{rider.avgDeliveryMins}m</div>
                        <div className="text-[10px] text-neutral-400">Avg Delivery</div>
                      </div>
                      <div className="pl-2 border-l border-neutral-200">
                        {rider.status === 'delivering' && (
                          <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" title="On Delivery" />
                        )}
                        {rider.status === 'online' && (
                          <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" title="Online & Available" />
                        )}
                        {rider.status === 'offline' && (
                          <span className="inline-block w-2.5 h-2.5 rounded-full bg-neutral-300" title="Offline" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
            <span>Fleet Roster: {riders.length} tracked riders</span>
            <span className="text-emerald-600 font-semibold">100% background verified</span>
          </div>
        </div>

        {/* Ijebu-Ode Zone Coverage Hotspots */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-neutral-200 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-primary" />
                <h4 className="text-sm font-bold text-neutral-900">Ijebu-Ode Sector Demand</h4>
              </div>
              <span className="text-[11px] font-mono text-neutral-500">{totalDispatches} total orders</span>
            </div>

            <p className="text-xs text-neutral-500 mb-4">
              Real-time delivery density and courier allocation across Ijebu-Ode operational zones
            </p>

            <div className="space-y-4">
              {zones.map((zone) => {
                const isSelected = selectedZone === zone.zoneName;
                const isHighDemand = zone.demandLevel === 'high';

                return (
                  <div
                    key={zone.zoneName}
                    onClick={() => setSelectedZone(isSelected ? null : zone.zoneName)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                        : 'border-neutral-100 hover:border-neutral-200 bg-neutral-50/40'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <div className="font-bold text-neutral-900 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span>{zone.zoneName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-neutral-900">{zone.sharePct}%</span>
                        {isHighDemand ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                            High
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-neutral-100 text-neutral-600">
                            Optimal
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar representing density */}
                    <div className="w-full h-2 rounded-full bg-neutral-200/70 overflow-hidden mb-2">
                      <div
                        style={{ width: `${zone.sharePct}%` }}
                        className={`h-full rounded-full transition-all duration-500 ${
                          isHighDemand
                            ? 'bg-gradient-to-r from-primary-light to-primary'
                            : 'bg-gradient-to-r from-emerald-400 to-emerald-600'
                        }`}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-neutral-500">
                      <span>{zone.landmark}</span>
                      <span className="font-semibold text-neutral-700 whitespace-nowrap ml-2">
                        ~{zone.avgTransitMins} mins avg
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
            <span className="flex items-center gap-1">
              <Navigation className="w-3 h-3 text-primary" />
              <span>Full Ijebu-Ode radius active</span>
            </span>
            <span className="font-semibold text-neutral-800">{activeCouriersCount} riders on road</span>
          </div>
        </div>
      </div>
    </div>
  );
};
