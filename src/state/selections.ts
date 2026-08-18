import type {
  CompareManifest,
  PersistedSelections,
  Version,
  VersionSegment,
} from "../data/types.ts";

export const STORAGE_KEY = "gi-tcg-version-selector.selections.v1";
export type SelectionMap = Record<string, Version>;

export interface SelectionImportResult {
  selections: SelectionMap;
  ignoredCount: number;
}

export function segmentContains(
  manifest: CompareManifest,
  segment: VersionSegment,
  version: Version | undefined,
) {
  if (!version) return false;
  const index = manifest.versions.indexOf(version);
  return index >= segment.start && index <= segment.end;
}

export function itemExistsAt(
  manifest: CompareManifest,
  id: number,
  version: Version,
) {
  const item = manifest.itemsById[String(id)];
  if (!item) return false;
  const index = manifest.versions.indexOf(version);
  if (index < 0) return false;
  return item.segments.some(
    (segment) => index >= segment.start && index <= segment.end,
  );
}

export function sanitizeSelections(
  manifest: CompareManifest,
  candidate: Record<string, unknown>,
): SelectionMap {
  const result: SelectionMap = {};
  for (const [rawId, rawVersion] of Object.entries(candidate)) {
    const id = Number(rawId);
    if (!Number.isInteger(id) || typeof rawVersion !== "string") continue;
    const version = rawVersion as Version;
    if (!manifest.versions.includes(version)) continue;
    if (!itemExistsAt(manifest, id, version)) continue;
    result[String(id)] = version;
  }
  return result;
}

export function parseSelectionJson(
  manifest: CompareManifest,
  source: string,
): SelectionImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new Error("文件不是有效的 JSON");
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("顶层内容必须是 ID 到版本号的对象");
  }

  const entries = Object.entries(parsed);
  const selections = sanitizeSelections(
    manifest,
    parsed as Record<string, unknown>,
  );
  const ignoredCount = entries.length - Object.keys(selections).length;
  if (entries.length > 0 && Object.keys(selections).length === 0) {
    throw new Error("没有可导入的有效选择");
  }

  return { selections, ignoredCount };
}

export function loadSelections(
  manifest: CompareManifest,
  storage: Pick<Storage, "getItem"> | undefined,
): SelectionMap {
  if (!storage) return {};
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<PersistedSelections>;
    if (parsed.schemaVersion !== 1 || !parsed.selections) return {};
    return sanitizeSelections(manifest, parsed.selections);
  } catch {
    return {};
  }
}

export function saveSelections(
  selections: SelectionMap,
  storage: Pick<Storage, "setItem"> | undefined,
) {
  if (!storage) return;
  const payload: PersistedSelections = {
    schemaVersion: 1,
    selections,
  };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Storage may be disabled or full; the in-memory selection still works.
  }
}

function resetMaster(
  manifest: CompareManifest,
  selections: SelectionMap,
  masterId: number,
  version: Version,
) {
  const next = { ...selections, [String(masterId)]: version };
  for (const relatedId of manifest.relatedIdsByMaster[String(masterId)] ?? []) {
    delete next[String(relatedId)];
  }
  return next;
}

export function isMasterDiverged(
  manifest: CompareManifest,
  selections: SelectionMap,
  masterId: number,
) {
  const masterVersion = selections[String(masterId)];
  if (!masterVersion) return false;
  return (manifest.relatedIdsByMaster[String(masterId)] ?? []).some(
    (relatedId) => {
      const relatedVersion = selections[String(relatedId)];
      return (
        relatedVersion !== undefined &&
        (!itemExistsAt(manifest, relatedId, masterVersion) ||
          relatedVersion !== masterVersion)
      );
    },
  );
}

export function toggleSelection(
  manifest: CompareManifest,
  selections: SelectionMap,
  id: number,
  segment: VersionSegment,
  isMaster: boolean,
): SelectionMap {
  const key = String(id);
  const selectedVersion = selections[key];
  const selectedInSegment = segmentContains(
    manifest,
    segment,
    selectedVersion,
  );

  if (!isMaster) {
    if (selectedInSegment) {
      const next = { ...selections };
      delete next[key];
      return next;
    }
    return { ...selections, [key]: segment.representativeVersion };
  }

  if (selectedInSegment && selectedVersion) {
    if (isMasterDiverged(manifest, selections, id)) {
      return resetMaster(manifest, selections, id, selectedVersion);
    }
    const next = { ...selections };
    delete next[key];
    return next;
  }

  return resetMaster(
    manifest,
    selections,
    id,
    segment.representativeVersion,
  );
}

export function serializeSelections(selections: SelectionMap) {
  const sorted = Object.fromEntries(
    Object.entries(selections).sort(
      ([left], [right]) => Number(left) - Number(right),
    ),
  );
  return `${JSON.stringify(sorted, null, 2)}\n`;
}

export function downloadSelections(selections: SelectionMap) {
  const blob = new Blob([serializeSelections(selections)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "gi-tcg-version-selection.json";
  anchor.click();
  URL.revokeObjectURL(url);
}
