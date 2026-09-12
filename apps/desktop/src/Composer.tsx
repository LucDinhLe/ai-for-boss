import { useEffect, useRef, useState, type FormEvent } from "react";
import { handleComposerKeyDown } from "./chat-drafts";
import { CHAT_FILE_ACCEPT, attachmentReadHint } from "./chat-attachments";
import type { ContextUsage, ModelSummary } from "./gateway-client";
import type { SessionThinking } from "./session-thinking";
import ModelPicker from "./ModelPicker";
import { isSelectableModel } from "./chat-state";
import { CONTRACT_MODES, type ContractMode } from "./task-contract";

export type ComposerAttachment = {
  id: string;
  name: string;
  sizeBytes: number;
  status: "reading" | "ready" | "error";
  error?: string;
  mimeType?: string;
  extractedText?: string;
};

export type ComposerProps = {
  draft: string;
  textSize?: number;
  onDraftChange(value: string): void;
  onSend(event: FormEvent): void;
  onStop(): void;
  canSubmit: boolean;
  busy: boolean;
  stopping: boolean;
  stopDisabled?: boolean;
  disabled: boolean;
  models: ModelSummary[];
  usage: ContextUsage;
  modelsLoading: boolean;
  onBrowseModels?(refresh?: boolean): void;
  catalogueLoading?: boolean;
  catalogueError?: string | null;
  paused?: boolean;
  changingModel: boolean;
  onChangeModel(model: ModelSummary): Promise<void>;
  thinking?: SessionThinking;
  onChangeThinking?(level: string | null): Promise<void>;
  /** Task contract (spec 0056): one of three buttons, or none for the safety-net defaults. */
  contract?: { mode: ContractMode | null; ready: boolean };
  onChangeContract?(mode: ContractMode | null): Promise<void>;
  attachments: readonly ComposerAttachment[];
  onAddFiles(files: File[]): void;
  onRemoveFile(id: string): void;
  canAttach: boolean;
  attachmentHint: string;
};

const modelName = (model: ModelSummary) => model.name?.trim() || model.id;
const fileSize = (bytes: number) => bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024
  ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

