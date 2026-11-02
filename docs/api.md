# ControlLab API（v0.1.0）

后端只有一个分析端点，前端所有展示都由它一次返回。

- Base URL（开发）：`http://127.0.0.1:8000`
- 交互式文档：`/docs`（FastAPI 自动生成）

---

## GET /health

健康检查，桌面启动器用它判断后端是否就绪。

```json
{ "status": "ok", "version": "0.1.0" }
```

---

## POST /api/v1/analyze

### 请求

```json
{
  "formula": "wn^2/(s^2+2*zeta*wn*s+wn^2)",
  "params": { "zeta": 0.316, "wn": 3.162 }
}
```

`formula` 与 `num`/`den` 二选一：给了 `formula` 就用表达式（参数取 `params` 里的值，缺省为 1）；否则用系数。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `num` | `number[] \| null` | 条件 | 分子系数，**降幂**（s² → s → 常数）；与 `formula` 二选一 |
| `den` | `number[] \| null` | 条件 | 分母系数，降幂；即特征方程 D(s)=0 |
| `formula` | `string \| null` | 条件 | 传递函数表达式，如 `K/(s*(s+1))` |
| `params` | `object` | 否 | 公式里的未知参数取值，缺省 1.0 |
| `options.settling_band` | `number` | 否 | 调节时间误差带，默认 `0.02`（±2%），取值 (0, 0.2] |
| `options.t_end` | `number \| null` | 否 | 仿真时长（秒）；`null` 表示自动估计 |
| `options.omega_min` | `number \| null` | 否 | Bode/Nyquist 起始频率；`null` 时按极零点尺度自动取（每侧两个十倍频程） |
| `options.omega_max` | `number \| null` | 否 | 终止频率，必须大于 `omega_min` |
| `options.k_min` | `number \| null` | 否 | 根轨迹最小增益；`null` 自动（约为最小特征尺度 /1000） |
| `options.k_max` | `number \| null` | 否 | 最大增益；`null` 自动（扫到最远闭环极点约 8 倍特征尺度） |

公式语法：变量 `s`、数字、`+ - * / ^`、括号，支持隐式乘法（`2s`、`3(s+1)`）；其余标识符视为未知参数。
约束：系数必须为有限实数；`den` 不能全 0；最高次项不能为 0（前导 0 会被自动去掉）。
请求体不允许出现未知字段（返回 422）。

### 响应（节选）

```json
{
  "transfer_function": {
    "num": [10], "den": [1, 2, 10],
    "num_degree": 0, "den_degree": 2,
    "is_proper": true, "is_strictly_proper": true,
    "num_expr": "10", "den_expr": "s^2 + 2s + 10",
    "formula": "(10) / (s^2 + 2s + 10)",
    "quotient_expr": null
  },
  "poles": [{ "re": -1.0, "im": -3.0 }, { "re": -1.0, "im": 3.0 }],
  "zeros": [],
  "stability": {
    "verdict": "stable",
    "is_stable": true,
    "basis": {
      "necessary": {
        "all_coefficients_present": true,
        "same_sign": true,
        "missing_terms": [],
        "note": "特征方程各项齐全且系数同号，必要条件满足（充分性由 Routh 表判定）。"
      },
      "routh": {
        "rows": [["1", "10"], ["2", "0"], ["10", "0"]],
        "header": ["s^2", "s^1", "s^0"],
        "sign_changes": 0,
        "special_case": null,
        "note": "Routh 表首列无零元素，变号次数即右半平面闭环极点数。"
      },
      "root_real_parts": { "max_real": -1.0, "has_rhp": false, "on_imaginary_axis": false }
    },
    "dominant_poles": [{ "re": -1.0, "im": -3.0 }, { "re": -1.0, "im": 3.0 }],
    "summary": "系统稳定：闭环极点全部位于左半平面（Routh 表首列变号 0 次，右半平面极点 0 个）。主导极点 -1-3j，-1+3j（ωn≈3.162，ζ≈0.3162）。"
  },
  "time_response": {
    "t": [0.0, 0.0133, "..."],
    "y": [0.0, 0.0021, "..."],
    "metrics": {
      "steady_state": 1.0,
      "rise_time": 0.634,
      "peak_time": 1.0456,
      "overshoot_pct": 35.0906,
      "settling_time": 3.5417,
      "steady_state_error": 0.0,
      "defined": true,
      "note": null
    },
    "note": null
  },
  "warnings": []
}
```

### 字段说明

