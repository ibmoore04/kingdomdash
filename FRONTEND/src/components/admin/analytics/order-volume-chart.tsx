import React, { useState, useMemo } from 'react'
import type { OrderOverTimeItem, AdminDateRangePreset } from '@/types/admin'

export interface OrderVolumeChartProps {
  data: OrderOverTimeItem[]
  isLoading?: boolean
  activePreset?: AdminDateRangePreset
  onPresetChange?: (preset: AdminDateRangePreset) => void
  title?: string
  subtitle?: string
}

type MetricType = 'revenue' | 'volume' | 'fulfilled'

// Catmull-Rom to Cubic Bezier spline generator for buttery smooth curves
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

function formatYValue(val: number, isCurrency: boolean): string {
  if (val >= 1_000_000) {
    return (isCurrency ? '₦' : '') + (val / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  }
  if (val >= 1_000) {
    return (isCurrency ? '₦' : '') + (val / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
  }
  return (isCurrency ? '₦' : '') + Math.round(val).toString()
}

export function OrderVolumeChart({
  data,
  isLoading = false,
  activePreset,
  onPresetChange,
  title = 'Orders & Fulfillment Trends',
  subtitle = 'Platform throughput, gross volume, and fulfillment dynamics',
}: OrderVolumeChartProps) {
  const [metric, setMetric] = useState<MetricType>('revenue')
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  // Dimensions & Padding
  const width = 800
  const height = 280
  const paddingLeft = 55
  const paddingRight = 25
  const paddingTop = 35
  const paddingBottom = 45

  const chartWidth = width - paddingLeft - paddingRight
  const chartHeight = height - paddingTop - paddingBottom
  const baselineY = paddingTop + chartHeight

  // Compute values and scales
  const { points, yTicks, splinePath, areaPath, activeHoverPoint } = useMemo(() => {
    if (!data || data.length === 0) {
      return { points: [], yTicks: [], splinePath: '', areaPath: '', activeHoverPoint: null }
    }

    const rawValues = data.map((d) => {
      if (metric === 'revenue') return Number(d.total_revenue || 0)
      if (metric === 'fulfilled') return Number(d.completed_orders || 0)
      return Number(d.total_orders || 0)
    })

    const maxVal = Math.max(...rawValues, 1)
    // Create 5 clean intervals for Y ticks
    const ticks = [maxVal, maxVal * 0.75, maxVal * 0.5, maxVal * 0.25, 0]

    const pts = data.map((item, index) => {
      const val = rawValues[index]
      const x =
        data.length === 1
          ? paddingLeft + chartWidth / 2
          : paddingLeft + (index / (data.length - 1)) * chartWidth
      const y = paddingTop + chartHeight - (val / maxVal) * chartHeight
      return { x, y, item, val }
    })

    const path = getCubicSplinePath(pts)
    const area = pts.length > 0
      ? `${path} L ${pts[pts.length - 1].x.toFixed(2)} ${baselineY} L ${pts[0].x.toFixed(2)} ${baselineY} Z`
      : ''

    const hoverPt = hoveredIdx !== null && pts[hoveredIdx] ? pts[hoveredIdx] : null

    return {
      points: pts,
      yTicks: ticks,
      splinePath: path,
      areaPath: area,
      activeHoverPoint: hoverPt,
    }
  }, [data, metric, baselineY, chartHeight, chartWidth, paddingLeft, paddingTop, hoveredIdx])

  if (isLoading) {
    return (
      <div className="flex h-72 items-center justify-center rounded-2xl border border-border bg-white p-6 shadow-xs">
        <div className="flex flex-col items-center gap-2">
          <div className="h-6 w-36 animate-pulse rounded bg-light-surface" />
          <p className="text-xs text-text-muted">Loading orders & fulfillment trends…</p>
        </div>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-2xl border border-border bg-white p-6 shadow-xs">
        <p className="text-xs text-text-muted">No order activity recorded in this period.</p>
      </div>
    )
  }

  // Handle Mouse Over SVG to find closest point along X
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (points.length === 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const svgX = ((e.clientX - rect.left) / rect.width) * width

    let closestIdx = 0
    let minDist = Math.abs(points[0].x - svgX)
    for (let i = 1; i < points.length; i++) {
      const dist = Math.abs(points[i].x - svgX)
      if (dist < minDist) {
        minDist = dist
        closestIdx = i
      }
    }
    setHoveredIdx(closestIdx)
  }

  const handleMouseLeave = () => {
    setHoveredIdx(null)
  }

  // Calculate clean X axis labels (up to 6 ticks)
  const xLabelIndices = (() => {
    if (points.length <= 6) return points.map((_, i) => i)
    const count = 5
    const step = (points.length - 1) / (count - 1)
    return Array.from({ length: count }, (_, i) => Math.round(i * step))
  })()

  return (
    <div className="rounded-2xl border border-border bg-white p-6 shadow-xs">
      {/* Header Bar with Time Range Pills and Metric Switches */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">
            {title}
          </h3>
          <p className="text-xs text-text-secondary mt-0.5">
            {subtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Preset Time Range Pills (matching reference: 1D, 1W, 1M, 3M) */}
          {onPresetChange && (
            <div className="inline-flex rounded-xl border border-border bg-light-surface p-1 text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => onPresetChange('today')}
                className={`rounded-lg px-2.5 py-1 transition-all ${
                  activePreset === 'today'
                    ? 'bg-primary text-white font-bold shadow-xs'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                1D
              </button>
              <button
                type="button"
                onClick={() => onPresetChange('7d')}
                className={`rounded-lg px-2.5 py-1 transition-all ${
                  activePreset === '7d'
                    ? 'bg-primary text-white font-bold shadow-xs'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                1W
              </button>
              <button
                type="button"
                onClick={() => onPresetChange('30d')}
                className={`rounded-lg px-2.5 py-1 transition-all ${
                  activePreset === '30d' || !activePreset
                    ? 'bg-primary text-white font-bold shadow-xs'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                1M
              </button>
              <button
                type="button"
                onClick={() => onPresetChange('90d')}
                className={`rounded-lg px-2.5 py-1 transition-all ${
                  activePreset === '90d'
                    ? 'bg-primary text-white font-bold shadow-xs'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                3M
              </button>
            </div>
          )}

          {/* Metric View Selector */}
          <div className="inline-flex rounded-xl border border-border bg-light-surface p-1 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setMetric('revenue')}
              className={`rounded-lg px-2.5 py-1 transition-all ${
                metric === 'revenue'
                  ? 'bg-white text-text-primary shadow-xs border border-border/50'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Revenue (₦)
            </button>
            <button
              type="button"
              onClick={() => setMetric('volume')}
              className={`rounded-lg px-2.5 py-1 transition-all ${
                metric === 'volume'
                  ? 'bg-white text-text-primary shadow-xs border border-border/50'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Orders
            </button>
            <button
              type="button"
              onClick={() => setMetric('fulfilled')}
              className={`rounded-lg px-2.5 py-1 transition-all ${
                metric === 'fulfilled'
                  ? 'bg-white text-text-primary shadow-xs border border-border/50'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Fulfilled
            </button>
          </div>
        </div>
      </div>

      {/* Main Interactive Chart Canvas */}
      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-64 sm:h-72 overflow-visible select-none cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          role="img"
          aria-label="Interactive Orders & Fulfillment Trends chart"
        >
          <defs>
            {/* Red Theme Area Gradient */}
            <linearGradient id="orderTrendFillRed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#E50914" stopOpacity="0.28" />
              <stop offset="50%" stopColor="#E50914" stopOpacity="0.10" />
              <stop offset="85%" stopColor="#E50914" stopOpacity="0.02" />
              <stop offset="100%" stopColor="#E50914" stopOpacity="0.00" />
            </linearGradient>

            {/* Glowing Drop Shadow Filter for Active Point */}
            <filter id="pointGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#E50914" floodOpacity="0.5" />
            </filter>
          </defs>

          {/* Horizontal Grid Lines & Y-Axis Labels */}
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
                  x={paddingLeft - 10}
                  y={yPos + 3.5}
                  textAnchor="end"
                  className="fill-text-muted text-[10px] font-mono select-none"
                >
                  {formatYValue(val, metric === 'revenue')}
                </text>
              </g>
            )
          })}

          {/* Baseline horizontal rule */}
          <line
            x1={paddingLeft}
            y1={baselineY}
            x2={width - paddingRight}
            y2={baselineY}
            stroke="#e2e8f0"
            strokeWidth="1.5"
          />

          {/* Smooth Gradient Area Fill Under Curve */}
          <path d={areaPath} fill="url(#orderTrendFillRed)" />

          {/* Smooth Continuous Spline Trend Line */}
          <path
            d={splinePath}
            fill="none"
            stroke="#E50914"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* X-Axis Date Labels along the bottom */}
          {xLabelIndices.map((idx) => {
            const pt = points[idx]
            if (!pt) return null
            return (
              <text
                key={idx}
                x={pt.x}
                y={baselineY + 24}
                textAnchor="middle"
                className="fill-text-muted text-[11px] font-medium font-mono select-none"
              >
                {formatDateShort(pt.item.date)}
              </text>
            )
          })}

          {/* Hover Interaction Guide Line & Glowing Indicator Dot */}
          {activeHoverPoint && (
            <g className="pointer-events-none transition-all">
              {/* Vertical Dashed Guideline */}
              <line
                x1={activeHoverPoint.x}
                y1={activeHoverPoint.y}
                x2={activeHoverPoint.x}
                y2={baselineY}
                stroke="#E50914"
                strokeWidth="1.5"
                strokeDasharray="3 3"
                opacity="0.75"
              />

              {/* Glowing Outer Halo */}
              <circle
                cx={activeHoverPoint.x}
                cy={activeHoverPoint.y}
                r="9"
                fill="#E50914"
                fillOpacity="0.25"
                filter="url(#pointGlow)"
              />

              {/* Center Crisp Dot */}
              <circle
                cx={activeHoverPoint.x}
                cy={activeHoverPoint.y}
                r="4.5"
                fill="#E50914"
                stroke="#ffffff"
                strokeWidth="2"
              />
            </g>
          )}
        </svg>

        {/* Floating Tooltip Pill (Styled directly from Reference Image) */}
        {activeHoverPoint && (
          <div
            className="absolute z-20 pointer-events-none transition-transform duration-75"
            style={{
              left: `${(activeHoverPoint.x / width) * 100}%`,
              top: `${(activeHoverPoint.y / height) * 100}%`,
              transform: 'translate(-50%, -120%)',
            }}
          >
            <div className="relative rounded-xl border border-white/10 bg-[#080607]/95 px-4 py-2.5 text-white shadow-2xl backdrop-blur-md min-w-[120px] text-center">
              {/* Date Header */}
              <div className="text-[11px] font-medium text-slate-400">
                {formatDateShort(activeHoverPoint.item.date)}
              </div>

              {/* Large Bold Primary Metric */}
              <div className="text-sm font-bold tracking-tight text-white mt-0.5 font-mono">
                {metric === 'revenue'
                  ? `₦${activeHoverPoint.item.total_revenue.toLocaleString('en-NG')}`
                  : metric === 'fulfilled'
                  ? `${activeHoverPoint.item.completed_orders.toLocaleString()} Fulfilled`
                  : `${activeHoverPoint.item.total_orders.toLocaleString()} Orders`}
              </div>

              {/* Context line if viewing revenue or volume */}
              <div className="text-[10px] text-slate-400 mt-0.5 flex items-center justify-center gap-2">
                {metric === 'revenue' ? (
                  <span>{activeHoverPoint.item.total_orders} orders placed</span>
                ) : (
                  <span>₦{activeHoverPoint.item.total_revenue.toLocaleString('en-NG')} vol</span>
                )}
              </div>

              {/* Little Downward Indicator Arrow */}
              <div className="absolute left-1/2 bottom-[-5px] h-2 w-2 -translate-x-1/2 rotate-45 border-r border-b border-white/10 bg-[#080607]" />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default OrderVolumeChart
