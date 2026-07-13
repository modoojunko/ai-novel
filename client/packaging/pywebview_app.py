# client/packaging/pywebview_app.py
"""AI Novel 桌面应用入口 — pywebview 壳

PyInstaller 打包后运行在 sys._MEIPASS 临时目录中。
开发态运行时从 client/packaging/ 按相对路径查找模块。
"""

import os
import sys
import json
import threading
import random
from pathlib import Path


def get_base_dir() -> Path:
    """获取应用基础目录

    PyInstaller 打包后: sys._MEIPASS (exe 的解压临时目录)
    开发态: client/packaging/pywebview_app.py 的父目录
    """
    if getattr(sys, 'frozen', False):
        return Path(sys._MEIPASS)
    return Path(__file__).parent


def start_server():
    """启动 FastAPI 后端"""
    # 设置 Python 模块路径
    base_dir = get_base_dir()
    backend_dir = base_dir / "backend"
    if backend_dir.exists():
        sys.path.insert(0, str(backend_dir))

    import uvicorn

    # 使用随机端口避免冲突
    port = random.randint(18000, 18999)

    # 用户数据目录: %APPDATA%/AI Novel/
    appdata = Path(os.environ.get("APPDATA", ".")) / "AI Novel"
    appdata.mkdir(parents=True, exist_ok=True)

    # 保存端口号供后续使用
    with open(appdata / "port.json", "w") as f:
        json.dump({"port": port}, f)

    # 环境变量
    os.environ.setdefault("DATA_ROOT", str(appdata / "data"))
    os.environ.setdefault("SERVER_API_BASE",
        os.environ.get("AI_NOVEL_SERVER_API", "https://your-cloudbase-app.com/api"))

    # PyInstaller 打包后，设置前端 dist 路径供 main.py 挂载
    frontend_dist = base_dir / "frontend"
    if frontend_dist.exists():
        os.environ.setdefault("FRONTEND_DIST", str(frontend_dist))

    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=port,
        log_level="info",
    )


def main():
    """主入口"""
    # 在后台线程启动后端
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()

    # 等待后端启动
    import time
    time.sleep(2)

    # 读取端口
    appdata = Path(os.environ.get("APPDATA", ".")) / "AI Novel"
    with open(appdata / "port.json") as f:
        port = json.load(f)["port"]

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
    webview.start(debug=False, window=window)


if __name__ == "__main__":
    main()
