/**
 * JSON output helpers.
 *
 * `--json` mode must emit a single parseable JSON document on stdout and
 * no ANSI codes anywhere (colors are applied in console.ts only). These
 * helpers serialize result objects, but the commands themselves are
 * responsible for deciding when to call them.
 */
export function toJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function printJson(value: unknown): void {
  process.stdout.write(toJson(value) + "\n");
}
