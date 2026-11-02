import { useEffect, useMemo, useState } from "react";

import { BodeChart } from "./components/BodeChart";
import { CoefficientInput } from "./components/CoefficientInput";
import { FormulaView } from "./components/FormulaView";
import { MetricsGrid } from "./components/MetricsGrid";
import { NyquistChart } from "./components/NyquistChart";
import { ParameterSliders } from "./components/ParameterSliders";
import { PoleZeroChart } from "./components/PoleZeroChart";
import { RootLocusChart } from "./components/RootLocusChart";
import { StabilityPanel } from "./components/StabilityPanel";
import { StepResponseChart } from "./components/StepResponseChart";
import { useAnalysis } from "./hooks/useAnalysis";
import { parseCoefficients, toTerms } from "./lib/coefficients";
import { formatNumber } from "./lib/format";
import type { AnalyzeRequest } from "./types/analysis";

type InputMode = "formula" | "coeff";

interface Preset {
  name: string;
  formula: string;
  params?: Record<string, number>;
  note: string;
}

const PRESETS: Preset[] = [
  { name: "积分环节", formula: "1/s", note: "Ⅰ 型，幅频 -20 dB/dec" },
  { name: "微分环节", formula: "s", note: "零点在原点（非真分式）" },
  {
    name: "欠阻尼二阶系统",
    formula: "wn^2/(s^2+2*zeta*wn*s+wn^2)",
    params: { zeta: 0.316, wn: 3.162 },
    note: "ζ=0.32，超调约 35%",
  },
  { name: "临界稳定", formula: "4/(s^2+4)", note: "虚轴极点 ±2j" },
  {
    name: "三阶带零点",
    formula: "(s+1)/(s^3+6*s^2+11*s+6)",
    note: "(s+1)(s+2)(s+3)",
  },
];

const DEFAULT_FORMULA = PRESETS[2].formula;

function readInitial(): { num: string; den: string; formula: string; mode: InputMode } {
  if (typeof window === "undefined") {
    return { num: "10", den: "1 2 10", formula: DEFAULT_FORMULA, mode: "formula" };
  }
  const search = new URLSearchParams(window.location.search);
  const num = search.get("num")?.trim();
  const den = search.get("den")?.trim();
  const formula = search.get("formula")?.trim();
  const hasCoefficients = Boolean(num && den);
  return {
    num: num || "10",
    den: den || "1 2 10",
    formula: formula || DEFAULT_FORMULA,
    mode: hasCoefficients ? "coeff" : "formula",
  };
}

function parseOptionalNumber(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }
  const value = Number(trimmed);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function BlockHead({ index, title, meta }: { index: number; title: string; meta?: string }) {
  return (
    <div className="block-head">
      <span className="block-index">{index}</span>
      <h2 className="block-title">{title}</h2>
      {meta && <span className="block-meta">{meta}</span>}
    </div>
  );
}

