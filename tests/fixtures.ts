import type { CompareManifest } from "../src/data/types.ts";

export function createManifestFixture(): CompareManifest {
  return {
    schemaVersion: 1,
    versions: ["v3.3.0", "v3.4.0", "v3.5.0"],
    itemsById: {
      "1": {
        id: 1,
        name: "主角色",
        kind: "character",
        hasImage: true,
        hasDetails: true,
        segments: [
          { start: 0, end: 1, representativeVersion: "v3.4.0" },
          { start: 2, end: 2, representativeVersion: "v3.5.0" },
        ],
      },
      "2": {
        id: 2,
        name: "关联技能",
        kind: "skill",
        hasImage: true,
        hasDetails: true,
        segments: [
          { start: 0, end: 2, representativeVersion: "v3.5.0" },
        ],
      },
      "3": {
        id: 3,
        name: "后加入实体",
        kind: "entity",
        hasImage: true,
        hasDetails: true,
        segments: [
          { start: 1, end: 2, representativeVersion: "v3.5.0" },
        ],
      },
      "9": {
        id: 9,
        name: "OnlyAnalyzer",
        kind: "placeholder",
        hasImage: false,
        hasDetails: false,
        segments: [],
      },
    },
    masterCharacterIds: [1],
    masterActionCardIds: [],
    otherEntityIds: [9],
    relatedIdsByMaster: { "1": [2, 3] },
    masterSegmentsById: {
      "1": [
        { start: 0, end: 0, representativeVersion: "v3.3.0" },
        { start: 1, end: 1, representativeVersion: "v3.4.0" },
        { start: 2, end: 2, representativeVersion: "v3.5.0" },
      ],
    },
  };
}

