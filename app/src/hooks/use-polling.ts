"use client";

import { useQuery } from "@tanstack/react-query";
import { useRef, useState, useEffect, useMemo } from "react";
import api from "@/lib/api";

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
  device: { name: string; isOnline: boolean; lastSeen: string } | null;
}

export interface DeviceInfo {
  name: string;
  isOnline: boolean;
  lastSeen: string;
}

export type DeviceState = "LIVE" | "NOT_WORN" | "OFFLINE";

interface UsePollReturn {
  latest: LatestPrediction | null;
  history: LatestPrediction[];
  isLoading: boolean;
  lastUpdated: Date | null;
  deviceState: DeviceState;
  deviceInfo: DeviceInfo | null;
  now: number;
}

const POLL_INTERVAL_MS = 5000;
const MAX_HISTORY = 60;
const STALE_THRESHOLD_MS = 35000;

async function fetchLatest() {
  const { data } = await api.get<{
    prediction: LatestPrediction | null;
    device: DeviceInfo | null;
  }>("/predictions/latest");
  return data;
}

export function usePolling(): UsePollReturn {
  const [history, setHistory] = useState<LatestPrediction[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const lastIdRef = useRef<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["predictions", "latest"],
    queryFn: fetchLatest,
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: true,
  });

  const prediction = data?.prediction ?? null;
  const deviceInfo = data?.device ?? null;

  // Force re-render every second so relative times and deviceState keep ticking
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Track history
  useEffect(() => {
    if (prediction && prediction.id !== lastIdRef.current) {
      lastIdRef.current = prediction.id;
      setLastUpdated(new Date());
      setHistory((prev) => [prediction, ...prev].slice(0, MAX_HISTORY));
    }
  }, [prediction]);

  // Compute device state
  const deviceState = useMemo<DeviceState>(() => {
    if (deviceInfo?.lastSeen) {
      const deviceAge = now - new Date(deviceInfo.lastSeen).getTime();

      if (deviceAge < STALE_THRESHOLD_MS) {
        if (prediction) {
          const dataAge = now - new Date(prediction.createdAt).getTime();
          return dataAge < STALE_THRESHOLD_MS ? "LIVE" : "NOT_WORN";
        }
        return "NOT_WORN";
      }
    }

    return "OFFLINE";
  }, [deviceInfo, prediction, now]);

  return {
    latest: prediction,
    history,
    isLoading,
    lastUpdated,
    deviceState,
    deviceInfo,
    now,
  };
}
