import React, { useState, useMemo } from 'react'
import type { CompletionTrendItem } from '@/types/admin'

interface CompletionTrendChartProps {
  data: CompletionTrendItem[]
  isLoading?: boolean
}

// Catmull-Rom to Cubic Bezier spline generator
function getCubicSplinePath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`
  }

  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(i + 2, points.length - 1)]

    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6

    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6

    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`
  }
  return d
}

function formatDateShort(dateStr: string): string {
  try {
    const parts = dateStr.split('-')
    if (parts.length === 3) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      const monthIndex = parseInt(parts[1], 10) - 1
      const day = parseInt(parts[2], 10)
      if (monthIndex >= 0 && monthIndex < 12) {
        return `${months[monthIndex]} ${day}`
      }
    }
    return dateStr
  } catch {
    return dateStr
  }
}

export function CompletionTrendChart({
  data,
  isLoading = false,
}: CompletionTrendChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  const width = 600
  const height = 240
  const paddingLeft = 45
  const paddingRight = 20
  const paddingTop = 30
  const paddingBottom = 40

  const chartWidth = width - paddingLeft - paddingRight
  const chartHeight = height - paddingTop - paddingBottom
  const baselineY = paddingTop + chartHeight

  const { completedPoints, cancelledPoints, yTicks, splineCompleted, splineCancelled, areaCompleted } =
    useMemo(() => {
      if (!data || data.length === 0) {
        return {
          completedPoints: [],
          cancelledPoints: [],
          yTicks: [],
          splineCompleted: '',
          splineCancelled: '',
          areaCompleted: '',
        }
      }

      const maxVal = Math.max(
        ...data.flatMap((d) => [Number(d.completed || 0), Number(d.cancelled || 0)]),
        1
      )

      const ticks = [maxVal, Math.round(maxVal * 0.66), Math.round(maxVal * 0.33), 0]

      const compPts = data.map((item, idx) => {
        const x =
          data.length === 1
            ? paddingLeft + chartWidth / 2
            : paddingLeft + (idx / (data.length - 1)) * chartWidth
        const y = paddingTop + chartHeight - (Number(item.completed || 0) / maxVal) * chartHeight
        return { x, y, item, val: Number(item.completed || 0) }
      })

      const cancPts = data.map((item, idx) => {
        const x =
          data.length === 1
            ? paddingLeft + chartWidth / 2
            : paddingLeft + (idx / (data.length - 1)) * chartWidth
        const y = paddingTop + chartHeight - (Number(item.cancelled || 0) / maxVal) * chartHeight
        return { x, y, item, val: Number(item.cancelled || 0) }
      })

      const pathComp = getCubicSplinePath(compPts)
      const pathCanc = getCubicSplinePath(cancPts)
      const areaComp =
        compPts.length > 0
          ? `${pathComp} L ${compPts[compPts.length - 1].x.toFixed(2)} ${baselineY} L ${compPts[0].x.toFixed(2)} ${baselineY} Z`
          : ''

      return {
        completedPoints: compPts,
        cancelledPoints: cancPts,
        yTicks: ticks,
        splineCompleted: pathComp,
        splineCancelled: pathCanc,
        areaCompleted: areaComp,
      }
    }, [data, chartWidth, chartHeight, paddingLeft, paddingTop, baselineY])

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-border bg-white p-6 shadow-xs">
        <div className="flex flex-col items-center gap-2">
          <div className="h-6 w-32 animate-pulse rounded bg-light-surface" />
          <p className="text-xs text-text-muted">Loading completion dynamics…</p>
        </div>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-border bg-white p-6 shadow-xs">
        <p className="text-xs text-text-muted">No completion records available.</p>
      </div>
    )
  }

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (completedPoints.length === 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const svgX = ((e.clientX - rect.left) / rect.width) * width

    let closestIdx = 0
    let minDist = Math.abs(completedPoints[0].x - svgX)
    for (let i = 1; i < completedPoints.length; i++) {
      const dist = Math.abs(completedPoints[i].x - svgX)
      if (dist < minDist) {
        minDist = dist
        closestIdx = i
      }
    }
    setHoveredIdx(closestIdx)
  }

  const activeHover = hoveredIdx !== null ? completedPoints[hoveredIdx] : null
  const activeCancHover = hoveredIdx !== null ? cancelledPoints[hoveredIdx] : null

  // X ticks
  const xLabelIndices = (() => {
    if (completedPoints.length <= 5) return completedPoints.map((_, i) => i)
    const count = 4
    const step = (completedPoints.length - 1) / (count - 1)
    return Array.from({ length: count }, (_, i) => Math.round(i * step))
  })()

  return (
    <div className="rounded-2xl border border-border bg-white p-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">
            Fulfillment vs Cancellation
          </h3>
          <p className="text-xs text-text-secondary mt-0.5">
            Successful deliveries vs operational cancellations
          </p>
        </div>

        <div className="flex items-center gap-3 text-[11px] font-semibold">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-600 shadow-xs" />
            <span className="text-text-secondary">Delivered</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-primary shadow-xs" />
            <span className="text-text-secondary">Cancelled</span>
          </div>
        </div>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-52 sm:h-56 overflow-visible select-none cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredIdx(null)}
          role="img"
          aria-label="Completion vs Cancellation trend chart"
        >
          <defs>
            <linearGradient id="compTrendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
              <stop offset="60%" stopColor="#10b981" stopOpacity="0.06" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.00" />
            </linearGradient>

            <filter id="compGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#10b981" floodOpacity="0.4" />
            </filter>
          </defs>

          {/* Grid lines & Y values */}
          {yTicks.map((val, idx) => {
            const yPos = paddingTop + (idx / (yTicks.length - 1)) * chartHeight
            return (
              <g key={idx}>
                <line
                  x1={paddingLeft}
                  y1={yPos}
                  x2={width - paddingRight}
                  y2={yPos}
                  stroke="#f1f5f9"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <text
                  x={paddingLeft - 8}
                  y={yPos + 3.5}
                  textAnchor="end"
                  className="fill-text-muted text-[10px] font-mono select-none"
                >
                  {val}
                </text>
              </g>
            )
          })}

          <line
            x1={paddingLeft}
            y1={baselineY}
            x2={width - paddingRight}
            y2={baselineY}
            stroke="#e2e8f0"
            strokeWidth="1.5"
          />

          {/* Gradient area under delivered curve */}
          <path d={areaCompleted} fill="url(#compTrendFill)" />

          {/* Smooth delivered curve */}
          <path
            d={splineCompleted}
            fill="none"
            stroke="#16a34a"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Smooth cancelled curve */}
          <path
            d={splineCancelled}
            fill="none"
            stroke="#E50914"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="4 4"
          />

          {/* X ticks */}
          {xLabelIndices.map((idx) => {
            const pt = completedPoints[idx]
            if (!pt) return null
            return (
              <text
                key={idx}
                x={pt.x}
                y={baselineY + 22}
                textAnchor="middle"
                className="fill-text-muted text-[11px] font-medium font-mono select-none"
              >
                {formatDateShort(pt.item.date)}
              </text>
            )
          })}

          {/* Hover indicator */}
          {activeHover && (
            <g className="pointer-events-none transition-all">
              <line
                x1={activeHover.x}
                y1={Math.min(activeHover.y, activeCancHover ? activeCancHover.y : activeHover.y)}
                x2={activeHover.x}
                y2={baselineY}
                stroke="#16a34a"
                strokeWidth="1.5"
                strokeDasharray="3 3"
                opacity="0.75"
              />

              {/* Delivered glowing point */}
              <circle
                cx={activeHover.x}
                cy={activeHover.y}
                r="7"
                fill="#16a34a"
                fillOpacity="0.25"
                filter="url(#compGlow)"
              />
              <circle
                cx={activeHover.x}
                cy={activeHover.y}
                r="4"
                fill="#16a34a"
                stroke="#ffffff"
                strokeWidth="2"
              />

              {/* Cancelled point */}
              {activeCancHover && (
                <circle
                  cx={activeCancHover.x}
                  cy={activeCancHover.y}
                  r="3.5"
                  fill="#E50914"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
              )}
            </g>
          )}
        </svg>

        {/* Floating dark tooltip */}
        {activeHover && (
          <div
            className="absolute z-20 pointer-events-none transition-transform duration-75"
            style={{
              left: `${(activeHover.x / width) * 100}%`,
              top: `${(activeHover.y / height) * 100}%`,
              transform: 'translate(-50%, -120%)',
            }}
          >
            <div className="relative rounded-xl border border-white/10 bg-[#080607]/95 px-3.5 py-2 text-white shadow-2xl backdrop-blur-md min-w-[110px] text-center">
              <div className="text-[11px] font-medium text-slate-400">
                {formatDateShort(activeHover.item.date)}
              </div>
              <div className="text-xs font-bold text-emerald-400 mt-0.5">
                Delivered: {activeHover.item.completed}
              </div>
              <div className="text-[11px] font-medium text-rose-400">
                Cancelled: {activeHover.item.cancelled}
              </div>
              <div className="absolute left-1/2 bottom-[-5px] h-2 w-2 -translate-x-1/2 rotate-45 border-r border-b border-white/10 bg-[#080607]" />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default CompletionTrendChart
