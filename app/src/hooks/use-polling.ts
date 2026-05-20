"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface LatestPrediction {
  id: string;
  hybridScore: number;
  category: "Low Stress" | "Moderate Stress" | "High Stress";
  physiologicalScore: number;
  dassModifier: number;
  heartRate: number | null;
  gsrLevel: number | null;
  temperature: number | null;
  deviceId: string | null;
  createdAt: string;
  device: { name: string; isOnline: boolean } | null;
}

interface UsePollReturn {
  latest: LatestPrediction | null;
  /** Last N predictions kept in memory for sparklines/charts */
  history: LatestPrediction[];
  isLoading: boolean;
  lastUpdated: Date | null;
}

const POLL_INTERVAL_MS = 5000;
const MAX_HISTORY = 60; // ~30 min of 30s windows

export function usePolling(): UsePollReturn {
  const [latest, setLatest] = useState<LatestPrediction | null>(null);
  const [history, setHistory] = useState<LatestPrediction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Track the last seen prediction id to avoid duplicate pushes into history
  const lastIdRef = useRef<string | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/predictions/latest", { cache: "no-store" });
      if (!res.ok) return;

      const data: LatestPrediction | null = await res.json();
      if (!data) return;

      setLatest(data);
      setLastUpdated(new Date());

      // Only push to history when there's a genuinely new prediction
      if (data.id !== lastIdRef.current) {
        lastIdRef.current = data.id;
        setHistory((prev) => {
          const next = [data, ...prev];
          return next.slice(0, MAX_HISTORY);
        });
      }
    } catch {
      // Network error — silently ignore, next poll will retry
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void poll(); // initial fetch on mount
    const id = setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [poll]);

  return { latest, history, isLoading, lastUpdated };
}
