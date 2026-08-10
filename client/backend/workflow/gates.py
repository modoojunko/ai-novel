from dataclasses import dataclass, field

from filesystem.storage import get_storage

PHASE_ORDER = ["init", "settings", "outline", "prompt", "write", "archive"]


@dataclass
class GateResult:
    """Standardized gate check result.

    valid:       True when all required conditions are met.
    warnings:    Human-readable list of what is missing or suboptimal.
                 Empty when valid=True. Non-empty when valid=False
                 (soft gate) or when passed but with suggestions.
    hard_block:  When True, the transition MUST be rejected (400).
                 When False, it is a soft gate — the caller may proceed
                 but should show warnings to the user.
    """

    valid: bool = True
    warnings: list[str] = field(default_factory=list)
    hard_block: bool = False


async def gate_settings_complete(root_path: str) -> GateResult:
    """Check if settings are complete enough to start outlining.

    Product decision (2026-08-02): completion = the author clicked "完成设定"
    (ConfirmToggle) for the item AND its content passed the non-empty check
    (enforced in PUT /settings/status/{type}). This gate therefore reads the
    confirmation markers (settings-status.yaml); readiness content checks are
    used only as supplementary Chinese guidance.

    Soft gate — warns but does not block.
    """
    from workflow.readiness import READINESS_KEYS, compute_readiness

    status = await get_storage().read_yaml(root_path, "settings/settings-status.yaml") or {}
    unconfirmed = [k for k in READINESS_KEYS if not bool(status.get(k))]
    if not unconfirmed:
        return GateResult(valid=True, warnings=[])

    readiness = await compute_readiness(root_path)
    labels = {m["key"]: m["label"] for m in readiness["missing"]}
    warnings = [f"尚未完成设定: {labels.get(k, k)}" for k in unconfirmed]
    if readiness["missing"]:
        warnings.append(readiness["warning"])
    return GateResult(
        valid=True,
        warnings=warnings,
        hard_block=False,
    )


def gate_chapter_ready(chapter_data: dict) -> GateResult:
    """Check if chapter outline is ready for prompt generation.

    Hard gate — missing fields block transition to prompt.
    """
    missing = []
    memo = chapter_data.get("memo", {})

    if not memo.get("current_task"):
        missing.append("memo.current_task is empty")
    rexp = memo.get("reader_expectation", {})
    if not rexp.get("state"):
        missing.append("memo.reader_expectation.state is empty")
    if not rexp.get("strategy"):
        missing.append("memo.reader_expectation.strategy is empty")
    changes = memo.get("required_changes", [])
    if not changes:
        missing.append("memo.required_changes is empty")
    ed = chapter_data.get("emotional_design", {})
    if not ed.get("primary_mood"):
        missing.append("emotional_design.primary_mood is empty")
    segments = chapter_data.get("segments", [])
    if not segments:
        missing.append("segments is empty")

    return GateResult(
        valid=len(missing) == 0,
        warnings=missing,
        hard_block=True,
    )


async def gate_prompts_exist(root_path: str, chapter_ref: str) -> GateResult:
    """Check if prompt file exists for given chapter.

    Hard gate — no prompt means cannot write.
    """
    files = await get_storage().list_dir(root_path, "prompts")
    exists = any(f.startswith(chapter_ref) for f in files)
    return GateResult(
        valid=exists,
        warnings=[] if exists else [f"prompt for {chapter_ref} not generated yet"],
        hard_block=True,
    )


def gate_quality_passed(chapter_data: dict) -> GateResult:
    """Check if quality check has passed."""
    passed = chapter_data.get("quality_check", {}).get("passed", False)
    return GateResult(
        valid=passed,
        warnings=[] if passed else ["quality check not passed"],
        hard_block=True,
    )


async def gate_outline_exists(root_path: str) -> GateResult:
    """Check if at least one volume with chapters exists.

    Soft gate — reminds but allows proceeding.
    """
    files = await get_storage().list_dir(root_path, "volumes")
    vol_files = [f for f in files if f.endswith(".yaml")]
    if not vol_files:
        return GateResult(
            valid=True,
            warnings=["no volumes created yet"],
            hard_block=False,
        )
    return GateResult(valid=True, warnings=[])


