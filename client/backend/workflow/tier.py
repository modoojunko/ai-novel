"""tier 感知门控旁路层（N9/B4/D5）

免费用户（无付费权益）门控旁路：free 下六阶段 gate 不拦截、阶段流转 force 通过、
归档免费可用。PRO 走现状 gate/transition 语义。统一收口，杜绝逐点 `if(tier)`。
"""

import asyncio

from workflow.engine import update_phase
from workflow.gates import GateResult


def tier_bypass() -> bool:
    """当前是否无付费权益 → 旁路。

    旁路条件 = tier=="none" **或** 过期付费（`check_permission().allowed == False`），
    非裸 tier 字符串判断。
    """
    from auth_local.service import check_permission

    perm = check_permission()
    if perm.get("tier") == "none":
        return True
    return not perm.get("allowed", True)


async def tier_or_gate(db, project, gate_fn, *args) -> GateResult:
    """free 恒过，返回 `GateResult(valid=True, warnings=[], hard_block=False)`；
    PRO 走现状 `gate_fn(*args)` 并原样返回其 GateResult。

    gate_fn 兼容同步（gate_chapter_ready）与异步（gate_settings_complete 等）两种签名。
    """
    if tier_bypass():
        return GateResult(valid=True, warnings=[], hard_block=False)
    result = gate_fn(*args)
    if asyncio.iscoroutine(result):
        return await result
    return result


def tier_phase_transition(project, new_phase: str, force: bool = False):
    """free 下 `update_phase` 跳过 `can_transition` 校验（force 模式），幂等推进（O3）；
    PRO 走现状 `update_phase`（非法跳转仍抛 ValueError）。

    `force=True` 时两态均直接置位（跳过 can_transition）：供归档等"以操作结果反推阶段"
    的端点使用——归档前已校验正文 ≥100 字，phase 仅记账，不构成流转约束。"""
    if force or tier_bypass():
        project.current_phase = new_phase
        return
    update_phase(project, new_phase)
