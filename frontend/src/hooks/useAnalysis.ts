import { useEffect, useRef, useState } from "react";

import { analyzeSystem } from "../api/client";
import type { AnalysisResponse, AnalyzeRequest } from "../types/analysis";

interface AnalysisState {
  data: AnalysisResponse | null;
  error: string | null;
  loading: boolean;
}

export function useAnalysis(request: AnalyzeRequest | null): AnalysisState {
  const [data, setData] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const cache = useRef<Record<string, AnalysisResponse>>({});

  const key = request ? JSON.stringify(request) : null;

  useEffect(() => {
    if (!request || key === null) {
      setLoading(false);
      return;
    }

    if (cache.current[key]) {
      setData(cache.current[key]);
      setError(null);
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    const timer = window.setTimeout(async () => {
      try {
        const result = await analyzeSystem(request, controller.signal);
        cache.current[key] = result;
        if (!controller.signal.aborted) {
          setData(result);
          setError(null);
        }
      } catch (caught) {
        if (controller.signal.aborted) {
          return;
        }
        setError(caught instanceof Error ? caught.message : "未知错误");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 160);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { data, error, loading };
}
