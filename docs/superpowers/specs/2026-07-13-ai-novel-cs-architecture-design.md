# AI Novel C/S 架构重构设计

> 把 AI Novel（爱小说）从 SaaS 多用户 Web 平台重构为 C/S 架构的桌面应用

## 背景

当前项目是受 SaaS 多用户 Web 平台，后端 FastAPI + 前端 React SPA + PostgreSQL，部署在 Docker Compose 上。运营成本包括服务器托管费、数据库托管费、以及 AI API 调用费。为降低成本并面向个人用户市场，决定重构为 C/S 架构：

- **C 端**：用户本地的桌面应用，PyInstaller + pywebview 打包为 .exe
- **S 端**：仅处理登录鉴权和 License 验证，使用腾讯云 CloudBase（云函数 + 云数据库 + 静态托管）
- **AI API**：用户自行配置通用 API Key（支持 OpenAI/Anthropic/DeepSeek 等任何兼容端点）
- **商业**：淘宝卖激活码，一次性/按年/按季/按月授权

## 设计原则

1. **S 端最小化**——无交易、无订单、无用户隐私数据，规避 ICP 要求
2. **本地优先**——核心功能全部离线可用，网络只用于 License 验证
3. **代码改动最小**——尽量保留现有后端代码，替换数据库从 PostgreSQL 到 SQLite，去掉 SaaS 特有模块
4. **用户体验像正经软件**——双击 .exe 弹出原生窗口，没有浏览器痕迹

## C 端架构

```
MyNovel.exe（启动后）
         │
         ▼
┌───────────────────────────────────┐
│  pywebview 窗口（Edge WebView2）    │
│  ┌─────────────────────────────┐  │
│  │  前端 React SPA（内嵌在.exe） │  │
│  │  · 激活/登录页面              │  │
│  │  · API Key 配置页面          │  │
│  │  · 设备管理页面               │  │
│  │  · 主写作界面（全功能）        │  │
│  └──────────┬──────────────────┘  │
└─────────────┼────────────────────┘
              │ 所有请求走 localhost
              ▼
┌───────────────────────────────────┐
│  FastAPI 后端（Uvicorn，内嵌在.exe） │
│                                    │
│  /api/auth/*     → License 验证    │
│  /api/projects/* → 项目 CRUD      │
│  /api/chapters/* → 卷章 CRUD      │
│  /api/settings/* → 设定管理        │
│  /api/write/*    → AI 流式写作    │
│  /api/prompt/*   → 提示词生成      │
│  /api/archive/*  → 归档操作        │
│  /api/story/*    → 剧情推演        │
│                                    │
│  本地数据库: data/novel.db (SQLite) │
│  项目文件: data/projects/          │
│  配置: data/config.json             │
└───────────────────────────────────┘
         │
         ▼ 仅以下情况联网
┌───────────────────────────────────┐
│  CloudBase S 端                    │
│  · 激活码验证 + 绑定账号+PC         │
│  · 启动时验证 License 有效性        │
│  · 后台每日心跳                     │
│  · 设备管理                         │
└───────────────────────────────────┘
```

### 打包方式

PyInstaller 将以下内容打包成一个 .exe（约 80-120MB）：
- Python 3.12 运行时 + 全部依赖
- FastAPI + Uvicorn 后端
- 前端 React build 产物（index.html + assets）
- pywebview（用于创建原生窗口）

### 启动流程

1. 用户双击 .exe
2. Python 启动 Uvicorn，绑定 127.0.0.1:随机端口
3. pywebview 创建 Edge WebView2 窗口，指向 http://127.0.0.1:端口
4. 首次运行 → 显示激活页面
5. 已激活 → 显示登录页面
6. 登录成功后 → 进入主写作界面

### 本地数据存储

| 数据 | 存储方式 | 路径 |
|------|---------|------|
| 数据库（用户/项目/卷章/设定等） | SQLite | `data/novel.db` |
| 小说内容文件（YAML/MD） | 文件系统 | `data/projects/{username}/{slug}/` |
| 应用配置（API Key/设备信息等） | JSON | `data/config.json` |

