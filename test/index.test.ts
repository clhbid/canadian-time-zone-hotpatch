import { describe, expect, it } from "vitest";
import * as pkg from "../src/index.js";

describe("package root", () => {
  it("exports exactly the trimmed runtime surface", () => {
    expect(Object.keys(pkg).sort()).toEqual([
      "MissingTemporalError",
      "OffsetBearingWallTimeError",
      "UnknownTimeZoneError",
      "createHotpatch",
      "inspectHostSupport",
      "toCorrectedInstant",
      "toCorrectedZonedTime",
      "toTimeZoneLabel"
    ]);
  });
});
