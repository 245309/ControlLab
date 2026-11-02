"""单位阶跃响应与时域指标。

指标定义（对齐《自动控制原理》教材）：
- 上升时间 tr：欠阻尼取首次到达稳态值的时间；过阻尼取 10%→90% 的时间；
- 峰值时间 tp：响应首次达到最大值的时间（无超调则为 None）；
- 超调量 σ%： (ymax - yss) / |yss| × 100%；
- 调节时间 ts：最后一次超出 ±band 误差带的时间；
- 稳态误差 ess：单位阶跃输入下 1 - yss（0 型系统）。
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy import signal

from .polynomial import is_zero


@dataclass
class Metrics:
    steady_state: float | None
    rise_time: float | None
    peak_time: float | None
    overshoot_pct: float | None
    settling_time: float | None
    steady_state_error: float | None
    defined: bool
    note: str | None = None


def _round(value: float | None, digits: int = 6) -> float | None:
    if value is None:
        return None
    return round(float(value), digits)


def _round_up_duration(value: float) -> float:
    """把自动估计的时长向上取整到好看的刻度（0.1 s / 1 s）。"""
    if value >= 100:
        return float(np.ceil(value))
    return float(np.ceil(value * 10.0) / 10.0)


def choose_t_end(den: list[float], t_end: float | None) -> float:
    if t_end is not None:
        return float(t_end)

    poles = np.roots(den) if len(den) > 1 else np.array([], dtype=complex)
    decaying = [p.real for p in poles if p.real < -1e-9]
    if decaying:
        slowest = max(decaying)  # 最靠近虚轴的稳定极点（负得最少）
        duration = 8.0 / abs(slowest)
    else:
        duration = 20.0
    return float(min(max(_round_up_duration(duration), 0.1), 5000.0))


def simulate_step(num: list[float], den: list[float], t_end: float, points: int = 900) -> tuple[np.ndarray, np.ndarray]:
    t = np.linspace(0.0, t_end, points)
    if all(is_zero(c) for c in num):
        # 纯冲激项：除法余式为 0，阶跃响应为 0
        return t, np.zeros_like(t)
    system = signal.TransferFunction(num, den)
    _, y = signal.step(system, T=t)
    return t, np.asarray(y, dtype=float)


def _first_time(t: np.ndarray, y: np.ndarray, level: float, rising: bool) -> float | None:
    for index in range(len(y)):
        if (y[index] >= level) if rising else (y[index] <= level):
            return float(t[index])
    return None


def compute_metrics(t: np.ndarray, y: np.ndarray, yss: float | None, band: float = 0.02) -> Metrics:
    if yss is None:
        return Metrics(None, None, None, None, None, None, defined=False,
                       note="系统含积分环节，单位阶跃响应无有限稳态值，时域指标不适用")

    if not np.all(np.isfinite(y)):
        return Metrics(None, None, None, None, None, None, defined=False, note="响应数值发散")

    peak = float(np.max(np.abs(y)))
    if peak > 1e6:
        return Metrics(None, None, None, None, None, None, defined=False,
                       note="响应发散（系统不稳定或临界稳定），时域指标不适用")

    yss = float(yss)
    if abs(yss) < 1e-12:
        return Metrics(yss, None, None, None, None, None, defined=False,
                       note="稳态值为 0，超调量等相对指标不适用")

    ymax = float(np.max(y))
    overshoot = max(0.0, (ymax - yss) / abs(yss) * 100.0)
    peak_time = None
    if overshoot > 0.1:
        peak_time = float(t[int(np.argmax(y))])

    rising = yss > 0
    if overshoot > 0.1:
        rise_time = _first_time(t, y, yss, rising)
    else:
        low = 0.1 * yss
        high = 0.9 * yss
        start = _first_time(t, y, low, rising)
        end = _first_time(t, y, high, rising)
        rise_time = (end - start) if (start is not None and end is not None) else None

    tol = band * abs(yss)
    deviation = np.abs(y - yss)
    outside = np.nonzero(deviation > tol)[0]
    if outside.size == 0:
        settling_time = float(t[0])
    elif outside[-1] + 1 < len(t):
        settling_time = float(t[outside[-1] + 1])
    else:
        settling_time = None  # 在观察窗口内仍未进入误差带

    ess = 1.0 - yss
    note = None
    if settling_time is None:
        note = f"在 {t[-1]:.3g}s 观察窗口内未进入 ±{band * 100:.0f}% 误差带"

    return Metrics(
        steady_state=_round(yss),
        rise_time=_round(rise_time),
        peak_time=_round(peak_time),
        overshoot_pct=_round(overshoot, 4),
        settling_time=_round(settling_time),
        steady_state_error=_round(ess),
        defined=True,
        note=note,
    )


def downsample(t: np.ndarray, y: np.ndarray, limit: int = 600) -> tuple[list[float], list[float]]:
    if len(t) <= limit:
        stride = 1
    else:
        stride = int(np.ceil(len(t) / limit))
    return (
        [round(float(v), 6) for v in t[::stride]],
        [round(float(v), 6) for v in y[::stride]],
    )


def steady_state_value(num: list[float], den: list[float]) -> float | None:
    """终值定理：单位阶跃输入下的稳态值 = num(0)/den(0)。"""
    if is_zero(den[-1]):
        return None
    return float(num[-1]) / float(den[-1])
