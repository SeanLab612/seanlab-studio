const catalog = {
  ENV_NODE_UNSUPPORTED: {
    category: "environment",
    retryable: false,
    remediation: "Install the supported Node.js version and reinstall dependencies from the lockfile.",
  },
  ENV_FFMPEG_MISSING: {
    category: "environment",
    retryable: false,
    remediation: "Install FFmpeg with ffprobe and H.264/AAC support, then rerun the Doctor.",
  },
  ENV_PYTHON_MISSING: {
    category: "environment",
    retryable: false,
    remediation: "Install Python 3 and the project video-analysis modules, then rerun the Doctor.",
  },
  ENV_FONT_MISSING: {
    category: "environment",
    retryable: false,
    remediation: "Install the required Chinese and Latin fonts before rendering review output.",
  },
  ENV_REMOTION_INVALID: {
    category: "environment",
    retryable: false,
    remediation: "Run npm install from the repository root and confirm Remotion package versions match.",
  },
  ENV_DISK_LOW: {
    category: "environment",
    retryable: true,
    remediation: "Free disk space or move the project workspace before rendering.",
  },
  PROVIDER_AUTH_MISSING: {
    category: "provider",
    retryable: false,
    remediation: "Set the manifest-selected provider API key in the environment; never store it in project files.",
  },
  PROVIDER_REQUEST_FAILED: {
    category: "provider",
    retryable: true,
    remediation: "Check provider availability, quota, network access, and the configured model before resuming.",
  },
  PROVIDER_REQUEST_TIMEOUT: {
    category: "provider",
    retryable: true,
    remediation:
      "Confirm provider availability, then retry the same frozen request. Valid upstream narration, captions, and approvals must be preserved.",
  },
  CONFIG_MANIFEST_INVALID: {
    category: "configuration",
    retryable: false,
    remediation: "Correct the project manifest using the current schema and rerun project preflight.",
  },
  INPUT_SOURCE_MISSING: {
    category: "input",
    retryable: false,
    remediation: "Relink the source video and verify its checksum before resuming.",
  },
  INPUT_TRANSCRIPT_INVALID: {
    category: "input",
    retryable: false,
    remediation: "Provide valid word-level transcript JSON or switch the manifest to video-use transcription.",
  },
  INPUT_VIDEO_DECODE_FAILED: {
    category: "input",
    retryable: false,
    remediation: "Verify the source file is complete and that FFmpeg supports its video codec.",
  },
  INPUT_SCENE_DURATION_UNSAFE: {
    category: "creator-input",
    retryable: false,
    remediation:
      "Shorten the spoken interval, select a longer recording range, allow a freeze-frame, or explicitly use the speaker shot; do not force unsafe playback speed.",
  },
  IO_OUTPUT_UNWRITABLE: {
    category: "io",
    retryable: false,
    remediation: "Choose a writable workspace with sufficient free disk space.",
  },
  TRANSCRIPTION_FAILED: {
    category: "transcription",
    retryable: true,
    remediation: "Inspect the transcribe log, verify video-use and provider access, then resume from transcribe.",
  },
  TRANSCRIPT_CONFORMANCE_FAILED: {
    category: "transcription",
    retryable: false,
    remediation:
      "Inspect the raw transcript, locked narration, and conformance report; correct the narrow input issue, then resume from transcript-conformance.",
  },
  CAPTION_VALIDATION_FAILED: {
    category: "captions",
    retryable: false,
    remediation: "Correct transcript timing or terminology inputs, then resume from captions.",
  },
  CAPTION_NORMALIZATION_FAILED: {
    category: "captions",
    retryable: false,
    remediation:
      "Review the named caption cue and terminology replacement, remove only the adjacent duplicate, then rebuild captions without changing the approved edit.",
  },
  BINDING_ANCHOR_NOT_FOUND: {
    category: "binding",
    retryable: false,
    remediation:
      "Review the named spoken section and nearest caption text, then explicitly rebind, shorten, or choose a speaker fallback. Studio will not guess the insertion point.",
  },
  REGISTRY_CONTRACT_INVALID: {
    category: "studio-defect",
    retryable: false,
    remediation:
      "This is a Studio defect. Repair the named component, motion, layout, or animation registry contract before retrying the project.",
  },
  VISUAL_PROPS_INVALID: {
    category: "visual-contract",
    retryable: false,
    remediation:
      "Inspect the named visual candidate and regenerate or replace only that candidate with an approved component contract before rendering.",
  },
  QA_CONTRACT_MISSING: {
    category: "studio-defect",
    retryable: false,
    remediation:
      "This is a Studio defect. Add or repair the named component or layout QA bounds before any review render starts.",
  },
  SEMANTIC_PLAN_INVALID: {
    category: "semantic-planning",
    retryable: true,
    remediation:
      "Inspect the VisualBrief validation finding, correct the plan or provider output, then resume from semantic-plan.",
  },
  SEMANTIC_REPLAN_REQUIRED: {
    category: "semantic-planning",
    retryable: false,
    remediation:
      "Inspect the dry-run plan, then use --replan-semantic explicitly. The last valid semantic attempt will be preserved for comparison.",
  },
  RECUT_REPLAN_REQUIRED: {
    category: "recut-planning",
    retryable: false,
    remediation:
      "Inspect the frozen recut proposal, then use --replan-recut --until recut explicitly. The last valid proposal remains available until replacement succeeds.",
  },
  RENDER_FAILED: {
    category: "render",
    retryable: true,
    remediation: "Inspect the render log and environment report, then resume from the failed render stage.",
  },
  RENDER_STALLED: {
    category: "render",
    retryable: true,
    remediation:
      "Inspect the stage log and last progress timestamp, remove the blocking render dependency, then resume from the failed render stage.",
  },
  STAGE_TIMEOUT: {
    category: "workflow",
    retryable: true,
    remediation: "Inspect the stage log and provider or process availability, then resume from the failed stage.",
  },
  QA_FAILED: {
    category: "quality-assurance",
    retryable: false,
    remediation:
      "Inspect named QA frames and findings, correct the visual issue, then resume from layout or qa-capture.",
  },
  REGRESSION_FAILED: {
    category: "regression",
    retryable: false,
    remediation: "Compare the expected and actual regression result; fix behavior or request explicit baseline review.",
  },
  APPROVAL_REQUIRED: {
    category: "approval",
    retryable: false,
    remediation: "Complete human review and record explicit approval before delivery.",
  },
  DELIVERY_VISUAL_PARITY_FAILED: {
    category: "delivery",
    retryable: false,
    remediation:
      "Restore every reviewed visual in delivery props, or record an explicit visualDeliveryFallbacks entry with a reason and valid replacement before rendering.",
  },
  STATE_ARTIFACT_CONFLICT: {
    category: "workflow",
    retryable: false,
    remediation:
      "Inspect the named delivery file, render report, validation report, and run-state before choosing an explicit recovery action. Do not infer delivery from file existence alone.",
  },
  REVISION_REQUEST_INVALID: {
    category: "review-revision",
    retryable: false,
    remediation: "Correct the typed revision request and keep all edits inside the allowlisted operation contract.",
  },
  REVISION_BASELINE_CONFLICT: {
    category: "review-revision",
    retryable: false,
    remediation: "Reload the current review artifacts, inspect their hashes, and create a new revision request.",
  },
  REVISION_ALREADY_APPLIED: {
    category: "review-revision",
    retryable: false,
    remediation: "Use the existing revision history entry or submit a new unique revision ID for another change.",
  },
  INTERNAL_WORKFLOW_ERROR: {
    category: "internal",
    retryable: true,
    remediation: "Inspect the structured failure and stage log; preserve upstream artifacts before retrying.",
  },
};

