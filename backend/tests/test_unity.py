"""单位负反馈模式（输入开环 L(s)，闭环 T=L/(1+L)）的数值检查。"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.analysis import AnalyzeRequest
from app.services.analyzer import analyze

client = TestClient(app)


def _unity(num: list[float], den: list[float]) -> object:
    return analyze(AnalyzeRequest(num=num, den=den, analysis_mode="unity"))


def test_closed_loop_formed_from_open_loop() -> None:
    """L = 2/(s(s+1)(s+2)) → T = 2/(s³+3s²+2s+2)。"""
    result = _unity([2], [1, 3, 2, 0])
    assert result.analysis_mode == "unity"
    assert result.open_loop is not None
    assert result.open_loop.formula == "(2) / (s^3 + 3s^2 + 2s)"
    assert result.transfer_function.formula == "(2) / (s^3 + 3s^2 + 2s + 2)"
    assert result.stability.verdict == "stable"


def test_open_loop_margins() -> None:
    """L = 2/(s(s+1)(s+2))：ωc≈0.749、γ≈32.6°；ωg=√2、Kg≈9.54 dB。"""
    result = _unity([2], [1, 3, 2, 0])
    freq = result.frequency
    assert freq.scope == "open"
    assert freq.gain_crossover == pytest.approx(0.749, abs=0.01)
    assert freq.phase_margin_deg == pytest.approx(32.61, abs=0.5)
    assert freq.phase_crossover == pytest.approx(1.414, abs=0.01)
    assert freq.gain_margin_db == pytest.approx(9.54, abs=0.2)


def test_root_locus_uses_open_loop_poles() -> None:
    """根轨迹起点应是开环极点 0、-1、-2，而不是闭环极点。"""
    result = _unity([2], [1, 3, 2, 0])
    starts = sorted((round(p.re, 6) for p in result.root_locus.open_loop_poles))
    assert starts == [-2.0, -1.0, 0.0]
    assert len(result.root_locus.branches) == 3


def test_closed_loop_behaviour_matches_explicit_transfer_function() -> None:
    """把 L 换成手算的 T 走闭环模式，动态特性应完全一致。"""
    unity = _unity([2], [1, 3, 2, 0])
    explicit = analyze(AnalyzeRequest(num=[2], den=[1, 3, 2, 2]))

    assert [round(p.re, 6) for p in unity.poles] == [round(p.re, 6) for p in explicit.poles]
    assert unity.time_response.metrics.settling_time == pytest.approx(
        explicit.time_response.metrics.settling_time, rel=1e-6
    )
    assert unity.time_response.metrics.steady_state == pytest.approx(
        explicit.time_response.metrics.steady_state, rel=1e-6
    )
    # 闭环模式下频域对象是闭环，因此 scope 不同
    assert explicit.frequency.scope == "closed"
    assert explicit.open_loop is None


def test_unstable_when_gain_too_high() -> None:
    """L = 10/(s(s+1)(s+2))：闭环特征方程 s³+3s²+2s+10，Routh 首列变号 → 不稳定。"""
    result = _unity([10], [1, 3, 2, 0])
    assert result.stability.verdict == "unstable"
    assert result.stability.basis.routh.sign_changes == 2


def test_closed_mode_note_explains_margin_meaning() -> None:
    result = analyze(AnalyzeRequest(num=[10], den=[1, 2, 10]))
    assert result.analysis_mode == "closed"
    assert result.frequency.scope == "closed"
    assert result.frequency.note is not None
    assert "闭环" in result.frequency.note


def test_api_rejects_unity_with_diagram() -> None:
    body = {
        "analysis_mode": "unity",
        "diagram": {
            "nodes": [
                {"id": "r", "kind": "input"},
                {"id": "y", "kind": "output"},
            ],
            "edges": [{"source": "r", "target": "y"}],
        },
    }
    response = client.post("/api/v1/analyze", json=body)
    assert response.status_code == 422


def test_api_unity_mode_roundtrip() -> None:
    response = client.post(
        "/api/v1/analyze",
        json={"num": [2], "den": [1, 3, 2, 0], "analysis_mode": "unity"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["analysis_mode"] == "unity"
    assert data["open_loop"]["formula"] == "(2) / (s^3 + 3s^2 + 2s)"
    assert data["frequency"]["scope"] == "open"
    assert data["transfer_function"]["formula"] == "(2) / (s^3 + 3s^2 + 2s + 2)"
