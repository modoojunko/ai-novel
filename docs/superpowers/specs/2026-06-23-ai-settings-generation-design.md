# AI 设定生成 — 设计文档

## 概述

在现有的 5 类手动设定表单（世界/风格/反AI/伏笔/角色）之上，增加两层 AI 辅助：
1. **全局一键生成** — 基于故事 premise，AI 一次性生成所有设定内容
2. **逐字段抽卡** — 每个字段旁的 ✨ 按钮，弹出式预览 + 换一个 + 接受

## 用户流程

```
创建小说（填 premise）
        ↓
进入设定面板（初始空白）
        ↓
点击顶部「✨ AI 一键生成全部设定」
        ↓
┌─────────────────────────┐
│ 生成进度条               │
│ ■■□□□□ 世界设定         │
│ ■■■■□□ 写作风格         │
│ ■■■■■■ 反AI规则         │
│ ■■■■■■ 伏笔面板         │
│ ■■■■■■ 角色管理         │
└─────────────────────────┘
        ↓
全部生成完成后，字段已填入
        ↓
用户点击单个字段旁的 ✨ 按钮
        ↓
┌─────────────────────────┐
│ ✨ AI 建议               │
│                         │
│  [AI 生成的内容预览]     │
│                         │
│  [换一个]    [接受这个]  │
└─────────────────────────┘
        ↓
「接受这个」→ 填入字段，toast 提示
「换一个」→ 重新生成
「✕ 关闭」→ 放弃
```

## 后端 API

### 全局生成

```
POST /api/settings/generate
Headers: Authorization: Bearer <token>
Body: {
  "project_id": "uuid",
  "types": ["world", "style", "anti-ai", "hooks", "characters"]
}
Response: {
  "world": { "geography": "...", "politics": "...", ... },
  "style": { "role": "...", "core_principles": [...], ... },
  "anti-ai": { "fatigue_words_zh": {...}, ... },
  "hooks": { "active": [...] },
  "characters": { ... }
}
```

后端读取 project 的 premise（创建时填写的故事描述），对每种设定类型构造 prompt 调用 AI，合并返回。

### 逐字段生成

```
POST /api/settings/ai/{type}/{field}
Headers: Authorization: Bearer <token>
Body: {
  "project_id": "uuid",
  "context": { ... }  // 当前已填的其他字段值，供 AI 参考
}
Response: {
  "value": "生成的内容"
}
```

单字段、幂等、每次调用独立。

## Prompt 策略

**全局生成 prompt：**
```
你是一位小说设定专家。基于以下故事前提，为这部小说生成设定。

故事前提：{premise}

请生成以下设定（JSON 格式）：

1. 世界设定（world-setting）：
   - geography: 地理环境描述
   - politics: 政治格局
   - rules: 世界规则
   - 等字段...

2. 写作风格（writing-style）：
   - role: 叙事角色定位
   - core_principles: 核心写作原则（数组）
   - 等字段...

请确保前后一致，风格统一。
```

**逐字段抽卡 prompt：**
```
你是一位小说设定专家。基于以下故事前提和已有设定，生成新的 {field}。

故事前提：{premise}
已有设定参考：{existing_context}

请只输出 {field} 的内容，不要其他字段。
```

## 前端组件

### ExistingField — AI 扩展

每个表单字段组件（`FormField`, `InputField`, `ListEditor`）加一个 prop：

```tsx
interface AIFieldProps {
  aiGeneratable?: boolean;        // 是否显示 ✨ 按钮
  onAIGenerate?: () => void;      // 点击 ✨ 时的回调
  aiLoading?: boolean;             // 是否正在生成
}
```

新增组件：

### AISuggestionModal

```tsx
<AISuggestionModal
  open={boolean}
  fieldLabel={string}        // "地理环境"
  content={string}           // AI 生成的内容
  loading={boolean}          // 正在生成
  onAccept={() => void}      // 接受
  onRetry={() => void}       // 换一个
  onClose={() => void}       // 关闭
/>
```

### AIGenerateProgress

```tsx
<AIGenerateProgress
  open={boolean}
  steps={[
    { type: "world", label: "世界设定", status: "pending|loading|done" },
    { type: "style", label: "写作风格", status: "pending|loading|done" },
    ...
  ]}
  onClose={() => void}
/>
```

