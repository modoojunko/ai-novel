/**
 * 空态解剖（规范 §6.4）：现状一句话 + 一个主动作 + 可选旁路动作。
 *
 * 「禁止只有插画没有出路」（规范 P1/P3）在这里变成类型约束：
 *   primary 是唯一主动作（btn-secondary，空态不用实底主按钮），
 *   secondary 是留给「现在不想做这件事」的旁路（ghost）。
 * 容器沿用全局 `.empty`（虚线描边、serif 说明），无新增容器样式。
 */
import type { ReactNode } from "react";
import { Ico } from "@/components/icons";

interface Act {
  label: string;
  onClick: () => void;
}

interface EmptyStateProps {
  /** 登记表内的图标 path（icons.tsx 的 P.*）；不给就不渲染图标位 */
  icon?: string;
  /** 写清现状，用「还没有 X」，不用「暂无数据」这类机器腔（规范 §13） */
  title: ReactNode;
  /** 这块地方将来会拿来干什么，一句以内 */
  desc?: ReactNode;
  primary?: Act;
  secondary?: Act;
}

export function EmptyState({ icon, title, desc, primary, secondary }: EmptyStateProps) {
  return (
    <div className="empty">
      {icon && <Ico d={icon} size={22} />}
      <h3>{title}</h3>
      {desc && <p>{desc}</p>}
      {(primary || secondary) && (
        <div className="empty-actions">
          {primary && (
            <button type="button" className="btn btn-secondary" onClick={primary.onClick}>
              {primary.label}
            </button>
          )}
          {secondary && (
            <button type="button" className="btn btn-ghost" onClick={secondary.onClick}>
              {secondary.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
