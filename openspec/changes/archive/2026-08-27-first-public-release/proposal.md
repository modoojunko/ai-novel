## Why

正式域名已上线 HTTPS，S端 在公网可访问，用户能从落地页走完注册登录；但走到「下载客户端」这一步断了——GitHub Releases 页上没有任何安装包。打包→发布链路其实已在 workflow 中就绪（tag 触发双平台构建并自动发 Release），却从未被触发过：唯一的 tag v0.4 打于打包管线诞生之前，其 Release 为空壳。同时落地页 Hero 的下载按钮还拼错了仓库 owner（`mooodjunko`），当前是死链。

## What Changes

- CI release job 增强：发布 v* tag 时除带版本号的安装包外，额外上传两份固定命名副本（`AI-Novel-Setup-Windows.exe` / `AI-Novel-Setup-macOS.dmg`），使 `releases/latest/download/<固定名>` 成为稳定直链。
- 落地页 HeroSection 下载按钮修链接拼写错误：`mooodjunko/ai-novel` → `modoojunko/ai-novel/releases/latest`。
- 落地页激活指引第 1 步文案补 macOS：从"仅 Windows 客户端"改为双平台口径。
- 运维动作（非代码）：在 main 上打 `v0.1` tag 推送，触发首个线上公开版发布（版本号拍板 v0.1，作为正式上线的第一个公开版）。

不在本变更范围：macOS 正经签名与公证（需 Apple 开发者证书，ad-hoc 签名维持现状）、旧 v0.4 Release 清理。

## Capabilities

### New Capabilities

- `installer-release`: C端 安装包的公开发布链路与入口——每个 v* tag SHALL 产出双平台安装包挂载到 GitHub Releases 并提供稳定直链文件名；落地页下载入口 SHALL 指向正确的 Releases 地址且覆盖双平台。

### Modified Capabilities

（无）

## Impact

- `.github/workflows/client-package.yml`：release job 新增固定名副本上传步骤。
- `server/frontend/src/components/landing/HeroSection.vue`：修正外链 owner。
- `server/frontend/src/components/landing/ActivationGuideSection.vue`：补 macOS 文案。
- GitHub Actions：下一次 v* tag 推送即验证全链路（构建 → 冒烟 → Release 挂载四件资产）。
- 落地页为纯文案/外链改动，无路由、无契约、无数据面变化。

## Design Impact

- 受影响端：S端（落地页）；CI 改动无 UI 面。
- 受影响屏：落地页 HeroSection（下载按钮外链）+ ActivationGuideSection 第 1 步（文案加一句 macOS 口径）。无弹层。
- 对象状态：无新增/修改状态（链接颜色态沿用既有 .btn 同族形态）；文案遵循 §13——按钮词保持动词（「免费下载」「下载安装」），补救语句自带出口（跳转 Releases 页）。
- 共享段：不触碰两端共享 base.css / 组件词汇；语气词不涉及 notice/pill/toast 新增。
- 原型先行：免（纯 S端 微改），实现后在 change 目录附落地页渲染截图对照。
- 设计工件由谁产出：实现侧自查（design:lint + tsc 全绿即可，无像素 parity 门禁约束端）。
