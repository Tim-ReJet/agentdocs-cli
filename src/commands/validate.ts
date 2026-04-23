/**
 * `agentdocs validate [path]` — validate brief + tasks + playbooks against
 * the AgentDocs spec.
 *
 * Default path: `.agentdocs/` (validates every pack inside). Path can also
 * be a single pack dir (`.agentdocs/<name>`) or an arbitrary dir that
 * contains `tasks.yaml` at the root.
 */
import path from "node:path";
import pc from "picocolors";
import {
  validateBriefContent,
  validateTasksDocument,
  validatePlaybookDag,
  type ValidationIssue,
} from "@biroai/agentdocs";
import {
  classifyTarget,
  discoverPacks,
  loadPack,
  type LoadedPack,
} from "../fs/load.js";
import {
  formatFileOk,
  formatIssue,
  summaryLine,
  bold,
} from "../format/console.js";
import { printJson } from "../format/json.js";

export interface ValidateOptions {
  json: boolean;
}

export interface FileResult {
  file: string;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export interface PackResult {
  name: string;
  dir: string;
  files: FileResult[];
  ok: boolean;
  errorCount: number;
  warningCount: number;
}

function push(
  target: FileResult,
  issues: ValidationIssue[] | undefined,
  severity: "error" | "warning",
): void {
  if (!issues) return;
  for (const issue of issues) {
    if (severity === "error") target.errors.push(issue);
    else target.warnings.push(issue);
  }
}

async function validateOnePack(pack: LoadedPack): Promise<PackResult> {
  const files: FileResult[] = [];

  // brief.md
  {
    const f: FileResult = { file: "brief.md", errors: [], warnings: [] };
    if (pack.brief === null) {
      f.errors.push({
        path: "brief.md",
        message: "file not found",
        severity: "error",
      });
    } else {
      const res = validateBriefContent(pack.brief);
      push(f, res.errors, "error");
      push(f, res.warnings, "warning");
    }
    files.push(f);
  }

  // tasks.yaml
  {
    const f: FileResult = { file: "tasks.yaml", errors: [], warnings: [] };
    if (pack.tasksYamlRaw === null) {
      f.errors.push({
        path: "tasks.yaml",
        message: "file not found",
        severity: "error",
      });
    } else if (pack.tasks === null) {
      f.errors.push({
        path: "tasks.yaml",
        message: "file is not valid YAML",
        severity: "error",
      });
    } else {
      const res = validateTasksDocument(pack.tasks);
      push(f, res.errors, "error");
      push(f, res.warnings, "warning");
    }
    files.push(f);
  }

  // playbooks — markdown playbooks are skipped in v1; only validate YAML DAGs.
  for (const pb of pack.playbooks) {
    const rel = `playbooks/${pb.slug}.${pb.kind}`;
    const f: FileResult = { file: rel, errors: [], warnings: [] };
    if (pb.kind === "md") {
      // Skipped; still record as present for the summary.
    } else if (pb.parsed === null) {
      f.errors.push({
        path: rel,
        message: "file is not valid YAML",
        severity: "error",
      });
    } else {
      const res = validatePlaybookDag(pb.parsed);
      push(f, res.errors, "error");
      push(f, res.warnings, "warning");
    }
    files.push(f);
  }

  let errorCount = 0;
  let warningCount = 0;
  for (const f of files) {
    errorCount += f.errors.length;
    warningCount += f.warnings.length;
  }

  return {
    name: pack.name,
    dir: pack.dir,
    files,
    ok: errorCount === 0,
    errorCount,
    warningCount,
  };
}

function printPackConsole(pack: PackResult): void {
  process.stdout.write(bold(pack.name) + pc.dim(`  (${pack.dir})`) + "\n");
  for (const f of pack.files) {
    if (f.errors.length === 0) {
      process.stdout.write(formatFileOk(f.file) + "\n");
    } else {
      process.stdout.write(
        `  ${pc.red("✗")} ${f.file}\n`,
      );
    }
    for (const issue of f.errors) {
      process.stdout.write(formatIssue(issue) + "\n");
    }
    for (const issue of f.warnings) {
      process.stdout.write(formatIssue(issue) + "\n");
    }
  }
}

export async function runValidate(
  rawTarget: string | undefined,
  opts: ValidateOptions,
): Promise<number> {
  const target = rawTarget ?? path.join(process.cwd(), ".agentdocs");
  const classified = await classifyTarget(target);

  let packs: PackResult[] = [];

  if (classified.kind === "pack") {
    const loaded = await loadPack(classified.path);
    packs.push(await validateOnePack(loaded));
  } else {
    const packDirs = await discoverPacks(classified.path);
    if (packDirs.length === 0) {
      const msg = `No packs found at ${classified.path}. Run \`agentdocs init <name>\` to create one.`;
      if (opts.json) {
        printJson({ ok: false, error: msg, packs: [] });
      } else {
        process.stderr.write(pc.red("✗ " + msg) + "\n");
      }
      return 1;
    }
    for (const dir of packDirs) {
      const loaded = await loadPack(dir);
      packs.push(await validateOnePack(loaded));
    }
  }

  const totalErrors = packs.reduce((s, p) => s + p.errorCount, 0);
  const totalWarnings = packs.reduce((s, p) => s + p.warningCount, 0);
  const totalFiles = packs.reduce((s, p) => s + p.files.length, 0);
  const ok = totalErrors === 0;

  if (opts.json) {
    printJson({
      ok,
      packs: packs.map((p) => ({
        name: p.name,
        dir: p.dir,
        ok: p.ok,
        files: p.files,
        errors: p.files.flatMap((f) => f.errors),
        warnings: p.files.flatMap((f) => f.warnings),
      })),
      summary: {
        packCount: packs.length,
        fileCount: totalFiles,
        errorCount: totalErrors,
        warningCount: totalWarnings,
      },
    });
    return ok ? 0 : 1;
  }

  for (const p of packs) {
    printPackConsole(p);
    process.stdout.write("\n");
  }
  process.stdout.write(
    summaryLine(packs.length, totalFiles, totalErrors, totalWarnings) + "\n",
  );

  return ok ? 0 : 1;
}
