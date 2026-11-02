import { useMemo } from "react";
import type { EChartsOption } from "echarts";

import type { RootLocusInfo } from "../types/analysis";
import { formatNumber } from "../lib/format";
import { useEChart } from "./useEChart";

interface RootLocusChartProps {
  locus: RootLocusInfo;
}

const BRANCH_COLORS = ["#4f46e5", "#0ea5e9", "#0d9488", "#d97706", "#7c3aed", "#e11d48"];

function niceSpan(raw: number): number {
  const value = Math.max(raw, 0.5);
  const exponent = Math.floor(Math.log10(value));
  const base = Math.pow(10, exponent);
  const fraction = value / base;
  const steps = [1, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10];
  const step = steps.find((candidate) => fraction <= candidate + 1e-9) ?? 10;
  return step * base;
}

export function RootLocusChart({ locus }: RootLocusChartProps) {
  const option = useMemo<EChartsOption>(() => {
    const points: number[][] = [];
    for (const branch of locus.branches) {
      for (const [re, im] of branch) {
        points.push([re, im]);
      }
    }
    for (const pole of locus.open_loop_poles) {
      points.push([pole.re, pole.im]);
    }
    for (const zero of locus.open_loop_zeros) {
      points.push([zero.re, zero.im]);
    }

    const magnitudes = points.map(([re, im]) => Math.hypot(re, im)).sort((a, b) => a - b);
    const percentile = magnitudes[Math.min(magnitudes.length - 1, Math.floor(magnitudes.length * 0.75))] ?? 1;
    const openScale = Math.max(
      1,
      ...locus.open_loop_poles.map((pole) => Math.hypot(pole.re, pole.im)),
      ...locus.open_loop_zeros.map((zero) => Math.hypot(zero.re, zero.im)),
    );
    const span = niceSpan(Math.max(percentile * 1.2, openScale * 2.2));

    const branchSeries = locus.branches.map((branch, index) => ({
      name: `分支 ${index + 1}`,
      type: "line" as const,
      showSymbol: false,
      data: branch,
      lineStyle: {
        color: BRANCH_COLORS[index % BRANCH_COLORS.length],
        width: 2,
      },
      emphasis: { lineStyle: { width: 3 } },
      markArea:
        index === 0
          ? {
              silent: true,
              itemStyle: { color: "rgba(225, 29, 72, 0.04)" },
              data: [[{ xAxis: 0 }, { xAxis: span }]],
            }
          : undefined,
      markLine:
        index === 0
          ? {
              silent: true,
              symbol: "none",
              label: { show: false },
              lineStyle: { color: "#94a3b8", width: 1 },
              data: [{ yAxis: 0 }],
            }
          : undefined,
    }));

    let crossing: [number, number] | null = null;
    if (locus.critical_gain !== null && locus.gains.length > 0 && locus.branches.length > 0) {
      let index = 0;
      let bestDiff = Number.POSITIVE_INFINITY;
      locus.gains.forEach((gain, i) => {
        const diff = Math.abs(Math.log(gain) - Math.log(locus.critical_gain as number));
        if (diff < bestDiff) {
          bestDiff = diff;
          index = i;
        }
      });
      const candidates = locus.branches
        .map((branch) => branch[index])
        .filter((point): point is number[] => Array.isArray(point));
      if (candidates.length > 0) {
        const top = candidates.reduce((acc, point) => (Math.abs(point[1]) > Math.abs(acc[1]) ? point : acc));
        crossing = [top[0], top[1]];
      }
    }

    const crossingSeries: any[] =
      locus.critical_gain !== null && crossing !== null
        ? [
            {
              name: "临界增益",
              type: "scatter",
              symbolSize: 9,
              data: [crossing],
              itemStyle: { color: "#e11d48", borderColor: "#fff", borderWidth: 1.5 },
              label: {
                show: true,
                position: "top",
                fontSize: 10,
                color: "#e11d48",
                formatter: `K≈${formatNumber(locus.critical_gain, 3)}`,
              },
            },
          ]
        : [];

    return {
      animationDuration: 420,
      grid: { left: 64, right: 26, top: 30, bottom: 46 },
      tooltip: {
        trigger: "item",
        formatter: (params: any) => {
          if (params.seriesType !== "line") {
            return params.seriesName;
          }
          const [re, im] = params.data as [number, number];
          const gain = locus.gains[params.dataIndex];
          const gainText = gain === undefined ? "" : `<br/>K ≈ ${formatNumber(gain, 4)}`;
          return `${params.seriesName}<br/>σ = ${formatNumber(re, 4)}<br/>jω = ${formatNumber(im, 4)}${gainText}`;
        },
      },
      xAxis: {
        type: "value",
        min: -span,
        max: span,
        name: "实部 σ",
        nameLocation: "middle",
        nameGap: 26,
        nameTextStyle: { fontSize: 11, color: "#94a3b8" },
        axisLine: { lineStyle: { color: "#cbd5e1" } },
        axisLabel: { fontSize: 9, color: "#94a3b8", formatter: (value: number) => formatNumber(value, 2) },
        splitLine: { lineStyle: { color: "#f1f4f9" } },
      },
      yAxis: {
        type: "value",
        min: -span,
        max: span,
        name: "虚部 jω",
        nameLocation: "middle",
        nameGap: 44,
        nameTextStyle: { fontSize: 11, color: "#94a3b8" },
        axisLine: { lineStyle: { color: "#cbd5e1" } },
        axisLabel: { fontSize: 9, color: "#94a3b8", formatter: (value: number) => formatNumber(value, 2) },
        splitLine: { lineStyle: { color: "#f1f4f9" } },
      },
      series: [
        ...branchSeries,
        ...crossingSeries,
        {
          name: "开环极点",
          type: "scatter",
          symbol: "diamond",
          symbolSize: 12,
          data: locus.open_loop_poles.map((pole) => [pole.re, pole.im]),
          itemStyle: { color: "#e11d48", borderColor: "#fff", borderWidth: 1 },
        },
        {
          name: "开环零点",
          type: "scatter",
          symbol: "circle",
          symbolSize: 11,
          data: locus.open_loop_zeros.map((zero) => [zero.re, zero.im]),
          itemStyle: { color: "#ffffff", borderColor: "#2563eb", borderWidth: 2 },
        },
      ],
    };
  }, [locus]);

  const ref = useEChart(option);

  return (
    <section className="card chart-card">
      <div className="card-head">
        <h2 className="card-title">根轨迹（K 变化）</h2>
        <span className="card-tag">
          K: {formatNumber(locus.k_min, 3)} → {formatNumber(locus.k_max, 3)}
        </span>
      </div>
      <div ref={ref} className="chart chart-locus" />
      <div className="card-foot">
        <span>红菱为开环极点（K→0）</span>
        <span>蓝圈为开环零点</span>
        {locus.critical_gain !== null ? (
          <span>临界增益 K ≈ {formatNumber(locus.critical_gain, 4)}</span>
        ) : (
          <span>扫描范围内未穿越虚轴</span>
        )}
        {locus.note && <span className="foot-note">{locus.note}</span>}
      </div>
    </section>
  );
}
