import type { WorkspaceStage } from "./workspace-ui";

export default function WorkspaceGuide({ stage, onConnect, onNewChat, onReload, onReloadHistory, actionDisabled = false }: {
  stage: WorkspaceStage;
  onConnect: () => void;
  onNewChat: () => void;
  onReload: () => void;
  onReloadHistory: () => void;
  actionDisabled?: boolean;
}) {
  const action = stage.action === "connect" ? { label: "Kết nối AI", click: onConnect }
    : stage.action === "new-chat" ? { label: "Cuộc trò chuyện mới", click: onNewChat }
      : stage.action === "reload" ? { label: "Tải lại kết nối", click: onReload }
        : stage.action === "retry-history" ? { label: "Tải lại cuộc trò chuyện", click: onReloadHistory } : null;
  return <section className="workspace-guide" aria-label="Bước tiếp theo">
    <div className="workspace-guide__brand"><strong>AI for Boss</strong></div>
    <h2>{stage.title}</h2>
    <p>{stage.detail}</p>
    {action ? <button type="button" onClick={action.click} disabled={actionDisabled}>{action.label}</button> : null}
  </section>;
}
