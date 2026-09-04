"""包导入引擎（c-novel-export-roundtrip PR2）。

单轨升级恢复路径：备份包 → 形态探测+校验 → 逐书单事务落库+智能挂回。
零迁移零召回（旧库留档零接触）。
"""

import json
import uuid
import zipfile
from datetime import datetime
from pathlib import Path

import yaml
from sqlalchemy import select

FORMAT_VERSION = 1
_ARCHIVE_STATUSES = {"pending_activation", "active", "revoked"}


def detect_kind(zf: zipfile.ZipFile) -> str:
    names = set(zf.namelist())
    if "backup.yaml" in names:
        return "assets"
    if "config.yaml" in names:
        return "config"
    if "project.yaml" in names or "project.json" in names:
        return "single"
    return "unknown"


def validate_paths(zf: zipfile.ZipFile) -> None:
    for name in zf.namelist():
        p = Path(name)
        if p.is_absolute() or ".." in p.parts or (len(name) > 1 and name[1] == ":"):
            raise ValueError(f"非法路径: {name}")


def parse_package(paths: list[str]) -> dict:
    books = []
    config_data = None
    warnings = []
    schema_version = None

    for path_str in paths:
        p = Path(path_str)
        if not p.exists():
            warnings.append(f"文件不存在: {p.name}")
            continue
        try:
            zf = zipfile.ZipFile(p)
        except zipfile.BadZipFile:
            warnings.append(f"不是有效的 zip 文件: {p.name}")
            continue
        validate_paths(zf)
        kind = detect_kind(zf)
        names = set(zf.namelist())

        if kind == "assets":
            meta = yaml.safe_load(zf.read("backup.yaml"))
            sv = meta.get("format_version", 0) if meta else 0
            schema_version = max(schema_version or 0, sv)
            for entry in meta.get("books", []):
                slug = entry.get("slug", "")
                book_dir = f"projects/{slug}/"
                proj_data = yaml.safe_load(zf.read(f"{book_dir}project.yaml"))
                books.append({
                    "name": proj_data.get("name", ""),
                    "path": book_dir,
                    "source_zip": path_str,
                })
        elif kind == "single":
            pn = "project.yaml" if "project.yaml" in names else "project.json"
            proj_data = yaml.safe_load(zf.read(pn))
            books.append({"name": proj_data.get("name", ""), "path": "/", "source_zip": path_str})
        elif kind == "config":
            config_data = yaml.safe_load(zf.read("config.yaml"))

    return {"books": books, "config": config_data, "warnings": warnings, "schema_version": schema_version}


async def persist_package(db, user_id: str, paths: list[str], include_config: bool = True) -> dict:
    results = []
    info = parse_package(paths)

    if info["config"] and include_config:
        from api_configs.crypto import encrypt_api_key
        from models.api_config import ApiConfig
        from models.user import User

        cfg = info["config"]
        u = cfg.get("user", {})
        target_user = await db.get(User, user_id)
        if target_user:
            if not target_user.display_name and u.get("display_name"):
                target_user.display_name = u["display_name"]
            if not target_user.api_key and u.get("api_key"):
                target_user.api_key = u["api_key"]
                target_user.api_base_url = u.get("api_base_url", "")
                target_user.api_model = u.get("api_model", "")

        for ac in cfg.get("api_configs", []):
            existing = await db.scalars(
                select(ApiConfig).where(
                    ApiConfig.user_id == user_id, ApiConfig.name == ac["name"]
                )
            )
            if existing.first():
                continue
            db.add(ApiConfig(
                user_id=user_id, name=ac["name"], vendor=ac.get("vendor", ""),
                vendor_display_name=ac.get("vendor_display_name", ""),
                api_key=encrypt_api_key(ac.get("api_key", "")),
                base_url=ac.get("base_url", ""), models=ac.get("models"),
            ))

    for path_str in paths:
        p = Path(path_str)
        if not p.exists():
            continue
        try:
            zf = zipfile.ZipFile(p)
        except zipfile.BadZipFile:
            continue
        kind = detect_kind(zf)
        validate_paths(zf)

        if kind == "assets":
            meta = yaml.safe_load(zf.read("backup.yaml"))
            for entry in meta.get("books", []):
                slug = entry.get("slug", "")
                book_dir = f"projects/{slug}/"
                try:
                    novel_id = await _import_single_book(db, zf, book_dir, user_id)
                    results.append({"book_id": book_dir, "status": "ok", "novel_id": novel_id})
                except Exception:
                    results.append({"book_id": book_dir, "status": "failed"})
        elif kind == "single":
            pn = "project.yaml" if "project.yaml" in set(zf.namelist()) else "project.json"
            try:
                novel_id = await _import_single_book(db, zf, "/", user_id)
                results.append({"book_id": pn, "status": "ok", "novel_id": novel_id})
            except Exception:
                results.append({"book_id": pn, "status": "failed"})

    return {"results": results, "warnings": info.get("warnings", [])}


async def _import_single_book(db, zf, book_dir: str, user_id: str) -> str:
    from models.project import Novel
    from models.volume import Volume

    pn = "project.yaml" if f"{book_dir}project.yaml" in set(zf.namelist()) else "project.json"
    proj_data = yaml.safe_load(zf.read(f"{book_dir}{pn}")) if pn.endswith(".yaml") else json.loads(zf.read(f"{book_dir}{pn}"))

    slug = proj_data.get("slug", f"imp-{uuid.uuid4().hex[:6]}")
    novel = Novel(
        user_id=user_id, name=proj_data.get("name", "导入书"),
        slug=slug, root_path=f"./data/{slug}", source="import",
        current_phase=proj_data.get("current_phase", "write"),
        ai_model=proj_data.get("ai_model", ""),
    )
    db.add(novel)
    await db.flush()

    for name in zf.namelist():
        if not name.startswith(f"{book_dir}settings/") or not name.endswith(".yaml"):
            continue
        rel = name[len(book_dir):]
        data = yaml.safe_load(zf.read(name))
        if data:
            from models.project_setting import ProjectSetting
            from filesystem.paths import route_relative_path
            key = route_relative_path(rel)
            db.add(ProjectSetting(root_path=novel.root_path, key=key, content=json.dumps(data, ensure_ascii=False)))

    await db.flush()
    return str(novel.id)
