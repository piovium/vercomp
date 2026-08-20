import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type {
  CompareItem,
  CompareManifest,
  ItemKind,
  Version,
  VersionSegment,
} from "../src/data/types.ts";

interface StaticDataMetadata {
  tcgMetadata?: {
    latestVersion?: string;
    availableVersions?: string[];
  };
}

interface PlayCost {
  type: string;
  count: number;
}

interface StaticSkill {
  id: number;
  name?: string;
  description?: string;
  playCost?: PlayCost[];
}

interface StaticEntry {
  id: number;
  name?: string;
  shareId?: number | null;
  relatedCharacterId?: number | null;
  tags?: string[];
  hp?: number;
  maxEnergy?: number;
  playCost?: PlayCost[];
  description?: string;
  skills?: StaticSkill[];
}

const ADVENTURE_PLACE_TAG = "GCG_TAG_ADVENTURE_PLACE";

export function isMasterActionCard(actionCard: StaticEntry): boolean {
  if (actionCard.relatedCharacterId != null) return false;
  return (
    actionCard.shareId != null ||
    actionCard.tags?.includes(ADVENTURE_PLACE_TAG) === true
  );
}

interface AnalyzerEntry {
  id: number;
  dependencies: number[];
  bindingNames?: string[];
}

interface IndexedValue {
  kind: Exclude<ItemKind, "placeholder">;
  name: string;
  signaturesByKind: Map<Exclude<ItemKind, "placeholder">, string>;
  rank: number;
}

interface LoadedSource {
  versions: Version[];
  versionIndexes: Map<Version, Map<number, IndexedValue>>;
  masterCharacterIds: Set<number>;
  masterActionCardIds: Set<number>;
  relatedActionCardIdsByCharacter: Map<number, Set<number>>;
  names: Map<number, string>;
  kinds: Map<number, Exclude<ItemKind, "placeholder">>;
}

const FORMAL_VERSION = /^v\d+\.\d+\.\d+$/;
const KIND_RANK: Record<Exclude<ItemKind, "placeholder">, number> = {
  character: 4,
  "action-card": 3,
  skill: 2,
  entity: 1,
};
const FORBIDDEN_OUTPUT_KEYS = new Set([
  "description",
  "rawDescription",
  "playCost",
  "hp",
  "maxEnergy",
]);

async function readJson<T>(filename: string): Promise<T> {
  const source = await readFile(filename, "utf8");
  return JSON.parse(source) as T;
}

