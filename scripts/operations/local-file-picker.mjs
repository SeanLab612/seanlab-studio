import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const parseChosenFilePaths = (stdout) =>
  String(stdout ?? "")
    .split(/\r?\n/u)
    .map((item) => item.trim())
    .filter(Boolean);

const pickerScript = ({ multiple, prompt }) => `
set pickedFiles to choose file with prompt ${JSON.stringify(prompt)}${multiple ? " with multiple selections allowed" : ""}
set output to ""
${multiple ? "repeat with pickedFile in pickedFiles\nset output to output & POSIX path of pickedFile & linefeed\nend repeat" : "set output to POSIX path of pickedFiles"}
return output
`;

export const chooseLocalFiles = async (
  { multiple = true, prompt = "选择本地素材" } = {},
  { execute = execFileAsync } = {},
) => {
  try {
    const { stdout } = await execute("osascript", ["-e", pickerScript({ multiple, prompt })], {
      timeout: 10 * 60_000,
      maxBuffer: 2_000_000,
    });
    return parseChosenFilePaths(stdout);
  } catch (error) {
    if (error?.code === 1 && /(?:User canceled|-128)/iu.test(`${error.stderr ?? ""} ${error.message ?? ""}`)) return [];
    throw error;
  }
};