### C 端新增页面（前端）

| 页面 | 说明 |
|------|------|
| 激活页面 | 首次运行出现，输入激活码 + 设置用户名 + 密码 + 密保问题 |
| 登录页面 | 后续启动输入用户名 + 密码 |
| API Key 配置 | 设置 AI 供应商、API Key、Base URL、模型名 |
| 设备管理 | 查看/解绑已激活的 PC（每个设备显示名称和最后活跃时间） |
| 密码重置 | 通过密保问题重置密码 |

## License 验证机制

### 验证时机

| 时机 | 联网要求 | 行为 |
|------|---------|------|
| 首次激活 | 必须联网 | 输入激活码 → 设置用户名密码 → S 端验证 → 绑定设备 |
| 每次启动 | 优先联网 | 联网→S端验证，断网→读本地缓存 |
| 后台心跳 | 静默联网 | 启动后后台报到，用户无感知 |
| 续期操作 | 必须联网 | 输入新激活码 → S端叠加到期日 |

### 防篡改策略

| 攻击方式 | 防御 |
|----------|------|
| 调整系统时钟回拨延长使用 | 本地存上次心跳时间，系统时间 < 上次心跳时间则锁定 |
| 复制 .exe + 数据到新电脑 | PC hash 不同，S端验证拒绝 |
| 永久断网 | 超过 N 天（可配置，建议 90 天）未联网验证则锁定 |
| Token 重放 | JWT 短期有效 + 心跳刷新 |

### 设备绑定（PC Hash）

每台设备通过硬件特征计算唯一 hash（CPU 序列号 + 主板序列号 + 磁盘序列号的组合）。一个 License 最多绑定 3 台设备。用户可以在软件内查看设备列表并解绑。

## S 端 CloudBase 设计

### 架构总览

S 端仅使用 CloudBase 的三个功能：
- **静态网站托管** — Landing page + 发码管理页面
- **云函数** — 8 个 API 函数，Python 或 Node.js 运行时
- **云数据库** — 3 张表

### 数据模型

**codes（激活码表）**
```
code_id:        string (PK, 如 "AC-XXXX-YYYY")
tier:           enum(monthly, quarterly, yearly)
duration_days:  int
status:         enum(unused, active, expired)
bound_username: string (nullable, 激活后绑定)
activated_at:   datetime (nullable)
expires_at:     datetime (nullable)
created_at:     datetime
created_by:     string (发码人标识)
```

**users（用户表，最小化）**
```
username:       string (PK, 用户自定义昵称)
password_hash:  string (bcrypt)
security_question: string
security_answer_hash: string
status:         enum(active, locked)
created_at:     datetime
```

**devices（设备绑定表）**
```
username:       string (FK → users)
pc_hash:        string (设备指纹)
pc_name:        string (用户给设备起的名字，如"台式机")
last_active_at: datetime
bound_at:       datetime
first_activation_code: string (该设备首次使用的激活码)
```

**global_config（全局配置表）**
```
key:            string (PK)
value:          string
用途:
  - heartbeat_grace_days: "90" (未心跳宽限天数)
  - max_devices: "3" (最大绑定设备数)
  - latest_version: "1.0.0" (最新版本号，用于检查更新)
```

### 云函数 API

**① `POST /api/activate` — 激活码验证 + 首次注册**
```
入参: { activation_code, username, password, security_question, security_answer, pc_hash, pc_name }
出参: { success, token, tier, expires_at, devices: [...] }

逻辑:
  1. 查 codes 表，status != unused 则拒绝
  2. 检查 username 是否已存在
  3. bcrypt 哈希 password 和 security_answer
  4. 创建 users 记录
  5. 更新 codes 记录：status=active, bound_username=username, expires_at=today+duration_days
  6. 插入 devices 记录
  7. 生成 JWT，返回
```

