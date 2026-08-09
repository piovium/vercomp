export type Version = `v${number}.${number}.${number}`;

export type ItemKind =
  | "character"
  | "action-card"
  | "skill"
  | "entity"
  | "placeholder";

export interface VersionSegment {
  /** Inclusive index into CompareManifest.versions. */
  start: number;
  /** Inclusive index into CompareManifest.versions. */
  end: number;
  /** The newest version covered by this segment. */
  representativeVersion: Version;
}

export interface CompareItem {
  id: number;
  name: string;
  kind: ItemKind;
  segments: VersionSegment[];
  hasImage: boolean;
  hasDetails: boolean;
}

export interface CompareManifest {
  schemaVersion: 1;
  versions: Version[];
  itemsById: Record<string, CompareItem>;
  masterCharacterIds: number[];
  masterActionCardIds: number[];
  otherEntityIds: number[];
  relatedIdsByMaster: Record<string, number[]>;
  masterSegmentsById: Record<string, VersionSegment[]>;
}

export interface PersistedSelections {
  schemaVersion: 1;
  selections: Record<string, Version>;
}

