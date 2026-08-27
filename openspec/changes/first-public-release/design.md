# first-public-release · 设计

## Context

打包流水线（`.github/workflows/client-package.yml`）已具备「v* 标签 → 双平台构建 → 冒烟 → `softprops/action-gh-release` 发 Release」的完整骨架，权限 `contents: write` 就绪，但从未被真实触发过（唯一标签 v0.4 早于管线诞生）。落地页 Hero 下载按钮存在 owner 拼写死链（`mooodjunko`），激活指引仅有 Windows 口径。安装包内已通过 #207 烘入线上 S端 正式域名。

## Goals / Non-Goals

**Goals:**

- 任意 `v*` 标签推送后，Releases 页自动出现四份资产：两份带版本号原件 + 两份固定命名副本。
- `releases/latest/download/<固定名>` 成为永久有效的最新版直链，供落地页或营销物料引用。
- 落地页下载入口修复为可达、双平台口径完整。

**Non-Goals:**

- macOS 正经签名与公证（需 Apple 开发者证书；ad-hoc + Gatekeeper 右键打开维持现状，获取说明在指引中口头交代即可）。
- 按 User-Agent 自动下发对应平台安装包的智能下载（未来可升级项，本次不做）。
- 旧 v0.4 空壳 Release 的清理或重打。
- 自建下载站 / 对象存储分发（GitHub Releases 免费且够用）。

## Decisions

### D1 · 直链采用「固定名副本」而非去掉版本号命名

三选一：(a) 安装包输出名去版本号 → 用户本地文件失去版本自描述，排查问题不利；(b) 在 Release 正文手写"最新版"链接 → 每次发版人工维护，违背"打 tag 即发布"的零操作原则；(c) Release 资产额外复制一份固定名（`AI-Novel-Setup-Windows.exe` / `AI-Novel-Setup-macOS.dmg`），原生利用 GitHub `releases/latest/download/<file>` 语义。选 (c)：改动收敛在 release job 内一步复制，原件保留利于溯源。代价是单 Release 资产翻倍至 4 个（均为引用同一构建产物，不增加构建时长）。

### D2 · 落地页按钮指向 Releases 页而非直链

Hero 主按钮 href 从 `https://github.com/mooodjunko/ai-novel/releases/latest` 修正 owner 为 `modoojunko`，仍指向**页面**而非直接 `.exe`/.dmg 直链：直链会让 300MB 级安装包立即开始下载且无法选择平台；Releases 页让用户按平台自选，fail-safe。按钮动词起句（「免费下载」）不变。

### D3 · v1.0 打标必须晚于本变更合入

release job 的新步骤只对**标签指向 commit 上的 workflow 定义**生效。因此顺序强制为：合入 PR → main CI 绿 → 再打 `v1.0`。若先打标则发布的是旧逻辑（无固定名副本），需要删 Tag 重来。

### D4 · 发布失败走「删 Tag 重打」而非 RC 演练

可用 `x.y.z-rc.n` 预发布标签先行演练，但 softprops 默认不把 `-rc` 后缀识别为 prerelease，需额外配置；而首次发布的失败代价极低（公开仓库删除 Release/Tag 即可重来，无外部消费者依赖固定名 URL）。故不做 RC 演练，接受一次可能的返工。

## Risks / Trade-offs

- [`latest/download` 走 GitHub CDN 短缓存，换版后数分钟内可能仍返回旧包] → 可接受；不用于更新校验（客户端更新机制不在本次范围）。
- [macOS arm64 包为 ad-hoc 签名，用户首开遇 Gatekeeper 拦截] → 激活指引与 Release 正文注明「右键 → 打开」绕行；治本待证书到位后单独立项。
- [Windows 静默 SmartScreen 提示（无 EV 代码签名证书）] → 同上，指引注明「仍要运行」；已知行业普遍现状。
- [PR 验证覆盖不到 release job（PR 触发不发 Release），D4 即为此兜底] → 发布动作本身设计为零参数幂等（下载 artifact → 复制 → 上传），review 时重点人眼核对 YAML diff。

## Migration Plan

1. 合入本变更 PR（workflow 增强 + 落地页两处文案/链接），main 全绿。
2. 在 main 上打 `v1.0` 并推送 → 观察 Actions run 至双平台绿。
3. 验证 Release：`gh release view v1.0` 见四资产；`curl -sIL .../releases/latest/download/AI-Novel-Setup-Windows.exe` 返回 302 且有体积。
4. 落地页截图对照归档进 change 目录（S端 微改的证据要求）。
5. 回滚路径：任何环节失败 → `gh release delete v1.0 --cleanup-tag`（或删远程 tag）→ 修复后重打 `v1.0.x`；落地页改动独立于发布链路，可单独 revert。

## Open Questions

（无——版本号 v1.0 与固定名文件已在 proposal/评审时拍板。）
