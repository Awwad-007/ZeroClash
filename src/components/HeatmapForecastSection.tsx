import React, { useState } from 'react';
import { SYNTHETIC_HEATMAP_DATA, DEMAND_FORECAST_DATA, HeatmapHourData } from '../data/heatmapData';
import { BarChart3, TrendingUp, AlertTriangle, ShieldCheck, Clock, Users, Activity, Sparkles } from 'lucide-react';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export const HeatmapForecastSection: React.FC = () => {
  const [hoveredCell, setHoveredCell] = useState<HeatmapHourData | null>(null);

  // Helper to get color according to intensity
  const getCellColor = (intensity: number) => {
    if (intensity === 0) return 'rgba(15, 23, 42, 0.4)';
    if (intensity < 20) return 'rgba(6, 78, 59, 0.45)'; // Low: Emerald dark
    if (intensity < 50) return 'rgba(16, 185, 129, 0.7)'; // Moderate: Emerald
    if (intensity < 75) return 'rgba(6, 182, 212, 0.85)'; // High: Cyan
    if (intensity < 90) return 'rgba(249, 115, 22, 0.9)'; // Peak: Orange
    return 'rgba(239, 68, 68, 0.95)'; // Severe: Red/Hot
  };

  // SVG Chart calculation for Trend + Forecast
  // Data points: 7 actual days + 3 forecasted days = 10 points
  const chartWidth = 720;
  const chartHeight = 200;
  const paddingX = 40;
  const paddingY = 30;

  const points = DEMAND_FORECAST_DATA.map((d, idx) => {
    const val = d.actual ?? d.forecast ?? 50;
    const x = paddingX + (idx / (DEMAND_FORECAST_DATA.length - 1)) * (chartWidth - paddingX * 2);
    const y = chartHeight - paddingY - (val / 100) * (chartHeight - paddingY * 2);
    return { ...d, x, y, val };
  });

  const actualPoints = points.slice(0, 7);
  const forecastPoints = points.slice(6); // overlap at index 6 for continuous line

  const actualPath = actualPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const forecastPath = forecastPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  // Area under actual curve
  const areaPath = `${actualPath} L ${actualPoints[actualPoints.length - 1].x} ${chartHeight - paddingY} L ${actualPoints[0].x} ${chartHeight - paddingY} Z`;

  return (
    <section id="heatmap-section" className="scroll-mt-20 mb-16">
      {/* Header */}
      <div className="pb-4 border-b border-cyan-500/20 mb-6">
        <div className="flex items-center space-x-2 text-emerald-400 font-mono text-xs uppercase tracking-wider mb-1">
          <Activity className="w-4 h-4" />
          <span>Predictive Intelligence & Telemetry</span>
        </div>
        <h3 className="text-xl md:text-2xl font-bold text-white tracking-tight">
          Usage Heatmap & Demand Forecast
        </h3>
        <p className="text-xs text-slate-400">
          Synthesized multi-week facility telemetry with 3-day moving-average forecasting and saturation alerts.
        </p>
      </div>

      {/* KPI Highlights Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="glass-panel p-4 rounded-xl border border-cyan-500/25">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-mono">Utilization Rate</span>
            <div className="p-1.5 rounded-lg bg-cyan-950 text-cyan-400 border border-cyan-500/30">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-white">78.4%</div>
          <p className="text-[11px] text-emerald-400 mt-1 flex items-center space-x-1 font-mono">
            <span>↑ +4.2%</span>
            <span className="text-slate-400 font-sans">vs previous week</span>
          </p>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-cyan-500/25">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-mono">Clashes Averted</span>
            <div className="p-1.5 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-500/30">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-white">42</div>
          <p className="text-[11px] text-cyan-400 mt-1 font-mono">100% engine conflict lock</p>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-cyan-500/25">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-mono">Waitlist Promotions</span>
            <div className="p-1.5 rounded-lg bg-amber-950 text-amber-400 border border-amber-500/30">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-white">18</div>
          <p className="text-[11px] text-amber-300 mt-1 font-mono">10-min provisional holds</p>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-cyan-500/25">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-mono">Avg Queue Wait</span>
            <div className="p-1.5 rounded-lg bg-rose-950 text-rose-400 border border-rose-500/30">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-white">14.2 min</div>
          <p className="text-[11px] text-slate-400 mt-1 font-mono">High-priority expedited</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 7x24 Matrix Heatmap (8 Cols) */}
        <div className="lg:col-span-7 glass-panel p-5 rounded-xl border border-cyan-500/25">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-white flex items-center space-x-2">
              <span>Facility Utilization Heatmap</span>
              <span className="text-[10px] font-mono text-slate-400">(7 Days × 24 Hours)</span>
            </h4>
            <div className="flex items-center space-x-1.5 text-[10px] text-slate-400 font-mono">
              <span>Idle</span>
              <span className="w-2.5 h-2.5 rounded bg-emerald-950/60" />
              <span className="w-2.5 h-2.5 rounded bg-emerald-500" />
              <span className="w-2.5 h-2.5 rounded bg-cyan-400" />
              <span className="w-2.5 h-2.5 rounded bg-rose-500" />
              <span>Peak</span>
            </div>
          </div>

          {/* Matrix Grid */}
          <div className="overflow-x-auto">
            <div className="min-w-[480px]">
              {/* Hour header */}
              <div className="grid grid-cols-25 text-[9px] font-mono text-slate-500 text-center mb-1">
                <div className="text-left pl-1">Day</div>
                {HOURS.map((h) => (
                  <div key={h}>{h % 3 === 0 ? h : '·'}</div>
                ))}
              </div>

              {/* Day Rows */}
              {DAYS.map((dayName, dIdx) => {
                const dayCells = SYNTHETIC_HEATMAP_DATA.filter((c) => c.dayOfWeek === dIdx);

                return (
                  <div key={dayName} className="grid grid-cols-25 items-center gap-0.5 mb-0.5">
                    <div className="text-[10px] font-mono font-medium text-slate-400 text-left pl-1">
                      {dayName}
                    </div>
                    {dayCells.map((cell) => (
                      <div
                        key={cell.hour}
                        onMouseEnter={() => setHoveredCell(cell)}
                        onMouseLeave={() => setHoveredCell(null)}
                        style={{ backgroundColor: getCellColor(cell.intensity) }}
                        className="h-4 rounded-[2px] cursor-pointer transition-transform hover:scale-125 hover:z-20 border border-black/20"
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Hovered cell info badge */}
          <div className="mt-4 pt-3 border-t border-slate-800 text-xs min-h-[40px] flex items-center justify-between">
            {hoveredCell ? (
              <div className="flex items-center space-x-3 text-slate-200">
                <span className="font-mono text-cyan-400 font-semibold">
                  {hoveredCell.dayName} @ {hoveredCell.hour}:00
                </span>
                <span>·</span>
                <span className="font-mono font-bold text-white">{hoveredCell.intensity}% saturated</span>
                <span>·</span>
                <span className="text-slate-400">
                  {hoveredCell.bookingCount} active loans ({hoveredCell.peakCategory})
                </span>
              </div>
            ) : (
              <span className="text-slate-500 text-[11px] font-mono">
                Hover any time cell above for hourly saturation metrics.
              </span>
            )}
          </div>
        </div>

        {/* Demand Forecasting & Moving Average Chart (5 Cols) */}
        <div className="lg:col-span-5 glass-panel p-5 rounded-xl border border-cyan-500/25 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-white">Demand Forecast Trend</h4>
              <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/30">
                3-Day MA Model
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mb-3">
              Historical moving average with projected 72-hour equipment demand load.
            </p>

            {/* SVG Trendline Chart */}
            <div className="w-full overflow-hidden bg-slate-950/60 rounded-lg border border-slate-800/80 p-2">
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-auto">
                <defs>
                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#00f0ff" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Grid horizontal guidelines */}
                {[25, 50, 75, 100].map((level) => {
                  const y = chartHeight - paddingY - (level / 100) * (chartHeight - paddingY * 2);
                  return (
                    <g key={level}>
                      <line
                        x1={paddingX}
                        y1={y}
                        x2={chartWidth - paddingX}
                        y2={y}
                        stroke="#1e293b"
                        strokeDasharray="4 4"
                      />
                      <text x={10} y={y + 3} fill="#64748b" fontSize="9" fontFamily="monospace">
                        {level}%
                      </text>
                    </g>
                  );
                })}

                {/* Shaded Area */}
                <path d={areaPath} fill="url(#areaGradient)" />

                {/* Historical Moving Average Line */}
                <path d={actualPath} fill="none" stroke="#00f0ff" strokeWidth="2.5" />

                {/* Forecast Dashed Line (Next 3 Days) */}
                <path
                  d={forecastPath}
                  fill="none"
                  stroke="#f97316"
                  strokeWidth="2.5"
                  strokeDasharray="6 4"
                />

                {/* Data Points */}
                {points.map((p, idx) => {
                  const isForecast = idx >= 7;
                  return (
                    <g key={idx}>
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={p.isHighDemand ? 4.5 : 3}
                        fill={isForecast ? '#f97316' : '#00f0ff'}
                        stroke="#050b14"
                        strokeWidth="1.5"
                      />
                      <text
                        x={p.x}
                        y={chartHeight - 8}
                        fill={isForecast ? '#fb923c' : '#94a3b8'}
                        fontSize="9"
                        textAnchor="middle"
                        fontFamily="monospace"
                      >
                        {p.dayName}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* Predicted High-Demand Alert Cards */}
          <div className="mt-4 p-3 rounded-lg bg-orange-950/30 border border-orange-500/40 text-xs">
            <div className="flex items-center space-x-1.5 text-orange-300 font-semibold mb-1">
              <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0" />
              <span>Predicted High-Demand Windows</span>
            </div>
            <ul className="space-y-1 text-[11px] text-slate-300 font-mono mt-1">
              <li>• Next Tue: <strong className="text-orange-200">85% saturation</strong> (AI Milestone Deadline)</li>
              <li>• Next Wed: <strong className="text-orange-200">89% saturation</strong> (Midterm Prototype Review)</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};
