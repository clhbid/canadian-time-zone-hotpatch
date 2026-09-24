import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { Temporal } from "temporal-polyfill";
import { beforeAll, describe, expect, it } from "vitest";
import type * as pkg from "../src/index.js";

/*
 * Node's CommonJS loader resolves the package by its own name from a module
 * inside the package (self-reference), so this exercises the published
 * `exports` map rather than a path into `src/`. It therefore reads built
 * output, which is git-ignored; `npm test` builds before running the specs.
 */
const entryPoint = fileURLToPath(new URL("../dist/index.js", import.meta.url));
const require = createRequire(import.meta.url);

function load(): typeof pkg {
  return require("@clhbid/canadian-time-zone-hotpatch") as typeof pkg;
}

describe("require() from CommonJS", () => {
  beforeAll(() => {
    if (!existsSync(entryPoint)) {
      throw new Error(
        `${entryPoint} is missing. Run \`npm run build\` before these specs.`
      );
    }
  });

  it("exposes the package's runtime surface", () => {
    expect(Object.keys(load()).sort()).toEqual([
      "MissingTemporalError",
      "OffsetBearingWallTimeError",
      "TimeZoneSupportStatus",
      "UnknownTimeZoneError",
      "createHotpatch",
      "inspectHostSupport",
      "toCorrectedInstant",
      "toCorrectedZonedTime",
      "toTimeZoneLabel"
    ]);
  });

  it("corrects an instant", () => {
    const { toCorrectedZonedTime } = load().createHotpatch({
      temporal: Temporal
    });

    const display = toCorrectedZonedTime({
      instant: "2026-11-15T19:00:00Z",
      timeZoneId: "America/Edmonton"
    });

    expect(display.offset).toBe("-06:00");
  });
});
