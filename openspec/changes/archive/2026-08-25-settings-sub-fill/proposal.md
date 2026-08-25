# settings-sub-fill

## Why

设定视图改三栏后，「角色」「伏笔」这类多对象设定的内嵌子双栏仍被挤在 660px 版心卡里：中间栏 900+px 的空间只用到不到七成，列表和表单都很局促。

## What Changes

- 角色/伏笔面板占满中间栏内容区的整宽整高（去掉 max-width 版心限制，纵向从标题下拉到确认按钮）。
- 单对象设定项（题材/简介/主线/世界/风格/AI痕迹控制/AI 模型）保持版心卡不变。
- 纯 CSS + 标记类实现：面板加 `sub-fill` 标记类，锚点类名不动，e2e 零适配。

## Scope

- `client/frontend/src/components/novel/workbench/SettingsView.tsx`（标记类）
- `client/frontend/src/design/base.css`（去掉 .sub-list 560px 上限）
- `client/frontend/src/design/book.css`（满栏规则 + 窄屏特异性修正）
- 非目标：主线下游消费、书列表新建按钮。
