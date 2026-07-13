# packaging/pywebview_app.py
"""AI Novel 桌面应用入口 — pywebview 壳"""

import os
import sys
import json
import threading
import random
import subprocess
from pathlib import Path


# 确保能找到后端模块
backend_dir = Path(__file__).parent.parent / "backend"
if backend_dir.exists():
    sys.path.insert(0, str(backend_dir))


def start_server():
    """启动 FastAPI 后端"""
    import uvicorn
    # 使用随机端口避免冲突
    port = random.randint(18000, 18999)
    # 保存端口号供前端调用
    config_dir = Path(os.environ.get("APPDATA", ".")) / "AI Novel"
    config_dir.mkdir(parents=True, exist_ok=True)
    port_file = config_dir / "port.json"
    with open(port_file, "w") as f:
        json.dump({"port": port}, f)

    # 设置环境变量
    os.environ.setdefault("DATA_ROOT", str(config_dir / "data"))
    os.environ.setdefault("SERVER_API_BASE", "https://your-cloudbase-app.com/api")

    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=port,
        log_level="info",
    )


def main():
    """主入口"""
    # 在后台线程启动后端服务
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()

    # 等待后端启动
    import time
    time.sleep(2)

    # 读取端口
    config_dir = Path(os.environ.get("APPDATA", ".")) / "AI Novel"
    port_file = config_dir / "port.json"
    with open(port_file) as f:
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
