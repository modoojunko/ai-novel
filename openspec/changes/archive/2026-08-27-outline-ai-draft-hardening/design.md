# Design: outline-ai-draft-hardening

## Context

PR #200 review 的 3 个 P2/P3 收口。均为小改动，无架构决策；设计只记录口径。

## Decisions

- **D1 覆盖判定**：`hasContent` 追加 `ogForm.scenes.some(sc => [sc.n, sc.g, sc.o, sc.h].some(v => v.trim()) || sc.w || sc.f)`、`ogForm.payoffs.some(p => p.d.trim())`、`ogForm.ladder.trim()`、`ogForm.wt.trim()`。不做「未保存修改」双条件（ogSnapRef 口径），保持简单：格子非空即确认。
- **D2 哨兵去重**：`from write.chapter_writer import _CH1_PREVIOUS`（该文件已 import build_chapter_context/strip_code_fences，同源），比较 `prev != _CH1_PREVIOUS`。
- **D3 段落字数**：sanitize 内 `int()` 转换 try/except 回落 800；与 word_target 的 clamp 风格一致（转换失败给默认而非 502）。

## Risks / Trade-offs

无：均为收窄边界，不改变既有成功路径行为。

## Migration Plan

无迁移。回滚 = revert 单 commit。

## Open Questions

无。
