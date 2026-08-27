# Proposal: outline-ai-draft-hardening — 章纲 AI 起草复检问题收口

## Why

PR #200（outline-ai-draft）review 发现 3 个边界问题：覆盖确认漏判 #198 新格子（场景卡/读者获得/章末落点/字数）会静默吞掉作者手填内容；首章哨兵字符串复制硬编码易随源头改版失效；segments 字数未做数值规整。

## What Changes

- 覆盖确认判定扩展：`hasContent` 纳入场景卡（任一行有内容）、读者获得（任一条有描述）、章末落点、目标字数——只在这些格子里填过内容的作者同样获得覆盖确认。
- 首章哨兵去重：ai_draft 引用 `chapter_writer._CH1_PREVIOUS`，删除内联复制的字符串字面量。
- segments 数值规整：`_sanitize_draft` 对 `target_words` 做 int 转换，非法回落 800（与 word_target clamp 同风格）。

## Capabilities

- **Modified Capabilities**: `workbench`（覆盖确认判定覆盖全部章纲格子）；`outline-ai-draft`（草稿数值规整）

## Impact

小改动：前端 ChapterWorkspace 一处判定 + 后端 sanitize 两处；新增回归测试（前端 confirm 场景、后端 target_words 字符串/非法值回落）。
