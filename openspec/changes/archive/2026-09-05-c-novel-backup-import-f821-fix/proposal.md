## Why

c-novel-export-roundtrip（#308/#310/#312）落地的 `backup/import.py` 存在两处 F821 未定义引用，均为功能性崩溃点而非 lint 问题：

1. `persist_package` L82 调用 `await _restore_config(db, user_id, info["config"])`，但该函数全仓未定义——用户走「配置恢复」槽位（include_config=True）时 NameError 崩溃。
2. `_import_single_book` L233 使用 `ChapterVersion(...)`，但函数局部导入块只导入了 `Chapter, ChapterContent`——含版本快照的书包导入到快照段必崩。

C端 后端 CI 因此持续红（F821 lint + 潜在测试触达），阻塞全部后续 PR 的合并。

## What Changes

- 实现 `backup/import.py::_restore_config(db, user_id, config_data)`：按 backup-restore spec 既定裁决对称 export 侧格式——user 子集「只补空」（display_name/api_key/api_base_url/api_model 不覆盖已有值）；api_configs 逐条 **同名跳过不覆盖**，新建行密钥经 `encrypt_api_key` 重加密（导出端明文、导入端重加密，spec 原文约定）。
- `_import_single_book` 函数局部导入补 `ChapterVersion`（与 Chapter/ChapterContent 同源 models.chapter）。
- 不改 export 侧、不改包格式、不改挂回逻辑（智能挂回属后续工作，本变更不覆盖）。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

（无——本变更是把实现对齐到 backup-restore spec 既有 Requirement（恢复导入），不引入/修改任何需求。`.openspec.yaml` 已声明 skip_specs。）

## Impact

- `client/backend/backup/import.py`：新增 `_restore_config`（约 40 行）+ 一行导入修正。
- 测试：`client/backend/tests/` 新增配置恢复与版本快照导入用例；C端 后端 CI 随 F821 消除转绿。
- 影响用户路径：「配置恢复」槽位与「含版本快照的书包导入」由必崩变为可用。

## Design Impact

无用户可见界面改动（PrefsModal 等前端不在本变更范围）。纯后端缺陷修复。
