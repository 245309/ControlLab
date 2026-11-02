import sympy as sp

from app.core.mason import (
    DiagramEdge,
    DiagramNode,
    analyze_diagram,
    mason_delta,
    PathResult,
)


def test_duplicate_edges_are_counted_once() -> None:
    nodes = [
        DiagramNode("r", "input"),
        DiagramNode("sum", "sum"),
        DiagramNode("g", "block", "1/(s+1)"),
        DiagramNode("t", "takeoff"),
        DiagramNode("h", "block", "2"),
        DiagramNode("y", "output"),
    ]
    edges = [
        DiagramEdge("r", "sum"),
        DiagramEdge("sum", "g"),
        DiagramEdge("g", "t"),
        DiagramEdge("t", "y"),
        DiagramEdge("t", "h"),
        DiagramEdge("h", "sum", -1),
        # 手滑重复画了同一条反馈线：Mason 结果必须与只画一条时一致
        DiagramEdge("h", "sum", -1),
        DiagramEdge("t", "h"),
    ]
    result = analyze_diagram(nodes, edges)
    assert len(result.loops) == 1
    assert [round(v, 6) for v in result.den] == [1.0, 3.0]


def test_series_blocks() -> None:
    nodes = [
        DiagramNode("r", "input"),
        DiagramNode("g1", "block", "1/(s+1)"),
        DiagramNode("g2", "block", "3"),
        DiagramNode("y", "output"),
    ]
    edges = [
        DiagramEdge("r", "g1"),
        DiagramEdge("g1", "g2"),
        DiagramEdge("g2", "y"),
    ]
    result = analyze_diagram(nodes, edges)
    assert [round(v, 6) for v in result.num] == [3.0]
    assert [round(v, 6) for v in result.den] == [1.0, 1.0]
    assert len(result.forward_paths) == 1
    assert result.loops == []


def test_feedback_loop_gives_g_over_1_plus_gh() -> None:
    # R → Σ → G → 引出 → Y ；引出 → H → Σ(−) ⇒ T = G/(1+GH) = 1/(s+3)
    nodes = [
        DiagramNode("r", "input"),
        DiagramNode("sum", "sum"),
        DiagramNode("g", "block", "1/(s+1)"),
        DiagramNode("t", "takeoff"),
        DiagramNode("h", "block", "2"),
        DiagramNode("y", "output"),
    ]
    edges = [
        DiagramEdge("r", "sum"),
        DiagramEdge("sum", "g"),
        DiagramEdge("g", "t"),
        DiagramEdge("t", "y"),
        DiagramEdge("t", "h"),
        DiagramEdge("h", "sum", sign=-1),
    ]
    result = analyze_diagram(nodes, edges)
    assert [round(v, 6) for v in result.num] == [1.0]
    assert [round(v, 6) for v in result.den] == [1.0, 3.0]
    assert len(result.loops) == 1
    # 回路增益 = -2/(s+1)，Δ = 1 + 2/(s+1) = (s+3)/(s+1)
    assert sp.simplify(result.delta - (sp.Symbol("s") + 3) / (sp.Symbol("s") + 1)) == 0


def test_parallel_paths_add() -> None:
    nodes = [
        DiagramNode("r", "input"),
        DiagramNode("b1", "block", "2"),
        DiagramNode("b2", "block", "3"),
        DiagramNode("sum", "sum"),
        DiagramNode("y", "output"),
    ]
    edges = [
        DiagramEdge("r", "b1"),
        DiagramEdge("r", "b2"),
        DiagramEdge("b1", "sum"),
        DiagramEdge("b2", "sum"),
        DiagramEdge("sum", "y"),
    ]
    result = analyze_diagram(nodes, edges)
    assert [round(v, 6) for v in result.num] == [5.0]
    assert [round(v, 6) for v in result.den] == [1.0]
    assert len(result.forward_paths) == 2


def test_delta_with_non_touching_loops() -> None:
    loops = [
        PathResult(nodes=["a", "b"], gain=sp.Rational(1, 2)),
        PathResult(nodes=["c", "d"], gain=sp.Rational(1, 5)),
        PathResult(nodes=["b", "c"], gain=sp.Rational(1, 10)),
    ]
    delta = mason_delta(loops)
    # 1 - (0.5+0.2+0.1) + 0.5*0.2 = 0.3
    assert sp.simplify(delta - sp.Rational(3, 10)) == 0


def test_requires_one_input_and_output() -> None:
    nodes = [DiagramNode("r", "input"), DiagramNode("y1", "output"), DiagramNode("y2", "output")]
    try:
        analyze_diagram(nodes, [DiagramEdge("r", "y1")])
    except ValueError as exc:
        assert "输出" in str(exc)
    else:  # pragma: no cover
        raise AssertionError("应当抛出 ValueError")


def test_no_path_raises() -> None:
    nodes = [DiagramNode("r", "input"), DiagramNode("y", "output"), DiagramNode("g", "block", "1")]
    try:
        analyze_diagram(nodes, [DiagramEdge("r", "g")])
    except ValueError as exc:
        assert "通路" in str(exc)
    else:  # pragma: no cover
        raise AssertionError("应当抛出 ValueError")


def test_block_formula_error_is_reported() -> None:
    nodes = [DiagramNode("r", "input"), DiagramNode("g", "block", "1/(s+"), DiagramNode("y", "output")]
    try:
        analyze_diagram(nodes, [DiagramEdge("r", "g"), DiagramEdge("g", "y")])
    except ValueError as exc:
        assert "环节" in str(exc)
    else:  # pragma: no cover
        raise AssertionError("应当抛出 ValueError")
