## Why

C端 升级采用单轨制（用户拍板）：老版本引导用户一键导出双包（全部作品 + C端配置）另存 → 覆盖安装新版 → 新版导入恢复。兼容责任 100% 压在资产包 format_version 上，**导出闭环成立是后续一切 schema 演进（含 DB 改名）的前提**。同时资产包是双场景产品能力：升级保底 + 作品交付（书写完带走，数据主权卖点）。现有能力缺口：单书导出后端已有但前端零入口；多书备份/配置备份/包导入全部不存在；旧库留档与升级演练无机制。

## What Changes

- **双包格式契约 v1**：资产包（多书单 zip：project.yaml 契约头 + 每书 settings/volumes/chapters/versions/prompts/archives+manifest，8 资产对象全量）+ 配置包（config.yaml：users 子集 + api_configs 含密钥）；format_version 演进宪法（加键兼容/改布局升版留 N-1 读窗/冻结原文永不重排）；产物中文名（爱小说-备份-日期.zip / 爱小说-备份-配置-日期.zip / 《书名》-作品包-日期.zip）
- **旧库留档机制**：app_meta 表 + schema 自动指纹（sha256 表列签名）——启动时指纹不匹配即三件套改名留档（db/-wal/-shm）+ 全新空库启动；`GET /api/backup/legacy-db/status`（裸 sqlite 只读检测）
- **备份导出（目录选择+后端直写）**：壳层 js_api 桥（pick_folder/pick_save_file）；`POST /api/backup/export/start {target_dir}` 后台写双包进所选目录 + status 轮询真进度；设置「备份与恢复」为唯一入口
- **包导入恢复（双文件/单文件，文件选择器）**：`POST /api/backup/import/parse`（壳层选文件得**路径**，后端直读；multipart 为无壳回退）→ token staging → `POST /api/backup/import/persist`（聚合响应逐书状态+智能挂回）——2GB 上传问题随路径传递消失；**逐书原子**（单书单事务全成全败，书间独立，失败可单独重试）；限额豁免（恢复放行超额，只拦新建）；配置包密钥解密导出/本机重加密导入，同名配置跳过不覆盖
- **前端**：设置「备份与恢复」唯一入口（备份弹窗四步/恢复弹窗双槽位四步）；单书「导出」书卡菜单；更新通知「先备份」跳设置；首启零引导（现网 first-run 原状，升级后变体仅注脚一行「从备份恢复」）
- **明确不做**：自动发现/登记（恢复=文件选择器）；model-history/token_log/events 随包（界外）；旧 md/txt/docx 导入端点不动；grant_start 等既成列名不动

## Capabilities

### New Capabilities

- `backup-restore`: C端 备份导出与恢复导入——双包格式契约、导出目录选择+后端直写、双文件恢复、旧库留档检测、智能挂回

### Modified Capabilities

（无——既有 capability 行为不变）

## Impact

- **后端**：新 `backup/router.py`（9 端点）+ `backup_export.py`/`package_import.py` 模块 + `app_meta` 表 + `pywebview_app.py` 壳层桥 NativeBridge（pick_folder/pick_save_file/pick_open_file 三方法，本 change 交付）
- **前端**：`components/backup/` 4 新组件 + `hooks/` 3 新 + `lib/download.ts` + 设置/书卡/更新通知挂点
- **测试**：roundtrip 八层断言（公共底座，后续升级测试复用）+ 坏包矩阵 + 全链演练脚本
- **发布节奏（最大项目风险）**：版本 A（本 change，双包导出+恢复）先行 → 版本 B（schema 改名等）之后才允许；版本 A 发布说明含"升级前先备份"引导

## Design Impact

- 受影响端：**C端**（S端 零涉及）
- 受影响屏：设置弹窗新增行、书卡菜单增「导出」、更新通知两形态改造、新增备份/恢复两弹窗——**触用户可见界面**
- 原型：已完成并归位 `docs/design-c/prototypes/backup-restore.html`（v6/v7）+ spec + ADJUSTMENTS 六条登记——本 change 的 UI 实现以该原型为基线
- 共享段：不触碰 base.css 令牌（新组件用既有语义类+list.css 私有类）
