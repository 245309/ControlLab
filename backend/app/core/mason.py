"""框图 → 信号流图 → Mason 增益公式。

约定：
- 每个节点都是一个信号点；环节节点带增益 g，进入环节的边增益为 1、离开的边增益为 g；
- 比较点就是「入度 ≥ 2 的节点」，每条入边带 +1/-1 号；
- 引出点就是「出度 ≥ 2 的节点」，信号原样分流；
- 于是框图可以直接当作信号流图求 Mason 公式：

      T(s) = Σ P_k·Δ_k / Δ
      Δ = 1 - ΣL_i + ΣL_iL_j - ΣL_iL_jL_k + …
"""

from __future__ import annotations

import itertools
from dataclasses import dataclass, field

import sympy as sp

from .formula import _poly_coeffs, compile_gain

MAX_NODES = 30
MAX_EDGES = 80
MAX_PATHS = 60
MAX_LOOPS = 40
MAX_LOOPS_FOR_DELTA = 12


@dataclass
class DiagramNode:
    id: str
    kind: str
    formula: str | None = None


@dataclass
class DiagramEdge:
    source: str
    target: str
    sign: int = 1


@dataclass
class PathResult:
    nodes: list[str]
    gain: sp.Expr


@dataclass
class MasonResult:
    input_id: str
    output_id: str
    forward_paths: list[PathResult]
    loops: list[PathResult]
    delta: sp.Expr
    numerator: sp.Expr
    denominator: sp.Expr
    num: list[float]
    den: list[float]
    parameters: list[tuple[str, float]] = field(default_factory=list)


def _adjacency(
    nodes: list[DiagramNode],
    edges: list[DiagramEdge],
    params: dict[str, float] | None,
) -> tuple[dict[str, list[tuple[str, sp.Expr]]], list[tuple[str, float]]]:
    gains: dict[str, sp.Expr] = {}
    parameters: dict[str, float] = {}

    for node in nodes:
        if node.kind != "block":
            continue
        text = (node.formula or "1").strip() or "1"
        try:
            expr, node_parameters = compile_gain(text, params)
        except ValueError as exc:
            raise ValueError(f"环节「{node.id}」的表达式有误：{exc}") from exc
        gains[node.id] = expr
        for name, value in node_parameters:
            parameters.setdefault(name, value)

    adjacency: dict[str, list[tuple[str, sp.Expr]]] = {node.id: [] for node in nodes}
    for edge in edges:
        gain = gains.get(edge.source, sp.Integer(1))
        if edge.sign < 0:
            gain = -gain
        adjacency[edge.source].append((edge.target, gain))

    return adjacency, sorted(parameters.items())


def _forward_paths(
    adjacency: dict[str, list[tuple[str, sp.Expr]]],
    start: str,
    end: str,
) -> list[PathResult]:
    results: list[PathResult] = []

    def dfs(node: str, visited: set[str], nodes: list[str], gain: sp.Expr) -> None:
        if len(results) > MAX_PATHS:
            raise ValueError(f"前向通路超过 {MAX_PATHS} 条，框图过于复杂")
        for target, edge_gain in adjacency.get(node, []):
            if target == end:
                results.append(PathResult(nodes=[*nodes, target], gain=gain * edge_gain))
            elif target not in visited:
                visited.add(target)
                nodes.append(target)
                dfs(target, visited, nodes, gain * edge_gain)
                nodes.pop()
                visited.remove(target)

    dfs(start, {start}, [start], sp.Integer(1))
    return results


