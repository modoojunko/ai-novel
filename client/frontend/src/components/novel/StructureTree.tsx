import { useState, useCallback } from "react";
import { Lock, Trash2 } from "lucide-react";

export type TreeNodeAction = {
  icon: React.ReactNode;
  label: string;
  onClick: (node: TreeNode) => void;
};

export type TreeNode = {
  id: string;
  icon?: React.ReactNode;
  label?: string;
  badge?: string;
  badgeColor?: string;
  actions?: TreeNodeAction[];
  children?: TreeNode[];
  data?: unknown;
  locked?: boolean;
};

interface TreeCallbacks {
  selectedId?: string;
  onSelect: (node: TreeNode) => void;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
}

interface TreeProps extends TreeCallbacks {
  nodes: TreeNode[];
  /** Enable double-click to edit node titles */
  editable?: boolean;
  /** Enable lock icon on nodes with `node.locked = true` */
  locked?: boolean;
  /** Called when an edited title is confirmed */
  onTitleChange?: (nodeId: string, newTitle: string) => void;
  /** Called when a node delete is confirmed */
  onDelete?: (nodeId: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Recursively find a node's label by id. */
function findNodeLabel(nodes: TreeNode[], id: string): string {
  for (const n of nodes) {
    if (n.id === id) return n.label ?? "";
    if (n.children) {
      const found = findNodeLabel(n.children, id);
      if (found !== "") return found;
    }
  }
  return "";
}

// ---------------------------------------------------------------------------
// TreeNodeItem
// ---------------------------------------------------------------------------

interface TreeNodeItemProps extends TreeCallbacks {
  node: TreeNode;
  depth?: number;
  editable?: boolean;
  treeLocked?: boolean;
  onDelete?: (nodeId: string) => void;
  editingId: string | null;
  editingValue: string;
  onStartEdit: (id: string, label: string) => void;
  onUpdateEdit: (value: string) => void;
  onCommitEdit: (id: string) => void;
  onCancelEdit: () => void;
  confirmingDeleteId: string | null;
  onStartDelete: (id: string) => void;
  onCommitDelete: (id: string) => void;
  onCancelDelete: () => void;
}

function TreeNodeItem({
  node,
  selectedId,
  onSelect,
  expandedIds,
  onToggle,
  depth = 0,
  editable,
  treeLocked,
  onDelete,
  editingId,
  editingValue,
  onStartEdit,
  onUpdateEdit,
  onCommitEdit,
  onCancelEdit,
  confirmingDeleteId,
  onStartDelete,
  onCommitDelete,
  onCancelDelete,
}: TreeNodeItemProps) {
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedId === node.id;
  const hasChildren = node.children && node.children.length > 0;
  const isEditing = editingId === node.id;
  const isConfirmingDelete = confirmingDeleteId === node.id;
  const isLocked = treeLocked && node.locked;

  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      e.stopPropagation();
      if (e.key === "Enter") {
        e.preventDefault();
        onCommitEdit(node.id);
      } else if (e.key === "Escape") {
        onCancelEdit();
      }
    },
    [node.id, onCommitEdit, onCancelEdit],
  );

  const handleDoubleClick = useCallback(() => {
    if (editable && !isEditing) {
      onStartEdit(node.id, node.label ?? "");
    }
  }, [editable, isEditing, node.id, node.label, onStartEdit]);

  const showRightSide =
    (!isEditing && onDelete && !hasChildren) ||
    (node.actions && node.actions.length > 0);

