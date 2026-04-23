/**
 * Filesystem writer for scaffolding new AgentDocs packs.
 *
 * Writes the three-file convention into `<baseDir>/.agentdocs/<name>/`:
 *   - brief.md   (prose, budget ≤ ~500 tokens)
 *   - tasks.yaml (structured action catalog)
 *   - playbooks/ (dir, empty on init)
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import type { ToolType } from "@biroai/agentdocs";

export interface ScaffoldOptions {
  /** The pack name, e.g. "stripe". Used as the directory slug. */
  name: string;
  /** Tool type — `api | cli | sdk | internal | process`. */
  kind: ToolType;
  /** Base directory for the project that will contain `.agentdocs/`. */
  baseDir: string;
  /** Overwrite existing pack if it exists. */
  force?: boolean;
}

export interface ScaffoldResult {
  packDir: string;
  created: string[];
}

function toTitle(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((s) => s[0].toUpperCase() + s.slice(1))
    .join(" ");
}

function briefTemplate(name: string): string {
  const title = toTitle(name);
  return `# ${title}

<One-paragraph description — what, how to invoke, auth.>

Core capabilities: <…>.

Read .agentdocs/${name}/tasks.yaml for endpoint reference. Playbooks in playbooks/.
`;
}

function tasksTemplate(name: string, kind: ToolType): string {
  return `tool: ${name}
version: "latest"
type: ${kind}
actions: []
`;
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

export async function scaffoldPack(opts: ScaffoldOptions): Promise<ScaffoldResult> {
  const agentdocsDir = path.join(path.resolve(opts.baseDir), ".agentdocs");
  const packDir = path.join(agentdocsDir, opts.name);

  if (await pathExists(packDir)) {
    if (!opts.force) {
      const err = new Error(
        `Pack already exists at ${packDir} (use --force to overwrite)`,
      );
      (err as NodeJS.ErrnoException).code = "EEXIST";
      throw err;
    }
  }

  await fs.mkdir(path.join(packDir, "playbooks"), { recursive: true });

  const briefPath = path.join(packDir, "brief.md");
  const tasksPath = path.join(packDir, "tasks.yaml");

  await fs.writeFile(briefPath, briefTemplate(opts.name), "utf8");
  await fs.writeFile(tasksPath, tasksTemplate(opts.name, opts.kind), "utf8");

  return {
    packDir,
    created: [briefPath, tasksPath, path.join(packDir, "playbooks")],
  };
}
