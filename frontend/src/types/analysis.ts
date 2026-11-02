export interface ComplexNumber {
  re: number;
  im: number;
}

export interface TransferFunctionInfo {
  num: number[];
  den: number[];
  num_degree: number;
  den_degree: number;
  is_proper: boolean;
  is_strictly_proper: boolean;
  num_expr: string;
  den_expr: string;
  formula: string;
  quotient_expr: string | null;
}

export interface RouthInfo {
  rows: string[][];
  header: string[];
  sign_changes: number;
  special_case: "all_zero_row" | "first_column_zero" | null;
  note: string;
}

export interface NecessaryInfo {
  all_coefficients_present: boolean;
  same_sign: boolean;
  missing_terms: string[];
  note: string;
}

export interface RootRealParts {
  max_real: number;
  has_rhp: boolean;
  on_imaginary_axis: boolean;
}

export type Verdict = "stable" | "marginal" | "unstable";

export interface StabilityInfo {
  verdict: Verdict;
  is_stable: boolean;
  basis: {
    necessary: NecessaryInfo;
    routh: RouthInfo;
    root_real_parts: RootRealParts;
  };
  dominant_poles: ComplexNumber[];
  summary: string;
}

export interface StepMetricsInfo {
  steady_state: number | null;
  rise_time: number | null;
  peak_time: number | null;
  overshoot_pct: number | null;
  settling_time: number | null;
  steady_state_error: number | null;
  defined: boolean;
  note: string | null;
}

export interface TimeResponseInfo {
  t: number[];
  y: number[];
  metrics: StepMetricsInfo;
  note: string | null;
}

export interface BodeInfo {
  omega: number[];
  magnitude_db: number[];
  phase_deg: number[];
}

export interface NyquistInfo {
  re: number[];
  im: number[];
  omega: number[];
}

export interface FrequencyInfo {
  bode: BodeInfo;
  nyquist: NyquistInfo;
  omega_min: number;
  omega_max: number;
  gain_crossover: number | null;
  phase_crossover: number | null;
  gain_margin_db: number | null;
  phase_margin_deg: number | null;
  note: string | null;
}

export interface RootLocusInfo {
  branches: number[][][];
  gains: number[];
  open_loop_poles: ComplexNumber[];
  open_loop_zeros: ComplexNumber[];
  k_min: number;
  k_max: number;
  critical_gain: number | null;
  note: string | null;
}

export interface ParameterInfo {
  name: string;
  value: number;
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
  parameters: ParameterInfo[];
}

export interface AnalysisResponse {
  transfer_function: TransferFunctionInfo;
  poles: ComplexNumber[];
  zeros: ComplexNumber[];
  stability: StabilityInfo;
  time_response: TimeResponseInfo;
  frequency: FrequencyInfo;
  root_locus: RootLocusInfo;
  parameters: ParameterInfo[];
  formula: string | null;
  diagram: MasonInfo | null;
  warnings: string[];
}

export interface DiagramNodePayload {
  id: string;
  kind: "input" | "output" | "sum" | "takeoff" | "block";
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

export interface AnalyzeRequest {
  num?: number[];
  den?: number[];
  formula?: string;
  diagram?: DiagramPayload;
  params?: Record<string, number>;
  options: {
    settling_band: number;
    t_end: number | null;
    omega_min: number | null;
    omega_max: number | null;
    k_min: number | null;
    k_max: number | null;
  };
}