def _loops(adjacency: dict[str, list[tuple[str, sp.Expr]]]) -> list[PathResult]:
    results: list[PathResult] = []
    order = sorted(adjacency)

    def dfs(start: str, node: str, visited: set[str], nodes: list[str], gain: sp.Expr) -> None:
        for target, edge_gain in adjacency.get(node, []):
            if target == start:
                results.append(PathResult(nodes=list(nodes), gain=gain * edge_gain))
            elif target not in visited and target > start:
                visited.add(target)
                nodes.append(target)
                dfs(start, target, visited, nodes, gain * edge_gain)
                nodes.pop()
                visited.remove(target)

    for start in order:
        dfs(start, start, {start}, [start], sp.Integer(1))
        if len(results) > MAX_LOOPS:
            raise ValueError(f"回路超过 {MAX_LOOPS} 个，框图过于复杂")

    return results


def mason_delta(loop_items: list[PathResult]) -> sp.Expr:
    """Δ = 1 - ΣL_i + Σ(互不接触 L_iL_j) - Σ(...) + …"""
    total = sp.Integer(1)
    count = len(loop_items)
    if count > MAX_LOOPS_FOR_DELTA:
        raise ValueError(f"回路数 {count} 超过 {MAX_LOOPS_FOR_DELTA}，无法展开 Δ")

    node_sets = [set(item.nodes) for item in loop_items]
    for size in range(1, count + 1):
        sign = -1 if size % 2 else 1
        for combo in itertools.combinations(range(count), size):
            sets = [node_sets[index] for index in combo]
            touching = any(
                sets[a] & sets[b]
                for a in range(len(sets))
                for b in range(a + 1, len(sets))
            )
            if touching:
                continue
            product = sp.Integer(1)
            for index in combo:
                product *= loop_items[index].gain
            total += sign * product
    return sp.together(total)


def analyze_diagram(
    nodes: list[DiagramNode],
    edges: list[DiagramEdge],
    params: dict[str, float] | None = None,
) -> MasonResult:
    if not nodes:
        raise ValueError("框图是空的：请先放置输入、环节和输出")
    if len(nodes) > MAX_NODES:
        raise ValueError(f"节点数超过 {MAX_NODES} 个")
    if len(edges) > MAX_EDGES:
        raise ValueError(f"连线数超过 {MAX_EDGES} 条")

    ids = {node.id for node in nodes}
    inputs = [node for node in nodes if node.kind == "input"]
    outputs = [node for node in nodes if node.kind == "output"]
    if len(inputs) != 1:
        raise ValueError("需要恰好一个输入节点 R(s)")
    if len(outputs) != 1:
        raise ValueError("需要恰好一个输出节点 Y(s)")
    if inputs[0].id == outputs[0].id:
        raise ValueError("输入与输出不能是同一个节点")

    for edge in edges:
        if edge.source not in ids or edge.target not in ids:
            raise ValueError("存在指向不存在节点的连线")
        if edge.source == edge.target:
            raise ValueError("不支持节点自环，请改用「引出点 + 环节」构成反馈")

    adjacency, parameters = _adjacency(nodes, edges, params)

    forward_paths = _forward_paths(adjacency, inputs[0].id, outputs[0].id)
    if not forward_paths:
        raise ValueError("输入到输出之间没有通路，请检查连线方向")

    loops = _loops(adjacency)
    delta = mason_delta(loops)

    numerator = sp.Integer(0)
    for path in forward_paths:
        path_nodes = set(path.nodes)
        untouched = [loop for loop in loops if not (set(loop.nodes) & path_nodes)]
        numerator += path.gain * mason_delta(untouched)
    numerator = sp.together(numerator)

    transfer = sp.together(numerator / delta)
    num_expr, den_expr = sp.fraction(transfer)
    num = _poly_coeffs(sp.expand(num_expr), sp.Symbol("s"))
    den = _poly_coeffs(sp.expand(den_expr), sp.Symbol("s"))

    if all(abs(value) < 1e-12 for value in den):
        raise ValueError("框图求得的传递函数分母恒为 0")

    return MasonResult(
        input_id=inputs[0].id,
        output_id=outputs[0].id,
        forward_paths=forward_paths,
        loops=loops,
        delta=delta,
        numerator=numerator,
        denominator=delta,
        num=num,
        den=den,
        parameters=parameters,
    )
