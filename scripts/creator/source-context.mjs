import { execFile } from "node:child_process";
import { lookup } from "node:dns/promises";
import { readFile } from "node:fs/promises";
import { request as requestHttp } from "node:http";
import { request as requestHttps } from "node:https";
import { isIP } from "node:net";
import { extname, resolve } from "node:path";
import { promisify } from "node:util";

const maximumSourceCharacters = 24_000;
const maximumSourceBytes = 2_000_000;
const execFileAsync = promisify(execFile);
const textExtensions = new Set([".md", ".txt", ".json", ".csv", ".html", ".htm"]);
const compactHtml = (value) =>
  value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

const wait = (milliseconds) => new Promise((done) => setTimeout(done, milliseconds));

const githubRepository = (url) => {
  if (url.hostname.toLowerCase() !== "github.com") return undefined;
  const [owner, repository] = url.pathname.split("/").filter(Boolean);
  if (!owner || !repository) return undefined;
  return { owner, repository: repository.replace(/\.git$/i, "") };
};

const privateIpv4 = (address) => {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [first, second] = parts;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    first >= 224
  );
};

const privateIp = (address) => {
  const normalized = address.toLowerCase().split("%")[0];
  if (isIP(normalized) === 4) return privateIpv4(normalized);
  if (isIP(normalized) !== 6) return true;
  if (normalized === "::" || normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd"))
    return true;
  if (/^fe[89ab]/.test(normalized)) return true;
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped ? privateIpv4(mapped[1]) : false;
};

export const resolvePublicSourceTarget = async (value, { resolver = lookup } = {}) => {
  const url = value instanceof URL ? value : new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Only HTTP(S) sources are supported");
  const hostname = url.hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "");
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local"))
    throw new Error("Private or local source URLs are not allowed");
  const addresses = isIP(hostname)
    ? [{ address: hostname, family: isIP(hostname) }]
    : await resolver(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => privateIp(address)))
    throw new Error("Private or local source URLs are not allowed");
  return { url, address: addresses[0].address, family: addresses[0].family ?? isIP(addresses[0].address) };
};

export const assertPublicSourceUrl = async (value, options) => (await resolvePublicSourceTarget(value, options)).url;

