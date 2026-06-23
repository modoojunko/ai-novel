# Quality Check + Archive — Implementation Plan

**Goal:** Add quality check results display and archive button to ChapterEditor.

**Files to modify:**
- `frontend/src/components/novel/ChapterEditor.tsx` — Add buttons + results display
- `frontend/src/components/novel/VersionHistory.tsx` — Wire to real API (if applicable)

## Tasks

### Task 1: Add quality check + archive to ChapterEditor

Add after the save button toolbar:

```tsx
{/* ── Quality Check + Archive ──────────────────────── */}
<div className="flex items-center gap-3 pt-4 border-t border-base-300">
  <button onClick={handleQualityCheck} disabled={qcLoading || !prose.trim()}
    className="btn btn-ghost btn-sm gap-1.5 text-base-content/50 hover:text-base-content">
    {qcLoading ? <span className="loading loading-spinner loading-xs" /> : <Search className="w-3.5 h-3.5" />}
    质量检查
  </button>
  <button onClick={handleArchive} disabled={archiving || !prose.trim()}
    className="btn btn-ghost btn-sm gap-1.5 text-base-content/50 hover:text-base-content">
    {archiving ? <span className="loading loading-spinner loading-xs" /> : <Archive className="w-3.5 h-3.5" />}
    归档
  </button>
</div>

{/* ── Quality Check Results ────────────────────────── */}
{qcResults && (
  <div className="mt-4 p-4 rounded-lg border border-base-300 bg-base-200/30 space-y-2">
    <div className="flex items-center justify-between mb-2">
      <span className="text-xs font-medium text-base-content/60">质量检查结果</span>
      <span className={`text-xs font-medium ${qcResults.passed ? "text-success" : "text-warning"}`}>
        {qcResults.passed ? "✅ 通过" : "⚠️ 需修改"}
      </span>
    </div>
    {Object.entries(qcResults.checks || {}).map(([key, check]: [string, any]) => (
      <div key={key} className="flex items-center gap-2 text-xs text-base-content/60">
        <span>{check.passed ? "✅" : "❌"}</span>
        <span className="flex-1">{key}</span>
        {check.detail && <span className="text-base-content/40">{check.detail}</span>}
      </div>
    ))}
  </div>
)}
```

State to add: `qcLoading`, `qcResults`, `archiving`
Imports to add: `Search`, `Archive` from lucide-react
Handlers: `handleQualityCheck`, `handleArchive`

### Task 2: Run tests
```bash
cd frontend && npx playwright test
cd backend && python -m pytest tests/ -v
```
