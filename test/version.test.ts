import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { version } from "../src/index.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const pkg = JSON.parse(readFileSync(`${root}package.json`, "utf8")) as {
  version: string;
};

describe("version", () => {
  it("matches package.json's version", () => {
    expect(version).toBe(pkg.version);
  });
});