async def gate_prose_written(root_path: str) -> GateResult:
    """Check if at least one chapter has prose content written.

    Soft gate — reminds progress.
    """
    files = await get_storage().list_dir(root_path, "chapters")
    written = 0
    total = 0
    for f in sorted(files):
        if not f.endswith(".yaml"):
            continue
        ch = await get_storage().read_yaml(root_path, f"chapters/{f}")
        if not ch:
            continue
        total += 1
        if ch.get("prose", "").strip():
            written += 1

    if total == 0:
        return GateResult(
            valid=True,
            warnings=["no chapters created yet"],
            hard_block=False,
        )
    if written < total:
        return GateResult(
            valid=True,
            warnings=[f"prose written for {written}/{total} chapters"],
            hard_block=False,
        )
    return GateResult(valid=True, warnings=[])


async def gate_archived(root_path: str) -> GateResult:
    """Check if any chapters have been archived.

    Soft gate — reminds progress.
    """
    files = await get_storage().list_dir(root_path, "archives")
    archive_files = [f for f in files if f.endswith(".md")]
    if not archive_files:
        return GateResult(
            valid=True,
            warnings=["no chapters archived yet"],
            hard_block=False,
        )
    return GateResult(valid=True, warnings=[])


async def get_phase_status(
    root_path: str, current_phase: str, db_project=None
) -> dict:
    """Aggregate six phase completion statuses.

    Returns a dict with:
      - phases: {phase_name: "complete"|"in_progress"|"skipped"|"pending"}
      - warnings: [{"phase": str, "message": str}]

    "skipped" meaning: current_phase > phase and its gate_valid=false.
    File I/O is capped at roughly 8 reads
    (world-setting, writing-style, hooks, volumes, chapters, prompts, prose, archives).
    """
    if current_phase not in PHASE_ORDER:
        current_phase = "init"

    phase_idx = PHASE_ORDER.index(current_phase)

    # --- Run all gates ---

    settings_result = await gate_settings_complete(root_path)
    outline_result = await gate_outline_exists(root_path)

    # All chapters check
    chapter_files = await get_storage().list_dir(root_path, "chapters")
    chapter_yamls = [f for f in chapter_files if f.endswith(".yaml")]

    all_chapters_ready = True
    chapter_warnings: list[str] = []
    for f in sorted(chapter_yamls):
        ch = await get_storage().read_yaml(root_path, f"chapters/{f}")
        if not ch:
            continue
        r = gate_chapter_ready(ch)
        if not r.valid:
            all_chapters_ready = False
            chapter_warnings.extend(r.warnings)

    # Prompt check: only if there are chapters
    prompt_result = GateResult(valid=True, warnings=[])
    if chapter_yamls:
        for f in sorted(chapter_yamls):
            ref = f.replace(".yaml", "")
            r = await gate_prompts_exist(root_path, ref)
            if not r.valid:
                prompt_result = r
                break

    prose_result = await gate_prose_written(root_path)
    archive_result = await gate_archived(root_path)

    # --- Phase-gate mapping ---
    phase_gates = {
        "settings": settings_result,
        "outline": outline_result,
        "prompt": prompt_result,
        "write": prose_result,
        "archive": archive_result,
    }

    phases: dict[str, str] = {}
    warnings_output: list[dict[str, str]] = []

    for i, phase in enumerate(PHASE_ORDER):
        if phase == "init":
            if phase_idx > i:
                phases[phase] = "complete"
            elif phase_idx == i:
                phases[phase] = "in_progress"
            else:
                phases[phase] = "pending"
            continue

        gate_result = phase_gates.get(phase)
        if gate_result is None:
            phases[phase] = "pending"
            continue

        # For "outline" phase, also check all_chapters_ready for completeness
        if phase == "outline":
            combined_valid = gate_result.valid and all_chapters_ready
        else:
            combined_valid = gate_result.valid

        if phase_idx > i:
            # Past this phase — was it completed or skipped?
            phases[phase] = "complete" if combined_valid else "skipped"
        elif phase_idx == i:
            phases[phase] = "in_progress"
        else:
            phases[phase] = "pending"

        # Collect warnings for the current and past phases
        if phase_idx >= i:
            for w in gate_result.warnings:
                warnings_output.append({"phase": phase, "message": w})

        # Chapter outline warnings for outline phase
        if phase == "outline" and phase_idx >= i and not all_chapters_ready:
            for w in chapter_warnings[:3]:  # limit to top 3
                warnings_output.append({"phase": phase, "message": w})

    return {
        "phases": phases,
        "warnings": warnings_output,
    }
