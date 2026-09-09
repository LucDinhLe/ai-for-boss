import { FormEvent, type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import LayoutControls from './LayoutControls';
import { useDismissMenus } from './use-dismiss-menus';
import SettingsCenter from './SettingsCenter';
import ApprovalInbox from './ApprovalInbox';
import PanelResizeHandle from './PanelResizeHandle';
import { loadLayout, saveLayout } from './layout-preferences';
import {
  call,
  getRuntimeStatus,
  retryRuntimeStartup,
  IDLE_STATUS,
  onGatewayEvent,
  onRuntimeStatus,
  readContextUsage,
  toTranscriptMessage,
  toTranscriptMessages,
  upsertTranscriptEvent,
  type ContextUsage,
  type ModelSummary,
  type RuntimeStatus,
  type SessionSummary,
  type TranscriptMessage
} from "./gateway-client";
import ConnectScreen from "./connect/ConnectScreen";
import RuntimeRecovery from "./RuntimeRecovery";
import WorkspaceGuide from "./WorkspaceGuide";
import AppInformation from "./AppInformation";

import ProjectPage from './ProjectPage';
import AgentPanel, { type AgentSummary } from './AgentPanel';
import WorkspaceControls from './WorkspaceControls';
import { supervisionRequest, type SupervisionState, type SupervisionChoice } from './supervision-api';
import Composer from "./Composer";
import SessionSkills from './SessionSkills';
import WorkspaceSidebar, { WorkbenchIcon } from "./WorkspaceSidebar";
import { thinkingStatus } from './thinking-status';
import SessionTabs from "./SessionTabs";
import NativePage from "./NativePage";
import SessionFiles from "./SessionFiles";
import DeliveredFiles from './DeliveredFiles';
import WebPanel from './WebPanel';
import MessageContent from "./MessageContent";
import ThinkingView from './ThinkingView';
import BrandMark from './BrandMark';
import { isModelActive } from './model-activity';
import ConversationDeleteDialog, { type DeleteConfirmation } from './ConversationDeleteDialog';
import { listProjects, manage, type ProjectSummary, type WorkspaceView } from "./workbench-api";
import { readSessionThinking, type SessionThinking } from "./session-thinking";

import { WORK_TEMPLATES, appendToDraft } from "./work-templates";
import { conversationTitle, workspaceStage } from "./workspace-ui";
import { acknowledgeChatRun, availableChatModels, isSelectableModel, canApplyHistory, canSendChat, newChatRun, recoverChatRun, reduceChatRun, reduceAgentProgress, selectedChatModel,
  type ChatRun } from "./chat-state";
import { createSessionDraftStore } from "./chat-drafts";
import { prepareAttachments, readAttachment, toNativeAttachments, toOriginalAttachments, type ChatAttachment } from "./chat-attachments";

function useRuntime() {
  const [status, setStatus] = useState<RuntimeStatus>(IDLE_STATUS);
  useEffect(() => {
    let active = true;
    let receivedPush = false;
    const unsubscribe = onRuntimeStatus((next) => {
      if (!active) return;
      receivedPush = true;
      setStatus(next);
    });
    getRuntimeStatus().then((initial) => {
      if (active && !receivedPush) setStatus(initial);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  useEffect(() => {
    const root = document.getElementById("root");
    if (!root) return;
    root.dataset.gatewayState = status.supervisor;
    root.dataset.gatewayConnected = String(status.connected);
    root.dataset.setupReady = String(status.setupReady);
    return () => {
      delete root.dataset.gatewayState;
      delete root.dataset.gatewayConnected;
      delete root.dataset.setupReady;
    };
  }, [status]);
  return status;
}

function App() {
  useDismissMenus();
  const [skillsBusy, setSkillsBusy] = useState(false);
  const [approvalVisible, setApprovalVisible] = useState(false);
  const skillsLock = useRef(false);
  const runtime = useRuntime();
  const [shell, setShell] = useState<ShellStatus | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [sessionProjects, setSessionProjects] = useState<Record<string, string>>({});
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [agentId, setAgentId] = useState('');
  const [supervisionChoices, setSupervisionChoices] = useState<Record<string, SupervisionChoice>>({});
  const [supervision, setSupervision] = useState<SupervisionState | null>(null);
  const [supervisionBusy, setSupervisionBusy] = useState(false);
  const supervisionLock = useRef(false);
  const [olderOffset, setOlderOffset] = useState<number | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const projectBindings = useRef<Record<string, string>>({});
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>("chat");
  const settingsReturnView = useRef<WorkspaceView>('chat');
  const [openKeys, setOpenKeys] = useState<string[]>([]);
  const [layout, setLayout] = useState(loadLayout);
  const initialLayout = useRef(layout);
  const [layoutReady, setLayoutReady] = useState(false);
  useEffect(() => {
    let active = true;
    void manage<{ layout: typeof layout | null }>({ action: 'data-layout' }).then(result => {
      if (active && result.layout) setLayout(current => current === initialLayout.current ? result.layout! : current);
    }).catch(() => {}).finally(() => { if (active) setLayoutReady(true); });
    return () => { active = false; };
  }, []);
  useEffect(() => { if (layoutReady) void manage({ action: 'data-layout', layout }).catch(() => {}); }, [layout, layoutReady]);
  const [resizingPanels, setResizingPanels] = useState(false);
  const { leftHidden, rightHidden } = layout;
  const setLeftHidden = (value: boolean) => setLayout(old => ({ ...old, leftHidden: value }));
  const setRightHidden = (value: boolean) => setLayout(old => ({ ...old, rightHidden: value }));
  useEffect(() => { saveLayout(layout); document.documentElement.dataset.theme = layout.theme; }, [layout]);
  useEffect(() => { void manage({ action: 'ui-theme', theme: layout.theme }).catch(() => {}); }, [layout.theme]);
  const initialSessionAttempted = useRef(false);
  const [dockTab, setDockTab] = useState<"files" | "web" | "thinking">("files");
  const [webFocus, setWebFocus] = useState(0);
  const openingWebLink = useRef(false);
  const openWebHandler = useRef<(url: string) => Promise<void>>(async () => {});
  const openMessageUrl = useCallback((url: string) => { void openWebHandler.current(url); }, []);
  const [browserExpanded, setBrowserExpanded] = useState(true);
  const focusAfterRender = useRef<string | null>(null);
  const [models, setModels] = useState<ModelSummary[]>([]);
  const [modelCatalogueState, setModelCatalogueState] = useState<"loading" | "ready" | "error">("loading");
  const [catalogueLoading, setCatalogueLoading] = useState(false);
  const [catalogueError, setCatalogueError] = useState<string | null>(null);
  const fullCatalogue = useRef<{ epoch: number; pending: boolean; loaded: boolean } | null>(null);
  const [advisorModels, setAdvisorModels] = useState<ModelSummary[]>([]);
  const [advisorCatalogueLoading, setAdvisorCatalogueLoading] = useState(false);
  const [advisorCatalogueError, setAdvisorCatalogueError] = useState<string | null>(null);
  const advisorCatalogueEpoch = useRef(0);
  const advisorCatalogue = useRef<{ epoch: number; pending: boolean; loaded: boolean; prepared: boolean } | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [usage, setUsage] = useState<ContextUsage>(readContextUsage(null));
  const [thinking, setThinking] = useState<SessionThinking>({ level: null, levels: [] });
  const [thinkingSelections, setThinkingSelections] = useState<Record<string, { model: string; level: string | null }>>({});
  const thinkingSelectionsRef = useRef(new Map<string, { model: string; level: string | null }>());
  const [draft, setDraftText] = useState("");
  const [attachments, setAttachments] = useState<readonly ChatAttachment[]>([]);
  const [changingModel, setChangingModel] = useState(false);
  const [historyReadyKey, setHistoryReadyKey] = useState<string | null>(null);
  const [historyErrorKey, setHistoryErrorKey] = useState<string | null>(null);
  const [run, setRun] = useState<ChatRun>(newChatRun);
  const [notice, setNotice] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmation | null>(null);
  const [deleting, setDeleting] = useState(false);
  const deletingRef = useRef(false);
  const deletingKey = useRef<string | null>(null);
  const deleteDialogOpen = useRef(false);
  const deleteReturnFocus = useRef<HTMLElement | null>(null);
  const deletePreviewEpoch = useRef(0);
  const [showConnect, setShowConnect] = useState(false);
  const [connectQuery, setConnectQuery] = useState('');
  const [showInformation, setShowInformation] = useState(false);
  const filesTabRef = useRef<HTMLButtonElement | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const activeKeyRef = useRef<string | null>(null);
  const usageRef = useRef<ContextUsage>(readContextUsage(null));
  const thinkingRef = useRef<SessionThinking>({ level: null, levels: [] });
  const modelsRef = useRef<ModelSummary[]>([]);
  const projectsEpoch = useRef(0);
  const pinning = useRef(new Set<string>());
  const changingModelRef = useRef<{ key: string } | null>(null);
  const messagesRef = useRef<TranscriptMessage[]>([]);
  const transcriptRefreshRef = useRef<{ key: string; epoch: number } | null>(null);
  const historyReadyKeyRef = useRef<string | null>(null);
  const subscribedKeyRef = useRef<string | null>(null);
  const historyRetryRef = useRef<{ key: string } | null>(null);
  const subscriptionEpoch = useRef(0);
  const drafts = useRef(createSessionDraftStore());
  const runRef = useRef<ChatRun>(newChatRun());
  const [runMessageAnchor, setRunMessageAnchor] = useState<{ runId: string; anchorId: string } | null>(null);
  const openingRef = useRef(false);
  const historyEpoch = useRef(0);
  const transcriptRevision = useRef(0);
  const rosterEpoch = useRef(0);
  const rosterLoad = useRef<{ promise: Promise<void> | null; queued: boolean }>({ promise: null, queued: false });
  const modelEpoch = useRef(0);
  const connectOffered = useRef(false);
  const failedSubmissions = useRef(new Map<string, { fingerprint: string; id: string; dispatched: boolean }>());
  type Submission = { key: string; id: string; kind: 'chat' | 'advisor'; cancelled: boolean; dispatched: boolean; previousDispatch: boolean };
  const sessionWork = useRef(new Map<string, { run: ChatRun; supervision: SupervisionState | null; ticket: number; pending: Submission | null; stopping: boolean }>());
  const [, setWorkRevision] = useState(0);
  const workFor = useCallback((key: string) => {
    let work = sessionWork.current.get(key);
    if (!work) { work = { run: newChatRun(), supervision: null, ticket: 0, pending: null, stopping: false }; sessionWork.current.set(key, work); }
    return work;
  }, []);
  const applySupervision = useCallback((key: string, value: SupervisionState | null) => {
    const work = workFor(key), wasBusy = Boolean(work.supervision?.busy);
    work.supervision = value;
    if (activeKeyRef.current !== key) {
      if (wasBusy !== Boolean(value?.busy)) setWorkRevision(revision => revision + 1);
      return;
    }
    setSupervision(value); supervisionLock.current = Boolean(value?.busy); setSupervisionBusy(Boolean(value?.busy));
  }, [workFor]);
  const busy = run.busy;
  const runState = run.state;
  const applyRun = useCallback((next: ChatRun, key = activeKeyRef.current) => {
    const wasBusy = key ? workFor(key).run.busy : false;
    if (key) workFor(key).run = next;
    if (key !== activeKeyRef.current) {
      if (wasBusy !== next.busy) setWorkRevision(revision => revision + 1);
      return;
    }
    if (next.runId !== runRef.current.runId || !next.runId) setRunMessageAnchor(null);
    runRef.current = next; setRun(next);
  }, [workFor]);
  const applyMessages = useCallback((next: TranscriptMessage[]) => { messagesRef.current = next; setMessages(next); }, []);
  const applyUsage = useCallback((next: ContextUsage) => { usageRef.current = next; setUsage(next); }, []);
  const invalidateHistory = useCallback(() => { ++historyEpoch.current; }, []);
  const invalidateSubscription = useCallback(() => { ++subscriptionEpoch.current; }, []);
  const invalidateRoster = useCallback(() => { ++rosterEpoch.current; }, []);
  const invalidateModels = useCallback(() => { ++modelEpoch.current; }, []);
  const invalidateAdvisorCatalogue = useCallback(() => { ++advisorCatalogueEpoch.current; }, []);
  const invalidateProjects = useCallback(() => { ++projectsEpoch.current; }, []);
  const setDraft = useCallback((text: string) => {
    const key = activeKeyRef.current;
    if (!key) return;
    drafts.current.write(key, text);
    setDraftText(text);
  }, []);

  const syncDraft = useCallback((key: string) => {
    if (activeKeyRef.current !== key) return;
    const current = drafts.current.read(key);
    setDraftText(current.text);
    setAttachments(current.attachments);
  }, []);

  const addFiles = useCallback((files: File[]) => {
    const key = activeKeyRef.current;
    if (!key || openingRef.current || changingModelRef.current || !runtime.connected) return;
    try {
      const policy = runtime.attachmentPolicy;
      const entries = prepareAttachments(files, policy, drafts.current.read(key).attachments);
      drafts.current.beginFiles(key, entries);
      syncDraft(key);
      setNotice(null);
      entries.forEach((entry, index) => {
        void readAttachment(files[index], entry, policy).then(async content => {
          // Keep the chip pending until Word content has actually been read.
          // A removed file or closed session must not trigger additional work.
          if (!drafts.current.read(key).attachments.some(file => file.id === entry.id && file.status === 'reading')) return;
          let extractedText: string | undefined;
          if (entry.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const document = await manage<{ text: string }>({ action: 'document-read', attachment: {
              type: 'file', fileName: entry.name, mimeType: entry.mimeType, sizeBytes: entry.sizeBytes, content
            } });
            if (typeof document.text !== 'string' || !document.text.trim()) throw new Error('Không tìm thấy văn bản đọc được trong tài liệu Word.');
            extractedText = document.text;
          }
          drafts.current.completeFile(key, entry.id, content, extractedText);
        }).catch(error => {
          const message = String((error as Error)?.message ?? error).replace(/^Error invoking remote method ['"]aifb:native-management['"]:\s*(?:Error:\s*)?/, '');
          drafts.current.failFile(key, entry.id, message);
        }).finally(() => syncDraft(key));
      });
    } catch (error) { setNotice(String((error as Error)?.message ?? error)); }
  }, [runtime.connected, runtime.attachmentPolicy, syncDraft]);

  const removeFile = useCallback((id: string) => {
    const key = activeKeyRef.current;
    if (!key) return;
    drafts.current.removeFile(key, id);
    syncDraft(key);
  }, [syncDraft]);

  useEffect(() => {
    window.aiForBoss?.getShellStatus().then(setShell).catch(() => setShell(null));
  }, []);

  const refreshSessions = useCallback(async () => {
    ++rosterEpoch.current;
    if (rosterLoad.current.promise) { rosterLoad.current.queued = true; return rosterLoad.current.promise; }
    const work = async () => {
      do {
        rosterLoad.current.queued = false;
        const epoch = rosterEpoch.current;
        try {
          const all: SessionSummary[] = [];
          for (let offset = 0; offset < 10000; offset += 100) {
            const result = await call<{ sessions?: SessionSummary[]; items?: SessionSummary[] }>('sessions.list', { limit: 100, offset, includeDerivedTitles: true, sortBy: 'updatedAt' });
            if (epoch !== rosterEpoch.current) break;
            const rows = result.sessions ?? result.items ?? [];
            all.push(...rows);
            if (rows.length < 100) break;
          }
          if (epoch === rosterEpoch.current) setSessions([...new Map(all.map(row => [row.key, row])).values()]);
        } catch (error) {
          if (epoch === rosterEpoch.current) setNotice(String((error as Error)?.message ?? error));
        }
      } while (rosterLoad.current.queued);
    };
    const pending = work();
    rosterLoad.current.promise = pending;
    try { await pending; } finally { if (rosterLoad.current.promise === pending) rosterLoad.current.promise = null; }
  }, []);

  const refreshProjects = useCallback(async () => {
    const epoch = ++projectsEpoch.current;
    try {
      const [items, local, roster] = await Promise.all([listProjects(), manage<{ projects: ProjectSummary[]; sessions: Record<string, string> }>({ action: 'project-list' }), call<{ agents: AgentSummary[]; defaultId: string }>('agents.list')]);
      if (epoch === projectsEpoch.current) {
        setProjects([...local.projects, ...items.filter(item => item.source !== 'workspace')]);
        setSessionProjects(local.sessions); projectBindings.current = local.sessions;
        setAgents(roster.agents); setAgentId(previous => previous || roster.defaultId);
      }
    } catch (error) {
      if (epoch === projectsEpoch.current) setNotice(String((error as Error)?.message ?? error));
    }
  }, []);
  useEffect(() => {
    if (!runtime.connected || !runtime.setupReady) return;
    let cancelled = false;
    void Promise.resolve().then(() => { if (!cancelled) return refreshProjects(); });
    return () => { cancelled = true; invalidateProjects(); };
  }, [runtime.connected, runtime.setupReady, refreshProjects, invalidateProjects]);

  const pinSession = useCallback(async (key: string, pinned: boolean) => {
    if (!runtime.connected || deletingRef.current || openingRef.current || changingModelRef.current || pinning.current.has(key)
      || !sessions.some(session => session.key === key)) return;
    pinning.current.add(key);
    try {
      await call("sessions.patch", { key, pinned });
      await refreshSessions();
    } catch (error) { setNotice(String((error as Error)?.message ?? error)); throw error; }
    finally { pinning.current.delete(key); }
  }, [runtime.connected, sessions, refreshSessions]);

  const loadHistory = useCallback(async (key: string, preserveAdmission = false, refreshTranscript = false) => {
    if (deletingKey.current === key || activeKeyRef.current !== key) return;
    const epoch = ++historyEpoch.current;
    while (key === activeKeyRef.current && epoch === historyEpoch.current) {
      const request = { key, epoch, revision: transcriptRevision.current };
      try {
        const history = await call<Record<string, unknown>>("chat.history", { sessionKey: key, limit: 200 });
        if (deletingKey.current === key) return;
        if (!canApplyHistory(request, activeKeyRef.current, historyEpoch.current, transcriptRevision.current)) {
          // An event can invalidate the first snapshot before it establishes run
          // ownership. Read again, one at a time, while this selection is current.
          if (key === activeKeyRef.current && epoch === historyEpoch.current
            && (historyReadyKeyRef.current !== key || refreshTranscript)) continue;
          return;
        }
        if (subscribedKeyRef.current === key) {
          historyReadyKeyRef.current = key;
          setHistoryReadyKey(key);
          setHistoryErrorKey(null);
        }
        const raw = (history.messages ?? []) as Record<string, unknown>[];
        applyMessages(toTranscriptMessages(raw, key));
        setOlderOffset(history.hasMore === true && typeof history.nextOffset === 'number' ? history.nextOffset : null);
        const nextUsage = readContextUsage(history);
        applyUsage(nextUsage);
        const nextThinking = readSessionThinking(history, nextUsage, modelsRef.current);
        thinkingRef.current = nextThinking;
        setThinking(nextThinking);
        const inFlight = history.inFlightRun as { runId?: unknown } | null | undefined;
        // A just-admitted request can precede its durable row and in-flight
        // snapshot. Only its exact run snapshot may replace that pending state.
        const admissionPending = (preserveAdmission || Boolean(workFor(key).pending)) && runRef.current.busy && runRef.current.seq < 0;
        if (!admissionPending || inFlight?.runId === runRef.current.runId) {
          const next = recoverChatRun(runRef.current, history);
          applyRun(next.terminal ? { ...next, text: "" } : next);
        }
        if (!history.inFlightRun && !runRef.current.busy && projectBindings.current[key]) {
          void manage({ action: 'project-sync', sessionKey: key }).catch(() => setNotice('Chat đã lưu ở OpenClaw nhưng chưa đồng bộ được bản xuất vào thư mục dự án.'));
        }
      } catch (error) {
        if (key === activeKeyRef.current && epoch === historyEpoch.current) {
          if (historyReadyKeyRef.current !== key) setHistoryErrorKey(key);
          setNotice(String((error as Error)?.message ?? error));
        }
      }
      return;
    }
  }, [applyRun, applyMessages, applyUsage, workFor]);

  const changeModel = useCallback(async (model: ModelSummary) => {
    const key = activeKeyRef.current;
    if (!key || !runtime.connected || !runtime.setupReady || openingRef.current || runRef.current.busy
      || changingModelRef.current || supervisionLock.current || historyReadyKeyRef.current !== key || modelCatalogueState !== "ready") return;
    const matches = models.filter(entry => entry.provider === model.provider && entry.id === model.id);
    if (matches.length !== 1 || !isSelectableModel(matches[0])) return;
    const patch = { model: model.id.startsWith(model.provider + "/") ? model.id : model.provider + "/" + model.id };
    const operation = { key };
    changingModelRef.current = operation;
    setChangingModel(true);
    ++historyEpoch.current;
    historyReadyKeyRef.current = null;
    setHistoryReadyKey(null);
    setHistoryErrorKey(null);
    setNotice(null);
    try {
      await call("sessions.patch", { key, ...patch });
    } catch (error) {
      if (activeKeyRef.current === key) setNotice(`Chưa xác nhận được lựa chọn mới. Đang kiểm tra lại trạng thái thực tế. ${String((error as Error)?.message ?? error)}`);
    } finally {
      // A missing ACK can still mean the patch succeeded. History is the truth
      // in both cases; never enable sending using an optimistic model label.
      if (changingModelRef.current === operation) {
        historyReadyKeyRef.current = null;
        setHistoryReadyKey(null);
        await loadHistory(key, true);
        changingModelRef.current = null;
        setChangingModel(false);
      }
    }
  }, [runtime.connected, runtime.setupReady, models, modelCatalogueState, loadHistory]);
  const changeThinking = useCallback(async (level: string | null) => {
    const key = activeKeyRef.current;
    if (!key || !runtime.connected || !runtime.setupReady || openingRef.current || runRef.current.busy
      || changingModelRef.current || historyReadyKeyRef.current !== key || modelCatalogueState !== "ready"
      || (level !== null && !thinkingRef.current.levels.some(option => option.id === level))) return;
    // Native sessions.send supports a per-turn override with operator.write.
    // Persistent sessions.patch(thinkingLevel) is admin-only; never send it here.
    const choice = { model: JSON.stringify([usageRef.current.modelProvider, usageRef.current.model]), level };
    thinkingSelectionsRef.current.set(key, choice);
    setThinkingSelections(values => ({ ...values, [key]: choice }));
  }, [runtime.connected, runtime.setupReady, modelCatalogueState]);

  const refreshTranscript = useCallback((key: string) => {
    // Initial history already retries stale snapshots; failures require the
    // existing explicit retry. Ready transcripts share one current event read.
    if (historyReadyKeyRef.current !== key || key !== activeKeyRef.current) return;
    const pending = transcriptRefreshRef.current;
    if (pending?.key === key && pending.epoch === historyEpoch.current) return;
    const request = { key, epoch: historyEpoch.current + 1 };
    transcriptRefreshRef.current = request;
    void loadHistory(key, true, true).finally(() => {
      if (transcriptRefreshRef.current === request) transcriptRefreshRef.current = null;
    });
  }, [loadHistory]);

  const subscribeHistory = useCallback(async (key: string) => {
    const epoch = ++subscriptionEpoch.current;
    ++historyEpoch.current;
    subscribedKeyRef.current = null;
    historyReadyKeyRef.current = null;
    setHistoryReadyKey(null);
    setHistoryErrorKey(null);
    try {
      await call("sessions.messages.subscribe", { key });
      if (key !== activeKeyRef.current || epoch !== subscriptionEpoch.current) {
        if (key !== activeKeyRef.current) void call("sessions.messages.unsubscribe", { key }).catch(() => {});
        return;
      }
      subscribedKeyRef.current = key;
      await loadHistory(key);
    } catch (error) {
      if (key === activeKeyRef.current && epoch === subscriptionEpoch.current) {
        setHistoryErrorKey(key);
        setNotice(String((error as Error)?.message ?? error));
      }
    }
  }, [loadHistory]);

  const reloadHistory = useCallback(async () => {
    const key = activeKeyRef.current;
    if (!key || !runtime.connected || historyErrorKey !== key || historyRetryRef.current?.key === key) return;
    const retry = { key };
    historyRetryRef.current = retry;
    setNotice(null);
    try { await subscribeHistory(key); }
    finally { if (historyRetryRef.current === retry) historyRetryRef.current = null; }
  }, [runtime.connected, historyErrorKey, subscribeHistory]);

  const openSession = useCallback(
    (key: string) => {
      if (deleteDialogOpen.current || openingRef.current || changingModelRef.current) return;
      setSelectedProject(projectBindings.current[key] ?? null);
      setOpenKeys(keys => keys.includes(key) ? keys : [...keys, key]);
      setWorkspaceView("chat");
      if (key === activeKeyRef.current) return;
      ++historyEpoch.current;
      ++subscriptionEpoch.current;
      subscribedKeyRef.current = null;
      historyRetryRef.current = null;
      historyReadyKeyRef.current = null;
      setHistoryReadyKey(null);
      setHistoryErrorKey(null);
      activeKeyRef.current = key;
      setActiveKey(key);
      syncDraft(key);
      applyMessages([]);
      applyUsage(readContextUsage(null));
      thinkingRef.current = { level: null, levels: [] };
      setThinking(thinkingRef.current);
      setNotice(null);
      applyRun(workFor(key).run);
      applySupervision(key, workFor(key).supervision);
      setStopping(workFor(key).stopping);
    },
    [applyRun, applyMessages, applyUsage, syncDraft, workFor, applySupervision]
  );

  // Install the listener before requesting subscription snapshots: events can
  // arrive while the Gateway is preparing a roster or history response.
  useEffect(() => {
    const unsubscribe = onGatewayEvent(({ event, payload }) => {
      if (!payload) return;
      const key = typeof payload.sessionKey === "string" ? payload.sessionKey : null;

      if (event === 'agent' && key && sessionWork.current.has(key)) {
        applyRun(reduceAgentProgress(workFor(key).run, payload, key), key);
        return;
      }

      if (event === "session.message" && key && key === activeKeyRef.current) {
        ++transcriptRevision.current;
        const update = upsertTranscriptEvent(messagesRef.current, payload, key);
        if (update.messages !== messagesRef.current) applyMessages(update.messages);
        if (update.refresh || runRef.current.terminal) refreshTranscript(key);
        return;
      }

      if (event === "chat" && key && (key === activeKeyRef.current || sessionWork.current.has(key))) {
        const snapshot = toTranscriptMessage((payload.message ?? {}) as Record<string, unknown>, "stream");
        const previous = workFor(key).run;
        const next = reduceChatRun(previous, payload, key, snapshot?.content);
        if (next === previous) return;
        applyRun(next, key);
        if (key !== activeKeyRef.current) { if (next.terminal) void refreshSessions(); return; }
        ++transcriptRevision.current;
        if (snapshot?.role === 'assistant' && snapshot.anchorId && next.runId) {
          setRunMessageAnchor({ runId: next.runId, anchorId: snapshot.anchorId });
        }
        if (next.state === "error" && typeof payload.errorMessage === "string") {
          setNotice(payload.errorMessage);
        }
        if (next.terminal || (previous.seq >= 0 && next.seq > previous.seq + 1)) {
          refreshTranscript(key);
        }
        return;
      }

      if (event === "sessions.changed") {
        void refreshSessions();
        if (key && key === activeKeyRef.current && (!runRef.current.busy || runRef.current.runId === null)) refreshTranscript(key);
      }
    });
    return unsubscribe;
  }, [applyRun, applyMessages, refreshTranscript, refreshSessions, workFor]);

  useEffect(() => {
    if (!runtime.connected) return;
    let cancelled = false;
    const epoch = ++rosterEpoch.current;
    void call<{ list?: { sessions?: SessionSummary[]; items?: SessionSummary[] } }>("sessions.subscribe", {
      limit: 30, sortBy: "updatedAt", includeDerivedTitles: true
    }).then((result) => {
      if (cancelled) return;
      if (epoch !== rosterEpoch.current) { void refreshSessions(); return; }
      if (result.list) void refreshSessions();
      else void refreshSessions();
    }).catch((error) => { if (!cancelled) setNotice(String((error as Error)?.message ?? error)); });
    // The public roster subscription ends with its WebSocket connection.
    return () => { cancelled = true; invalidateRoster(); };
  }, [runtime.connected, refreshSessions, invalidateRoster]);

  useEffect(() => {
    if (!runtime.connected || !activeKey) return;
    const key = activeKey;
    let cancelled = false;
    void Promise.resolve().then(() => { if (!cancelled) return subscribeHistory(key); });
    return () => {
      cancelled = true;
      invalidateSubscription();
      subscribedKeyRef.current = null;
      historyRetryRef.current = null;
      invalidateHistory();
      historyReadyKeyRef.current = null;
      setHistoryReadyKey(null);
      setHistoryErrorKey(null);
      void call("sessions.messages.unsubscribe", { key }).catch(() => {});
    };
  }, [activeKey, runtime.connected, subscribeHistory, invalidateHistory, invalidateSubscription]);

  const catalogueAgent = activeKey?.match(/^agent:([^:]+):/u)?.[1];
  const refreshModels = useCallback(async (offerConnect = true) => {
    const epoch = ++modelEpoch.current;
    fullCatalogue.current = null;
    setCatalogueLoading(false); setCatalogueError(null);
    setModelCatalogueState("loading");
    if (!runtime.connected) return;
    try {
      const catalogue = await call<{ models?: ModelSummary[] }>("models.list", catalogueAgent ? { agentId: catalogueAgent } : undefined);
      if (epoch !== modelEpoch.current) return;
      const next = catalogue.models ?? [];
      modelsRef.current = next;
      setModels(next);
      setModelCatalogueState("ready");
      if (offerConnect && runtime.setupReady && availableChatModels(next).length === 0 && !connectOffered.current
        && !runRef.current.busy && !openingRef.current && !changingModelRef.current) {
        connectOffered.current = true;
        setShowConnect(true);
      }
    } catch (error) {
      if (epoch === modelEpoch.current) { modelsRef.current = []; setModels([]); setModelCatalogueState("error"); setNotice(String((error as Error)?.message ?? error)); }
    }
  }, [runtime.connected, runtime.setupReady, catalogueAgent]);

  const browseModels = useCallback(async (refresh = false) => {
    if (!runtime.connected || !runtime.setupReady || modelCatalogueState !== 'ready') return;
    const epoch = modelEpoch.current;
    const previous = fullCatalogue.current;
    if (previous?.epoch === epoch && (previous.pending || (previous.loaded && !refresh))) return;
    const operation = { epoch, pending: true, loaded: false };
    fullCatalogue.current = operation;
    setCatalogueLoading(true); setCatalogueError(null);
    try {
      const result = await manage<{ models: ModelSummary[]; providerOutcomes?: { provider: string; status: string }[] }>({ action: 'model-catalogue',
        ...(catalogueAgent ? { agentId: catalogueAgent } : {}), ...(refresh ? { refresh: true } : {}) });
      if (modelEpoch.current !== epoch || fullCatalogue.current !== operation) return;
      if (!Array.isArray(result.models)) throw new Error('Invalid model catalogue response');
      modelsRef.current = result.models; setModels(result.models); operation.loaded = true;
      const incomplete = result.providerOutcomes?.filter(outcome => outcome.status !== 'ready').map(outcome => outcome.provider) ?? [];
      if (incomplete.length) setCatalogueError(`Chưa tải lại đầy đủ danh mục của ${incomplete.join(', ')}; đang giữ những mô hình lõi còn trả về.`);
    } catch {
      if (modelEpoch.current === epoch && fullCatalogue.current === operation)
        setCatalogueError('Chưa tải được danh mục đầy đủ. Anh vẫn có thể dùng các mô hình đã xác nhận.');
    } finally {
      operation.pending = false;
      if (modelEpoch.current === epoch && fullCatalogue.current === operation) setCatalogueLoading(false);
    }
  }, [runtime.connected, runtime.setupReady, modelCatalogueState, catalogueAgent]);

  // Advisor runs under the native default agent, independently of the worker's model policy.
  const browseAdvisorModels = useCallback(async (refresh = false) => {
    if (!runtime.connected || !runtime.setupReady) return;
    const epoch = advisorCatalogueEpoch.current, previous = advisorCatalogue.current;
    if (previous?.epoch === epoch && (previous.pending || (previous.loaded && !refresh))) return;
    const operation = { epoch, pending: true, loaded: false, prepared: previous?.epoch === epoch && previous.prepared };
    advisorCatalogue.current = operation;
    setAdvisorCatalogueLoading(true); setAdvisorCatalogueError(null);
    const current = () => advisorCatalogueEpoch.current === epoch && advisorCatalogue.current === operation;
    try {
      if (!operation.prepared) {
        const prepared = await call<{ models: ModelSummary[] }>('models.list');
        if (!current()) return;
        if (!Array.isArray(prepared.models)) throw new Error('Invalid Advisor catalogue response');
        setAdvisorModels(prepared.models); operation.prepared = true;
      }
      const result = await manage<{ models: ModelSummary[]; providerOutcomes?: { provider: string; status: string }[] }>({ action: 'model-catalogue',
        ...(refresh ? { refresh: true } : {}) });
      if (!current()) return;
      if (!Array.isArray(result.models)) throw new Error('Invalid Advisor catalogue response');
      setAdvisorModels(result.models); operation.loaded = true;
      const incomplete = result.providerOutcomes?.filter(outcome => outcome.status !== 'ready').map(outcome => outcome.provider) ?? [];
      if (incomplete.length) setAdvisorCatalogueError(`Chưa tải lại đầy đủ danh mục Advisor của ${incomplete.join(', ')}.`);
    } catch {
      if (current()) setAdvisorCatalogueError(operation.prepared
        ? 'Chưa tải được danh mục Advisor đầy đủ. Đang giữ các mô hình được lõi xác nhận cho Advisor.'
        : 'Chưa xác nhận được mô hình Advisor. Hãy tải lại danh mục.');
    } finally { operation.pending = false; if (current()) setAdvisorCatalogueLoading(false); }
  }, [runtime.connected, runtime.setupReady]);

  const refreshAdvisorModels = useCallback(() => {
    ++advisorCatalogueEpoch.current; advisorCatalogue.current = null;
    setAdvisorModels([]);
    return browseAdvisorModels(true);
  }, [browseAdvisorModels]);

  useEffect(() => {
    const epoch = ++advisorCatalogueEpoch.current;
    advisorCatalogue.current = null;
    void Promise.resolve().then(() => {
      if (advisorCatalogueEpoch.current !== epoch) return;
      setAdvisorModels([]); setAdvisorCatalogueLoading(false); setAdvisorCatalogueError(null);
      return browseAdvisorModels();
    });
    return invalidateAdvisorCatalogue;
  }, [browseAdvisorModels, invalidateAdvisorCatalogue]);

  useEffect(() => {
    // Native prepared rows keep chat responsive; full discovery fills every picker in the background.
    let cancelled = false;
    void Promise.resolve().then(() => { if (!cancelled) return browseModels(); });
    return () => { cancelled = true; };
  }, [browseModels]);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => { if (!cancelled) return refreshModels(); });
    return () => { cancelled = true; invalidateModels(); };
  }, [refreshModels, invalidateModels]);

  useEffect(() => {
    const node = transcriptRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, run.text, runState, workspaceView]);

  const createSession = useCallback(async (projectId: string | undefined = selectedProject ?? undefined, selectedAgent = agentId) => {
    if (deleteDialogOpen.current) return;
    const project = projectId === undefined ? undefined : projects.find(item => item.id === projectId);
    if (!runtime.connected || !runtime.setupReady || modelCatalogueState !== "ready" || availableChatModels(models).length === 0
      || openingRef.current || changingModelRef.current
      || (projectId !== undefined && !project)) return;
    openingRef.current = true;
    setOpening(true);
    setNotice(null);
    const key = `aifb-${crypto.randomUUID()}`;
    try {
      const created = project?.source === 'aifb' || (!project && selectedAgent) ? await manage<{ key: string }>({ action: project ? 'project-session' : 'agent-session', ...(projectId ? { projectId } : {}), agentId: selectedAgent, requestId: key.slice(5) }) : await call<{ key: string }>("sessions.create", {
        key,
        ...(projectId ? { projectId } : {}),
        ...((selectedAgent || project?.agentId) ? { agentId: selectedAgent || project?.agentId } : {})
      });
      if (!created.key) throw new Error("Gateway chưa trả về phiên mới.");
      if (projectId) { setSessionProjects(current => ({ ...current, [created.key]: projectId })); projectBindings.current[created.key] = projectId; }
      openingRef.current = false;
      openSession(created.key);
      void refreshSessions();
    } catch (error) {
      setNotice(String((error as Error)?.message ?? error));
    } finally {
      openingRef.current = false;
      setOpening(false);
    }
  }, [runtime.connected, runtime.setupReady, models, modelCatalogueState, projects, openSession, refreshSessions, selectedProject, agentId]);

  useEffect(() => {
    if (initialSessionAttempted.current || !runtime.connected || !runtime.setupReady || modelCatalogueState !== 'ready'
      || !availableChatModels(models).length || workspaceView !== 'chat' || showConnect) return;
    if (activeKeyRef.current) { initialSessionAttempted.current = true; return; }
    if (openingRef.current || changingModelRef.current || supervisionLock.current) return;
    initialSessionAttempted.current = true;
    // Open an empty native session, without sending a prompt or using provider credits.
    void createSession();
  }, [runtime.connected, runtime.setupReady, modelCatalogueState, models, workspaceView, showConnect, createSession]);

  const closeTab = useCallback((key: string) => {
    if (openingRef.current || changingModelRef.current) return;
    const remaining = openKeys.filter(item => item !== key);
    setOpenKeys(remaining);
    if (activeKeyRef.current !== key) return;
    if (remaining.length) { openSession(remaining.at(-1)!); return; }
    ++historyEpoch.current; ++subscriptionEpoch.current;
    activeKeyRef.current = null; setActiveKey(null);
    supervisionLock.current = false; setSupervisionBusy(false); setSupervision(null); setStopping(false);
    historyReadyKeyRef.current = null; setHistoryReadyKey(null); setHistoryErrorKey(null);
    subscribedKeyRef.current = null; historyRetryRef.current = null;
    applyMessages([]); applyRun(newChatRun()); applyUsage(readContextUsage(null));
    thinkingRef.current = { level: null, levels: [] }; setThinking(thinkingRef.current);
    setDraftText(""); setAttachments([]); setWorkspaceView("chat");
  }, [openKeys, openSession, applyMessages, applyRun, applyUsage]);

  const requestDeleteSession = useCallback(async (key: string) => {
    if (!runtime.connected || !runtime.setupReady || deletingRef.current || runRef.current.busy || supervisionLock.current
      || openingRef.current || changingModelRef.current || !sessions.some(row => row.key === key)) return;
    const epoch = ++deletePreviewEpoch.current;
    deleteReturnFocus.current = document.activeElement as HTMLElement | null;
    deleteDialogOpen.current = true;
    setDeleteConfirmation({ key, title: sessions.find(row => row.key === key)?.label || sessions.find(row => row.key === key)?.displayName || 'Cuộc trò chuyện' });
    try {
      const value = await manage<DeleteConfirmation>({ action: 'conversation-inspect', key });
      if (epoch === deletePreviewEpoch.current) setDeleteConfirmation(value);
    } catch (caught) {
      if (epoch === deletePreviewEpoch.current) setDeleteConfirmation(previous => previous ? { ...previous, error: String((caught as Error).message) } : null);
    }
  }, [runtime.connected, runtime.setupReady, sessions]);
  const cancelDeleteSession = useCallback(() => {
    if (deletingRef.current) return;
    ++deletePreviewEpoch.current; deleteDialogOpen.current = false; setDeleteConfirmation(null);
  }, []);
  const confirmDeleteSession = useCallback(async () => {
    const confirmation = deleteConfirmation;
    if (!confirmation?.ticket || deletingRef.current || !runtime.connected || !runtime.setupReady || runRef.current.busy
      || openingRef.current || changingModelRef.current || supervisionLock.current) return;
    deletingRef.current = true; deletingKey.current = confirmation.key; setDeleting(true);
    try {
      const result = await manage<{ ok: boolean; key: string; warning?: string }>({ action: 'conversation-delete', ticket: confirmation.ticket });
      if (!result.ok || result.key !== confirmation.key) throw new Error('Chưa xác nhận đã xóa. Hãy tải lại danh sách.');
      deleteDialogOpen.current = false;
      closeTab(confirmation.key);
      drafts.current.forget(confirmation.key);
      failedSubmissions.current.delete(confirmation.key);
      thinkingSelectionsRef.current.delete(confirmation.key);
      setSupervisionChoices(previous => { const next = { ...previous }; delete next[confirmation.key]; return next; });
      setSessions(previous => previous.filter(row => row.key !== confirmation.key));
      setDeleteConfirmation(null);
      setNotice(result.warning ?? 'Đã xóa cuộc trò chuyện.');
      void refreshSessions();
    } catch (caught) {
      setDeleteConfirmation(previous => previous ? { ...previous, ticket: undefined, error: String((caught as Error).message) } : null);
      void refreshSessions();
    } finally { deletingRef.current = false; deletingKey.current = null; setDeleting(false); }
  }, [deleteConfirmation, runtime.connected, runtime.setupReady, closeTab, refreshSessions]);

  const openThinking = () => {
    setRightHidden(false); setShowInformation(false); setDockTab('thinking');
    focusAfterRender.current = 'thinking-tab';
  };
  const navigateWorkspace = useCallback((view: WorkspaceView) => {
    if (view === 'settings') {
      if (workspaceView !== 'settings') settingsReturnView.current = workspaceView;
      setWorkspaceView('settings'); return;
    }
    if (openingRef.current || changingModelRef.current) return;
    if (view === 'chat') setSelectedProject(null);
    setWorkspaceView(view);
  }, [workspaceView]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (workspaceView !== 'settings' && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "n" && !event.altKey && !event.repeat) {
        event.preventDefault(); void createSession();
      }
    };
    window.addEventListener?.("keydown", keydown);
    return () => window.removeEventListener?.("keydown", keydown);
  }, [createSession, workspaceView]);

  const send = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (deleteDialogOpen.current) return;
      if (modelCatalogueState !== "ready" || supervisionLock.current || skillsLock.current) return;
      const key = activeKeyRef.current;
      if (!key || historyReadyKeyRef.current !== key) return;
      const work = workFor(key);
      const submittedModel = { id: usageRef.current.model, provider: usageRef.current.modelProvider };
      const submittedDraft = drafts.current.read(key);
      const text = submittedDraft.text.trim();
      if (openingRef.current || changingModelRef.current || submittedDraft.attachments.some(file => file.status !== "ready")
        || !canSendChat({ ...runtime, activeKey: key, busy: runRef.current.busy, text, models,
          selectedModel: usageRef.current, attachmentCount: submittedDraft.attachments.length })) return;
      let nativeAttachments, originalAttachments;
      try {
        nativeAttachments = toNativeAttachments(submittedDraft.attachments, runtime.attachmentPolicy);
        originalAttachments = toOriginalAttachments(submittedDraft.attachments, runtime.attachmentPolicy);
      }
      catch (error) { setNotice(String((error as Error)?.message ?? error)); return; }
      const preference = thinkingSelectionsRef.current.get(key);
      const override = preference?.model === JSON.stringify([usageRef.current.modelProvider, usageRef.current.model]) ? preference.level : null;
      if (override !== null && !thinkingRef.current.levels.some(option => option.id === override)) {
        setNotice("Mức suy nghĩ đã chọn không còn khả dụng. Hãy chọn lại hoặc dùng Tự động."); return;
      }
      const fingerprint = JSON.stringify([text, usageRef.current.modelProvider, usageRef.current.model, override ?? thinkingRef.current.level,
        submittedDraft.attachments.map(file => file.id)]);
      const previous = failedSubmissions.current.get(key);
      const id = previous?.fingerprint === fingerprint ? previous.id : crypto.randomUUID();
      const previousDispatch = previous?.fingerprint === fingerprint && previous.dispatched;
      const params = { key, message: text, idempotencyKey: id, ...(override !== null ? { thinking: override } : {}),
        ...(nativeAttachments.length ? { attachments: nativeAttachments } : {}) };
      // Reserve framing overhead instead of sending a base64 frame at the
      // negotiated ceiling and causing the SDK connection to be dropped.
      if (runtime.attachmentPolicy && new TextEncoder().encode(JSON.stringify(params)).byteLength + 1024 > runtime.attachmentPolicy.maxPayload) {
        setNotice("Tin nhắn và tệp vượt giới hạn của kết nối hiện tại. Hãy bớt tệp hoặc rút ngắn nội dung.");
        return;
      }
      if (supervisionChoices[key]?.enabled) {
        const choice = supervisionChoices[key];
        if (!choice.model) { setNotice('Chọn mô hình Advisor trước.'); return; }
        supervisionLock.current = true; setSupervisionBusy(true); setNotice(null);
        const ticket = ++work.ticket;
        applySupervision(key, { id, key, phase: 'working', busy: true, accepted: false, plan: '', planReview: null, finalReview: null, error: null });
        const submission = { key, id, kind: 'advisor' as const, cancelled: false, dispatched: false, previousDispatch };
        work.pending = submission;
        try {
          if (projectBindings.current[key]) await manage({ action: 'project-attachments', sessionKey: key, files: originalAttachments });
          if (submission.cancelled || work.pending !== submission || ticket !== work.ticket) return;
          submission.dispatched = true;
          const result = await supervisionRequest<SupervisionState>({ action: 'supervise', key, id, message: text,
            model: submittedModel, advisorModel: choice.model,
            attachments: nativeAttachments, ...(override ? { thinking: override } : {}) });
          if (ticket !== work.ticket) return;
          applySupervision(key, result);
          if (result.accepted) { drafts.current.acknowledge(key, submittedDraft.revision, submittedDraft.attachments.map(file => file.id)); syncDraft(key); }
          if (result.error && activeKeyRef.current === key) setNotice(result.error);
          await loadHistory(key); await refreshSessions();
          if (ticket !== work.ticket) return;
          applySupervision(key, result);
        } catch (error) {
          if (ticket !== work.ticket) return;
          if (activeKeyRef.current === key) setNotice(String((error as Error).message));
          try {
            const status = await supervisionRequest<SupervisionState | null>({ action: 'supervision-status', key });
            if (ticket !== work.ticket) return;
            applySupervision(key, status);
          } catch { if (activeKeyRef.current === key) setNotice('Chưa xác nhận trạng thái giám sát. Hãy kết nối lại rồi bấm Dừng.'); }
        } finally { if (work.pending === submission) work.pending = null; }
        return;
      }
      failedSubmissions.current.set(key, { fingerprint, id, dispatched: previousDispatch });
      const submission = { key, id, kind: 'chat' as const, cancelled: false, dispatched: false, previousDispatch };
      work.pending = submission;
      ++historyEpoch.current;
      applyRun(newChatRun(id));
      setNotice(null);
      try {
        if (projectBindings.current[key]) await manage({ action: 'project-attachments', sessionKey: key, files: originalAttachments });
        if (submission.cancelled || work.pending !== submission || work.run.runId !== id || !work.run.busy) return;
        submission.dispatched = true;
        failedSubmissions.current.set(key, { fingerprint, id, dispatched: true });
        const ack = await call("sessions.send", params);
        const cachedFailure = typeof ack.status === "string" && ["error", "timeout"].includes(ack.status.trim().toLowerCase());
        // Admission is not completion or a persisted row. Native transcript
        // events/history own displayed user messages, avoiding optimistic twins.
        if (work.run.runId === id) {
          const next = acknowledgeChatRun(work.run, id, ack);
          applyRun(next, key);
          if (next.terminal) {
            if (next.state === "error" && activeKeyRef.current === key) setNotice(typeof ack.errorMessage === "string" ? ack.errorMessage : "Lượt trước đã kết thúc với lỗi. Bạn có thể gửi lại yêu cầu.");
            void loadHistory(key);
          } else if (next.runId !== id) void loadHistory(key, true);
        }
        if (!cachedFailure) {
          drafts.current.acknowledge(key, submittedDraft.revision, submittedDraft.attachments.map(file => file.id));
          syncDraft(key);
          void refreshSessions();
        }
        if (failedSubmissions.current.get(key)?.id === id) failedSubmissions.current.delete(key);
      } catch (error) {
        if (submission.cancelled || work.run.runId !== id) return;
        if (work.run.seq < 0) applyRun({ ...work.run, busy: false, terminal: true, state: "error" }, key);
        if (activeKeyRef.current === key) setNotice(String((error as Error)?.message ?? error));
      } finally { if (work.pending === submission) work.pending = null; }
    },
    [runtime, models, modelCatalogueState, applyRun, loadHistory, syncDraft, refreshSessions, supervisionChoices, workFor, applySupervision]
  );

  const abort = useCallback(async () => {
    const key = activeKeyRef.current;
    if (!key || !runtime.connected) return;
    const work = workFor(key), submission = work.pending;
    if (work.stopping) return;
    if (submission && !submission.dispatched) {
      submission.cancelled = true; work.pending = null;
      if (!submission.previousDispatch) {
        if (submission.kind === 'advisor') { ++work.ticket; applySupervision(key, work.supervision ? { ...work.supervision, busy: false, phase: 'cancelled' } : null); }
        else { failedSubmissions.current.delete(key); applyRun({ ...work.run, busy: false, terminal: true, state: 'aborted' }, key); }
        return;
      }
      if (submission.kind === 'advisor') {
        ++work.ticket;
        applySupervision(key, work.supervision ? { ...work.supervision, busy: false, phase: 'cancelled' } : null);
      }
      applyRun({ ...work.run, runId: submission.id, busy: true, terminal: false }, key);
    }
    work.stopping = true; setStopping(true);
    try {
      if (work.supervision?.busy) {
        const ticket = work.ticket;
        const result = await supervisionRequest<{ stopped: boolean }>({ action: 'supervision-cancel', key });
        if (ticket !== work.ticket) return;
        if (result.stopped) { ++work.ticket; applySupervision(key, { ...work.supervision, busy: false, phase: 'cancelled' }); }
        else if (activeKeyRef.current === key) setNotice('Chưa xác nhận giám sát đã dừng. Hãy thử Dừng lại khi có kết nối.');
      } else {
        let runId = work.run.runId;
        if (!work.run.busy) return;
        if (!runId) {
          const previous = work.run;
          const history = await call<Record<string, unknown>>('chat.history', { sessionKey: key, limit: 1 });
          if (work.run !== previous) return;
          const recovered = recoverChatRun(previous, history);
          applyRun(recovered, key);
          if (!recovered.busy) return;
          runId = recovered.runId ?? (recovered.activeRunIds?.length === 1 ? recovered.activeRunIds[0] : null);
          if (!runId) { if (activeKeyRef.current === key) setNotice('Chưa xác định được lượt đang chạy để dừng. Hãy tải lại trạng thái rồi thử lại.'); return; }
          applyRun({ ...recovered, runId }, key);
        }
        const result = await call('chat.abort', { sessionKey: key, runId });
        if (result.aborted === false) {
          const history = await call<Record<string, unknown>>('chat.history', { sessionKey: key, limit: 1 });
          if (work.run.runId !== runId) return;
          const recovered = recoverChatRun(work.run, history);
          applyRun(recovered, key);
          if (recovered.busy && activeKeyRef.current === key) setNotice('Lõi chưa xác nhận dừng. Anh có thể thử Dừng lại hoặc chuyển sang phiên khác.');
          return;
        }
        if (failedSubmissions.current.get(key)?.id === runId) failedSubmissions.current.delete(key);
        if (work.run.runId === runId) applyRun({ ...work.run, busy: false, terminal: true, state: 'aborted' }, key);
        void loadHistory(key);
      }
    } catch (error) { if (activeKeyRef.current === key) setNotice(String((error as Error)?.message ?? error)); }
    finally { work.stopping = false; if (activeKeyRef.current === key) setStopping(false); }
  }, [runtime.connected, applyRun, loadHistory, workFor, applySupervision]);

  useEffect(() => {
    if (!runtime.connected) return;
    let active = true;
    const pending = new Set<string>();
    const pollSession = async (key: string, work: ReturnType<typeof workFor>) => {
      if (pending.has(key)) return;
      pending.add(key);
      try {
        if (work.supervision?.busy) {
          const next = await supervisionRequest<SupervisionState | null>({ action: 'supervision-status', key });
          if (active && next?.key === key && next.id === work.supervision?.id) applySupervision(key, next);
        }
        // Read activity only while busy, not 200 transcript rows every three seconds.
        // A stalled session's request must not delay another session's poll.
        if (!active || !work.run.busy || work.pending && work.run.seq < 0) return;
        const previous = work.run;
        const history = await call<Record<string, unknown>>('chat.history', { sessionKey: key, limit: 1 });
        if (!active || work.run !== previous) return;
        const next = recoverChatRun(previous, history);
        applyRun(next, key);
        if (!next.busy && activeKeyRef.current === key) void loadHistory(key);
      } catch { /* Missing evidence never grants completion. */ }
      finally { pending.delete(key); }
    };
    const timer = setInterval(() => {
      for (const [key, work] of sessionWork.current) void pollSession(key, work);
    }, 3000);
    return () => { active = false; clearInterval(timer); };
  }, [runtime.connected, applyRun, applySupervision, loadHistory, workFor]);

  const availableModels = useMemo(() => availableChatModels(models), [models]);
  const historyReady = Boolean(activeKey) && historyReadyKey === activeKey;
  const historyError = Boolean(activeKey) && historyErrorKey === activeKey;
  const modelsLoading = runtime.connected && modelCatalogueState === "loading";
  const canSubmit = modelCatalogueState === "ready" && historyReady && !opening && !changingModel
    && attachments.every(file => file.status === "ready")
    && canSendChat({ ...runtime, activeKey, busy, text: draft, models, selectedModel: usage, attachmentCount: attachments.length });
  const thinkingSelection = activeKey ? thinkingSelections[activeKey] : undefined;
  const composerThinking: SessionThinking = { ...thinking, level: thinkingSelection?.model === JSON.stringify([usage.modelProvider, usage.model])
    ? thinkingSelection.level : thinking.level };
  const appendDraft = (text: string) => {
    const key = activeKeyRef.current;
    if (!key || openingRef.current) return;
    setDraft(appendToDraft(drafts.current.read(key).text, text));
    setWorkspaceView("chat");
    focusAfterRender.current = "composer-input";
  };

  useEffect(() => {
    const target = focusAfterRender.current;
    if (!target) return;
    const node = document.getElementById(target);
    if (node) { node.focus(); focusAfterRender.current = null; }
  }, [workspaceView, draft, dockTab, rightHidden]);

  if (showConnect) {
    return <><RuntimeRecovery runtime={runtime} /><ConnectScreen initialQuery={connectQuery} ready={runtime.connected && runtime.setupReady} onDone={() => {
      setShowConnect(false);
      void refreshModels(false);
      void refreshAdvisorModels();
      if (activeKeyRef.current) void subscribeHistory(activeKeyRef.current);
    }} /></>;
  }

  const currentModel = selectedChatModel(usage, models);
  const stage = workspaceStage({ runtime, modelCatalogueState, availableModelCount: availableModels.length,
    activeKey, busy, opening, historyReady, historyError, selectedModelStatus: currentModel.status });
  const modelNeedsAttention = stage.kind === "session-model-unavailable" || stage.kind === "session-model-unknown";
  const reloadConnection = () => { void refreshModels(false); void refreshAdvisorModels(); if (activeKeyRef.current) void subscribeHistory(activeKeyRef.current); };
  const openConnect = (query = '') => { if (changingModelRef.current) return; connectOffered.current = true; setConnectQuery(query); setShowConnect(true); };
  const openWebUrl = async (url: string) => {
    if (openingWebLink.current) return;
    openingWebLink.current = true;
    try {
      const result = await manage<{ active: string | null }>({ action: 'web-new' });
      if (!result.active) throw new Error('Chưa mở được tab web.');
      setRightHidden(false); setShowInformation(false); setDockTab('web'); setWebFocus(value => value + 1);
      await manage({ action: 'web-navigate', id: result.active, url });
    } catch (caught) { setNotice(caught instanceof Error ? caught.message : 'Chưa mở được nguồn trên web.'); }
    finally { openingWebLink.current = false; }
  };
  openWebHandler.current = openWebUrl;
  const closeInformation = () => { setShowInformation(false); setDockTab('files'); filesTabRef.current?.focus(); };
  const canCreate = runtime.connected && runtime.setupReady && modelCatalogueState === "ready"
    && availableModels.length > 0 && !opening && !changingModel;

  const sidebarSessions = sessions.map(session => sessionProjects[session.key]
    ? { ...session, projectId: sessionProjects[session.key] } : session);
  const navigationLocked = !runtime.connected || opening || changingModel || Boolean(deleteConfirmation);
  const modelActive = !stopping && isModelActive({ connected: runtime.connected, activeKey, historyReady, run, supervision });
  const supervisionChoice = (activeKey && supervisionChoices[activeKey]) || { enabled: false,
    model: usage.model && usage.modelProvider ? { id: usage.model, provider: usage.modelProvider } : null };
  const openProject = (project: ProjectSummary) => { if (!navigationLocked) { setSelectedProject(project.id); setWorkspaceView('projects'); } };
  const useAgent = (id: string) => { if (!navigationLocked) { setAgentId(id); void createSession(selectedProject ?? undefined, id); } };
  const selectedDock = showInformation ? "information" : dockTab;
  const selectDock = (tab: "files" | "web" | "thinking" | "information") => {
    setRightHidden(false); setShowInformation(tab === "information");
    if (tab !== "information") setDockTab(tab);
  };
  // Only an accepted event from this run can bind progress to a transcript turn.
  // Equal wording from an older run is not evidence of duplication.
  const anchoredMessageIndex = runMessageAnchor?.runId === run.runId
    ? messages.findIndex(message => message.anchorId === runMessageAnchor.anchorId) : -1;
  let reasoningInTranscript = false;
  if (anchoredMessageIndex >= 0 && run.progress?.reasoning.trim()) {
    let start = anchoredMessageIndex, end = anchoredMessageIndex + 1;
    while (start > 0 && messages[start - 1].role !== 'user') start -= 1;
    while (end < messages.length && messages[end].role !== 'user') end += 1;
    const reasoning = messages.slice(start, end).filter(message => message.role === 'assistant').map(message => message.reasoning?.trim() ?? '').join('\n');
    reasoningInTranscript = reasoning.includes(run.progress.reasoning.trim());
  }

  return <><RuntimeRecovery runtime={runtime} /><div style={{ '--rail-width': leftHidden ? '0px' : `min(${layout.railWidth}px, 24vw)`, '--dock-width': rightHidden ? '0px' : dockTab === 'web' && !showInformation && browserExpanded ? 'min(50vw, calc(100vw - var(--rail-width) - 360px))' : `min(${layout.dockWidth}px, 50vw, calc(100vw - var(--rail-width) - 360px))`, '--chat-font-size': `${layout.textSize}px` } as CSSProperties} className={"workspace"
    + (leftHidden ? " workspace--left-hidden" : "") + (rightHidden ? " workspace--right-hidden" : "")}>
    {!leftHidden && <PanelResizeHandle side="left" value={layout.railWidth} onChange={railWidth => setLayout(old => ({ ...old, railWidth }))} onDragging={setResizingPanels} />}
    {!rightHidden && <PanelResizeHandle side="right" value={layout.dockWidth} onChange={dockWidth => { setBrowserExpanded(false); setLayout(old => ({ ...old, dockWidth })); }} onDragging={setResizingPanels} />}
    <aside className="workspace__rail">
      <WorkspaceSidebar sessions={sidebarSessions} projects={projects} activeKey={activeKey} activeView={workspaceView}
        modelActive={modelActive}
        disabled={navigationLocked} onNewSession={() => { if (canCreate) void createSession(); }}
        onNavigate={navigateWorkspace} onOpenSession={openSession} onPinSession={pinSession}
        actionBusy={deleting} onDeleteSession={key => { void requestDeleteSession(key); }}
        onRenameSession={async (key, label) => {
          if (!runtime.connected || openingRef.current || changingModelRef.current || !sessions.some(session => session.key === key)) throw new Error("Chưa sẵn sàng đổi tên.");
          await call("sessions.patch", { key, label });
          const result = await call<{ session?: SessionSummary }>("sessions.describe", { key });
          if (result.session?.key !== key || result.session.label !== label) throw new Error("Chưa xác nhận tên mới; hãy tải lại.");
          setSessions(previous => previous.map(session => session.key === key ? { ...session, ...result.session } : session));
          void refreshSessions();
        }}
        onOpenProject={openProject} onToggle={() => setLeftHidden(true)} />
    </aside>
    <main className="workspace__main">
      <header className="workspace__topbar">
        {leftHidden ? <button type="button" className="tool-icon" aria-label="Mở thanh bên" title="Mở thanh bên"
          onClick={() => setLeftHidden(false)}><WorkbenchIcon name="sidebar" /></button> : null}
        <span className="workspace__title">{conversationTitle(activeKey, sessions)}</span>
        <WorkspaceControls runtime={runtime} usage={usage} contextPending={changingModel || Boolean(activeKey && !historyReady)} agents={agents} agentId={activeKey?.split(':')[1] || agentId} models={models} advisorModels={advisorModels}
          onBrowseModels={refresh => { void browseAdvisorModels(refresh); }} catalogueLoading={advisorCatalogueLoading} catalogueError={advisorCatalogueError}
          choice={supervisionChoice} disabled={opening || changingModel || supervisionBusy || busy || skillsBusy} reviewBusy={supervisionBusy}
          onAgent={useAgent} onManageAgents={() => setWorkspaceView('agents')}
          onChoice={choice => { if (activeKey && !supervisionLock.current) setSupervisionChoices(old => ({ ...old, [activeKey]: choice })); }}
          onRetry={() => { void retryRuntimeStartup().catch(error => setNotice(String(error.message))); }} />
        <span className={"run-pill run-pill--" + stage.kind} data-workspace-stage={stage.kind} role="status">{stage.badge}</span>
        <LayoutControls value={layout} onChange={setLayout} onSettings={() => navigateWorkspace('settings')} />
        <button type="button" className="tool-icon" aria-label={rightHidden ? "Mở bảng bên phải" : "Thu gọn bảng bên phải"}
          title={rightHidden ? "Mở bảng bên phải" : "Thu gọn bảng bên phải"}
          onClick={() => setRightHidden(!rightHidden)}><WorkbenchIcon name="sidebarRight" /></button>
      </header>
      <SessionTabs sessions={sessions} openKeys={openKeys} activeKey={activeKey} disabled={navigationLocked}
        onSelect={openSession} onClose={closeTab} onNew={() => { if (canCreate) void createSession(); }} />
      <div className="workspace__content" id="workspace-content">
        {workspaceView === "chat" ? <>
          <div className="transcript" ref={transcriptRef}>
            {olderOffset !== null && <button disabled={loadingOlder || navigationLocked} onClick={async () => {
              const key = activeKeyRef.current, offset = olderOffset; if (!key || loadingOlder) return; setLoadingOlder(true);
              try { const history = await call<Record<string, unknown>>('chat.history', { sessionKey: key, limit: 200, offset });
                if (activeKeyRef.current === key) { applyMessages([...toTranscriptMessages((history.messages ?? []) as Record<string, unknown>[], `${key}:older:${offset}`), ...messagesRef.current]);
                  setOlderOffset(history.hasMore === true && typeof history.nextOffset === 'number' ? history.nextOffset : null); }
              } catch { setNotice('Chưa tải được lịch sử cũ.'); } finally { setLoadingOlder(false); }
            }}>{loadingOlder ? 'Đang tải…' : 'Xem tin nhắn cũ hơn'}</button>}
            {messages.length === 0 && !run.text ? <WorkspaceGuide stage={stage} onConnect={openConnect}
              onNewChat={() => void createSession()} onReload={reloadConnection} onReloadHistory={() => void reloadHistory()}
              actionDisabled={opening || changingModel || (stage.action === "retry-history" ? !runtime.connected : busy)} />
              : messages.filter(message => message.content.trim() || message.artifacts?.length).map(message => <article key={message.id} className={"bubble bubble--" + message.role}>
                <span className="bubble__role">{message.role === "user" ? "Bạn" : message.role === "system" ? "Hệ thống" : "Trợ lý"}</span>
                <MessageContent content={message.content} onOpenUrl={openMessageUrl} />
                {activeKey && message.artifacts?.length ? <DeliveredFiles sessionKey={activeKey} files={message.artifacts} /> : null}
              </article>)}
            {run.text ? <article className="bubble bubble--assistant" aria-live="polite">
              <span className="bubble__role">Trợ lý</span><MessageContent content={run.text} onOpenUrl={openMessageUrl} />
            </article> : null}
            {(busy || supervisionBusy) && <button type="button" className="chat-activity" aria-label="Xem Thinking"
              onClick={openThinking}><BrandMark active={modelActive} /><span>Thinking</span><WorkbenchIcon name="chevron" /></button>}
          </div>
        {notice || ((historyError || modelNeedsAttention) && (messages.length > 0 || run.text)) ? (
          <div className="notice" role="status">
            <strong>Thông báo</strong>
            <p>{notice ?? (modelNeedsAttention ? stage.detail : "Chưa tải được cuộc trò chuyện. Bản nháp của bạn vẫn được giữ.")}</p>
            {historyError && (messages.length > 0 || run.text) ? <button type="button"
              disabled={!runtime.connected || opening || changingModel} onClick={() => void reloadHistory()}>Tải lại cuộc trò chuyện</button> : null}
            {modelNeedsAttention && (messages.length > 0 || run.text) ? <button type="button"
              disabled={!runtime.connected || !runtime.setupReady || busy || opening || changingModel}
              onClick={stage.action === "connect" ? () => openConnect() : reloadConnection}>
              {stage.action === "connect" ? "Kết nối AI" : "Tải lại kết nối"}</button> : null}
            {!historyError && !modelNeedsAttention ? <button type="button" onClick={() => setNotice(null)}>
              Đóng
            </button> : null}
          </div>
        ) : null}

        <div className="composer-options" aria-label="Gợi ý và kỹ năng" onKeyDown={event => {
          if (event.key !== 'Escape') return;
          const open = event.currentTarget.querySelector<HTMLDetailsElement>('details[open]');
          if (open) { event.preventDefault(); open.open = false; open.querySelector('summary')?.focus(); }
        }}>
          <details className="work-templates" name="composer-options"><summary><WorkbenchIcon name="files" />Mẫu công việc</summary>
            <div className="composer-options__body"><div>{WORK_TEMPLATES.map(template => <button key={template.id} type="button"
              disabled={!activeKey || opening} onClick={event => { appendDraft(template.text); event.currentTarget.closest('details')?.removeAttribute('open'); }}>{template.label}</button>)}</div>
              <p>Thêm vào nháp để bạn sửa rồi gửi.</p></div>
          </details>
          {activeKey && <SessionSkills key={`skills:${activeKey}`} sessionKey={activeKey} disabled={!runtime.connected || !runtime.setupReady || busy || supervisionBusy || changingModel || opening}
            onBusy={value => { skillsLock.current = value; setSkillsBusy(value); }} />}
        </div>
        <Composer key={activeKey ?? "no-session"} draft={draft} textSize={layout.textSize} onDraftChange={setDraft}
          onBrowseModels={refresh => { void browseModels(refresh); }} catalogueLoading={catalogueLoading} catalogueError={catalogueError}
          onSend={send} onStop={() => void abort()} canSubmit={canSubmit && !supervisionBusy} busy={busy || supervisionBusy}
          stopping={stopping} stopDisabled={!runtime.connected} disabled={!activeKey || opening}
            models={models} usage={usage} modelsLoading={modelsLoading || !historyReady || !runtime.setupReady} paused={runtime.paused}
          changingModel={changingModel || supervisionBusy || skillsBusy} onChangeModel={changeModel} thinking={composerThinking} onChangeThinking={changeThinking}
          attachments={attachments} onAddFiles={addFiles} onRemoveFile={removeFile}
          canAttach={Boolean(activeKey && runtime.connected && runtime.attachmentPolicy && !opening && !changingModel)}
          attachmentHint={runtime.attachmentPolicy
            ? "Thêm tài liệu PDF, Word, bảng tính, ảnh, âm thanh, video và tệp dữ liệu. Tối đa 4 tệp, tổng 8 MB; văn bản tối đa 200 KB. Khả năng đọc nội dung tùy OpenClaw, mô hình và công cụ."
            : "Chờ kết nối xác nhận giới hạn tệp."} />

        </> : workspaceView === 'projects' ? <ProjectPage projects={projects} sessions={sidebarSessions} selectedId={selectedProject} ready={!navigationLocked}
          onSelect={setSelectedProject} onRefresh={async () => { await refreshProjects(); await refreshSessions(); }} onNewChat={id => void createSession(id)} onOpenChat={openSession} />
          : workspaceView === 'agents' ? <AgentPanel agents={agents} models={models} ready={!navigationLocked} onRefresh={refreshProjects} onUse={useAgent} />
          : workspaceView === "settings" ? null : <NativePage view={workspaceView} projects={projects} ready={runtime.connected} activeKey={activeKey}
          mutationsDisabled={busy || supervisionBusy || opening || changingModel}
          onOpenProject={project => { if (canCreate) void createSession(project.id); }} onRefreshProjects={() => void refreshProjects()}
          onConnect={openConnect} onUseSkill={name => {
            if (!activeKey || openingRef.current || changingModelRef.current) return;
            const current = drafts.current.read(activeKey).text;
            setDraft(`${current}${current ? "\n\n" : ""}Dùng kỹ năng ${name} để hỗ trợ công việc sau: `);
            setWorkspaceView("chat");
          }} />}
        {workspaceView !== "chat" && notice ? <div className="notice" role="status"><p>{notice}</p>
          <button type="button" onClick={() => setNotice(null)}>Đóng</button></div> : null}
      </div>
      <footer className="statusbar"><span className={"statusbar__dot statusbar__dot--" + stage.kind} aria-hidden="true" />
        <span className="statusbar__detail" title={stage.detail}>{stage.detail}</span>
      </footer>
    </main>
    <aside className="workspace__dock" aria-label="Tệp, Web, Thinking và thông tin">
      <div className="workspace__dock-tabs" role="tablist" aria-label="Nội dung bảng bên phải" onKeyDown={event => {
        const tabs = ["files", "web", "thinking", "information"] as const;
        const index = tabs.indexOf(selectedDock);
        const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1
          : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length
            : event.key === "ArrowRight" ? (index + 1) % tabs.length : -1;
        if (next < 0) return;
        event.preventDefault(); selectDock(tabs[next]);
        event.currentTarget.querySelector<HTMLButtonElement>("#" + tabs[next] + "-tab")?.focus();
      }}>
        {([ ["files", "files", "Tệp"], ["web", "web", "Web"], ["thinking", "thinking", "Thinking"],
          ["information", "info", "Thông tin"] ] as const).map(([tab, icon, label]) => <button ref={tab === 'files' ? filesTabRef : undefined} key={tab} id={tab + "-tab"}
            type="button" role="tab" aria-selected={selectedDock === tab} tabIndex={selectedDock === tab ? 0 : -1}
            title={tab === 'thinking' ? thinkingStatus({ activeKey, connected: runtime.connected, historyReady, run, supervision, pending: busy || supervisionBusy, stopping }) : label}
            aria-controls={tab === "information" ? "app-information" : tab + "-panel"} onClick={() => selectDock(tab)}>
              <WorkbenchIcon name={icon} />{label}{tab === 'thinking' && modelActive && <span className="thinking-tab__live" aria-label="Mô hình đang hoạt động" />}</button>)}
      </div>
      <div className="workspace__dock-content">
        {showInformation ? <AppInformation runtime={runtime} shell={shell} usage={usage}
          availableModelCount={availableModels.length} sessionKey={activeKey} onClose={closeInformation} />
          : dockTab === "files" ? <div id="files-panel" role="tabpanel" aria-labelledby="files-tab">
              <SessionFiles ready={runtime.connected} sessionKey={activeKey} />
            </div> : dockTab === 'thinking' && !rightHidden ? <div id="thinking-panel" role="tabpanel" aria-labelledby="thinking-tab">
              <ThinkingView activeKey={activeKey} sessionTitle={conversationTitle(activeKey, sessions)}
                messages={messages} run={run} connected={runtime.connected} supervision={supervision?.key === activeKey ? supervision : null}
                pendingBusy={busy || supervisionBusy} reasoningInTranscript={reasoningInTranscript}
                status={thinkingStatus({ activeKey, connected: runtime.connected, historyReady, run, supervision, pending: busy || supervisionBusy, stopping })}
                onClose={() => { setRightHidden(true); document.getElementById('composer-input')?.focus(); }}
                onStop={() => void abort()} stopping={stopping} stopDisabled={!runtime.connected} />
            </div> : null}
        <WebPanel focusRequest={webFocus} visible={!approvalVisible && !rightHidden && !showInformation && dockTab === 'web' && !resizingPanels && !showConnect && !deleteConfirmation && workspaceView !== 'settings'} sessionKey={activeKey}
          expanded={browserExpanded} onExpand={() => setBrowserExpanded(old => !old)}
          disabled={busy || supervisionBusy || changingModel || opening || skillsBusy} onShare={text => { appendDraft(text); setWorkspaceView('chat'); }} />
      </div>
      <details className="terminal-drawer"><summary>Lệnh trên máy · Duyệt theo phạm vi</summary>
        <p>Yêu cầu trợ lý thực hiện công việc trong cuộc chat. Mỗi lệnh cần anh duyệt trước khi chạy trực tiếp trên máy, không có sandbox.</p>
        <RunProgress run={{ ...run, progress: run.progress ? { ...run.progress, reasoning: '', plan: [], explanation: undefined, tools: run.progress.tools.filter(tool => ['exec', 'process'].includes(tool.name)) } : undefined }} connected={runtime.connected} presentation="full" />
      </details>
    </aside>
  </div>{deleteConfirmation && <ConversationDeleteDialog value={deleteConfirmation} busy={deleting} returnFocus={deleteReturnFocus}
    onCancel={cancelDeleteSession} onConfirm={() => { void confirmDeleteSession(); }} />}
  {workspaceView === 'settings' && <SettingsCenter runtime={runtime} shell={shell} usage={usage} models={models}
    onBrowseModels={refresh => { void browseModels(refresh); }} catalogueLoading={catalogueLoading} catalogueError={catalogueError}
    layout={layout} projects={projects} sessionKey={activeKey} pending={changingModel || Boolean(activeKey && !historyReady)}
    modelDisabled={!runtime.connected || !runtime.setupReady || busy || opening || changingModel || supervisionBusy || skillsBusy}
    dataDisabled={[...sessionWork.current.values()].some(work => work.run.busy || work.supervision?.busy || work.pending) || opening || changingModel || skillsBusy}
    onLayout={setLayout} onModel={model => void changeModel(model)} onClose={() => setWorkspaceView(settingsReturnView.current)}
    onConnect={openConnect} onNavigate={navigateWorkspace} onRetry={() => { void retryRuntimeStartup().catch(error => setNotice(String(error.message))); }}
    onRefreshInfo={async () => { if (!window.aiForBoss) throw new Error('Chưa có kết nối ứng dụng'); const current = await window.aiForBoss.getShellStatus(); setShell(current); }}
    onUseSkill={name => { if (!activeKey || openingRef.current || changingModelRef.current) return; appendDraft(`Dùng kỹ năng ${name} để hỗ trợ công việc sau: `); setWorkspaceView('chat'); }} />}
  <ApprovalInbox ready={runtime.connected && runtime.setupReady} onVisibility={setApprovalVisible} /></>;
}

export default App;
import RunProgress from './RunProgress';

