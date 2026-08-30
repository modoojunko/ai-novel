# 双端影响判定（tasks 1.1）

日期：2026-08-30 ｜ 判定人：实施会话（依据 proposal「Design Impact」）

## 结论

- **S 端**：界面改动 = 控制台「我的账户」页（/dashboard/account）+ 注销向导弹层三态 + 撤销期提示条/状态行 + 登录页注销态反馈。纯 S 端自有改动，词汇全部复用既有 .panel/.pill/.notice/.btn/.mcard/.set-row（account-settings.html 与 console.html 同源），**免原型先行**（原型已完成：prototypes/account-settings.html + account-deletion.html，且已经三轮用户评审）。
- **C 端**：无界面变化。仅 client/backend 代理层消费 S 端认证失效响应（清 config.json 凭据 + 结构化信号）与 client/frontend 回跳登录屏（复用既有登录屏，无像素变化）。design:check（像素 parity）**不适用**。
- **共享段**：不触碰 base.css 令牌与基础类 → design-cross **不适用**。

## 已确认的实现期补充（与 proposal 判定一致）

1. 注销向导确认步新增「我已将小说文档导出并自行妥善保存」必勾声明（2026-08-30 用户要求，spec R6 scenario / 协议 §三.6④ 已同步）。
2. C 端登录页失效提示需带「你设备上的作品仍完好保留」（US-6.1）。
3. 硬前置：登录页「忘记密码找回」入口必须真实存在（story map §1 前置条件）；C 端作品导出功能需同批实现（todo.md 中优先）。

## 验证

- [x] 判定记录存在，结论与 proposal Design Impact 一致
- [x] 确认无需 design-cross（不触共享段）
- [ ] 截图对照在 4.3 补入（实现完成后）
