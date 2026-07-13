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

        uvicorn.run(
            "main:app",
            host="127.0.0.1",
            port=port,
            log_level="info",
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


def main():
    """主入口"""
    appdata = Path(os.environ.get("APPDATA", ".")) / "AI Novel"
    log_file = appdata / "startup.log"

    # 在后台线程启动后端
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()

    with open(log_file, "a") as f:
        f.write(f"[{time.strftime('%H:%M:%S')}] Started server thread\n")

    # 等待后端启动（最多 15 秒）
    port = wait_for_server(appdata)
    if port is None:
        # 超时，试试读日志
        with open(log_file) as f:
            logs = f.read()
        # 弹错误消息再退出
        import ctypes
        ctypes.windll.user32.MessageBoxW(0,
            f"后端启动失败，请检查日志:\n{log_file}\n\n{logs[-500:]}",
            "AI Novel 错误", 0x10)
        return

    with open(log_file, "a") as f:
        f.write(f"[{time.strftime('%H:%M:%S')}] Backend ready on port {port}\n")

    # 启动 pywebview 窗口
    import webview
    window = webview.create_window(
        title="AI Novel",
        url=f"http://127.0.0.1:{port}",
        width=1400,
        height=900,
        min_size=(1024, 680),
        resizable=True,
        text_select=True,
    )
    webview.start(debug=False)


if __name__ == "__main__":
    main()
