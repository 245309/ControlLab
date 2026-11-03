# ControlLab 开发环境（本机实测记录）

> 生成时间：2026-11-02。所有结论均在本机实测得到，可直接照此复现。

## 1. 版本清单

| 组件 | 版本 / 路径 | 备注 |
| --- | --- | --- |
| Python | 3.12.10（64-bit, MSC v.1943） | Microsoft Store 版 |
| Python 真实解释器 | `C:\Users\zhang\AppData\Local\Microsoft\WindowsApps\PythonSoftwareFoundation.Python.3.12_qbz5n2kfra8p0\python.exe` | PATH 上的 `python` 是失效的应用执行别名（exit 9009），**不要用** |
| 项目虚拟环境 | `E:\PY_Projects\Project4\ControlLab\backend\.venv` | 使用上述解释器创建 |
| pip | 25.0.1（venv 内） | |
| Node.js | v24.18.0（`D:\Tools\Nodejs`） | |
| npm | 11.16.0 | |
| Microsoft Edge | 156.0.4314.58 | `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`，桌面外壳用它 |
| .NET Framework | 4.8.1（Release 533509） | |
| .NET SDK 运行时 | 6.0 / 8.0 + WindowsDesktop | |
| 磁盘 | E: 可用 249.8 GB | |

## 2. 已安装的 Python 依赖

运行期（`backend\requirements.txt`）：

- fastapi 0.162.0
- uvicorn[standard] 0.54.0
- numpy 2.5.4
- scipy 1.18.1
- sympy 1.14.0

开发/测试：pytest 9.2.0、httpx 0.28.1。
打包（仅构建时需要，未写入 requirements.txt）：pyinstaller 6.22.3。

> M1 桌面外壳采用 Edge `--app` 模式，因此**不依赖** pywebview / pythonnet；
> 后两者已从环境移除（本机不可用，原因见第 4 节坑 3）。

## 3. 常用命令

```powershell
# 后端（开发时热重载）
cd E:\PY_Projects\Project4\ControlLab\backend
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000

# 前端
cd E:\PY_Projects\Project4\ControlLab\frontend
npm run dev

# 测试（必须在 backend 目录下执行，pytest.ini 的 --basetemp 才会生效）
cd E:\PY_Projects\Project4\ControlLab\backend
.venv\Scripts\python.exe -m pytest
```

## 4. 本机特有的坑（重要）

### 坑 1：以 mode 0o700 创建目录后无法访问

CPython 在 Windows 上会把 `os.mkdir(path, mode)` 的 mode 写进新目录的安全描述符。
本机沙箱令牌下，`0o700` 的目录**连创建它的进程都打不开**，表现为
`PermissionError: [WinError 5]`——pip、pytest、PyInstaller 都会中招。

已修复：`backend\.venv\Lib\site-packages\sitecustomize.py` 中把 `os.mkdir` 包一层、忽略 mode 参数。
该文件随 venv 存在，重建 venv 后需重新写入。

### 坑 2：pip.ini 必须是 UTF-8 无 BOM

带 BOM 的 `pip.ini` 会让 pip 26 报 `File contains no section headers`。
写入时用 `[IO.File]::WriteAllText(..., New-Object Text.UTF8Encoding($false))`。

### 坑 3：pythonnet / pywebview 在本机不可用

`import clr` 报 `Failed to resolve Python.Runtime.Loader.Initialize`。
根因：本机把 `Python.Runtime.dll` 判定为「远程来源」——
`Assembly.LoadFrom` 返回 `0x80131515`，`LoadFile` 提示需启用 `loadFromRemoteSources`；
但 `Assembly.Load(bytes)` 正常，说明 DLL 本身完好。
写 `python.exe.config` 无效，pythonnet 3.0.5 / 3.2.1 均失败。

**结论**：桌面外壳改用 Edge `--app=<url>` 打开无边框应用窗口，零额外依赖；
`desktop\launcher.py` 负责「分配端口 → 启动 uvicorn → 轮询 /health → 开 Edge → 退出时收尾」。
若将来在正常机器上需要更原生的窗口，可再引入 pywebview 作为可选增强。

### 坑 4：PowerShell 直连 HTTPS 失败

`Invoke-WebRequest` / `curl.exe` 报 `schannel SEC_E_NO_CREDENTIALS`；
但 **Python urllib 与 Node fetch 正常**，因此 pip / npm 不受影响。

## 5. 镜像与缓存配置

- `backend\.venv\pip.ini`
  ```ini
  [global]
  index-url = https://mirrors.aliyun.com/pypi/simple/
  trusted-host = mirrors.aliyun.com
  cache-dir = E:\PY_Projects\Project4\ControlLab\.pip-cache
  timeout = 60
  ```
- `frontend\.npmrc`
  ```ini
  registry=https://registry.npmmirror.com
  cache=E:\PY_Projects\Project4\ControlLab\.npm-cache
  fund=false
  audit=false
  ```

## 6. 已验证的能力

