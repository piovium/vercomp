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

  test("opens and closes the details drawer on a segment click", async () => {
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
    const segment = view.container.querySelector(
      '[data-item-id="1"] [data-segment="0-0"]',
    ) as HTMLButtonElement;
    fireEvent.click(segment);
    const drawer = screen.getByRole("complementary", { name: "主角色详情" });
    expect(drawer).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("加载中");
    await screen.findByText("主角色", { selector: ".card-panel *" });
    fireEvent.click(screen.getByRole("button", { name: "关闭详情" }));
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  test("keeps the open drawer mounted during a segment double-click", () => {
    const view = render(() => <App manifest={createManifestFixture()} />);
    const segment = view.container.querySelector(
      '[data-item-id="1"] [data-segment="0-0"]',
    ) as HTMLButtonElement;
    fireEvent.click(segment);
    const drawer = screen.getByRole("complementary", { name: "主角色详情" });

    fireEvent.click(segment);
    fireEvent.click(segment);
    fireEvent.dblClick(segment);

    expect(screen.getByRole("complementary", { name: "主角色详情" })).toBe(
      drawer,
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
