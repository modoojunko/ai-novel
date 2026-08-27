# Tasks: outline-ai-draft-hardening

## 1. 前端

- [x] 1.1 ChapterWorkspace `hasContent` 扩展：场景卡/读者获得/章末落点/目标字数纳入覆盖确认判定
- [x] 1.2 e2e 补场景：只填场景卡 → 也弹覆盖确认（accept 后表单被替换）；整表空 → 不弹直接发起

## 2. 后端

- [x] 2.1 `_sanitize_draft` 段落 target_words int 规整，非法回落 800
- [x] 2.2 首章哨兵改引用 `_CH1_PREVIOUS`，删除内联字面量
- [x] 2.3 后端测试：target_words 字符串 "800"/"很多"/null 三态断言

## 3. 验收

- [x] 3.1 容器内 pytest + ruff 绿；vitest/tsc/design-lint 绿；docker 栈 e2e 全量绿
- [x] 3.2 PR 走查对照 spec Scenario 逐条验收
