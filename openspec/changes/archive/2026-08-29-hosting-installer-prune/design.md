# hosting-installer-prune 设计

## Context

发版流水线（`client-package.yml`）release job 的既有链路：download-artifact → GitHub Release → 转存静态托管（`tcb hosting deploy` × 3 + `latest.json`）→ www 直链与 latest.json 内容校验。job 内已 `npm install -g @cloudbase/cli`、已用 `secrets.TCB_API_KEY` 登录，`fetch-depth: 0` 拉全史。托管上当前堆 3 个真实版本（v0.11–v0.13，约 207MB），旧版无任何引用入口（见 proposal Why）。本地另存有从未发版的 v0.1、v0.4 标签。

## Goals / Non-Goals

**Goals:**
- 发版即自清：无需任何人工或第二套定时基建，托管占用收敛为「最近 2 版 + latest.json」。
- 删除动作可预览、可容错，绝不误删 latest.json 与保留集。

**Non-Goals:**
- 不清理 GitHub Release 资产（官方免费不限量，且是「查看其他版本」的兜底来源）。
- 不做 CDN 缓存主动刷新（删除的路径无人引用，边缘缓存自然过期）。
- 不引入托管体积报表/监控（控制台可见，收益不抵基建）。
- 不动保留数以外的策略参数（2 为用户拍板，写成步骤内常量）。

## Decisions

1. **挂载点：release job 发布校验之后，不设 `if: always()`。**
   备选：独立每周 cron workflow、CloudBase 云函数定时器。否决理由：清理时机本就跟随发版（没发版就没新增），单独养一套定时基建是负资产；且独立跑批还要自己解决「哪个是最新版本」的事实源问题。挂在发布校验后天然保证「发布成功才清理」，spec 里的「发布失败不执行清理」由步骤顺序免费获得。
2. **版本清单来源：git 标签，不列托管文件。**
   `git tag -l 'v*' --sort=-v:refname` 即完整发版史，确定性强；`tcb hosting list` 输出要自行分组解析且 CLI 行为不稳（历史踩坑）。步骤开头显式 `git fetch origin 'refs/tags/v*:refs/tags/v*' --force` 兜底，不依赖 checkout 的隐式行为。
3. **排序：`--sort=-v:refname`（版本语义序）。**
   时间序在 v0.9 / v0.11 这类版本上会错排；语义序才与「最近 2 个版本」的用户意图一致。
4. **删除粒度：`tcb hosting delete "download/v<VER>" --dir` 整目录。**
   一个版本 3 个文件，逐文件删除是三倍的失败面；整删一步原子。从未上托管的标签（v0.1/v0.4）删除会报错，单版本 `|| 记录 ::warning` 吞掉，不中断循环。
5. **失败语义：warning 不标红。**
   与既有「转存/校验失败 MUST 失败」刻意区分：那是用户下不到包的硬故障；清理晚点成功只是多占 70MB，且下版自动重试。标红反而会误导「发版失败」。
6. **dry-run 预览先行。**
   `tcb hosting delete --dry-run` 输出待删清单后再真删：防排序或集合计算出岔子时删错，同时在日志留审计痕迹（spec「真删前有预览」）。

## Risks / Trade-offs

- [标签命名偏离 `v<semver>`] → 现存标签全部合规；`--sort=-v:refname` 对非严格 semver 退化为合理字典序，最坏是保留集偏差一个旧版，自愈于下版。
- [两个 tag 极近并发发版] → workflow concurrency 已按 ref 隔离；极端并发下各按自己的标签视角算保留集，最坏多留一版，下版自愈。风险可接受，不做分布式锁。
- [落地页 bump PR 忘合窗口] → 落地页可能落后一版，但 latest.json 与落地页两个事实源都落在保留 2 版集合内，直链不断。
- [CDN 边缘仍在短时服务已删路径] → 该路径无引用入口，命中也是无人请求；自然过期即可。

## Migration Plan

1. workflow 改动随普通 PR 合入 main（改 `.github/workflows/client-package.yml` 触发路径过滤，PR 会跑一次打包验证，发版 job 不触发）。
2. 下一个 `v*` tag 推送时清理逻辑首次自动执行。
3. 存量清理一次性手动执行：dry-run 确认清单 → `tcb hosting delete "download/v0.11" --dir`（v0.1/v0.4 托管上不存在，无需处理），使现状立即符合保留策略。
4. 回滚：revert workflow PR 即停用清理；已删目录如需恢复，从 GitHub Release 资产重新 `tcb hosting deploy` 即可（文件名 1:1）。

## Open Questions

无。保留数已拍板为 2。
