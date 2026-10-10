export interface HeatmapHourData {
  hour: number; // 0 to 23
  dayOfWeek: number; // 0 (Sun) to 6 (Sat)
  dayName: string;
  intensity: number; // 0 to 100%
  bookingCount: number;
  peakCategory: string;
}

export interface DayForecast {
  dayName: string;
  actual?: number; // Historical moving average %
  forecast?: number; // Predicted %
  isHighDemand?: boolean;
  notes?: string;
}

// Generate realistic 7x24 heatmap data based on university lab usage patterns
export function generateSyntheticHeatmap(): HeatmapHourData[] {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const categories = ['GPU Compute', 'VR Headset', 'DSLR Camera', '3D Printer', 'Microscope'];
  const data: HeatmapHourData[] = [];

  for (let d = 0; d < 7; d++) {
    const isWeekend = d === 0 || d === 6;
    for (let h = 0; h < 24; h++) {
      let base = 0;

      // Closed / overnight: 23:00 - 07:00
      if (h < 7 || h >= 22) {
        base = isWeekend ? 2 : (h >= 22 ? 15 : 5);
      }
      // Morning warmup: 08:00 - 11:00
      else if (h >= 7 && h < 12) {
        base = isWeekend ? 25 : 55 + (d === 1 ? 15 : 0); // Monday spike
      }
      // Peak lab afternoon: 12:00 - 18:00
      else if (h >= 12 && h < 18) {
        base = isWeekend ? 45 : 82 + (d === 4 || d === 5 ? 12 : 5); // Thu/Fri project deadline peak
      }
      // Evening slots: 18:00 - 22:00
      else {
        base = isWeekend ? 30 : 65;
      }

      // Add controlled variation
      const pseudoRandom = Math.sin(d * 13 + h * 7) * 8;
      const intensity = Math.min(100, Math.max(0, Math.round(base + pseudoRandom)));
      const bookingCount = Math.round((intensity / 100) * 12);
      const catIndex = (d + h) % categories.length;

      data.push({
        hour: h,
        dayOfWeek: d,
        dayName: days[d],
        intensity,
        bookingCount,
        peakCategory: categories[catIndex],
      });
    }
  }

  return data;
}

// 7-day trend + 3-day forecast with moving average
export const DEMAND_FORECAST_DATA: DayForecast[] = [
  { dayName: 'Mon', actual: 68 },
  { dayName: 'Tue', actual: 74 },
  { dayName: 'Wed', actual: 79 },
  { dayName: 'Thu', actual: 88, isHighDemand: true, notes: 'Design Studio Submission' },
  { dayName: 'Fri', actual: 92, isHighDemand: true, notes: 'Robotics Demo Day' },
  { dayName: 'Sat', actual: 52 },
  { dayName: 'Sun', actual: 44 },
  { dayName: 'Next Mon', forecast: 76 },
  { dayName: 'Next Tue', forecast: 85, isHighDemand: true, notes: 'AI Milestone Deadline' },
  { dayName: 'Next Wed', forecast: 89, isHighDemand: true, notes: 'Midterm Prototype Review' },
];

export const SYNTHETIC_HEATMAP_DATA = generateSyntheticHeatmap();
