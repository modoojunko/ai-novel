# Creation Flow Simplification (Name-Only Create)

## Why

创建弹窗要求作者先经历 AI 起名、写简介、确认类型、等待 AI 预填设定——本应 10 秒的起步动作被拖到几分钟，误触关闭即丢失内容。导入路径、AI 起名与"书名即创建"冲突，本次迭代明确不做（页面不可见）。

## What Changes

### creation-flow/spec.md (capability)

- 创建弹窗仅收集书名（极简单 stage）；页面无导入入口、无 AI 起名。
- 改名：仅改显示名，slug/root_path 不变。
- 故事简介、题材类型后置到 settings 阶段手动补录（简介卡全局常驻）。
- settings 内 AI 一键生成入口本次隐藏。
- 免费用户创建/改名不再被 require_ai_access 拦截。

## Status

已实现并验证：commit `e459df9`（2026-08-02）。pytest 165 passed；tsc + build 通过；Docker + CDP 浏览器实测全绿。