  return (
    <div>
      <div
        className={`group flex items-center gap-1 w-full px-2 py-1.5 rounded transition-colors cursor-pointer
          ${isSelected
            ? "bg-primary/10 text-primary font-medium"
            : "hover:bg-base-300/30 text-base-content/70"
          } ${isLocked ? "opacity-60 bg-base-200/30" : ""}`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        onClick={() => onSelect(node)}
      >
        {/* Expand/collapse arrow */}
        {hasChildren ? (
          <span
            className="text-[10px] text-base-content/40 hover:text-base-content/70 flex-shrink-0 w-3 text-center"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.id);
            }}
          >
            {isExpanded ? "▾" : "▸"}
          </span>
        ) : (
          <span className="w-3 flex-shrink-0" />
        )}

        {/* Node icon */}
        {node.icon && (
          <span className="text-xs text-base-content/50 flex-shrink-0">
            {node.icon}
          </span>
        )}

        {/* Lock icon */}
        {isLocked && (
          <Lock className="w-3 h-3 text-base-content/30 flex-shrink-0" />
        )}

        {/* Label or Edit input */}
        {isEditing ? (
          <input
            className="input input-ghost input-xs flex-1 min-w-0 px-0 py-0 h-auto text-xs"
            value={editingValue}
            onChange={(e) => onUpdateEdit(e.target.value)}
            onKeyDown={handleEditKeyDown}
            onBlur={() => onCommitEdit(node.id)}
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="text-xs truncate flex-1"
            onDoubleClick={handleDoubleClick}
          >
            {node.label ?? "(未命名)"}
          </span>
        )}

        {/* Badge */}
        {node.badge && (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 leading-none"
            style={{
              backgroundColor: node.badgeColor
                ? `${node.badgeColor}20`
                : undefined,
              color: node.badgeColor ?? undefined,
            }}
          >
            {node.badge}
          </span>
        )}

        {/* Right side group (delete + existing actions) */}
        {showRightSide && (
          <div className="flex items-center gap-0.5 ml-auto flex-shrink-0">
            {/* Delete button with inline confirmation */}
            {!isEditing && onDelete && !hasChildren &&
              (isConfirmingDelete ? (
                <span className="flex items-center gap-1 text-[10px]">
                  <button
                    className="text-error font-medium hover:underline whitespace-nowrap"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCommitDelete(node.id);
                    }}
                  >
                    确认删除?
                  </button>
                  <button
                    className="text-base-content/40 hover:text-base-content/70"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCancelDelete();
                    }}
                  >
                    取消
                  </button>
                </span>
              ) : (
                <button
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-base-content/40 hover:text-error"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartDelete(node.id);
                  }}
                  title="删除"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              ))}

            {/* Existing action buttons (visible on hover) */}
            {node.actions && node.actions.length > 0 && (
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {node.actions.map((action, i) => (
                  <button
                    key={i}
                    title={action.label}
                    className="btn btn-ghost btn-xs px-1 text-base-content/40 hover:text-base-content"
                    onClick={(e) => {
                      e.stopPropagation();
                      action.onClick(node);
                    }}
                  >
                    <span className="text-xs">{action.icon}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Children (recursive) */}
      {hasChildren && isExpanded && (
        <div className="ml-4 border-l border-base-300/50 pl-2">
          {node.children!.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              expandedIds={expandedIds}
              onToggle={onToggle}
              depth={depth + 1}
              editable={editable}
              treeLocked={treeLocked}
              onDelete={onDelete}
              editingId={editingId}
              editingValue={editingValue}
              onStartEdit={onStartEdit}
              onUpdateEdit={onUpdateEdit}
              onCommitEdit={onCommitEdit}
              onCancelEdit={onCancelEdit}
              confirmingDeleteId={confirmingDeleteId}
              onStartDelete={onStartDelete}
              onCommitDelete={onCommitDelete}
              onCancelDelete={onCancelDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function StructureTree({
  nodes,
  selectedId,
  onSelect,
  expandedIds,
  onToggle,
  editable,
  locked: treeLocked,
  onTitleChange,
  onDelete,
}: TreeProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
    null,
  );

  const handleStartEdit = useCallback((id: string, label: string) => {
    setEditingId(id);
    setEditingValue(label);
  }, []);

  const handleUpdateEdit = useCallback((value: string) => {
    setEditingValue(value);
  }, []);

  const handleCommitEdit = useCallback(
    (id: string) => {
      const trimmed = editingValue.trim();
      const original = findNodeLabel(nodes, id);
      if (trimmed && trimmed !== original) {
        onTitleChange?.(id, trimmed);
      }
      setEditingId(null);
      setEditingValue("");
    },
    [editingValue, nodes, onTitleChange],
  );

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditingValue("");
  }, []);

  const handleStartDelete = useCallback((id: string) => {
    setConfirmingDeleteId(id);
  }, []);

  const handleCommitDelete = useCallback(
    (id: string) => {
      onDelete?.(id);
      setConfirmingDeleteId(null);
    },
    [onDelete],
  );

  const handleCancelDelete = useCallback(() => {
    setConfirmingDeleteId(null);
  }, []);

  if (!nodes || nodes.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-base-content/40">
        暂无内容
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      {nodes.map((node) => (
        <TreeNodeItem
          key={node.id}
          node={node}
          selectedId={selectedId}
          onSelect={onSelect}
          expandedIds={expandedIds}
          onToggle={onToggle}
          depth={0}
          editable={editable}
          treeLocked={treeLocked}
          onDelete={onDelete}
          editingId={editingId}
          editingValue={editingValue}
          onStartEdit={handleStartEdit}
          onUpdateEdit={handleUpdateEdit}
          onCommitEdit={handleCommitEdit}
          onCancelEdit={handleCancelEdit}
          confirmingDeleteId={confirmingDeleteId}
          onStartDelete={handleStartDelete}
          onCommitDelete={handleCommitDelete}
          onCancelDelete={handleCancelDelete}
        />
      ))}
    </div>
  );
}
