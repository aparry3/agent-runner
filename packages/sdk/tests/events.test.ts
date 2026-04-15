import { describe, expect, it } from "vitest";
import { StreamError } from "../src/errors.js";
import { normalizeEvent } from "../src/events.js";

describe("normalizeEvent", () => {
  it("maps run-start", () => {
    expect(
      normalizeEvent({
        event: "run-start",
        data: JSON.stringify({ agentId: "a1", kind: "llm" }),
      }),
    ).toEqual({ type: "start", agentId: "a1", kind: "llm" });
  });

  it("maps run-complete", () => {
    expect(
      normalizeEvent({
        event: "run-complete",
        data: JSON.stringify({ output: "ok", state: { n: 1 } }),
      }),
    ).toEqual({ type: "complete", output: "ok", state: { n: 1 } });
  });

  it("maps run-error", () => {
    expect(
      normalizeEvent({
        event: "run-error",
        data: JSON.stringify({ error: "nope" }),
      }),
    ).toEqual({ type: "error", error: "nope" });
  });

  it("returns null for unknown events", () => {
    expect(normalizeEvent({ event: "heartbeat", data: "{}" })).toBeNull();
  });

  it("returns null when event field is missing", () => {
    expect(normalizeEvent({ data: "{}" })).toBeNull();
  });

  it("throws StreamError on invalid JSON payload", () => {
    expect(() =>
      normalizeEvent({ event: "run-complete", data: "not json" }),
    ).toThrow(StreamError);
  });

  it("throws StreamError on unknown agent kind", () => {
    expect(() =>
      normalizeEvent({
        event: "run-start",
        data: JSON.stringify({ agentId: "a1", kind: "wizardry" }),
      }),
    ).toThrow(StreamError);
  });

  it("defaults state to {} when missing on run-complete", () => {
    expect(
      normalizeEvent({
        event: "run-complete",
        data: JSON.stringify({ output: 1 }),
      }),
    ).toEqual({ type: "complete", output: 1, state: {} });
  });
});
