import { describe, expect, test } from "vitest";
import { createManifestFixture } from "./fixtures.ts";
import {
  isMasterDiverged,
  loadSelections,
  sanitizeSelections,
  serializeSelections,
  toggleSelection,
  type SelectionMap,
} from "../src/state/selections.ts";

describe("selection state", () => {
  test("selects a master and resets available related items", () => {
    const manifest = createManifestFixture();
    const segment = manifest.masterSegmentsById["1"]![2]!;
    const selected = toggleSelection(manifest, {}, 1, segment, true);
    expect(selected).toEqual({
      "1": "v3.5.0",
      "2": "v3.5.0",
      "3": "v3.5.0",
    });
    expect(isMasterDiverged(manifest, selected, 1)).toBe(false);
  });

  test("resets divergence before cancelling the master", () => {
    const manifest = createManifestFixture();
    const segment = manifest.masterSegmentsById["1"]![2]!;
    const diverged: SelectionMap = {
      "1": "v3.5.0",
      "2": "v3.3.0",
      "3": "v3.5.0",
    };
    expect(isMasterDiverged(manifest, diverged, 1)).toBe(true);

    const reset = toggleSelection(manifest, diverged, 1, segment, true);
    expect(reset["1"]).toBe("v3.5.0");
    expect(reset["2"]).toBe("v3.5.0");

    const cancelled = toggleSelection(manifest, reset, 1, segment, true);
    expect(cancelled["1"]).toBeUndefined();
    expect(cancelled["2"]).toBe("v3.5.0");
    expect(cancelled["3"]).toBe("v3.5.0");
  });

  test("clears related selections unavailable at the master version", () => {
    const manifest = createManifestFixture();
    const early = manifest.masterSegmentsById["1"]![0]!;
    const selected = toggleSelection(
      manifest,
      { "3": "v3.5.0" },
      1,
      early,
      true,
    );
    expect(selected).toEqual({ "1": "v3.3.0", "2": "v3.3.0" });
  });

  test("sanitizes storage and exports numeric IDs in order", () => {
    const manifest = createManifestFixture();
    expect(
      sanitizeSelections(manifest, {
        "9": "v3.3.0",
        "3": "v3.3.0",
        "2": "v3.4.0",
        nope: "v3.4.0",
      }),
    ).toEqual({ "2": "v3.4.0" });

    expect(
      serializeSelections({ "12": "v3.5.0", "2": "v3.3.0" }),
    ).toBe('{\n  "2": "v3.3.0",\n  "12": "v3.5.0"\n}\n');
  });

  test("ignores malformed localStorage payloads", () => {
    const manifest = createManifestFixture();
    expect(
      loadSelections(manifest, { getItem: () => "not json" }),
    ).toEqual({});
    expect(
      loadSelections(manifest, {
        getItem: () => JSON.stringify({ schemaVersion: 2, selections: {} }),
      }),
    ).toEqual({});
  });
});

