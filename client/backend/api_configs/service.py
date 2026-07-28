"""CRUD service layer for ApiConfig management."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.api_config import ApiConfig
from models.audit_log import ProjectModelAuditLog
from models.project import Project
from models.token_log import TokenLog
from models.user import User

from .connection import test_connection as _test_connection
from .crypto import decrypt_api_key, encrypt_api_key
from .schemas import mask_api_key
from .vendor import detect_vendor, resolve_vendor

# ── ApiConfig CRUD ─────────────────────────────────────────────────────────


async def create_api_config(
    db: AsyncSession,
    user_id: str,
    name: str,
    vendor_id: str,
    base_url: str,
    api_key: str = "",
    vendor_override: str | None = None,
) -> dict[str, Any]:
    """Create a new ApiConfig. Returns the created config as a dict."""
    # Check name uniqueness
    existing = await db.execute(
        select(ApiConfig).where(ApiConfig.user_id == user_id, ApiConfig.name == name)
    )
    if existing.scalar_one_or_none():
        raise ValueError("名称已被使用")

    # Resolve vendor
    resolved_vendor_id, resolved_display_name, _ = resolve_vendor(
        base_url, vendor_override
    )

    config = ApiConfig(
        user_id=user_id,
        name=name,
        vendor=resolved_vendor_id,
        vendor_display_name=resolved_display_name,
        vendor_override=vendor_override,
        api_key=encrypt_api_key(api_key),
        base_url=base_url,
        status="active",
    )
    db.add(config)
    await db.commit()
    await db.refresh(config)
    return _config_to_dict(config)


async def get_user_api_configs(db: AsyncSession, user_id: str) -> list[dict[str, Any]]:
    """List all configs for a user."""
    result = await db.execute(
        select(ApiConfig)
        .where(ApiConfig.user_id == user_id)
        .order_by(ApiConfig.created_at.desc())
    )
    return [_config_to_dict(c) for c in result.scalars().all()]


async def get_api_config(
    db: AsyncSession, user_id: str, config_id: str
) -> dict[str, Any] | None:
    """Get a single config by ID. Returns None if not found or not owned by user."""
    result = await db.execute(
        select(ApiConfig).where(ApiConfig.id == config_id, ApiConfig.user_id == user_id)
    )
    config = result.scalar_one_or_none()
    return _config_to_dict(config) if config else None


async def test_api_config(
    db: AsyncSession, user_id: str, config_id: str
) -> dict[str, Any]:
    """Test a config's connection, save results to DB, and return outcome."""
    result = await db.execute(
        select(ApiConfig).where(ApiConfig.id == config_id, ApiConfig.user_id == user_id)
    )
    config = result.scalar_one_or_none()
    if not config:
        return {"ok": False, "status": "not_found", "models": None, "error": "配置不存在"}

    plain_key = decrypt_api_key(config.api_key)
    outcome = await _test_connection(
        vendor_id=config.vendor,
        api_key=plain_key,
        base_url=config.base_url,
    )

    # Persist results
    config.last_test_status = outcome["status"]
    config.last_test_error = outcome.get("error")
    config.last_tested_at = datetime.now(UTC)
    if outcome.get("models"):
        config.models = json.dumps(outcome["models"], ensure_ascii=False)
        config.models_updated_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(config)

    return outcome


