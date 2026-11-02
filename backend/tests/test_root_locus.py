from app.core.root_locus import compute_root_locus


def test_first_order_locus_moves_along_real_axis() -> None:
    data = compute_root_locus([1.0], [1.0, 1.0], poles=[-1 + 0j], zeros=[])
    assert len(data.branches) == 1
    branch = data.branches[0]
    # K→0 时闭环极点 = 开环极点 -1
    assert abs(branch[0][0] + 1.0) < 0.02
    assert abs(branch[0][1]) < 1e-6
    # K 增大，极点沿实轴向左移动
    assert branch[-1][0] < branch[0][0] - 1.0
    assert data.critical_gain is None


def test_locus_branch_count_equals_order() -> None:
    data = compute_root_locus([1.0], [1.0, 1.0, 0.0], poles=[0j, -1 + 0j], zeros=[])
    assert len(data.branches) == 2
    # s(s+1)+K=0 对所有 K>0 都稳定
    assert data.critical_gain is None
    assert data.note is not None and "左半平面" in data.note


def test_critical_gain_matches_routh() -> None:
    # s^3+2s^2+2s+K=0，Routh 给出 0<K<4
    data = compute_root_locus([1.0], [1.0, 2.0, 2.0, 0.0], poles=[0j, complex(-1, 1), complex(-1, -1)], zeros=[])
    assert len(data.branches) == 3
    assert data.critical_gain is not None
    assert abs(data.critical_gain - 4.0) < 0.25
    assert "临界增益" in (data.note or "")


def test_locus_starts_at_open_loop_poles() -> None:
    data = compute_root_locus([1.0, 2.0], [1.0, 3.0, 2.0], poles=[-1 + 0j, -2 + 0j], zeros=[-2 + 0j])
    starts = sorted(round(branch[0][0], 2) for branch in data.branches)
    assert starts == [-2.0, -1.0]


def test_improper_system_rejected() -> None:
    try:
        compute_root_locus([1.0, 2.0, 1.0], [1.0, 1.0], poles=[], zeros=[])
    except ValueError as exc:
        assert "分子次数" in str(exc)
    else:  # pragma: no cover
        raise AssertionError("应当抛出 ValueError")
