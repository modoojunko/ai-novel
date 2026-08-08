"""settings/render.py — writing-style / anti-ai → prompt 字符串渲染（ADR-006）。

设定数据存在 dict/list 双态：模板盘文件 core_principles 为按类别分组的 dict、
前端/AI 保存为 list；depiction_techniques 模板为 {name/description/example}
列表、旧数据/AI 生成为 {category: desc} dict。所有提示词组装统一经此模块
收敛，容忍双态、缺省安全（不抛错、返回空串）。
"""


def flatten_principles(core_principles) -> list[str]:
    """core_principles → 扁平字符串列表。

    dict（模板：global_rules/natural_expression/... 分类）→ 合并全部列表值；
    list（前端/AI 保存）→ 原样返回；缺失/其他类型 → []。
    """
    if isinstance(core_principles, dict):
        out: list[str] = []
        for values in core_principles.values():
            if isinstance(values, list):
                out.extend(str(v) for v in values)
        return out
    if isinstance(core_principles, list):
        return [str(v) for v in core_principles]
    return []


def fmt_mistakes(mistakes) -> str:
    """possible_mistakes → 单行字符串（分号连接）。

    list（模板/前端保存）→ "；".join；str → 原样；缺失 → ""。
    """
    if isinstance(mistakes, list):
        return "；".join(str(m) for m in mistakes)
    if isinstance(mistakes, str):
        return mistakes
    return ""


def depiction_techniques_str(style) -> str:
    """depiction_techniques → 逐行 "- ..." 字符串。

    list[{name/description/example}]（模板）→ 逐条 "- name：description"；
    list[str]（前端表单归一保存）→ 逐行 "- item"；
    dict（旧数据/AI 生成：{category: desc}）→ 逐行 "- category：desc"；
    缺失/空 → ""。
    """
    if not isinstance(style, dict):
        return ""
    techniques = style.get("depiction_techniques")
    if isinstance(techniques, list):
        lines = []
        for t in techniques:
            if isinstance(t, dict):
                name = t.get("name", "")
                description = t.get("description", "")
                if name and description:
                    lines.append(f"- {name}：{description}")
                elif description:
                    lines.append(description)
            elif isinstance(t, str) and t.strip():
                lines.append(f"- {t.strip()}")
        return "\n".join(lines)
    if isinstance(techniques, dict):
        return "\n".join(f"- {k}：{v}" for k, v in techniques.items() if v)
    return ""
