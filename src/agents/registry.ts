import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { homedir } from "node:os";
import { delimiter, resolve } from "node:path";
import { promisify } from "node:util";
import type { AgentDefinition, AgentId, DetectedAgent } from "./types.ts";

const execFileAsync = promisify(execFile);

export const AGENT_REGISTRY: readonly AgentDefinition[] = [
  {
    id: "codex-cli",
    displayName: "Codex CLI",
    command: "codex",
    versionArgs: ["--version"],
    authArgs: ["login", "status"],
    defaultModel: null,
    capabilities: {
      nonInteractive: true,
      structuredOutput: true,
      readOnly: true,
      productionOrchestration: true,
      imageProviderOrchestration: true,
      imageGeneration: true,
      modelSelection: true,
      cancellation: true,
      versionReporting: true,
    },
  },
  {
    id: "claude-code",
    displayName: "Claude Code",
    command: "claude",
    versionArgs: ["--version"],
    authArgs: ["auth", "status"],
    defaultModel: null,
    capabilities: {
      nonInteractive: true,
      structuredOutput: true,
      readOnly: true,
      productionOrchestration: true,
      imageProviderOrchestration: true,
      imageGeneration: false,
      modelSelection: true,
      cancellation: true,
      versionReporting: true,
    },
  },
  {
    id: "fixture",
    displayName: "Fixture Agent",
    command: null,
    versionArgs: [],
    defaultModel: "fixture",
    capabilities: {
      nonInteractive: true,
      structuredOutput: true,
      readOnly: true,
      productionOrchestration: false,
      imageProviderOrchestration: false,
      imageGeneration: false,
      modelSelection: false,
      cancellation: true,
      versionReporting: true,
    },
  },
] as const;

const firstLine = (value: string) => value.trim().split(/\r?\n/)[0]?.trim() || null;

const run = async (command: string, args: string[], timeout = 8_000) => {
  const result = await execFileAsync(command, args, { timeout, windowsHide: true });
  return `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
};

const fallbackAgentBinDirectories = (homeDirectory = homedir()) => [
  resolve(homeDirectory, ".npm-global/bin"),
  resolve(homeDirectory, ".local/bin"),
  resolve(homeDirectory, ".bun/bin"),
  resolve(homeDirectory, ".cargo/bin"),
  "/opt/homebrew/bin",
  "/usr/local/bin",
];

export const resolveAgentExecutable = async (
  command: string,
  {
    pathValue = process.env.PATH ?? "",
    homeDirectory = homedir(),
  }: { pathValue?: string; homeDirectory?: string } = {},
) => {
  if (process.platform === "win32") {
    try {
      const resolvedByPath = firstLine(await run("where", [command]));
      if (resolvedByPath) return resolvedByPath;
    } catch {
      return null;
    }
  }

  const pathDirectories = pathValue.split(delimiter).filter(Boolean);
  const candidates = [...new Set([...pathDirectories, ...fallbackAgentBinDirectories(homeDirectory)])].map(
    (directory) => resolve(directory, command),
  );
  for (const candidate of candidates) {
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Continue through the deterministic local search path.
    }
  }
  return null;
};

export const agentDefinition = (id: AgentId): AgentDefinition => {
  const definition = AGENT_REGISTRY.find((item) => item.id === id);
  if (!definition) throw new Error(`Unsupported Agent: ${id}`);
  return definition;
};

export const detectAgent = async (id: AgentId): Promise<DetectedAgent> => {
  const definition = agentDefinition(id);
  if (id === "fixture") {
    return {
      ...definition,
      available: true,
      authenticated: true,
      executablePath: null,
      version: "fixture-1.0",
      remediation: null,
    };
  }
  try {
    if (!definition.command) throw new Error("Agent command is not configured");
    const executablePath = await resolveAgentExecutable(definition.command);
    if (!executablePath) throw new Error("not found");
    const version = firstLine(await run(executablePath, definition.versionArgs, 5_000));
    let authenticated = true;
    if (definition.authArgs) {
      try {
        const authOutput = await run(executablePath, definition.authArgs, 8_000);
        authenticated = id === "claude-code" ? /"loggedIn"\s*:\s*true/.test(authOutput) : /logged in/i.test(authOutput);
      } catch {
        authenticated = false;
      }
    }
    return {
      ...definition,
      available: authenticated,
      authenticated,
      executablePath,
      version,
      remediation: authenticated
        ? null
        : id === "codex-cli"
          ? "Run `codex login`."
          : "Run `claude auth login` or complete Claude Code authentication.",
    };
  } catch {
    return {
      ...definition,
      available: false,
      authenticated: false,
      executablePath: null,
      version: null,
      remediation:
        id === "codex-cli" ? "Install Codex CLI and run `codex login`." : "Install and authenticate Claude Code.",
    };
  }
};

export const detectAgents = async ({ includeFixture = false }: { includeFixture?: boolean } = {}) =>
  Promise.all(
    AGENT_REGISTRY.filter((item) => includeFixture || item.id !== "fixture").map((item) => detectAgent(item.id)),
  );
