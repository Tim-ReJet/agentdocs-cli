/**
 * `agentdocs preview <name>` — print the brief, an action summary, and the
 * list of playbooks, roughly as an agent would see them at session start.
 *
 * Default layout matches what we'd want in a PR review ("what changed when
 * this pack was updated?"). `--json` emits a structured equivalent.
 */
import path from "node:path";
import pc from "picocolors";
import { loadPack, isTasksDocument } from "../fs/load.js";
import { renderTable, bold, dim } from "../format/console.js";
import { printJson } from "../format/json.js";

export interface PreviewOptions {
  path: string;
  json: boolean;
}

/**
 * Rough token estimate — mirrors the spec's default (bytes / 4). Good
 * enough for a CLI preview; not a tokenizer.
 */
function estimateTokens(s: string): number {
  return Math.max(1, Math.ceil(Buffer.byteLength(s, "utf8") / 4));
}

interface ActionSummary {
  name: string;
  type: string;
  description: string;
}

export async function runPreview(
  name: string,
  opts: PreviewOptions,
): Promise<number> {
  const packDir = path.join(path.resolve(opts.path), ".agentdocs", name);
  const pack = await loadPack(packDir);

  // A pack is "preview-able" as long as SOMETHING exists.
  const hasAnything =
    pack.brief !== null ||
    pack.tasksYamlRaw !== null ||
    pack.playbooks.length > 0;

  if (!hasAnything) {
    const msg = `No pack found at ${packDir}. Run \`agentdocs init ${name}\` first.`;
    if (opts.json) {
      printJson({ ok: false, error: msg });
    } else {
      process.stderr.write(pc.red("✗ " + msg) + "\n");
    }
    return 1;
  }

  const briefTokens = pack.brief ? estimateTokens(pack.brief) : 0;

  const actions: ActionSummary[] = [];
  if (isTasksDocument(pack.tasks)) {
    for (const action of pack.tasks.actions) {
      actions.push({
        name: action.name,
        type:
          action.method && action.path
            ? `${action.method} ${action.path}`
            : (action.command ?? "—"),
        description: (action.description ?? "").replace(/\s+/g, " ").trim(),
      });
    }
  }

  const playbooks = pack.playbooks.map((p) => ({
    slug: p.slug,
    kind: p.kind,
  }));

  if (opts.json) {
    printJson({
      ok: true,
      name: pack.name,
      dir: pack.dir,
      brief: {
        content: pack.brief,
        estimatedTokens: briefTokens,
      },
      actions,
      playbooks,
    });
    return 0;
  }

  // Console layout
  process.stdout.write(bold(`# ${pack.name}`) + "\n\n");

  if (pack.brief) {
    process.stdout.write(
      dim(`brief.md  (~${briefTokens} tokens)`) + "\n",
    );
    process.stdout.write(pack.brief.trimEnd() + "\n\n");
  } else {
    process.stdout.write(dim("brief.md — missing") + "\n\n");
  }

  process.stdout.write(
    dim(`tasks.yaml — ${actions.length} action${actions.length === 1 ? "" : "s"}`) +
      "\n",
  );
  if (actions.length > 0) {
    process.stdout.write(
      renderTable(
        ["name", "type", "description"],
        actions.map((a) => [a.name, a.type, a.description]),
      ) + "\n",
    );
  }
  process.stdout.write("\n");

  process.stdout.write(
    dim(
      `playbooks/ — ${playbooks.length} file${playbooks.length === 1 ? "" : "s"}`,
    ) + "\n",
  );
  for (const pb of playbooks) {
    process.stdout.write(`  • ${pb.slug}.${pb.kind}\n`);
  }

  return 0;
}