**② `POST /api/login` — 登录**
```
入参: { username, password, pc_hash, pc_name }
出参: { success, token, devices: [{hash, name, last_active_at}], license_expires_at, tier }

逻辑:
  1. 查 users 表，验证 password_hash
  2. 查 username 名下所有 active 的 codes，合并计算 expires_at（取最大值）
  3. 如果 pc_hash 不在设备列表且设备数 >= max_devices，拒绝
  4. 如果 pc_hash 不在设备列表，插入新设备（绑定到该激活码）
  5. 更新设备的 last_active_at
  6. 生成 JWT（24h 有效期），返回
```

**③ `POST /api/verify` — 启动验证 / 每日心跳**
```
入参: { username, token, pc_hash }
出参: { valid, expires_at, tier, devices: [...] }

逻辑:
  1. 验证 JWT
  2. 查 username 名下所有 codes 计算合并到期日
  3. 查 pc_hash 是否在设备列表中
  4. 更新设备的 last_active_at
```

**④ `POST /api/renew` — 续期**
```
入参: { username, token, activation_code, pc_hash }
出参: { success, new_expires_at }

逻辑:
  1. 验证 JWT
  2. 查 activation_code 状态（必须是 unused）
  3. 计算原到期日（若未过期则取当前到期日，否则取今天）
  4. 新到期日 = 原到期日 + duration_days（叠加逻辑）
  5. 更新 codes 记录：status=active, bound_username=username, expires_at=新到期日
```

**⑤ `POST /api/devices/list` — 查看已绑定设备**
```
入参: { username, token }
出参: { devices: [{pc_hash, pc_name, last_active_at, bound_at}], max_devices }
```

**⑥ `POST /api/devices/remove` — 解绑设备**
```
入参: { username, token, pc_hash }
出参: { success }
```

**⑦ `POST /api/reset_password` — 密码重置**
```
入参: { username, security_answer, new_password }
出参: { success }

逻辑:
  1. 查 users 表，验证 security_answer_hash
  2. 更新 password_hash
```

**⑧ `POST /api/generate_code` — 生成激活码（管理用）**
```
入参: { admin_token, tier, count }
出参: { codes: ["AC-XXXX-YYYY", ...] }

逻辑:
  1. 验证 admin_token（固定 token，写死在云函数配置中，不是用户系统的一部分）
  2. 生成 count 个激活码
  3. 每条格式：AC-前缀 + 4段4位随机字母数字大写
  4. 批量插入 codes 表
```

### Landing Page + 发码页面

CloudBase 静态托管两个页面：

**Landing Page（首页）**
- 产品介绍、功能截图
- 下载 .exe 的链接
- 不涉及任何交易/注册功能

**发码管理页面（需要管理员权限）**
- 登录（使用 admin_token）
- 选择套餐（月/季/年）→ 输入数量 → 生成
- 显示生成的激活码列表，支持复制
- 查看已生成的码及其状态（已激活/未使用/已过期）
- 查看已绑定到指定用户名的所有码和到期日
- 提供给淘宝卖家使用

## 代码变动清单

### 保留的模块（仅改造适配本地）

| 模块 | 改动 |
|------|------|
| `db.py` | 切换连接为 SQLite（`sqlite+aiosqlite:///data/novel.db`），代码已支持 |
| `config.py` | 简化，去掉 SaaS 环境变量，保留本地路径配置 |
| `ai_client.py` | 改造为接受用户动态配置的 API Key + Base URL + 模型名 |
| `main.py` | 精简，去掉 auth/billing/admin 路由导入，加入 License 本地验证中间件 |
| `projects/` | 基本不改 |
| `chapters/` | 基本不改 |
| `settings/` | 基本不改 |
| `workflow/` | 基本不改 |
| `prompt/` | 基本不改 |
| `write/` | 基本不改（AI 调用改走用户 Key） |
| `archive/` | 基本不改 |
| `filesystem/` | 基本不改（本来就是本地文件） |
| `story/` | 基本不改 |
| `ai_prefill.py` | 基本不改 |

### 移除的模块

| 模块 | 原因 |
|------|------|
| `auth/` | 登录验证移到 S 端云函数处理 |
| `billing/` | 用户自带 API Key，不需要 Token 计费 |
| `admin/` | SaaS 运营后台，C/S 架构不需要 |

