import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const stateSchema = z.object({ userId: z.string().min(1) });
const stateFileName = "portfolio-collector-state.json";

function statePath(profileDir: string) {
  return path.join(path.resolve(profileDir), stateFileName);
}

export async function readLocalSessionState(profileDir: string) {
  try {
    return stateSchema.parse(
      JSON.parse(await readFile(statePath(profileDir), "utf8")),
    );
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return null;
    }
    throw error;
  }
}

export async function writeLocalSessionState(
  profileDir: string,
  state: z.infer<typeof stateSchema>,
) {
  const directory = path.resolve(profileDir);
  const target = statePath(profileDir);
  const temporary = `${target}.tmp`;
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(temporary, `${JSON.stringify(state)}\n`, { mode: 0o600 });
  await rename(temporary, target);
}
