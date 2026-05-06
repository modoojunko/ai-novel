"use client";

import { SettingsForm } from "@/components/settings/SettingsForm";

const FIELDS = [
  { key: "era", label: "时代背景", placeholder: "e.g. 2020年代、清末民初、架空王朝" },
  { key: "location", label: "主要地点", placeholder: "e.g. 上海、虚构大陆艾泽拉" },
  { key: "geography", label: "地理环境", type: "textarea" as const, placeholder: "气候、地形、标志性地点" },
  { key: "politics", label: "政治/权力结构", type: "textarea" as const, placeholder: "政府、组织、权力关系" },
  { key: "culture", label: "文化/社会风貌", type: "textarea" as const, placeholder: "习俗、价值观、社会阶层" },
  { key: "technology", label: "技术水平", type: "textarea" as const, placeholder: "科技发展阶段、特殊技术" },
  { key: "rules", label: "世界观特殊规则", type: "textarea" as const, placeholder: "魔法系统、超自然规则等" },
  { key: "history", label: "关键历史事件", type: "textarea" as const, placeholder: "影响当前局势的过去事件" },
];

export default function WorldSettingsPage() {
  return <SettingsForm settingsType="world" title="世界设定" fields={FIELDS} />;
}
