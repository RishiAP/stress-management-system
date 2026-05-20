"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

interface HeartRateCardProps {
  heartRate: number | null;
  history: number[]; // last N values for sparkline
}

export function HeartRateCard({ heartRate, history }: HeartRateCardProps) {
  const isNormal =
    heartRate !== null && heartRate >= 60 && heartRate <= 100;
  const isHigh = heartRate !== null && heartRate > 100;

  const statusColor = !heartRate
    ? "text-muted-foreground"
    : isHigh
      ? "text-rose-500"
      : isNormal
        ? "text-emerald-500"
        : "text-amber-500";

  // Sparkline SVG
  const W = 120;
  const H = 32;
  const pts = history.slice(-20);
  const min = Math.min(...pts, 40);
  const max = Math.max(...pts, 120);
  const range = max - min || 1;

  const points =
    pts.length > 1
      ? pts
          .map((v, i) => {
            const x = (i / (pts.length - 1)) * W;
            const y = H - ((v - min) / range) * H;
            return `${x},${y}`;
          })
          .join(" ")
      : "";

  return (
    <Card>
      <CardHeader className="pb-0 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Heart Rate
        </CardTitle>
        <Heart
          className={cn("h-4 w-4 transition-colors", statusColor)}
          fill={heartRate ? "currentColor" : "none"}
        />
      </CardHeader>
      <CardContent className="pt-3">
        <div className="flex items-end justify-between gap-2">
          <div>
            <span
              className={cn(
                "text-3xl font-bold tabular-nums transition-colors",
                statusColor
              )}
            >
              {heartRate !== null ? Math.round(heartRate) : "--"}
            </span>
            <span className="ml-1 text-sm text-muted-foreground">BPM</span>
          </div>

          {/* Sparkline */}
          {points && (
            <svg
              width={W}
              height={H}
              viewBox={`0 0 ${W} ${H}`}
              className="opacity-60"
            >
              <polyline
                points={points}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                className={statusColor}
              />
            </svg>
          )}
        </div>

        <p className="mt-1 text-xs text-muted-foreground">
          {!heartRate
            ? "Awaiting signal"
            : isHigh
              ? "Elevated — above normal range"
              : isNormal
                ? "Normal range (60–100 BPM)"
                : "Below normal range"}
        </p>
      </CardContent>
    </Card>
  );
}
