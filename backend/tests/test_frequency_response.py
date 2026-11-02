import math

import numpy as np

from app.core.frequency_response import auto_omega_range, compute_frequency


def test_first_order_bode_magnitude_and_phase() -> None:
    data = compute_frequency([1.0], [1.0, 1.0], poles=[-1 + 0j], zeros=[])
    omega = np.array(data.omega)
    mag = np.array(data.magnitude_db)
    phase = np.array(data.phase_deg)

    # ω = 1 时 |H| = 1/√2 → -3.01 dB，相位 -45°（在 log 频率上插值）
    index = int(np.argmin(np.abs(np.log10(omega) - 0.0)))
    assert abs(mag[index] - 20 * np.log10(1 / np.sqrt(1 + omega[index] ** 2))) < 1e-3
    assert abs(phase[index] + np.degrees(np.arctan(omega[index]))) < 1e-2

    # 低频增益 0 dB，高频按 -20 dB/dec 下降
    assert abs(mag[0]) < 0.01
    assert mag[-1] < -35.0


def test_gain_crossover_and_phase_margin() -> None:
    # G = 10/(s+1)：|H| = 1 出现在 ω≈9.95，此时相位≈-84.3°，相角裕度≈95.7°
    data = compute_frequency([10.0], [1.0, 1.0], poles=[-1 + 0j], zeros=[])
    assert data.gain_crossover is not None
    assert abs(data.gain_crossover - 9.949) < 0.1
    assert data.phase_margin_deg is not None
    assert abs(data.phase_margin_deg - 95.7) < 0.5
    # 一阶系统相位趋近 -90°，不存在 -180° 穿越
    assert data.phase_crossover is None
    assert data.gain_margin_db is None


def test_nyquist_passes_expected_point() -> None:
    data = compute_frequency([1.0], [1.0, 1.0], poles=[-1 + 0j], zeros=[])
    omega = np.array(data.omega)
    re = np.array(data.nyquist_re)
    im = np.array(data.nyquist_im)

    index = int(np.argmin(np.abs(np.log10(omega) - 0.0)))
    assert abs(re[index] - 0.5) < 0.01
    assert abs(im[index] + 0.5) < 0.01


def test_integrator_note() -> None:
    data = compute_frequency([1.0], [1.0, 0.0], poles=[0j], zeros=[])
    assert data.note is not None
    assert "积分" in data.note


def test_auto_omega_range_follows_dynamics() -> None:
    low, high = auto_omega_range([complex(-10, 0), complex(-10, 10), complex(-10, -10)], [])
    assert low <= 1.0
    assert high >= 100.0
    assert high / low >= 100.0


def test_invalid_range_raises() -> None:
    try:
        compute_frequency([1.0], [1.0, 1.0], poles=[-1 + 0j], zeros=[], omega_min=100, omega_max=1)
    except ValueError as exc:
        assert "ω_max" in str(exc)
    else:  # pragma: no cover
        raise AssertionError("应当抛出 ValueError")


def test_magnitude_matches_manual_evaluation() -> None:
    # G = 1/(s^2+2s+10)，ω=3 时 |H| = 1/|10-9+6j| = 1/√37
    data = compute_frequency([1.0], [1.0, 2.0, 10.0], poles=[], zeros=[])
    index = int(np.argmin(np.abs(np.log10(np.array(data.omega)) - math.log10(3.0))))
    expected = 20 * math.log10(1 / math.sqrt(37))
    assert abs(data.magnitude_db[index] - expected) < 0.05
