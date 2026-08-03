import { lstat, mkdir, readlink, symlink } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";

const codexHome = process.env.CODEX_HOME ? resolve(process.env.CODEX_HOME) : resolve(homedir(), ".codex");
const skillNames = ["remotion-md-creator-workflow", "remotion-md-narration-script", "remotion-md-video-workflow"];

for (const skillName of skillNames) {
  const source = resolve("skills", skillName);
  const target = resolve(codexHome, "skills", skillName);
  await mkdir(dirname(target), { recursive: true });
  try {
    const info = await lstat(target);
    if (!info.isSymbolicLink())
      throw new Error(`${target} exists and is not a symbolic link; refusing to overwrite it`);
    const current = resolve(dirname(target), await readlink(target));
    if (current !== source) throw new Error(`${target} points elsewhere; refusing to overwrite it`);
    console.log(JSON.stringify({ event: "skill.already-installed", skillName, source, target }));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await symlink(source, target, "dir");
    console.log(JSON.stringify({ event: "skill.installed", skillName, source, target }));
  }
}
