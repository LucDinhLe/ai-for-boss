import { FormEvent, useCallback, useEffect, useState } from "react";
import { CHROME, localiseStep, type WizardStep } from "./wizard-vi";

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
  groupLabel: string;
  label: string;
  hint?: string;
};

type DetectResult = {
  candidates?: Candidate[];
  manualProviders?: ManualProvider[];
  setupComplete?: boolean;
  workspace?: string;
};

/**
 * A wizard call returns as soon as the session is running, so the reply often
 * carries no step at all. The step is read back from `wizard.status` until one
 * arrives or the session ends; treating "no step" as "finished" would end the
 * flow before the provider is ever connected.
 */
type WizardReply = {
  sessionId?: string;
  step?: WizardStep;
  done?: boolean;
  status?: string;
  error?: string;
};

type Session = { sessionId: string; step: WizardStep };

const SETTLE_POLL_MS = 700;
const SETTLE_TIMEOUT_MS = 90_000;

function setupCall<T = Record<string, unknown>>(method: string, params?: unknown): Promise<T> {
  const api = typeof window === "undefined" ? undefined : window.aiForBoss?.setup;
  if (!api) return Promise.reject(new Error("Cầu nối cài đặt chưa sẵn sàng."));
  return api.request(method, params) as Promise<T>;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function groupProviders(providers: ManualProvider[]): [string, ManualProvider[]][] {
  const groups = new Map<string, ManualProvider[]>();
  for (const provider of providers) {
    const list = groups.get(provider.groupLabel) ?? [];
    list.push(provider);
    groups.set(provider.groupLabel, list);
  }
  return [...groups.entries()];
}

function isFinished(reply: WizardReply | null): boolean {
  return reply?.done === true || reply?.status === "done" || reply?.status === "completed";
}

export default function ConnectScreen({ onDone }: { onDone: () => void }) {
  const [detect, setDetect] = useState<DetectResult | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [keyPrompt, setKeyPrompt] = useState<ManualProvider | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");

  const refreshDetect = useCallback(async () => {
    try {
      const result = await setupCall<DetectResult>("openclaw.setup.detect", {});
      setDetect(result);
      setError(null);
    } catch (caught) {
      setError(String((caught as Error)?.message ?? caught));
    }
  }, []);

  useEffect(() => {
    let active = true;
    setupCall<DetectResult>("openclaw.setup.detect", {}).then(
      (result) => {
        if (active) setDetect(result);
      },
      (caught) => {
        if (active) setError(String((caught as Error)?.message ?? caught));
      }
    );
    return () => {
      active = false;
    };
  }, []);

  /** Waits for the wizard to hand over a step, or to say it is finished. */
  const settle = useCallback(
    async (sessionId: string, first: WizardReply) => {
      const deadline = Date.now() + SETTLE_TIMEOUT_MS;
      let current: WizardReply | null = first;
      while (Date.now() < deadline) {
        if (isFinished(current)) {
          setSession(null);
          setAnswer("");
          await refreshDetect();
          return;
        }
        if (current?.step) {
          setSession({ sessionId, step: current.step });
          setAnswer("");
          return;
        }
        if (current?.status === "error") {
          setSession(null);
          setError(current.error ?? "Trình hướng dẫn dừng với lỗi.");
          return;
        }
        await sleep(SETTLE_POLL_MS);
        current = await setupCall<WizardReply>("wizard.status", { sessionId });
      }
      setSession(null);
      setError("Trình hướng dẫn không trả về bước nào trong thời gian chờ.");
    },
    [refreshDetect]
  );

  const run = useCallback(
    async (sessionId: string, work: () => Promise<WizardReply>) => {
      setBusy(true);
      setError(null);
      try {
        await settle(sessionId, await work());
      } catch (caught) {
        setError(String((caught as Error)?.message ?? caught));
      } finally {
        setBusy(false);
      }
    },
    [settle]
  );

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

  const cancel = async () => {
    if (session?.sessionId) await setupCall("wizard.cancel", { sessionId: session.sessionId }).catch(() => {});
    setSession(null);
    setKeyPrompt(null);
    setAnswer("");
    setError(null);
  };

  const verify = async () => {
    setBusy(true);
    setVerdict(null);
    try {
      const result = await setupCall<{ ok?: boolean; latencyMs?: number; status?: string; error?: string }>(
        "openclaw.setup.verify",
        {}
      );
      setVerdict(
        result?.ok
          ? `${CHROME.verified} · ${Math.round(result.latencyMs ?? 0)} ms`
          : `${CHROME.verifyFailed} · ${result?.status ?? ""} ${result?.error ?? ""}`.trim()
      );
      if (result?.ok) onDone();
    } catch (caught) {
      setVerdict(`${CHROME.verifyFailed} · ${String((caught as Error)?.message ?? caught)}`);
    } finally {
      setBusy(false);
    }
  };

  if (keyPrompt) {
    const submitKey = (event: FormEvent) => {
      event.preventDefault();
      if (answer.trim().length > 0) void startWithKey(keyPrompt, answer.trim());
    };

    return (
      <section className="connect">
        <header className="connect__header">
          <h1>{keyPrompt.label}</h1>
          <button type="button" onClick={cancel} disabled={busy}>
            {CHROME.cancel}
          </button>
        </header>

        <p className="connect__lead">{CHROME.pasteKeyHint}</p>
        {keyPrompt.hint ? <p className="connect__hint">{keyPrompt.hint}</p> : null}

        <form className="connect__form" onSubmit={submitKey}>
          <input
            type="password"
            value={answer}
            placeholder={CHROME.pasteKey}
            onChange={(event) => setAnswer(event.target.value)}
            autoFocus
          />
          <button type="submit" disabled={busy || answer.trim().length === 0}>
            {busy ? CHROME.working : CHROME.connectWithKey}
          </button>
        </form>

        <div className="connect__options connect__options--row">
          <button type="button" disabled={busy} onClick={() => void startGuided(keyPrompt)}>
            {CHROME.signInBrowser}
          </button>
        </div>

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
          <button type="button" onClick={cancel} disabled={busy}>
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

        {step.type === "select" || step.type === "multiselect" ? (
          <div className="connect__options">
            {(step.options ?? []).map((option) => (
              <button
                key={String(option.value)}
                type="button"
                disabled={busy}
                onClick={() => void answerStep(option.value)}
              >
                <strong>{option.label}</strong>
                {option.hint ? <small>{option.hint}</small> : null}
              </button>
            ))}
          </div>
        ) : null}

        {step.type === "text" ? (
          <form className="connect__form" onSubmit={submitText}>
            <input
              type={step.secret ? "password" : "text"}
              value={answer}
              placeholder={step.placeholder ?? ""}
              onChange={(event) => setAnswer(event.target.value)}
              autoFocus
            />
            <button type="submit" disabled={busy || answer.trim().length === 0}>
              {CHROME.continue}
            </button>
          </form>
        ) : null}

        {step.type === "confirm" ? (
          <div className="connect__options connect__options--row">
            <button type="button" disabled={busy} onClick={() => void answerStep(true)}>
              {CHROME.agree}
            </button>
            <button type="button" disabled={busy} onClick={() => void answerStep(false)}>
              {CHROME.decline}
            </button>
          </div>
        ) : null}

        {step.type === "note" || step.type === "progress" || step.type === "action" ? (
          <div className="connect__options connect__options--row">
            <button type="button" disabled={busy} onClick={() => void answerStep(true)}>
              {busy ? CHROME.working : CHROME.continue}
            </button>
          </div>
        ) : null}

        {error ? <p className="connect__error">{error}</p> : null}
      </section>
    );
  }

  const candidates = detect?.candidates ?? [];
  const groups = groupProviders(detect?.manualProviders ?? []);

  return (
    <section className="connect">
      <header className="connect__header">
        <h1>Kết nối model</h1>
        {detect?.setupComplete ? (
          <button type="button" onClick={onDone}>
            Xong
          </button>
        ) : null}
      </header>

      <p className="connect__lead">
        Danh sách dưới đây do chính OpenClaw cung cấp, nên nhà cung cấp nào lõi hỗ trợ thì đều xuất hiện ở đây.
      </p>

      {candidates.length > 0 ? (
        <>
          <h2>{CHROME.detected}</h2>
          <p className="connect__hint">{CHROME.detectedHint}</p>
          <div className="connect__options">
            {candidates.map((candidate) => (
              <button key={candidate.kind + candidate.label} type="button" disabled={busy} onClick={() => void startCandidate(candidate)}>
                <strong>{candidate.label}</strong>
                <small>{candidate.detail}</small>
              </button>
            ))}
          </div>
        </>
      ) : null}

      <h2>{CHROME.allProviders}</h2>
      <div className="connect__groups">
        {groups.map(([group, providers]) => (
          <div key={group} className="connect__group">
            <h3>{group}</h3>
            {providers.map((provider) => (
              <button
                key={provider.id}
                type="button"
                disabled={busy}
                onClick={() => {
                  setAnswer("");
                  setError(null);
                  setKeyPrompt(provider);
                }}
              >
                <strong>{provider.label}</strong>
                {provider.hint ? <small>{provider.hint}</small> : null}
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className="connect__footer">
        <button type="button" onClick={verify} disabled={busy}>
          {busy ? CHROME.verifying : "Kiểm tra kết nối"}
        </button>
        {verdict ? <span className="connect__verdict">{verdict}</span> : null}
      </div>

      {error ? <p className="connect__error">{error}</p> : null}
    </section>
  );
}
