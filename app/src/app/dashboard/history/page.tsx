"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { History, TrendingDown, TrendingUp, Minus } from "lucide-react";

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

const CATEGORY_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  "Low Stress": "default",
  "Moderate Stress": "secondary",
  "High Stress": "destructive",
};

export default function HistoryPage() {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  async function load(cursor?: string) {
    const url = cursor
      ? `/api/predictions?limit=20&cursor=${cursor}`
      : "/api/predictions?limit=20";
    const res = await fetch(url);
    const data = await res.json();
    return data as { items: Prediction[]; nextCursor: string | null };
  }

  useEffect(() => {
    void load().then(({ items, nextCursor }) => {
      setPredictions(items);
      setNextCursor(nextCursor);
      setLoading(false);
    });
  }, []);

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    const { items, nextCursor: nc } = await load(nextCursor);
    setPredictions((prev) => [...prev, ...items]);
    setNextCursor(nc);
    setLoadingMore(false);
  }

  function getTrend(idx: number): "up" | "down" | "flat" | null {
    if (idx >= predictions.length - 1) return null;
    const diff =
      predictions[idx].hybridScore - predictions[idx + 1].hybridScore;
    if (Math.abs(diff) < 2) return "flat";
    return diff > 0 ? "up" : "down";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">History</h1>
        <p className="text-sm text-muted-foreground">
          Past stress predictions sorted by time
        </p>
      </div>

      <Separator />

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">
          Loading history…
        </div>
      ) : predictions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-16">
            <History className="h-10 w-10 text-muted-foreground" />
            <CardTitle className="text-base">No predictions yet</CardTitle>
            <CardDescription>
              Connect a device and start streaming to see history
            </CardDescription>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {predictions.map((p, idx) => {
            const trend = getTrend(idx);
            return (
              <Card key={p.id} className="transition-shadow hover:shadow-sm">
                <CardContent className="py-4">
                  <div className="flex items-center gap-4">
                    {/* Score */}
                    <div className="flex-shrink-0 w-16 text-center">
                      <div className="text-2xl font-bold tabular-nums">
                        {Math.round(p.hybridScore)}
                      </div>
                      <div className="text-xs text-muted-foreground">/ 100</div>
                    </div>

                    <Separator orientation="vertical" className="h-10" />

                    {/* Category + trend */}
                    <div className="flex items-center gap-2 flex-shrink-0 w-44">
                      <Badge
                        variant={CATEGORY_VARIANT[p.category] ?? "secondary"}
                      >
                        {p.category}
                      </Badge>
                      {trend === "up" && (
                        <TrendingUp className="h-3.5 w-3.5 text-rose-500" />
                      )}
                      {trend === "down" && (
                        <TrendingDown className="h-3.5 w-3.5 text-emerald-500" />
                      )}
                      {trend === "flat" && (
                        <Minus className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </div>

                    {/* Vitals */}
                    <div className="flex gap-4 text-sm text-muted-foreground flex-1 flex-wrap">
                      {p.heartRate !== null && (
                        <span>
                          ♥ <strong>{Math.round(p.heartRate)}</strong> BPM
                        </span>
                      )}
                      {p.gsrLevel !== null && (
                        <span>
                          GSR <strong>{p.gsrLevel.toFixed(3)}</strong> μS
                        </span>
                      )}
                      {p.temperature !== null && (
                        <span>
                          Temp <strong>{p.temperature.toFixed(1)}</strong>°C
                        </span>
                      )}
                    </div>

                    {/* Timestamp + device */}
                    <div className="text-right text-xs text-muted-foreground flex-shrink-0">
                      <div>{new Date(p.createdAt).toLocaleTimeString()}</div>
                      <div>{new Date(p.createdAt).toLocaleDateString()}</div>
                      {p.device?.name && (
                        <div className="text-muted-foreground/60">
                          {p.device.name}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {nextCursor && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
