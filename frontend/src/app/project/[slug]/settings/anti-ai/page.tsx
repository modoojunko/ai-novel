"use client";

import { SettingsForm } from "@/components/settings/SettingsForm";

const FIELDS = [
  { key: "note", label: "说明（可留空）", type: "textarea" as const, placeholder: "Anti-AI rules detect mechanical writing patterns..." },
];

const LIST_FIELDS = [
  { key: "fatigue_words", label: "AI 疲劳词（blocklist）", itemLabel: "Word" },
  { key: "forbidden_patterns", label: "禁止句式（正则）", itemLabel: "Pattern" },
];

export default function AntiAIPage() {
  return <SettingsForm settingsType="anti-ai" title="Anti-AI Rules" fields={FIELDS} listFields={LIST_FIELDS} />;
}
