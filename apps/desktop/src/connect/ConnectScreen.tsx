import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { CHROME, credentialLabel, localiseStep, type WizardStep } from "./wizard-vi";
import BrandIcon from '../BrandIcon';
import { WorkbenchIcon } from '../WorkspaceSidebar';
import { compareProviders, providerFamily, providerLabel, providerSearchText } from '../provider-order';
import { manage, type NativeCatalogue, type NativeAuthMethod } from '../workbench-api';

type Candidate = {
  kind: string;
  label: string;
  detail: string;
  modelRef?: string;
  recommended?: boolean;
  credentials?: boolean;
  brandId?: string;
};

type ManualProvider = {
  id: string;
  brandId?: string;
  groupLabel?: string;
  label: string;
  hint?: string;
};

type DetectResult = {
  candidates?: Candidate[];
  manualProviders?: ManualProvider[];
  authOptions?: (ManualProvider & { kind: "oauth" | "device-code"; featured: boolean })[];
  unavailableCandidates?: { id: string; label: string; detail: string; reason: string }[];
  prepareOptions?: (ManualProvider & { actionLabel?: string; website?: string })[];
  recommendedInstalls?: { id: string; label: string; hint: string; website: string }[];
  setupComplete?: boolean;
  workspace?: string;
};

/**
 * A wizard call returns as soon as the session is running, so the reply often
 * carries no step at all. The step is read back from `wizard.next` until one
 * arrives or the session ends; treating "no step" as "finished" would end the
 * flow before the provider is ever connected.
 */
type WizardReply = {
  sessionId?: string;
  step?: WizardStep;
  done?: boolean;
  status?: string;
  error?: string;
  modelActivation?: { modelRef: string; gatewayRestartRequired?: boolean };
};

type Session = { sessionId: string; step: WizardStep };

const SETTLE_POLL_MS = 700;
const SETTLE_TIMEOUT_MS = 90_000;

function setupCall<T = Record<string, unknown>>(method: string, params?: unknown): Promise<T> {
  const api = typeof window === "undefined" ? undefined : window.aiForBoss?.setup;
  if (!api) return Promise.reject(new Error("Cầu nối cài đặt chưa sẵn sàng."));
  return api.request(method, params) as Promise<T>;
}

function groupProviders(providers: ManualProvider[]): [string, ManualProvider[]][] {
  const groups = new Map<string, ManualProvider[]>();
  for (const provider of providers) {
    const group = provider.groupLabel ?? "Nhà cung cấp";
    const list = groups.get(group) ?? [];
    list.push(provider);
    groups.set(group, list);
  }
  return [...groups.entries()];
}

function isFinished(reply: WizardReply | null): boolean {
  return reply?.done === true && reply.status === "done" && typeof reply.modelActivation?.modelRef === "string";
}

function passiveStep(step: WizardStep): boolean {
  return step.type === "progress" || (step.type === "action" && step.executor === "gateway")
    || (step.type === "note" && !step.externalUrl && !step.deviceCode);
}

function methodDescription(method: NativeAuthMethod, offered: boolean): string {
  if (offered) return 'Có hướng dẫn kết nối trong danh sách phía trên.';
  if (!method.scopes.includes('text-inference')) return 'Dành cho tính năng chuyên biệt của nhà cung cấp; không phải kết nối mô hình trò chuyện.';
  if (method.method === 'cli') return 'Đăng nhập ứng dụng dòng lệnh chính thức trên máy, rồi bấm Tải lại danh sách để OpenClaw nhận kết nối.';
  if (['local', 'custom'].includes(method.method)) return 'Cần máy chủ mô hình hoặc ứng dụng cục bộ đã được thiết lập. Xem hướng dẫn của OpenClaw.';
  return method.guidedSecret || method.guidedAuth ? 'Phương thức có trong bộ chạy; cần chờ hoặc tải lại danh sách để kiểm tra có thể thiết lập trên máy này.'
    : 'OpenClaw hỗ trợ qua thiết lập nhà cung cấp. Bản lõi này chưa cung cấp biểu mẫu kết nối trực tiếp trong ứng dụng.';
}

