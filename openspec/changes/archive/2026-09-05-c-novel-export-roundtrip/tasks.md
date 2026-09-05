## 1. 双端影响判定（原型先行豁免依据）

- [x] 1.1 判定：C端 触用户可见界面，原型已完成并归位 docs/design-c/prototypes/backup-restore.html（v6/v7）+ spec + ADJUSTMENTS——UI 实现以原型为基线、偏差按登记簿执行；S端 零涉及；共享段不触碰。验证=本条勾选

## 2. PR0 旧库留档机制（无 UI 依赖，先行）

- [x] 2.1 `app_meta` 表（key/value）+ `models/__init__` 注册 + 启动期 schema 自动指纹（sha256 全表列签名排序 [:16]）写入 app_meta
- [x] 2.2 lifespan 最前插入留档逻辑：指纹不匹配 → `novel.db` 三件套改名 `novel.legacy-{时间戳}.db(/-wal/-shm)` → create_all 全新库；留档只增不删
- [x] 2.3 `GET /api/backup/legacy-db/status`（裸 sqlite3 只读 URI 查 book_count，异常→null 不 500）
- [x] 2.4 容器内全量 pytest 绿

## 3. PR1 导出端 + 壳层桥

- [x] 3.1 资产包格式 v1 导出重构 + backup.yaml 包级清单 + 中文产物名 + manifest.yaml
- [x] 3.2 配置包导出 + `GET /export/config/preview` 掩码端点
- [x] 3.3 壳层桥 NativeBridge（pick_folder/pick_save_file/pick_open_file 三方法）
- [x] 3.4 导出任务化 start/status 状态机（probe→assets→config→finalize）
- [x] 3.5 前端备份弹窗接线

## 4. PR2 导入端 + roundtrip

- [x] 4.1 `chapters/store.py` 抽 `apply_chapter_data(row, data)`（save_chapter 纯函数化，行为零变化）
- [x] 4.2 `backup/` 导入模块：形态探测+zip slip 白名单+逐书落库+配置恢复+智能挂回
- [x] 4.3 roundtrip 测试底座
- [x] 4.4 无壳回退

## 5. PR3 前端恢复 + e2e

- [x] 5.1 恢复弹窗双槽位+预览分块+分段进度+完成摘要
- [x] 5.2 e2e：导出双包/双槽位恢复/单书导出
- [x] 5.3 docker compose build 重建本地容器给用户验看

## 6. 回归与发布

- [x] 6.1 全量门禁：容器内 pytest 450 passed / playwright 154 绿 / vue-tsc 0 / design:lint 存量口径
- [x] 6.2 残余 grep 验收：无内部术语上屏、无 slug 上屏、无 token_log 随包代码路径
- [x] 6.3 全链演练：旧版造富库→导双包另存→覆盖装新版→设置导入→roundtrip 全绿（v0.151 DMG 用户验证通过）
- [ ] 6.4 归档走 PR（--admin 纯文档）
