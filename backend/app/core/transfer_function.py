"""传递函数模型：分子/分母系数（降幂），极点、零点、真分式分解。"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .polynomial import is_zero, poly_to_expr, trim

ROOT_TOL = 1e-9


def _clean_root(value: complex) -> complex:
    re = 0.0 if abs(value.real) < ROOT_TOL else float(value.real)
    im = 0.0 if abs(value.imag) < ROOT_TOL else float(value.imag)
    return complex(re, im)


def _sort_roots(roots: list[complex]) -> list[complex]:
    return sorted(roots, key=lambda r: (round(r.real, 9), round(r.imag, 9)))


@dataclass
class TransferFunction:
    num: list[float]
    den: list[float]

    def __post_init__(self) -> None:
        self.num = trim(self.num)
        self.den = trim(self.den)

    @property
    def num_degree(self) -> int:
        return len(self.num) - 1

    @property
    def den_degree(self) -> int:
        return len(self.den) - 1

    @property
    def is_proper(self) -> bool:
        return self.num_degree <= self.den_degree

    @property
    def is_strictly_proper(self) -> bool:
        return self.num_degree < self.den_degree

    def poles(self) -> list[complex]:
        if len(self.den) < 2:
            return []
        return _sort_roots([_clean_root(complex(r)) for r in np.roots(self.den)])

    def zeros(self) -> list[complex]:
        if len(self.num) < 2:
            return []
        return _sort_roots([_clean_root(complex(r)) for r in np.roots(self.num)])

    def static_gain(self) -> float | None:
        """s=0 处的取值（单位阶跃的稳态值），积分环节返回 None。"""
        if is_zero(self.den[-1]):
            return None
        return float(self.num[-1]) / float(self.den[-1])

    def proper_part(self) -> tuple[list[float], list[float], str | None]:
        """分解为 商多项式 + 严格真分式，返回 (分子, 分母, 商表达式)。"""
        if len(self.num) < len(self.den):
            return list(self.num), list(self.den), None

        quotient, remainder = np.polydiv(self.num, self.den)
        quotient = trim([float(c) for c in quotient])
        remainder = trim([float(c) for c in remainder])
        if all(is_zero(c) for c in remainder):
            remainder = [0.0]

        quotient_expr = None
        if not (len(quotient) == 1 and is_zero(quotient[0])):
            quotient_expr = poly_to_expr(quotient)
        return remainder, list(self.den), quotient_expr

    def num_expr(self) -> str:
        return poly_to_expr(self.num)

    def den_expr(self) -> str:
        return poly_to_expr(self.den)

    def formula(self) -> str:
        num = self.num_expr()
        den = self.den_expr()
        if self.den_degree == 0:
            return num
        return f"({num}) / ({den})"
