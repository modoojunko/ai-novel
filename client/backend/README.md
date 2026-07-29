# C端 后端 — AI Novel 本地后端服务

FastAPI 应用，作为单用户桌面应用的本地后端，提供 AI 写作、项目管理、Token 计费等核心功能。

## 技术栈

| 项 | 选型 |
|----|------|
| 框架 | FastAPI (Python) |
| 数据库 | SQLite (SQLAlchemy) |
| 认证 | JWT |
| 客户端 | httpx (AI API 调用) |
| 测试 | pytest |

## 开发

```bash
cd client/backend

# 安装依赖
pip install -r requirements.txt

# 启动（必须先启动 S端 本地模拟器）
python local_server.py          # 终端 1: S端 模拟器 (端口 19000)
DATA_ROOT=./data uvicorn main:app --reload --port 8000  # 终端 2: C端 后端
```

## 测试

```bash
# 运行全部测试
python -m pytest tests/ -v

# 运行单个测试
python -m pytest tests/ -k "test_name"
```

## 目录结构

```
client/backend/
├── main.py              FastAPI 入口
├── config.py            配置
├── db.py                SQLAlchemy + SQLite
├── ai_client.py         AI API 客户端
├── models/              ORM 模型
├── auth_local/          License 验证模块
├── projects/            项目 CRUD
├── settings/            设定管理
├── chapters/            卷章 CRUD
├── workflow/            阶段门控机
├── prompt/              提示词组装
├── write/               SSE 流式写作
├── archive/             归档
├── filesystem/          本地文件存储
├── story/               剧情推演
├── api_configs/         API Key 多配置管理
├── billing/             Token 计费
└── tests/               测试
```

## 关键设计

- **六阶段工作流**：init → settings → outline → prompt → write → archive
- **双存储后端**：本地文件系统或数据库（`STORAGE_BACKEND` 环境变量切换）
- **SSE 流式传输**：写作阶段每段一个 SSE 连接，支持并行流
- **Token 计费**：每次 AI 调用记录到 token_log，按模型单价扣除
