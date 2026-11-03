"""ControlLab 单文件 exe 的入口。

与 `desktop/launcher.py` 的区别：这里在**本进程内**起 uvicorn，因此打包成 exe 后
不需要目标机器上装有 Python 或虚拟环境。

流程：挑空闲端口 -> 线程内启动 FastAPI -> 轮询 /health -> 用 Edge `--app` 开窗
-> 窗口关闭后停下服务。

用法（源码运行）：
    python desktop/app_exe.py                # 打开桌面窗口
    python desktop/app_exe.py --no-browser   # 只起服务，便于调试
    python desktop/app_exe.py --port 8000
"""

from __future__ import annotations

import argparse
import os
import socket
import sys
import tempfile
import threading
import time
import traceback
import urllib.error
import urllib.request
from pathlib import Path

APP_TITLE = "ControlLab"

# 源码运行时把 backend 放进 import 路径；打包后由 PyInstaller 的 --paths 负责
if not getattr(sys, "frozen", False):
    _BACKEND = Path(__file__).resolve().parents[1] / "backend"
    if str(_BACKEND) not in sys.path:
        sys.path.insert(0, str(_BACKEND))


def _data_dir() -> Path:
    """用户数据目录：优先 %LOCALAPPDATA%\\ControlLab，建不了就依次退回。

    有些机器的 AppData 目录 ACL 很紧（本机就是），mkdir 会 WinError 5，
    所以这里逐个候选点试，最后兜底到临时目录 / exe 同目录。
    """
    candidates: list[Path] = []
    for env in ("LOCALAPPDATA", "APPDATA"):
        base = os.environ.get(env)
        if base:
            candidates.append(Path(base) / APP_TITLE)
    candidates.append(Path(tempfile.gettempdir()) / APP_TITLE)
    candidates.append(Path(sys.executable).resolve().parent / f"{APP_TITLE}-data")

    for candidate in candidates:
        try:
            candidate.mkdir(parents=True, exist_ok=True)
        except OSError:
            continue
        return candidate
    return candidates[-1]


def _log(message: str) -> None:
    """无控制台（--windowed）时写日志文件，有控制台时同时打印。"""
    line = f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {message}"
    try:
        with (_data_dir() / "launcher.log").open("a", encoding="utf-8") as fh:
            fh.write(line + "\n")
    except OSError:
        pass
    stream = getattr(sys, "stdout", None)
    if stream is not None:
        try:
            print(line, flush=True)
        except (OSError, ValueError, AttributeError):
            pass


def _attach_streams() -> None:
    """--windowed 打包后 sys.stdout/stderr 是 None，uvicorn 等库一写就崩。

    这里把它们接到日志文件上，既避免崩溃，也方便用户排查。
    """
    if sys.stdout is not None and sys.stderr is not None:
        return
    try:
        log_file = (_data_dir() / "stdout.log").open("a", encoding="utf-8", buffering=1)
    except OSError:
        return
    if sys.stdout is None:
        sys.stdout = log_file
    if sys.stderr is None:
        sys.stderr = log_file


EDGE_CANDIDATES = [
    Path(os.environ.get("PROGRAMFILES(X86)", r"C:\Program Files (x86)"))
    / "Microsoft"
    / "Edge"
    / "Application"
    / "msedge.exe",
    Path(os.environ.get("PROGRAMFILES", r"C:\Program Files"))
    / "Microsoft"
    / "Edge"
    / "Application"
    / "msedge.exe",
    Path(os.environ.get("LOCALAPPDATA", str(Path.home())))
    / "Microsoft"
    / "Edge"
    / "Application"
    / "msedge.exe",
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


def wait_for_health(base_url: str, timeout: float = 40.0) -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(f"{base_url}/health", timeout=1.5) as response:
                if response.status == 200:
                    return True
        except (urllib.error.URLError, OSError):
            pass
        time.sleep(0.2)
    return False


def open_edge(edge: Path, url: str) -> os.PathLike | None:
    import subprocess

    profile = _data_dir() / "edge-profile"
    profile.mkdir(parents=True, exist_ok=True)
    command = [
        str(edge),
        f"--app={url}",
        f"--user-data-dir={profile}",
        "--no-first-run",
        "--no-default-browser-check",
        "--window-size=1440,940",
    ]
    _log("打开桌面窗口")
    return subprocess.Popen(command)


def _hide_console() -> None:
    """打包成 console 子系统的 exe，启动后立刻把自己的黑框藏起来。"""
    if os.name != "nt":
        return
    try:
        import ctypes

        hwnd = ctypes.windll.kernel32.GetConsoleWindow()
        if hwnd:
            ctypes.windll.user32.ShowWindow(hwnd, 0)  # SW_HIDE
    except Exception:
        pass


def main(argv: list[str] | None = None) -> int:
    _hide_console()
    _attach_streams()
    parser = argparse.ArgumentParser(description="ControlLab 桌面应用")
    parser.add_argument("--no-browser", action="store_true", help="只启动服务，不打开窗口")
    parser.add_argument("--port", type=int, default=0, help="服务端口，默认自动分配")
    args = parser.parse_args(argv)

    # 延迟导入：打包后 sys.path 里已包含 backend 目录
    import uvicorn

    from app.main import app

    port = args.port or pick_port()
    base_url = f"http://127.0.0.1:{port}"
    _log(f"启动服务 {base_url}")

    config = uvicorn.Config(
        app,
        host="127.0.0.1",
        port=port,
        log_level="warning",
        access_log=False,
    )
    server = uvicorn.Server(config)

    def _serve() -> None:
        try:
            server.run()
        except BaseException:  # 线程里的异常默认只打印，这里落盘
            _log("后端线程异常：\n" + traceback.format_exc())

    thread = threading.Thread(target=_serve, name="uvicorn", daemon=True)
    thread.start()

    if not wait_for_health(base_url):
        _log("服务启动失败，详见 launcher.log")
        return 1
    _log("服务已就绪")

    if args.no_browser:
        _log(f"仅服务模式，访问 {base_url}（Ctrl+C 退出）")
        try:
            while thread.is_alive():
                time.sleep(0.5)
        except KeyboardInterrupt:
            pass
        finally:
            server.should_exit = True
            thread.join(timeout=8)
        return 0

    edge = find_edge()
    try:
        if edge is None:
            _log("未找到 Microsoft Edge，改为用默认浏览器打开")
            import webbrowser

            webbrowser.open(base_url)
            while thread.is_alive():
                time.sleep(0.5)
        else:
            window = open_edge(edge, base_url)
            window.wait()
        return 0
    except KeyboardInterrupt:
        return 0
    finally:
        _log("关闭服务")
        server.should_exit = True
        thread.join(timeout=8)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except SystemExit:
        raise
    except Exception:  # 无控制台时至少把堆栈写进日志
        _log("启动失败：\n" + traceback.format_exc())
        raise SystemExit(1) from None
