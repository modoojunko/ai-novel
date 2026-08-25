# tasks

## 1. 布局实现

- [x] 1.1 SettingsView 角色/伏笔面板加 `sub-fill` 标记类，表单 wrapper 加 `sub-wrap`
- [x] 1.2 base.css 去掉 .sub-list 的 max-height:560px
- [x] 1.3 book.css 追加满宽满高规则 + 640px 窄屏特异性修正
- [x] 1.4 容器重建后截图 + 数值量测确认子双栏占满（list/form 全高）

## 2. 测试

- [x] 2.1 design-lint 通过
- [x] 2.2 e2e 全量通过（50 passed / 11 skipped）
- [x] 2.3 vitest + tsc 通过（82 passed / 0 error）

## 3. 收尾

- [x] 3.1 勾 tasks + `openspec validate settings-sub-fill` + 提交推送（只提交 client/ 代码）
