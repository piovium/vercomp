import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { describe, expect, test, vi } from "vitest";
import { App } from "../src/App.tsx";
import { STORAGE_KEY } from "../src/state/selections.ts";
import { createManifestFixture } from "./fixtures.ts";

describe("App", () => {
  test("expands relationships and persists only the group selection", async () => {
    const manifest = createManifestFixture();
    const view = render(() => <App manifest={manifest} />);

    expect(screen.queryByText("关联技能")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "展开关联项" }));
    expect(screen.getByText("关联技能")).toBeInTheDocument();

    const masterRow = view.container.querySelector('[data-item-id="1"]')!;
    const latest = masterRow.querySelector(
      '[data-segment="2-2"]',
    ) as HTMLButtonElement;
    fireEvent.dblClick(latest);
    expect(screen.getByText("1 项已选择")).toBeInTheDocument();
    expect(latest).toHaveAttribute("aria-pressed", "true");

    await waitFor(() => {
      const persisted = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!);
      expect(persisted.selections).toEqual({ "1": "v3.5.0" });
    });
  });

  test("keeps a details panel visible and updates it on a segment click", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            id: 1,
            name: "主角色",
            hp: 10,
            maxEnergy: 2,
            tags: [],
            skills: [],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    const view = render(() => <App manifest={createManifestFixture()} />);
    const panel = screen.getByRole("complementary", {
      name: "卡牌版本详情",
    });
    expect(panel).toBeVisible();
    expect(panel).toHaveTextContent("点击任意卡牌版本显示详情");
    const segment = view.container.querySelector(
      '[data-item-id="1"] [data-segment="0-0"]',
    ) as HTMLButtonElement;
    fireEvent.click(segment);
    expect(await screen.findByRole("status")).toHaveTextContent("加载中");
    await screen.findByText("主角色", { selector: ".card-panel *" });
    expect(panel).toHaveTextContent("主角色");
  });

  test("keeps the default panel content after a segment double-click", () => {
    vi.useFakeTimers();
    try {
      const view = render(() => <App manifest={createManifestFixture()} />);
      const segment = view.container.querySelector(
        '[data-item-id="1"] [data-segment="0-0"]',
      ) as HTMLButtonElement;

      fireEvent.click(segment);
      fireEvent.click(segment);
      fireEvent.dblClick(segment);
      vi.advanceTimersByTime(500);

      expect(
        screen.getByRole("complementary", { name: "卡牌版本详情" }),
      ).toHaveTextContent("点击任意卡牌版本显示详情");
    } finally {
      vi.useRealTimers();
    }
  });

  test("keeps the open detail panel mounted during a segment double-click", async () => {
    const view = render(() => <App manifest={createManifestFixture()} />);
    const segment = view.container.querySelector(
      '[data-item-id="1"] [data-segment="0-0"]',
    ) as HTMLButtonElement;
    fireEvent.click(segment);
    const panel = await screen.findByRole("complementary", {
      name: "卡牌版本详情",
    });

    fireEvent.click(segment);
    fireEvent.click(segment);
    fireEvent.dblClick(segment);

    expect(screen.getByRole("complementary", { name: "卡牌版本详情" })).toBe(
      panel,
    );
  });

  test("renders analyzer-only items without interactive segments", () => {
    const view = render(() => <App manifest={createManifestFixture()} />);
    const placeholder = view.container.querySelector('[data-item-id="9"]')!;
    expect(placeholder).toHaveTextContent("OnlyAnalyzer");
    expect(placeholder).toHaveTextContent("所有正式版本均无静态数据");
    expect(placeholder.querySelector(".version-segment")).toBeNull();
  });
});
