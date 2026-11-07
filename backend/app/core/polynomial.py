"""多项式与数值小工具。"""

from __future__ import annotations

from fractions import Fraction

EPSILON = 1e-12


def is_zero(value: float) -> bool:
    return abs(value) < EPSILON


def strip_leading_zeros(coeffs: list[float]) -> list[float]:
    """去掉最高次项的 0（例如 [0, 0, 1, 2] -> [1, 2]）。"""
    out = [float(c) for c in coeffs]
    i = 0
    while i < len(out) - 1 and abs(out[i]) < EPSILON:
        i += 1
    return out[i:]


def trim(coeffs: list[float]) -> list[float]:
    """去掉所有前导 0，保留至少一项。"""
    out = [float(c) for c in coeffs]
    while len(out) > 1 and abs(out[0]) < EPSILON:
        out.pop(0)
    return out


def poly_add(left: list[float], right: list[float]) -> list[float]:
    """按降幂系数相加（自动右对齐、长度取两者最大），返回去前导 0 的结果。"""
    length = max(len(left), len(right))
    total = [0.0] * length
    for index, value in enumerate(reversed(left)):
        total[length - 1 - index] += float(value)
    for index, value in enumerate(reversed(right)):
        total[length - 1 - index] += float(value)
    return trim(total)


def to_fraction(value: float) -> Fraction:
    """按十进制字面量转成精确分数：0.1 -> 1/10，避免浮点误差造成假变号。"""
    return Fraction(str(float(value)))


def fmt_number(value: float) -> str:
    if abs(value - round(value)) < 1e-9:
        return str(int(round(value)))
    return f"{value:.6g}"


def poly_to_expr(coeffs: list[float], var: str = "s") -> str:
    """把降幂系数列表格式化成多项式字符串，例如 [1, 0, -2] -> 's^2 - 2'。"""
    coeffs = trim(coeffs)
    n = len(coeffs) - 1
    parts: list[tuple[bool, str]] = []

    for index, coeff in enumerate(coeffs):
        power = n - index
        if is_zero(coeff):
            continue
        magnitude = fmt_number(abs(coeff))
        if power == 0:
            body = magnitude
        elif power == 1:
            body = var if magnitude == "1" else f"{magnitude}{var}"
        else:
            body = f"{var}^{power}" if magnitude == "1" else f"{magnitude}{var}^{power}"
        parts.append((coeff < 0, body))

    if not parts:
        return "0"

    negative, body = parts[0]
    text = ("-" if negative else "") + body
    for negative, body in parts[1:]:
        text += f" {'-' if negative else '+'} {body}"
    return text
