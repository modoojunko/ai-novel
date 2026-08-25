# volume-chapter-index Specification (Delta)

## MODIFIED Requirements

### Requirement: chapters table

- The system SHALL create a `chapters` table with columns: `id` (String(36) PK, default uuid4), `project_id` (String(36) FK → projects.id, NOT NULL, indexed), `volume_id` (String(36) FK → volumes.id with `ondelete="CASCADE"`, NOT NULL, indexed), `chapter_no` (Integer, NOT NULL), `ref` (String(64), NOT NULL), `title` (String(200), NOT NULL), `status` (String(20), NOT NULL, default `'outline'`), `word_count` (Integer, NOT NULL, default 0), `has_prose` (Boolean, NOT NULL, default False), `outline_status` (String(20), NOT NULL, default `'unfilled'`), `confirmed_at` / `archived_at` (DateTime, nullable), `ladder_exit` (String(300), nullable — 章末落点，提示词前情与新章起点消费), `created_at` / `updated_at` (DateTime, server defaults), matching development-plan §5.2.
- The table SHALL enforce a UNIQUE constraint on `(project_id, ref)` and an INDEX on `(project_id, volume_id, status)`.
- `Chapter.volume_id` SHALL be guarded by both the FK `ondelete="CASCADE"` and the ORM relationship cascade (double insurance).

#### Scenario: Chapter rows are uniquely keyed by ref

- Given two chapters with the same `ref` under the same project
- When both rows are inserted
- Then the second insert fails on the `(project_id, ref)` unique constraint

#### Scenario: Existing database gains ladder_exit via idempotent DDL

- Given a pre-existing chapters table without `ladder_exit`
- When the backend starts and the lifespan runs the migration
- Then the column exists (nullable) and startup is not blocked if it already exists

## ADDED Requirements

### Requirement: prompt-crafting chapter columns and sub-table

- `chapter_scene_cards` SHALL gain nullable columns `weight` (String(10); value domain `high`/`mid`/`low`) and `focus` (String(50); value domain 核心冲突/人物情绪/信息差), consumed by prompt material assembly for 笔墨分配.
- The system SHALL create a `chapter_micro_payoffs` table (读者获得/爽点) with columns: `id` (String(36) PK), `chapter_id` (String(36) FK → chapters.id `ondelete="CASCADE"`, NOT NULL, indexed), `sort_order` (Integer, NOT NULL), `kind` (String(50), NOT NULL — 类型枚举 info/relationship/emotion/clue/ability/resource/recognition), `description` (String(300), NOT NULL), `location` (String(20), NOT NULL, default 前段 — 前段/中段/后段).
- The table SHALL enforce a UNIQUE constraint on `(chapter_id, sort_order)` and cascade with chapter deletion (same `_ChapterChildMixin` pattern).
- All new columns/tables SHALL be applied to existing databases via idempotent startup DDL (存量库幂等，启动不因已存在而失败).

#### Scenario: New columns on a fresh database

- Given the backend starts with a fresh SQLite database
- Then `chapter_scene_cards` has `weight`/`focus` columns and `chapter_micro_payoffs` exists with the specified columns and unique constraint

#### Scenario: Existing database migrates idempotently

- Given a pre-existing database from before this change
- When the backend starts
- Then the scene-card columns and the micro-payoffs table are added without error, and a second startup is also a no-op success

#### Scenario: Deleting a chapter cascades to micro payoffs

- Given a chapter with micro_payoffs rows and `PRAGMA foreign_keys=ON`
- When the chapter row is deleted
- Then its micro_payoffs rows are deleted with it