function assertNumber(value: unknown, label: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} 必须是有效数字`);
  }
}

function putIndexedValue(
  target: Map<number, IndexedValue>,
  id: number,
  kind: Exclude<ItemKind, "placeholder">,
  name: string | undefined,
  signature: string,
  names: Map<number, string>,
  kinds: Map<number, Exclude<ItemKind, "placeholder">>,
) {
  assertNumber(id, `${kind}.id`);
  const rank = KIND_RANK[kind];
  const normalizedName = name?.trim() || String(id);
  const existing = target.get(id);
  if (!existing) {
    target.set(id, {
      kind,
      name: normalizedName,
      signaturesByKind: new Map([[kind, signature]]),
      rank,
    });
  } else {
    if (!existing.signaturesByKind.has(kind)) {
      existing.signaturesByKind.set(kind, signature);
    }
    if (rank > existing.rank) {
      existing.kind = kind;
      existing.name = normalizedName;
      existing.rank = rank;
    }
  }
  const knownKind = kinds.get(id);
  const isPreferredKind = !knownKind || rank >= KIND_RANK[knownKind];
  if (!knownKind || rank > KIND_RANK[knownKind]) {
    kinds.set(id, kind);
  }
  if (isPreferredKind && name?.trim()) {
    names.set(id, name.trim());
  }
}

function combinedSignature(value: IndexedValue): string {
  return JSON.stringify(
    [...value.signaturesByKind].sort(
      ([left], [right]) => KIND_RANK[right] - KIND_RANK[left],
    ),
  );
}

function skillSignature(skill: StaticSkill): string {
  // 技能展示文案会展开动态数值；版本分段应以原始描述和费用为准。
  return JSON.stringify([skill.description ?? "", skill.playCost ?? []]);
}

function indexSkill(
  skill: StaticSkill,
  target: Map<number, IndexedValue>,
  names: Map<number, string>,
  kinds: Map<number, Exclude<ItemKind, "placeholder">>,
) {
  putIndexedValue(
    target,
    skill.id,
    "skill",
    skill.name,
    JSON.stringify(["skill", skillSignature(skill)]),
    names,
    kinds,
  );
}

export function selectVersions(metadata: StaticDataMetadata): Version[] {
  const available = metadata.tcgMetadata?.availableVersions;
  const latest = metadata.tcgMetadata?.latestVersion;
  if (!Array.isArray(available) || typeof latest !== "string") {
    throw new Error("static-data/package.json 缺少 tcgMetadata 版本元数据");
  }
  const start = available.indexOf("v3.3.0");
  const end = available.indexOf(latest);
  if (start < 0 || end < start) {
    throw new Error(`无法从 v3.3.0 截取到 latestVersion=${latest}`);
  }
  const versions = available
    .slice(start, end + 1)
    .filter((version): version is Version => FORMAL_VERSION.test(version));
  if (versions.at(-1) !== latest) {
    throw new Error(`latestVersion=${latest} 不是正式版本`);
  }
  return versions;
}

async function loadStaticSource(staticDataPath: string): Promise<LoadedSource> {
  const metadata = await readJson<StaticDataMetadata>(
    path.join(staticDataPath, "package.json"),
  );
  const versions = selectVersions(metadata);
  const versionIndexes = new Map<Version, Map<number, IndexedValue>>();
  const masterCharacterIds = new Set<number>();
  const masterActionCardIds = new Set<number>();
  const relatedActionCardIdsByCharacter = new Map<number, Set<number>>();
  const names = new Map<number, string>();
  const kinds = new Map<number, Exclude<ItemKind, "placeholder">>();

  for (const version of versions) {
    const dataRoot = path.join(staticDataPath, "data", version, "CHS");
    const [characters, actionCards, entities] = await Promise.all([
      readJson<StaticEntry[]>(path.join(dataRoot, "characters.json")),
      readJson<StaticEntry[]>(path.join(dataRoot, "action_cards.json")),
      readJson<StaticEntry[]>(path.join(dataRoot, "entities.json")),
    ]);
    const index = new Map<number, IndexedValue>();

    for (const entity of entities) {
      putIndexedValue(
        index,
        entity.id,
        "entity",
        entity.name,
        JSON.stringify([
          "entity",
          entity.description ?? "",
          // 实体行还需随其技能的原始描述和费用变化而切分。
          (entity.skills ?? []).map(skillSignature),
        ]),
        names,
        kinds,
      );
      for (const skill of entity.skills ?? []) {
        indexSkill(skill, index, names, kinds);
      }
    }

    for (const character of characters) {
      putIndexedValue(
        index,
        character.id,
        "character",
        character.name,
        JSON.stringify([
          "character",
          character.hp ?? null,
          character.maxEnergy ?? null,
          (character.skills ?? []).map(skillSignature),
        ]),
        names,
        kinds,
      );
      if (character.shareId != null) {
        masterCharacterIds.add(character.id);
      }
      for (const skill of character.skills ?? []) {
        indexSkill(skill, index, names, kinds);
      }
    }

    for (const actionCard of actionCards) {
      putIndexedValue(
        index,
        actionCard.id,
        "action-card",
        actionCard.name,
        JSON.stringify([
          "action-card",
          actionCard.playCost ?? [],
          actionCard.description ?? "",
          (actionCard.skills ?? []).map(skillSignature),
        ]),
        names,
        kinds,
      );
      if (isMasterActionCard(actionCard)) {
        masterActionCardIds.add(actionCard.id);
      }
      for (const skill of actionCard.skills ?? []) {
        indexSkill(skill, index, names, kinds);
      }
      if (actionCard.relatedCharacterId != null) {
        const relatedIds =
          relatedActionCardIdsByCharacter.get(actionCard.relatedCharacterId) ??
          new Set<number>();
        relatedIds.add(actionCard.id);
        relatedActionCardIdsByCharacter.set(
          actionCard.relatedCharacterId,
          relatedIds,
        );
      }
    }

    versionIndexes.set(version, index);
  }

  return {
    versions,
    versionIndexes,
    masterCharacterIds,
    masterActionCardIds,
    relatedActionCardIdsByCharacter,
    names,
    kinds,
  };
}

export function mergeDependencyGraph(entries: AnalyzerEntry[]) {
  if (!Array.isArray(entries)) {
    throw new Error("实体依赖关系表的顶层必须是数组");
  }
  const dependencies = new Map<number, Set<number>>();
  const bindingNames = new Map<number, string>();
  for (const [index, entry] of entries.entries()) {
    assertNumber(entry?.id, `dependencies[${index}].id`);
    if (!Array.isArray(entry.dependencies)) {
      throw new Error(`dependencies[${index}].dependencies 必须是数组`);
    }
    const target = dependencies.get(entry.id) ?? new Set<number>();
    for (const dependency of entry.dependencies) {
      assertNumber(dependency, `dependencies[${index}].dependencies[]`);
      target.add(dependency);
    }
    dependencies.set(entry.id, target);
    const name = entry.bindingNames?.find((candidate) => candidate.trim());
    if (name && !bindingNames.has(entry.id)) {
      bindingNames.set(entry.id, name);
    }
  }
  return { dependencies, bindingNames };
}

export function traceRelationships(
  dependencies: Map<number, Set<number>>,
  masterIds: Set<number>,
) {
  const relatedIdsByMaster = new Map<number, number[]>();
  const reached = new Set<number>();

  for (const masterId of [...masterIds].sort((a, b) => a - b)) {
    const seen = new Set<number>([masterId]);
    const related = new Set<number>();
    const stack = [...(dependencies.get(masterId) ?? [])];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      if (masterIds.has(id)) continue;
      related.add(id);
      reached.add(id);
      stack.push(...(dependencies.get(id) ?? []));
    }
    relatedIdsByMaster.set(
      masterId,
      [...related].sort((a, b) => a - b),
    );
  }

  return { relatedIdsByMaster, reached };
}

export function buildSegments(
  versions: Version[],
  signatures: Array<string | null>,
): VersionSegment[] {
  if (versions.length !== signatures.length) {
    throw new Error("版本与比较签名数量不一致");
  }
  const result: VersionSegment[] = [];
  let start = -1;
  let current: string | null = null;

  const close = (end: number) => {
    if (start < 0 || current === null) return;
    result.push({
      start,
      end,
      representativeVersion: versions[end]!,
    });
  };

  for (let index = 0; index < signatures.length; index += 1) {
    const signature = signatures[index] ?? null;
    if (signature === current) continue;
    close(index - 1);
    current = signature;
    start = signature === null ? -1 : index;
  }
  close(signatures.length - 1);
  return result;
}

function toRecord<T>(entries: Iterable<readonly [number, T]>): Record<string, T> {
  return Object.fromEntries([...entries].map(([id, value]) => [String(id), value]));
}

function assertSafeManifest(value: unknown, pathLabel = "manifest") {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_OUTPUT_KEYS.has(key)) {
      throw new Error(`${pathLabel} 中禁止输出字段 ${key}`);
    }
    assertSafeManifest(child, `${pathLabel}.${key}`);
  }
}

export async function buildManifest(
  staticDataPath: string,
  dependencyDataPath: string,
): Promise<CompareManifest> {
  const source = await loadStaticSource(staticDataPath);
  const analyzerEntries = await readJson<AnalyzerEntry[]>(dependencyDataPath);
  const { dependencies, bindingNames } = mergeDependencyGraph(analyzerEntries);
  for (const [characterId, actionCardIds] of
    source.relatedActionCardIdsByCharacter) {
    const relatedIds = dependencies.get(characterId) ?? new Set<number>();
    for (const actionCardId of actionCardIds) {
      relatedIds.add(actionCardId);
    }
    dependencies.set(characterId, relatedIds);
  }
  const allMasterIds = new Set([
    ...source.masterCharacterIds,
    ...source.masterActionCardIds,
  ]);
  const { relatedIdsByMaster, reached } = traceRelationships(
    dependencies,
    allMasterIds,
  );
  const otherEntityIds = [...dependencies.keys()]
    .filter((id) => !allMasterIds.has(id) && !reached.has(id))
    .sort((a, b) => a - b);
  const includedIds = new Set<number>([
    ...allMasterIds,
    ...otherEntityIds,
    ...[...relatedIdsByMaster.values()].flat(),
  ]);

  const signatureFor = (id: number) =>
    source.versions.map(
      (version) => {
        const value = source.versionIndexes.get(version)?.get(id);
        return value ? combinedSignature(value) : null;
      },
    );
  const items = new Map<number, CompareItem>();
  for (const id of [...includedIds].sort((a, b) => a - b)) {
    const kind = source.kinds.get(id) ?? "placeholder";
    const hasStaticData = source.kinds.has(id);
    items.set(id, {
      id,
      name: source.names.get(id) ?? bindingNames.get(id) ?? String(id),
      kind,
      segments: buildSegments(source.versions, signatureFor(id)),
      hasImage: hasStaticData,
      hasDetails: hasStaticData,
    });
  }

  const masterSegments = new Map<number, VersionSegment[]>();
  for (const masterId of allMasterIds) {
    const relatedIds = relatedIdsByMaster.get(masterId) ?? [];
    const signatures = source.versions.map((version) => {
      const index = source.versionIndexes.get(version)!;
      const ownValue = index.get(masterId);
      const own = ownValue ? combinedSignature(ownValue) : null;
      if (own === null) return null;
      return JSON.stringify([
        own,
        relatedIds.map((id) => {
          const value = index.get(id);
          return value ? combinedSignature(value) : null;
        }),
      ]);
    });
    masterSegments.set(masterId, buildSegments(source.versions, signatures));
  }

  const manifest: CompareManifest = {
    schemaVersion: 1,
    versions: source.versions,
    itemsById: toRecord(items),
    masterCharacterIds: [...source.masterCharacterIds].sort((a, b) => a - b),
    masterActionCardIds: [...source.masterActionCardIds].sort((a, b) => a - b),
    otherEntityIds,
    relatedIdsByMaster: toRecord(relatedIdsByMaster),
    masterSegmentsById: toRecord(masterSegments),
  };
  assertSafeManifest(manifest);
  return manifest;
}

async function main() {
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const staticDataPath = path.resolve(
    repositoryRoot,
    process.env.STATIC_DATA_PATH ?? "../static-data",
  );
  const dependencyDataPath = path.resolve(
    repositoryRoot,
    process.env.DEPENDENCY_DATA_PATH ??
      "../genius-invokation/packages/data-code-analyzer/src/result.json",
  );
  const outputPath = path.join(repositoryRoot, "src/generated/compare-data.json");
  const manifest = await buildManifest(staticDataPath, dependencyDataPath);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(manifest)}\n`, "utf8");
  console.log(
    `Generated ${outputPath}: ${manifest.versions.length} versions, ` +
      `${manifest.masterCharacterIds.length} characters, ` +
      `${manifest.masterActionCardIds.length} action cards, ` +
      `${manifest.otherEntityIds.length} other entities.`,
  );
}

const entrypoint = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : "";
if (import.meta.url === entrypoint) {
  await main();
}
