# hosting-installer-prune 任务清单

## 1. Workflow 清理步骤

- [x] 1.1 在 `client-package.yml` release job 末尾（发布校验全绿之后）新增「Prune old hosting versions」步骤：显式 `git fetch origin 'refs/tags/v*:refs/tags/v*' --force` → `git tag -l 'v*' --sort=-v:refname` 取排序清单 → 保留前 2、其余进待删集合 → 逐个 `tcb hosting delete --dry-run` 输出预览 → 真删 `download/v<VER> --dir`；`latest.json` 不进任何删除路径。验证：`python3 -c "import yaml;yaml.safe_load(open('.github/workflows/client-package.yml'))"` 解析通过，且步骤位置在发布校验之后、无 `if: always()`。
- [x] 1.2 容错与失败语义落地：单版本删除失败或目录不存在时记 `::warning` 继续下一版本，清理环节任何失败不 `exit 1`。验证：本地 shell 用假 env/假 tcb 路径跑同构脚本片段，确认循环不中断、退出码 0。

## 2. 逻辑本地验证

- [x] 2.1 排序与保留集逻辑实测：本地仓库跑 `git tag -l 'v*' --sort=-v:refname`，断言输出 `v0.13 v0.12 v0.11 v0.4 v0.1`、保留集为 `{v0.13, v0.12}`、待删集合为 `{v0.11, v0.4, v0.1}`（版本语义序验证 v0.13 > v0.4）。验证：命令输出与断言一致。
- [x] 2.2 待删集合预演：对 v0.11 跑 `tcb hosting delete "download/v0.11" --dir --dry-run`（本地 CLI，无副作用），确认预览清单只含该版本目录下文件，不含 v0.12/v0.13 与 latest.json。验证：dry-run 输出清单正确。（实际以 MCP `queryHosting findFiles prefix=download/v0.11/` 列清单替代——本地 tcb CLI 未登录且 API Key 是 Secret 不可取，MCP 设备码授权后列得同等信息：仅 exe+dmg 两文件）

## 3. 存量一次性落地

- [x] 3.1 确认兜底与执行真删：`gh release view v0.11` 确认 GitHub 资产在（exe+dmg）→ `tcb hosting delete "download/v0.11" --dir` → 复探 `https://www.awesomenovel.com/download/v0.11/AI_Novel_Setup_v0.11.exe` 不再返回安装包字节、v0.13/v0.12 直链与 latest.json 均正常。验证：v0.11 探测不再出现 29,671,299 字节；v0.13 content-length 仍为 29,723,029。（实际删除用 MCP `manageHosting delete isDir=true confirm=true`：Deleted 含两文件、Error 空；复探 v0.11=561 SPA fallback、v0.12=29,708,410、v0.13=29,723,029、latest.json 指向 0.13 均正常）
- [x] 3.2 更新记忆：把保留策略与清理机制写入项目记忆（发版 SOP 条目追加），防后续会话误判旧目录为异常。验证：记忆文件已更新。

## 4. 收尾

- [ ] 4.1 PR 描述附「下次发版自动生效」说明与回滚方式（revert PR / Release 资产重传），合入 main。验证：PR 创建且 CI 打包验证通过。
