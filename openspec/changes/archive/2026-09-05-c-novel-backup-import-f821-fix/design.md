## Context

backup-restore spec（已归档）对配置恢复的既定裁决：同名配置跳过不覆盖；user 子集只补空；密钥导出明文、导入端重加密。export 侧 `build_config_package_bytes` 的 config.yaml 结构：`format_version` + `user{display_name,api_key,api_base_url,api_model}` + `api_configs[{name,vendor,vendor_display_name,vendor_override,api_key,base_url,models,models_updated_at,created_at}]`。`_restore_config` 按此对称实现即为对齐 spec，无新语义。

约束：ApiConfig.api_key 库内为密文（`encrypt_api_key` 加密）；User.api_key/api_base_url/api_model 为 legacy 明文字段（导出即明文，导入原样补空）；时间字段来自 ISO 字符串需解析。

## Goals / Non-Goals

**Goals:**

- `_restore_config`：user 子集只补空 + api_configs 同名跳过/新建重加密，返回 {created, skipped} 摘要
- 版本快照导入路径可用（ChapterVersion 导入补齐）
- F821 清零，C端 后端 CI 转绿

**Non-Goals:**

- 智能挂回（书内模型名→配置的挂回）不实现（spec 有独立裁决，属后续工作）
- 同名配置的合并/覆盖语义（spec 裁定跳过）
- export 侧任何改动

## Decisions

1. **函数局部导入**：与 `_import_single_book` 既有风格一致（C端 后端避免顶层循环导入的既定写法）。
2. **api_configs 判重键 = name**：spec 原文「同名配置跳过不覆盖」，无 id 概念。
3. **时间字段容错**：models_updated_at/created_at 为 None 或非法串时落 None（与导出端 None 序列化对称）。
4. **_restore_config 返回摘要 dict**（{created, skipped, user_filled: [...]}）供调用方未来透出到恢复摘要；persist_package 现阶段不透出（保持返回结构不变，避免动前端契约）。

## Risks / Trade-offs

- [同名判定粒度粗（仅 name）] → spec 原文裁决如此；未来要精细化属 spec 演进
- [user.api_key legacy 明文补空] → 与导出/库内存储口径一致（legacy 字段本就明文），不改

## Migration Plan

无 DDL、无数据迁移；随常规 PR 合并生效。

## Open Questions

（无）