- uvicorn 能在本机回环地址绑定随机端口、响应 `/health`（200）、并干净退出。
- pytest 默认 basetemp 已可用（删除历史遗留的受限目录 `%TEMP%\dsh-*\pytest-of-zhang` 后修复）。
- npm 能从 npmmirror 安装包（react 实测 2 秒）。

## 7. 前端与桌面窗口

```powershell
cd E:\PY_Projects\Project4\ControlLab\frontend
npm install          # 首次
npm run build        # tsc --noEmit + vite build -> frontend/dist
```

- 后端启动时若发现 `frontend/dist`，会自动在 `/` 托管（`app/main.py`），所以桌面模式只需起后端。
- 桌面启动器：`backend\.venv\Scripts\python.exe desktop\launcher.py`，
  加 `--no-browser` 只起后端、`--port 8000` 指定端口。
- 启动器会为 Edge 使用独立配置目录 `ControlLab\.tmp\edge-profile`，不干扰日常浏览器的会话与插件。

> 本机构建注意：`npm install` / `npm run build` 需要派生子进程（esbuild、tsc），
> 必须在**非沙箱**进程里执行；esbuild 还会在系统临时目录写中间文件，
> 若遇到 `Access is denied`，把 `TEMP`/`TMP` 指到工作区内（如 `ControlLab\.tmp\build-tmp`）再构建即可。
> 普通用户直接执行不受影响。

## 8. 推送到 GitHub

仓库：<https://github.com/245309/ControlLab>（public，默认分支 `main`）

本机出网走系统代理 `127.0.0.1:7897`（`HKCU\...\Internet Settings\ProxyServer`）。
git 默认的 schannel 后端在这个环境里仍是 `SEC_E_NO_CREDENTIALS`，所以统一用 openssl 后端 + 显式代理：

```powershell
cd E:\PY_Projects\Project4\ControlLab
$env:HTTPS_PROXY='http://127.0.0.1:7897'; $env:HTTP_PROXY='http://127.0.0.1:7897'
git -c http.sslBackend=openssl -c http.proxy=http://127.0.0.1:7897 push origin main
```

- 凭据已存在 Windows 凭据管理器（`git credential fill` 直接取到 40 位 token），不需要每次输入。
- 代理关掉时直连推送：`git push origin main`（不再带 `-c http.proxy`）。
- 本地提交身份：`user.name = zhang`、`user.email = zhangyaoren2022@163.com`。

### 代理环境下的两个坑

1. **Python `urllib` 走这个代理会报 `CERTIFICATE_VERIFY_FAILED: unable to get issuer certificate`**
   —— 代理做了 TLS 中间人，Python 自带的 CA 包不认识它。
   调 GitHub API 时改用 `Invoke-RestMethod -Proxy http://127.0.0.1:7897`（走 Windows 证书库）或 `curl.exe --proxy`。
2. **`git credential fill` 在精简环境下会报「该平台上不支持操作」**
   —— 必须继承完整环境变量（尤其是 PATH 与 `GCM_*`），不要手动拼一个最小 env。

## 9. 打包成 exe（PyInstaller）

```powershell
cd E:\PY_Projects\Project4\ControlLab\frontend; npm run build; cd ..
backend\.venv\Scripts\python.exe desktop\build.py --zip
```

产物：`dist\ControlLab\ControlLab.exe` + `_internal\`，以及 `dist\ControlLab-<version>-win64.zip`（约 55 MB / 解压后 140 MB）。

### 为什么是 onedir + console

| 选择 | 原因 |
| --- | --- |
| `--onedir` | `--onefile` 启动时要解压到 `%TEMP%`，本机报 `[PYI-xxxx:ERROR] Could not create temporary directory!`（`%TEMP%` 的 ACL 偏紧），onedir 免解压、启动更快 |
| `--console` | `--windowed` 在本机表现为**静默退出**（连日志都不留，原因未定位）；console 版稳定，用 `_hide_console()`（`GetConsoleWindow` + `ShowWindow(hwnd, 0)`）在启动后把黑框藏掉，代价是闪一下 |

`desktop/app_exe.py` 里的几个防御，都是这次踩坑加的：

- `_data_dir()`：依次尝试 `%LOCALAPPDATA%` → `%APPDATA%` → `%TEMP%` → exe 同级 `ControlLab-data`。本机 `%LOCALAPPDATA%\ControlLab` 建不出来（`PermissionError [WinError 5]`），旧代码在这里抛异常、连带日志一起挂，表现为「双击没反应」。
- `_log()` 先写文件再打印，且把 `_data_dir()` 包在 try/except 里——保证任何情况下都有日志可查。
- `_attach_streams()`：`--windowed` 下 `sys.stdout` 是 `None`，打印会抛 `AttributeError`。

### 测试 exe 的正确姿势

**不要**在同步命令里 `Start-Process` 拉 GUI exe：工具调用会等子进程退出，表现为「命令卡 5–10 分钟」。改成

```
run_in_background: true  →  启动 exe
另起一次调用             →  探测 /health 与 /api/v1/analyze
Stop-Process             →  收尾
```

