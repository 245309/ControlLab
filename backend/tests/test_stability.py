from app.core.stability import (
    build_routh_table,
    check_necessary_condition,
    classify_by_roots,
)


def test_routh_stable_second_order() -> None:
    result = build_routh_table([1, 2, 1])
    assert result.sign_changes == 0
    assert result.special_case is None
    assert result.rows[0][0] == "1"
    assert len(result.rows) == 3
    assert result.header == ["s^2", "s^1", "s^0"]


def test_routh_exact_fraction_keeps_sign() -> None:
    # 0.1/0.2 用浮点运算可能在某一列算出 ±1e-17，导致假变号
    result = build_routh_table([0.1, 0.2, 0.1])
    assert result.sign_changes == 0
    assert result.rows[1][0] == "1/5"


def test_routh_unstable_counts_sign_changes() -> None:
    result = build_routh_table([1, 1, 2, 8])
    assert result.sign_changes == 2
    assert result.special_case is None


def test_routh_all_zero_row_is_marginal() -> None:
    # s^3 + 2s^2 + 2s + 4 = (s + 2)(s^2 + 2)，虚轴上有 ±sqrt(2)j
    result = build_routh_table([1, 2, 2, 4])
    assert result.special_case == "all_zero_row"
    assert "全零行" in result.note


def test_routh_first_column_zero_uses_epsilon() -> None:
    # 第 3 行首列为 0，但整行不全为 0
    result = build_routh_table([1, 2, 3, 6, 5])
    assert result.special_case == "first_column_zero"
    assert any("ε" in cell for row in result.rows for cell in row)


def test_necessary_condition_detects_missing_term() -> None:
    result = check_necessary_condition([1, 0, 2])
    assert result.all_coefficients_present is False
    assert result.same_sign is True
    assert result.missing_terms == ["s^1"]
    assert "缺项" in result.note


def test_necessary_condition_detects_sign_change() -> None:
    result = check_necessary_condition([1, -1, 2])
    assert result.same_sign is False
    assert "不同号" in result.note


def test_routh_first_order_integrator_is_marginal() -> None:
    # den = s：常数项为 0，存在 s=0 的极点
    result = build_routh_table([1, 0])
    assert result.special_case == "all_zero_row"
    assert result.sign_changes == 0
    assert "常数项" in result.note or "全零行" in result.note


def test_classify_by_roots() -> None:
    assert classify_by_roots([complex(-1, 0), complex(-2, 0)])[0] == "stable"
    assert classify_by_roots([complex(0, 0), complex(-1, 0)])[0] == "marginal"
    assert classify_by_roots([complex(-1, 3), complex(-1, -3)])[0] == "stable"
    assert classify_by_roots([complex(0.5, 2), complex(0.5, -2)])[0] == "unstable"
