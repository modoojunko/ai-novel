import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useApiConfigs } from "../hooks/useApiConfigs";
import type { ApiConfig } from "../types/api-config";
import { MigrationBanner } from "../components/api-config/MigrationBanner";
import { UsageStatsCard } from "../components/api-config/UsageStatsCard";
import { ApiConfigCard } from "../components/api-config/ApiConfigCard";
import { ApiConfigCardSkeleton } from "../components/api-config/ApiConfigCardSkeleton";
import { ApiConfigForm } from "../components/api-config/ApiConfigForm";
import type { ApiConfigFormData } from "../components/api-config/ApiConfigForm";
import { DeleteConfirmDialog } from "../components/api-config/DeleteConfirmDialog";
import { UndoToast } from "../components/api-config/UndoToast";
import { getToken, isLoggedIn } from "../lib/auth";

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { "Authorization": `Bearer ${token}` } : {};
}

export default function ApiKeyConfigPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (!isLoggedIn()) {
      navigate("/register", { replace: true });
    }
  }, [navigate]);
  const { configs, loading, error, addConfig, updateConfig, deleteConfig, refreshStatus } = useApiConfigs();
  const [showForm, setShowForm] = useState(false);
  const [editConfig, setEditConfig] = useState<ApiConfig | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApiConfig | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [undoToast, setUndoToast] = useState<{ config: ApiConfig; data: { affected_projects: number } } | null>(null);
  const [pendingUndo, setPendingUndo] = useState<ApiConfigFormData | null>(null);
  const [migrationStatus, setMigrationStatus] = useState<{ completed: boolean; configName?: string } | undefined>(undefined);

  // Check #add anchor
  useEffect(() => {
    if (searchParams.get("add") === "" || window.location.hash === "#add") {
      setShowForm(true);
    }
  }, [searchParams]);

  // Fetch migration status
  useEffect(() => {
    fetch("/api/v1/user/profile", { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => {
        if (data.migration_completed !== undefined) {
          setMigrationStatus({ completed: data.migration_completed, configName: data.migration_config_name });
        }
      })
      .catch(() => {});
  }, []);

  const handleFormSubmit = useCallback(async (data: ApiConfigFormData) => {
    if (editConfig) {
      await updateConfig(editConfig.id, data);
      setEditConfig(null);
    } else {
      await addConfig(data);
      setShowForm(false);
    }
  }, [editConfig, updateConfig, addConfig]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const result = await deleteConfig(deleteTarget.id);
      setDeleteTarget(null);
      setUndoToast({ config: deleteTarget, data: result });
    } catch {
      // Keep dialog open on error
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, deleteConfig]);

  const handleUndoDelete = useCallback(async () => {
    if (!undoToast || !pendingUndo) return;
    try {
      await addConfig(pendingUndo);
      setUndoToast(null);
      setPendingUndo(null);
    } catch {
      // undo failed silently
    }
  }, [undoToast, pendingUndo, addConfig]);

  const handleUndoExpire = useCallback(() => {
    setUndoToast(null);
    setPendingUndo(null);
  }, []);

  // Refresh status when configs change
  useEffect(() => {
    if (configs.length > 0) {
      refreshStatus();
    }
  }, [configs.length, refreshStatus]);

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">API Key 配置</h1>
          <p className="text-sm text-base-content/60 mt-1">
            管理你的 AI 服务 API Key，为不同小说选择不同模型
          </p>
        </div>
        {!showForm && !editConfig && (
          <button
            className="btn btn-primary"
            onClick={() => { setShowForm(true); setEditConfig(null); }}
          >
            添加 API Key
          </button>
        )}
      </div>

      {/* Migration Banner */}
      {migrationStatus && !migrationStatus.completed && (
        <MigrationBanner migrationCompleted={migrationStatus.completed} />
      )}

      {/* Usage Stats */}
      <UsageStatsCard data={null} loading={loading} />

      {/* Form (create/edit) */}
      {(showForm || editConfig) && (
        <div className="card bg-base-100 border border-base-300 p-5">
          <h2 className="text-lg font-semibold mb-4">
            {editConfig ? "编辑配置" : "添加 API Key"}
          </h2>
          <ApiConfigForm
            config={editConfig ?? undefined}
            onSubmit={handleFormSubmit}
            onCancel={() => { setShowForm(false); setEditConfig(null); }}
          />
        </div>
      )}

      {/* Config List */}
      <div id="api-config-list">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <ApiConfigCardSkeleton key={i} />)}
          </div>
        ) : error ? (
          <div className="alert alert-error">{error}</div>
        ) : configs.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">🔑</div>
            <h3 className="text-lg font-semibold">还没有 API Key 配置</h3>
            <p className="text-sm text-base-content/50 mt-1 mb-4">
              添加你的第一个 API Key 来开始使用 AI 写作
            </p>
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>
              添加 API Key
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {configs.map((c) => (
              <ApiConfigCard
                key={c.id}
                config={c}
                onEdit={() => { setEditConfig(c); setShowForm(false); }}
                onDelete={() => { setDeleteTarget(c); }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <DeleteConfirmDialog
          config={deleteTarget}
          affectedCount={0}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          deleting={deleting}
        />
      )}

      {/* Undo Toast */}
      {undoToast && (
        <UndoToast
          configName={undoToast.config.name}
          onUndo={handleUndoDelete}
          onExpire={handleUndoExpire}
        />
      )}
    </div>
  );
}
