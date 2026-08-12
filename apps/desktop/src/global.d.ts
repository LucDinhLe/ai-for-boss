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

  interface Window {
    aiForBoss?: Readonly<{
      getShellStatus: () => Promise<ShellStatus>;
    }>;
  }
}
