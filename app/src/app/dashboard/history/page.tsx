"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, History } from "lucide-react";

interface Prediction {
  id: string;
  hybridScore: number;
  category: string;
  physiologicalScore: number;
  heartRate: number | null;
  gsrLevel: number | null;
  temperature: number | null;
  createdAt: string;
  device: { name: string } | null;
}

type TimeRange = "1h" | "6h" | "24h" | "7d" | "30d";

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: "1h", label: "1H" },
  { value: "6h", label: "6H" },
  { value: "24h", label: "24H" },
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
];

async function fetchHistory(range: TimeRange) {
  const { data } = await api.get<{ items: Prediction[]; nextCursor: string | null }>(
    `/predictions?range=${range}&limit=500`
  );
  return data.items;
}

// ─── Interactive Time-Series Chart ──────────────────────────────────────────
function InteractiveChart({
  data,
  color,
  title,
  unit,
  timeRangeMs,
  now,
  formatValue,
}: {
  data: { value: number; time: string }[];
  color: string;
  title: string;
  unit: string;
  timeRangeMs: number;
  now: number;
  formatValue?: (v: number) => string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverInfo, setHoverInfo] = useState<{
    value: number;
    time: string;
    pctX: number; // 0-1 across the container width
    pctY: number; // 0-1 across the container height
  } | null>(null);

  const W = 600;
  const H = 160;
  const PL = 50; // padding left
  const PR = 10; // padding right
  const PT = 10; // padding top
  const PB = 28; // padding bottom
  const CW = W - PL - PR;
  const CH = H - PT - PB;

  const fmt = formatValue ?? ((v: number) => v.toFixed(1));

  if (data.length < 2) {
    return (
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="flex h-[160px] items-center justify-center rounded-md bg-muted/30 text-sm text-muted-foreground">
            Not enough data
          </div>
        </CardContent>
      </Card>
    );
  }

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const latest = values[values.length - 1];
  const avg = values.reduce((s, v) => s + v, 0) / values.length;

  // Use absolute time domain from passed `now` state
  const start = now - timeRangeMs;
  
  const toX = (timeStr: string) => {
    const t = new Date(timeStr).getTime();
    const pct = (t - start) / timeRangeMs;
    // clamp between 0 and 1
    const clampedPct = Math.max(0, Math.min(1, pct));
    return PL + clampedPct * CW;
  };
  const toY = (v: number) => PT + CH - ((v - min) / range) * CH;

  // Filter out data points that are before the start time
  const validData = data.filter((d) => new Date(d.time).getTime() >= start);
  
  if (validData.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="flex h-[160px] items-center justify-center rounded-md bg-muted/30 text-sm text-muted-foreground">
            No data in this time range
          </div>
        </CardContent>
      </Card>
    );
  }

  // Group data into continuous segments (break if gap > 60 seconds)
  const MAX_GAP_MS = 60 * 1000;
  const segments: typeof validData[] = [];
  let currentSegment: typeof validData = [];

  for (let i = 0; i < validData.length; i++) {
    const pt = validData[i];
    if (currentSegment.length === 0) {
      currentSegment.push(pt);
    } else {
      const prevTime = new Date(currentSegment[currentSegment.length - 1].time).getTime();
      const currTime = new Date(pt.time).getTime();
      if (currTime - prevTime > MAX_GAP_MS) {
        segments.push(currentSegment);
        currentSegment = [pt];
      } else {
        currentSegment.push(pt);
      }
    }
  }
  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  // Generate path and area for each segment
  const segmentPaths = segments.map((seg) => {
    const pathD = seg
      .map((d, i) => `${i === 0 ? "M" : "L"} ${toX(d.time)} ${toY(d.value)}`)
      .join(" ");

    const firstX = toX(seg[0].time);
    const lastX = toX(seg[seg.length - 1].time);
    const areaD = `${pathD} L ${lastX} ${PT + CH} L ${firstX} ${PT + CH} Z`;

    return { pathD, areaD };
  });

  // Y-axis labels
  const yTicks = [min, min + range * 0.5, max];

  // X-axis time labels (Now, and fractions of range)
  const xTickTimes = [start, start + timeRangeMs / 4, start + timeRangeMs / 2, start + 3 * timeRangeMs / 4, now];
  
  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };
  const formatFullTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pctX = (e.clientX - rect.left) / rect.width;

    // Map pctX to SVG coordinates to find chart area
    const svgX = pctX * W;
    if (svgX < PL || svgX > PL + CW) {
      setHoverInfo(null);
      return;
    }

    // Find the closest data point based on time
    const targetTime = start + ((svgX - PL) / CW) * timeRangeMs;
    
    let closestPt = validData[0];
    let minDiff = Infinity;
    for (const pt of validData) {
      const ptTime = new Date(pt.time).getTime();
      const diff = Math.abs(ptTime - targetTime);
      if (diff < minDiff) {
        minDiff = diff;
        closestPt = pt;
      }
    }

    const actualSvgX = toX(closestPt.time);
    const svgY = toY(closestPt.value);
    
    setHoverInfo({
      value: closestPt.value,
      time: closestPt.time,
      pctX: actualSvgX / W,
      pctY: svgY / H,
    });
  };

  return (
    <Card>
      <CardHeader className="pb-1 flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          <div className="flex items-center gap-4 mt-1">
            <span className="text-xl font-bold tabular-nums" style={{ color }}>
              {fmt(latest)}
              <span className="text-xs font-normal text-muted-foreground ml-1">
                {unit}
              </span>
            </span>
            <span className="text-xs text-muted-foreground">
              Avg {fmt(avg)} · Min {fmt(Math.min(...values))} · Max{" "}
              {fmt(Math.max(...values))}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-2">
        <div
          ref={containerRef}
          className="relative cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverInfo(null)}
        >
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full overflow-visible"
            style={{ height: 160 }}
            preserveAspectRatio="none"
          >
            {/* Y-axis grid */}
            {yTicks.map((val, i) => (
              <line
                key={`y-${i}`}
                x1={PL}
                x2={PL + CW}
                y1={toY(val)}
                y2={toY(val)}
                stroke="currentColor"
                strokeWidth="0.5"
                strokeDasharray="4 4"
                className="text-muted-foreground/15"
              />
            ))}

            {/* Segments (Area and Line) */}
            {segmentPaths.map((seg, i) => (
              <g key={`seg-${i}`}>
                <path d={seg.areaD} fill={color} fillOpacity={0.06} />
                <path
                  d={seg.pathD}
                  fill="none"
                  stroke={color}
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </g>
            ))}

            {/* Hover crosshair (vertical line only) */}
            {hoverInfo && (
              <line
                x1={hoverInfo.pctX * W}
                x2={hoverInfo.pctX * W}
                y1={PT}
                y2={PT + CH}
                stroke="currentColor"
                strokeWidth="1"
                strokeDasharray="3 3"
                className="text-muted-foreground/40"
              />
            )}
          </svg>

          {/* Y-axis labels (HTML overlay, not distorted) */}
          {yTicks.map((val, i) => (
            <span
              key={`yl-${i}`}
              className="absolute text-[10px] text-muted-foreground pointer-events-none"
              style={{
                left: 0,
                top: `${(toY(val) / H) * 100}%`,
                transform: "translateY(-50%)",
              }}
            >
              {fmt(val)}
            </span>
          ))}

          {/* X-axis labels (HTML overlay) */}
          {xTickTimes.map((timeMs, i) => (
            <span
              key={`xl-${i}`}
              className="absolute text-[10px] text-muted-foreground pointer-events-none"
              style={{
                bottom: 0,
                left: `${( (PL + ((timeMs - start) / timeRangeMs) * CW) / W ) * 100}%`,
                transform:
                  i === 0
                    ? "translateX(0)"
                    : i === xTickTimes.length - 1
                      ? "translateX(-100%)"
                      : "translateX(-50%)",
              }}
            >
              {i === xTickTimes.length - 1 ? "Now" : formatTime(timeMs)}
            </span>
          ))}

          {/* HTML Tooltip */}
          {hoverInfo && (
            <>
              {/* Dot */}
              <div
                className="absolute w-3 h-3 rounded-full border-2 border-white pointer-events-none"
                style={{
                  left: `${hoverInfo.pctX * 100}%`,
                  top: `${hoverInfo.pctY * 100}%`,
                  transform: "translate(-50%, -50%)",
                  backgroundColor: color,
                  boxShadow: `0 0 6px ${color}`,
                }}
              />
              {/* Tooltip card */}
              <div
                className="absolute z-50 pointer-events-none bg-popover text-popover-foreground border rounded-lg px-3 py-2 shadow-lg"
                style={{
                  left: `${hoverInfo.pctX * 100}%`,
                  top: `${hoverInfo.pctY * 100}%`,
                  transform:
                    hoverInfo.pctX > 0.7
                      ? "translate(-110%, -110%)"
                      : "translate(10%, -110%)",
                }}
              >
                <p className="text-sm font-bold tabular-nums" style={{ color }}>
                  {fmt(hoverInfo.value)} {unit}
                </p>
                <p className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {formatFullTime(hoverInfo.time)}
                </p>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Skeleton Loader ────────────────────────────────────────────────────────
function ChartSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-1">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-6 w-48 mt-2" />
      </CardHeader>
      <CardContent className="pt-2">
        <Skeleton className="h-[160px] w-full rounded-md" />
      </CardContent>
    </Card>
  );
}

export default function HistoryPage() {
  const [range, setRange] = useState<TimeRange>("24h");

  // Force chart to pan left as time ticks
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const { data: predictions, isLoading } = useQuery({
    queryKey: ["predictions", "history", range],
    queryFn: () => fetchHistory(range),
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  });

  // Reverse for chronological order (oldest → newest)
  const sorted = predictions ? [...predictions].reverse() : [];

  const stressData = sorted.map((p) => ({
    value: p.hybridScore,
    time: p.createdAt,
  }));
  const hrData = sorted
    .filter((p) => p.heartRate !== null)
    .map((p) => ({ value: p.heartRate as number, time: p.createdAt }));
  const gsrData = sorted
    .filter((p) => p.gsrLevel !== null)
    .map((p) => ({ value: p.gsrLevel as number, time: p.createdAt }));
  const tempData = sorted
    .filter((p) => p.temperature !== null)
    .map((p) => ({ value: p.temperature as number, time: p.createdAt }));

  const msMap: Record<TimeRange, number> = {
    "1h": 60 * 60 * 1000,
    "6h": 6 * 60 * 60 * 1000,
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
  };
  const timeRangeMs = msMap[range];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <History className="h-6 w-6" />
            History
          </h1>
          <p className="text-sm text-muted-foreground">
            Physiological trends and stress analysis over time
          </p>
        </div>

        {/* Time range selector */}
        <div className="flex items-center gap-1 rounded-lg border p-1 bg-muted/30">
          {TIME_RANGES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setRange(value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                range === value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <Separator />

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <ChartSkeleton />
            <ChartSkeleton />
            <ChartSkeleton />
            <ChartSkeleton />
          </div>
        </div>
      ) : !predictions || predictions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-16">
            <Activity className="h-10 w-10 text-muted-foreground" />
            <CardTitle className="text-base">
              No data for this time range
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Try selecting a wider range or connect your device to start
              streaming.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <InteractiveChart
            data={stressData}
            color="#ef4444"
            title="Stress Score"
            unit="/ 100"
            timeRangeMs={timeRangeMs}
            now={now}
            formatValue={(v) => Math.round(v).toString()}
          />
          <InteractiveChart
            data={hrData}
            color="#3b82f6"
            title="Heart Rate"
            unit="BPM"
            timeRangeMs={timeRangeMs}
            now={now}
            formatValue={(v) => Math.round(v).toString()}
          />
          <InteractiveChart
            data={gsrData}
            color="#8b5cf6"
            title="GSR / Skin Conductance"
            unit="μS"
            timeRangeMs={timeRangeMs}
            now={now}
            formatValue={(v) => v.toFixed(3)}
          />
          <InteractiveChart
            data={tempData}
            color="#f97316"
            title="Skin Temperature"
            unit="°C"
            timeRangeMs={timeRangeMs}
            now={now}
            formatValue={(v) => v.toFixed(1)}
          />
        </div>
      )}

      {/* Data point count */}
      {predictions && predictions.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          Showing {predictions.length} data points · Hover over charts for
          details
        </p>
      )}
    </div>
  );
}
