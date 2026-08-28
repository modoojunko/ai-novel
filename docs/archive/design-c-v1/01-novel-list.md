# 书列表屏（01-novel-list）交互规格

原型：`../prototypes/01-novel-list.html?theme=<novelforge|parchment>&state=<books|empty>`
实现：`client/frontend/src/pages/NovelListPage.tsx`（路由 /#/novels）

## 状态矩阵

| 状态 | 数据前提 | 顶部横幅 | 主体 |
| --- | --- | --- | --- |
| books | PRO 会员（is_member）、1 本书、已配 Key | 无 | 1 书卡 + 虚线新增卡（免费满额时虚线卡消失） |
| empty | 免费层（tier=none）、0 本书、已配 Key | ✨ 开通 7 天免费试用 | 空态引导（导入/开始新小说双按钮） |

其他横幅（实现存在、原型暂未收编，校准时按需补状态）：
- 套餐过期：alert-warning「⏰ 套餐已过期…」+ 续费恢复/了解套餐
- 试用中：alert-info「🔥 试用还剩 N 天…」+ 开通 PRO
- 未配 Key：alert-info「💡 还没配置 API Key」+ 去配置链接

## 交互

- 书卡整卡点击 → 进入工作台（/#/novel/:id）；「⋯」更多菜单：重命名 / 删除（删除需二次确认）
- 虚线卡/「开始新小说」→ 新建弹窗（免费满额时入口隐藏：末尾虚线卡 + 头部按钮均不出现在 books 满额态）
- 「导入」→ 导入弹窗（.md/.txt/.docx）
- 免费口径：`!isMember && novels.length >= 1` 即满额（与后端 require_project_limit 一致）

## 固定数据（parity 打桩）

书：`剑起苍澜` / 2 卷 / 12 章 / updated_at 2026-08-20T10:30:00Z（渲染「2026/8/20」）
