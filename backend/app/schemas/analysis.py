"""API 数据模型（请求/响应）。"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class AnalyzeOptions(BaseModel):
    model_config = ConfigDict(extra="forbid")

    settling_band: float = Field(default=0.02, gt=0.0, le=0.2, description="调节时间误差带，默认 2%")
    t_end: float | None = Field(default=None, gt=0.0, le=5000.0, description="仿真时长（秒），缺省自动估计")
    omega_min: float | None = Field(default=None, gt=0.0, le=1e6, description="Bode 起始频率，缺省自动")
    omega_max: float | None = Field(default=None, gt=0.0, le=1e9, description="Bode 终止频率，缺省自动")
    k_min: float | None = Field(default=None, gt=0.0, le=1e9, description="根轨迹最小增益，缺省自动")
    k_max: float | None = Field(default=None, gt=0.0, le=1e12, description="根轨迹最大增益，缺省自动")


class DiagramNodeInfo(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1, max_length=64)
    kind: Literal["input", "output", "sum", "takeoff", "block"]
    label: str | None = Field(default=None, max_length=40)
    formula: str | None = Field(default=None, max_length=200, description="环节增益表达式，如 1/(s+1)")


class DiagramEdgeInfo(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str | None = Field(default=None, max_length=64)
    source: str
    target: str
    sign: int = Field(default=1, ge=-1, le=1, description="进入比较点的符号：+1 或 -1")


class DiagramInfo(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nodes: list[DiagramNodeInfo] = Field(min_length=1)
    edges: list[DiagramEdgeInfo] = Field(default_factory=list)


class AnalyzeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    num: list[float] | None = Field(default=None, min_length=1, description="分子系数，降幂")
    den: list[float] | None = Field(default=None, min_length=1, description="分母系数，降幂")
    formula: str | None = Field(default=None, description="传递函数表达式，如 K/(s*(s+1))")
    diagram: DiagramInfo | None = Field(default=None, description="系统结构框图")
    params: dict[str, float] = Field(default_factory=dict, description="公式/环节中的未知参数取值")
    options: AnalyzeOptions = Field(default_factory=AnalyzeOptions)

    @model_validator(mode="after")
    def _check_source(self) -> "AnalyzeRequest":
        if self.formula and self.formula.strip():
            return self
        if self.diagram is not None:
            return self
        if self.num is not None and self.den is not None:
            return self
        raise ValueError("请提供 num/den 系数、formula 表达式或 diagram 框图")



class ComplexNumber(BaseModel):
    re: float
    im: float


class TransferFunctionInfo(BaseModel):
    num: list[float]
    den: list[float]
    num_degree: int
    den_degree: int
    is_proper: bool
    is_strictly_proper: bool
    num_expr: str
    den_expr: str
    formula: str
    quotient_expr: str | None = None


class RouthInfo(BaseModel):
    rows: list[list[str]]
    header: list[str]
    sign_changes: int
    special_case: str | None
    note: str


class NecessaryInfo(BaseModel):
    all_coefficients_present: bool
    same_sign: bool
    missing_terms: list[str]
    note: str


class RootRealParts(BaseModel):
    max_real: float
    has_rhp: bool
    on_imaginary_axis: bool


class StabilityBasis(BaseModel):
    necessary: NecessaryInfo
    routh: RouthInfo
    root_real_parts: RootRealParts


class StabilityInfo(BaseModel):
    verdict: str = Field(description="stable | marginal | unstable")
    is_stable: bool
    basis: StabilityBasis
    dominant_poles: list[ComplexNumber]
    summary: str


class StepMetricsInfo(BaseModel):
    steady_state: float | None = None
    rise_time: float | None = None
    peak_time: float | None = None
    overshoot_pct: float | None = None
    settling_time: float | None = None
    steady_state_error: float | None = None
    defined: bool
    note: str | None = None


class TimeResponseInfo(BaseModel):
    t: list[float]
    y: list[float]
    metrics: StepMetricsInfo
    note: str | None = None


class BodeInfo(BaseModel):
    omega: list[float]
    magnitude_db: list[float]
    phase_deg: list[float]


class NyquistInfo(BaseModel):
    re: list[float]
    im: list[float]
    omega: list[float]


class FrequencyInfo(BaseModel):
    bode: BodeInfo
    nyquist: NyquistInfo
    omega_min: float
    omega_max: float
    gain_crossover: float | None = None
    phase_crossover: float | None = None
    gain_margin_db: float | None = None
    phase_margin_deg: float | None = None
    note: str | None = None


class RootLocusInfo(BaseModel):
    branches: list[list[list[float]]]
    gains: list[float]
    open_loop_poles: list[ComplexNumber]
    open_loop_zeros: list[ComplexNumber]
    k_min: float
    k_max: float
    critical_gain: float | None = None
    note: str | None = None


class ParameterInfo(BaseModel):
    name: str
    value: float


class MasonPathInfo(BaseModel):
    nodes: list[str]
    gain_expr: str


class MasonInfo(BaseModel):
    input_id: str
    output_id: str
    forward_paths: list[MasonPathInfo]
    loops: list[MasonPathInfo]
    delta_expr: str
    numerator_expr: str
    denominator_expr: str
    parameters: list[ParameterInfo] = []


class AnalyzeResponse(BaseModel):
    transfer_function: TransferFunctionInfo
    poles: list[ComplexNumber]
    zeros: list[ComplexNumber]
    stability: StabilityInfo
    time_response: TimeResponseInfo
    frequency: FrequencyInfo
    root_locus: RootLocusInfo
    parameters: list[ParameterInfo] = []
    formula: str | None = None
    diagram: MasonInfo | None = None
    warnings: list[str]
