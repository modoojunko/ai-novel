"""Prompt templates for AI-assisted settings generation."""

WORLD_SETTING_PROMPT = """你是一位小说设定专家。基于以下故事前提，为这部小说生成世界设定。

故事前提：{premise}

请生成世界设定的 JSON（只输出 JSON，不要其他文字）：
{{
  "geography": {{
    "scenes": "关键地点、空间关系、距离的描述",
    "climate": "气候特征、季节、极端天气",
    "limits": "山脉、水域、边界 — 什么分隔了区域"
  }},
  "politics": {{
    "rule": "谁统治？权力结构",
    "factions": "至少 2-3 个主要势力",
    "social": "阶级结构、社会流动性",
    "cost": "违抗的后果，谁执行惩罚"
  }},
  "rules": {{
    "world": "力量体系、物理法则、魔法来源",
    "society": "法律、门派规章、禁忌",
    "personal": "血咒、功法限制、契约"
  }}
}}
"""

STYLE_SETTING_PROMPT = """你是一位小说设定专家。基于以下故事前提，为这部小说生成写作风格设定。

故事前提：{premise}

已有设定参考：{context}

请生成写作风格设定的 JSON（只输出 JSON，不要其他文字）：
{{
  "role": "叙事角色定位（如：上帝视角的说书人）",
  "core_principles": ["原则1", "原则2", "原则3"],
  "common_mistakes": ["常见错误1"],
  "depiction_techniques": {{
    "environment": "环境描写手法",
    "action": "动作描写手法",
    "emotion": "情感描写手法"
  }}
}}
"""

HOOKS_SETTING_PROMPT = """你是一位小说设定专家。基于以下故事前提和已有设定，为这部小说生成伏笔。

故事前提：{premise}

已有设定参考：{context}

请生成伏笔的 JSON（只输出 JSON，不要其他文字）：
{{
  "active": [
    {{
      "description": "伏笔描述",
      "introduce_at": "引入章节（如：第一章）",
      "type": "plot",
      "priority": "high"
    }}
  ]
}}
至少生成 3 个伏笔，类型可以从 mystery、threat、promise、clue、relationship、power、emotion、choice 中选择。
"""

ANTI_AI_SETTING_PROMPT = """你是一位小说设定专家。基于以下故事前提，为这部小说生成反 AI 规则。

故事前提：{premise}

请生成反 AI 规则的 JSON（只输出 JSON，不要其他文字）：
{{
  "fatigue_words_zh": {{
    "副词": ["突然", "忽然", "显然"],
    "语气词": ["嗯", "啊", "哦"],
    "过渡": ["就在这时", "就在这时突然"]
  }},
  "sentence_rules": [
    {{
      "pattern": "不是.*而是.*",
      "reason": "避免对比句式",
      "threshold": 2
    }}
  ]
}}
"""

CHARACTER_SETTING_PROMPT = """你是一位小说设定专家。基于以下故事前提和已有设定，为这部小说生成角色。

故事前提：{premise}

已有设定参考：{context}

请生成 3 个主要角色的 JSON 数组（只输出 JSON，不要其他文字）：
[
  {{
    "name": "角色名",
    "appearance": "外貌描述",
    "background": "背景故事",
    "speech": "说话风格",
    "personality": "性格特征",
    "values": ["价值观1", "价值观2"],
    "skills": ["技能1", "技能2"],
    "relationships": "与其他角色的关系"
  }}
]
"""


def get_prompt(setting_type: str) -> str:
    prompts = {
        "world": WORLD_SETTING_PROMPT,
        "style": STYLE_SETTING_PROMPT,
        "hooks": HOOKS_SETTING_PROMPT,
        "anti-ai": ANTI_AI_SETTING_PROMPT,
        "characters": CHARACTER_SETTING_PROMPT,
    }
    return prompts.get(setting_type, "")
