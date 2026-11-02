export type DiagramNodeKind = "input" | "output" | "sum" | "takeoff" | "block";

export interface DiagramNodeData extends Record<string, unknown> {
  kind: DiagramNodeKind;
  label: string;
  formula?: string;
  /** 环节方向：true 表示信号从右往左流（反馈支路上的 H(s) 常用反向） */
  flipped?: boolean;
}

export interface DiagramNodePayload {
  id: string;
  kind: DiagramNodeKind;
  label?: string;
  formula?: string;
}

export interface DiagramEdgePayload {
  source: string;
  target: string;
  sign: number;
}

export interface DiagramPayload {
  nodes: DiagramNodePayload[];
  edges: DiagramEdgePayload[];
}

export interface MasonPathInfo {
  nodes: string[];
  gain_expr: string;
}

export interface MasonInfo {
  input_id: string;
  output_id: string;
  forward_paths: MasonPathInfo[];
  loops: MasonPathInfo[];
  delta_expr: string;
  numerator_expr: string;
  denominator_expr: string;
  parameters: { name: string; value: number }[];
}

export const NODE_LABELS: Record<DiagramNodeKind, string> = {
  input: "输入 R(s)",
  output: "输出 Y(s)",
  sum: "比较点",
  takeoff: "引出点",
  block: "环节",
};
