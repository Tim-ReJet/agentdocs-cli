/**
 * Filesystem loader for AgentDocs packs.
 *
 * An AgentDocs "pack" lives at `.agentdocs/<name>/`:
 *   - brief.md
 *   - tasks.yaml
 *   - playbooks/*.{md,yaml,yml}
 *
 * Loaders return raw strings AND (best-effort) parsed structures so
 * the caller can choose between validation and display without re-reading.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import type { TasksDocument } from "@biroai/agentdocs";

export interface LoadedPlaybook {
  slug: string;
  /** Raw file contents, whatever the extension. */
  body: string;
  /** File extension without dot ("md", "yaml", "yml"). */
  kind: "md" | "yaml" | "yml";
  /** Parsed YAML object when kind is yaml/yml; null on parse failure. */
  parsed: unknown;
}

export interface LoadedPack {
  /** Absolute path to the pack directory. */
  dir: string;
  /** Basename of `dir` — the pack's slug. */
  name: string;
  brief: string | null;
  tasksYamlRaw: string | null;
  /**
   * Parsed tasks.yaml as plain JS. Not schema-validated; `null` if the file
   * doesn't exist or is unparseable YAML. Use `validateTasksDocument` from
   * `@biroai/agentdocs` against this value.
   */
  tasks: unknown;
  playbooks: LoadedPlaybook[];
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

async function readIfExists(p: string): Promise<string | null> {
  try {
    return await fs.readFile(p, "utf8");
  } catch {
    return null;
  }
}

/**
 * Load a single pack directory.
 *
 * @param dir - Absolute path to the pack dir (e.g. `/proj/.agentdocs/stripe`).
 */
export async function loadPack(dir: string): Promise<LoadedPack> {
  const absDir = path.resolve(dir);
  const name = path.basename(absDir);

  const brief = await readIfExists(path.join(absDir, "brief.md"));
  const tasksYamlRaw = await readIfExists(path.join(absDir, "tasks.yaml"));

  let tasks: unknown = null;
  if (tasksYamlRaw !== null) {
    try {
      tasks = parseYaml(tasksYamlRaw);
    } catch {
      tasks = null;
    }
  }

  const playbooksDir = path.join(absDir, "playbooks");
  const playbooks: LoadedPlaybook[] = [];
  if (await fileExists(playbooksDir)) {
    const entries = await fs.readdir(playbooksDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).slice(1).toLowerCase();
      if (ext !== "md" && ext !== "yaml" && ext !== "yml") continue;
      const slug = entry.name.slice(0, entry.name.length - ext.length - 1);
      const body = await fs.readFile(path.join(playbooksDir, entry.name), "utf8");
      let parsed: unknown = null;
      if (ext === "yaml" || ext === "yml") {
        try {
          parsed = parseYaml(body);
        } catch {
          parsed = null;
        }
      }
      playbooks.push({ slug, body, kind: ext, parsed });
    }
    playbooks.sort((a, b) => a.slug.localeCompare(b.slug));
  }

  return {
    dir: absDir,
    name,
    brief,
    tasksYamlRaw,
    tasks,
    playbooks,
  };
}

/**
 * Discover every pack inside a `.agentdocs/` directory.
 *
 * @param agentdocsDir - Absolute path to a `.agentdocs` directory.
 *   Non-existent dirs return an empty list (callers decide whether that's
 *   a usage error).
 */
export async function discoverPacks(agentdocsDir: string): Promise<string[]> {
  const abs = path.resolve(agentdocsDir);
  if (!(await fileExists(abs))) return [];
  const entries = await fs.readdir(abs, { withFileTypes: true });
  const dirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => path.join(abs, e.name))
    .sort();
  return dirs;
}

/**
 * Detect whether `target` is a single-pack dir (has `tasks.yaml` at root)
 * or a `.agentdocs` dir with many packs inside.
 */
export async function classifyTarget(
  target: string,
): Promise<{ kind: "pack" | "agentdocs"; path: string }> {
  const abs = path.resolve(target);
  const tasksYaml = path.join(abs, "tasks.yaml");
  if (await fileExists(tasksYaml)) {
    return { kind: "pack", path: abs };
  }
  return { kind: "agentdocs", path: abs };
}

export function isTasksDocument(value: unknown): value is TasksDocument {
  // Shallow shape check — real validation happens via
  // validateTasksDocument from @biroai/agentdocs.
  return (
    typeof value === "object" &&
    value !== null &&
    "tool" in value &&
    "actions" in value
  );
}