### Toast 扩展

`lib/toast.tsx` 扩展支持 action button：

```tsx
toast.success("AI 已填充", { action: { label: "撤销", onClick: () => restore() } });
```

## 涉及文件

### 后端新建

| 文件 | 说明 |
|------|------|
| `backend/settings/ai_router.py` | `/api/settings/generate` + `/api/settings/ai/{type}/{field}` |
| `backend/settings/ai_prompts.py` | 每种设定类型的 prompt 模板 |

### 前端新建

| 文件 | 说明 |
|------|------|
| `frontend/src/lib/ai.ts` | AI 设定相关 API 封装 |
| `frontend/src/components/novel/settings/AISuggestionModal.tsx` | 抽卡弹窗 |
| `frontend/src/components/novel/settings/AIGenerateProgress.tsx` | 全局生成进度弹窗 |

### 前端修改

| 文件 | 说明 |
|------|------|
| `frontend/src/components/novel/settings/FormField.tsx` | 加 `aiGeneratable` prop + ✨ 按钮 |
| `frontend/src/components/novel/settings/WorldSettingForm.tsx` | 接入 AI 生成 |
| `frontend/src/components/novel/settings/StyleSettingForm.tsx` | 同上 |
| `frontend/src/components/novel/settings/AntiAiSettingForm.tsx` | 同上 |
| `frontend/src/components/novel/settings/HooksSettingForm.tsx` | 同上 |
| `frontend/src/components/novel/settings/CharacterManager.tsx` | 同上 |
| `frontend/src/lib/toast.tsx` | 扩展支持 action 按钮 |
| `frontend/src/pages/NovelPage.tsx` | 设定面板顶部加「一键生成」按钮 |

## 错误处理

- AI 生成失败 → 按钮恢复，toast 显示「生成失败，请重试」
- 单个字段失败不影响其他字段
- 全局生成时，失败的设定项标红，可单独重试
- 网络超时 → 5 秒后自动重试一次，仍失败则提示

## 测试策略

### 后端 API 测试（pytest）

| 测试 | 说明 |
|------|------|
| `test_generate_all_types` | 调用 `POST /api/settings/generate`，验证返回 5 种类型的完整结构 |
| `test_generate_single_field` | 调用 `POST /api/settings/ai/{type}/{field}`，验证返回 `{value}` |
| `test_generate_empty_premise` | 项目无 premise 时调用应返回 400 |
| `test_generate_invalid_type` | 非法 type 返回 400 |
| `test_generate_unauthorized` | 无 token 返回 401 |

### 前端 E2E 测试（Playwright）— `e2e/settings-ai.spec.ts`

| 测试 | 说明 |
|------|------|
| 「一键生成」按钮在设定面板可见 | 导航到项目设定页 → 验证按钮存在 |
| 点击「一键生成」显示进度弹窗 | 点击 → 验证 AIGenerateProgress 弹窗出现 |
| 逐字段 ✨ 按钮可见 | 验证每个设定 tab 下的字段有 ✨ 按钮 |
| 点击 ✨ 弹出抽卡弹窗 | 点击 ✨ → 验证 AISuggestionModal 出现 |
| 抽卡弹窗「换一个」重新生成 | 点击「换一个」→ 确认内容变化或 loading |
| 「接受」填入字段 | 点击「接受」→ 字段值更新 |
| 反 AI 规则无 ✨ 按钮 | 验证 anti-ai tab 下没有 ✨ 按钮 |
| 无 premise 时按钮置灰 | 验证空 premise 项目的一键生成按钮 disabled |

### Mock 策略

- 后端测试：mock `AIClient.chat()` 返回固定值
- 前端测试：mock API 响应（Playwright 的 `page.route()`），不依赖真实 AI 调用

## 边界情况

- 空 premise（用户手动输入书名，没填故事描述）→ 全局生成按钮置灰，提示「请先在创建小说时填写故事描述」
- 已有设定内容时点「一键生成」→ 确认弹窗「将覆盖已有设定，是否继续？」
- 多次点击 ✨ 不堆积请求 → 每次点击取消上一次 pending 请求
- 设定已确认（confirm toggle 已勾）→ 修改后自动取消确认状态
