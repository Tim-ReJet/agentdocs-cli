import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { runPreview } from "../commands/preview.js";

let tmp: string;
let stdoutCapture: string[];
let stderrCapture: string[];
const originalStdout = process.stdout.write.bind(process.stdout);
const originalStderr = process.stderr.write.bind(process.stderr);

// eslint-disable-next-line no-control-regex
const ANSI = /\x1b\[[0-9;]*m/g;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "agentdocs-preview-"));
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

const BRIEF = `# Stripe

Payments API.

Read .agentdocs/stripe/tasks.yaml.
`;

const TASKS = `tool: stripe
version: "latest"
type: api
actions:
  - name: create-charge
    description: Charge a card.
    method: POST
    path: /v1/charges
  - name: refund
    description: Refund a charge.
    method: POST
    path: /v1/refunds
`;

async function writeStripePack(baseDir: string): Promise<void> {
  const packDir = path.join(baseDir, ".agentdocs", "stripe");
  await fs.mkdir(path.join(packDir, "playbooks"), { recursive: true });
  await fs.writeFile(path.join(packDir, "brief.md"), BRIEF, "utf8");
  await fs.writeFile(path.join(packDir, "tasks.yaml"), TASKS, "utf8");
  await fs.writeFile(
    path.join(packDir, "playbooks", "refund.md"),
    "# Refund playbook\n\nSteps go here.\n",
    "utf8",
  );
}

describe("preview", () => {
  it("valid pack: prints brief body + action count", async () => {
    await writeStripePack(tmp);
    const code = await runPreview("stripe", { path: tmp, json: false });
    expect(code).toBe(0);
    const out = stdoutCapture.join("").replace(ANSI, "");
    expect(out).toContain("# stripe");
    expect(out).toContain("Payments API.");
    expect(out).toContain("2 actions");
    expect(out).toContain("create-charge");
    expect(out).toContain("POST /v1/charges");
    expect(out).toContain("refund.md");
  });

  it("non-existent pack: error, exit 1", async () => {
    const code = await runPreview("nope", { path: tmp, json: false });
    expect(code).toBe(1);
    const err = stderrCapture.join("").replace(ANSI, "");
    expect(err.toLowerCase()).toContain("no pack found");
  });

  it("--json emits structured output", async () => {
    await writeStripePack(tmp);
    const code = await runPreview("stripe", { path: tmp, json: true });
    expect(code).toBe(0);
    const raw = stdoutCapture.join("");
    expect(raw).not.toMatch(ANSI);
    const parsed = JSON.parse(raw);
    expect(parsed.ok).toBe(true);
    expect(parsed.name).toBe("stripe");
    expect(parsed.brief.content).toContain("Payments API.");
    expect(parsed.brief.estimatedTokens).toBeGreaterThan(0);
    expect(parsed.actions).toHaveLength(2);
    expect(parsed.actions[0]).toMatchObject({
      name: "create-charge",
      description: "Charge a card.",
    });
    expect(parsed.playbooks).toEqual([{ slug: "refund", kind: "md" }]);
  });
});
