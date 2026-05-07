import SettingsForm from "@/components/settings/SettingsForm";

const FIELDS = [
  { key: "role", label: "AI 角色定位", placeholder: "e.g. 你是当代都市悬疑小说家，擅长冷峻写实的笔调" },
  { key: "core_principles", label: "核心写作原则", type: "textarea" as const, placeholder: "e.g. 多写动作少写心理；对话占比不低于30%；每段至少一处感官细节" },
  { key: "possible_mistakes", label: "常见错误/禁忌", type: "textarea" as const, placeholder: "e.g. 不要解释人物动机——让读者自己判断；禁止以'他心想''他感到'开头" },
  { key: "depiction_techniques", label: "描写技法", type: "textarea" as const, placeholder: "e.g. 用环境映射情绪；对话用动作标签而非副词；描写顺序：空间→光线→声音→气味" },
  { key: "genre", label: "题材类型", placeholder: "e.g. suspense-crime, urban-romance" },
];

const LIST_FIELDS = [
  { key: "skill_layers_L1_narrative", label: "L1 结构层——叙事约束", itemLabel: "Rule" },
  { key: "skill_layers_L2_content", label: "L2 内容层——写作原则", itemLabel: "Principle" },
];

export default function StyleSettingsPage() {
  return <SettingsForm settingsType="style" title="写作风格" fields={FIELDS} listFields={LIST_FIELDS} />;
}
