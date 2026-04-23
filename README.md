# agentdocs

Portable, structured documentation that AI agents can actually use. CLI for the **AgentDocs** format — `brief.md` + `tasks.yaml` + `playbooks/`.

Think of it as `npm` or `cargo`, but for AI-agent-consumable tool docs. Your repo declares what tools exist, how to call them, and what playbooks orchestrate them — and any agent (Claude Code, Cursor, Codex, MCP clients, your own glue) can read the same thing.

## Install

```bash
npm install -g @biroai/agentdocs-cli
```

Or use it with `pnpm dlx` / `npx`:

```bash
pnpm dlx agentdocs init stripe
```

## Quickstart

```bash
# Scaffold a new pack under .agentdocs/stripe/
agentdocs init stripe --kind api

# Fill in brief.md (keep it under ~500 tokens) and add actions to tasks.yaml.
# Then:
agentdocs validate
agentdocs preview stripe
```

A pack is three things, always in the same shape:

```
.agentdocs/
  stripe/
    brief.md         # injected at session start (<=500 tokens)
    tasks.yaml       # structured action catalog
    playbooks/       # multi-step flows (markdown or YAML DAG)
      create-charge.md
```

## Commands

| Command | What it does |
| --- | --- |
| `agentdocs init <name>` | Scaffold `.agentdocs/<name>/brief.md`, `tasks.yaml`, `playbooks/`. Flags: `--kind <api\|cli\|sdk\|internal\|process>`, `--path <dir>`, `--force`. |
| `agentdocs validate [path]` | Validate brief + tasks + playbooks against the spec. Default target: `./.agentdocs`. |
| `agentdocs preview <name>` | Print the brief, action summary, and playbook list for a pack. |
| `agentdocs add <name>` | *(stub)* Registry pull — coming soon. |

Root flags: `--version`, `--help`, `--json`. Pass `--json` to get machine-readable output for any command.

### Exit codes

| Code | Meaning |
| --- | --- |
| 0 | Success (warnings are OK) |
| 1 | Validation error, usage error, or missing pack |
| 2 | Unexpected crash |

## Schemas

Schemas and validators live in [`@biroai/agentdocs`](https://www.npmjs.com/package/@biroai/agentdocs) and are also published to npm. If you want to validate packs inside your own tooling without shelling out to this CLI, depend on that package directly.

## Roadmap

- **`agentdocs add <name>`** — pull published packs from the AgentDocs registry.
- **`agentdocs init --from-openapi <file>`** — scaffold `tasks.yaml` from an OpenAPI document.
- **`agentdocs init --from-mcp <endpoint>`** — scaffold from an MCP server's tool list.
- **Markdown playbook validation** — v1 only validates YAML DAG playbooks; markdown playbooks are displayed as-is.

See [github.com/Tim-ReJet/agentdocs-cli](https://github.com/Tim-ReJet/agentdocs-cli) for the roadmap, and [`@biroai/agentdocs` on npm](https://www.npmjs.com/package/@biroai/agentdocs) for the spec schemas.

## License

MIT © 2026 Biro AI
