# backup-restore Specification

## Purpose
C端 备份导出与恢复导入：把用户的全部小说资产打包为与数据库无关的开放格式文件（yaml/md），并能从包完整恢复；同时携带账号与模型配置的配置包，使升级/换机后无需重配。是 C端 长期本地升级向前兼容的保底能力。

## Requirements

### Requirement: 双包格式契约 v1

备份产物 SHALL 为两个独立 zip：**资产包**（全部活跃书，每书一目录：project.yaml/ story.yaml/threads.yaml/settings 树/volumes/vol-N.yaml/chapters/vol-N-ch-M.yaml/versions 冻结原文/prompts 原文/archives 原文+manifest.yaml）与**配置包**（config.yaml：format_version 契约头+user 子集+api_configs 含密钥）。给代码读的一律 yaml；versions/prompts/archives 为冻结原文原样写入。资产包元数据 SHALL 含 format_version（缺失视为 v0 旧包）。产物文件名 SHALL 为中文自标识（爱小说-备份-日期.zip / 爱小说-备份-配置-日期.zip / 《书名》-作品包-日期.zip，书名取 name 字段，slug MUST NOT 上屏）。

#### Scenario: 备份导出双包

- **WHEN** 已登录用户在设置发起备份并选择保存目录
- **THEN** 所选目录内生成资产包与配置包两个 zip，包含全部活跃书的 8 类资产对象与全部 api_configs（密钥明文，本机解密导出）
- **AND** 用量台账（token_log）、模型切换历史、埋点（events）不出现在任何包内

#### Scenario: 冻结原文不重排

- **WHEN** 导出含版本快照与归档的书
- **THEN** versions/*.json 与 archives/*.md 的内容为库内原文字节级直写，不做任何格式转换

#### Scenario: format_version 演进规则

- **WHEN** 导入端遇到包内 format_version
- **THEN** 缺失（v0 旧包）按兼容模式全量回吃；等于 1 按本契约；大于 1 拒绝并提示「请先升级应用」
- **AND** 未来演进：加键=兼容不升版；删键/改布局=升版且导入端保留 N-1 读窗

### Requirement: 备份导出（目录选择+后端直写）

备份导出 SHALL 通过壳层原生目录选择框（js_api 桥）由用户指定保存目录，后端（本机进程）直接将双包写入该目录并提供进度查询；无壳环境回退 HTTP 下载。单书交付导出 SHALL 通过壳层保存框指定文件名。

#### Scenario: 选目录一键备份

- **WHEN** 用户点「选择保存位置」完成目录选择并发起备份
- **THEN** 后端将资产包与配置包写入所选目录，前端轮询获得真进度（逐书阶段）
- **AND** 磁盘满/权限错误时给出人话原因与「换个位置/重试」出口，已写文件清理语义明确

#### Scenario: 单书交付导出

- **WHEN** 用户在书卡菜单点「导出」
- **THEN** 通过保存框得到《书名》-作品包-日期.zip，不含任何配置或密钥

### Requirement: 恢复导入（双槽位+逐书原子）

恢复 SHALL 提供两个明确槽位（作品备份/账号与模型配置）分别选择文件，至少一项；parse 校验归并预览（作品块+配置块分块、冲突标记、warnings 通道），persist 按**书为原子单元**逐书落库（单书单事务全成全败，书间独立，失败可单独重试），配置包落库后执行**智能挂回**（active 配置唯一→全挂；书内模型名命中恰一个配置→挂之；否则置空待选），挂回双向幂等。同名书恢复为《书名（备份）》递增命名；同名配置跳过不覆盖。免费额度只拦新建，恢复放行。

#### Scenario: 双包一次恢复

- **WHEN** 用户选择资产包与配置包并发起恢复
- **THEN** 书与配置全部恢复，完成摘要报告恢复数、挂回结果（已接回/待选择）与 warnings
- **WHEN** 用户只选择作品包
- **THEN** 仅恢复书，配置保持现状（合法单包）

#### Scenario: 坏包不落半截

- **WHEN** 包损坏/路径穿越/format_version 过高/元数据缺失
- **THEN** 422 整包拒绝（或按容错矩阵跳过单项+warning），数据库无半截行

#### Scenario: 恢复后可再导出（幂等）

- **WHEN** 恢复完成的项目再次导出
- **THEN** 新包与原包目录布局与 yaml 键集合相等（防「导入即降级」漂移）

### Requirement: 旧库留档与升级演练

新版本启动 SHALL 对 schema 指纹不匹配的存量库执行三件套改名留档（db/-wal/-shm，零接触）并以全新空库启动；留档仅可经只读检测端点消费。**任何 schema 破坏性版本的发布验收 MUST 包含全链演练**：旧库造书→导双包→装新版（留档断言）→导入→八层 roundtrip 断言全绿。

#### Scenario: 升级后旧数据可救

- **WHEN** 用户升级后删除新库（极端救援）
- **THEN** 新版空库上导入升级前导出的资产包，八层 roundtrip 断言全绿
- **AND** 留档库文件全程原样保留
