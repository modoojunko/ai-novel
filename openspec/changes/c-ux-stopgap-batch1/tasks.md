# Tasks · c-ux-stopgap-batch1

## 1. 实施

- [x] 1.1 原型先行核对：本批预期零像素漂移（骨架无 parity 态、弹窗/路由不入基线）；以 `design:check` 全绿为核对通过，若书工作台基线漂移则先改 `book.html` 并登记 `ADJUSTMENTS.md`（验证：design:check 输出 <0.2%）——✅ books/empty 两场景全过，零漂移，无需动原型
- [x] 1.2 `ContrastPreviewModal.tsx` 内联字体令牌 `var(--font-serif)` → `var(--font-display)`（验证：`grep -r font-serif src` 零命中 + `npx tsc --noEmit` 绿）——✅ 顺带摘除 `ImportUploadZone.tsx:103` 同族死类 `font-serif`（Tailwind 退役后无 `.font-serif` 定义，零视觉影响）
- [x] 1.3 `ModelSettingForm.tsx` no_key 链接 `href="/config"` → `href="#/config"`（验证：tsc 绿；`grep -rn 'href="/config"' src` 零命中）——✅（grep 余量全在 `src/.mimosa/` 插件缓存，非源码）
- [x] 1.4 目标字数统一 2500：`useChapterData.ts` `DEFAULT_TARGET` 2000→2500、`Rail.tsx` 回退 `?? 2000` → `?? 2500`、`useChapterData.test.tsx:288` 断言改 2500（验证：`vitest` 该文件绿）——✅
- [x] 1.5 `App.tsx` 增加兜底路由 `path="*"` → `<Navigate to="/novels" replace />`（验证：tsc 绿；dev 下打开 `#/unknown` 落书架不白屏）——✅
- [x] 1.6 骨架收编 `.sk`：`list.css` 删 `@keyframes skeleton-pulse` 与 `.bar` 的 bg/animation 声明；`NovelListPage.tsx`、`ApiKeyConfigPage.tsx` 骨架 markup `bar` → `sk bar`（验证：`grep -rn skeleton-pulse src` 零命中）——✅
- [x] 1.7 计划外小项：`PromptManagementPage.singleCard.test.tsx` 「已保存」徽标断言改 `waitFor`——门禁期间实测存量 flake（交叉实验：干净树 1/5 挂、分支 2/4 挂，与 #224 时代记录一致），加固后 3 连全量绿；非本批功能改动，仅测试加固
- [x] 1.8 review 跟进（P3）：`DEFAULT_TARGET` 从 `useChapterData` 导出，`Rail.tsx` 兜底改导入复用，消灭 2500 双份字面量（验证：tsc 绿 + vitest 110/110）

## 2. 门禁回归

- [x] 2.1 静态门禁三连：`npm run design:lint` + `node scripts/design-cross.mjs` 零差异 + `npx tsc --noEmit`（验证：三命令全绿）——✅ lint exit 0 / cross 共享段零差异 / tsc 绿
- [x] 2.2 像素门禁：`npm run design:check` 全场景 <0.2%；若书工作台漂移回到 1.1 走原型先行（验证：design:check 输出）——✅ books + empty 2 passed
- [x] 2.3 单测回归：`npx vitest run` 全量绿（验证：退出码 0）——✅ 加固后 3 连 110/110
