import { Temporal } from "temporal-polyfill";
import { describe, expect, it } from "vitest";
import {
  observeInstant,
  observeNextTransition,
  observeOffset
} from "../src/host.js";

describe("host helpers", () => {
  it("observes the host offset for a recognized time zone", () => {
    // arrange
    const instant = Temporal.Instant.from("2026-11-01T08:00:00Z");
    // assert
    expect(observeOffset("Etc/GMT+5", instant)).toBe("-05:00");
  });

  it("returns undefined when offset observation receives an invalid time zone", () => {
    // arrange
    const instant = Temporal.Instant.from("2026-11-01T08:00:00Z");
    // assert
    expect(observeOffset("Not/AZone", instant)).toBeUndefined();
  });

  // Toronto's seasonal rules are stable in every tzdata, so the real host
  // can exercise Temporal's own disambiguation here.
  it("resolves a repeated wall-clock time under each disambiguation", () => {
    // arrange
    const local = Temporal.PlainDateTime.from("2025-11-02T01:30:00");
    // act
    const at = (disambiguation: "compatible" | "earlier" | "later") =>
      observeInstant("America/Toronto", local, disambiguation).toString();
    // assert
    expect(at("earlier")).toBe("2025-11-02T05:30:00Z");
    expect(at("later")).toBe("2025-11-02T06:30:00Z");
    expect(at("compatible")).toBe(at("earlier"));
  });

  it("throws under reject for a repeated wall-clock time", () => {
    // arrange
    const local = Temporal.PlainDateTime.from("2025-11-02T01:30:00");
    // assert
    expect(() => observeInstant("America/Toronto", local, "reject")).toThrow(
      RangeError
    );
  });

  it("throws when wall-clock resolution receives an invalid time zone", () => {
    // arrange
    const local = Temporal.PlainDateTime.from("2025-11-02T12:00:00");
    // assert
    expect(() => observeInstant("Not/AZone", local, "compatible")).toThrow(
      RangeError
    );
  });

  it("finds the next offset transition for a seasonal zone", () => {
    // Toronto's next transition after this instant is the spring-forward,
    // whatever tzdata the runner has installed.
    // arrange
    const instant = Temporal.Instant.from("2026-01-15T12:00:00Z");
    // act
    const next = observeNextTransition("America/Toronto", instant);
    // assert
    expect(next).toBeDefined();
    expect(Temporal.Instant.compare(next!, instant)).toBeGreaterThan(0);
  });

  it("reports no next transition for a fixed-offset zone", () => {
    // arrange
    const instant = Temporal.Instant.from("2026-11-01T08:00:00Z");
    // assert
    expect(observeNextTransition("Etc/GMT+6", instant)).toBeUndefined();
  });

  it("returns undefined when the transition read receives an invalid time zone", () => {
    // arrange
    const instant = Temporal.Instant.from("2026-11-01T08:00:00Z");
    // assert
    expect(observeNextTransition("Not/AZone", instant)).toBeUndefined();
  });
});