### 新增的 C 端代码

| 文件 | 说明 |
|------|------|
| `backend/auth_local/` | License 本地方校验（缓存到期日、时钟回拨检测、心跳管理） |
| `frontend/pages/ActivatePage.tsx` | 激活码输入 + 注册页面 |
| `frontend/pages/LoginPage.tsx` | 用户名密码登录页面 |
| `frontend/pages/ApiKeyConfigPage.tsx` | API Key 配置页面 |
| `frontend/pages/DeviceManagePage.tsx` | 设备管理页面 |
| `frontend/pages/ResetPasswordPage.tsx` | 密保重置密码页面 |
| `pyinstaller/` | PyInstaller 打包脚本 + spec 文件 |
| `pyinstaller/pywebview_app.py` | pywebview 入口文件，拉起 Uvicorn + 窗口 |
| `S端/` | CloudBase 云函数代码 + 静态页面源码 |

### 前端改动

| 改动 | 说明 |
|------|------|
| 去掉 LoginPage/RegisterPage | SaaS 登录注册不再需要 |
| 去掉 admin 页面 | SaaS 运营后台不再需要 |
| 新增激活/登录页 | 首次激活 + 用户名密码登录 |
| 新增 API Key 配置页 | 用户设置 AI 供应商参数 |
| 新增设备管理页 | 查看/解绑设备 |
| 新增密码重置页 | 密保重置 |
| 改造 API 层 | `api.ts` 改为调本地 localhost + 用户名 token 验证 |
| 增加 S 端通信层 | 封装 CloudBase API 调用 |

## 用户使用流程

### 首次使用

1. 从淘宝购买 → 获得激活码
2. 下载安装 MyNovel.exe → 双击启动
3. 弹出激活窗口：输入激活码、设置用户名、密码、密保问题
4. 设置 AI API Key（可跳过，稍后设置）
5. 进入主界面，像现在一样创作小说

### 日常使用

1. 双击 .exe
2. 输入用户名 + 密码登录
3. 后台静默验证 License + 心跳
4. 全功能写作

### 续期

1. 软件提示 License 即将过期，或用户主动点击续期
2. 弹出窗口要求输入新激活码
3. 验证成功，到期日自动叠加
4. 继续使用

### 换电脑

1. 旧电脑：软件内进入设备管理，点击"解绑本设备"
2. 新电脑：正常登录，S 端自动绑定新设备
3. 如果旧电脑无法操作（已丢失/报废），联系客服从后台解绑

### 更新版本

C 端可以内置一个简单的版本检查功能，启动时调 S 端 `GET /api/latest_version`（可放到 verify 接口里一并返回），发现新版本就提示用户下载。

## 实施优先级

### P0 — 核心可运行
1. S 端 CloudBase 搭建 + 云函数（activate/login/verify）
2. C 端后端：SQLite 适配 + 模块精简（去掉 auth/billing/admin）
3. C 端前端：激活/登录页面 + API Key 配置页面
4. AI Client 改造：支持用户动态配置 API Key
5. PyInstaller 打包脚本 + pywebview 入口
6. 完整端到端验证：下载 → 激活 → 创作 → 续期

### P1 — 完善
7. 设备管理页面 + 解绑功能
8. 密码重置（密保问题）
9. 心跳检查 + 时钟回拨检测
10. 发码管理页面
11. Landing page

### P2 — 打磨
12. 版本更新检测
13. 异常处理完善（网络超时、S 端不可用等）
14. 安装包签名（规避 Windows SmartScreen）
15. 淘宝发货自动化（可选）

## 开放问题

1. **自动更新机制** — 检测到新版本后，如何下载更新（内置下载器？还是跳转网页下载？）
2. **Windows SmartScreen** — 未签名的 .exe 会被 Windows 拦截，需要购买代码签名证书（~$200-500/年）
3. **Mac 版本** — 当前规划仅 Windows，但 pywebview 也支持 macOS，可后续考虑
