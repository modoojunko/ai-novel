# installer-release Specification (Delta)

## ADDED Requirements

### Requirement: 版本更新说明页

发版流水线 SHALL 为每个 `v*` 版本生成并转存更新说明页 `download/v<VER>/notes.html` 到静态托管（与安装包同目录，遵循版本化只增不改）。页面 MUST 含版本号、更新内容与双平台安装包下载直链。更新内容来源 MUST 按优先级取：tag 附注消息（annotated tag message）→ 上一版本以来的提交摘要 → 通用兜底文案；无 tag 附注 MUST NOT 使发版失败（回退生成）。页面 MUST 无需任何前端发版即可直接访问。

#### Scenario: 带 tag 附注发版生成说明页

- **WHEN** 发版 tag 为附注标签且附注含更新说明
- **THEN** `https://www.awesomenovel.com/download/v<VER>/notes.html` 返回 200，正文为附注内容并含双平台安装包直链

#### Scenario: 轻量 tag 回退不阻断

- **WHEN** 发版 tag 无附注消息
- **THEN** 说明页以提交摘要或通用兜底文案生成，发版流水线不因此失败

### Requirement: release.json 烘焙版本与检测地址

打包工作流在生成 release.json 时 SHALL 额外烘入三个键：`client_version`（`v*` 标签构建写去前缀的真实版本号；PR/手动构建写 `dev`）、`client_update_url`（主检测地址，取仓库 Variable `CLIENT_DOWNLOAD_BASE` 拼接 `latest.json`，未配置时默认 `https://www.awesomenovel.com/download/latest.json`）与 `client_update_url_fallback`（兜底检测地址，取 Variable `CLIENT_DOWNLOAD_BASE_FALLBACK` 拼接 `latest.json`，未配置时默认云托管静态托管直连域 `https://ai-novel-test-d1ghsr86ra814c12c-1468883265.tcloudbaseapp.com/download/latest.json`）。三者随既有 datas 通道分发，打包冒烟断言 MUST 覆盖这三个新键真实烘进产物。换任一域名 MUST 只改仓库 Variable，不需要改任何代码。

#### Scenario: tag 构建烘入真实版本

- **WHEN** `v0.13` 标签触发出包
- **THEN** 产物内 release.json 含 `"client_version": "0.13"`、指向主下载域 latest.json 的 `client_update_url` 与指向云托管直连域的 `client_update_url_fallback`

#### Scenario: PR 构建写 dev

- **WHEN** PR 触发打包验证（非 tag）
- **THEN** 产物内 release.json 的 `client_version` 为 `dev`，安装该包的应用跳过更新检测

#### Scenario: 换域名零代码

- **WHEN** 仓库 Variable `CLIENT_DOWNLOAD_BASE` 或 `CLIENT_DOWNLOAD_BASE_FALLBACK` 变更
- **THEN** 此后构建的安装包检测地址指向新值，仓库代码无改动

## MODIFIED Requirements

### Requirement: 安装包国内分发

系统 SHALL 在 `v*` 标签发版时把双平台安装包转存到静态托管（CloudBase Hosting）的 `/download/v<VER>/` 目录，文件名与 GitHub Release 资产 1:1（`AI_Novel_Setup_v<VER>.exe` / `AI_Novel_mac_v<VER>.dmg`）。转存完成后系统 SHALL 更新 `download/latest.json`，该文件 MUST 是落地页下载弹窗与 C端 更新检测共同的唯一线上事实源；更新它 MUST NOT 依赖任何前端重新发版。latest.json 载荷契约：`version` MUST 必写；`notes`（一句话更新摘要，取 tag 附注首行自动写入，无附注时可省略）与 `min_version`（强更门槛，本期仅预留字段、客户端不实现强更逻辑）为可选键，缺省 MUST 可省略。所有 latest.json 消费方（落地页下载弹窗、C端 更新检测）MUST 同时兼容"仅 version"的最小载荷与含可选键的完整载荷。转存或 latest.json 更新失败 MUST 使发版流水线失败，不得静默。已发布的版本目录 MUST 只增不改（版本化路径永不覆盖，使长缓存安全）。

#### Scenario: 发版后国内直链可下载

- **WHEN** 任意 `v*` 标签发版流水线成功结束
- **THEN** `https://www.awesomenovel.com/download/v<VER>/AI_Novel_Setup_v<VER>.exe` 返回 200，且字节数与 GitHub Release 同名资产一致（dmg 同理）

#### Scenario: latest.json 即时生效

- **WHEN** `download/latest.json` 的版本号被更新（CI 自动或人工）
- **THEN** 落地页下载弹窗与已安装 C端 的下一次检测解析到的版本随之变化，无需任何前端重新发版

#### Scenario: 最小载荷向后兼容

- **WHEN** latest.json 仅含 `{"version": "0.13"}`（无 notes/min_version）
- **THEN** 落地页下载弹窗与 C端 更新检测均正常工作，不因缺失可选键报错

#### Scenario: 转存失败不静默

- **WHEN** 转存上传或 latest.json 写入的校验未通过
- **THEN** 发版流水线以失败结束并给出明确错误，GitHub Release 可能已建但流水线状态不得为绿
