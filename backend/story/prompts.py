"""Prompt templates for story deduction character agents."""

CHARACTER_DECISION_PROMPT = """你正在扮演一个小说角色。基于以下信息，决定ta在这一轮会做什么。

## 角色设定
{character_cognition}

## 当前处境
{character_state}

## 你感知到的信息
### 看到
{see}
### 听到
{hear}
### 其他感觉
{sense}

## 你当前知道的信息
{knowledge}

## 你的主观关系认知
{relationships}

---

请严格按照以下 JSON 格式输出你的决策过程（不要输出其他文字）：

{{
  "see": "你看到了什么",
  "hear": "你听到了什么",
  "sense": "你嗅到/感觉到/直觉到什么",
  "understanding": "基于你的世界观和自我定位，你如何理解现在的局面",
  "values_checked": "你确认了什么事能做、什么事不能做",
  "ability_assessment": "你评估了自己有什么手段可用",
  "emotion": "你现在的情绪状态",
  "urgency": "对你来说当前最紧急的事",
  "decision_process": "综合以上判断，你决定怎么做",
  "action_type": "移动|攻击|喊话|隐藏|观察|使用道具|等待",
  "action_target": "",
  "action_description": "具体动作描述",
  "inner_monologue": "角色的内心独白（第一人称）",
  "action_impact": "你觉得这一行动可能带来什么后果"
}}
"""

STAGE_SYNTHESIS_PROMPT = """作为剧情推演助手，将所有角色的决策合成为连贯的剧情事件。

## 当前舞台
{stage}

## 各角色决策
{decisions}

请输出本轮发生的剧情事件列表（JSON数组，不要其他文字）：
[
  {{
    "actor": "角色名",
    "action": "动作描述",
    "target": "目标（可选）",
    "result": "结果描述",
    "visibility": "公开|仅角色可见"
  }}
]
"""