async def update_api_config(
    db: AsyncSession,
    user_id: str,
    config_id: str,
    updates: dict[str, Any],
) -> dict[str, Any] | None:
    """Update a config. Returns None if not found."""
    result = await db.execute(
        select(ApiConfig).where(ApiConfig.id == config_id, ApiConfig.user_id == user_id)
    )
    config = result.scalar_one_or_none()
    if not config:
        return None

    # Check name uniqueness if changing name
    if "name" in updates and updates["name"] != config.name:
        existing = await db.execute(
            select(ApiConfig).where(
                ApiConfig.user_id == user_id,
                ApiConfig.name == updates["name"],
                ApiConfig.id != config_id,
            )
        )
        if existing.scalar_one_or_none():
            raise ValueError("名称已被使用")

    # Apply updates
    if "api_key" in updates:
        updates["api_key"] = encrypt_api_key(updates["api_key"])
    for field in ("name", "api_key", "vendor_override", "models"):
        if field in updates:
            setattr(config, field, updates[field])

    if "base_url" in updates:
        config.base_url = updates["base_url"]
        # Re-detect vendor if base_url changed
        resolved_vendor_id, resolved_display_name, _ = resolve_vendor(
            updates["base_url"], updates.get("vendor_override", config.vendor_override)
        )
        config.vendor = resolved_vendor_id
        config.vendor_display_name = resolved_display_name

    await db.commit()
    await db.refresh(config)
    return _config_to_dict(config)


async def delete_api_config(
    db: AsyncSession, user_id: str, config_id: str
) -> dict[str, Any] | None:
    """Delete a config. Returns None if not found.

    Returns dict with affected_projects count and affected_names list.
    """
    result = await db.execute(
        select(ApiConfig).where(ApiConfig.id == config_id, ApiConfig.user_id == user_id)
    )
    config = result.scalar_one_or_none()
    if not config:
        return None

    # Find affected projects
    proj_result = await db.execute(
        select(Project).where(
            Project.ai_config_id == config_id, Project.status != "deleted"
        )
    )
    affected = list(proj_result.scalars().all())
    affected_names = [p.name for p in affected]

    # Nullify project references
    for p in affected:
        p.ai_config_id = None
        # ai_model is intentionally retained for history display

    await db.delete(config)
    await db.commit()

    return {
        "ok": True,
        "affected_projects": len(affected),
        "affected_names": affected_names,
    }


# ── Status / Batch ─────────────────────────────────────────────────────────


async def get_batch_status(db: AsyncSession, user_id: str) -> list[dict[str, Any]]:
    """Return current status for all user's configs."""
    result = await db.execute(select(ApiConfig).where(ApiConfig.user_id == user_id))
    statuses = []
    for c in result.scalars().all():
        models_list: list[str] = []
        if c.models:
            try:
                parsed = json.loads(c.models)
                if isinstance(parsed, list):
                    models_list = parsed
            except (json.JSONDecodeError, TypeError):
                pass
        plain_key = decrypt_api_key(c.api_key)
        statuses.append(
            {
                "id": c.id,
                "status": c.status,
                "last_test_status": c.last_test_status,
                "last_test_error": c.last_test_error,
                "last_tested_at": c.last_tested_at.isoformat()
                if c.last_tested_at
                else None,
                "models": models_list,
                "models_updated_at": c.models_updated_at.isoformat()
                if c.models_updated_at
                else None,
                "api_key_masked": mask_api_key(plain_key),
                "vendor": c.vendor,
            }
        )
    return statuses


# ── Project AI Model ───────────────────────────────────────────────────────


async def set_project_model(
    db: AsyncSession,
    user_id: str,
    project_id: str,
    api_config_id: str | None,
    model: str | None,
) -> dict[str, Any] | None:
    """Set a project's AI model. Returns updated project or None if not found."""
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == user_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        return None

    if api_config_id:
        # Verify config exists and belongs to user
        config_result = await db.execute(
            select(ApiConfig).where(
                ApiConfig.id == api_config_id, ApiConfig.user_id == user_id
            )
        )
        if not config_result.scalar_one_or_none():
            return None  # Will be interpreted as 404 by caller

    # Record audit log before changing
    old_config_id = project.ai_config_id
    old_model = project.ai_model

    # Determine change_type
    if old_config_id is None and old_model is None:
        change_type = "initial"
    elif api_config_id is None and model is None:
        change_type = "clear"
    else:
        change_type = "switch"

    # Create audit log entry
    log_entry = ProjectModelAuditLog(
        project_id=project_id,
        user_id=user_id,
        field="ai_model",
        old_api_config_id=old_config_id,
        new_api_config_id=api_config_id,
        old_model=old_model,
        new_model=model,
        change_type=change_type,
    )
    db.add(log_entry)

    # Update project
    project.ai_config_id = api_config_id
    project.ai_model = model
    await db.commit()
    await db.refresh(project)

    return {
        "id": project.id,
        "ai_config_id": project.ai_config_id,
        "ai_model": project.ai_model,
    }


