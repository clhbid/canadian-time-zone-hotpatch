/**
 * Pins the duplicated doc comments together.
 *
 * Every function is documented twice: once on its top-level export in
 * `src/index.ts` and once on the matching `Hotpatch` member in
 * `src/hotpatch.ts`. An editor resolves a hover to one declaration's own
 * comment and never falls back through a type, so a client who imports
 * `toCorrectedZonedTime` reads the first copy and one who calls
 * `createHotpatch` reads the second. Neither copy can be dropped, and a
 * change to one that misses the other leaves half the clients reading stale
 * documentation — that is what this spec fails on.
 *
 * The comparison goes through the same compiler API an editor does, so it
 * pins what a client is shown rather than the source text: a member that
 * stopped carrying its own documentation would read as empty here even with
 * the comment still in the file.
 */
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("..", import.meta.url));

/** The repo's own compiler options, for a program rooted at the package entry. */
function compilerOptions(): ts.CompilerOptions {
  const config = ts.readConfigFile(`${root}tsconfig.json`, ts.sys.readFile);
  return ts.parseJsonConfigFileContent(config.config, ts.sys, root).options;
}

const program = ts.createProgram([`${root}src/index.ts`], compilerOptions());
const checker = program.getTypeChecker();

const entry = program.getSourceFile(`${root}src/index.ts`);
if (entry === undefined) {
  throw new Error("src/index.ts is not in the program.");
}

const entrySymbol = checker.getSymbolAtLocation(entry);
if (entrySymbol === undefined) {
  throw new Error("src/index.ts has no module symbol.");
}

const packageExports = new Map(
  checker.getExportsOfModule(entrySymbol).map((symbol) => [symbol.name, symbol])
);

/** The `Hotpatch` members, which are the functions documented in both places. */
function hotpatchMembers(): readonly ts.Symbol[] {
  const exported = packageExports.get("Hotpatch");
  if (exported === undefined) {
    throw new Error("`Hotpatch` is not exported from src/index.ts.");
  }
  const symbol =
    exported.flags & ts.SymbolFlags.Alias
      ? checker.getAliasedSymbol(exported)
      : exported;
  return checker.getPropertiesOfType(checker.getDeclaredTypeOfSymbol(symbol));
}

/**
 * What an editor shows for `symbol`: its description followed by its tags,
 * with wrapping normalized so the two copies may be wrapped to fit where each
 * one sits.
 */
function documentation(symbol: ts.Symbol): string {
  const description = ts.displayPartsToString(
    symbol.getDocumentationComment(checker)
  );
  const tags = symbol
    .getJsDocTags(checker)
    .map((tag) => `@${tag.name} ${ts.displayPartsToString(tag.text)}`);
  return [description, ...tags]
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter((part) => part !== "")
    .join("\n");
}

const members = hotpatchMembers();

describe("doc comment parity", () => {
  // Guards the lookup itself: an empty list would pass every spec below.
  it("finds the functions to compare", () => {
    expect(members.map((member) => member.name).sort()).toEqual([
      "inspectHostSupport",
      "inspectTimeZoneSupport",
      "toCorrectedInstant",
      "toCorrectedZonedTime",
      "toTimeZoneLabel"
    ]);
  });

  it.each(members.map((member) => [member.name, member] as const))(
    "%s is documented identically on its export and on Hotpatch",
    (name, member) => {
      const exported = packageExports.get(name);
      if (exported === undefined) {
        throw new Error(`\`${name}\` is not exported from src/index.ts.`);
      }

      const memberDocumentation = documentation(member);
      expect(memberDocumentation).not.toBe("");
      expect(documentation(exported)).toBe(memberDocumentation);
    }
  );
});
