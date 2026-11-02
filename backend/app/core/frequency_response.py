"""频率响应：Bode 数据、Nyquist 数据、稳定裕度。"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy import signal

from .polynomial import is_zero


@dataclass
class FrequencyData:
    omega: list[float]
    magnitude_db: list[float]
    phase_deg: list[float]
    nyquist_re: list[float]
    nyquist_im: list[float]
    omega_min: float
    omega_max: float
    gain_crossover: float | None
    phase_crossover: float | None
    gain_margin_db: float | None
    phase_margin_deg: float | None
    note: str | None = None


def auto_omega_range(poles: list[complex], zeros: list[complex]) -> tuple[float, float]:
    """以极点/零点的模长为中心，向两侧各取两个十倍频程。"""
    magnitudes: list[float] = []
    for root in [*poles, *zeros]:
        modulus = abs(root)
        if modulus > 1e-9:
            magnitudes.append(modulus)

    scale = max(magnitudes) if magnitudes else 1.0
    omega_min = max(scale / 100.0, 1e-4)
    omega_max = min(scale * 100.0, 1e6)
    if omega_max <= omega_min * 10:
        omega_max = omega_min * 100
    return float(omega_min), float(omega_max)


def _log_interp(omega: np.ndarray, values: np.ndarray, target: float) -> float | None:
    """在 log(ω) 上线性插值，返回 values 穿过 target 的频率。"""
    diff = values - target
    for index in range(len(diff) - 1):
        if diff[index] == 0:
            return float(omega[index])
        if diff[index] * diff[index + 1] < 0:
            fraction = -diff[index] / (diff[index + 1] - diff[index])
            ratio = omega[index + 1] / omega[index]
            return float(omega[index] * ratio**fraction)
    return None


def compute_frequency(
    num: list[float],
    den: list[float],
    poles: list[complex],
    zeros: list[complex],
    omega_min: float | None = None,
    omega_max: float | None = None,
    points: int = 400,
) -> FrequencyData:
    if omega_min is None or omega_max is None:
        default_min, default_max = auto_omega_range(poles, zeros)
        omega_min = omega_min or default_min
        omega_max = omega_max or default_max

    omega_min = float(omega_min)
    omega_max = float(omega_max)
    if omega_max <= omega_min:
        raise ValueError("频率范围无效：ω_max 必须大于 ω_min")

    omega = np.logspace(np.log10(omega_min), np.log10(omega_max), points)
    _, response = signal.freqs(num, den, worN=omega)

    magnitude = np.abs(response)
    magnitude_db = 20.0 * np.log10(np.maximum(magnitude, 1e-300))
    phase_deg = np.degrees(np.unwrap(np.angle(response)))

    gain_crossover = _log_interp(omega, magnitude_db, 0.0)
    phase_crossover = _log_interp(omega, phase_deg, -180.0)

    phase_margin = None
    if gain_crossover is not None:
        phase_at = float(np.interp(np.log10(gain_crossover), np.log10(omega), phase_deg))
        phase_margin = 180.0 + phase_at

    gain_margin = None
    if phase_crossover is not None:
        mag_at = float(np.interp(np.log10(phase_crossover), np.log10(omega), magnitude_db))
        gain_margin = -mag_at

    note = None
    if is_zero(den[-1]):
        note = "系统含积分环节，低频幅值趋于无穷，频域曲线在 ω→0 处截断显示。"

    return FrequencyData(
        omega=[round(float(w), 5) for w in omega],
        magnitude_db=[round(float(v), 3) for v in magnitude_db],
        phase_deg=[round(float(v), 2) for v in phase_deg],
        nyquist_re=[round(float(v), 6) for v in response.real],
        nyquist_im=[round(float(v), 6) for v in response.imag],
        omega_min=round(omega_min, 6),
        omega_max=round(omega_max, 6),
        gain_crossover=None if gain_crossover is None else round(gain_crossover, 6),
        phase_crossover=None if phase_crossover is None else round(phase_crossover, 6),
        gain_margin_db=None if gain_margin is None else round(gain_margin, 4),
        phase_margin_deg=None if phase_margin is None else round(phase_margin, 4),
        note=note,
    )