async def get_project_ai_model(
    db: AsyncSession, user_id: str, project_id: str
) -> dict[str, Any] | None:
    """Get project's current AI model config."""
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == user_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        return None

    config_name = None
    if project.ai_config_id:
        cfg_result = await db.execute(
            select(ApiConfig).where(ApiConfig.id == project.ai_config_id)
        )
        cfg = cfg_result.scalar_one_or_none()
        if cfg:
            config_name = cfg.name

    return {
        "api_config_id": project.ai_config_id,
        "model": project.ai_model,
        "config_name": config_name,
    }


async def apply_model_to_all_projects(
    db: AsyncSession, user_id: str, api_config_id: str, model: str
) -> dict[str, Any]:
    """Apply a model to all non-deleted projects for a user."""
    # Verify config exists
    cfg_result = await db.execute(
        select(ApiConfig).where(
            ApiConfig.id == api_config_id, ApiConfig.user_id == user_id
        )
    )
    if not cfg_result.scalar_one_or_none():
        return {"ok": False, "error": "Config not found"}

    proj_result = await db.execute(
        select(Project).where(Project.user_id == user_id, Project.status != "deleted")
    )
    projects = list(proj_result.scalars().all())

    succeeded = []
    failed = []
    for p in projects:
        if p.status == "archived":
            failed.append({"id": p.id, "reason": "Project is archived"})
            continue
        try:
            old_config_id = p.ai_config_id
            old_model = p.ai_model

            log_entry = ProjectModelAuditLog(
                project_id=p.id,
                user_id=user_id,
                field="ai_model",
                old_api_config_id=old_config_id,
                new_api_config_id=api_config_id,
                old_model=old_model,
                new_model=model,
                change_type="switch",
            )
            db.add(log_entry)
            p.ai_config_id = api_config_id
            p.ai_model = model
            succeeded.append(p.id)
        except Exception as e:  # noqa: BLE001
            failed.append({"id": p.id, "reason": str(e)})

    await db.commit()
    return {"succeeded": succeeded, "failed": failed}


# ── Model History ──────────────────────────────────────────────────────────


