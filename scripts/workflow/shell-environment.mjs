import { spawnSync } from "node:child_process";

export const PROVIDER_ENVIRONMENT_NAMES = Object.freeze(["MIMO_API_KEY"]);

const marker = "__SEANLAB_PROVIDER_ENV_START__";

const parseEnvironment = (stdout) => {
  const boundary = `${marker}\0`;
  const start = stdout.indexOf(boundary);
  if (start < 0) throw new Error("zsh environment marker was not returned");
  const values = new Map();
  for (const entry of stdout.slice(start + boundary.length).split("\0")) {
    const separator = entry.indexOf("=");
    if (separator <= 0) continue;
    values.set(entry.slice(0, separator), entry.slice(separator + 1));
  }
  return values;
};

export const loadProviderEnvironmentFromZsh = ({
  environment = process.env,
  overwrite = false,
  platform = process.platform,
  runner = spawnSync,
} = {}) => {
  if (platform !== "darwin") {
    return {
      status: "skipped",
      reason: "Automatic zsh environment loading is currently available on macOS only",
      imported: [],
      detected: PROVIDER_ENVIRONMENT_NAMES.filter((name) => Boolean(environment[name])),
    };
  }
  const result = runner("/bin/zsh", ["-ilc", `printf '${marker}\\0'; env -0`], {
    encoding: "utf8",
    env: environment,
    timeout: 10_000,
    maxBuffer: 2_000_000,
  });
  if (result.error || result.status !== 0) {
    return {
      status: "failed",
      reason: result.error?.message ?? result.stderr?.trim() ?? `zsh exited ${result.status}`,
      imported: [],
      detected: PROVIDER_ENVIRONMENT_NAMES.filter((name) => Boolean(environment[name])),
    };
  }
  try {
    const shellEnvironment = parseEnvironment(result.stdout ?? "");
    const imported = [];
    const detected = [];
    for (const name of PROVIDER_ENVIRONMENT_NAMES) {
      const value = shellEnvironment.get(name);
      if (!value) continue;
      detected.push(name);
      if (!environment[name] || overwrite) {
        environment[name] = value;
        imported.push(name);
      }
    }
    return { status: "loaded", imported, detected };
  } catch (error) {
    return {
      status: "failed",
      reason: error.message,
      imported: [],
      detected: PROVIDER_ENVIRONMENT_NAMES.filter((name) => Boolean(environment[name])),
    };
  }
};
