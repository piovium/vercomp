import { lazy, Show, Suspense } from "solid-js";
import type { ItemKind, Version } from "../data/types.ts";

export interface DetailTarget {
  id: number;
  name: string;
  kind: ItemKind;
  version: Version;
}

interface DetailPanelProps {
  target: DetailTarget | null;
}

const DetailPanelContent = lazy(async () => ({
  default: (await import("./DetailPanelContent.tsx")).DetailPanelContent,
}));

export function DetailPanel(props: DetailPanelProps) {
  return (
    <aside class="detail-panel" aria-label="卡牌版本详情">
      <header class="detail-panel-header">
        <Show
          when={props.target}
          fallback={<strong>卡牌版本详情</strong>}
        >
          {(target) => (
            <div>
              <strong>{target().name}</strong>
              <span>{target().version}</span>
            </div>
          )}
        </Show>
      </header>
      <div class="detail-panel-content" data-dark>
        <Show
          when={props.target}
          fallback={
            <p class="detail-panel-placeholder">点击任意卡牌版本显示详情</p>
          }
        >
          {(target) => (
            <Suspense
              fallback={
                <div class="detail-panel-loading" role="status">
                  加载中…
                </div>
              }
            >
              <DetailPanelContent target={target()} />
            </Suspense>
          )}
        </Show>
      </div>
    </aside>
  );
}
