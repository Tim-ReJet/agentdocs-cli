/**
 * `agentdocs init <name>` — scaffold a new pack under `.agentdocs/<name>/`.
 */
import path from "node:path";
import pc from "picocolors";
import type { ToolType } from "@biroai/agentdocs";
import { scaffoldPack } from "../fs/write.js";
import { printJson } from "../format/json.js";

export interface InitOptions {
  kind: ToolType;
  path: string;
  force: boolean;
  fromOpenapi?: string;
  json: boolean;
}

const VALID_KINDS: readonly ToolType[] = [
  "api",
  "cli",
  "sdk",
  "internal",
  "process",
];

/**
 * Returns an exit code (0 success, 1 user/validation error, 2 crash).
 * Does not call process.exit itself — the root CLI decides when to exit.
 */
export async function runInit(
  name: string,
  opts: InitOptions,
): Promise<number> {
  if (opts.fromOpenapi) {
    const msg =
      "--from-openapi is coming soon. For v0.1, run `agentdocs init <name>` then fill tasks.yaml by hand.";
    if (opts.json) {
      printJson({ ok: true, stub: "from-openapi", message: msg });
    } else {
      process.stdout.write(pc.dim(msg) + "\n");
    }
    return 0;
  }

  if (!VALID_KINDS.includes(opts.kind)) {
    const msg = `Invalid --kind "${opts.kind}". Must be one of: ${VALID_KINDS.join(
      ", ",
    )}.`;
    if (opts.json) {
      printJson({ ok: false, error: msg });
    } else {
      process.stderr.write(pc.red(msg) + "\n");
    }
    return 1;
  }

  // A naive slug sanity check that mirrors the spec's slugSchema. We don't
  // import the zod schema here because a validation error from zod would
  // be noisier than we want for a CLI prompt.
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
    const msg = `Pack name "${name}" is not a valid kebab-case slug (a-z, 0-9, single dashes).`;
    if (opts.json) {
      printJson({ ok: false, error: msg });
    } else {
      process.stderr.write(pc.red(msg) + "\n");
    }
    return 1;
  }

  try {
    const result = await scaffoldPack({
      name,
      kind: opts.kind,
      baseDir: opts.path,
      force: opts.force,
    });

    if (opts.json) {
      printJson({
        ok: true,
        packDir: result.packDir,
        created: result.created,
      });
      return 0;
    }

    const rel = path.relative(process.cwd(), result.packDir) || result.packDir;
    process.stdout.write(
      `${pc.green("✓")} Created AgentDocs pack at ${pc.bold(rel)}\n`,
    );
    for (const file of result.created) {
      const frel = path.relative(process.cwd(), file) || file;
      process.stdout.write(`  ${pc.dim("•")} ${frel}\n`);
    }
    process.stdout.write(
      "\n" +
        pc.dim("Next steps:") +
        "\n" +
        pc.dim("  1. Fill out brief.md (keep it under ~500 tokens).\n") +
        pc.dim("  2. Add actions to tasks.yaml.\n") +
        pc.dim(`  3. Run \`agentdocs validate ${rel}\` to check your work.\n`),
    );
    return 0;
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    const msg = e?.message ?? String(err);
    if (opts.json) {
      printJson({ ok: false, error: msg, code: e?.code });
    } else {
      process.stderr.write(pc.red("✗ " + msg) + "\n");
    }
    return 1;
  }
}
