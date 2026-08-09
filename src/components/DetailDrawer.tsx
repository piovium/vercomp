import { AssetsManager } from "@gi-tcg/assets-manager";
import { createCardDataViewer } from "@gi-tcg/card-data-viewer";
import { createEffect, createMemo, onCleanup, onMount, Show } from "solid-js";
import type { ItemKind, Version } from "../data/types.ts";

export interface DetailTarget {
  id: number;
  name: string;
  kind: ItemKind;
  version: Version;
}

interface DetailDrawerProps {
  target: DetailTarget | null;
  onClose: () => void;
}

const API_ENDPOINT =
  import.meta.env.VITE_ASSETS_API_ENDPOINT ??
  "https://static-data.piovium.org/api/v4";

export function DetailDrawer(props: DetailDrawerProps) {
  const managers = new Map<Version, AssetsManager>();
  const manager = createMemo(() => {
    const version = props.target?.version ?? "latest";
    if (version === "latest") {
      return new AssetsManager({
        apiEndpoint: API_ENDPOINT,
        language: "CHS",
        version,
      });
    }
    let existing = managers.get(version);
    if (!existing) {
      existing = new AssetsManager({
        apiEndpoint: API_ENDPOINT,
        language: "CHS",
        version,
      });
      managers.set(version, existing);
    }
    return existing;
  });
  const viewer = createCardDataViewer({
    assetsManager: manager,
    locale: () => "zh-CN",
  });

  createEffect(() => {
    const target = props.target;
    if (!target) {
      viewer.hide();
      return;
    }
    if (target.kind === "character") {
      viewer.showCharacter(target.id, { includesImage: true });
    } else if (target.kind === "skill") {
      viewer.showSkill(target.id);
    } else {
      viewer.showCard(target.id, {
        includesImage: target.kind === "action-card",
      });
    }
  });

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && props.target) props.onClose();
  };
  onMount(() => window.addEventListener("keydown", onKeyDown));
  onCleanup(() => window.removeEventListener("keydown", onKeyDown));

  return (
    <Show when={props.target}>
      {(target) => (
        <aside class="detail-drawer" aria-label={`${target().name}详情`}>
          <header class="drawer-header">
            <div>
              <strong>{target().name}</strong>
              <span>{target().version}</span>
            </div>
            <button
              type="button"
              class="drawer-close"
              aria-label="关闭详情"
              onClick={props.onClose}
            >
              ×
            </button>
          </header>
          <div class="drawer-content">
            <viewer.CardDataViewer />
          </div>
        </aside>
      )}
    </Show>
  );
}

