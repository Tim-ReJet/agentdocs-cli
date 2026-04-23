/**
 * `agentdocs add <name>` — stub for the forthcoming registry pull command.
 *
 * v0.1 just prints a note. The eventual implementation will fetch a
 * published pack from the AgentDocs registry and write it under
 * `.agentdocs/<name>/`.
 */
import pc from "picocolors";
import { printJson } from "../format/json.js";

export interface AddOptions {
  json: boolean;
}

export async function runAdd(name: string, opts: AddOptions): Promise<number> {
  const lines = [
    "Registry integration coming soon.",
    `For now: run \`agentdocs init ${name}\` to scaffold a new pack locally.`,
    "See https://github.com/biroai/agentdocs for roadmap.",
  ];
  if (opts.json) {
    printJson({
      ok: true,
      stub: "registry",
      name,
      message: lines.join(" "),
    });
    return 0;
  }
  for (const line of lines) {
    process.stdout.write(pc.dim(line) + "\n");
  }
  return 0;
}
