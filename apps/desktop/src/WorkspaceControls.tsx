import ModelPicker from './ModelPicker';
import GatewayControl from './GatewayControl';
import type { ContextUsage, ModelSummary, RuntimeStatus } from './gateway-client';
import type { AdvisorResult } from './advisor-types';
import type { SupervisionState, SupervisionChoice } from './supervision-api';
import type { AgentSummary } from './AgentPanel';
import { WorkbenchIcon } from './WorkspaceSidebar';
import { isSelectableModel } from './chat-state';

export function ContextMeter({ usage, models = [], pending = false }: { usage: ContextUsage; models?: ModelSummary[]; pending?: boolean }) {
  const selected = models.filter(model => model.provider === usage.modelProvider && (model.id === usage.model || `${model.provider}/${model.id}` === usage.model));
  const model = selected.length === 1 ? selected[0] : undefined;
  const nativeWindow = Number.isSafeInteger(model?.contextWindow) && model!.contextWindow! > 0 ? model!.contextWindow! : null;
  const known = usage.usedTokens !== null && usage.usedTokens >= 0 && Number.isFinite(usage.usedTokens)
    && usage.contextTokens !== null && usage.contextTokens > 0 && Number.isFinite(usage.contextTokens);
  const ceiling = usage.contextTokens !== null && usage.contextTokens > 0 && Number.isFinite(usage.contextTokens) ? usage.contextTokens : null;
  const format = (n: number | null) => n === null ? '—' : n.toLocaleString('vi-VN');
  const label = pending ? 'Đang cập nhật ngữ cảnh…' : `${format(known ? usage.usedTokens : null)} / ${format(ceiling)} token`;
  return <details className="context-meter"><summary aria-label="Cửa sổ ngữ cảnh" title={label}><WorkbenchIcon name="context" /><span>{label}</span></summary>
    <div className="control-popover"><strong>Cửa sổ ngữ cảnh</strong><p>{pending ? 'Đang xác nhận mô hình…' : model?.name || usage.model || 'Chưa chọn mô hình'}</p><p>{label}</p>
      {!pending && known && <progress max={usage.contextTokens!} value={Math.min(usage.usedTokens!, usage.contextTokens!)} />}
      {!pending && !known && <p>Chưa có số token mới được xác nhận.</p>}
      {!pending && <p>Con số trên là token đã dùng / ngân sách phiên hiện tại.</p>}
      {!pending && nativeWindow !== null && <p>Cửa sổ mô hình theo kết nối: {format(nativeWindow)} token.</p>}
      <small>Ngân sách phiên do lõi và kết nối áp dụng, có thể nhỏ hơn mức tối đa công bố của mô hình. Đăng nhập ChatGPT/Codex và API có thể có giới hạn khác nhau. Token đã dùng là số lõi báo sau lượt xử lý gần nhất; chưa bao gồm nháp và phần đang trả lời.</small></div></details>;
}
export default function WorkspaceControls({ runtime, usage, agents, agentId, models, advisorModels, choice, disabled, contextPending, reviewBusy, onAgent, onManageAgents, onChoice, onRetry, onBrowseModels, catalogueLoading, catalogueError }: {
  runtime: RuntimeStatus; usage: ContextUsage; agents: AgentSummary[]; agentId: string; models: ModelSummary[]; advisorModels: ModelSummary[]; choice: SupervisionChoice;
  disabled: boolean; contextPending: boolean; reviewBusy: boolean; onAgent(id: string): void; onManageAgents(): void;
  onChoice(choice: SupervisionChoice): void; onRetry(): void;
  onBrowseModels?(refresh?: boolean): void; catalogueLoading?: boolean; catalogueError?: string | null;
}) {
  const selected = advisorModels.find(m => m.provider === choice.model?.provider && m.id === choice.model.id);
  const activeAgent = agents.find(agent => agent.id === agentId);
  const canToggle = !disabled && (choice.enabled || Boolean(selected && isSelectableModel(selected)));
  return <div className="workspace-controls" aria-label="Điều khiển phiên">
    <GatewayControl runtime={runtime} onRetry={onRetry} />
    <details className="agents-control"><summary aria-label={`Agent đang làm việc: ${activeAgent?.name || agentId || 'Chưa chọn'}`}><span className="agent-emoji">{activeAgent?.identity?.emoji || '🤖'}</span><span>{activeAgent?.name || agentId || 'Agents'}</span><WorkbenchIcon name="chevronDown" /></summary><div className="control-popover"><strong>Chọn agent để mở phiên mới</strong>
      {agents.map(a => <button key={a.id} disabled={disabled} onClick={event => { event.currentTarget.closest('details')?.removeAttribute('open'); onAgent(a.id); }}>{a.id === agentId ? '✓ ' : ''}<span className="agent-emoji">{a.identity?.emoji || '🤖'}</span>{a.name || a.id}</button>)}
      <button disabled={disabled} onClick={event => { event.currentTarget.closest('details')?.removeAttribute('open'); onManageAgents(); }}><WorkbenchIcon name="new" /> Tạo và quản lý agents</button><small>Chọn agent sẽ mở chat mới, giữ cuộc trò chuyện hiện tại.</small></div></details>
    <ContextMeter usage={usage} models={models} pending={contextPending} />
    <div className="advisor-control-group" aria-label="Giám sát tự động">
    <span id="advisor-tab" className="advisor-label" title="Tự hỏi ý kiến khi lập kế hoạch, nhận góp ý và kiểm kết quả"><WorkbenchIcon name="shield" />Advisor{reviewBusy ? ' · Đang kiểm' : ''}</span>
    <ModelPicker id="advisor-model-picker" models={advisorModels} currentProvider={choice.model?.provider ?? null} currentId={choice.model?.id ?? null}
      label={selected?.name || choice.model?.id || 'Chọn mô hình'} disabled={disabled}
      onOpen={onBrowseModels ? () => { if (!disabled) onBrowseModels(false); } : undefined}
      onRefresh={onBrowseModels ? () => { if (!disabled) onBrowseModels(true); } : undefined}
      loading={catalogueLoading} error={catalogueError} onSelect={model => {
        const target = advisorModels.find(item => item.provider === model.provider && item.id === model.id);
        if (!disabled && target && isSelectableModel(target)) onChoice({ ...choice, model: { id: target.id, provider: target.provider } });
      }} />
    <button type="button" role="switch" aria-label="Bật giám sát tự động" aria-checked={choice.enabled} className={`advisor-switch ${choice.enabled ? 'enabled' : ''}`}
      disabled={!canToggle} title="Tự hỏi Advisor về kế hoạch và kết quả; có thêm chi phí mô hình. Dùng Dừng trong ô chat để ngắt lượt đang chạy." onClick={() => { if (canToggle) onChoice({ ...choice, enabled: !choice.enabled }); }}><span /></button>
    </div>
  </div>;
}
const phases: Record<string, string> = { planning: 'Đang lập kế hoạch và xin ý kiến', 'revising-plan': 'Đang chỉnh kế hoạch theo góp ý', 'plan-review': 'Đang kiểm kế hoạch', working: 'Đang thực hiện kế hoạch', 'revising-result': 'Đang sửa kết quả theo góp ý',
  'final-review': 'Advisor đang kiểm kết quả', completed: 'Đạt tiêu chí đã kiểm', 'needs-changes': 'Cần chỉnh sửa hoặc làm rõ', cancelled: 'Đã dừng · chưa duyệt', error: 'Chưa hoàn tất giám sát' };
export function SupervisionProgress({ state }: { state: SupervisionState }) {
  return <details className="supervision-progress" open={state.phase === 'needs-changes' || state.phase === 'error'}><summary role="status">Advisor · {phases[state.phase] ?? state.phase}</summary>
    {state.error && <p role="alert">{state.error}</p>}{state.plan && <><strong>Kế hoạch</strong><p className="preserve-lines">{state.plan}</p></>}
    {state.consultation && <p><strong>Trợ lý hỏi Advisor:</strong> {state.consultation}</p>}
    {[['Kiểm kế hoạch', state.planReview], ['Kiểm kết quả', state.finalReview]].map(([name, value]) => {
      const review = value as AdvisorResult | null;
      return review ? <section key={name as string}><strong>{name as string} · {review.pass ? 'Đạt' : 'Cần sửa'}</strong><p>{review.summary}</p>
        {review.issues.map((issue, i) => <p key={i}>{issue.title}: {issue.recommended_fix}</p>)}</section> : null;
    })}<small>Kết quả review dựa trên nội dung gửi kiểm; không thay xác minh ngoài hoặc phê duyệt hành động nhạy cảm.</small>
  </details>;
}
