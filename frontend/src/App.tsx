import { useEffect, useMemo, useState } from "react";
import { useEdgesState, useNodesState, type Edge, type Node } from "@xyflow/react";

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
import { DiagramCanvas, EDGE_DEFAULTS } from "./components/diagram/DiagramCanvas";
import { MasonPanel } from "./components/diagram/MasonPanel";
import { useAnalysis } from "./hooks/useAnalysis";
import { parseCoefficients, toTerms } from "./lib/coefficients";
import { formatNumber } from "./lib/format";
import type { AnalyzeRequest } from "./types/analysis";
import { NODE_LABELS, type DiagramNodeData, type DiagramNodeKind, type DiagramPayload } from "./types/diagram";

type InputMode = "formula" | "coeff";
type WorkMode = "expression" | "unity" | "diagram";

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
    formula: "(s+1)/(s^3+6*s^2+11*s+3)",
    note: "(s+1)(s+1.6)(s+1.9)",
  },
  {
    name: "开环 Ⅰ 型三阶",
    formula: "2/(s*(s+1)*(s+2))",
    note: "单位负反馈：γ≈32.6°，Kg≈9.5 dB",
  },
];

const BLOCK_PRESETS: { name: string; formula: string }[] = [
  { name: "比例 K", formula: "K" },
  { name: "积分 1/s", formula: "1/s" },
  { name: "惯性 1/(Ts+1)", formula: "1/(T*s+1)" },
  { name: "微分 s", formula: "s" },
  { name: "二阶 ωn²/(s²+2ζωn s+ωn²)", formula: "wn^2/(s^2+2*zeta*wn*s+wn^2)" },
  { name: "超前/滞后 (Ts+1)/(aTs+1)", formula: "(T*s+1)/(a*T*s+1)" },
  { name: "纯增益 1", formula: "1" },
];

const DEFAULT_FORMULA = PRESETS[2].formula;

function defaultLabel(kind: DiagramNodeKind): string {
  switch (kind) {
    case "input":
      return "R(s)";
    case "output":
      return "Y(s)";
    case "sum":
      return "E(s)";
    case "block":
      return "G";
    default:
      return "";
  }
}

const INITIAL_NODES: Node<DiagramNodeData>[] = [
  { id: "r", type: "diagram", position: { x: 20, y: 150 }, data: { kind: "input", label: "R(s)" } },
  { id: "sum", type: "diagram", position: { x: 175, y: 150 }, data: { kind: "sum", label: "E(s)" } },
  { id: "g", type: "diagram", position: { x: 285, y: 142 }, data: { kind: "block", label: "G(s)", formula: "1/(s+1)" } },
  { id: "t", type: "diagram", position: { x: 470, y: 155 }, data: { kind: "takeoff", label: "" } },
  { id: "y", type: "diagram", position: { x: 585, y: 150 }, data: { kind: "output", label: "Y(s)" } },
  {
    id: "h",
    type: "diagram",
    position: { x: 330, y: 330 },
    data: { kind: "block", label: "H(s)", formula: "2", flipped: true },
  },
];

const INITIAL_EDGES: Edge[] = [
  { id: "e1", source: "r", target: "sum", sourceHandle: "out", targetHandle: "in", ...EDGE_DEFAULTS, data: { sign: 1, signed: true } },
  { id: "e2", source: "sum", target: "g", sourceHandle: "out", targetHandle: "in", ...EDGE_DEFAULTS, data: { sign: 1, signed: false } },
  { id: "e3", source: "g", target: "t", sourceHandle: "out", targetHandle: "in", ...EDGE_DEFAULTS, data: { sign: 1, signed: false } },
  { id: "e4", source: "t", target: "y", sourceHandle: "out", targetHandle: "in", ...EDGE_DEFAULTS, data: { sign: 1, signed: false } },
  { id: "e5", source: "t", target: "h", sourceHandle: "out-bottom", targetHandle: "in", ...EDGE_DEFAULTS, data: { sign: 1, signed: false } },
  { id: "e6", source: "h", target: "sum", sourceHandle: "out", targetHandle: "in-bottom", ...EDGE_DEFAULTS, data: { sign: -1, signed: true } },
];

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

