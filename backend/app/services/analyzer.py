"""分析服务：把传递函数、稳定性、时域响应组装成一次返回。"""

from __future__ import annotations

import math

import sympy as sp

from ..core.formula import compile_formula
from ..core.frequency_response import compute_frequency
from ..core.mason import DiagramEdge as MasonEdge
from ..core.mason import DiagramNode as MasonNode
from ..core.mason import analyze_diagram
from ..core.polynomial import is_zero, strip_leading_zeros
from ..core.root_locus import LocusData, compute_root_locus
from ..core.stability import build_routh_table, check_necessary_condition, classify_by_roots
from ..core.time_response import (
    Metrics,
    choose_t_end,
    compute_metrics,
    downsample,
    simulate_step,
    steady_state_value,
)
from ..core.transfer_function import TransferFunction
from ..schemas.analysis import (
    AnalyzeRequest,
    AnalyzeResponse,
    BodeInfo,
    ComplexNumber,
    FrequencyInfo,
    MasonInfo,
    MasonPathInfo,
    NecessaryInfo,
    NyquistInfo,
    ParameterInfo,
    RootLocusInfo,
    RouthInfo,
    RootRealParts,
    StabilityBasis,
    StabilityInfo,
    StepMetricsInfo,
    TimeResponseInfo,
    TransferFunctionInfo,
)


def _validate(num: list[float], den: list[float]) -> tuple[list[float], list[float]]:
    for name, coeffs in (("分子", num), ("分母", den)):
        if not coeffs:
            raise ValueError(f"{name}系数不能为空")
        for value in coeffs:
            if not math.isfinite(value):
                raise ValueError(f"{name}系数必须为有限实数")
    if all(is_zero(c) for c in den):
        raise ValueError("分母系数不能全为 0")

    num = strip_leading_zeros(num)
    den = strip_leading_zeros(den)
    if is_zero(den[0]):
        raise ValueError("分母最高次项系数不能为 0")
    return num, den


def _pick_dominant(poles: list[complex], verdict: str, limit: int = 2) -> list[complex]:
    if not poles:
        return []
    if verdict == "unstable":
        ordered = sorted(poles, key=lambda p: (-p.real, -abs(p.imag)))
    else:
        ordered = sorted(poles, key=lambda p: (abs(p.real), -abs(p.imag)))
    return ordered[:limit]


def _describe_poles(poles: list[complex]) -> str:
    parts = []
    for p in poles:
        if abs(p.imag) < 1e-9:
            parts.append(f"{p.real:g}")
        else:
            sign = "+" if p.imag > 0 else "-"
            parts.append(f"{p.real:g}{sign}{abs(p.imag):g}j")
    return "，".join(parts)


def _summary(verdict: str, poles: list[complex], dominant: list[complex], sign_changes: int) -> str:
    if verdict == "stable":
        base = f"系统稳定：闭环极点全部位于左半平面（Routh 表首列变号 {sign_changes} 次，右半平面极点 0 个）。"
    elif verdict == "unstable":
        base = f"系统不稳定：存在 {sign_changes} 个右半平面极点（Routh 表首列变号 {sign_changes} 次）。"
    else:
        on_axis = [p for p in poles if abs(p.real) <= 1e-6]
        base = f"系统临界稳定：存在位于虚轴上的极点（{_describe_poles(on_axis)}），只能等幅振荡或保持常数，不能收敛。"

    if dominant:
        extra = f"主导极点 {_describe_poles(dominant)}"
        if len(dominant) == 2 and abs(dominant[0].imag) > 1e-9 and abs(dominant[1].imag) > 1e-9:
            p = dominant[0]
            omega_n = math.hypot(p.real, p.imag)
            if omega_n > 0:
                zeta = -p.real / omega_n
                extra += f"（ωn≈{omega_n:.4g}，ζ≈{zeta:.4g}）"
        base += extra + "。"
    return base


