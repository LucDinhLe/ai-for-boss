import type { ChatAttachment } from "./chat-attachments";

type Draft = Readonly<{ text: string; revision: number; attachments: readonly ChatAttachment[] }>;

/** Renderer memory only: drafts never enter a profile or browser storage. */
export function createSessionDraftStore() {
  const entries = new Map<string, Draft>();
  const empty: Draft = Object.freeze({ text: "", revision: 0, attachments: Object.freeze([]) });
  const read = (key: string): Draft => entries.get(key) ?? empty;
  const save = (key: string, draft: Draft): Draft => {
    const next = Object.freeze({ ...draft, attachments: Object.freeze(draft.attachments.map((file) => Object.freeze({ ...file }))) });
    entries.set(key, next);
    return next;
  };
  const write = (key: string, text: string): Draft => {
    const current = read(key);
    return save(key, { ...current, text, revision: current.revision + 1 });
  };
  const finishFile = (key: string, id: string, patch: Partial<ChatAttachment>): boolean => {
    const current = read(key);
    if (!current.attachments.some((file) => file.id === id && file.status === "reading")) return false;
    save(key, { ...current, attachments: current.attachments.map((file) => file.id === id ? { ...file, ...patch } : file) });
    return true;
  };
  return {
    read,
    write,
    forget(key: string): void { entries.delete(key); },
    beginFiles(key: string, files: readonly ChatAttachment[]): Draft {
      const current = read(key), ids = new Set(current.attachments.map((file) => file.id));
      for (const file of files) {
        if (!file.id || ids.has(file.id) || file.status !== "reading") throw new Error("Không tạo được lượt đọc tệp.");
        ids.add(file.id);
      }
      return save(key, { ...current, attachments: [...current.attachments, ...files] });
    },
    completeFile(key: string, id: string, content: string, extractedText?: string): boolean {
      return finishFile(key, id, { status: "ready", content, extractedText, error: undefined });
    },
    failFile(key: string, id: string, error: string): boolean {
      return finishFile(key, id, { status: "error", content: undefined, extractedText: undefined, error });
    },
    removeFile(key: string, id: string): boolean {
      const current = read(key);
      if (!current.attachments.some((file) => file.id === id)) return false;
      save(key, { ...current, attachments: current.attachments.filter((file) => file.id !== id) });
      return true;
    },
    acknowledge(key: string, revision: number, attachmentIds: readonly string[] = []): boolean {
      const current = read(key), clearText = current.revision === revision;
      const sentIds = new Set(attachmentIds);
      save(key, { text: clearText ? "" : current.text, revision: current.revision + (clearText ? 1 : 0),
        attachments: current.attachments.filter((file) => !sentIds.has(file.id)) });
      return clearText;
    }
  };
}

type ComposerKeyEvent = {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  repeat: boolean;
  keyCode?: number;
  isComposing?: boolean;
  nativeEvent?: { isComposing?: boolean; keyCode?: number };
  preventDefault(): void;
  currentTarget: { form: { requestSubmit(): void } | null };
};

/** Enter sends through the form gate; Shift+Enter and IME retain text entry. */
export function handleComposerKeyDown(event: ComposerKeyEvent, canSubmit: boolean): void {
  if (event.key !== "Enter" || event.altKey || event.shiftKey || event.repeat
    || event.isComposing || event.nativeEvent?.isComposing || event.keyCode === 229 || event.nativeEvent?.keyCode === 229) return;
  event.preventDefault();
  if (canSubmit) event.currentTarget.form?.requestSubmit();
}
