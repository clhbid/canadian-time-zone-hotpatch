import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("..", import.meta.url));
const readme = readFileSync(`${root}README.md`, "utf8");
const examples = [...readme.matchAll(/```ts\n([\s\S]*?)```/g)].map(
  (match, index) => [index + 1, match[1] ?? ""] as const
);

/** The repo's own compiler options, with the package name resolving to `src/`. */
function compilerOptions(): ts.CompilerOptions {
  const config = ts.readConfigFile(`${root}tsconfig.json`, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  return {
    ...parsed.options,
    baseUrl: root,
    paths: { "@clhbid/canadian-time-zone-hotpatch": ["src/index.ts"] },
    // Examples are fragments, so bindings they end on are legitimately unused.
    noUnusedLocals: false,
    noUnusedParameters: false
  };
}

/** Typechecks `source` as a module beside the tests and returns its diagnostics. */
function diagnose(source: string): string[] {
  const fileName = `${root}test/readme-example.ts`;
  const options = compilerOptions();
  const host = ts.createCompilerHost(options);
  const { fileExists, readFile } = host;
  host.fileExists = (path) => path === fileName || fileExists(path);
  host.readFile = (path) => (path === fileName ? source : readFile(path));
  const program = ts.createProgram([fileName], options, host);
  return ts
    .getPreEmitDiagnostics(program)
    .filter((diagnostic) => diagnostic.file?.fileName === fileName)
    .map((diagnostic) =>
      ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
    );
}

describe("README examples", () => {
  it("contains TypeScript examples", () => {
    expect(examples.length).toBeGreaterThan(0);
  });

  it.each(examples)("example %i typechecks against src/", (_, source) => {
    expect(diagnose(source)).toEqual([]);
  });
});