async def get_model_history(
    db: AsyncSession,
    user_id: str,
    project_id: str,
    limit: int = 50,
    offset: int = 0,
) -> list[dict[str, Any]]:
    """Get model change history for a project."""
    # Verify project ownership
    proj_result = await db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == user_id)
    )
    if not proj_result.scalar_one_or_none():
        return []

    result = await db.execute(
        select(ProjectModelAuditLog)
        .where(ProjectModelAuditLog.project_id == project_id)
        .order_by(ProjectModelAuditLog.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    entries = []
    for log in result.scalars().all():
        old_config_name = None
        new_config_name = None
        if log.old_api_config_id:
            cfg = await db.execute(
                select(ApiConfig).where(ApiConfig.id == log.old_api_config_id)
            )
            cfg_obj = cfg.scalar_one_or_none()
            if cfg_obj:
                old_config_name = cfg_obj.name
        if log.new_api_config_id:
            cfg = await db.execute(
                select(ApiConfig).where(ApiConfig.id == log.new_api_config_id)
            )
            cfg_obj = cfg.scalar_one_or_none()
            if cfg_obj:
                new_config_name = cfg_obj.name

        entries.append(
            {
                "id": log.id,
                "changed_at": log.created_at.isoformat() if log.created_at else "",
                "old_config_name": old_config_name,
                "new_config_name": new_config_name,
                "old_model": log.old_model,
                "new_model": log.new_model,
                "change_type": log.change_type,
            }
        )
    return entries


async def restore_model_history(
    db: AsyncSession,
    user_id: str,
    project_id: str,
    entry_id: str,
) -> dict[str, Any] | None:
    """Restore a project's model from a history entry."""
    # Verify project ownership
    proj_result = await db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == user_id)
    )
    project = proj_result.scalar_one_or_none()
    if not project:
        return None

    # Get history entry
    entry_result = await db.execute(
        select(ProjectModelAuditLog).where(ProjectModelAuditLog.id == entry_id)
    )
    entry = entry_result.scalar_one_or_none()
    if not entry:
        return None

    # Check target config still exists
    if entry.new_api_config_id:
        cfg_result = await db.execute(
            select(ApiConfig).where(ApiConfig.id == entry.new_api_config_id)
        )
        if not cfg_result.scalar_one_or_none():
            return {
                "error": "config_not_found",
                "message": "该配置关联的 API Key 已不存在",
            }

    # Restore
    old_config_id = project.ai_config_id
    old_model = project.ai_model

    log_entry = ProjectModelAuditLog(
        project_id=project_id,
        user_id=user_id,
        field="ai_model",
        old_api_config_id=old_config_id,
        new_api_config_id=entry.new_api_config_id,
        old_model=old_model,
        new_model=entry.new_model,
        change_type="restore",
    )
    db.add(log_entry)

    project.ai_config_id = entry.new_api_config_id
    project.ai_model = entry.new_model
    await db.commit()

    return {
        "ok": True,
        "ai_config_id": project.ai_config_id,
        "ai_model": project.ai_model,
    }


# ── Usage ──────────────────────────────────────────────────────────────────


async def get_usage_summary(db: AsyncSession, user_id: str) -> dict[str, Any]:
    """Get global usage summary."""
    from sqlalchemy import func as sa_func

    # All time
    result = await db.execute(
        select(
            sa_func.coalesce(sa_func.sum(TokenLog.tokens_in + TokenLog.tokens_out), 0)
        ).where(TokenLog.user_id == user_id)
    )
    total_all = result.scalar()

    # This month
    first_of_month = datetime.now(UTC).date().replace(day=1)
    result = await db.execute(
        select(
            sa_func.coalesce(sa_func.sum(TokenLog.tokens_in + TokenLog.tokens_out), 0)
        ).where(
            TokenLog.user_id == user_id,
            TokenLog.created_at >= first_of_month,
        )
    )
    total_month = result.scalar()

    # Today
    today = datetime.now(UTC).date()
    result = await db.execute(
        select(
            sa_func.coalesce(sa_func.sum(TokenLog.tokens_in + TokenLog.tokens_out), 0)
        ).where(
            TokenLog.user_id == user_id,
            sa_func.date(TokenLog.created_at) == today,
        )
    )
    total_today = result.scalar()

    return {
        "total_all_time": total_all or 0,
        "total_this_month": total_month or 0,
        "total_today": total_today or 0,
        "by_config": [],
        "queried_at": datetime.now(UTC).isoformat(),
    }


async def get_config_usage(
    db: AsyncSession, user_id: str, config_id: str
) -> dict[str, Any]:
    """Get usage for a specific config."""
    from sqlalchemy import func as sa_func

    result = await db.execute(
        select(
            TokenLog.model,
            sa_func.coalesce(sa_func.sum(TokenLog.tokens_in + TokenLog.tokens_out), 0),
        )
        .where(
            TokenLog.user_id == user_id,
            TokenLog.api_config_id == config_id,
        )
        .group_by(TokenLog.model)
    )
    rows = result.all()

    total = sum(row[1] for row in rows)
    breakdown = [{"model": row[0], "tokens": row[1]} for row in rows]

    return {"total_tokens": total or 0, "breakdown": breakdown}


