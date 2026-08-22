// 提示词面板（book.html renderPromptPane 复刻）：panel-head 徽标 + 说明。
// 原型为单 textarea（自动组装/自定义切换）；应用侧真实模型是分段提示词
// 文件（PromptManagementPage 按章过滤渲染）——过渡期原样内嵌（轻重皮），
// PR 5 按设计语言重绘其内部。
import PromptManagementPage from "../PromptManagementPage";

interface PromptPaneProps {
  projectId: string;
  chapterRef: string;
  title: string;
  /** 是否已有自定义提示词文件（能力探测，403/404/空都算无） */
  hasPrompts: boolean | null;
}

export default function PromptPane({
  projectId,
  chapterRef,
  title,
  hasPrompts,
}: PromptPaneProps) {
  const custom = !!hasPrompts;
  return (
    <div className="prompt-pane">
      <div className="panel">
        <div className="panel-head">
          <h2>提示词 · {title}</h2>
          {custom ? (
            <span className="badge warn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <circle cx="12" cy="12" r="5" fill="currentColor" stroke="none" />
              </svg>
              已自定义
            </span>
          ) : (
            <span className="badge ok">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M5 13l4 4L19 7" />
              </svg>
              自动组装
            </span>
          )}
        </div>
        <p className="desc">
          AI 生成正文时使用的提示词，由「设定 + 章纲」自动组装。编辑后保存，本章将以自定义提示词为准。
        </p>
        <div className="prompt-body">
          <PromptManagementPage projectId={projectId} chapterRef={chapterRef} />
        </div>
      </div>
    </div>
  );
}
