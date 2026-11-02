import type { AnalysisResponse, AnalyzeRequest } from "../types/analysis";

function describeError(status: number, detail: unknown): string {
  if (typeof detail === "string") {
    return detail;
  }
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { msg?: string; loc?: unknown[] };
    if (first?.msg) {
      return first.msg;
    }
  }
  return `请求失败（HTTP ${status}）`;
}

export async function analyzeSystem(
  payload: AnalyzeRequest,
  signal?: AbortSignal,
): Promise<AnalysisResponse> {
  const response = await fetch("/api/v1/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(describeError(response.status, body?.detail));
  }

  return (await response.json()) as AnalysisResponse;
}
