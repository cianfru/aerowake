import { useMemo } from 'react';
import { ResponsiveContainer, AreaChart, Area, ReferenceLine, YAxis } from 'recharts';

interface SparklineChartProps {
  /** Array of numeric values to plot */
  data: number[];
  /** CSS color string, e.g. 'hsl(var(--success))' */
  color: string;
  /** Height in pixels (default 24) */
  height?: number;
  /** Optional horizontal reference line value */
  referenceLine?: number;
}

/**
 * Minimal sparkline chart — no axes, no grid, no tooltip.
 * Pure visual micro-chart for inline statistics display.
 */
export function SparklineChart({ data, color, height = 24, referenceLine }: SparklineChartProps) {
  const chartData = useMemo(
    () => data.map((value, index) => ({ index, value })),
    [data],
  );

  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  // Add 10% padding to prevent flat lines at edges
  const yMin = min - (max - min) * 0.1;
  const yMax = max + (max - min) * 0.1;

  const gradientId = `sparkline-${color.replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 1, right: 0, bottom: 1, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <YAxis domain={[yMin, yMax]} hide />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#${gradientId})`}
          isAnimationActive={false}
        />
        {referenceLine != null && (
          <ReferenceLine
            y={referenceLine}
            stroke={color}
            strokeDasharray="2 2"
            strokeOpacity={0.4}
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}
