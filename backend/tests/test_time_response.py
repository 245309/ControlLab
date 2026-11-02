import numpy as np

from app.core.time_response import choose_t_end, compute_metrics, simulate_step, steady_state_value


def test_first_order_step_metrics() -> None:
    num, den = [1.0], [1.0, 1.0]
    yss = steady_state_value(num, den)
    assert yss == 1.0

    t_end = choose_t_end(den, None)
    assert 5.0 <= t_end <= 15.0

    t, y = simulate_step(num, den, t_end)
    metrics = compute_metrics(t, y, yss, 0.02)

    assert metrics.defined is True
    assert metrics.overshoot_pct is not None and metrics.overshoot_pct < 0.5
    # 一阶系统 10%->90% 上升时间 = ln9 ≈ 2.197
    assert metrics.rise_time is not None and abs(metrics.rise_time - 2.197) < 0.05
    assert metrics.settling_time is not None and abs(metrics.settling_time - 3.912) < 0.2
    assert metrics.steady_state_error is not None and abs(metrics.steady_state_error) < 1e-9


def test_second_order_overshoot_matches_theory() -> None:
    # G = 10 / (s^2 + 2s + 10)：zeta = 1/sqrt(10), 理论超调 35.09%
    num, den = [10.0], [1.0, 2.0, 10.0]
    yss = steady_state_value(num, den)
    t, y = simulate_step(num, den, 10.0)
    metrics = compute_metrics(t, y, yss, 0.02)

    assert metrics.overshoot_pct is not None
    assert abs(metrics.overshoot_pct - 35.09) < 0.6
    assert metrics.peak_time is not None and abs(metrics.peak_time - np.pi / 3.0) < 0.05
    # 教材近似 ts≈4/(ζωn)=4s；实际按 2% 误差带测得约 3.5s（负半周更早入带）
    assert metrics.settling_time is not None and 3.4 < metrics.settling_time < 4.2


def test_integrator_has_no_finite_steady_state() -> None:
    assert steady_state_value([1.0], [1.0, 0.0]) is None
    t, y = simulate_step([1.0], [1.0, 0.0], 5.0)
    metrics = compute_metrics(t, y, None, 0.02)
    assert metrics.defined is False
    assert metrics.note is not None


def test_unstable_response_marks_metrics_undefined() -> None:
    num, den = [1.0], [1.0, -1.0]
    yss = steady_state_value(num, den)
    t, y = simulate_step(num, den, 20.0)
    metrics = compute_metrics(t, y, yss, 0.02)
    assert metrics.defined is False
