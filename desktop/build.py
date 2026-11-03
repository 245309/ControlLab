"""把 ControlLab 打包成可直接分发的 Windows 应用。

用法（在项目根目录执行）：

    backend\\.venv\\Scripts\\python.exe desktop\\build.py            # 构建到 dist/ControlLab
    backend\\.venv\\Scripts\\python.exe desktop\\build.py --zip      # 构建并打 zip

产物是 **onedir** 形式：`dist/ControlLab/` 目录，里面有 ControlLab.exe 与 `_internal/`。
选 onedir 而不是 onefile，是因为 onefile 每次启动都要解压到临时目录——本机 %TEMP%
的 ACL 很紧时解压会直接失败；onedir 不需要临时目录，启动也更快。
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DIST = PROJECT_ROOT / "dist"
WORK = PROJECT_ROOT / ".tmp" / "pyinstaller"
APP_NAME = "ControlLab"


def build() -> Path:
    if not (PROJECT_ROOT / "frontend" / "dist" / "index.html").is_file():
        raise SystemExit("缺少前端构建产物，请先执行：cd frontend && npm run build")

    command = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--noconfirm",
        "--clean",
        "--onedir",
        "--console",
        "--name",
        APP_NAME,
        "--paths",
        str(PROJECT_ROOT / "backend"),
        "--add-data",
        f"{PROJECT_ROOT / 'frontend' / 'dist'};frontend_dist",
        "--collect-submodules",
        "uvicorn",
        "--hidden-import",
        "uvicorn.logging",
        "--hidden-import",
        "uvicorn.loops.auto",
        "--hidden-import",
        "uvicorn.protocols.http.auto",
        "--hidden-import",
        "uvicorn.protocols.websockets.auto",
        "--hidden-import",
        "uvicorn.lifespan.on",
        "--distpath",
        str(DIST),
        "--workpath",
        str(WORK),
        "--specpath",
        str(WORK),
    ]
    for module in (
        "tkinter",
        "matplotlib",
        "PyQt5",
        "PySide6",
        "IPython",
        "pytest",
        "pandas",
    ):
        command += ["--exclude-module", module]
    command.append(str(PROJECT_ROOT / "desktop" / "app_exe.py"))

    print("[build] " + " ".join(command[:6]) + " ...")
    subprocess.run(command, check=True)
    return DIST / APP_NAME


def make_zip(folder: Path) -> Path:
    version = (PROJECT_ROOT / "backend" / "app" / "main.py").read_text(encoding="utf-8")
    version = version.split('APP_VERSION = "')[1].split('"')[0]
    archive = DIST / f"{APP_NAME}-{version}-win64.zip"
    if archive.exists():
        archive.unlink()
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for path in sorted(folder.rglob("*")):
            if path.is_file():
                zf.write(path, path.relative_to(DIST))
    return archive


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="打包 ControlLab")
    parser.add_argument("--zip", action="store_true", help="构建完成后再打一个 zip")
    args = parser.parse_args(argv)

    folder = build()
    size = sum(p.stat().st_size for p in folder.rglob("*") if p.is_file()) / 1024 / 1024
    print(f"[build] 完成：{folder}（{size:.1f} MB）")

    if args.zip:
        archive = make_zip(folder)
        print(f"[build] 压缩包：{archive}（{archive.stat().st_size / 1024 / 1024:.1f} MB）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
