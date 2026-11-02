"""根轨迹：解 D(s) + K·N(s) = 0，扫 K 并按最近邻跟踪分支。"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .polynomial import is_zero


@dataclass
class LocusData:
    branches: list[list[list[float]]]
    gains: list[float]
    k_min: float
    k_max: float
    critical_gain: float | None
    note: str | None


def _round_branch(points: list[complex]) -> list[list[float]]:
    """四舍五入到 4 位小数（保持与 gains 一一对应，便于前端显示 K）。"""
    return [[round(float(point.real), 4), round(float(point.imag), 4)] for point in points]


def _auto_k_max(den: np.ndarray, num_padded: np.ndarray, scale: float) -> float:
    """让最远的闭环极点到 8 倍特征尺度为止（既能看到远离段，又不至于把原点附近压扁）。"""
    k = 1.0
    for _ in range(80):
        try:
            roots = np.roots(den + k * num_padded)
        except Exception:
            break
        if roots.size and np.max(np.abs(roots)) > 8.0 * scale:
            break
        if k >= 1e6:
            break
        k *= 2.0
    return float(max(k, 1.0))


def compute_root_locus(
    num: list[float],
    den: list[float],
    poles: list[complex],
    zeros: list[complex],
    k_min: float | None = None,
    k_max: float | None = None,
    points: int = 320,
) -> LocusData:
    if len(num) > len(den):
        raise ValueError("根轨迹要求分子次数不高于分母次数（真分式或严格真分式）")

    den_arr = np.array(den, dtype=float)
    num_arr = np.array(num, dtype=float)
    num_padded = np.concatenate([np.zeros(len(den_arr) - len(num_arr)), num_arr])

    magnitudes = [abs(r) for r in [*poles, *zeros] if abs(r) > 1e-9]
    scale = max(magnitudes) if magnitudes else 1.0

    if all(is_zero(value) for value in num):
        static: list[list[list[float]]] = []
        for pole in poles:
            point = [round(pole.real, 4), round(pole.imag, 4)]
            static.append([point, list(point)])
        return LocusData(
            branches=static,
            gains=[1.0, 1.0],
            k_min=1.0,
            k_max=1.0,
            critical_gain=None,
            note="分子恒为 0：闭环极点不随 K 变化，根轨迹退化为开环极点。",
        )

    if k_min is not None:
        start = float(k_min)
    elif magnitudes:
        start = max(min(magnitudes) / 1000.0, 1e-4)
    else:
        start = 1e-3
    if k_max is None:
        end = _auto_k_max(den_arr, num_padded, scale)
    else:
        end = float(k_max)
    if end <= start:
        raise ValueError("根轨迹增益范围无效：k_max 必须大于 k_min")

    gains = np.geomspace(start, end, points)

    branches: list[list[complex]] = []
    previous: list[complex] = []
    max_re: list[float] = []

    for index, gain in enumerate(gains):
        roots = [complex(root) for root in np.roots(den_arr + gain * num_padded)]
        max_re.append(max(root.real for root in roots) if roots else 0.0)

        if index == 0:
            roots.sort(key=lambda r: (round(r.real, 6), round(r.imag, 6)))
            branches = [[root] for root in roots]
            previous = list(roots)
            continue

        remaining = list(range(len(roots)))
        for branch_index, last in enumerate(previous):
            nearest = min(remaining, key=lambda idx: abs(roots[idx] - last))
            branches[branch_index].append(roots[nearest])
            remaining.remove(nearest)
        previous = [branch[-1] for branch in branches]

    critical_gain = None
    for index in range(1, len(gains)):
        if max_re[index - 1] <= 1e-9 < max_re[index]:
            span = max_re[index] - max_re[index - 1]
            alpha = 0.0 if span == 0 else (0.0 - max_re[index - 1]) / span
            log_k = np.log(gains[index - 1]) + alpha * (np.log(gains[index]) - np.log(gains[index - 1]))
            critical_gain = round(float(np.exp(log_k)), 4)
            break

    note = None
    if np.max(max_re) <= 1e-9:
        note = "扫描范围内闭环极点始终位于左半平面：所有 K 下都稳定。"
    elif max_re[0] > 1e-9:
        note = "K 很小时就已有右半平面极点：开环本身不稳定。"
    elif critical_gain is not None:
        note = f"根轨迹在 K≈{critical_gain:g} 处穿过虚轴，该 K 为临界增益。"

    return LocusData(
        branches=[_round_branch(branch) for branch in branches],
        gains=[round(float(k), 5) for k in gains],
        k_min=round(start, 5),
        k_max=round(end, 5),
        critical_gain=critical_gain,
        note=note,
    )
