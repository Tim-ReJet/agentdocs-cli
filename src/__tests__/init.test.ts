import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { runInit } from "../commands/init.js";

let tmp: string;
let stdoutCapture: string[];
let stderrCapture: string[];
const originalStdout = process.stdout.write.bind(process.stdout);
const originalStderr = process.stderr.write.bind(process.stderr);

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "agentdocs-init-"));
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

describe("init", () => {
  it("creates expected tree for `init stripe`", async () => {
    const code = await runInit("stripe", {
      kind: "api",
      path: tmp,
      force: false,
      json: false,
    });
    expect(code).toBe(0);

    const packDir = path.join(tmp, ".agentdocs", "stripe");
    const brief = await fs.readFile(path.join(packDir, "brief.md"), "utf8");
    const tasks = await fs.readFile(path.join(packDir, "tasks.yaml"), "utf8");
    const playbooksStat = await fs.stat(path.join(packDir, "playbooks"));

    expect(brief).toContain("# Stripe");
    expect(brief).toContain(".agentdocs/stripe/tasks.yaml");
    expect(tasks).toContain("tool: stripe");
    expect(tasks).toContain("type: api");
    expect(tasks).toContain("actions: []");
    expect(playbooksStat.isDirectory()).toBe(true);
  });

  it("writes `type: cli` when --kind cli", async () => {
    const code = await runInit("mycli", {
      kind: "cli",
      path: tmp,
      force: false,
      json: false,
    });
    expect(code).toBe(0);

    const tasks = await fs.readFile(
      path.join(tmp, ".agentdocs", "mycli", "tasks.yaml"),
      "utf8",
    );
    expect(tasks).toContain("type: cli");
    expect(tasks).not.toContain("type: api");
  });

  it("refuses to overwrite existing pack, accepts --force", async () => {
    // First init succeeds.
    const code1 = await runInit("stripe", {
      kind: "api",
      path: tmp,
      force: false,
      json: false,
    });
    expect(code1).toBe(0);

    // Second init with same name fails.
    const code2 = await runInit("stripe", {
      kind: "api",
      path: tmp,
      force: false,
      json: false,
    });
    expect(code2).toBe(1);
    const stderr = stderrCapture.join("");
    expect(stderr.toLowerCase()).toContain("already exists");

    // Mutate a file so we can see force actually overwrites.
    const briefPath = path.join(tmp, ".agentdocs", "stripe", "brief.md");
    await fs.writeFile(briefPath, "DIRTY", "utf8");

    const code3 = await runInit("stripe", {
      kind: "api",
      path: tmp,
      force: true,
      json: false,
    });
    expect(code3).toBe(0);
    const after = await fs.readFile(briefPath, "utf8");
    expect(after).not.toBe("DIRTY");
    expect(after).toContain("# Stripe");
  });

  it("prints a coming-soon stub for --from-openapi", async () => {
    const code = await runInit("stripe", {
      kind: "api",
      path: tmp,
      force: false,
      fromOpenapi: "/nonexistent/openapi.yaml",
      json: false,
    });
    expect(code).toBe(0);
    const out = stdoutCapture.join("");
    expect(out.toLowerCase()).toContain("coming soon");

    // No scaffolding should have happened.
    await expect(
      fs.stat(path.join(tmp, ".agentdocs", "stripe")),
    ).rejects.toThrow();
  });
});
