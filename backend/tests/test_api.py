from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_analyze_stable_system() -> None:
    response = client.post("/api/v1/analyze", json={"num": [10], "den": [1, 2, 10]})
    assert response.status_code == 200

    data = response.json()
    assert data["stability"]["verdict"] == "stable"
    assert data["stability"]["is_stable"] is True
    assert data["stability"]["basis"]["routh"]["sign_changes"] == 0
    assert len(data["poles"]) == 2
    assert data["transfer_function"]["formula"] == "(10) / (s^2 + 2s + 10)"

    metrics = data["time_response"]["metrics"]
    assert metrics["defined"] is True
    assert abs(metrics["overshoot_pct"] - 35.09) < 0.6
    assert len(data["time_response"]["t"]) > 100
    assert len(data["time_response"]["t"]) == len(data["time_response"]["y"])


def test_analyze_marginal_system() -> None:
    response = client.post("/api/v1/analyze", json={"num": [1], "den": [1, 0, 4]})
    assert response.status_code == 200
    data = response.json()
    assert data["stability"]["verdict"] == "marginal"
    assert data["stability"]["basis"]["root_real_parts"]["on_imaginary_axis"] is True
    assert data["time_response"]["metrics"]["defined"] is False


def test_analyze_unstable_system_metrics_undefined() -> None:
    response = client.post("/api/v1/analyze", json={"num": [1], "den": [1, -1, 2]})
    assert response.status_code == 200
    data = response.json()
    assert data["stability"]["verdict"] == "unstable"
    assert data["time_response"]["metrics"]["defined"] is False
    assert any("发散" in warning for warning in data["warnings"])


def test_analyze_includes_frequency_and_locus() -> None:
    response = client.post("/api/v1/analyze", json={"num": [1], "den": [1, 2, 2, 0]})
    assert response.status_code == 200
    data = response.json()

    bode = data["frequency"]["bode"]
    assert len(bode["omega"]) == len(bode["magnitude_db"]) == len(bode["phase_deg"]) > 100
    assert len(data["frequency"]["nyquist"]["re"]) == len(bode["omega"])
    assert data["frequency"]["omega_min"] < data["frequency"]["omega_max"]

    locus = data["root_locus"]
    assert len(locus["branches"]) == 3
    assert locus["critical_gain"] is not None
    assert abs(locus["critical_gain"] - 4.0) < 0.3
    assert len(locus["gains"]) == 320


def test_analyze_respects_custom_ranges() -> None:
    response = client.post(
        "/api/v1/analyze",
        json={
            "num": [1],
            "den": [1, 1],
            "options": {"omega_min": 0.5, "omega_max": 50, "k_min": 0.01, "k_max": 10},
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert abs(data["frequency"]["omega_min"] - 0.5) < 1e-9
    assert abs(data["frequency"]["omega_max"] - 50) < 1e-9
    assert abs(data["root_locus"]["k_min"] - 0.01) < 1e-6
    assert abs(data["root_locus"]["k_max"] - 10) < 1e-6


def test_analyze_rejects_inverted_omega_range() -> None:
    response = client.post(
        "/api/v1/analyze",
        json={"num": [1], "den": [1, 1], "options": {"omega_min": 100, "omega_max": 1}},
    )
    assert response.status_code == 422


def test_analyze_improper_system_warns() -> None:
    response = client.post("/api/v1/analyze", json={"num": [1, 2, 1], "den": [1, 1]})
    assert response.status_code == 200
    data = response.json()
    assert data["transfer_function"]["is_proper"] is False
    assert data["transfer_function"]["quotient_expr"] is not None
    assert any("不是真分式" in warning for warning in data["warnings"])


def test_analyze_with_formula() -> None:
    response = client.post(
        "/api/v1/analyze",
        json={"formula": "K/(s*(s+1))", "params": {"K": 2}},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["transfer_function"]["num"] == [2.0]
    assert data["transfer_function"]["den"] == [1.0, 1.0, 0.0]
    assert data["parameters"] == [{"name": "K", "value": 2.0}]
    assert data["formula"] == "K/(s*(s+1))"
    assert data["stability"]["verdict"] == "marginal"


def test_analyze_formula_invalid_returns_422() -> None:
    response = client.post("/api/v1/analyze", json={"formula": "1/(s+"})
    assert response.status_code == 422


def test_analyze_requires_input_source() -> None:
    response = client.post("/api/v1/analyze", json={"num": [1]})
    assert response.status_code == 422


def test_analyze_rejects_zero_denominator() -> None:
    response = client.post("/api/v1/analyze", json={"num": [1], "den": [0, 0]})
    assert response.status_code == 422


def test_analyze_from_diagram() -> None:
    diagram = {
        "nodes": [
            {"id": "r", "kind": "input", "label": "R(s)"},
            {"id": "sum", "kind": "sum", "label": "E(s)"},
            {"id": "g", "kind": "block", "formula": "1/(s+1)"},
            {"id": "t", "kind": "takeoff"},
            {"id": "h", "kind": "block", "formula": "2"},
            {"id": "y", "kind": "output", "label": "Y(s)"},
        ],
        "edges": [
            {"source": "r", "target": "sum"},
            {"source": "sum", "target": "g"},
            {"source": "g", "target": "t"},
            {"source": "t", "target": "y"},
            {"source": "t", "target": "h"},
            {"source": "h", "target": "sum", "sign": -1},
        ],
    }
    response = client.post("/api/v1/analyze", json={"diagram": diagram})
    assert response.status_code == 200
    data = response.json()

    assert data["transfer_function"]["formula"] == "(1) / (s + 3)"
    assert data["stability"]["verdict"] == "stable"
    assert len(data["diagram"]["forward_paths"]) == 1
    assert len(data["diagram"]["loops"]) == 1


def test_analyze_diagram_without_path_returns_422() -> None:
    diagram = {
        "nodes": [
            {"id": "r", "kind": "input"},
            {"id": "g", "kind": "block", "formula": "1"},
            {"id": "y", "kind": "output"},
        ],
        "edges": [{"source": "r", "target": "g"}],
    }
    response = client.post("/api/v1/analyze", json={"diagram": diagram})
    assert response.status_code == 422


def test_analyze_rejects_unknown_field() -> None:
    response = client.post("/api/v1/analyze", json={"num": [1], "den": [1, 1], "foo": 1})
    assert response.status_code == 422
