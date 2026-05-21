"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface DataPoint {
  value: number;
  timestamp: string;
}

interface SignalChartProps {
  title: string;
  unit: string;
  color: string;
  data: DataPoint[];
  now: number;
  isLive?: boolean;
}

export function SignalChart({ title, unit, color, data, now, isLive = true }: SignalChartProps) {
  const W = 400;
  const H = 100;
  const PADDING_LEFT = 40;
  const PADDING_BOTTOM = 20;
  const CHART_W = W - PADDING_LEFT;
  const CHART_H = H - PADDING_BOTTOM;

  const pts = data.slice(-40);
  const values = pts.map((d) => d.value);
  const min = values.length > 0 ? Math.min(...values) : 0;
  const max = values.length > 0 ? Math.max(...values) : 1;
  const range = max - min || 1;
  const latest = pts[pts.length - 1]?.value;

  const TIME_WINDOW_MS = 3 * 60 * 1000; // 3 minutes
  const start = now - TIME_WINDOW_MS;

  let validPts = pts.filter((d) => new Date(d.timestamp).getTime() >= start);

  // Apply Exponential Moving Average (EMA) smoothing to reduce visual fluctuation
  if (validPts.length > 0) {
    const ALPHA = 0.3; // Smoothing factor (lower = smoother but more lag)
    let ema = validPts[0].value;
    validPts = validPts.map((pt) => {
      ema = ALPHA * pt.value + (1 - ALPHA) * ema;
      return { ...pt, value: ema };
    });
  }

  // Build path
  const pathD =
    validPts.length > 1
      ? validPts
          .map((d, i) => {
            const t = new Date(d.timestamp).getTime();
            const pct = Math.max(0, Math.min(1, (t - start) / TIME_WINDOW_MS));
            const x = PADDING_LEFT + pct * CHART_W;
            const y = ((d.value - min) / range) * (CHART_H - 8);
            const yFlipped = CHART_H - y - 4;
            return `${i === 0 ? "M" : "L"} ${x} ${yFlipped}`;
          })
          .join(" ")
      : "";

  let areaD = "";
  if (validPts.length > 1) {
    const firstPct = Math.max(0, Math.min(1, (new Date(validPts[0].timestamp).getTime() - start) / TIME_WINDOW_MS));
    const lastPct = Math.max(0, Math.min(1, (new Date(validPts[validPts.length - 1].timestamp).getTime() - start) / TIME_WINDOW_MS));
    const firstX = PADDING_LEFT + firstPct * CHART_W;
    const lastX = PADDING_LEFT + lastPct * CHART_W;
    areaD = `${pathD} L ${lastX} ${CHART_H} L ${firstX} ${CHART_H} Z`;
  }

  // Y-axis labels
  const yLabels = [min, min + range / 2, max];

  // Time labels (start, mid, now)
  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };
  
  const timeLabels = [
    { x: PADDING_LEFT, label: formatTime(start) },
    { x: PADDING_LEFT + CHART_W / 2, label: formatTime(start + TIME_WINDOW_MS / 2) },
    { x: PADDING_LEFT + CHART_W, label: "Now" },
  ];

  return (
    <Card>
      <CardHeader className="pb-0 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {latest !== undefined && (
          <span
            className={cn("text-sm font-semibold tabular-nums", isLive ? "" : "text-muted-foreground")}
            style={isLive ? { color } : undefined}
          >
            {latest.toFixed(2)} {unit}
          </span>
        )}
      </CardHeader>
      <CardContent className="pt-3">
        {pts.length === 0 ? (
          <div
            className="flex h-[120px] items-center justify-center rounded-md bg-muted/30 text-xs text-muted-foreground"
          >
            Waiting for data…
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-[120px] w-full overflow-visible"
            preserveAspectRatio="none"
          >
            {/* Y-axis labels */}
            {yLabels.map((val, i) => {
              const y = CHART_H - ((val - min) / range) * (CHART_H - 8) - 4;
              return (
                <text
                  key={i}
                  x={PADDING_LEFT - 4}
                  y={y}
                  textAnchor="end"
                  dominantBaseline="central"
                  className="fill-muted-foreground"
                  style={{ fontSize: "7px" }}
                >
                  {val.toFixed(1)}
                </text>
              );
            })}

            {/* Horizontal grid lines */}
            {yLabels.map((val, i) => {
              const y = CHART_H - ((val - min) / range) * (CHART_H - 8) - 4;
              return (
                <line
                  key={`grid-${i}`}
                  x1={PADDING_LEFT}
                  x2={PADDING_LEFT + CHART_W}
                  y1={y}
                  y2={y}
                  stroke="currentColor"
                  strokeWidth="0.5"
                  strokeDasharray="4 4"
                  className="text-muted-foreground/15"
                />
              );
            })}

            {/* Area fill */}
            {areaD && (
              <path
                d={areaD}
                fill={color}
                fillOpacity={0.08}
              />
            )}
            {/* Line */}
            {pathD && (
              <path
                d={pathD}
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}

            {/* Latest value dot */}
            {validPts.length > 0 && (
              <circle
                cx={PADDING_LEFT + Math.max(0, Math.min(1, (new Date(validPts[validPts.length - 1].timestamp).getTime() - start) / TIME_WINDOW_MS)) * CHART_W}
                cy={CHART_H - ((validPts[validPts.length - 1].value - min) / range) * (CHART_H - 8) - 4}
                r="3"
                fill={color}
              />
            )}

            {/* X-axis time labels */}
            {timeLabels.map((t, i) => (
              <text
                key={`time-${i}`}
                x={t.x}
                y={H - 4}
                textAnchor={i === 0 ? "start" : i === timeLabels.length - 1 ? "end" : "middle"}
                className="fill-muted-foreground"
                style={{ fontSize: "7px" }}
              >
                {t.label}
              </text>
            ))}
          </svg>
        )}
      </CardContent>
    </Card>
  );
}
