import type { AdvisorRequest, AdvisorResponse } from "./advisor-types";
export {};

declare global {
  type ShellStatus = {
    schemaVersion: string;
    classification: "experimental-internal";
    product: {
      name: string;
      version: string;
      attribution: string;
    };
    releaseTrain: {
      id: string;
      openclaw: string;
      electron: string;
      node: string;
      pnpm: string;
    };
    contractSummary: {
      capabilityFamilies: number;
      advertisableCapabilities: number;
      authModes: number;
      sourcesOfTruth: number;
      dataFlows: number;
      threats: number;
    };
    featureState: {
      shell: string;
      gateway: string;
      providerConnection: string;
      agentGenesis: string;
      advisor: string;
      tools: string;
    };
    reason?: string;
  };

  type GatewayRuntimeStatus = {
    supervisor: "idle" | "starting" | "ready" | "restarting" | "safe-mode";
    detail: string | null;
    connected: boolean;
    setupReady: boolean;
    attachmentPolicy: import("./chat-attachments").AttachmentPolicy | null;
    serverVersion: string | null;
    protocol: number | null;
    nodeRuntime: string | null;
    stateDirectory: string | null;
    lastError: string | null;
  };

  type GatewayEventFrame = {
    event: string;
    payload: Record<string, unknown> | null;
    seq: number | null;
  };

  interface Window {
    aiForBoss?: Readonly<{
      getShellStatus: () => Promise<ShellStatus>;
      management: Readonly<{ request: <T = Record<string, unknown>>(payload: unknown) => Promise<T> }>;
      advisor: Readonly<{ request: (payload: AdvisorRequest) => Promise<AdvisorResponse> }>;
      gateway: Readonly<{
        request: <T = Record<string, unknown>>(method: string, params?: unknown) => Promise<T>;
        getStatus: () => Promise<GatewayRuntimeStatus>;
        retryStartup: () => Promise<boolean>;
        onStatus: (listener: (status: GatewayRuntimeStatus) => void) => () => void;
        onEvent: (listener: (event: GatewayEventFrame) => void) => () => void;
      }>;
      setup: Readonly<{
        request: <T = Record<string, unknown>>(method: string, params?: unknown) => Promise<T>;
        openPage: (sessionId: string) => Promise<boolean>;
      }>;
    }>;
  }
}
