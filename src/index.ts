#!/usr/bin/env node
/**
 * agentdocs — CLI entrypoint.
 *
 * Commands:
 *   init <name>       scaffold .agentdocs/<name>/
 *   validate [path]   validate brief + tasks + playbooks
 *   preview <name>    show what an agent would see
 *   add <name>        (stub) registry pull
 *
 * Root flags: --version, --help, --json.
 */
import { Command } from "commander";
import type { ToolType } from "@biroai/agentdocs";
import { runInit } from "./commands/init.js";
import { runValidate } from "./commands/validate.js";
import { runPreview } from "./commands/preview.js";
import { runAdd } from "./commands/add.js";

const VERSION = "0.1.0";

interface RootOpts {
  json?: boolean;
}

function isJson(program: Command): boolean {
  const o = program.opts<RootOpts>();
  return Boolean(o.json);
}

async function main(argv: string[]): Promise<number> {
  const program = new Command();

  program
    .name("agentdocs")
    .description(
      "Portable, structured documentation that AI agents can actually use.",
    )
    .version(VERSION, "-v, --version", "Print CLI version and exit")
    .option("--json", "Emit machine-readable JSON on stdout", false)
    .showHelpAfterError();

  // -- init ----------------------------------------------------------------
  program
    .command("init")
    .description("Scaffold a new pack under .agentdocs/<name>/")
    .argument("<name>", "Pack name (kebab-case slug)")
    .option(
      "--kind <kind>",
      "Tool type: api | cli | sdk | internal | process",
      "api",
    )
    .option(
      "--path <dir>",
      "Base directory (defaults to current dir)",
      ".",
    )
    .option("--force", "Overwrite an existing pack", false)
    .option(
      "--from-openapi <file>",
      "Scaffold from an OpenAPI spec (coming soon)",
    )
    .action(async (name: string, cmdOpts: {
      kind: string;
      path: string;
      force: boolean;
      fromOpenapi?: string;
    }) => {
      const code = await runInit(name, {
        kind: cmdOpts.kind as ToolType,
        path: cmdOpts.path,
        force: cmdOpts.force,
        fromOpenapi: cmdOpts.fromOpenapi,
        json: isJson(program),
      });
      process.exit(code);
    });

  // -- validate ------------------------------------------------------------
  program
    .command("validate")
    .description(
      "Validate brief + tasks + playbooks against the AgentDocs spec",
    )
    .argument("[path]", "Path to `.agentdocs/` or a single pack dir")
    .action(async (target: string | undefined) => {
      const code = await runValidate(target, { json: isJson(program) });
      process.exit(code);
    });

  // -- preview -------------------------------------------------------------
  program
    .command("preview")
    .description("Print the brief, actions, and playbooks for a pack")
    .argument("<name>", "Pack name")
    .option(
      "--path <dir>",
      "Base directory containing .agentdocs/",
      ".",
    )
    .action(async (name: string, cmdOpts: { path: string }) => {
      const code = await runPreview(name, {
        path: cmdOpts.path,
        json: isJson(program),
      });
      process.exit(code);
    });

  // -- add -----------------------------------------------------------------
  program
    .command("add")
    .description("(stub) Pull a pack from the AgentDocs registry")
    .argument("<name>", "Pack name")
    .action(async (name: string) => {
      const code = await runAdd(name, { json: isJson(program) });
      process.exit(code);
    });

  try {
    await program.parseAsync(argv);
    return 0;
  } catch (err) {
    // commander throws when the user passes something invalid; it prints
    // its own error already. Normal exit codes were handled inside actions.
    const code =
      typeof (err as { exitCode?: number } | null)?.exitCode === "number"
        ? ((err as { exitCode: number }).exitCode)
        : 2;
    return code;
  }
}

main(process.argv).then(
  (code) => {
    if (code !== 0) process.exit(code);
  },
  (err) => {
    process.stderr.write(
      `agentdocs: unexpected error: ${
        err instanceof Error ? err.message : String(err)
      }\n`,
    );
    process.exit(2);
  },
);