def analyze(payload: AnalyzeRequest) -> AnalyzeResponse:
    formula_text: str | None = None
    parameters: list[ParameterInfo] = []
    mason: MasonInfo | None = None

    if payload.diagram is not None:
        mason_result = analyze_diagram(
            [
                MasonNode(id=node.id, kind=node.kind, formula=node.formula)
                for node in payload.diagram.nodes
            ],
            [
                MasonEdge(source=edge.source, target=edge.target, sign=edge.sign)
                for edge in payload.diagram.edges
            ],
            payload.params,
        )
        num, den = mason_result.num, mason_result.den
        parameters = [
            ParameterInfo(name=name, value=value) for name, value in mason_result.parameters
        ]
        mason = MasonInfo(
            input_id=mason_result.input_id,
            output_id=mason_result.output_id,
            forward_paths=[
                MasonPathInfo(nodes=path.nodes, gain_expr=sp.sstr(path.gain))
                for path in mason_result.forward_paths
            ],
            loops=[
                MasonPathInfo(nodes=loop.nodes, gain_expr=sp.sstr(loop.gain))
                for loop in mason_result.loops
            ],
            delta_expr=sp.sstr(mason_result.delta),
            numerator_expr=sp.sstr(mason_result.numerator),
            denominator_expr=sp.sstr(mason_result.denominator),
            parameters=parameters,
        )
    elif payload.formula and payload.formula.strip():
        formula_text = payload.formula.strip()
        compiled = compile_formula(formula_text, payload.params)
        num, den = compiled.num, compiled.den
        parameters = [ParameterInfo(name=name, value=value) for name, value in compiled.parameters]
    else:
        num = list(payload.num or [])
        den = list(payload.den or [])

    num, den = _validate(num, den)
    warnings: list[str] = []

    tf = TransferFunction(num=num, den=den)
    poles = tf.poles()
    zeros = tf.zeros()

    if not tf.is_proper:
        warnings.append("传递函数不是真分式（分子次数高于分母），已做多项式除法，阶跃响应仅展示严格真分式部分。")

    remainder, remainder_den, quotient_expr = tf.proper_part()
    if all(is_zero(c) for c in remainder):
        warnings.append("多项式除法后余式的分子为 0：系统的阶跃响应由冲激项构成，无法用常规指标描述。")

    yss = steady_state_value(remainder, remainder_den)

    t_end = choose_t_end(remainder_den, payload.options.t_end)
    t, y = simulate_step(remainder, remainder_den, t_end)
    metrics = compute_metrics(t, y, yss, payload.options.settling_band)

    verdict, root_info = classify_by_roots(poles)

    if verdict == "unstable":
        metrics = Metrics(None, None, None, None, None, None, defined=False,
                          note="系统不稳定，阶跃响应发散，时域指标无意义")
    elif verdict == "marginal":
        metrics = Metrics(None, None, None, None, None, None, defined=False,
                          note="系统临界稳定，响应不收敛，时域指标不适用")

    if metrics.note:
        warnings.append(metrics.note)

    t_list, y_list = downsample(t, y)

    routh = build_routh_table(den)
    necessary = check_necessary_condition(den)

    if verdict == "stable" and routh.sign_changes > 0:
        warnings.append("Routh 判据与极点实部结论不一致，请检查输入（可能存在数值病态）。")
    if verdict == "unstable" and routh.sign_changes == 0:
        warnings.append("Routh 表未检测到变号，但存在右半平面极点，可能触发了特殊情形。")

    dominant = _pick_dominant(poles, verdict)

    stability = StabilityInfo(
        verdict=verdict,
        is_stable=verdict == "stable",
        basis=StabilityBasis(
            necessary=NecessaryInfo(
                all_coefficients_present=necessary.all_coefficients_present,
                same_sign=necessary.same_sign,
                missing_terms=necessary.missing_terms,
                note=necessary.note,
            ),
            routh=RouthInfo(
                rows=routh.rows,
                header=routh.header,
                sign_changes=routh.sign_changes,
                special_case=routh.special_case,
                note=routh.note,
            ),
            root_real_parts=RootRealParts(
                max_real=root_info["max_real"],
                has_rhp=root_info["has_rhp"],
                on_imaginary_axis=root_info["on_imaginary_axis"],
            ),
        ),
        dominant_poles=[ComplexNumber(re=round(p.real, 9), im=round(p.imag, 9)) for p in dominant],
        summary=_summary(verdict, poles, dominant, routh.sign_changes),
    )

    time_response = TimeResponseInfo(
        t=t_list,
        y=y_list,
        metrics=StepMetricsInfo(
            steady_state=metrics.steady_state,
            rise_time=metrics.rise_time,
            peak_time=metrics.peak_time,
            overshoot_pct=metrics.overshoot_pct,
            settling_time=metrics.settling_time,
            steady_state_error=metrics.steady_state_error,
            defined=metrics.defined,
            note=metrics.note,
        ),
        note=None if metrics.defined else "时域指标不适用，仅展示响应曲线",
    )

    tf_info = TransferFunctionInfo(
        num=list(tf.num),
        den=list(tf.den),
        num_degree=tf.num_degree,
        den_degree=tf.den_degree,
        is_proper=tf.is_proper,
        is_strictly_proper=tf.is_strictly_proper,
        num_expr=tf.num_expr(),
        den_expr=tf.den_expr(),
        formula=tf.formula(),
        quotient_expr=quotient_expr,
    )

    frequency_data = compute_frequency(
        num,
        den,
        poles,
        zeros,
        omega_min=payload.options.omega_min,
        omega_max=payload.options.omega_max,
    )
    if verdict != "stable":
        warnings.append("系统非渐近稳定，幅值/相角裕度仅反映曲线形状，不能作为稳定结论。")
    frequency = FrequencyInfo(
        bode=BodeInfo(
            omega=frequency_data.omega,
            magnitude_db=frequency_data.magnitude_db,
            phase_deg=frequency_data.phase_deg,
        ),
        nyquist=NyquistInfo(
            re=frequency_data.nyquist_re,
            im=frequency_data.nyquist_im,
            omega=frequency_data.omega,
        ),
        omega_min=frequency_data.omega_min,
        omega_max=frequency_data.omega_max,
        gain_crossover=frequency_data.gain_crossover,
        phase_crossover=frequency_data.phase_crossover,
        gain_margin_db=frequency_data.gain_margin_db,
        phase_margin_deg=frequency_data.phase_margin_deg,
        note=frequency_data.note,
    )

    if tf.is_proper:
        locus_data = compute_root_locus(
            num,
            den,
            poles,
            zeros,
            k_min=payload.options.k_min,
            k_max=payload.options.k_max,
        )
    else:
        locus_data = LocusData(
            branches=[],
            gains=[],
            k_min=1.0,
            k_max=1.0,
            critical_gain=None,
            note="非真分式（分子次数不低于分母），根轨迹不适用。",
        )

    root_locus = RootLocusInfo(
        branches=locus_data.branches,
        gains=locus_data.gains,
        open_loop_poles=[ComplexNumber(re=round(p.real, 9), im=round(p.imag, 9)) for p in poles],
        open_loop_zeros=[ComplexNumber(re=round(z.real, 9), im=round(z.imag, 9)) for z in zeros],
        k_min=locus_data.k_min,
        k_max=locus_data.k_max,
        critical_gain=locus_data.critical_gain,
        note=locus_data.note,
    )

    return AnalyzeResponse(
        transfer_function=tf_info,
        poles=[ComplexNumber(re=round(p.real, 9), im=round(p.imag, 9)) for p in poles],
        zeros=[ComplexNumber(re=round(z.real, 9), im=round(z.imag, 9)) for z in zeros],
        stability=stability,
        time_response=time_response,
        frequency=frequency,
        root_locus=root_locus,
        parameters=parameters,
        formula=formula_text,
        diagram=mason,
        warnings=warnings,
    )
