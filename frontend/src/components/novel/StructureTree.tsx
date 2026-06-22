export type TreeNodeAction = {
  icon: string;
  label: string;
  onClick: (node: TreeNode) => void;
};

export type TreeNode = {
  id: string;
  icon?: string;
  label?: string;
  badge?: string;
  badgeColor?: string;
  actions?: TreeNodeAction[];
  children?: TreeNode[];
  data?: unknown;
};

interface TreeCallbacks {
  selectedId?: string;
  onSelect: (node: TreeNode) => void;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
}

interface TreeProps extends TreeCallbacks {
  nodes: TreeNode[];
}

function TreeNodeItem({
  node,
  selectedId,
  onSelect,
  expandedIds,
  onToggle,
  depth = 0,
}: TreeCallbacks & { node: TreeNode; depth?: number }) {
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedId === node.id;
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div>
      <div
        className={`group flex items-center gap-1 w-full px-2 py-1.5 rounded transition-colors cursor-pointer
          ${isSelected
            ? "bg-primary/10 text-primary font-medium"
            : "hover:bg-base-300/30 text-base-content/70"
          }`}
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
          <span className="text-xs text-base-content/50 flex-shrink-0">{node.icon}</span>
        )}

        {/* Label */}
        <span className="text-xs truncate flex-1">{node.label ?? "(未命名)"}</span>

        {/* Badge */}
        {node.badge && (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 leading-none"
            style={{
              backgroundColor: node.badgeColor ? `${node.badgeColor}20` : undefined,
              color: node.badgeColor ?? undefined,
            }}
          >
            {node.badge}
          </span>
        )}

        {/* Action buttons (visible on hover) */}
        {node.actions && node.actions.length > 0 && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-auto flex-shrink-0">
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
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function StructureTree({
  nodes,
  selectedId,
  onSelect,
  expandedIds,
  onToggle,
}: TreeProps) {
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
        />
      ))}
    </div>
  );
}
