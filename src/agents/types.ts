export const AGENT_IDS = ["codex-cli", "claude-code", "fixture"] as const;

export type AgentId = (typeof AGENT_IDS)[number];

export type AgentCapabilities = {
  nonInteractive: boolean;
  structuredOutput: boolean;
  readOnly: boolean;
  productionOrchestration: boolean;
  imageProviderOrchestration: boolean;
  imageGeneration: boolean;
  modelSelection: boolean;
  cancellation: boolean;
  versionReporting: boolean;
};

export type AgentDefinition = {
  id: AgentId;
  displayName: string;
  command: string | null;
  versionArgs: string[];
  authArgs?: string[];
  defaultModel: string | null;
  capabilities: AgentCapabilities;
};

export type DetectedAgent = AgentDefinition & {
  available: boolean;
  authenticated: boolean;
  executablePath: string | null;
  version: string | null;
  remediation: string | null;
};

export type GlobalAgentPin = {
  id: AgentId;
  model?: string;
  fallback: "none";
  authoringContractVersion: "1.0";
  semanticContractVersion: "1.1";
};
