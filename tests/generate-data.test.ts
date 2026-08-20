import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  buildManifest,
  buildSegments,
  isMasterActionCard,
  mergeDependencyGraph,
  selectVersions,
  traceRelationships,
} from "../scripts/generate-data.ts";

const tempDirectories: string[] = [];

async function writeJson(filename: string, value: unknown) {
  await mkdir(path.dirname(filename), { recursive: true });
  await writeFile(filename, JSON.stringify(value), "utf8");
}

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("data generator", () => {
  test("filters formal versions between v3.3.0 and latest", () => {
    expect(
      selectVersions({
        tcgMetadata: {
          latestVersion: "v4.0.0",
          availableVersions: [
            "v3.3.0",
            "v3.4.0",
            "v4.0.0-preview",
            "v4.0.0",
            "v9999.0.0-moyu-s7",
          ],
        },
      }),
    ).toEqual(["v3.3.0", "v3.4.0", "v4.0.0"]);
  });

  test("keeps absence as a hard segment boundary", () => {
    expect(
      buildSegments(
        ["v3.3.0", "v3.4.0", "v3.5.0"],
        ["same", null, "same"],
      ),
    ).toEqual([
      { start: 0, end: 0, representativeVersion: "v3.3.0" },
      { start: 2, end: 2, representativeVersion: "v3.5.0" },
    ]);
  });

  test("classifies master action cards by character relation and adventure tag", () => {
    expect(isMasterActionCard({ id: 1, shareId: 1 })).toBe(true);
    expect(
      isMasterActionCard({ id: 2, shareId: 2, relatedCharacterId: 1001 }),
    ).toBe(false);
    expect(
      isMasterActionCard({ id: 3, tags: ["GCG_TAG_ADVENTURE_PLACE"] }),
    ).toBe(true);
    expect(
      isMasterActionCard({
        id: 4,
        shareId: 4,
        relatedCharacterId: 1001,
        tags: ["GCG_TAG_ADVENTURE_PLACE"],
      }),
    ).toBe(false);
  });

  test("merges duplicates, stops at masters and survives cycles", () => {
    const { dependencies } = mergeDependencyGraph([
      { id: 1, dependencies: [2, 10] },
      { id: 1, dependencies: [3] },
      { id: 2, dependencies: [1] },
      { id: 3, dependencies: [] },
      { id: 10, dependencies: [4] },
    ]);
    expect([...dependencies.get(1)!].sort((a, b) => a - b)).toEqual([2, 3, 10]);
    const { relatedIdsByMaster } = traceRelationships(
      dependencies,
      new Set([1, 10]),
    );
    expect(relatedIdsByMaster.get(1)).toEqual([2, 3]);
  });

  test("builds composite master segments and analyzer-only placeholders", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "gi-tcg-compare-"));
    tempDirectories.push(root);
    const staticRoot = path.join(root, "static-data");
    const versions = ["v3.3.0", "v3.4.0", "v3.5.0"];
    await writeJson(path.join(staticRoot, "package.json"), {
      tcgMetadata: { latestVersion: "v3.5.0", availableVersions: versions },
    });

    for (const [index, version] of versions.entries()) {
      const dataRoot = path.join(staticRoot, "data", version, "CHS");
      await writeJson(path.join(dataRoot, "characters.json"), [
        {
          id: 1,
          shareId: 1,
          name: "主角色",
          hp: index === 2 ? 11 : 10,
          maxEnergy: 2,
          skills: [
            {
              id: 11,
              name: "关联技能",
              description: `展示文案 ${index}`,
              rawDescription: "造成伤害",
              playCost: [{ type: "VOID", count: index === 2 ? 2 : 1 }],
            },
          ],
        },
      ]);
      await writeJson(path.join(dataRoot, "action_cards.json"), [
        {
          id: 100,
          shareId: 2,
          name: "另一主牌",
          playCost: [{ type: "VOID", count: 1 }],
          description: "不变",
        },
        {
          id: 101,
          shareId: 3,
          relatedCharacterId: 1,
          name: "角色关联牌",
          description: "关联",
        },
        {
          id: 102,
          name: "冒险地点牌",
          tags: ["GCG_TAG_ADVENTURE_PLACE"],
          description: "地点",
          skills: [
            {
              id: 1021,
              name: "行动牌技能",
              rawDescription: "执行效果",
              playCost: [{ type: "VOID", count: index === 2 ? 2 : 1 }],
            },
          ],
        },
      ]);
      await writeJson(path.join(dataRoot, "entities.json"), [
        {
          id: 20,
          name: "关联实体",
          description: "X",
          skills: [
            {
              id: 21,
              name: "实体技能",
              description: `展示文案 ${index}`,
              rawDescription: "生成效果",
              playCost: [{ type: "VOID", count: index === 1 ? 2 : 1 }],
            },
          ],
        },
        {
          id: 100,
          name: "与行动牌同 ID 的实体",
          description: "不变",
          skills: [
            {
              id: 1001,
              name: "同 ID 实体技能",
              description: index === 2 ? "改动后" : "改动前",
              rawDescription: index === 2 ? "改动后" : "改动前",
            },
          ],
        },
        { id: 30, name: "孤立实体", description: "O", skills: [] },
      ]);
    }

    const analyzerPath = path.join(root, "dependencies.json");
    await writeJson(analyzerPath, [
      { id: 1, dependencies: [11, 20, 100, 999] },
      { id: 20, dependencies: [1] },
      { id: 20, dependencies: [999] },
      { id: 100, dependencies: [] },
      { id: 30, dependencies: [] },
      { id: 888, dependencies: [], bindingNames: ["OnlyAnalyzer"] },
      { id: 999, dependencies: [], bindingNames: ["RelatedPlaceholder"] },
    ]);

    const manifest = await buildManifest(staticRoot, analyzerPath);
    expect(manifest.masterActionCardIds).toEqual([100, 102]);
    expect(manifest.relatedIdsByMaster["1"]).toEqual([11, 20, 101, 999]);
    expect(manifest.otherEntityIds).toEqual([30, 888]);
    expect(manifest.itemsById["888"]).toMatchObject({
      name: "OnlyAnalyzer",
      kind: "placeholder",
      segments: [],
      hasDetails: false,
    });
    expect(manifest.itemsById["1"]!.segments).toHaveLength(2);
    expect(manifest.itemsById["11"]!.segments).toEqual([
      { start: 0, end: 1, representativeVersion: "v3.4.0" },
      { start: 2, end: 2, representativeVersion: "v3.5.0" },
    ]);
    expect(manifest.itemsById["20"]!.segments).toHaveLength(3);
    expect(manifest.itemsById["102"]!.segments).toEqual([
      { start: 0, end: 1, representativeVersion: "v3.4.0" },
      { start: 2, end: 2, representativeVersion: "v3.5.0" },
    ]);
    expect(manifest.itemsById["100"]).toMatchObject({
      kind: "action-card",
      segments: [
        { start: 0, end: 1, representativeVersion: "v3.4.0" },
        { start: 2, end: 2, representativeVersion: "v3.5.0" },
      ],
    });
    expect(manifest.masterSegmentsById["1"]).toHaveLength(3);
    expect(manifest.masterSegmentsById["100"]).toHaveLength(2);
    expect(JSON.stringify(manifest)).not.toMatch(
      /description|rawDescription|playCost|maxEnergy|"hp"/,
    );
  });
});