const stageCode = {
  preflight: "CONFIG_MANIFEST_INVALID",
  ingest: "INPUT_SOURCE_MISSING",
  probe: "INPUT_VIDEO_DECODE_FAILED",
  transcribe: "TRANSCRIPTION_FAILED",
  "transcript-conformance": "TRANSCRIPT_CONFORMANCE_FAILED",
  terminology: "CAPTION_VALIDATION_FAILED",
  captions: "CAPTION_VALIDATION_FAILED",
  "visual-input-preflight": "BINDING_ANCHOR_NOT_FOUND",
  translate: "PROVIDER_REQUEST_FAILED",
  "semantic-plan": "SEMANTIC_PLAN_INVALID",
  "component-props": "VISUAL_PROPS_INVALID",
  validate: "VISUAL_PROPS_INVALID",
  "review-base": "RENDER_FAILED",
  "review-render": "RENDER_FAILED",
  "qa-capture": "QA_FAILED",
  "visual-qa": "QA_FAILED",
  "review-evidence": "QA_FAILED",
  "regression-fixtures": "REGRESSION_FAILED",
  "human-approval": "APPROVAL_REQUIRED",
  "delivery-render": "RENDER_FAILED",
  "delivery-validate": "QA_FAILED",
};

export const ERROR_CODES = Object.freeze(Object.keys(catalog));

export class OperationalError extends Error {
  constructor(code, message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = "OperationalError";
    this.operationalCode = code;
    this.details = options.details;
    this.exitCode = options.exitCode;
  }
}

