import React, { useState } from 'react';
import { SYNTHETIC_HEATMAP_DATA, DEMAND_FORECAST_DATA, HeatmapHourData } from '../data/heatmapData';
import { Activity, TrendingUp, ShieldCheck, Users, Clock, Sparkles } from 'lucide-react';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_INDICES = [1, 2, 3, 4, 5, 6, 0]; // Monday (1) to Sunday (0)
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export const HeatmapForecastSection: React.FC = () => {
  const [hoveredCell, setHoveredCell] = useState<HeatmapHourData | null>(null);

  // Minimal clean Apple-style color scale
  const getCellColor = (intensity: number) => {
    if (intensity === 0) return 'rgba(15, 23, 42, 0.6)';
    if (intensity < 25) return 'rgba(6, 78, 59, 0.65)'; // Soft emerald
    if (intensity < 55) return 'rgba(16, 185, 129, 0.85)'; // Emerald
    if (intensity < 80) return 'rgba(14, 165, 233, 0.9)'; // Sky cyan
    if (intensity < 90) return 'rgba(249, 115, 22, 0.95)'; // Amber
    return 'rgba(244, 63, 94, 0.95)'; // Rose Peak
  };

  // Compact SVG Forecast Chart (Minimal Sparkline)
  const chartWidth = 420;
  const chartHeight = 130;
  const paddingX = 24;
  const paddingY = 20;

  const points = DEMAND_FORECAST_DATA.map((d, idx) => {
    const val = d.actual ?? d.forecast ?? 50;
    const x = paddingX + (idx / (DEMAND_FORECAST_DATA.length - 1)) * (chartWidth - paddingX * 2);
    const y = chartHeight - paddingY - (val / 100) * (chartHeight - paddingY * 2);
    return { ...d, x, y, val };
  });

  const actualPoints = points.slice(0, 7);
  const forecastPoints = points.slice(6);

  const actualPath = actualPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const forecastPath = forecastPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${actualPath} L ${actualPoints[actualPoints.length - 1].x.toFixed(1)} ${chartHeight - paddingY} L ${actualPoints[0].x.toFixed(1)} ${chartHeight - paddingY} Z`;

  return (
    <section id="heatmap-section" className="scroll-mt-20 mb-16">
      {/* Minimal Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between pb-3 mb-4 gap-2">
        <div>
          <div className="flex items-center space-x-2 text-cyan-400 font-mono text-xs uppercase tracking-wider mb-0.5">
            <Activity className="w-3.5 h-3.5" />
            <span>Facility Telemetry</span>
          </div>
          <h3 className="text-xl md:text-2xl font-semibold text-white tracking-tight">
            Usage Heatmap & Demand Forecast
          </h3>
          <p className="text-xs text-slate-400">
            7-day hourly facility saturation matrix and 72-hour moving-average predictive load.
          </p>
        </div>

        {/* Minimal Legend */}
        <div className="flex items-center space-x-2 text-[10px] text-slate-400 self-start md:self-auto font-mono">
          <span>0%</span>
          <span className="w-2.5 h-2.5 rounded-[2px] bg-slate-900 border border-slate-700" />
          <span className="w-2.5 h-2.5 rounded-[2px] bg-emerald-600" />
          <span className="w-2.5 h-2.5 rounded-[2px] bg-sky-500" />
          <span className="w-2.5 h-2.5 rounded-[2px] bg-amber-500" />
          <span className="w-2.5 h-2.5 rounded-[2px] bg-rose-500" />
          <span>100%</span>
        </div>
      </div>

      {/* Apple-Style Compact Metrics Ribbon */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3.5 mb-4 shadow-xl backdrop-blur-xl grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-0 lg:divide-x lg:divide-slate-800/60">
        <div className="px-3 flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400 font-medium">Campus Utilization</div>
            <div className="text-base font-semibold text-white font-mono flex items-center space-x-1.5">
              <span>78.4%</span>
              <span className="text-[10px] text-emerald-400 font-normal">↑ 4.2%</span>
            </div>
          </div>
        </div>

        <div className="px-3 flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400 font-medium">Clashes Averted</div>
            <div className="text-base font-semibold text-white font-mono flex items-center space-x-1.5">
              <span>42</span>
              <span className="text-[10px] text-cyan-400 font-normal">100% Locked</span>
            </div>
          </div>
        </div>

        <div className="px-3 flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400 font-medium">Waitlist Promotions</div>
            <div className="text-base font-semibold text-white font-mono flex items-center space-x-1.5">
              <span>18</span>
              <span className="text-[10px] text-amber-300 font-normal">Auto-Cascaded</span>
            </div>
          </div>
        </div>

        <div className="px-3 flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400 font-medium">Average Queue Wait</div>
            <div className="text-base font-semibold text-white font-mono flex items-center space-x-1.5">
              <span>14.2 min</span>
              <span className="text-[10px] text-slate-400 font-normal">Expedited</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Minimal Heatmap (Left) + Minimal Trend Sparkline (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Minimal Heatmap Card */}
        <div className="lg:col-span-7 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 shadow-xl backdrop-blur-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 text-xs">
              <span className="font-semibold text-white">Hourly Occupancy Matrix</span>
              <span className="text-slate-400 font-mono text-[11px]">Mon – Sun · 24h</span>
            </div>

            {/* Matrix View with Strict Inline Grid */}
            <div className="overflow-x-auto">
              <div className="min-w-[460px]">
                {/* Hour Header Axis */}
                <div
                  className="text-[9px] font-mono text-slate-500 mb-1.5 select-none"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '36px repeat(24, minmax(0, 1fr))',
                    gap: '2px',
                  }}
                >
                  <div className="text-left text-slate-600 font-semibold">DAY</div>
                  {HOURS.map((h) => (
                    <div key={h} className="text-center">
                      {h % 4 === 0 ? (h === 0 ? '12a' : h === 12 ? '12p' : h < 12 ? `${h}a` : `${h - 12}p`) : '·'}
                    </div>
                  ))}
                </div>

                {/* Day Rows */}
                {DAYS.map((dayName, index) => {
                  const dayIdx = DAY_INDICES[index];
                  const dayCells = SYNTHETIC_HEATMAP_DATA.filter((c) => c.dayOfWeek === dayIdx);

                  return (
                    <div
                      key={dayName}
                      className="items-center mb-1"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '36px repeat(24, minmax(0, 1fr))',
                        gap: '2.5px',
                      }}
                    >
                      <div className="text-[10px] font-medium text-slate-400 select-none">
                        {dayName.slice(0, 3)}
                      </div>
                      {dayCells.map((cell) => (
                        <div
                          key={cell.hour}
                          onMouseEnter={() => setHoveredCell(cell)}
                          onMouseLeave={() => setHoveredCell(null)}
                          style={{ backgroundColor: getCellColor(cell.intensity) }}
                          className="h-3.5 rounded-[2.5px] cursor-pointer transition-transform hover:scale-125 hover:z-20 border border-black/30"
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Interactive Cell Info Footnote */}
          <div className="mt-3 pt-2.5 border-t border-slate-800/60 text-xs min-h-[30px] flex items-center justify-between">
            {hoveredCell ? (
              <div className="flex items-center space-x-2 text-slate-300 text-[11px]">
                <span className="font-semibold text-cyan-400">
                  {hoveredCell.dayName} at {hoveredCell.hour}:00
                </span>
                <span>·</span>
                <span className="font-bold text-white font-mono">{hoveredCell.intensity}% Saturated</span>
                <span>·</span>
                <span className="text-slate-400">
                  {hoveredCell.bookingCount} active reservations ({hoveredCell.peakCategory})
                </span>
              </div>
            ) : (
              <span className="text-slate-500 text-[11px]">
                Hover any cell for hourly saturation details.
              </span>
            )}
          </div>
        </div>

        {/* Right: Minimal Forecast Trend Card */}
        <div className="lg:col-span-5 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 shadow-xl backdrop-blur-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5 text-xs">
              <span className="font-semibold text-white">Demand Forecast Trend</span>
              <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded-full border border-cyan-500/30">
                3-Day MA Model
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mb-2">
              Moving average with projected 72h saturation.
            </p>

            {/* Sparkline Curve */}
            <div className="w-full bg-slate-950/50 rounded-xl border border-slate-800/80 p-2 overflow-hidden">
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-auto">
                <defs>
                  <linearGradient id="appleAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#00f0ff" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Subtle horizontal grid guide */}
                {[30, 60, 90].map((level) => {
                  const y = chartHeight - paddingY - (level / 100) * (chartHeight - paddingY * 2);
                  return (
                    <line
                      key={level}
                      x1={paddingX}
                      y1={y}
                      x2={chartWidth - paddingX}
                      y2={y}
                      stroke="#1e293b"
                      strokeDasharray="3 3"
                    />
                  );
                })}

                {/* Filled gradient area */}
                <path d={areaPath} fill="url(#appleAreaGrad)" />

                {/* Actual line */}
                <path d={actualPath} fill="none" stroke="#00f0ff" strokeWidth="2" />

                {/* Forecast dashed line */}
                <path d={forecastPath} fill="none" stroke="#f97316" strokeWidth="2" strokeDasharray="4 3" />

                {/* Data point dots */}
                {points.map((p, idx) => {
                  const isForecast = idx >= 7;
                  return (
                    <g key={idx}>
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={p.isHighDemand ? 4 : 2.5}
                        fill={isForecast ? '#f97316' : '#00f0ff'}
                      />
                      <text
                        x={p.x}
                        y={chartHeight - 6}
                        fill={isForecast ? '#fb923c' : '#64748b'}
                        fontSize="8.5"
                        textAnchor="middle"
                        fontFamily="monospace"
                      >
                        {p.dayName.slice(0, 3)}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* Minimal High-Demand Alerts */}
          <div className="mt-3 p-2.5 rounded-xl bg-orange-950/20 border border-orange-500/30 text-[11px] flex items-center justify-between">
            <span className="text-orange-300 font-medium flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-orange-400 shrink-0" />
              <span>Projected Peak: Next Tue & Wed (85–89%)</span>
            </span>
            <span className="text-slate-400 font-mono text-[10px]">AI Deadline</span>
          </div>
        </div>
      </div>
    </section>
  );
};