export default function App() {
  const initial = useMemo(readInitial, []);
  const [mode, setMode] = useState<InputMode>(initial.mode);
  const [formulaText, setFormulaText] = useState(initial.formula);
  const [params, setParams] = useState<Record<string, number>>(PRESETS[2].params ?? {});
  const [numText, setNumText] = useState(initial.num);
  const [denText, setDenText] = useState(initial.den);
  const [band, setBand] = useState(0.02);
  const [tEndText, setTEndText] = useState("");
  const [omegaMinText, setOmegaMinText] = useState("");
  const [omegaMaxText, setOmegaMaxText] = useState("");
  const [kMinText, setKMinText] = useState("");
  const [kMaxText, setKMaxText] = useState("");

  const num = useMemo(() => parseCoefficients(numText), [numText]);
  const den = useMemo(() => parseCoefficients(denText), [denText]);

  const tEnd = useMemo(() => parseOptionalNumber(tEndText), [tEndText]);
  const omegaMin = useMemo(() => parseOptionalNumber(omegaMinText), [omegaMinText]);
  const omegaMax = useMemo(() => parseOptionalNumber(omegaMaxText), [omegaMaxText]);
  const kMin = useMemo(() => parseOptionalNumber(kMinText), [kMinText]);
  const kMax = useMemo(() => parseOptionalNumber(kMaxText), [kMaxText]);

  const request = useMemo<AnalyzeRequest | null>(() => {
    const options = {
      settling_band: band,
      t_end: tEnd,
      omega_min: omegaMin,
      omega_max: omegaMax,
      k_min: kMin,
      k_max: kMax,
    };

    if (mode === "formula") {
      const text = formulaText.trim();
      if (!text) {
        return null;
      }
      return { formula: text, params, options };
    }

    if (num.error || den.error || num.values.length === 0 || den.values.length === 0) {
      return null;
    }
    return { num: num.values, den: den.values, options };
  }, [mode, formulaText, params, num, den, band, tEnd, omegaMin, omegaMax, kMin, kMax]);

  const { data, error, loading } = useAnalysis(request);

  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  useEffect(() => {
    if (data) {
      setUpdatedAt(new Date().toLocaleTimeString("zh-CN", { hour12: false }));
    }
  }, [data]);

  // 服务端解析出来的参数补进本地 state（只补缺失项，避免请求循环）
  useEffect(() => {
    const incoming = data?.parameters ?? [];
    if (incoming.length === 0) {
      return;
    }
    setParams((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const item of incoming) {
        if (!(item.name in next)) {
          next[item.name] = item.value;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [data]);

  const applyPreset = (preset: Preset) => {
    setMode("formula");
    setFormulaText(preset.formula);
    setParams(preset.params ?? {});
  };

  const switchMode = (next: InputMode) => {
    if (next === mode) {
      return;
    }
    if (next === "coeff" && data) {
      setNumText(data.transfer_function.num.map((value) => String(value)).join(" "));
      setDenText(data.transfer_function.den.map((value) => String(value)).join(" "));
    }
    setMode(next);
  };

  const updateParam = (name: string, value: number) => {
    setParams((prev) => ({ ...prev, [name]: value }));
  };

  const properTag = data
    ? data.transfer_function.is_strictly_proper
      ? "严格真分式"
      : data.transfer_function.is_proper
        ? "真分式"
        : "非真分式"
    : "";

  const coefficientError = num.error ?? den.error;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">CL</span>
          <div>
            <h1 className="brand-title">ControlLab</h1>
            <p className="brand-subtitle">线性连续系统 · 经典控制理论分析</p>
          </div>
        </div>
        <div className="topbar-right">
          <span className="version-chip">v0.3.0</span>
          <span className={`status-chip ${loading ? "status-busy" : error ? "status-bad" : "status-ok"}`}>
            <span className="status-dot" />
            {loading ? "计算中" : error ? "解析异常" : "实时分析"}
          </span>
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <section className="card">
            <div className="card-head">
              <h2 className="card-title">系统输入</h2>
              <div className="mode-switch">
                <button
                  className={`mode-tab ${mode === "formula" ? "mode-active" : ""}`}
                  onClick={() => switchMode("formula")}
                >
                  公式
                </button>
                <button
                  className={`mode-tab ${mode === "coeff" ? "mode-active" : ""}`}
                  onClick={() => switchMode("coeff")}
                >
                  系数
                </button>
              </div>
            </div>

            {mode === "formula" ? (
              <>
                <textarea
                  className="formula-input"
                  rows={3}
                  spellCheck={false}
                  value={formulaText}
                  onChange={(event) => setFormulaText(event.target.value)}
                  placeholder="例如 K/(s*(s+1)) 或 10/(s^2+2*s+10)"
                />
                <p className="formula-help">s、数字、+ − × ÷ ^ 与括号；其余标识符当作未知参数，自动生成滑块。</p>
                {error && <p className="field-error">{error}</p>}
                <ParameterSliders
                  parameters={data?.parameters ?? []}
                  values={params}
                  onChange={updateParam}
                />
              </>
            ) : (
              <>
                <CoefficientInput
                  label="分子 N(s)"
                  hint="空格或逗号分隔"
                  value={numText}
                  onChange={setNumText}
                  error={num.error}
                  terms={toTerms(num.values)}
                />
                <CoefficientInput
                  label="分母 D(s)"
                  hint="即特征方程系数"
                  value={denText}
                  onChange={setDenText}
                  error={den.error}
                  terms={toTerms(den.values)}
                />
                {coefficientError && <p className="field-error">{coefficientError}</p>}
              </>
            )}
          </section>

          <section className="card">
            <div className="card-head">
              <h2 className="card-title">参数</h2>
              <span className="card-tag">留空即自动</span>
            </div>

            <div className="param-row">
              <label className="param-label">误差带</label>
              <select
                className="select-input"
                value={band}
                onChange={(event) => setBand(Number(event.target.value))}
              >
                <option value={0.02}>±2%</option>
                <option value={0.05}>±5%</option>
                <option value={0.1}>±10%</option>
              </select>
            </div>

            <div className="param-row">
              <label className="param-label">仿真时长</label>
              <input
                className="text-input text-input-sm"
                value={tEndText}
                placeholder="自动"
                onChange={(event) => setTEndText(event.target.value)}
              />
            </div>

            <div className="param-group">
              <span className="param-group-title">频率范围 ω (rad/s)</span>
              <div className="param-pair">
                <label className="param-mini">
                  <span>ω_min</span>
                  <input
                    className="text-input text-input-sm"
                    value={omegaMinText}
                    placeholder="自动"
                    onChange={(event) => setOmegaMinText(event.target.value)}
                  />
                </label>
                <label className="param-mini">
                  <span>ω_max</span>
                  <input
                    className="text-input text-input-sm"
                    value={omegaMaxText}
                    placeholder="自动"
                    onChange={(event) => setOmegaMaxText(event.target.value)}
                  />
                </label>
              </div>
            </div>

            <div className="param-group">
              <span className="param-group-title">根轨迹增益 K</span>
              <div className="param-pair">
                <label className="param-mini">
                  <span>K_min</span>
                  <input
                    className="text-input text-input-sm"
                    value={kMinText}
                    placeholder="自动"
                    onChange={(event) => setKMinText(event.target.value)}
                  />
                </label>
                <label className="param-mini">
                  <span>K_max</span>
                  <input
                    className="text-input text-input-sm"
                    value={kMaxText}
                    placeholder="自动"
                    onChange={(event) => setKMaxText(event.target.value)}
                  />
                </label>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <h2 className="card-title">快速预设</h2>
            </div>
            <div className="preset-list">
              {PRESETS.map((preset) => (
                <button key={preset.name} className="preset" onClick={() => applyPreset(preset)}>
                  <span className="preset-name">{preset.name}</span>
                  <span className="preset-note">{preset.note}</span>
                </button>
              ))}
            </div>
          </section>
        </aside>

        <main className="content">
          {error && !loading && mode === "coeff" && (
            <div className="alert">
              <strong>分析失败</strong>
              <span>{error}</span>
            </div>
          )}

          {data && (
            <>
              <section className="analysis-block">
                <BlockHead
                  index={1}
                  title="传递函数"
                  meta={`${properTag}${updatedAt ? ` · 已更新 ${updatedAt}` : ""}`}
                />
                <div className="card">
                  <FormulaView
                    numExpr={data.transfer_function.num_expr}
                    denExpr={data.transfer_function.den_expr}
                    quotientExpr={data.transfer_function.quotient_expr}
                  />
                  <div className="formula-meta">
                    <span>分子 {data.transfer_function.num_degree} 次</span>
                    <span>分母 {data.transfer_function.den_degree} 次</span>
                    <span>极点 {data.poles.length} 个</span>
                    <span>零点 {data.zeros.length} 个</span>
                    {data.parameters.length > 0 && (
                      <span>参数 {data.parameters.map((item) => `${item.name}=${formatNumber(item.value, 4)}`).join("，")}</span>
                    )}
                  </div>
                </div>
              </section>

              <section className="analysis-block">
                <BlockHead index={2} title="Routh 判据" meta="Routh-Hurwitz 代数判据" />
                <StabilityPanel
                  stability={data.stability}
                  characteristicExpr={data.transfer_function.den_expr}
                  warnings={data.warnings}
                />
              </section>

              <section className="analysis-block">
                <BlockHead index={3} title="时域分析" meta="单位阶跃响应" />
                <MetricsGrid metrics={data.time_response.metrics} band={band} />
                <StepResponseChart
                  t={data.time_response.t}
                  y={data.time_response.y}
                  metrics={data.time_response.metrics}
                  band={band}
                />
              </section>

              <section className="analysis-block">
                <BlockHead
                  index={4}
                  title="频域分析"
                  meta={`ω ${formatNumber(data.frequency.omega_min, 3)} – ${formatNumber(data.frequency.omega_max, 3)} rad/s`}
                />
                <div className="chart-grid">
                  <BodeChart frequency={data.frequency} />
                  <NyquistChart frequency={data.frequency} />
                </div>
              </section>

              <section className="analysis-block">
                <BlockHead index={5} title="增益 K 变化时的根轨迹" meta="D(s)+K·N(s)=0" />
                <div className="chart-grid">
                  <RootLocusChart locus={data.root_locus} />
                  <PoleZeroChart poles={data.poles} zeros={data.zeros} />
                </div>
              </section>
            </>
          )}

          {!data && !error && (
            <section className="card empty-state">
              <h2>开始分析</h2>
              <p>在左侧输入传递函数表达式，例如 10/(s^2+2*s+10)，或写成带参数的形式 K/(s*(s+1))。</p>
              <p>出现未知参数时会自动生成滑块，拖动即可实时看到稳定性、时域、频域与根轨迹的变化。</p>
            </section>
          )}
        </main>
      </div>

      <footer className="statusbar">
        <span>ControlLab v0.3.0 · 公式编辑 / 参数滑块 / 传递函数 / Routh / 时域 / 频域 / 根轨迹</span>
        <span>框图编辑器与 Mason 增益公式将在后续版本加入</span>
      </footer>
    </div>
  );
}