function toDiagramPayload(nodes: Node<DiagramNodeData>[], edges: Edge[]): DiagramPayload {
  return {
    nodes: nodes.map((node) => ({
      id: node.id,
      kind: node.data.kind,
      label: node.data.label || undefined,
      formula: node.data.kind === "block" ? node.data.formula || "1" : undefined,
    })),
    edges: edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
      sign: (edge.data?.sign as number) ?? 1,
    })),
  };
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
  const [workMode, setWorkMode] = useState<WorkMode>(() => {
    if (typeof window === "undefined") {
      return "expression";
    }
    const mode = new URLSearchParams(window.location.search).get("mode");
    if (mode === "diagram" || mode === "unity") {
      return mode;
    }
    return "expression";
  });
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

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<DiagramNodeData>>(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const num = useMemo(() => parseCoefficients(numText), [numText]);
  const den = useMemo(() => parseCoefficients(denText), [denText]);

  const tEnd = useMemo(() => parseOptionalNumber(tEndText), [tEndText]);
  const omegaMin = useMemo(() => parseOptionalNumber(omegaMinText), [omegaMinText]);
  const omegaMax = useMemo(() => parseOptionalNumber(omegaMaxText), [omegaMaxText]);
  const kMin = useMemo(() => parseOptionalNumber(kMinText), [kMinText]);
  const kMax = useMemo(() => parseOptionalNumber(kMaxText), [kMaxText]);

  const options = useMemo(
    () => ({
      settling_band: band,
      t_end: tEnd,
      omega_min: omegaMin,
      omega_max: omegaMax,
      k_min: kMin,
      k_max: kMax,
    }),
    [band, tEnd, omegaMin, omegaMax, kMin, kMax],
  );

  const diagramPayload = useMemo(() => toDiagramPayload(nodes, edges), [nodes, edges]);

  const request = useMemo<AnalyzeRequest | null>(() => {
    if (workMode === "diagram") {
      if (diagramPayload.nodes.length === 0) {
        return null;
      }
      return { diagram: diagramPayload, params, options };
    }

    const analysisMode = workMode === "unity" ? "unity" : "closed";

    if (mode === "formula") {
      const text = formulaText.trim();
      if (!text) {
        return null;
      }
      return { formula: text, params, options, analysis_mode: analysisMode };
    }

    if (num.error || den.error || num.values.length === 0 || den.values.length === 0) {
      return null;
    }
    return { num: num.values, den: den.values, options, analysis_mode: analysisMode };
  }, [workMode, diagramPayload, mode, formulaText, params, num, den, options]);

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
    setWorkMode("expression");
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

  const addNode = (kind: DiagramNodeKind) => {
    const count = nodes.length;
    const id = `${kind}-${Math.random().toString(36).slice(2, 7)}`;
    const node: Node<DiagramNodeData> = {
      id,
      type: "diagram",
      position: { x: 60 + (count % 4) * 150, y: 60 + Math.floor(count / 4) * 110 },
      data: { kind, label: defaultLabel(kind), formula: kind === "block" ? "1" : undefined },
    };
    setNodes((current) => [...current, node]);
    setSelectedNodeId(id);
  };

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null;

  const updateSelected = (patch: Partial<DiagramNodeData>) => {
    if (!selectedNode) {
      return;
    }
    setNodes((current) =>
      current.map((node) =>
        node.id === selectedNode.id ? { ...node, data: { ...node.data, ...patch } } : node,
      ),
    );
  };

  const deleteSelected = () => {
    if (!selectedNode) {
      return;
    }
    setNodes((current) => current.filter((node) => node.id !== selectedNode.id));
    setEdges((current) =>
      current.filter((edge) => edge.source !== selectedNode.id && edge.target !== selectedNode.id),
    );
    setSelectedNodeId(null);
  };

  const resetDiagram = () => {
    setNodes(INITIAL_NODES);
    setEdges(INITIAL_EDGES);
    setSelectedNodeId(null);
  };

  const properTag = data
    ? data.transfer_function.is_strictly_proper
      ? "严格真分式"
      : data.transfer_function.is_proper
        ? "真分式"
        : "非真分式"
    : "";

  const coefficientError = num.error ?? den.error;
  const diagramLabels = useMemo(() => {
    const map: Record<string, string> = {};
    for (const node of nodes) {
      map[node.id] = node.data.label || NODE_LABELS[node.data.kind];
    }
    return map;
  }, [nodes]);

  const analysis = data ? (
    <>
      <section className="analysis-block">
        <BlockHead
          index={1}
          title="传递函数"
          meta={`${data.analysis_mode === "unity" ? "开环 L(s) → 闭环 T(s) · " : ""}${properTag}${
            updatedAt ? ` · 已更新 ${updatedAt}` : ""
          }`}
        />
        <div className="card">
          <FormulaView
            numExpr={data.transfer_function.num_expr}
            denExpr={data.transfer_function.den_expr}
            quotientExpr={data.transfer_function.quotient_expr}
            openLoop={data.open_loop}
          />
          <div className="formula-meta">
            <span>分子 {data.transfer_function.num_degree} 次</span>
            <span>分母 {data.transfer_function.den_degree} 次</span>
            <span>极点 {data.poles.length} 个</span>
            <span>零点 {data.zeros.length} 个</span>
            {data.parameters.length > 0 && (
              <span>
                参数{" "}
                {data.parameters.map((item) => `${item.name}=${formatNumber(item.value, 4)}`).join("，")}
              </span>
            )}
          </div>
          {data.diagram && <MasonPanel mason={data.diagram} labels={diagramLabels} />}
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
          title={data.frequency.scope === "open" ? "频域分析（开环 L）" : "频域分析（闭环）"}
          meta={`ω ${formatNumber(data.frequency.omega_min, 3)} – ${formatNumber(data.frequency.omega_max, 3)} rad/s`}
        />
        <div className="chart-grid">
          <BodeChart frequency={data.frequency} />
          <NyquistChart frequency={data.frequency} />
        </div>
      </section>

      <section className="analysis-block">
        <BlockHead
          index={5}
          title="增益 K 变化时的根轨迹"
          meta={data.analysis_mode === "unity" ? "开环 L(s)：D(s)+K·N(s)=0" : "D(s)+K·N(s)=0（把输入当开环）"}
        />
        <div className="chart-grid">
          <RootLocusChart locus={data.root_locus} openLoop={data.analysis_mode === "unity"} />
          <PoleZeroChart
            poles={data.poles}
            zeros={data.zeros}
            title={data.analysis_mode === "unity" ? "闭环极零点分布" : "极点零点分布"}
            tag={data.analysis_mode === "unity" ? "闭环 T · s 平面" : "s 平面"}
          />
        </div>
      </section>
    </>
  ) : null;

  const parametersCard = (
    <section className="card">
      <div className="card-head">
        <h2 className="card-title">参数</h2>
        <span className="card-tag">留空即自动</span>
      </div>

      <div className="param-row">
        <label className="param-label">误差带</label>
        <select className="select-input" value={band} onChange={(event) => setBand(Number(event.target.value))}>
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
  );

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

        <div className="work-switch">
          <button
            className={`work-tab ${workMode === "expression" ? "work-active" : ""}`}
            onClick={() => setWorkMode("expression")}
          >
            闭环传递函数
          </button>
          <button
            className={`work-tab ${workMode === "unity" ? "work-active" : ""}`}
            onClick={() => setWorkMode("unity")}
          >
            单位负反馈
          </button>
          <button
            className={`work-tab ${workMode === "diagram" ? "work-active" : ""}`}
            onClick={() => setWorkMode("diagram")}
          >
            框图分析
          </button>
        </div>

        <div className="topbar-right">
          <span className="version-chip">v0.6.0</span>
          <span className={`status-chip ${loading ? "status-busy" : error ? "status-bad" : "status-ok"}`}>
            <span className="status-dot" />
            {loading ? "计算中" : error ? "解析异常" : "实时分析"}
          </span>
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          {workMode !== "diagram" ? (
            <>
              <section className="card">
                <div className="card-head">
                  <h2 className="card-title">{workMode === "unity" ? "开环传递函数 L(s)" : "系统输入"}</h2>
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
                    <p className="formula-help">
                      {workMode === "unity"
                        ? "输入开环 L(s)：按单位负反馈 T(s)=L/(1+L) 求闭环；Bode/Nyquist/裕度与根轨迹针对 L(s)。"
                        : "s、数字、+ − × ÷ ^ 与括号；其余标识符当作未知参数，自动生成滑块。"}
                    </p>
                    {error && <p className="field-error">{error}</p>}
                    <ParameterSliders parameters={data?.parameters ?? []} values={params} onChange={updateParam} />
                  </>
                ) : (
                  <>
                    <CoefficientInput
                      label={workMode === "unity" ? "开环分子 N(s)" : "分子 N(s)"}
                      hint="空格或逗号分隔"
                      value={numText}
                      onChange={setNumText}
                      error={num.error}
                      terms={toTerms(num.values)}
                    />
                    <CoefficientInput
                      label={workMode === "unity" ? "开环分母 D(s)" : "分母 D(s)"}
                      hint={workMode === "unity" ? "闭环为 D(s)+N(s)" : "即特征方程系数"}
                      value={denText}
                      onChange={setDenText}
                      error={den.error}
                      terms={toTerms(den.values)}
                    />
                    {coefficientError && <p className="field-error">{coefficientError}</p>}
                  </>
                )}
              </section>

              {parametersCard}

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
            </>
          ) : (
            <>
              <section className="card">
                <div className="card-head">
                  <h2 className="card-title">组件</h2>
                  <span className="card-tag">点击添加</span>
                </div>
                <div className="palette">
                  <button className="palette-btn" onClick={() => addNode("input")}>
                    <span className="palette-icon">▷</span> 输入 R(s)
                  </button>
                  <button className="palette-btn" onClick={() => addNode("block")}>
                    <span className="palette-icon">▭</span> 环节 G(s)
                  </button>
                  <button className="palette-btn" onClick={() => addNode("sum")}>
                    <span className="palette-icon">⊗</span> 比较点
                  </button>
                  <button className="palette-btn" onClick={() => addNode("takeoff")}>
                    <span className="palette-icon">●</span> 引出点
                  </button>
                  <button className="palette-btn" onClick={() => addNode("output")}>
                    <span className="palette-icon">◁</span> 输出 Y(s)
                  </button>
                </div>
                <p className="formula-help">
                  拖动节点右侧圆点到目标节点即可连线；选中后按 Delete 删除。反馈到比较点的连线可点「+ / −」切换符号。
                </p>
                <div className="palette-actions">
                  <button className="ghost-btn" onClick={resetDiagram}>
                    恢复示例
                  </button>
                </div>
              </section>

              <section className="card">
                <div className="card-head">
                  <h2 className="card-title">选中元素</h2>
                </div>
                {selectedNode ? (
                  <div className="property-panel">
                    <label className="param-mini">
                      <span>信号名 / 标签</span>
                      <input
                        className="text-input text-input-sm"
                        value={selectedNode.data.label}
                        onChange={(event) => updateSelected({ label: event.target.value })}
                        placeholder={defaultLabel(selectedNode.data.kind)}
                      />
                    </label>

                    {selectedNode.data.kind === "block" && (
                      <>
                        <label className="param-mini">
                          <span>环节传递函数</span>
                          <input
                            className="text-input text-input-sm mono"
                            value={selectedNode.data.formula ?? ""}
                            onChange={(event) => updateSelected({ formula: event.target.value })}
                            placeholder="例如 1/(s+1)"
                          />
                        </label>
                        <label className="param-mini">
                          <span>预设</span>
                          <select
                            className="select-input"
                            value=""
                            onChange={(event) => {
                              if (event.target.value) {
                                updateSelected({ formula: event.target.value });
                              }
                            }}
                          >
                            <option value="">选择预设…</option>
                            {BLOCK_PRESETS.map((preset) => (
                              <option key={preset.name} value={preset.formula}>
                                {preset.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="param-mini">
                          <span>信号方向</span>
                          <div className="direction-toggle">
                            <button
                              type="button"
                              className={selectedNode.data.flipped ? "" : "active"}
                              onClick={() => updateSelected({ flipped: false })}
                            >
                              正向 →
                            </button>
                            <button
                              type="button"
                              className={selectedNode.data.flipped ? "active" : ""}
                              onClick={() => updateSelected({ flipped: true })}
                            >
                              ← 反向
                            </button>
                          </div>
                        </label>
                      </>
                    )}

                    {selectedNode.data.kind === "sum" && (
                      <p className="formula-help">比较点：点击连线上的「+ / −」切换极性，E(s) = R(s) − Y(s)。</p>
                    )}

                    <button className="ghost-btn danger" onClick={deleteSelected}>
                      删除该节点
                    </button>
                  </div>
                ) : (
                  <p className="formula-help">点击画布中的节点即可编辑名称与环节公式。</p>
                )}
              </section>

              {parametersCard}

              {data && data.parameters.length > 0 && (
                <section className="card">
                  <div className="card-head">
                    <h2 className="card-title">未知参数</h2>
                    <span className="card-tag">拖动实时更新</span>
                  </div>
                  <ParameterSliders parameters={data.parameters} values={params} onChange={updateParam} />
                </section>
              )}
            </>
          )}
        </aside>

        <main className="content">
          {workMode === "diagram" && (
            <section className="card diagram-card">
              <div className="card-head">
                <h2 className="card-title">系统结构框图</h2>
                <span className="card-tag">Mason 增益公式实时求解</span>
              </div>
              <DiagramCanvas
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                setEdges={setEdges}
                onSelectNode={setSelectedNodeId}
              />
            </section>
          )}

          {error && (
            <div className="alert">
              <strong>分析失败</strong>
              <span>{error}</span>
            </div>
          )}

          {analysis}

          {!data && !error && (
            <section className="card empty-state">
              <h2>{workMode === "diagram" ? "搭建你的框图" : "开始分析"}</h2>
              {workMode === "diagram" ? (
                <>
                  <p>从左侧添加「输入 → 环节 → 输出」，用引出点接反馈，比较点上的 + / − 决定正负反馈。</p>
                  <p>连线完成后，传递函数由 Mason 增益公式自动求出，下方给出稳定性、时域、频域与根轨迹。</p>
                </>
              ) : (
                <>
                  <p>在左侧输入传递函数表达式，例如 10/(s^2+2*s+10)，或写成带参数的形式 K/(s*(s+1))。</p>
                  <p>出现未知参数时会自动生成滑块，拖动即可实时看到稳定性、时域、频域与根轨迹的变化。</p>
                </>
              )}
            </section>
          )}
        </main>
      </div>

      <footer className="statusbar">
        <span>ControlLab v0.6.0 · 闭环 / 单位负反馈 / 框图 Mason 求解</span>
        <span>单位负反馈：输入开环 L(s)，闭环与开环指标分开给出</span>
      </footer>
    </div>
  );
}
