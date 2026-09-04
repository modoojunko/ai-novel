## Context

设计沿革：五稿（PM/UX/FE/BE 架构师/UI）+ 原型 v6/v7 全部落定，评审 P0-1/P1 系列已按用户裁定收敛。完整背景：`~/Desktop/knowledge/c-client-upgrade-data-sop-2026-09.md`（升级 SOP）、`c-novel-export-roundtrip-design-2026-09.md`（架构师终版四）、`export-roundtrip-designs/`（四稿+评审）。现状代码：单书导出端点已有（novels/router.py:563）；导入只吃文本且半截风险（每章 commit+save_chapter 独立 session）；壳层 pywebview 6.x 无 js_api 桥（加桥归本 change）。

## Goals / Non-Goals

**Goals**
- 双包导出（目录选择+后端直写+真进度）与恢复（双槽位文件选择+逐书原子+智能挂回）全链闭环
- format_version 宪法 + roundtrip 八层断言成为后续 schema 演进的常驻门禁
- 旧库留档机制（自动指纹，零迁移零召回）

**Non-Goals**
- model-history/token_log/events 随包（用户裁定界外）；grant_start 等既成列名
- 自动发现/登记（恢复=文件选择器，用户裁定）；云备份/定时备份；按书勾选恢复（P2）
- 旧 md/txt/docx 导入端点改造；DB 列名变更

## Decisions

### D1 双包分文件，恢复双槽位

资产包与配置包是两个独立 zip、两条独立导入管线（parse multipart 收 1-2 文件按根级形态探测归并：backup.yaml→资产包/project.yaml→单书 v1/project.json→单书 v0/config.yaml→配置包）。恢复界面=两个明确槽位（作品备份/账号与模型配置）各带选择按钮，槽位即字段身份；文件经壳层 pick_open_file 得**路径**传后端直读（multipart 为无壳回退），2GB 上传消失，staging 瘦身为 path+size+mtime 引用+persist 复验（不一致 422 re_pick_required）。备选（单包内嵌全部+登记自动列出）被用户否（恢复=选路径即可）。

### D2 逐书原子，书间不共事务

恢复的最小保证单元=单书（单书单事务全成全败，失败可单独重试）；书间独立（零共享状态，库级回滚是反可救性——80 本 1 坏全回滚=0 本救回）。关键实现前提：settings 直写 ProjectSetting（绕开自开 session 的 storage 抽象）、从 save_chapter 拆 apply_chapter_data 纯函数（不动自动快照/状态机副作用）。persist 聚合响应+staging manifest 幂等重入（中断续传）。

### D3 导出=目录选择+后端直写（不走 HTTP 下载流）

壳层 js_api 桥（pick_folder/pick_save_file，pywebview FOLDER_DIALOG/SAVE_DIALOG）→ `POST /backup/export/start {target_dir, include_config}` → 后台线程写双包 → status 轮询真进度。替代 HTTP 流式下载的三个理由：2GB 内存 blob 消失、选一次目录产两个文件（P1-2 关闭）、真进度（写盘字节）。无壳 dev 回退 HTTP 下载（GET 端点保留）。恢复选文件同走壳层 pick_open_file（OPEN_DIALOG），multipart 保留为回退。

### D4 词汇与纪律（终稿评审后收敛）

用户可见词汇只两个动词：**备份**（给自己上保险，设置内）/ **导出**（把作品带走，书卡）；「恢复」≠「导入」（导入=文稿）。作品包/配置包/slug/format_version/schema 一律不上屏。错误文案全部带可点击出口。

### D5 发布节奏（本 change 最大的项目风险）

版本 A（本 change：双包+恢复，旧结构）先行发布并引导"升级前先备份" → 用户消化后，版本 B 及以后才允许 schema 破坏性演进（届时按 SOP 演练，本 change 的 roundtrip 即门禁）。

## Risks / Trade-offs

- [壳层桥依赖打包侧] → 桥代码在本 change 内交付（pywebview_app.py ~30 行）；无桥环境（dev）走 HTTP 回退
- [2GB multipart 中断整包重传] → 接受（本地回环，概率低）；staging manifest 支持续传
- [persist 单请求长事务超时] → 本地 sqlite 量级可控；兜底=book_ids 重入（manifest 幂等）
- [外部进程回退文件（三连实锤）] → 编辑后即验、推送字节级校验+远端复读
- [应用侧数据升级丢失的沟通] → 导出完成态一句披露+帮助文档同口径（不做大字警示）

## Migration Plan

四 PR 独立可合：PR0 留档机制（无 UI 依赖先行）→ PR1 导出端+壳层桥 → PR2 导入端+roundtrip → PR3 前端+e2e。版本 A 发布→演练记录归档→版本 B 后解锁 schema 演进。回滚：revert 即回，无 schema 破坏（app_meta/create_all 均幂等）。

## Open Questions

（无——五稿+评审+三轮用户裁定已收敛；遗留项 4 条按默认执行：v0 归档降级/2GB·5MB 限额/created_at 保留/旧端点不回修+自动备份归后续版本。）
