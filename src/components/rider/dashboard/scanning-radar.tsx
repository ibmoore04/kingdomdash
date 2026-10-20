import React from 'react'
import { WifiOff, Navigation } from 'lucide-react'

interface ScanningRadarProps {
  isAvailable?: boolean
  coverageRadiusKm?: number
  hubLocation?: string
}

export const ScanningRadar: React.FC<ScanningRadarProps> = ({
  isAvailable = true,
  coverageRadiusKm = 15,
  hubLocation = 'Ijebu-Ode Central Hub',
}) => {
  const radarNodes = [
    { id: 'molipa', name: 'Molipa Corridor', top: '28%', left: '68%', delay: '0s' },
    { id: 'tasued', name: 'TASUED Campus', top: '66%', left: '26%', delay: '0.8s' },
    { id: 'obalende', name: 'Obalende Junction', top: '22%', left: '36%', delay: '1.4s' },
    { id: 'stadium', name: 'Otunba Dipo Dina', top: '74%', left: '72%', delay: '2.1s' },
  ]

  return (
    <div className="flex flex-col items-center text-center">
      {/* ── Circular Tactical Radar Viewport (Official Red & White Brand Theme) ── */}
      <div className="relative w-64 h-64 sm:w-72 sm:h-72 my-2 rounded-full overflow-hidden border-2 border-red-500/35 bg-[#0a0607] shadow-[0_0_45px_rgba(229,9,20,0.25)] select-none">
        {/* Background Radial Glow */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(229,9,20,0.22)_0%,rgba(20,8,10,0.95)_75%,rgba(6,3,4,1)_100%)]" />

        {/* Tactical Distance Concentric Rings */}
        <div className="absolute inset-[16.6%] rounded-full border border-red-500/20 pointer-events-none" />
        <div className="absolute inset-[33.3%] rounded-full border border-red-500/30 pointer-events-none" />
        <div className="absolute inset-[50%] rounded-full border border-red-500/20 pointer-events-none" />

        {/* Range Label Etchings (White & Red) */}
        <span className="absolute top-[3%] left-1/2 -translate-x-1/2 text-[9px] font-mono font-bold text-white/80 uppercase tracking-widest pointer-events-none">
          {coverageRadiusKm}km
        </span>
        <span className="absolute top-[18%] left-1/2 -translate-x-1/2 text-[8px] font-mono font-bold text-red-300/60 uppercase tracking-widest pointer-events-none">
          {Math.round(coverageRadiusKm * 0.66)}km
        </span>
        <span className="absolute top-[35%] left-1/2 -translate-x-1/2 text-[8px] font-mono font-bold text-red-300/50 uppercase tracking-widest pointer-events-none">
          {Math.round(coverageRadiusKm * 0.33)}km
        </span>

        {/* Crosshair Axes & Compass Notches */}
        <div className="absolute top-0 bottom-0 left-1/2 w-px -translate-x-1/2 border-l border-dashed border-red-500/30 pointer-events-none" />
        <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 border-t border-dashed border-red-500/30 pointer-events-none" />
        <div className="absolute inset-0 border-t border-b border-l border-r border-red-500/15 rotate-45 pointer-events-none" />

        {/* Compass Cardinal Points (Pure White) */}
        <span className="absolute top-1.5 left-1/2 -translate-x-1/2 text-[9px] font-mono font-black text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.8)]">N</span>
        <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[9px] font-mono font-black text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.8)]">S</span>
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-mono font-black text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.8)]">E</span>
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-mono font-black text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.8)]">W</span>

        {isAvailable ? (
          <>
            {/* Concentric Expanding Sonar Ping Waves (Red & White) */}
            <div
              className="absolute inset-0 rounded-full border border-red-500/40 animate-radar-pulse-wave-1 pointer-events-none"
              style={{
                animation: 'radar-pulse-wave 3s cubic-bezier(0, 0.2, 0.8, 1) infinite',
                transformOrigin: '50% 50%',
              }}
            />
            <div
              className="absolute inset-0 rounded-full border border-red-500/40 animate-radar-pulse-wave-2 pointer-events-none"
              style={{
                animation: 'radar-pulse-wave 3s cubic-bezier(0, 0.2, 0.8, 1) 1s infinite',
                transformOrigin: '50% 50%',
              }}
            />
            <div
              className="absolute inset-0 rounded-full border border-red-500/40 animate-radar-pulse-wave-3 pointer-events-none"
              style={{
                animation: 'radar-pulse-wave 3s cubic-bezier(0, 0.2, 0.8, 1) 2s infinite',
                transformOrigin: '50% 50%',
              }}
            />

            {/* 360° Rotating Radar Sweep Cone (Continuous Rolling Animation) */}
            <div
              className="absolute inset-0 animate-radar-sweep pointer-events-none"
              style={{
                background:
                  'conic-gradient(from 0deg, transparent 0deg, transparent 260deg, rgba(229, 9, 20, 0.06) 290deg, rgba(229, 9, 20, 0.52) 360deg)',
                animation: 'radar-sweep 3s linear infinite',
                transformOrigin: '50% 50%',
                willChange: 'transform',
              }}
            >
              {/* Leading edge laser line (White hot laser with red glow) */}
              <div className="absolute top-0 left-1/2 w-0.5 h-1/2 -translate-x-1/2 bg-gradient-to-t from-red-600 via-rose-300 to-white shadow-[0_0_10px_#ffffff,0_0_20px_#e50914]" />
            </div>

            {/* Active Tactical Delivery Hub Blips */}
            {radarNodes.map((node) => (
              <div
                key={node.id}
                className="absolute -translate-x-1/2 -translate-y-1/2 group z-20 cursor-default"
                style={{ top: node.top, left: node.left }}
              >
                <div
                  className="relative flex items-center justify-center animate-radar-blip"
                  style={{
                    animation: 'radar-blip 2s ease-in-out infinite',
                    animationDelay: node.delay,
                  }}
                >
                  <span className="absolute h-4 w-4 rounded-full bg-red-500/35 animate-ping" />
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500 ring-1 ring-white shadow-[0_0_10px_#e50914]" />
                </div>
                {/* Micro Node Tag */}
                <span className="absolute left-1/2 -translate-x-1/2 top-3 text-[8px] font-mono font-semibold text-white whitespace-nowrap bg-black/85 px-1.5 py-0.5 rounded border border-red-500/30 backdrop-blur-xs shadow-sm pointer-events-none">
                  {node.name}
                </span>
              </div>
            ))}
          </>
        ) : (
          /* Offline Dormant Overlay */
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-2xs z-20">
            <div className="h-10 w-10 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500 mb-1.5">
              <WifiOff className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-mono font-bold text-red-400 uppercase tracking-widest">
              Radar Dormant
            </span>
          </div>
        )}

        {/* Center Courier Beacon (Rider Location in Official Red & White) */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 flex flex-col items-center">
          <div className="relative flex items-center justify-center">
            {isAvailable && (
              <span className="absolute h-7 w-7 rounded-full bg-red-500/40 animate-ping" />
            )}
            <div
              className={`h-4 w-4 rounded-full flex items-center justify-center shadow-md ${
                isAvailable
                  ? 'bg-red-600 ring-2 ring-white shadow-[0_0_14px_#e50914]'
                  : 'bg-neutral-600 ring-2 ring-neutral-400'
              }`}
            >
              <div className="h-1.5 w-1.5 rounded-full bg-white" />
            </div>
          </div>
          <span className="text-[8px] font-mono font-bold text-white tracking-widest mt-1 bg-black/85 px-1.5 py-0.2 rounded border border-white/30 shadow-xs">
            YOU
          </span>
        </div>

        {/* Scanlines Filter Overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.3) 1px, transparent 1px, transparent 2px)',
          }}
        />

        {/* Tactical Telemetry Ribbon at top of radar scope */}
        <div className="absolute top-2 left-3 right-3 flex items-center justify-between text-[8px] font-mono text-red-300/80 pointer-events-none">
          <span>6.8213° N</span>
          <span>3.9208° E</span>
        </div>

        {/* Tactical Telemetry Ribbon at bottom of radar scope */}
        <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[8px] font-mono text-red-300/80 pointer-events-none">
          <span className="flex items-center gap-1">
            {isAvailable && <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />}
            {isAvailable ? 'REALTIME LIVE' : 'STANDBY'}
          </span>
          <span>CH 433.9 MHz</span>
        </div>
      </div>

      {/* ── Status Titles & Telemetry ─────────────────────────────────────────── */}
      <div className="mt-3 max-w-md mx-auto space-y-1.5">
        <h3 className="text-base sm:text-lg font-black text-neutral-900 tracking-tight">
          {isAvailable ? 'Radar Active — Waiting for Dispatch' : 'Rider is Currently Offline'}
        </h3>
        <p className="text-xs sm:text-sm text-neutral-500 leading-relaxed max-w-sm sm:max-w-md mx-auto">
          {isAvailable
            ? `Your dispatch radar is active across ${hubLocation}. When a customer places an order or requests a courier, jobs will ping this inbox in real-time.`
            : 'Toggle your status to Online above to activate your dispatch radar and receive instant delivery offers from nearby vendors.'}
        </p>

        {/* Status Indicators & Live Badges in Official White & Red */}
        {isAvailable ? (
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-red-500/10 border border-red-500/20 px-3.5 py-1 text-xs font-bold text-red-600 shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600" />
              </span>
              <span>Scanning Ijebu-Ode network</span>
            </div>

            <div className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-[11px] font-semibold text-neutral-600">
              <Navigation className="h-3 w-3 text-red-600" />
              <span>{coverageRadiusKm} km Radius</span>
            </div>
          </div>
        ) : (
          <div className="pt-2 flex items-center justify-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-red-500/10 border border-red-500/20 px-3.5 py-1 text-xs font-bold text-red-700">
              <span className="h-2 w-2 rounded-full bg-red-600" />
              <span>Radar Inactive • Toggle Online Above</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
