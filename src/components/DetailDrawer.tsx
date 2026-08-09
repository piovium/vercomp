import { lazy, onCleanup, onMount, Show, Suspense } from "solid-js";
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

const DetailDrawerContent = lazy(async () => ({
  default: (await import("./DetailDrawerContent.tsx")).DetailDrawerContent,
}));

export function DetailDrawer(props: DetailDrawerProps) {
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
            <Suspense
              fallback={
                <div class="drawer-loading" role="status">
                  加载中…
                </div>
              }
            >
              <DetailDrawerContent target={target()} />
            </Suspense>
          </div>
        </aside>
      )}
    </Show>
  );
}
