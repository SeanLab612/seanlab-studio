import { execFile } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const argumentValue = (args, name, fallback) => {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1];
};

export const planBranchRetention = (branches, keepCount = 3) => {
  if (!Number.isInteger(keepCount) || keepCount < 0) throw new Error("keepCount must be a non-negative integer");
  return {
    kept: branches.slice(0, keepCount),
    pruned: branches.slice(keepCount),
  };
};

const git = async (args, root = repositoryRoot) =>
  (await execFileAsync("git", args, { cwd: root, maxBuffer: 10 * 1024 * 1024 })).stdout;

export const listMergedRemoteBranches = async ({
  root = repositoryRoot,
  remote = "origin",
  baseBranch = "main",
  baseRef = `refs/remotes/${remote}/${baseBranch}`,
} = {}) => {
  await git(["rev-parse", "--verify", baseRef], root);
  const output = await git(
    [
      "for-each-ref",
      "--merged",
      baseRef,
      "--sort=-committerdate",
      "--format=%(refname:strip=3)\t%(committerdate:unix)",
      `refs/remotes/${remote}`,
    ],
    root,
  );
  return output
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [name, timestamp] = line.split("\t");
      return { name, timestamp: Number(timestamp) };
    })
    .filter(({ name }) => name && name !== "HEAD" && name !== baseBranch);
};

export const listMergedLocalBranches = async ({ root = repositoryRoot, baseBranch = "main" } = {}) => {
  const baseRef = `refs/heads/${baseBranch}`;
  await git(["rev-parse", "--verify", baseRef], root);
  const output = await git(
    [
      "for-each-ref",
      "--merged",
      baseRef,
      "--sort=-committerdate",
      "--format=%(refname:strip=2)\t%(committerdate:unix)",
      "refs/heads",
    ],
    root,
  );
  return output
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [name, timestamp] = line.split("\t");
      return { name, timestamp: Number(timestamp) };
    })
    .filter(({ name }) => name && name !== baseBranch);
};

export const pruneMergedLocalBranches = async ({
  root = repositoryRoot,
  baseBranch = "main",
  keepCount = 3,
  apply = false,
} = {}) => {
  const branches = await listMergedLocalBranches({ root, baseBranch });
  const plan = planBranchRetention(branches, keepCount);
  if (!apply) return { ...plan, applied: [] };

  const applied = [];
  for (const branch of plan.pruned) {
    await execFileAsync(
      "git",
      ["merge-base", "--is-ancestor", `refs/heads/${branch.name}`, `refs/heads/${baseBranch}`],
      {
        cwd: root,
      },
    );
    await git(["branch", "-d", branch.name], root);
    applied.push(branch);
  }
  return { ...plan, applied };
};

export const pruneMergedRemoteBranches = async ({
  root = repositoryRoot,
  remote = "origin",
  baseBranch = "main",
  baseRef = `refs/remotes/${remote}/${baseBranch}`,
  keepCount = 3,
  apply = false,
} = {}) => {
  const branches = await listMergedRemoteBranches({ root, remote, baseBranch, baseRef });
  const plan = planBranchRetention(branches, keepCount);
  if (!apply) return { ...plan, applied: [] };

  const applied = [];
  for (const branch of plan.pruned) {
    const branchRef = `refs/remotes/${remote}/${branch.name}`;
    await execFileAsync("git", ["merge-base", "--is-ancestor", branchRef, baseRef], { cwd: root });
    await execFileAsync("git", ["merge-base", "--is-ancestor", branchRef, `refs/remotes/${remote}/${baseBranch}`], {
      cwd: root,
    });
    await git(["push", remote, "--delete", branch.name], root);
    applied.push(branch);
  }
  return { ...plan, applied };
};

export const printBranchRetention = ({ kept, pruned, applied }, { apply }) => {
  console.log(`Merged branch retention: keep ${kept.length}, ${apply ? "delete" : "would delete"} ${pruned.length}`);
  console.log(`Kept: ${kept.map(({ name }) => name).join(", ") || "none"}`);
  console.log(`${apply ? "Deleted" : "Dry-run deletions"}: ${pruned.map(({ name }) => name).join(", ") || "none"}`);
  if (!apply) console.log("Dry run only. Pass --apply to delete merged remote branches.");
  else if (applied.length !== pruned.length) throw new Error("Not every planned branch was deleted");
};

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const remote = argumentValue(args, "--remote", "origin");
  const baseBranch = argumentValue(args, "--base", "main");
  const baseRef = argumentValue(args, "--base-ref", `refs/remotes/${remote}/${baseBranch}`);
  const keepCount = Number(argumentValue(args, "--keep", "3"));
  const apply = args.includes("--apply");
  if (args.includes("--local")) {
    const localResult = await pruneMergedLocalBranches({ baseBranch, keepCount, apply });
    console.log("Local branches");
    printBranchRetention(localResult, { apply });
    console.log("");
  }
  const result = await pruneMergedRemoteBranches({ remote, baseBranch, baseRef, keepCount, apply });
  console.log("Remote branches");
  printBranchRetention(result, { apply });
}