export const redactSecrets = (value, env = process.env) => {
  let output = String(value ?? "");
  const secrets = Object.entries(env)
    .filter(([key, secret]) => /(?:API_KEY|TOKEN|SECRET|PASSWORD)$/i.test(key) && typeof secret === "string" && secret)
    .map(([, secret]) => secret);
  for (const secret of secrets) output = output.replaceAll(secret, "[REDACTED]");
  return output
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
    .replace(/([?&](?:key|token|secret)=)[^&\s]+/gi, "$1[REDACTED]");
};

export const summarizeStageLog = (value) => {
  const lines = String(value ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const diagnostic = [...lines]
    .reverse()
    .find((line) =>
      /^(?:OperationalError|Error|TypeError|RangeError|ReferenceError|RuntimeError|ValueError):\s+/.test(line),
    );
  if (diagnostic) return diagnostic.replace(/^(?:OperationalError|[A-Za-z]*Error):\s+/, "").slice(0, 800);
  return [...lines]
    .reverse()
    .find((line) => !/^Node\.js\s+v/i.test(line))
    ?.slice(0, 800);
};

const inferCode = (message, stage) => {
  if (/explicit --replan-semantic/i.test(message)) return "SEMANTIC_REPLAN_REQUIRED";
  if (/stalled after|no progress/i.test(message)) return "RENDER_STALLED";
  if (/timed?\s*out|timeout|ETIMEDOUT/i.test(message) && /provider|agent|semantic|translation|request/i.test(message))
    return "PROVIDER_REQUEST_TIMEOUT";
  if (/playback rate.*(?:below|safety limit)|recording scene.*duration/i.test(message))
    return "INPUT_SCENE_DURATION_UNSAFE";
  if (/anchor was not found|anchors did not match|spoken-text anchor|could not be resolved/i.test(message))
    return "BINDING_ANCHOR_NOT_FOUND";
  if (/StudioStudio|adjacent duplicate|residual source variant|terminology correction left/i.test(message))
    return "CAPTION_NORMALIZATION_FAILED";
  if (
    /Missing component QA contract|Missing layout QA bounds|Invalid .* QA bounds|Visual QA contracts must cover/i.test(
      message,
    )
  )
    return "QA_CONTRACT_MISSING";
  if (/Missing motion profile|Missing motion recipe|registry is incomplete|unsupported .* registry/i.test(message))
    return "REGISTRY_CONTRACT_INVALID";
  if (
    /VisualBrief|visual props|generated visual|component props/i.test(message) &&
    /invalid|required|unsupported|must|exceed/i.test(message)
  )
    return "VISUAL_PROPS_INVALID";
  if (/Delivery props omit or change reviewed visuals/i.test(message)) return "DELIVERY_VISUAL_PARITY_FAILED";
  if (/delivery.*(?:state|file).*(?:conflict|inconsistent)|formal workflow.*file/i.test(message))
    return "STATE_ARTIFACT_CONFLICT";
  if (/MIMO_API_KEY|API key|unauthori[sz]ed|\b401\b/i.test(message)) return "PROVIDER_AUTH_MISSING";
  if (/ENOENT.*(?:source|video)|source video.*(?:missing|not found)/i.test(message)) return "INPUT_SOURCE_MISSING";
  if (/EACCES|permission denied|not writable/i.test(message)) return "IO_OUTPUT_UNWRITABLE";
  if (/human approval|required before approval|blocked until human/i.test(message)) return "APPROVAL_REQUIRED";
  if (/Revision baseline conflict/i.test(message)) return "REVISION_BASELINE_CONFLICT";
  if (/Revision .*already been applied/i.test(message)) return "REVISION_ALREADY_APPLIED";
  if (
    /revision|operations\[|visual patch|caption cue/i.test(message) &&
    /invalid|unsupported|required|must|does not exist|no longer matches/i.test(message)
  )
    return "REVISION_REQUEST_INVALID";
  return stageCode[stage] ?? "INTERNAL_WORKFLOW_ERROR";
};

export const classifyOperationalError = (error, context = {}) => {
  const rawMessage = error?.message ?? error ?? "Unknown workflow failure";
  const message = redactSecrets(rawMessage);
  const code = ERROR_CODES.includes(error?.operationalCode) ? error.operationalCode : inferCode(message, context.stage);
  const definition = catalog[code];
  return {
    schemaVersion: "1.0",
    code,
    category: definition.category,
    stage: context.stage,
    message,
    retryable: definition.retryable,
    remediation: definition.remediation,
    exitCode: error?.exitCode ?? context.exitCode,
    logPath: context.logPath,
    details: error?.details,
    occurredAt: new Date().toISOString(),
  };
};

export const errorDefinition = (code) => catalog[code];
