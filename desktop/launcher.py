"""ControlLab 桌面启动器。

流程：挑选空闲端口 -> 启动后端 uvicorn -> 轮询 /health -> 用 Edge 的 --app 模式
打开无边框应用窗口 -> 窗口关闭后回收后端进程。

用法：
    python desktop/launcher.py                # 正常启动（打开桌面窗口）
    python desktop/launcher.py --no-browser   # 只起后端，便于调试
    python desktop/launcher.py --port 8000    # 指定端口
"""

from __future__ import annotations

import argparse
import os
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = PROJECT_ROOT / "backend"
FRONTEND_DIST = PROJECT_ROOT / "frontend" / "dist"
EDGE_PROFILE = PROJECT_ROOT / ".tmp" / "edge-profile"

EDGE_CANDIDATES = [
    Path(os.environ.get("PROGRAMFILES(X86)", r"C:\Program Files (x86)")) / "Microsoft" / "Edge" / "Application" / "msedge.exe",
    Path(os.environ.get("PROGRAMFILES", r"C:\Program Files")) / "Microsoft" / "Edge" / "Application" / "msedge.exe",
    Path(os.environ.get("LOCALAPPDATA", str(Path.home()))) / "Microsoft" / "Edge" / "Application" / "msedge.exe",
]


def pick_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def find_edge() -> Path | None:
    for candidate in EDGE_CANDIDATES:
        if candidate.is_file():
            return candidate
    return None


def backend_python() -> str:
    venv_python = BACKEND_DIR / ".venv" / "Scripts" / "python.exe"
    if venv_python.is_file():
        return str(venv_python)
    return sys.executable


def wait_for_health(base_url: str, process: subprocess.Popen, timeout: float = 30.0) -> bool:
    deadline = time.monotonic() + timeout
    health_url = f"{base_url}/health"
    while time.monotonic() < deadline:
        if process.poll() is not None:
            return False
        try:
            with urllib.request.urlopen(health_url, timeout=1.5) as response:
                if response.status == 200:
                    return True
        except (urllib.error.URLError, OSError):
            pass
        time.sleep(0.25)
    return False


def shutdown(process: subprocess.Popen) -> None:
    if process.poll() is not None:
        return
    process.terminate()
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=5)


def start_backend(port: int) -> subprocess.Popen:
    env = os.environ.copy()
    env.setdefault("PYTHONUTF8", "1")
    command = [
        backend_python(),
        "-m",
        "uvicorn",
        "app.main:app",
        "--host",
        "127.0.0.1",
        "--port",
        str(port),
        "--log-level",
        "warning",
    ]
    return subprocess.Popen(command, cwd=str(BACKEND_DIR), env=env)


def open_edge(edge: Path, url: str) -> subprocess.Popen:
    EDGE_PROFILE.mkdir(parents=True, exist_ok=True)
    command = [
        str(edge),
        f"--app={url}",
        f"--user-data-dir={EDGE_PROFILE}",
        "--no-first-run",
        "--no-default-browser-check",
        "--window-size=1440,940",
    ]
    return subprocess.Popen(command)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="ControlLab 桌面启动器")
    parser.add_argument("--no-browser", action="store_true", help="只启动后端，不打开桌面窗口")
    parser.add_argument("--port", type=int, default=0, help="后端端口，默认自动分配")
    args = parser.parse_args(argv)

    if not FRONTEND_DIST.is_dir():
        print("[ControlLab] 未找到前端构建产物，请先执行：cd frontend && npm run build")
        return 1

    port = args.port or pick_port()
    base_url = f"http://127.0.0.1:{port}"

    print(f"[ControlLab] 启动后端 {base_url}")
    backend = start_backend(port)

    try:
        if not wait_for_health(base_url, backend):
            print("[ControlLab] 后端启动失败，请检查 backend 目录下的运行日志")
            return 1

        print("[ControlLab] 后端已就绪")

        if args.no_browser:
            print(f"[ControlLab] 仅后端模式，访问 {base_url}（Ctrl+C 退出）")
            backend.wait()
            return 0

        edge = find_edge()
        if edge is None:
            print("[ControlLab] 未找到 Microsoft Edge，请手动访问", base_url)
            backend.wait()
            return 0

        print("[ControlLab] 打开桌面窗口")
        window = open_edge(edge, base_url)
        window.wait()
        return 0
    except KeyboardInterrupt:
        return 0
    finally:
        print("[ControlLab] 回收后端进程")
        shutdown(backend)


if __name__ == "__main__":
    raise SystemExit(main())
