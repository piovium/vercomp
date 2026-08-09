import { createEffect, createSignal, For, Show } from "solid-js";
import generatedManifest from "./generated/compare-data.json";
import type { CompareManifest, VersionSegment } from "./data/types.ts";
import { CompareRow } from "./components/CompareRow.tsx";
import {
  DetailDrawer,
  type DetailTarget,
} from "./components/DetailDrawer.tsx";
import {
  downloadSelections,
  loadSelections,
  saveSelections,
  toggleSelection,
  type SelectionMap,
} from "./state/selections.ts";

interface AppProps {
  manifest?: CompareManifest;
}

interface SectionProps {
  title: string;
  count: number;
}

function SectionHeader(props: SectionProps) {
  return (
    <div class="section-row row-grid">
      <div class="section-title">
        <strong>{props.title}</strong>
        <span>{props.count}</span>
      </div>
      <div class="section-rule" />
    </div>
  );
}

export function App(props: AppProps) {
  const manifest = props.manifest ?? (generatedManifest as CompareManifest);
  const storage = typeof window === "undefined" ? undefined : window.localStorage;
  const [selections, setSelections] = createSignal<SelectionMap>(
    loadSelections(manifest, storage),
  );
  const [expanded, setExpanded] = createSignal<Set<number>>(new Set());
  const [detailTarget, setDetailTarget] = createSignal<DetailTarget | null>(null);

  createEffect(() => saveSelections(selections(), storage));

  const isExpanded = (id: number) => expanded().has(id);
  const toggleExpanded = (id: number) => {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggle = (
    id: number,
    segment: VersionSegment,
    isMaster: boolean,
  ) => {
    setSelections((previous) =>
      toggleSelection(manifest, previous, id, segment, isMaster),
    );
  };

  const renderMaster = (id: number) => {
    const item = manifest.itemsById[String(id)];
    const relatedIds = manifest.relatedIdsByMaster[String(id)] ?? [];
    if (!item) return null;
    return (
      <>
        <CompareRow
          manifest={manifest}
          item={item}
          segments={manifest.masterSegmentsById[String(id)] ?? item.segments}
          selections={selections()}
          isMaster
          expanded={isExpanded(id)}
          relatedCount={relatedIds.length}
          onToggleExpanded={() => toggleExpanded(id)}
          onToggleSelection={(segment) => toggle(id, segment, true)}
          onShowDetails={setDetailTarget}
        />
        <Show when={isExpanded(id)}>
          <For each={relatedIds}>
            {(relatedId) => {
              const relatedItem = manifest.itemsById[String(relatedId)];
              return (
                <Show when={relatedItem}>
                  {(resolved) => (
                    <CompareRow
                      manifest={manifest}
                      item={resolved()}
                      segments={resolved().segments}
                      selections={selections()}
                      isMaster={false}
                      isRelated
                      onToggleSelection={(segment) =>
                        toggle(relatedId, segment, false)
                      }
                      onShowDetails={setDetailTarget}
                    />
                  )}
                </Show>
              );
            }}
          </For>
        </Show>
      </>
    );
  };

  return (
    <main class="app-shell">
      <header class="app-toolbar">
        <div>
          <p>GENIUS INVOKATION TCG</p>
          <h1>卡牌版本比较与选择器</h1>
        </div>
        <div class="toolbar-actions">
          <span>{Object.keys(selections()).length} 项已选择</span>
          <button type="button" onClick={() => downloadSelections(selections())}>
            导出 JSON
          </button>
        </div>
      </header>

      <div
        class="table-scroll"
        style={{ "--version-count": manifest.versions.length }}
        data-testid="table-scroll"
      >
        <div class="version-header row-grid">
          <div class="corner-heading">
            <span>卡牌 / 实体</span>
            <small>双击区间选择版本</small>
          </div>
          <For each={manifest.versions}>
            {(version) => <div class="version-heading">{version.slice(1)}</div>}
          </For>
        </div>

        <SectionHeader
          title="角色牌"
          count={manifest.masterCharacterIds.length}
        />
        <For each={manifest.masterCharacterIds}>{renderMaster}</For>

        <SectionHeader
          title="行动牌"
          count={manifest.masterActionCardIds.length}
        />
        <For each={manifest.masterActionCardIds}>{renderMaster}</For>

        <SectionHeader title="其他实体" count={manifest.otherEntityIds.length} />
        <For each={manifest.otherEntityIds}>
          {(id) => {
            const item = manifest.itemsById[String(id)];
            return (
              <Show when={item}>
                {(resolved) => (
                  <CompareRow
                    manifest={manifest}
                    item={resolved()}
                    segments={resolved().segments}
                    selections={selections()}
                    isMaster={false}
                    onToggleSelection={(segment) => toggle(id, segment, false)}
                    onShowDetails={setDetailTarget}
                  />
                )}
              </Show>
            );
          }}
        </For>
      </div>

      <DetailDrawer
        target={detailTarget()}
        onClose={() => setDetailTarget(null)}
      />
    </main>
  );
}
