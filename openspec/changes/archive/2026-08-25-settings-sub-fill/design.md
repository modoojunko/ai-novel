# design

## Context

三栏改版后 .col-middle 内容区约 830px 宽、660px+ 高，但 .panel 受版心 max-width:660px 限制，.sub-list 还有 max-height:560px 上限。

## Goals / Non-Goals

- 目标：角色/伏笔子双栏占满中间栏整宽整高；e2e 锚点类名零变动。
- 非目标：改单对象面板；改 PreviewView（仍 two-col）。

## Realization

标记类方案（不用 :has()，避免兼容与特异性坑）：

- SettingsView 在 panel 为 chars/foreshadow 时给 `.panel` 追加 `sub-fill`，给表单 wrapper div 追加 `sub-wrap`。
- book.css 末尾追加 `.settings-v .panel.sub-fill` 系列规则：面板满宽 flex column + min-height:100%，`.sub-wrap`/`.subsplit` flex:1 + min-height:0 逐层传导，`.sub-form` 内部滚动。
- base.css 去掉 .sub-list 的 max-height:560px。
- 640px 窄屏媒体查询里用更高特异性恢复列表 220px 上限。

## Risks

- flex 高度链路断在中间无类名 wrapper（首版即踩中）→ 已用 .sub-wrap 补齐，e2e + 截图量测双验证。
