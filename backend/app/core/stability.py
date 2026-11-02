"""Routh-Hurwitz 稳定性判据。

要点：
- 系数用 fractions.Fraction -> sympy.Rational 精确表示，避免浮点误差造成假变号；
- 首列为 0 时用 ε 法（ε→0⁺，符号由极限决定）；
- 整行为 0 时用辅助方程求导处理（对应虚轴上的对称根，属临界稳定）。
"""

from __future__ import annotations

from dataclasses import dataclass, field

import sympy as sp

from .polynomial import is_zero, strip_leading_zeros, to_fraction

EPS = sp.Symbol("eps", positive=True)


@dataclass
class RouthResult:
    rows: list[list[str]]
    header: list[str]
    sign_changes: int
    special_case: str | None
    note: str
    first_column_signs: list[int] = field(default_factory=list)


def _rationals(coeffs: list[float]) -> list[sp.Expr]:
    out: list[sp.Expr] = []
    for coeff in coeffs:
        frac = to_fraction(coeff)
        out.append(sp.Rational(frac.numerator, frac.denominator))
    return out


def _sign_of(expr: sp.Expr) -> int:
    expr = sp.simplify(expr)
    if expr.free_symbols:
        expr = sp.simplify(sp.limit(expr, EPS, 0, "+"))
    if expr.free_symbols:
        return 0
    if expr == 0:
        return 0
    return 1 if sp.sign(expr) > 0 else -1


def _display(expr: sp.Expr) -> str:
    value = sp.simplify(expr)
    # 公式编辑产生的小数系数会变成 2499561/250000 这类分数，分母太大时直接显示小数
    if value.is_Rational and value.q > 1000:
        return f"{float(value):.5g}"
    return sp.sstr(value).replace("eps", "ε")


def build_routh_table(den: list[float]) -> RouthResult:
    coeffs = _rationals(strip_leading_zeros(den))
    order = len(coeffs) - 1

    if order < 1:
        return RouthResult(
            rows=[[_display(c) for c in coeffs]],
            header=["s^0"],
            sign_changes=0,
            special_case=None,
            note="零阶系统（无动态环节）",
        )

    width = (order + 1 + 1) // 2
    first_row = coeffs[0::2]
    second_row = coeffs[1::2]
    first_row = first_row + [sp.Integer(0)] * (width - len(first_row))
    second_row = second_row + [sp.Integer(0)] * (width - len(second_row))
    rows: list[list[sp.Expr]] = [first_row, second_row]

    special_case: str | None = None
    notes: list[str] = []

    for index in range(2, order + 1):
        prev = rows[index - 1]
        prev2 = rows[index - 2]

        if all(sp.simplify(cell) == 0 for cell in prev):
            special_case = "all_zero_row"
            degree = order - (index - 2)
            derivative: list[sp.Expr] = []
            for slot, cell in enumerate(prev2):
                power = degree - 2 * slot
                derivative.append(sp.simplify(cell * power) if power > 0 else sp.Integer(0))
            rows[index - 1] = derivative
            prev = derivative
            notes.append(
                f"第 s^{order - (index - 1)} 行整行为 0：用辅助方程（{degree} 次，来自上一行）求导后继续，"
                "说明存在关于原点对称的根（含虚轴根）"
            )

        if sp.simplify(prev[0]) == 0:
            if special_case is None:
                special_case = "first_column_zero"
            prev[0] = EPS
            notes.append(f"第 s^{order - (index - 1)} 行首列为 0：以 ε 替换后继续（ε→0⁺）")

        head = prev[0]
        new_row: list[sp.Expr] = []
        for slot in range(width):
            up = prev2[slot + 1] if slot + 1 < width else sp.Integer(0)
            left = prev2[0]
            down = prev[slot + 1] if slot + 1 < width else sp.Integer(0)
            new_row.append(sp.cancel((head * up - left * down) / head))
        rows.append(new_row)

    signs = [_sign_of(row[0]) for row in rows]
    changes = sum(1 for i in range(1, len(signs)) if signs[i] != 0 and signs[i - 1] != 0 and signs[i] != signs[i - 1])

    # 一阶系统（以及常数项为 0 的高阶系统）不会进入上面的循环，
    # 最后一行全零意味着特征方程常数项为 0，即存在 s=0 的极点。
    if order >= 1 and all(sp.simplify(cell) == 0 for cell in rows[-1]):
        if special_case is None:
            special_case = "all_zero_row"
            notes.append("最后一行全为零：特征方程的常数项为 0，存在 s=0 的极点")

    if special_case == "all_zero_row":
        note = "Routh 表出现全零行 → 存在虚轴上的根，系统临界稳定（非渐近稳定）。"
    elif special_case == "first_column_zero":
        note = "Routh 表首列出现 0 → 已按 ε 法处理，变号次数由 ε→0⁺ 的极限符号给出。"
    else:
        note = "Routh 表首列无零元素，变号次数即右半平面闭环极点数。"

    return RouthResult(
        rows=[[_display(cell) for cell in row] for row in rows],
        header=[f"s^{order - i}" for i in range(len(rows))],
        sign_changes=changes,
        special_case=special_case,
        note=note,
        first_column_signs=signs,
    )


@dataclass
class NecessaryResult:
    all_coefficients_present: bool
    same_sign: bool
    missing_terms: list[str]
    note: str


def check_necessary_condition(den: list[float]) -> NecessaryResult:
    coeffs = strip_leading_zeros(den)
    order = len(coeffs) - 1
    missing: list[str] = []
    for index, coeff in enumerate(coeffs):
        if is_zero(coeff):
            power = order - index
            missing.append("s^0" if power == 0 else f"s^{power}")

    # 0 系数视为「中性」：只要不同时出现正负号，就不算异号
    has_positive = any(c > 0 for c in coeffs)
    has_negative = any(c < 0 for c in coeffs)
    same_sign = not (has_positive and has_negative)
    present = not missing

    if not same_sign:
        note = "特征方程系数不同号 → 必要条件不满足，系统不稳定。"
    elif missing:
        note = (
            f"特征方程缺项（{'、'.join(missing)}）→ 必要条件不满足：系统不可能渐近稳定"
            "（可能临界稳定或不稳定），需由 Routh 表进一步判定。"
        )
    else:
        note = "特征方程各项齐全且系数同号，必要条件满足（充分性由 Routh 表判定）。"

    return NecessaryResult(
        all_coefficients_present=present,
        same_sign=same_sign,
        missing_terms=missing,
        note=note,
    )


def classify_by_roots(poles: list[complex], tol: float = 1e-6) -> tuple[str, dict]:
    """按极点实部给出 stable / marginal / unstable。"""
    if not poles:
        return "stable", {"max_real": 0.0, "has_rhp": False, "on_imaginary_axis": False}

    max_real = max(p.real for p in poles)
    has_rhp = any(p.real > tol for p in poles)
    on_axis = any(abs(p.real) <= tol for p in poles)

    if has_rhp:
        verdict = "unstable"
    elif on_axis:
        verdict = "marginal"
    else:
        verdict = "stable"
    return verdict, {
        "max_real": round(float(max_real), 9),
        "has_rhp": has_rhp,
        "on_imaginary_axis": on_axis,
    }
