import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { CHROME, credentialLabel, localiseStep, type WizardStep } from "./wizard-vi";
import BrandIcon from '../BrandIcon';
import { WorkbenchIcon } from '../WorkspaceSidebar';
import { FEATURED_FAMILIES, compareProviders, providerFamily, providerLabel } from '../provider-order';
import { manage, type NativeCatalogue } from '../workbench-api';

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

type AuthOption = ManualProvider & { kind: "oauth" | "device-code"; featured: boolean };

type DetectResult = {
  candidates?: Candidate[];
  manualProviders?: ManualProvider[];
  authOptions?: AuthOption[];
  unavailableCandidates?: { id: string; label: string; detail: string; reason: string }[];
  prepareOptions?: (ManualProvider & { actionLabel?: string; website?: string })[];
  recommendedInstalls?: { id: string; label: string; hint: string; website: string }[];
  configuredModel?: string;
  setupComplete?: boolean;
  workspace?: string;
};

type AuthStatusProvider = { provider: string; displayName?: string; status: string };

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
/**
 * `wizard.next` blocks on the Gateway until the next step exists, and a browser
 * sign-in can legitimately take minutes. The Gateway already expires a provider
 * login after 25 minutes, so this is a last resort and not a user-facing limit.
 */
const SETTLE_TIMEOUT_MS = 30 * 60_000;

/**
 * The last successful detection for this Gateway connection. Re-opening the
 * screen shows it at once while a fresh scan runs; it is dropped whenever the
 * connection is lost, because a restarted Gateway may report different routes.
 */
let cachedDetect: DetectResult | null = null;

function setupCall<T = Record<string, unknown>>(method: string, params?: unknown): Promise<T> {
  const api = window.aiForBoss?.setup;
  if (!api) return Promise.reject(new Error("Cầu nối thiết lập chưa sẵn sàng."));
  return api.request(method, params) as Promise<T>;
}

function isFinished(reply: WizardReply | null): boolean {
  return reply?.done === true && reply.status === "done" && typeof reply.modelActivation?.modelRef === "string";
}

function passiveStep(step: WizardStep): boolean {
  return step.type === "progress" || (step.type === "action" && step.executor === "gateway")
    || (step.type === "note" && !step.externalUrl && !step.deviceCode);
}

function loginStep(step: WizardStep): boolean {
  return Boolean(step.externalUrl || step.deviceCode);
}

const CONNECTED_STATUSES = ["ok", "static", "expiring"];

function statusLabel(status: string): string {
  if (status === "expiring") return "sắp hết hạn";
  if (status === "expired") return "hết hạn, cần đăng nhập lại";
  if (status === "missing") return "chưa có thông tin đăng nhập";
  return "";
}