async def get_project_usage(
    db: AsyncSession, user_id: str, project_id: str
) -> dict[str, Any]:
    """Get usage for a specific project."""
    from sqlalchemy import func as sa_func

    # By model
    result = await db.execute(
        select(
            TokenLog.model,
            sa_func.coalesce(sa_func.sum(TokenLog.tokens_in + TokenLog.tokens_out), 0),
        )
        .where(
            TokenLog.user_id == user_id,
            TokenLog.project_id == project_id,
        )
        .group_by(TokenLog.model)
    )
    by_model = [{"model": row[0], "tokens": row[1]} for row in result.all()]

    # By operation
    result = await db.execute(
        select(
            TokenLog.operation,
            sa_func.coalesce(sa_func.sum(TokenLog.tokens_in + TokenLog.tokens_out), 0),
        )
        .where(
            TokenLog.user_id == user_id,
            TokenLog.project_id == project_id,
        )
        .group_by(TokenLog.operation)
    )
    by_operation = [{"operation": row[0], "tokens": row[1]} for row in result.all()]

    total = sum(item["tokens"] for item in by_model)

    return {
        "total_tokens": total or 0,
        "by_model": by_model,
        "by_operation": by_operation,
    }


# ── Migration ──────────────────────────────────────────────────────────────


async def migrate_user_configs(db: AsyncSession) -> None:
    """Migrate User.api_key / api_base_url / api_model -> ApiConfig.

    Runs in FastAPI lifespan. Idempotent.
    """
    result = await db.execute(select(ApiConfig.__table__.c.user_id).distinct())
    migrated_user_ids = {row[0] for row in result.fetchall()}

    user_result = await db.execute(
        select(User).where(
            User.api_key != "",
            User.api_key.isnot(None),
        )
    )
    for user in user_result.scalars().all():
        if user.id in migrated_user_ids:
            # Already has api_configs, skip
            continue

        detected = detect_vendor(user.api_base_url)
        vendor_id = detected.vendor_id if detected else "openai-compat"
        vendor_name = detected.display_name if detected else "OpenAI 兼容"

        config = ApiConfig(
            user_id=user.id,
            name=f"{vendor_name} 默认配置",
            vendor=vendor_id,
            vendor_display_name=vendor_name,
            api_key=encrypt_api_key(user.api_key),
            base_url=user.api_base_url,
            status="active",
        )
        db.add(config)
        await db.flush()

        # Apply model to existing projects
        if user.api_model:
            proj_result = await db.execute(
                select(Project).where(Project.user_id == user.id)
            )
            for project in proj_result.scalars().all():
                project.ai_config_id = config.id
                project.ai_model = user.api_model

                log_entry = ProjectModelAuditLog(
                    project_id=project.id,
                    user_id=user.id,
                    field="ai_model",
                    old_api_config_id=None,
                    new_api_config_id=config.id,
                    old_model=None,
                    new_model=user.api_model,
                    change_type="initial",
                )
                db.add(log_entry)

        user.migrated = True

    await db.commit()


# ── Helpers ────────────────────────────────────────────────────────────────


def _config_to_dict(config: ApiConfig) -> dict[str, Any]:
    plain_key = decrypt_api_key(config.api_key)
    models_list: list[str] = []
    if config.models:
        try:
            parsed = json.loads(config.models)
            if isinstance(parsed, list):
                models_list = parsed
        except (json.JSONDecodeError, TypeError):
            pass

    return {
        "id": config.id,
        "name": config.name,
        "vendor": config.vendor,
        "vendor_display_name": config.vendor_display_name,
        "base_url": config.base_url,
        "api_key": mask_api_key(plain_key),
        "api_key_masked": mask_api_key(plain_key),
        "status": config.status,
        "last_test_status": config.last_test_status,
        "last_test_error": config.last_test_error,
        "last_tested_at": config.last_tested_at.isoformat()
        if config.last_tested_at
        else None,
        "models": models_list,
        "models_updated_at": config.models_updated_at.isoformat()
        if config.models_updated_at
        else None,
        "created_at": config.created_at.isoformat() if config.created_at else None,
        "updated_at": config.updated_at.isoformat() if config.updated_at else None,
    }
