import { createSignal, Show } from "solid-js";
import type {
  CompareItem,
  CompareManifest,
  VersionSegment,
} from "../data/types.ts";
import {
  isMasterDiverged,
  segmentContains,
  type SelectionMap,
} from "../state/selections.ts";
import type { DetailTarget } from "./DetailDrawer.tsx";

interface CompareRowProps {
  manifest: CompareManifest;
  item: CompareItem;
  segments: VersionSegment[];
  selections: SelectionMap;
  isMaster: boolean;
  isRelated?: boolean;
  expanded?: boolean;
  relatedCount?: number;
  onToggleExpanded?: () => void;
  onToggleSelection: (segment: VersionSegment) => void;
  onShowDetails: (target: DetailTarget) => void;
}

const IMAGE_ENDPOINT =
  import.meta.env.VITE_ASSETS_API_ENDPOINT ??
  "https://static-data.piovium.org/api/v4";

const KIND_LABEL: Record<CompareItem["kind"], string> = {
  character: "角色",
  "action-card": "行动牌",
  skill: "技能",
  entity: "实体",
  placeholder: "内部项",
};

function shortVersion(version: string) {
  return version.startsWith("v") ? version.slice(1) : version;
}

export function CompareRow(props: CompareRowProps) {
  const [imageFailed, setImageFailed] = createSignal(false);
  const selectedVersion = () => props.selections[String(props.item.id)];
  const diverged = () =>
    props.isMaster &&
    isMasterDiverged(props.manifest, props.selections, props.item.id);

  const showDetails = (segment: VersionSegment) => {
    if (!props.item.hasDetails) return;
    props.onShowDetails({
      id: props.item.id,
      name: props.item.name,
      kind: props.item.kind,
      version: segment.representativeVersion,
    });
  };

  return (
    <div
      class="compare-row row-grid"
      classList={{
        "related-row": !!props.isRelated,
        "master-row": props.isMaster,
        diverged: diverged(),
      }}
      data-item-id={props.item.id}
      data-master={props.isMaster ? "true" : undefined}
    >
      <div class="row-heading">
        <Show
          when={props.item.hasImage && !imageFailed()}
          fallback={<div class="image-placeholder" aria-hidden="true">?</div>}
        >
          <img
            src={`${IMAGE_ENDPOINT}/image/${props.item.id}`}
            alt=""
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        </Show>
        <Show when={props.isMaster && (props.relatedCount ?? 0) > 0}>
          <button
            type="button"
            class="expand-button"
            aria-label={props.expanded ? "收起关联项" : "展开关联项"}
            aria-expanded={props.expanded}
            onClick={props.onToggleExpanded}
          >
            {props.expanded ? "−" : "+"}
          </button>
        </Show>
        <div class="row-title">
          <strong title={props.item.name}>{props.item.name}</strong>
          <span>
            {props.item.id} · {KIND_LABEL[props.item.kind]}
            <Show when={selectedVersion()}>
              {(version) => <em>已选 {version()}</em>}
            </Show>
          </span>
        </div>
        <Show when={diverged()}>
          <span class="diverged-badge" title="关联项未与主牌保持同一版本">
            关联偏差
          </span>
        </Show>
      </div>

      <Show when={props.segments.length === 0}>
        <div class="empty-row-note">所有正式版本均无静态数据</div>
      </Show>
      {props.segments.map((segment) => {
        const selected = () =>
          segmentContains(
            props.manifest,
            segment,
            props.selections[String(props.item.id)],
          );
        const range = `${props.manifest.versions[segment.start]} – ${
          props.manifest.versions[segment.end]
        }`;
        return (
          <button
            type="button"
            class="version-segment"
            classList={{ selected: selected() }}
            style={{
              "grid-column": `${segment.start + 2} / span ${
                segment.end - segment.start + 1
              }`,
            }}
            aria-pressed={selected()}
            aria-label={`${props.item.name} ${range}${
              selected() ? "，已选择" : ""
            }`}
            title={`${range}\n单击查看详情，双击选择或取消`}
            data-segment={`${segment.start}-${segment.end}`}
            onClick={() => showDetails(segment)}
            onDblClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              props.onToggleSelection(segment);
            }}
          >
            <span>{shortVersion(segment.representativeVersion)}</span>
          </button>
        );
      })}
    </div>
  );
}

