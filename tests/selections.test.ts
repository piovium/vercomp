import { describe, expect, test } from "vitest";
import { createManifestFixture } from "./fixtures.ts";
import {
  isMasterDiverged,
  loadSelections,
  parseSelectionJson,
  sanitizeSelections,
  serializeSelections,
  toggleSelection,
  type SelectionMap,
} from "../src/state/selections.ts";

describe("selection state", () => {
  test("selects a master as a group without selecting related items", () => {
    const manifest = createManifestFixture();
    const segment = manifest.masterSegmentsById["1"]![2]!;
    const selected = toggleSelection(manifest, {}, 1, segment, true);
    expect(selected).toEqual({ "1": "v3.5.0" });
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
    expect(reset).toEqual({ "1": "v3.5.0" });
    expect(isMasterDiverged(manifest, reset, 1)).toBe(false);

    const cancelled = toggleSelection(manifest, reset, 1, segment, true);
    expect(cancelled).toEqual({});
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
    expect(selected).toEqual({ "1": "v3.3.0" });
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

  test("parses exported JSON and reports ignored entries", () => {
    const manifest = createManifestFixture();
    expect(
      parseSelectionJson(
        manifest,
        JSON.stringify({ "1": "v3.4.0", "2": "v9.9.9", bad: "v3.4.0" }),
      ),
    ).toEqual({
      selections: { "1": "v3.4.0" },
      ignoredCount: 2,
    });
    expect(parseSelectionJson(manifest, "{}")).toEqual({
      selections: {},
      ignoredCount: 0,
    });
  });

  test("rejects malformed imports without valid entries", () => {
    const manifest = createManifestFixture();
    expect(() => parseSelectionJson(manifest, "not json")).toThrow(
      "文件不是有效的 JSON",
    );
    expect(() => parseSelectionJson(manifest, "[]")).toThrow(
      "顶层内容必须是 ID 到版本号的对象",
    );
    expect(() =>
      parseSelectionJson(manifest, JSON.stringify({ "1": "v9.9.9" })),
    ).toThrow("没有可导入的有效选择");
  });
});