const readLimitedText = async (response) => {
  const declared = Number(response.headers["content-length"] ?? 0);
  if (declared > maximumSourceBytes) throw new Error("Source exceeds the 2 MB intake limit");
  const chunks = [];
  let bytes = 0;
  for await (const chunk of response) {
    bytes += chunk.length;
    if (bytes > maximumSourceBytes) {
      response.destroy();
      throw new Error("Source exceeds the 2 MB intake limit");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, bytes).toString("utf8");
};

export const createPinnedLookup =
  ({ address, family }) =>
  (_hostname, options, callback) => {
    if (options?.all) callback(null, [{ address, family }]);
    else callback(null, address, family);
  };

const requestPublicSource = ({ url, address, family }, headers) =>
  new Promise((resolveRequest, rejectRequest) => {
    const request = (url.protocol === "https:" ? requestHttps : requestHttp)(
      url,
      {
        method: "GET",
        headers: { "user-agent": "SeanLab-RemotionMD-Studio/0.1", "accept-encoding": "identity", ...headers },
        lookup: createPinnedLookup({ address, family }),
        signal: AbortSignal.timeout(20_000),
      },
      resolveRequest,
    );
    request.on("error", rejectRequest);
    request.end();
  });

export const fetchPublicSourceText = async (
  value,
  headers = {},
  { resolveTarget = resolvePublicSourceTarget, requestSource = requestPublicSource } = {},
) => {
  let url = value instanceof URL ? value : new URL(value);
  for (let redirects = 0; redirects <= 5; redirects += 1) {
    const target = await resolveTarget(url);
    const response = await requestSource(target, headers);
    const status = response.statusCode ?? response.status;
    if ([301, 302, 303, 307, 308].includes(status)) {
      const location = response.headers.location;
      response.resume?.();
      if (!location || redirects === 5) throw new Error("Source redirect limit exceeded");
      url = new URL(location, url);
      continue;
    }
    if (status < 200 || status >= 300) {
      response.resume?.();
      throw new Error(`HTTP ${status}`);
    }
    return readLimitedText(response);
  }
  throw new Error("Source redirect limit exceeded");
};

const fetchText = fetchPublicSourceText;

const loadGithubRepository = async ({ owner, repository }) => {
  const apiRoot = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`;
  const [metadataText, readme] = await Promise.all([
    fetchText(apiRoot, { accept: "application/vnd.github+json" }),
    fetchText(`${apiRoot}/readme`, { accept: "application/vnd.github.raw+json" }),
  ]);
  const metadata = JSON.parse(metadataText);
  return [
    `GitHub repository: ${metadata.full_name ?? `${owner}/${repository}`}`,
    metadata.description ? `Description: ${metadata.description}` : "",
    metadata.language ? `Primary language: ${metadata.language}` : "",
    Number.isFinite(metadata.stargazers_count) ? `Stars: ${metadata.stargazers_count}` : "",
    metadata.default_branch ? `Default branch: ${metadata.default_branch}` : "",
    "README:",
    readme,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, maximumSourceCharacters);
};

const ghApi = async (endpoint, accept) => {
  const { stdout } = await execFileAsync("gh", ["api", endpoint, ...(accept ? ["-H", `Accept: ${accept}`] : [])], {
    timeout: 20_000,
    maxBuffer: 2_000_000,
  });
  return stdout;
};

const loadGithubRepositoryWithLocalAuth = async ({ owner, repository }) => {
  const endpoint = `repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`;
  const metadata = JSON.parse(await ghApi(endpoint));
  const contents = JSON.parse(await ghApi(`${endpoint}/contents`));
  if (!Array.isArray(contents) || contents.length === 0)
    throw new Error("GitHub 仓库可以访问，但仓库为空，无法作为写稿事实依据");
  const priority = ["readme.md", "plan.md", "package.json", "pyproject.toml"];
  const preferred = contents
    .filter((item) => item.type === "file" && priority.includes(item.name.toLowerCase()))
    .sort((a, b) => priority.indexOf(a.name.toLowerCase()) - priority.indexOf(b.name.toLowerCase()))
    .slice(0, 4);
  if (!preferred.length) throw new Error("GitHub 仓库可以访问，但根目录没有 README、PLAN 或项目清单可供写稿");
  const documents = [];
  for (const item of preferred) {
    documents.push(
      `FILE: ${item.name}\n${await ghApi(`${endpoint}/contents/${encodeURIComponent(item.name)}`, "application/vnd.github.raw+json")}`,
    );
  }
  const evidence = documents.join("\n\n");
  return [
    `GitHub repository: ${metadata.full_name ?? `${owner}/${repository}`}`,
    metadata.private ? "Visibility: private (read through authenticated GitHub CLI)" : "Visibility: public",
    metadata.description ? `Description: ${metadata.description}` : "",
    metadata.language ? `Primary language: ${metadata.language}` : "",
    Number.isFinite(metadata.stargazers_count) ? `Stars: ${metadata.stargazers_count}` : "",
    metadata.default_branch ? `Default branch: ${metadata.default_branch}` : "",
    "PROJECT EVIDENCE:",
    evidence,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, maximumSourceCharacters);
};

const loadUrl = async (value) => {
  const url = await assertPublicSourceUrl(value);
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const repository = githubRepository(url);
      if (repository) {
        try {
          return await loadGithubRepositoryWithLocalAuth(repository);
        } catch (authenticatedError) {
          try {
            return await loadGithubRepository(repository);
          } catch (publicError) {
            if (authenticatedError.message.startsWith("GitHub 仓库可以访问")) throw authenticatedError;
            throw publicError;
          }
        }
      }
      return compactHtml((await fetchText(url)).slice(0, 500_000)).slice(0, maximumSourceCharacters);
    } catch (error) {
      lastError = error;
      if (attempt < 2) await wait(350);
    }
  }
  throw new Error(lastError?.message ?? "网页资料读取失败");
};

const loadFile = async (value) => {
  const path = resolve(value);
  if (!textExtensions.has(extname(path).toLowerCase()))
    throw new Error("Only text, Markdown, JSON, CSV, or HTML reference files are read during authoring");
  return (await readFile(path, "utf8")).slice(0, maximumSourceCharacters);
};

export const resolveAuthoringSources = async (sources, { previous = [] } = {}) => {
  const resolved = [];
  for (const source of sources) {
    try {
      const content =
        source.kind === "url"
          ? await loadUrl(source.value)
          : source.kind === "file"
            ? await loadFile(source.value)
            : source.value;
      resolved.push({ id: source.id, label: source.label, kind: source.kind, status: "resolved", content });
    } catch (error) {
      const cached = previous.find((item) => item.id === source.id && item.status === "resolved" && item.content);
      if (cached) {
        resolved.push({ ...cached, cached: true, cacheReason: error.message });
      } else {
        resolved.push({
          id: source.id,
          label: source.label,
          kind: source.kind,
          status: "failed",
          error: error.message,
        });
      }
    }
  }
  return resolved;
};