// The owner mounts this component with the session key; history owns the model
// value, while this component locks immediate duplicate selection events.
export default function Composer(props: ComposerProps) {
  const [changing, setChanging] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);
  const [contractBusy, setContractBusy] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const changeInFlight = useRef(false);
  useEffect(() => {
    const element = input.current;
    if (!element) return;
    let frame = 0, width = element.clientWidth;
    const resize = () => {
      // Measure without a scrollbar, which otherwise changes the wrap width.
      element.style.overflowY = "hidden";
      element.style.height = "auto";
      const height = element.scrollHeight;
      element.style.height = `${Math.min(180, height + 1)}px`;
      element.style.overflowY = height > 180 ? "auto" : "hidden";
    };
    resize();
    const observer = new ResizeObserver(() => {
      if (element.clientWidth === width) return;
      width = element.clientWidth;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(resize);
    });
    observer.observe(element);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [props.draft, props.textSize]);
  const matches = props.models.filter((model) => model.provider === props.usage.modelProvider
    && (model.id === props.usage.model || `${model.provider}/${model.id}` === props.usage.model));
  const current = matches.length === 1 ? matches[0] : undefined;
  const currentName = props.paused ? "Gateway đã tạm dừng" : props.modelsLoading ? "Đang tải mô hình…" : props.usage.model
    ? current ? modelName(current) : props.usage.model : "Chọn mô hình";
  const modelLocked = props.disabled || props.busy || props.modelsLoading || props.changingModel || changing;
  const sendAllowed = props.canSubmit && !props.disabled && !props.busy && !props.changingModel && !changing;
  const attachAllowed = props.canAttach && !props.disabled && !props.changingModel && !changing;
  const selectModel = async (model: ModelSummary) => {
    if (modelLocked || changeInFlight.current) return;
    const target = props.models.find(item => item.provider === model.provider && item.id === model.id);
    if (!target || !isSelectableModel(target)
      || (model.provider === props.usage.modelProvider && model.id === (current?.id ?? props.usage.model))) return;
    changeInFlight.current = true;
    setChanging(true);
    setChangeError(null);
    try {
      await props.onChangeModel(target);
    } catch {
      setChangeError("Chưa đổi được mô hình. Kiểm tra kết nối rồi thử lại.");
    } finally {
      changeInFlight.current = false;
      setChanging(false);
    }
  };

  return <form className="composer" onSubmit={(event) => {
    event.preventDefault();
    if (sendAllowed && !changeInFlight.current) props.onSend(event);
  }}>
    <div className="composer__box">
      {props.attachments.length ? <ul className="composer__attachments" aria-label="Tệp trong bản nháp">
        {props.attachments.map((file) => <li key={file.id} className={`composer__attachment composer__attachment--${file.status}`}>
          <span className="composer__file-info">
            <span className="composer__file-name" title={file.name}>{file.name}</span>
            <span className="composer__file-detail" role="status">{fileSize(file.sizeBytes)} · {file.status === "reading"
              ? "Đang đọc…" : file.status === "error" ? file.error || "Không đọc được tệp" : file.extractedText ? `Đã đọc văn bản và bảng · ${file.extractedText.length.toLocaleString("vi-VN")} ký tự` : "Sẵn sàng gửi"}</span>
            {file.status === "ready" && file.mimeType && attachmentReadHint(file.mimeType) && <small className="composer__file-hint">{attachmentReadHint(file.mimeType)}</small>}
          </span>
          <button type="button" className="composer__remove" aria-label={`Bỏ tệp ${file.name}`}
            disabled={props.disabled} onClick={() => { if (!props.disabled) props.onRemoveFile(file.id); }}>×</button>
        </li>)}
      </ul> : null}
      {props.contract && props.onChangeContract ? <div className="composer__contract" role="radiogroup" aria-label="Chế độ làm việc cho lượt này">
        {CONTRACT_MODES.map(mode => {
          const active = props.contract?.mode === mode.id;
          return <button type="button" key={mode.id} role="radio" aria-checked={active} title={mode.hint}
            className={`composer__chip${active ? " composer__chip--active" : ""}`}
            disabled={props.disabled || contractBusy || !props.contract?.ready || changing || props.changingModel}
            onClick={() => {
              if (contractBusy || !props.contract?.ready) return;
              setContractBusy(true); setChangeError(null);
              void props.onChangeContract?.(active ? null : mode.id)
                .catch(() => setChangeError("Chưa đổi được chế độ. Hãy thử lại."))
                .finally(() => setContractBusy(false));
            }}>{mode.label}</button>;
        })}
        <span className="composer__chip-hint">{CONTRACT_MODES.find(mode => mode.id === props.contract?.mode)?.hint ?? "Chọn một chế độ để đặt trần bước và mức suy nghĩ cho lượt này."}</span>
      </div> : null}
      <label className="sr-only" htmlFor="composer-input">Nội dung gửi cho trợ lý</label>
      <textarea ref={input} id="composer-input" value={props.draft} rows={1}
        onPaste={event => {
          const images = Array.from(event.clipboardData.files).filter(file => file.type.startsWith('image/'));
          if (images.length && attachAllowed && !changeInFlight.current) { event.preventDefault(); props.onAddFiles(images); }
        }}
        onChange={(event) => props.onDraftChange(event.target.value)}
        onKeyDown={(event) => handleComposerKeyDown(event, sendAllowed && !changeInFlight.current)}
        placeholder={props.disabled ? "Mở một cuộc trò chuyện để bắt đầu" : props.busy
          ? "Soạn tin tiếp theo trong lúc chờ…" : "Bạn cần trợ lý giúp việc gì?"}
        disabled={props.disabled} aria-describedby="composer-hint" />
      <div className="composer__toolbar">
        <input ref={picker} id="composer-files" type="file" hidden multiple accept={CHAT_FILE_ACCEPT} disabled={!attachAllowed}
          aria-label="Chọn tệp đính kèm" onChange={(event) => {
            const files = Array.from(event.currentTarget.files ?? []);
            event.currentTarget.value = "";
            if (attachAllowed && !changeInFlight.current && files.length) props.onAddFiles(files);
          }} />
        <button type="button" className="composer__add" aria-label="Thêm tệp" title={props.attachmentHint || "Thêm tệp"}
          disabled={!attachAllowed} onClick={() => { if (attachAllowed) picker.current?.click(); }}>
          <span aria-hidden="true">+</span>
        </button>
        <ModelPicker models={props.models} currentProvider={props.usage.modelProvider} currentId={current?.id ?? props.usage.model}
          label={changing || props.changingModel ? "Đang đổi…" : currentName} disabled={modelLocked}
          onOpen={props.onBrowseModels ? () => { if (!modelLocked) props.onBrowseModels?.(false); } : undefined}
          onRefresh={props.onBrowseModels ? () => { if (!modelLocked) props.onBrowseModels?.(true); } : undefined}
          loading={props.catalogueLoading} error={props.catalogueError}
          onSelect={selectModel} />
        {props.thinking && (props.thinking.levels.length > 0 || props.thinking.level !== null) && props.onChangeThinking ? <select id="composer-thinking" className="composer__thinking"
          aria-label="Mức suy nghĩ" title="Mức suy nghĩ cho lượt gửi tiếp theo. Mức cao hơn có thể dùng thêm thời gian và hạn mức."
          disabled={modelLocked} value={props.thinking.level ?? ""} onChange={event => {
            if (modelLocked || changeInFlight.current) return;
            setChangeError(null);
            void props.onChangeThinking?.(event.target.value || null).catch(() => setChangeError("Chưa đổi được mức suy nghĩ. Hãy thử lại."));
          }}>
          <option value="">Tự động</option>
          {props.thinking.level && !props.thinking.levels.some(level => level.id === props.thinking?.level)
            ? <option value={props.thinking.level} disabled>{props.thinking.level}</option> : null}
          {props.thinking.levels.map(level => <option value={level.id} key={level.id}>{level.label}</option>)}
        </select> : null}
        {props.busy ? <button type="button" className="composer__primary composer__primary--stop" onClick={() => {
          if (!props.stopping && !props.stopDisabled) props.onStop();
        }} disabled={props.stopping || props.stopDisabled}>{props.stopping ? "Đang dừng…" : "Dừng"}</button>
          : <button type="submit" className="composer__primary" disabled={!sendAllowed}>Gửi</button>}
      </div>
      {changing || props.changingModel ? <span className="sr-only" role="status">Đang đổi mô hình</span> : null}
      {changeError ? <p className="composer__error" role="alert">{changeError}</p> : null}
    </div>
    <p className="composer__hint" id="composer-hint">Enter để gửi · Shift + Enter xuống dòng · Nháp giữ đến khi đóng ứng dụng.
      {props.attachmentHint ? <span className="composer__attachment-hint">{props.attachmentHint}</span> : null}
    </p>
  </form>;
}
