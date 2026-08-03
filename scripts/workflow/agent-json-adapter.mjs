import { createClaudeCodeJsonAdapter } from "./claude-code-adapter.mjs";
import { createCodexCliJsonAdapter } from "./codex-cli-adapter.mjs";

export const STRUCTURED_AGENT_PROVIDERS = ["codex-cli", "claude-code"];

export const isStructuredAgentProvider = (provider) => STRUCTURED_AGENT_PROVIDERS.includes(provider);

export const createStructuredAgentJsonAdapter = (options) => {
  const provider = options.config?.provider;
  if (provider === "codex-cli") return createCodexCliJsonAdapter(options);
  if (provider === "claude-code") return createClaudeCodeJsonAdapter(options);
  throw new Error(`Unsupported structured Agent provider: ${provider}`);
};
