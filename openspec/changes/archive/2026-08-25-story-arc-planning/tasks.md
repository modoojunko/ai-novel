# 任务：主线拆纲（story-arc-planning）

## 1. 后端：主线设定项

- [x] 1.1 主线数据模型与幂等 DDL：在 lifespan 幂等升级中为主线 key 落地存储（与简介/伏笔同族）；容器内 pytest 验证新库/存量库双路径均通过
- [x] 1.2 主线读写端点：`GET/PUT /api/novels/{id}/story/arc` 整存整取（一句话 + 结局三字段 + 分卷行数组，空/待定合法）；pytest 覆盖读回一致、空保存、404
- [x] 1.3 就绪项：READINESS_CHECKERS 加「主线」——有一句话或任一非待定分卷即完成，空为软提醒；pytest 验证空/非空两态

## 2. 后端：AI 四步向导端点

- [x] 2.1 四个提示词模板（condense/ending/split/audit）入库，内容对齐 awesome-novel story-arc-style 流程（浓缩三要素/结局追问与矛盾指出/分卷提案/三问自查+结构归纳）
- [x] 2.2 `POST /api/novels/{id}/story/arc/wizard/{step}` 四端点：`require_ai_access` 门控 → 读模板 → chat → 剥壳 json.loads → record_usage；每步入参=作者输入+卡片当前内容，出参结构化 JSON；pytest 覆盖免费 403、会员 200、坏 JSON 容错
- [x] 2.3 向导续步推断逻辑：按卡片已有内容返回 `next_step`（保守取第一个未完成步骤）；pytest 验证空卡从第 1 步、填过分卷的从第 4 步

## 3. 前端：主线卡

- [x] 3.1 主线卡表单组件：三块内容（一句话输入 / 结局三字段含待定 / 分卷行编辑器——行增删+一键待定），保存走新端点；vitest 组件测试覆盖保存回显与待定行
- [x] 3.2 接入设定页与设定清单：主线卡出现在设定清单（软提醒口径），空主线不拦建卷/章纲；vitest + 手动验证导航不回归

## 4. 前端：AI 向导 UI

- [x] 4.1 卡内分步面板：四步步骤条（可点跳步）、每步「输入区 + AI 产出落表单（草稿可改）+ 下一步」；免费用户点入口弹既有会员拦截；vitest 覆盖免费拦截与步骤切换
- [x] 4.2 中途退出可续：关面板重开按 `next_step` 续步，已落卡内容保留；vitest 模拟两步后重开验证续步
- [x] 4.3 端到端验证：本地 docker 栈跑 e2e——免费手填主线全流程 + 会员走完四步向导（AI 打桩或真实调用按既有 e2e 口径）

## 5. 收尾

- [x] 5.1 全量回归：容器内 pytest 361+ 新增全绿；client/frontend vitest 全绿；design-lint 通过
- [x] 5.2 `openspec validate story-arc-planning` 通过，更新此 tasks 勾选状态
