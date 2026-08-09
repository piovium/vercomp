import { AssetsManager } from "@gi-tcg/assets-manager";
import { createCardDataViewer } from "@gi-tcg/card-data-viewer";
import { createEffect, createMemo } from "solid-js";
import type { Version } from "../data/types.ts";
import type { DetailTarget } from "./DetailPanel.tsx";

interface DetailPanelContentProps {
  target: DetailTarget;
}

const API_ENDPOINT =
  import.meta.env.VITE_ASSETS_API_ENDPOINT ??
  "https://static-data.piovium.org/api/v4";

export function DetailPanelContent(props: DetailPanelContentProps) {
  const managers = new Map<Version, AssetsManager>();
  const manager = createMemo(() => {
    const version = props.target.version;
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
    if (target.kind === "character") {
      viewer.showCharacter(target.id);
    } else if (target.kind === "skill") {
      viewer.showSkill(target.id);
    } else if (target.kind === "action-card") {
      viewer.showCard(target.id);
    } else {
      viewer.showState("entity", {
        id: 0,
        definitionId: target.id,
        tags: 0,
        type: 0,
        descriptionDictionary: {},
        hasUsagePerRound: false,
        attachment: [],
        definitionCost: [],
      });
    }
  });

  return <viewer.CardDataViewer />;
}
