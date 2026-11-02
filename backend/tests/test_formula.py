import pytest

from app.core.formula import compile_formula, extract_parameters, looks_like_formula


def test_plain_coefficient_formula() -> None:
    result = compile_formula("10/(s^2+2s+10)")
    assert result.num == [10.0]
    assert result.den == [1.0, 2.0, 10.0]
    assert result.parameters == []


def test_formula_with_parameter() -> None:
    result = compile_formula("K/(s*(s+1))", {"K": 2})
    assert result.num == [2.0]
    assert result.den == [1.0, 1.0, 0.0]
    assert result.parameters == [("K", 2.0)]


def test_second_order_parameter_form() -> None:
    result = compile_formula("wn^2/(s^2+2*zeta*wn*s+wn^2)", {"zeta": 0.3, "wn": 3})
    assert result.parameters == [("wn", 3.0), ("zeta", 0.3)]
    assert result.num == [9.0]
    assert result.den == [1.0, 1.8, 9.0]


def test_default_parameter_value_is_one() -> None:
    result = compile_formula("K/(s+1)")
    assert result.parameters == [("K", 1.0)]
    assert result.num == [1.0]


def test_implicit_multiplication_and_power() -> None:
    result = compile_formula("1/(s^3+2s^2+2s)")
    assert result.den == [1.0, 2.0, 2.0, 0.0]


def test_invalid_formula_raises() -> None:
    with pytest.raises(ValueError):
        compile_formula("1/(s+")
    with pytest.raises(ValueError):
        compile_formula("   ")


def test_denominator_zero_raises() -> None:
    with pytest.raises(ValueError):
        compile_formula("1/(s-s)")


def test_extract_parameters() -> None:
    assert extract_parameters("K/(s*(s+a))") == ["K", "a"]
    assert extract_parameters("10/(s^2+1)") == []


def test_looks_like_formula() -> None:
    assert looks_like_formula("1/(s+1)")
    assert not looks_like_formula("1 2 10")
