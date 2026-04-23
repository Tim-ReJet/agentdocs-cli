import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { runValidate } from "../commands/validate.js";

let tmp: string;
let stdoutCapture: string[];
let stderrCapture: string[];
const originalStdout = process.stdout.write.bind(process.stdout);
const originalStderr = process.stderr.write.bind(process.stderr);

// ANSI stripper for assertions — colors are real in color mode, so the raw
// capture has escape sequences.
// eslint-disable-next-line no-control-regex
const ANSI = /\x1b\[[0-9;]*m/g;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "agentdocs-validate-"));
  stdoutCapture = [];
  stderrCapture = [];
  process.stdout.write = ((chunk: string | Uint8Array): boolean => {
    stdoutCapture.push(chunk.toString());
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string | Uint8Array): boolean => {
    stderrCapture.push(chunk.toString());
    return true;
  }) as typeof process.stderr.write;
});

afterEach(async () => {
  process.stdout.write = originalStdout;
  process.stderr.write = originalStderr;
  await fs.rm(tmp, { recursive: true, force: true });
});

async function writePack(
  baseDir: string,
  name: string,
  files: { brief: string; tasksYaml: string },
): Promise<string> {
  const packDir = path.join(baseDir, ".agentdocs", name);
  await fs.mkdir(path.join(packDir, "playbooks"), { recursive: true });
  await fs.writeFile(path.join(packDir, "brief.md"), files.brief, "utf8");
  await fs.writeFile(path.join(packDir, "tasks.yaml"), files.tasksYaml, "utf8");
  return packDir;
}

const MIN_VALID_TASKS = `tool: stripe
version: "latest"
type: api
actions:
  - name: create-charge
    description: Charge a card.
    method: POST
    path: /v1/charges
`;

const MIN_VALID_BRIEF = `# Stripe

Tiny valid brief well under the 500-token budget.

Read .agentdocs/stripe/tasks.yaml for endpoint reference.
`;

describe("validate", () => {
  it("valid pack: all ✓, exit 0", async () => {
    await writePack(tmp, "stripe", {
      brief: MIN_VALID_BRIEF,
      tasksYaml: MIN_VALID_TASKS,
    });
    const code = await runValidate(path.join(tmp, ".agentdocs"), {
      json: false,
    });
    expect(code).toBe(0);
    const out = stdoutCapture.join("").replace(ANSI, "");
    expect(out).toContain("✓ brief.md");
    expect(out).toContain("✓ tasks.yaml");
    expect(out).toMatch(/0 errors/);
  });

  it("brief over budget → ✗ with message, exit 1", async () => {
    // > 2000 bytes = over budget.
    const huge = "x".repeat(3000);
    await writePack(tmp, "stripe", {
      brief: huge,
      tasksYaml: MIN_VALID_TASKS,
    });
    const code = await runValidate(path.join(tmp, ".agentdocs"), {
      json: false,
    });
    expect(code).toBe(1);
    const out = stdoutCapture.join("").replace(ANSI, "");
    expect(out).toContain("✗ brief.md");
    // budget language varies, but some complaint about size must surface.
    expect(out.toLowerCase()).toMatch(/token|byte|line|budget|exceed/);
  });

  it("malformed tasks.yaml (missing `tool`) → ✗ with zod path", async () => {
    await writePack(tmp, "stripe", {
      brief: MIN_VALID_BRIEF,
      tasksYaml: `version: "latest"
type: api
actions:
  - name: ok
    method: GET
    path: /x
`,
    });
    const code = await runValidate(path.join(tmp, ".agentdocs"), {
      json: false,
    });
    expect(code).toBe(1);
    const out = stdoutCapture.join("").replace(ANSI, "");
    expect(out).toContain("✗ tasks.yaml");
    expect(out).toContain("tool");
  });

  it("--json produces parseable JSON with no ANSI", async () => {
    await writePack(tmp, "stripe", {
      brief: MIN_VALID_BRIEF,
      tasksYaml: MIN_VALID_TASKS,
    });
    const code = await runValidate(path.join(tmp, ".agentdocs"), {
      json: true,
    });
    expect(code).toBe(0);
    const raw = stdoutCapture.join("");
    expect(raw).not.toMatch(ANSI);
    const parsed = JSON.parse(raw);
    expect(parsed.ok).toBe(true);
    expect(Array.isArray(parsed.packs)).toBe(true);
    expect(parsed.packs[0].name).toBe("stripe");
    expect(parsed.summary.errorCount).toBe(0);
  });

  it("path targeting a single pack is scoped to that pack", async () => {
    await writePack(tmp, "stripe", {
      brief: MIN_VALID_BRIEF,
      tasksYaml: MIN_VALID_TASKS,
    });
    // Write a SECOND broken pack — if we validate only `stripe`, it must
    // still succeed.
    await writePack(tmp, "broken", {
      brief: MIN_VALID_BRIEF,
      tasksYaml: "not: valid\nno_actions: here\n",
    });

    const code = await runValidate(
      path.join(tmp, ".agentdocs", "stripe"),
      { json: true },
    );
    expect(code).toBe(0);
    const parsed = JSON.parse(stdoutCapture.join(""));
    expect(parsed.packs).toHaveLength(1);
    expect(parsed.packs[0].name).toBe("stripe");
  });
});
