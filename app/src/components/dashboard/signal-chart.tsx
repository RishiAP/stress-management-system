"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface DataPoint {
  value: number;
  timestamp: string;
}

interface SignalChartProps {
  title: string;
  unit: string;
  color: string;
  data: DataPoint[];
}

export function SignalChart({ title, unit, color, data }: SignalChartProps) {
  const W = 400;
  const H = 80;
  const pts = data.slice(-40);
  const values = pts.map((d) => d.value);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const range = max - min || 1;
  const latest = pts[pts.length - 1]?.value;

  const pathD =
    pts.length > 1
      ? pts
          .map((d, i) => {
            const x = (i / (pts.length - 1)) * W;
            const y = H - ((d.value - min) / range) * (H - 8) - 4;
            return `${i === 0 ? "M" : "L"} ${x} ${y}`;
          })
          .join(" ")
      : "";

  const areaD =
    pts.length > 1
      ? `${pathD} L ${W} ${H} L 0 ${H} Z`
      : "";

  return (
    <Card>
      <CardHeader className="pb-0 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {latest !== undefined && (
          <span className="text-sm font-semibold tabular-nums" style={{ color }}>
            {latest.toFixed(3)} {unit}
          </span>
        )}
      </CardHeader>
      <CardContent className="pt-3">
        {pts.length === 0 ? (
          <div
            className="flex h-[80px] items-center justify-center rounded-md bg-muted/30 text-xs text-muted-foreground"
          >
            Waiting for data…
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-[80px] w-full overflow-visible"
            preserveAspectRatio="none"
          >
            {/* Area fill */}
            {areaD && (
              <path
                d={areaD}
                fill={color}
                fillOpacity={0.12}
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
          </svg>
        )}
      </CardContent>
    </Card>
  );
}
