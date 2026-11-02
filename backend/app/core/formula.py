"""传递函数公式解析：把 "K/(s*(s+1))" 这类文本编译成分子/分母系数。

支持：
- 变量 s，四则运算、括号、乘方（^ 或 **）
- 隐式乘法（2s、3(s+1)）
- 任意标识符作为未知参数（K、zeta、wn、ωn …），由调用方给值
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass, field

import sympy as sp
from sympy.parsing.sympy_parser import (
    implicit_multiplication_application,
    parse_expr,
    standard_transformations,
)

MAX_DEGREE = 20
DEFAULT_PARAM_VALUE = 1.0

TRANSFORMATIONS = standard_transformations + (implicit_multiplication_application,)

# parse_expr 的自动变换会用到这些名字；给出白名单即可挡住任意代码执行
SAFE_GLOBALS: dict[str, object] = {
    "__builtins__": {},
    "Integer": sp.Integer,
    "Float": sp.Float,
    "Rational": sp.Rational,
    "Symbol": sp.Symbol,
    "Mul": sp.Mul,
    "Add": sp.Add,
    "Pow": sp.Pow,
}


@dataclass
class FormulaResult:
    num: list[float]
    den: list[float]
    parameters: list[tuple[str, float]] = field(default_factory=list)


def _normalize(text: str) -> str:
    cleaned = text.strip()
    cleaned = (
        cleaned.replace("×", "*")
        .replace("·", "*")
        .replace("÷", "/")
        .replace("−", "-")
        .replace("–", "-")
        .replace("（", "(")
        .replace("）", ")")
        .replace("^", "**")
    )
    return cleaned


def _poly_coeffs(expr: sp.Expr, symbol: sp.Symbol) -> list[float]:
    if expr == 0:
        return [0.0]
    try:
        poly = sp.Poly(sp.expand(expr), symbol)
    except sp.PolynomialError as exc:  # pragma: no cover - 防御
        raise ValueError("公式不是 s 的多项式") from exc
    if poly.degree() > MAX_DEGREE:
        raise ValueError(f"次数过高（上限 {MAX_DEGREE} 次）")
    coeffs = [float(sp.N(coeff, 12)) for coeff in poly.all_coeffs()]
    return [round(value, 10) for value in coeffs]


RESERVED_NAMES = {"s", "pi", "E", "I", "oo", "nan", "zoo"}
IDENTIFIER_RE = re.compile(r"[^\W\d]\w*", re.UNICODE)


def _local_dict(text: str, symbol: sp.Symbol) -> dict[str, sp.Symbol]:
    """把文本里出现的标识符预先登记成符号，避免 wn 被隐式乘法拆成 w*n。"""
    mapping: dict[str, sp.Symbol] = {"s": symbol}
    for name in IDENTIFIER_RE.findall(text):
        if name in RESERVED_NAMES or name in mapping:
            continue
        mapping[name] = sp.Symbol(name)
    return mapping


def evaluate_expression(text: str) -> sp.Expr:
    cleaned = _normalize(text)
    if not cleaned:
        raise ValueError("公式为空")
    symbol = sp.Symbol("s")
    try:
        return parse_expr(
            cleaned,
            local_dict=_local_dict(cleaned, symbol),
            transformations=TRANSFORMATIONS,
            global_dict=SAFE_GLOBALS,
            evaluate=True,
        )
    except Exception as exc:  # sympy 抛出的异常种类很多
        detail = str(exc).strip()
        if len(detail) > 80:
            detail = detail[:80] + "…"
        raise ValueError(f"公式无法解析，请检查括号与运算符是否配对（{detail}）") from exc


def compile_formula(text: str, params: dict[str, float] | None = None) -> FormulaResult:
    symbol = sp.Symbol("s")
    expr = evaluate_expression(text)

    free_symbols = sorted(expr.free_symbols - {symbol}, key=lambda item: item.name)
    values = params or {}
    parameters: list[tuple[str, float]] = []
    substitutions: dict[sp.Symbol, sp.Expr] = {}

    for item in free_symbols:
        raw = values.get(item.name, DEFAULT_PARAM_VALUE)
        try:
            value = float(raw)
        except (TypeError, ValueError) as exc:
            raise ValueError(f"参数 {item.name} 的取值无效") from exc
        if not math.isfinite(value):
            raise ValueError(f"参数 {item.name} 必须是有限实数")
        substitutions[item] = sp.Float(value, 15)
        parameters.append((item.name, round(value, 6)))

    # 注意：这里不能用 simplify —— 它会把分子分母的公因子约掉，
    # 而控制理论里「有零极点对消」和「没有」的表达式应当保持用户输入的样子。
    substituted = expr.subs(substitutions)
    if substituted.has(sp.zoo) or substituted.has(sp.nan):
        raise ValueError("公式在给定参数下无意义")

    combined = sp.together(substituted)
    num_expr, den_expr = sp.fraction(combined)
    num = _poly_coeffs(sp.expand(num_expr), symbol)
    den = _poly_coeffs(sp.expand(den_expr), symbol)

    if all(abs(value) < 1e-12 for value in den):
        raise ValueError("分母恒为 0")

    return FormulaResult(num=num, den=den, parameters=parameters)


def extract_parameters(text: str) -> list[str]:
    """只解析出参数名，不要求能给出数值（用于前端提示）。"""
    symbol = sp.Symbol("s")
    try:
        expr = evaluate_expression(text)
    except ValueError:
        return []
    return sorted({item.name for item in expr.free_symbols - {symbol}})


def looks_like_formula(text: str) -> bool:
    """粗略判断输入更像公式还是系数序列。"""
    return bool(re.search(r"[s()*/^]", text))

