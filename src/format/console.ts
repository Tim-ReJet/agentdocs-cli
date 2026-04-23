/**
 * Human-facing console formatting helpers.
 *
 * Kept small and dependency-light (picocolors only) so `--json` output
 * never pulls these in. All functions return strings; writing is the
 * caller's job.
 */
import pc from "picocolors";
import type { ValidationIssue } from "@biroai/agentdocs";

export const tick = (): string => pc.green("✓");
export const cross = (): string => pc.red("✗");
export const dim = (s: string): string => pc.dim(s);
export const bold = (s: string): string => pc.bold(s);
export const yellow = (s: string): string => pc.yellow(s);

export function formatIssue(issue: ValidationIssue): string {
  const color = issue.severity === "error" ? pc.red : pc.yellow;
  const label = color(issue.severity === "error" ? "✗" : "!");
  const path = issue.path ? pc.dim(issue.path + ": ") : "";
  return `  ${label} ${path}${issue.message}`;
}

export function formatFileOk(relPath: string): string {
  return `  ${tick()} ${relPath}`;
}

export function formatFileFail(relPath: string): string {
  return `  ${cross()} ${relPath}`;
}

/**
 * Render a simple text table with 2-space column padding. No truncation;
 * tables in a CLI are fine to overflow the terminal width — we optimize
 * for paste-ability, not prettiness.
 */
export function renderTable(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)),
  );
  const fmt = (cells: string[]): string =>
    cells.map((c, i) => (c ?? "").padEnd(widths[i])).join("  ").trimEnd();
  const separator = widths.map((w) => "-".repeat(w)).join("  ");
  const lines = [fmt(headers), pc.dim(separator), ...rows.map(fmt)];
  return lines.join("\n");
}

/**
 * Summary line shared by `validate`:
 *   "2 packs, 5 files checked — 0 errors, 1 warning"
 */
export function summaryLine(
  packCount: number,
  fileCount: number,
  errorCount: number,
  warningCount: number,
): string {
  const parts: string[] = [];
  parts.push(`${packCount} pack${packCount === 1 ? "" : "s"}`);
  parts.push(`${fileCount} file${fileCount === 1 ? "" : "s"} checked`);
  const status =
    errorCount > 0
      ? pc.red(`${errorCount} error${errorCount === 1 ? "" : "s"}`)
      : pc.green("0 errors");
  const warn =
    warningCount > 0
      ? pc.yellow(`${warningCount} warning${warningCount === 1 ? "" : "s"}`)
      : pc.dim("0 warnings");
  return `${parts.join(", ")} — ${status}, ${warn}`;
}