export default function ConnectScreen({ onDone, ready = true }: { onDone: () => void; ready?: boolean; initialQuery?: string }) {
  const [detect, setDetect] = useState<DetectResult | null>(() => cachedDetect);
  const [catalogue, setCatalogue] = useState<NativeCatalogue | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatusProvider[] | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [busy, setBusy] = useState(false);
  /* The Gateway restarts on activation. That pause used to be a blank screen,
     which is where people clicked again and broke a connection that worked. */
  const [restarting, setRestarting] = useState(false);
  /** Which brand the person picked. null means the dialog is still on the picker. */
  const [family, setFamily] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [secret, setSecret] = useState("");
  const [keyChoice, setKeyChoice] = useState<string | null>(null);
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

  const readAuthStatus = useCallback(async (token: number) => {
    try {
      const auth = await setupCall<{ providers?: AuthStatusProvider[] }>("models.authStatus", { refresh: false });
      if (mounted.current && token === detectGeneration.current) setAuthStatus(auth.providers ?? []);
    } catch {
      if (mounted.current && token === detectGeneration.current) setAuthStatus(null);
    }
  }, []);

  const refreshDetect = useCallback(async () => {
    if (!ready || !mounted.current) return;
    const token = ++detectGeneration.current;
    setDetectBusy(true);
    try {
      const result = await setupCall<DetectResult>("openclaw.setup.detect", {});
      if (mounted.current && token === detectGeneration.current) {
        cachedDetect = result;
        setDetect(result);
        setError(null);
        // Account state is only meaningful once a route exists; a blank machine
        // must not spend a second RPC before the user has chosen anything.
        if (result.setupComplete || result.configuredModel) void readAuthStatus(token);
        else setAuthStatus(null);
      }
    } catch (caught) {
      if (mounted.current && token === detectGeneration.current) setError(String((caught as Error)?.message ?? caught));
    } finally {
      if (mounted.current && token === detectGeneration.current) setDetectBusy(false);
    }
  }, [ready, readAuthStatus]);

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
    // It only shapes the empty layout; it never authorizes an auth flow.
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
      cachedDetect = null;
      activeSession.current = null;
      inFlight.current = false;
      opening.current = false;
      void Promise.resolve().then(() => {
        if (!active) return;
        setSession(null);
        setDetect(null);
        setAuthStatus(null);
        setAnswer("");
        setBusy(false);
        setOpeningPage(false);
        setDetectBusy(false);
      });
    }
    return () => { active = false; invalidateDetection(); };
  }, [ready, refreshDetect, invalidateDetection, invalidateFlow, clearPoll]);

  /**
   * A terminal activation receipt is a fact about what the Gateway saved, so it
   * is shown even when the flow token moved on. That happens on every OAuth
   * activation: committing the model restarts the Gateway, the screen loses
   * `ready` for a moment, and the receipt arrives after the reset. A pending
   * step, by contrast, is never resumed across that boundary.
   */
  const showReceipt = useCallback(async (reply: WizardReply) => {
    const modelRef = reply.modelActivation!.modelRef;
    let receipt = `Đã kết nối ${modelRef}. Bạn có thể bắt đầu trò chuyện; bấm Kiểm tra kết nối nếu muốn chắc chắn mô hình trả lời được.`;
    if (reply.modelActivation?.gatewayRestartRequired) setRestarting(true);
    try {
      const auth = await setupCall<{ providers?: AuthStatusProvider[] }>("models.authStatus", { refresh: false });
      if (!mounted.current) return;
      const provider = auth.providers?.find((item) => item.provider === modelRef.split("/")[0]);
      if (provider && ["missing", "expired", "error"].includes(provider.status)) {
        receipt = "Thiết lập đã lưu, nhưng tài khoản chưa sẵn sàng. Hãy kiểm tra kết nối hoặc kết nối lại tài khoản.";
      }
    } catch {
      if (!mounted.current) return;
      receipt = "Thiết lập đã hoàn tất. Chưa đọc được trạng thái tài khoản; hãy dùng Kiểm tra kết nối trước khi bắt đầu.";
    }
    activeSession.current = null;
    setRestarting(false);
    setSession(null);
    setAnswer("");
    setSecret("");
    setVerdict(receipt);
    // Catalogue discovery can be slow; the native activation receipt and
    // credential readback already let the user return to the chat.
    void refreshDetect();
  }, [refreshDetect]);

  /** Waits for the wizard to hand over a step, or to say it is finished. */
  const settle = useCallback(async (sessionId: string, first: WizardReply, token: number) => {
      const deadline = Date.now() + SETTLE_TIMEOUT_MS;
      const acknowledged = new Set<string>();
      let current: WizardReply | null = first;
      while (mounted.current) {
        if (isFinished(current)) { await showReceipt(current!); return; }
        if (!isCurrent(token)) return;
        if (current?.done === true && (current.status === "error" || current.status === "cancelled")) {
          activeSession.current = null;
          setSession(null);
          setAnswer("");
          setError(current.error ?? (current.status === "cancelled" ? "Đã huỷ trình hướng dẫn." : "Trình hướng dẫn dừng với lỗi."));
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
        if (Date.now() >= deadline) break;
        await pause();
        if (!isCurrent(token)) return;
        // status returns lifecycle only; next without an answer retrieves the
        // current native step and does not invent an answer for the user.
        current = await setupCall<WizardReply>("wizard.next", { sessionId });
      }
      if (!isCurrent(token)) return;
      activeSession.current = null;
      setSession(null);
      setError("Trình hướng dẫn không trả về bước nào trong thời gian chờ.");
      void setupCall("wizard.cancel", { sessionId }).catch(() => {});
    }, [isCurrent, pause, showReceipt]);

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
          if (mounted.current && isFinished(reply)) { await showReceipt(reply); return; }
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
  const startWithKey = (provider: ManualProvider, value: string) => {
    const sessionId = crypto.randomUUID();
    return run(sessionId, () =>
      setupCall("openclaw.setup.activate.start", {
        sessionId,
        kind: "api-key",
        authChoice: provider.id,
        apiKey: value
      })
    );
  };

  const startGuided = (provider: ManualProvider) => {
    const sessionId = crypto.randomUUID();
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

  if (session) {
    const step = session.step;
    const local = localiseStep(step);
    const login = loginStep(step);
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
          <div className="connect__origin connect__login">
            <button type="button" className="connect__primary" disabled={!ready || busy || openingPage} onClick={() => void openPage()}>
              {CHROME.openSignInPage}
            </button>
            <p>Hoàn tất đăng nhập trong trình duyệt rồi quay lại đây và bấm “{CHROME.loggedInContinue}”.</p>
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

        {passiveStep(step) ? <p role="status">{step.type === "progress" && !step.message && !local.recognised ? CHROME.waitingLogin : CHROME.working}</p> : null}
        {(step.type === "note" || step.type === "action") && !passiveStep(step) ? (
          <div className="connect__options connect__options--row">
            <button type="button" disabled={!ready || busy} onClick={() => void answerStep(true)}>
              {busy ? CHROME.working : login ? CHROME.loggedInContinue : CHROME.continue}
            </button>
          </div>
        ) : null}

        {error ? <p className="connect__error">{error}</p> : null}
      </section>
    );
  }

  const identity = (item: { id?: string; brandId?: string; modelRef?: string; kind?: string }) => item.brandId
    || item.modelRef?.split('/')[0] || item.id || item.kind || '';
  const order = (a: { id?: string; brandId?: string; modelRef?: string; kind?: string }, b: { id?: string; brandId?: string; modelRef?: string; kind?: string }) =>
    compareProviders(identity(a), identity(b));
  const candidates = (detect?.candidates ?? []).slice().sort(order);
  const authOptions = (detect?.authOptions ?? []).slice().sort((a, b) => order(a, b) || Number(b.featured) - Number(a.featured));
  const manualProviders = (detect?.manualProviders ?? []).slice().sort(order);
  const unavailable = detect?.unavailableCandidates ?? [];
  const prepareOptions = detect?.prepareOptions ?? [];
  // `detect.recommendedInstalls` is read no more (spec 0063): suggesting other
  // software to install is not the job of an account dialog.
  /**
   * Spec 0063: one brand, then at most two ways in. The three lists the core
   * returns are regrouped by provider family here; nothing is added to them and
   * a family the core never mentioned never appears (D-0022).
   */
  const familyGroups = (() => {
    const groups = new Map<string, { id: string; label: string; brandId: string;
      signIn: typeof authOptions; candidates: typeof candidates; keys: typeof manualProviders }>();
    const slot = (raw: string, label: string) => {
      const id = providerFamily(raw);
      // providerLabel echoes the input for a family it does not know, and that
      // raw id is not a name anyone should read. Fall back to what the core called it.
      const known = providerLabel(raw);
      if (!groups.has(id)) groups.set(id, { id, label: known === raw ? label : known, brandId: raw, signIn: [], candidates: [], keys: [] });
      return groups.get(id)!;
    };
    for (const option of authOptions) slot(identity(option), option.label).signIn.push(option);
    for (const item of candidates) slot(identity(item), item.label).candidates.push(item);
    for (const provider of manualProviders) slot(identity(provider), provider.groupLabel || provider.label).keys.push(provider);
    return [...groups.values()].sort((a, b) => compareProviders(a.brandId, b.brandId));
  })();
  // The four always show, in a fixed order, even where this machine has no route
  // yet: a first screen that changes shape per machine cannot be explained to
  // anyone. A brand with no route is present but not clickable, and says why.
  const featuredFamilies = FEATURED_FAMILIES.map(id => familyGroups.find(group => group.id === id)
    ?? { id, label: providerLabel(id), brandId: id, signIn: [], candidates: [], keys: [] });
  const restFamilies = familyGroups.filter(group => !FEATURED_FAMILIES.includes(group.id));
  const chosen = familyGroups.find(group => group.id === family) ?? null;
  const keyProvider = chosen ? (chosen.keys.find(provider => provider.id === keyChoice) ?? chosen.keys[0] ?? null) : null;
  const keyFamily = keyProvider ? providerFamily(identity(keyProvider)) : '';
  const hasChoices = candidates.length + authOptions.length + manualProviders.length > 0;
  const scanning = detectBusy && !detect;
  // Before the first scan answers, the shipped package list shapes the layout so
  // the page is never blank. Nothing here is clickable: only the Gateway decides
  // which of these routes exist on this machine.
  const placeholderMethods = !detect && !error ? (catalogue?.authMethods ?? []).filter(method => method.scopes.includes('text-inference')) : [];
  const placeholderSignIn = placeholderMethods.filter(method => method.guidedAuth || method.guidedSecret)
    .sort((a, b) => compareProviders(a.provider, b.provider)).slice(0, FEATURED_FAMILIES.length);
  const connectedAccounts = (authStatus ?? []).filter(item => item.status !== 'missing');
  const currentModel = detect?.configuredModel;
  const submitKey = (event: FormEvent) => {
    event.preventDefault();
    if (keyProvider && secret.trim().length > 0) void startWithKey(keyProvider, secret.trim());
  };

  return (
    /* Spec 0063: no longer a route of its own. One dialog, opened from one
       button, over whatever the person was already looking at. */
    <div className="connect-modal" role="dialog" aria-modal="true" aria-label="Thêm nhà cung cấp">
    <section className="connect connect--dialog">
      <header className="connect__header">
        <h1>Thêm nhà cung cấp</h1>
        {/* Always leavable. On a first run nothing is connected yet, and a
            screen with no way out is a trap rather than a wizard. */}
        <button type="button" onClick={leave}>
          {detect?.setupComplete ? CHROME.done : CHROME.later}
        </button>
      </header>

      {!ready ? <p className="connect__note" role="status">Đang chuẩn bị kết nối. Bạn chờ một chút nhé…</p> : null}
      {busy && !restarting ? <div className="connect__options connect__options--row"><span role="status">{CHROME.working}</span>
        <button type="button" onClick={cancel}>{CHROME.cancel}</button></div> : null}
      {restarting ? <div className="connect__restart" role="status">
        <strong>Đang khởi động lại bộ chạy</strong>
        <p>Kết nối xong rồi. Bộ chạy cần khởi động lại một lần để nhận tài khoản mới.
          Anh chị không phải làm gì, đừng bấm lại.</p>
        <progress aria-label="Đang khởi động lại bộ chạy" />
      </div> : null}

      {currentModel || connectedAccounts.length > 0 || verdict ? <div className="connect__status" role="status">
        {currentModel ? <p><strong><WorkbenchIcon name="model" />{CHROME.currentModel}: {currentModel}</strong></p> : null}
        {connectedAccounts.length > 0 ? <ul className="connect__accounts">{connectedAccounts.map(item => {
          const ok = CONNECTED_STATUSES.includes(item.status);
          const note = statusLabel(item.status);
          return <li key={item.provider} className={ok ? 'connect__account' : 'connect__account connect__account--warn'}>
            <BrandIcon id={item.provider} label={item.displayName ?? item.provider} />{item.displayName ?? item.provider}{note ? <small> · {note}</small> : null}
          </li>;
        })}</ul> : null}
        {verdict ? <p className="connect__verdict">{verdict}</p> : null}
        {currentModel ? <p className="connect__hint">Muốn đổi sang tài khoản khác thì chọn một cách kết nối bên dưới; cách mới sẽ thay cho cách hiện tại.</p> : null}
      </div> : null}

      {error ? <p className="connect__error" role="alert">{error} Bạn có thể bấm Tải lại danh sách để thử lại.</p> : null}
      {detect && !detectBusy && !hasChoices ? <p className="connect__note" role="status">
        Bộ chạy chưa trả về cách kết nối AI nào. Bấm Tải lại danh sách; nếu vẫn trống, kiểm tra Gateway trong thanh công cụ.</p> : null}

      {!chosen ? <section className="connect__pick" aria-label="Chọn nhà cung cấp">
        <p className="connect__hint">Anh chị đang dùng dịch vụ nào? Chọn một cái, bước sau chỉ còn tối đa hai cách.</p>
        {scanning && placeholderSignIn.length > 0 ? <div className="connect__options connect__options--pending" aria-hidden="true">
          {placeholderSignIn.map(method => <button key={method.id} type="button" disabled>
            <strong><BrandIcon id={method.provider} label={method.label} />{method.label}</strong><small>{CHROME.scanning}</small></button>)}
        </div> : null}
        {featuredFamilies.length > 0 ? <div className="connect__options">
          {featuredFamilies.map(group => {
            const routes = group.signIn.length + group.candidates.length + group.keys.length;
            return <button key={group.id} type="button" disabled={!ready || busy || routes === 0}
              aria-label={group.label} onClick={() => { setFamily(group.id); setError(null); }}>
              <strong><BrandIcon id={group.brandId} label={group.label} />{group.label}</strong>
              <small>{routes === 0 ? 'Bản lõi này chưa mở đường nối nào cho hãng đó'
                : group.signIn.length > 0 ? 'Đăng nhập OAuth hoặc dán API key'
                : group.candidates.length > 0 ? 'Chưa có OAuth — dùng ứng dụng đã đăng nhập trên máy'
                : 'Dán API key'}</small>
            </button>;
          })}
        </div> : null}
        {restFamilies.length > 0 ? <details className="connect__more">
          <summary>Xem toàn bộ danh mục lõi ({restFamilies.length})</summary>
          <div className="connect__options">
            {restFamilies.map(group => <button key={group.id} type="button" disabled={!ready || busy}
              aria-label={group.label} onClick={() => { setFamily(group.id); setError(null); }}>
              <strong><BrandIcon id={group.brandId} label={group.label} />{group.label}</strong>
              <small>{group.signIn.length > 0 ? 'Đăng nhập OAuth' : group.candidates.length > 0 ? 'Nối qua ứng dụng trên máy' : 'Dán API key'}</small>
            </button>)}
          </div>
        </details> : null}
        {/* The scan can take half a minute; saying so beats an empty box. The
            placeholder cards already say it, so do not say it twice. */}
        {detectBusy && placeholderSignIn.length === 0 ? <p className="connect__note" role="status">{CHROME.scanning}</p> : null}
        {detect && !detectBusy && !hasChoices ? <p className="connect__note">Bộ chạy chưa trả về nhà cung cấp nào.</p> : null}
      </section> : null}

      {chosen ? <section className="connect__paths" aria-label={chosen.label}>
        <div className="connect__paths-head">
          <button type="button" onClick={() => { setFamily(null); setError(null); setSecret(''); }}>← Chọn dịch vụ khác</button>
          <h2><BrandIcon id={chosen.brandId} label={chosen.label} />{chosen.label}</h2>
        </div>

        {/* Two ways in, no more: sign in, or paste a key. Where the core opens no
            browser sign-in for this brand — Antigravity, for one — the app already
            signed in on this machine takes that slot instead of leaving a gap. */}
        <p className="connect__hint">{chosen.signIn.length > 0
          ? 'Hai cách: đăng nhập OAuth, hoặc dán API key.'
          : chosen.candidates.length > 0
            ? 'Hãng này không có đăng nhập OAuth. Dùng ứng dụng đã đăng nhập sẵn trên máy, hoặc dán API key.'
            : 'Hãng này chỉ nhận API key.'}</p>

        {chosen.candidates.length > 0 ? <div className="connect__options">
          {chosen.candidates.map(candidate => <button key={candidate.kind + candidate.modelRef + candidate.label}
            type="button" disabled={!ready || busy}
            /* The spoken name must be the name on the button, or the two disagree. */
            aria-label={chosen.signIn.length > 0 ? `Dùng ${candidate.label} đã đăng nhập trên máy` : `Nối qua ${candidate.label} trên máy`}
            onClick={() => void startCandidate(candidate)}>
            <strong><BrandIcon id={candidate.brandId || candidate.kind} label={candidate.label} />{chosen.signIn.length > 0 ? `Dùng ${candidate.label} đã đăng nhập trên máy` : `Nối qua ${candidate.label} trên máy`}</strong>
            <small>{candidate.detail}{candidate.modelRef ? ` · ${candidate.modelRef}` : ''}</small>
          </button>)}
        </div> : null}

        {chosen.signIn.length > 0 ? <div className="connect__options">
          {chosen.signIn.map(option => <button key={option.id} type="button" disabled={!ready || busy}
            aria-label={chosen.signIn.length > 1 ? `Đăng nhập OAuth — ${option.label}` : 'Đăng nhập OAuth'}
            onClick={() => void startGuided(option)}>
            <strong><BrandIcon id={option.brandId || option.id} label={option.label} />Đăng nhập OAuth</strong>
            <small>{option.kind === 'device-code' ? 'Mã thiết bị' : 'Mở trang của hãng'}{option.hint ? ` · ${option.hint}` : ''}
              {chosen.signIn.length > 1 ? ` · ${option.label}` : ''}</small>
          </button>)}
        </div> : null}

        {chosen.keys.length > 0 && keyProvider ? <>
          <form className="connect__form" onSubmit={submitKey}>
            {chosen.keys.length > 1 ? <select aria-label="Cách dán khoá" value={keyProvider.id} disabled={!ready || busy}
              onChange={event => { setKeyChoice(event.target.value); setSecret(''); setError(null); }}>
              {chosen.keys.map(provider => <option key={provider.id} value={provider.id}>{provider.label}</option>)}
            </select> : null}
            <input type="password" aria-label={credentialLabel(keyProvider)} value={secret}
              placeholder={`Dán ${credentialLabel(keyProvider)}`} onChange={event => setSecret(event.target.value)}
              autoComplete="off" spellCheck={false} disabled={!ready || busy} />
            <button type="submit" disabled={!ready || busy || secret.trim().length === 0}>
              {busy ? CHROME.working : CHROME.connectWithKey}
            </button>
          </form>
          {keyProvider.hint ? <p className="connect__hint">{keyProvider.hint}</p> : null}
          {keyFamily === 'google' ? <p className="connect__hint">Gemini dùng API key Google AI Studio hoặc Vertex. Bản lõi này không mở đăng nhập Gemini CLI mới.</p> : null}
          {keyFamily === 'anthropic' && chosen.candidates.length > 0 ? <p className="connect__hint">Máy đã đăng nhập Claude Code thì dùng cách trên để khỏi trả phí API riêng.</p> : null}
          <p className="connect__note">{CHROME.pasteKeyHint}</p>
        </> : null}

        {/* Spec 0063: no box for naming the account. The core takes no label on
            `openclaw.setup.auth.start` or `openclaw.setup.activate.start`; the
            name comes back from `models.authStatus`. A field here would accept
            text and quietly drop it. */}

        {unavailable.length > 0 ? <details className="connect__more">
          <summary>Ứng dụng tìm thấy nhưng chưa dùng được ({unavailable.length})</summary>
          {unavailable.map(item => <div className="connect__origin" key={item.id}>
            <strong>{item.label}</strong><p>{item.detail || item.reason}</p>
          </div>)}
        </details> : null}
        {prepareOptions.length > 0 ? <details className="connect__more">
          <summary>Cần chuẩn bị thêm trước khi nối ({prepareOptions.length})</summary>
          {prepareOptions.map(item => <div className="connect__origin" key={item.id}>
            <strong>{item.label}</strong>{item.hint ? <p>{item.hint}</p> : null}
            {item.website ? <pre>{item.website}</pre> : null}
          </div>)}
        </details> : null}
      </section> : null}

      <div className="connect__footer">
        <button type="button" onClick={() => void refreshDetect()} disabled={!ready || busy || detectBusy}>
          {CHROME.refreshCatalogue}
        </button>
        <button type="button" onClick={verify} disabled={!ready || busy || detectBusy}>
          {busy ? CHROME.verifying : CHROME.checkNow}
        </button>
      </div>

    </section>
    </div>
  );
}
