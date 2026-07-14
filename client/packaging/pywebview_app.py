# client/packaging/pywebview_app.py
"""AI Novel 桌面应用入口 — pywebview 壳"""

import os
import sys
import json
import threading
import random
import time
from pathlib import Path


def get_base_dir() -> Path:
    if getattr(sys, 'frozen', False):
        return Path(sys._MEIPASS)
    return Path(__file__).parent


def start_server():
    """启动 FastAPI 后端"""
    base_dir = get_base_dir()
    backend_dir = base_dir / "backend"
    if backend_dir.exists():
        sys.path.insert(0, str(backend_dir))

    # 用户数据目录: %APPDATA%/AI Novel/
    appdata = Path(os.environ.get("APPDATA", ".")) / "AI Novel"
    appdata.mkdir(parents=True, exist_ok=True)

    # 写一条启动日志
    log_file = appdata / "startup.log"
    try:
        import uvicorn
        # GUI 模式下 sys.stdout/stderr 为 None，uvicorn 会崩溃
        if sys.stdout is None:
            sys.stdout = open(os.devnull, "w")
        if sys.stderr is None:
            sys.stderr = open(os.devnull, "w")

        # 设置环境变量
        os.environ.setdefault("DATA_ROOT", str(appdata / "data"))
        os.environ.setdefault("SERVER_API_BASE",
            os.environ.get("AI_NOVEL_SERVER_API", "https://your-cloudbase-app.com/api"))

        # PyInstaller 打包后，设置前端 dist 路径
        frontend_dist = base_dir / "frontend"
        if frontend_dist.exists():
            os.environ.setdefault("FRONTEND_DIST", str(frontend_dist))

        # 使用随机端口避免冲突
        port = random.randint(18000, 18999)

        # 保存端口号
        with open(appdata / "port.json", "w") as f:
            json.dump({"port": port}, f)

        with open(log_file, "a") as f:
            f.write(f"[{time.strftime('%H:%M:%S')}] Starting uvicorn on port {port}\n")

        # GUI 模式下 sys.stdout 为 None，uvicorn 的日志格式化会崩溃
        # 方案: 将日志输出重定向到文件
        log_config = {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "default": {
                    "()": "uvicorn.logging.DefaultFormatter",
                    "fmt": "%(levelprefix)s %(message)s",
                    "use_colors": False,
                },
            },
            "handlers": {
                "default": {
                    "formatter": "default",
                    "class": "logging.FileHandler",
                    "filename": str(appdata / "uvicorn.log"),
                    "mode": "a",
                },
            },
            "loggers": {
                "uvicorn": {"handlers": ["default"], "level": "WARNING", "propagate": False},
                "uvicorn.error": {"handlers": ["default"], "level": "WARNING", "propagate": False},
            },
        }
        uvicorn.run(
            "main:app",
            host="127.0.0.1",
            port=port,
            log_config=log_config,
        )
    except Exception as e:
        with open(log_file, "a") as f:
            f.write(f"[{time.strftime('%H:%M:%S')}] ERROR: {e}\n")
            import traceback
            traceback.print_exc(file=f)


def wait_for_server(appdata: Path, timeout: int = 15) -> int:
    """等待后端启动，返回端口号。超时返回 None。"""
    import urllib.request

    port_file = appdata / "port.json"
    start = time.time()

    while time.time() - start < timeout:
        if port_file.exists():
            try:
                with open(port_file) as f:
                    port = json.load(f)["port"]
                # 尝试连接 health 端点
                resp = urllib.request.urlopen(f"http://127.0.0.1:{port}/api/health", timeout=2)
                if resp.status == 200:
                    return port
            except Exception:
                pass
        time.sleep(0.5)
    return None


LOADING_HTML = """<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
    display: flex; justify-content: center; align-items: center;
    height: 100vh; font-family: -apple-system, sans-serif;
    flex-direction: column; color: #e0e0e0;
  }
  .spinner {
    width: 64px; height: 64px; border: 4px solid rgba(255,255,255,0.1);
    border-top-color: #64b5f6; border-radius: 50%;
    animation: spin 1s linear infinite; margin-bottom: 24px;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .title { font-size: 24px; font-weight: 600; margin-bottom: 8px; }
  .subtitle { font-size: 14px; color: #888; animation: pulse 2s ease-in-out infinite; }
  @keyframes pulse { 50% { opacity: 0.4; } }
</style>
</head>
<body>
  <div class="spinner"></div>
  <div class="title">AI Novel</div>
  <div class="subtitle">正在启动…</div>
</body>
</html>"""


def check_backend_and_navigate(window, appdata):
    """后台轮询，等后端就绪后跳转到应用页面"""
    port = wait_for_server(appdata, timeout=60)
    if port:
        with open(appdata / "startup.log", "a") as f:
            f.write(f"[{time.strftime('%H:%M:%S')}] Backend ready, navigating...\n")
        window.load_url(f"http://127.0.0.1:{port}")
    else:
        # 超时，弹错误
        import ctypes
        try:
            with open(appdata / "startup.log") as f:
                logs = f.read()
        except Exception:
            logs = "无日志"
        ctypes.windll.user32.MessageBoxW(0,
            f"后端启动超时，请检查日志:\n{appdata / 'startup.log'}\n\n{logs[-500:]}",
            "AI Novel 错误", 0x10)


def ensure_loading_page(appdata: Path) -> str:
    """把加载 HTML 写入本地文件，返回 file:// URL"""
    loading_path = appdata / "loading.html"
    loading_path.write_text(LOADING_HTML, encoding="utf-8")
    return loading_path.as_uri()


def main():
    """主入口"""
    appdata = Path(os.environ.get("APPDATA", ".")) / "AI Novel"
    appdata.mkdir(parents=True, exist_ok=True)

    # 把加载页写入临时文件
    loading_url = ensure_loading_page(appdata)

    # 自适应屏幕分辨率
    try:
        import ctypes
        user32 = ctypes.windll.user32
        sw = user32.GetSystemMetrics(0)
        sh = user32.GetSystemMetrics(1)
        win_w = sw - 80
        win_h = sh - 60
    except Exception:
        win_w, win_h = 1400, 900

    # 先弹出 pywebview 窗口显示加载动画
    import webview
    window = webview.create_window(
        title="AI Novel",
        url=loading_url,
        width=win_w,
        height=win_h,
        min_size=(1024, 680),
        resizable=True,
        text_select=True,
    )

    # 后台启动后端
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()

    with open(appdata / "startup.log", "a") as f:
        f.write(f"[{time.strftime('%H:%M:%S')}] Started server thread\n")

    # 后台轮询，等后端就绪后跳转
    threading.Thread(
        target=check_backend_and_navigate,
        args=(window, appdata),
        daemon=True,
    ).start()

    webview.start(debug=False)


if __name__ == "__main__":
    main()
