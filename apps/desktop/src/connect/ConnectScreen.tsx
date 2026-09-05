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

type Session = { sessionId: string; step: WizardStep | null; done: boolean };

function setupCall<T = Record<string, unknown>>(method: string, params?: unknown): Promise<T> {
  const api = typeof window === "undefined" ? undefined : window.aiForBoss?.setup;
  if (!api) return Promise.reject(new Error("Cầu nối cài đặt chưa sẵn sàng."));
  return api.request(method, params) as Promise<T>;
}

function groupProviders(providers: ManualProvider[]): [string, ManualProvider[]][] {
  const groups = new Map<string, ManualProvider[]>();
  for (const provider of providers) {
    const list = groups.get(provider.groupLabel) ?? [];
    list.push(provider);
    groups.set(provider.groupLabel, list);
  }
  return [...groups.entries()];
}

export default function ConnectScreen({ onDone }: { onDone: () => void }) {
  const [detect, setDetect] = useState<DetectResult | null>(null);
  const [session, setSession] = useState<Session | null>(null);
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

  const applyResult = useCallback(
    (result: { sessionId?: string; step?: WizardStep; done?: boolean }) => {
      setAnswer("");
      if (result?.done || !result?.step) {
        setSession(null);
        void refreshDetect();
        return;
      }
      setSession({ sessionId: result.sessionId ?? session?.sessionId ?? "", step: result.step, done: false });
    },
    [refreshDetect, session?.sessionId]
  );

  const run = useCallback(
    async (work: () => Promise<unknown>) => {
      setBusy(true);
      setError(null);
      try {
        applyResult((await work()) as never);
      } catch (caught) {
        setError(String((caught as Error)?.message ?? caught));
      } finally {
        setBusy(false);
      }
    },
    [applyResult]
  );

  const startCandidate = (candidate: Candidate) =>
    run(() =>
      setupCall("openclaw.setup.activate.start", {
        kind: candidate.kind,
        sessionId: crypto.randomUUID(),
        modelRef: candidate.modelRef
      })
    );

  const startProvider = (provider: ManualProvider) =>
    run(() => setupCall("openclaw.setup.auth.start", { sessionId: crypto.randomUUID(), authChoice: provider.id }));

  const answerStep = (value: unknown) =>
    run(() => setupCall("wizard.next", { sessionId: session?.sessionId, answer: { stepId: session?.step?.id, value } }));

  const cancel = async () => {
    if (session?.sessionId) await setupCall("wizard.cancel", { sessionId: session.sessionId }).catch(() => {});
    setSession(null);
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

  if (session?.step) {
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
              <button key={provider.id} type="button" disabled={busy} onClick={() => void startProvider(provider)}>
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