| 字段 | 说明 |
| --- | --- |
| `stability.verdict` | `stable` / `marginal`（临界稳定）/ `unstable` |
| `stability.basis.routh.rows` | Routh 表，**字符串**形式（精确分数，如 `"1/5"`、`"ε"`），按行从 s^n 到 s^0 |
| `stability.basis.routh.special_case` | `null` / `first_column_zero`（首列为 0，用 ε 法）/ `all_zero_row`（全零行，存在虚轴根） |
| `stability.basis.root_real_parts` | 用极点实部做的独立判据，与 Routh 互为校验 |
| `stability.dominant_poles` | 稳定时取最靠近虚轴的极点；不稳定时取实部最大者；最多 2 个 |
| `time_response.t / y` | 降采样到约 450–600 点的阶跃响应 |
| `time_response.metrics.defined` | 不稳定、临界稳定、含积分环节时为 `false`，其余指标为 `null` |
| `time_response.metrics.rise_time` | 欠阻尼 = 首次到达稳态值；过阻尼 = 10%→90% |
| `time_response.metrics.settling_time` | 最后一次离开误差带的时间；窗口内未进入则为 `null` |
| `warnings` | 输入被自动修正、非真分式、指标不适用等提示 |
| `parameters` | 公式里解析出的未知参数 `[{ "name": "wn", "value": 3.162 }]`，系数模式为空数组 |
| `formula` | 回显实际使用的公式文本（系数模式为 `null`） |

### 频域字段 `frequency`

```json
{
  "bode": { "omega": [0.032, "..."], "magnitude_db": [20.0, "..."], "phase_deg": [0.0, "..."] },
  "nyquist": { "re": [1.0, "..."], "im": [0.0, "..."], "omega": [0.032, "..."] },
  "omega_min": 0.031623, "omega_max": 316.228,
  "gain_crossover": 4.0,
  "phase_crossover": null,
  "gain_margin_db": null,
  "phase_margin_deg": 53.16,
  "note": null
}
```

| 字段 | 说明 |
| --- | --- |
| `bode.omega` | 对数等距的频率网格（400 点） |
| `bode.magnitude_db` | `20·log10|H(jω)|`，dB |
| `bode.phase_deg` | `unwrap` 后的相位，度 |
| `nyquist.re / im` | 同一频率网格上的 `H(jω)` 实部/虚部（只含 ω>0，前端自行镜像） |
| `gain_crossover` | 幅频穿越 0 dB 的频率 ωc |
| `phase_crossover` | 相频穿越 -180° 的频率 ωg |
| `phase_margin_deg` | 相角裕度 γ = 180° + ∠H(jωc) |
| `gain_margin_db` | 幅值裕度 Kg = -L(ωg)，dB |
| `note` | 含积分环节时的提示（低频幅值趋于无穷） |

### 根轨迹字段 `root_locus`

```json
{
  "branches": [[[ -1.0, -1.0], "..."], [[ -1.0, 1.0], "..."]],
  "gains": [0.00141, "..."],
  "open_loop_poles": [{ "re": 0.0, "im": 0.0 }],
  "open_loop_zeros": [],
  "k_min": 0.00141, "k_max": 2048.0,
  "critical_gain": 3.9999,
  "note": "根轨迹在 K≈3.9999 处穿过虚轴，该 K 为临界增益。"
}
```

| 字段 | 说明 |
| --- | --- |
| `branches[i][j]` | 第 i 条分支第 j 个采样点的 `[σ, jω]` |
| `gains` | 与每个采样点一一对应的 K 值（几何等距），前端用它做 tooltip |
| `open_loop_poles / zeros` | K→0 时的起点与开环零点 |
| `critical_gain` | 轨迹首次进入右半平面时的 K（线性插值），未穿越则为 `null` |
| `note` | 全程稳定 / 开环即不稳定 / 临界增益说明 |

> 非真分式（分子次数 ≥ 分母）时 `branches` 为空，`note` 说明根轨迹不适用。

### 错误

| 状态码 | 场景 | `detail` |
| --- | --- | --- |
| 422 | 分母全为 0、非有限数、未知字段、`num`/`den` 为空 | 字符串或 FastAPI 校验错误数组 |

### 调用示例

```bash
curl -s -X POST http://127.0.0.1:8000/api/v1/analyze ^
  -H "Content-Type: application/json" ^
  -d "{\"num\":[10],\"den\":[1,2,10]}"
```

```python
import requests

data = requests.post(
    "http://127.0.0.1:8000/api/v1/analyze",
    json={"num": [10], "den": [1, 2, 10]},
    timeout=10,
).json()

print(data["stability"]["verdict"])          # stable
print(data["time_response"]["metrics"]["overshoot_pct"])  # 35.0906
```