export default function ConnectScreen({ onDone, ready = true, initialQuery = '' }: { onDone: () => void; ready?: boolean; initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [detect, setDetect] = useState<DetectResult | null>(null);
  const [catalogue, setCatalogue] = useState<NativeCatalogue | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [keyPrompt, setKeyPrompt] = useState<ManualProvider | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [selectedOptions, setSelectedOptions] = useState<number[]>([]);
  const [detectBusy, setDetectBusy] = useState(false);
  const [openingPage, setOpeningPage] = useState(false);
  const mounted = useRef(true);
  const generation = useRef(0);
  const detectGeneration = useRef(0);
  const activeSession = useRef<string | null>(null);
  const inFlight = useRef(false);
  const opening = useRef(false);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishPause = useRef<(() => void) | null>(null);
  const clearPoll = useCallback(() => {
    if (pollTimer.current !== null) clearTimeout(pollTimer.current);
    pollTimer.current = null;
    finishPause.current?.();
    finishPause.current = null;
  }, []);
  const isCurrent = useCallback((token: number) => mounted.current && generation.current === token, []);
  const openDocumentation = async (methodId: string) => {
    const token = generation.current;
    try { await manage({ action: 'provider-doc', methodId }); }
    catch (cause) { if (isCurrent(token)) setError(String((cause as Error).message)); }
  };
  const pause = useCallback(() => new Promise<void>((resolve) => {
    finishPause.current = resolve;
    pollTimer.current = setTimeout(() => {
      pollTimer.current = null;
      finishPause.current = null;
      resolve();
    }, SETTLE_POLL_MS);
  }), []);
  const invalidateDetection = useCallback(() => { ++detectGeneration.current; }, []);
  const invalidateFlow = useCallback(() => { ++generation.current; invalidateDetection(); }, [invalidateDetection]);

  const refreshDetect = useCallback(async () => {
    if (!ready || !mounted.current) return;
    const token = ++detectGeneration.current;
    setDetectBusy(true);
    try {
      const result = await setupCall<DetectResult>("openclaw.setup.detect", {});
      if (mounted.current && token === detectGeneration.current) { setDetect(result); setError(null); }
    } catch (caught) {
      if (mounted.current && token === detectGeneration.current) setError(String((caught as Error)?.message ?? caught));
    } finally {
      if (mounted.current && token === detectGeneration.current) setDetectBusy(false);
    }
  }, [ready]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      invalidateFlow();
      clearPoll();
      const sessionId = activeSession.current;
      activeSession.current = null;
      if (sessionId) void setupCall("wizard.cancel", { sessionId }).catch(() => {});
    };
  }, [clearPoll, invalidateFlow]);

  useEffect(() => {
    let active = true;
    // Package metadata is available without the slower native account scan.
    // These names only filter the list; they never authorize an auth flow.
    void manage<NativeCatalogue>({ action: 'catalog' }).then(result => {
      if (active) setCatalogue(result);
    }).catch(() => { /* Live detection owns the actionable choices and error. */ });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    if (ready) void Promise.resolve().then(() => { if (active) void refreshDetect(); });
    else {
      // A reconnected Gateway may no longer own the previous wizard. Never
      // restore a stale prompt or resubmit its answer after connection loss.
      invalidateFlow();
      clearPoll();
      activeSession.current = null;
      inFlight.current = false;
      opening.current = false;
      void Promise.resolve().then(() => {
        if (!active) return;
        setSession(null);
        setDetect(null);
        setKeyPrompt(null);
        setAnswer("");
        setBusy(false);
        setOpeningPage(false);
        setDetectBusy(false);
        setVerdict(null);
      });
    }
    return () => { active = false; invalidateDetection(); };
  }, [ready, refreshDetect, invalidateDetection, invalidateFlow, clearPoll]);

  /** Waits for the wizard to hand over a step, or to say it is finished. */
  const settle = useCallback(async (sessionId: string, first: WizardReply, token: number) => {
      const deadline = Date.now() + SETTLE_TIMEOUT_MS;
      const acknowledged = new Set<string>();
      let current: WizardReply | null = first;
      while (isCurrent(token) && Date.now() < deadline) {
        if (current?.done === true && (current.status === "error" || current.status === "cancelled")) {
          activeSession.current = null;
          setSession(null);
          setAnswer("");
          setError(current.error ?? (current.status === "cancelled" ? "Đã huỷ trình hướng dẫn." : "Trình hướng dẫn dừng với lỗi."));
          return;
        }
        if (isFinished(current)) {
          const modelRef = current!.modelActivation!.modelRef;
          let receipt = `Đã lưu thiết lập ${modelRef}. Bấm Kiểm tra kết nối để xác nhận mô hình trả lời được.`;
          try {
            const auth = await setupCall<{ providers?: { provider: string; status: string }[] }>("models.authStatus", { refresh: false });
            if (!isCurrent(token)) return;
            const provider = auth.providers?.find((item) => item.provider === modelRef.split("/")[0]);
            if (provider && ["missing", "expired", "error"].includes(provider.status)) {
              receipt = "Thiết lập đã lưu, nhưng tài khoản chưa sẵn sàng. Hãy kiểm tra kết nối hoặc kết nối lại tài khoản.";
            }
          } catch {
            if (!isCurrent(token)) return;
            receipt = "Thiết lập đã hoàn tất. Chưa đọc được trạng thái tài khoản; hãy dùng Kiểm tra kết nối trước khi bắt đầu.";
          }
          if (!isCurrent(token)) return;
          activeSession.current = null;
          setSession(null);
          setAnswer("");
          setVerdict(receipt);
          // Catalogue discovery can be slow; the native activation receipt and
          // credential readback already let the user return to the chat.
          void refreshDetect();
          return;
        }
        if (current?.done === true) {
          throw new Error("Trình hướng dẫn đã kết thúc nhưng chưa xác nhận mô hình được kích hoạt. Hãy kiểm tra kết nối trước khi thử lại.");
        }
        if (current?.step) {
          setSession({ sessionId, step: current.step });
          setAnswer(typeof current.step.initialValue === "string" ? current.step.initialValue : "");
          const initial = Array.isArray(current.step.initialValue) ? current.step.initialValue : [];
          setSelectedOptions((current.step.options ?? []).flatMap((option, index) => initial.some((value) =>
            JSON.stringify(value) === JSON.stringify(option.value)) ? [index] : []));
          if (!passiveStep(current.step)) return;
          if (current.step.type === "note" && !acknowledged.has(current.step.id)) {
            // Native informational notes await an acknowledgement; they carry
            // no decision. Login handoffs and client actions remain explicit.
            acknowledged.add(current.step.id);
            current = await setupCall<WizardReply>("wizard.next", { sessionId,
              answer: { stepId: current.step.id, value: true } });
            continue;
          }
        }
        await pause();
        if (!mounted.current || token !== generation.current) return;
        // status returns lifecycle only; next without an answer retrieves the
        // current native step and does not invent an answer for the user.
        current = await setupCall<WizardReply>("wizard.next", { sessionId });
      }
      if (!mounted.current || token !== generation.current) return;
      activeSession.current = null;
      setSession(null);
      setError("Trình hướng dẫn không trả về bước nào trong thời gian chờ.");
      void setupCall("wizard.cancel", { sessionId }).catch(() => {});
    }, [isCurrent, pause, refreshDetect]);

  const run = async (sessionId: string, work: () => Promise<WizardReply>) => {
      if (!ready || inFlight.current || !mounted.current) return;
      const token = ++generation.current;
      ++detectGeneration.current;
      setDetectBusy(false);
      activeSession.current = sessionId;
      inFlight.current = true;
      setBusy(true);
      setError(null);
      setVerdict(null);
      try {
        const reply = await work();
        if (!isCurrent(token)) {
          // A cancelled start may finish creating its native wizard later.
          // Close that exact late session; never resume its UI or auth flow.
          void setupCall("wizard.cancel", { sessionId }).catch(() => {});
          return;
        }
        await settle(sessionId, reply, token);
      } catch (caught) {
        if (isCurrent(token)) {
          setError(String((caught as Error)?.message ?? caught));
          activeSession.current = null;
          setSession(null);
          setAnswer("");
          void setupCall("wizard.cancel", { sessionId }).catch(() => {});
        }
      } finally {
        if (isCurrent(token)) { inFlight.current = false; setBusy(false); }
      }
    };

  const startCandidate = (candidate: Candidate) => {
    const sessionId = crypto.randomUUID();
    return run(sessionId, () =>
      setupCall("openclaw.setup.activate.start", {
        kind: candidate.kind,
        sessionId,
        modelRef: candidate.modelRef
      })
    );
  };

  /**
   * Two activation shapes, and the core picks a different path for each. A
   * pasted key or token is the `api-key` activation and carries the secret up
   * front. A browser sign-in is `auth.start`, which refuses any provider that
   * only takes a pasted secret. The screen offers both and names neither
   * provider.
   */
  const startWithKey = (provider: ManualProvider, secret: string) => {
    const sessionId = crypto.randomUUID();
    setKeyPrompt(null);
    setAnswer("");
    return run(sessionId, () =>
      setupCall("openclaw.setup.activate.start", {
        sessionId,
        kind: "api-key",
        authChoice: provider.id,
        apiKey: secret
      })
    );
  };

  const startGuided = (provider: ManualProvider) => {
    const sessionId = crypto.randomUUID();
    setKeyPrompt(null);
    return run(sessionId, () => setupCall("openclaw.setup.auth.start", { sessionId, authChoice: provider.id }));
  };

  const answerStep = (value: unknown) => {
    if (!session) return Promise.resolve();
    return run(session.sessionId, () =>
      setupCall("wizard.next", { sessionId: session.sessionId, answer: { stepId: session.step.id, value } })
    );
  };

  const cancel = () => {
    ++generation.current;
    ++detectGeneration.current;
    clearPoll();
    const sessionId = activeSession.current;
    activeSession.current = null;
    inFlight.current = false;
    opening.current = false;
    setBusy(false);
    setDetectBusy(false);
    setOpeningPage(false);
    setSession(null);
    setKeyPrompt(null);
    setAnswer("");
    setError(null);
    if (sessionId) void setupCall("wizard.cancel", { sessionId }).catch(() => {});
  };

  const leave = () => { cancel(); onDone(); };
  const openPage = async () => {
    if (!ready || busy || opening.current || !session || session.sessionId !== activeSession.current) return;
    const token = generation.current;
    opening.current = true;
    setOpeningPage(true);
    try {
      const opened = await window.aiForBoss?.setup.openPage(session.sessionId);
      if (isCurrent(token) && !opened) setError("Chưa mở được trang đăng nhập. Bạn có thể sao chép đường dẫn bên dưới vào trình duyệt.");
    } catch {
      if (isCurrent(token)) setError("Chưa mở được trang đăng nhập. Bạn có thể sao chép đường dẫn bên dưới vào trình duyệt.");
    } finally {
      if (isCurrent(token)) { opening.current = false; setOpeningPage(false); }
    }
  };

  const verify = async () => {
    if (!ready || inFlight.current) return;
    const token = ++generation.current;
    inFlight.current = true;
    setBusy(true);
    setVerdict(null);
    try {
      const result = await setupCall<{ ok?: boolean; latencyMs?: number; status?: string; error?: string }>(
        "openclaw.setup.verify",
        {}
      );
      if (!isCurrent(token)) return;
      setVerdict(
        result?.ok
          ? `${CHROME.verified} · ${Math.round(result.latencyMs ?? 0)} ms`
          : `${CHROME.verifyFailed} · ${result?.status ?? ""} ${result?.error ?? ""}`.trim()
      );
      if (result?.ok) onDone();
    } catch (caught) {
      if (isCurrent(token)) setVerdict(`${CHROME.verifyFailed} · ${String((caught as Error)?.message ?? caught)}`);
    } finally {
      if (isCurrent(token)) { inFlight.current = false; setBusy(false); }
    }
  };

  if (keyPrompt) {
    const secretLabel = credentialLabel(keyPrompt);
    const submitKey = (event: FormEvent) => {
      event.preventDefault();
      if (answer.trim().length > 0) void startWithKey(keyPrompt, answer.trim());
    };

    return (
      <section className="connect">
        <header className="connect__header">
          <h1><BrandIcon id={keyPrompt.brandId || keyPrompt.id} label={keyPrompt.label} />{keyPrompt.label}</h1>
          <button type="button" onClick={cancel}>
            {CHROME.cancel}
          </button>
        </header>

        <p className="connect__lead">{CHROME.pasteKeyHint}</p>
        {keyPrompt.hint ? <p className="connect__hint">{keyPrompt.hint}</p> : null}

        <form className="connect__form" onSubmit={submitKey}>
          <input
            type="password"
            aria-label={secretLabel}
            value={answer}
            placeholder={`Dán ${secretLabel}`}
            onChange={(event) => setAnswer(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            autoFocus
          />
          <button type="submit" disabled={!ready || busy || answer.trim().length === 0}>
            {busy ? CHROME.working : CHROME.connectWithKey}
          </button>
        </form>

        {error ? <p className="connect__error">{error}</p> : null}
      </section>
    );
  }

  if (session) {
    const step = session.step;
    const local = localiseStep(step);
    const submitText = (event: FormEvent) => {
      event.preventDefault();
      void answerStep(answer);
    };

    return (
      <section className="connect">
        <header className="connect__header">
          <h1>{local.title}</h1>
          <button type="button" onClick={cancel}>
            {CHROME.cancel}
          </button>
        </header>

        {local.recognised ? <p className="connect__lead">{local.message}</p> : null}

        {step.message ? (
          <div className={local.recognised ? "connect__origin" : "connect__origin connect__origin--primary"}>
            {local.recognised ? null : <p className="connect__note">{CHROME.unrecognised}</p>}
            <pre>{step.message}</pre>
          </div>
        ) : null}

        {step.externalUrl ? (
          <div className="connect__origin">
            <button type="button" disabled={!ready || busy || openingPage} onClick={() => void openPage()}>
              {CHROME.openSignInPage}
            </button>
            <p>Hoàn tất đăng nhập trong trình duyệt rồi quay lại đây.</p>
            <pre>{step.externalUrl}</pre>
          </div>
        ) : null}
        {step.deviceCode ? (
          <div className="connect__origin">
            <p>Mã đăng nhập: <strong>{step.deviceCode.code}</strong></p>
            {step.deviceCode.message ? <p>{step.deviceCode.message}</p> : null}
            {step.deviceCode.expiresInMinutes ? <p>Mã có hiệu lực trong {step.deviceCode.expiresInMinutes} phút.</p> : null}
          </div>
        ) : null}

        {step.type === "select" ? (
          <div className="connect__options">
            {(step.options ?? []).map((option) => (
              <button
                key={String(option.value)}
                type="button"
                disabled={!ready || busy}
                onClick={() => void answerStep(option.value)}
              >
                <strong>{option.label}</strong>
                {option.hint ? <small>{option.hint}</small> : null}
              </button>
            ))}
          </div>
        ) : null}

        {step.type === "multiselect" ? (
          <div className="connect__options">
            {(step.options ?? []).map((option, index) => (
              <label key={index}>
                <input type="checkbox" checked={selectedOptions.includes(index)} disabled={!ready || busy}
                  onChange={() => setSelectedOptions((selected) => selected.includes(index)
                    ? selected.filter((item) => item !== index) : [...selected, index])} />
                {option.label}{option.hint ? <small>{option.hint}</small> : null}
              </label>
            ))}
            <button type="button" disabled={!ready || busy} onClick={() => void answerStep(
              (step.options ?? []).filter((_option, index) => selectedOptions.includes(index)).map((option) => option.value)
            )}>{CHROME.continue}</button>
          </div>
        ) : null}

        {step.type === "text" ? (
          <form className="connect__form" onSubmit={submitText}>
            <input
              type={step.sensitive ? "password" : "text"}
              value={answer}
              placeholder={step.placeholder ?? ""}
              onChange={(event) => setAnswer(event.target.value)}
              autoFocus
            />
            <button type="submit" disabled={!ready || busy || answer.trim().length === 0}>
              {CHROME.continue}
            </button>
          </form>
        ) : null}

        {step.type === "confirm" ? (
          <div className="connect__options connect__options--row">
            <button type="button" disabled={!ready || busy} onClick={() => void answerStep(true)}>
              {CHROME.agree}
            </button>
            <button type="button" disabled={!ready || busy} onClick={() => void answerStep(false)}>
              {CHROME.decline}
            </button>
          </div>
        ) : null}

        {passiveStep(step) ? <p role="status">{CHROME.working}</p> : null}
        {(step.type === "note" || step.type === "action") && !passiveStep(step) ? (
          <div className="connect__options connect__options--row">
            <button type="button" disabled={!ready || busy} onClick={() => void answerStep(true)}>
              {busy ? CHROME.working : CHROME.continue}
            </button>
          </div>
        ) : null}

        {error ? <p className="connect__error">{error}</p> : null}
      </section>
    );
  }

  const identity = (item: { id?: string; brandId?: string; modelRef?: string; kind?: string }) => item.brandId
    || catalogue?.authMethods?.find(method => method.id === item.id)?.provider || item.modelRef?.split('/')[0] || item.id || item.kind || '';
  const order = (a: { id?: string; brandId?: string }, b: { id?: string; brandId?: string }) => compareProviders(identity(a), identity(b));
  const matches = (item: { label: string; id?: string; brandId?: string; hint?: string; detail?: string; modelRef?: string; groupLabel?: string; description?: string }) =>
    `${item.label} ${item.id ?? ''} ${item.brandId ?? ''} ${providerSearchText(identity(item))} ${item.hint ?? ''} ${item.detail ?? ''} ${item.modelRef ?? ''} ${item.groupLabel ?? ''} ${item.description ?? ''}`.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi'));
  const candidates = (detect?.candidates ?? []).filter(matches).sort(order);
  const groups = groupProviders((detect?.manualProviders ?? []).filter(matches).sort(order));
  const authOptions = (detect?.authOptions ?? []).filter(matches).sort(order);
  const unavailable = (detect?.unavailableCandidates ?? []).filter(matches);
  const prepareOptions = (detect?.prepareOptions ?? []).filter(matches);
  const recommendedInstalls = (detect?.recommendedInstalls ?? []).filter(matches);
  const methodMatches = (catalogue?.authMethods ?? []).filter(method => `${method.label} ${providerSearchText(method.provider)} ${method.provider} ${method.id} ${method.method} ${method.hint}`
    .toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi'))).sort((a, b) => compareProviders(a.provider, b.provider)
      || Number(Boolean(b.guidedAuth) || b.method === 'cli') - Number(Boolean(a.guidedAuth) || a.method === 'cli'));
  const providerIndex = [...new Set((catalogue?.providers ?? []).map(item => providerFamily(item.id)))].sort(compareProviders);
  const offeredMethods = new Set([...(detect?.authOptions ?? []), ...(detect?.manualProviders ?? []), ...(detect?.prepareOptions ?? [])].map(item => item.id));
  const hasNativeMatches = candidates.length + groups.length + authOptions.length + unavailable.length + prepareOptions.length + recommendedInstalls.length > 0;
  const hasMatches = hasNativeMatches || methodMatches.length > 0;

  return (
    <section className="connect">
      <header className="connect__header">
        <h1>Kết nối AI</h1>
        {/* Always leavable. On a first run nothing is connected yet, and a
            screen with no way out is a trap rather than a wizard. */}
        <button type="button" onClick={leave}>
          {detect?.setupComplete ? CHROME.done : CHROME.later}
        </button>
      </header>

      {!ready ? <p className="connect__note" role="status">Đang chuẩn bị kết nối. Bạn chờ một chút nhé…</p> : null}
      {busy ? <div className="connect__options connect__options--row"><span role="status">{CHROME.working}</span>
        <button type="button" onClick={cancel}>{CHROME.cancel}</button></div> : null}

      <p className="connect__lead">
        Chọn nhà cung cấp và cách kết nối: API key, token hoặc đăng nhập tài khoản. Mô hình khả dụng được xác nhận sau khi kết nối.
      </p>
      <label className="catalog-search connect__search"><WorkbenchIcon name="search" /><input type="search" aria-label="Tìm nhà cung cấp hoặc mô hình" placeholder="Tìm nhà cung cấp, tài khoản hoặc mô hình…" value={query} onChange={event => setQuery(event.target.value)} />{query && <button type="button" aria-label="Xóa tìm kiếm" onClick={() => setQuery('')}><WorkbenchIcon name="close" /></button>}</label>
      <nav className="connect__provider-index" aria-label="Chọn nhà cung cấp">
        <button type="button" aria-pressed={!query} onClick={() => setQuery('')}>Tất cả</button>
        {providerIndex.slice(0, 4).map(provider => <button type="button" key={provider} aria-pressed={query === provider} onClick={() => setQuery(provider)}>
          <BrandIcon id={provider} />{providerLabel(provider)}</button>)}
      </nav>
      {query === 'google' && <p className="connect__hint">Gemini dùng API key Google AI Studio hoặc Vertex. Bản lõi này không mở đăng nhập Gemini CLI OAuth mới.</p>}
      {query === 'anthropic' && <p className="connect__hint">Claude CLI dùng kết nối chính thức đã có trên máy. Quyền sử dụng và cách tính phí phụ thuộc tài khoản Anthropic; đăng nhập CLI không bảo đảm mọi lượt chạy dùng hạn mức thuê bao.</p>}
      {detectBusy && <p className="connect__note" role="status">Đang tìm cách kết nối và mô hình trên máy… Danh mục sẽ xuất hiện khi kiểm tra xong.</p>}
      {error ? <p className="connect__error" role="alert">{error} Bạn có thể bấm Tải lại danh sách để thử lại.</p> : null}
      {!detect && (catalogue?.providers.length ?? 0) > 0 && <section className="connect__preview" aria-label="Nhà cung cấp trong bộ chạy">
        <h2>Nhà cung cấp trong bộ chạy</h2>
        <p className="connect__hint">Chọn tên để lọc. Đang chờ danh sách phương thức kết nối thực tế; đây chưa phải tài khoản đã đăng nhập.</p>
        <div className="connect__provider-index">{catalogue!.providers.filter(matches).sort(order).map(provider => <button type="button" key={provider.id}
          onClick={() => setQuery(provider.id)}><BrandIcon id={provider.id} label={provider.label} />{provider.label}</button>)}</div>
      </section>}
      {detect && !detectBusy && (!hasMatches || !query.trim() && !hasNativeMatches) && <p className="connect__note" role="status">{query.trim()
        ? `Không tìm thấy “${query}” trong danh mục hiện tại. Xóa tìm kiếm để xem tất cả cách kết nối.`
        : 'Bộ chạy chưa trả về cách kết nối AI nào. Bấm Tải lại danh sách; nếu vẫn trống, kiểm tra Gateway trong thanh công cụ.'}</p>}

      {candidates.length > 0 ? (
        <>
          <h2>{CHROME.detected}</h2>
          <p className="connect__hint">{CHROME.detectedHint}</p>
          <div className="connect__options">
            {candidates.map((candidate) => (
              <button key={candidate.kind + candidate.modelRef + candidate.label} type="button" aria-label={candidate.label} disabled={!ready || busy} onClick={() => void startCandidate(candidate)}>
                <strong><BrandIcon id={candidate.brandId || candidate.kind} label={candidate.label} />{candidate.label}</strong>
                <small>{candidate.detail}</small>
                {candidate.modelRef && <small>Mô hình: {candidate.modelRef}</small>}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {authOptions.length > 0 ? <>
        <h2>Đăng nhập tài khoản</h2>
        <div className="connect__options">
          {authOptions.map((option) => <button key={option.id} type="button" aria-label={option.label}
            disabled={!ready || busy} onClick={() => void startGuided(option)}>
            <strong><BrandIcon id={option.brandId || option.id} label={option.label} />{option.label}</strong>
            <small>{option.kind === 'device-code' ? 'Đăng nhập tài khoản bằng mã thiết bị' : 'Đăng nhập tài khoản qua OAuth'}</small>
            {option.hint ? <small>{option.hint}</small> : null}
          </button>)}
        </div>
      </> : null}

      {groups.length > 0 && <h2>{CHROME.allProviders}</h2>}
      <div className="connect__groups">
        {groups.map(([group, providers]) => (
          <div key={group} className="connect__group">
            <h3>{group}</h3>
            {providers.map((provider) => (
              <button
                key={provider.id}
                type="button"
                disabled={!ready || busy}
                onClick={() => {
                  setAnswer("");
                  setError(null);
                  setKeyPrompt(provider);
                }}
              >
                <strong><BrandIcon id={provider.brandId || provider.id} label={provider.label} />{provider.label}</strong>
                {provider.hint ? <small>{provider.hint}</small> : null}
              </button>
            ))}
          </div>
        ))}
      </div>

      {unavailable.map((item) => <div className="connect__origin" key={item.id}>
        <strong>{item.label}</strong><p>{item.detail || item.reason}</p>
      </div>)}
      {prepareOptions.map((item) => <div className="connect__origin" key={item.id}>
        <strong>{item.label}</strong>{item.hint ? <p>{item.hint}</p> : null}
        {item.website ? <pre>{item.website}</pre> : null}
      </div>)}
      {recommendedInstalls.map((item) => <div className="connect__origin" key={item.id}>
        <strong>{item.label}</strong><p>{item.hint}</p><pre>{item.website}</pre>
      </div>)}

      {methodMatches.length > 0 && <details className="connect__method-catalogue" open={query.trim() || detect && !hasNativeMatches ? true : undefined}>
        <summary><WorkbenchIcon name="key" />Các phương thức OpenClaw hỗ trợ ({methodMatches.length})</summary>
        <p className="connect__hint">Danh mục chính thức đi cùng OpenClaw {catalogue?.version}. Phương thức kết nối khác với tài khoản đã đăng nhập và quyền dùng từng mô hình.</p>
        <div className="connect__groups">{methodMatches.map(method => <div className="connect__origin" key={`${method.pluginId}:${method.id}`}>
          <strong><BrandIcon id={method.provider} label={method.provider} />{method.label}</strong>
          <p>{method.provider} · {method.guidedAuth === 'device-code' ? 'Đăng nhập bằng mã thiết bị' : method.guidedAuth === 'oauth' ? 'Đăng nhập OAuth'
            : method.method === 'api-key' || method.guidedSecret && /api/iu.test(method.method) ? 'API key'
            : /token/iu.test(method.method) ? 'Token truy cập' : method.method === 'cli' ? 'Tài khoản ứng dụng trên máy' : method.method}</p>
          {method.hint && <p className="connect__hint">{method.hint}</p>}
          <p>{methodDescription(method, offeredMethods.has(method.id))}</p>
          {authOptions.filter(option => option.id === method.id && providerFamily(identity(option)) === providerFamily(method.provider)).map(option =>
            <button key={option.id} type="button" disabled={!ready || busy || detectBusy} onClick={() => void startGuided(option)}>Kết nối bằng {method.guidedAuth === 'device-code' ? 'mã thiết bị' : 'OAuth'}</button>)}
          {(detect?.manualProviders ?? []).filter(option => option.id === method.id && providerFamily(identity(option)) === providerFamily(method.provider)).map(option =>
            <button key={option.id} type="button" disabled={!ready || busy || detectBusy} onClick={() => { setAnswer(''); setError(null); setKeyPrompt(option); }}>Nhập {credentialLabel(option)}</button>)}
          <button type="button" onClick={() => void openDocumentation(method.id)}><WorkbenchIcon name="web" />Tài liệu OpenClaw: {method.provider}</button>
        </div>)}</div>
      </details>}

      <div className="connect__footer">
        <button type="button" onClick={() => void refreshDetect()} disabled={!ready || busy || detectBusy}>
          {CHROME.refreshCatalogue}
        </button>
        <button type="button" onClick={verify} disabled={!ready || busy || detectBusy}>
          {busy ? CHROME.verifying : "Kiểm tra kết nối"}
        </button>
        {verdict ? <span className="connect__verdict">{verdict}</span> : null}
      </div>

    </section>
  );
}
