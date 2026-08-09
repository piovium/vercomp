import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("keeps headers frozen in both scroll directions", async ({ page }) => {
  const scroll = page.getByTestId("table-scroll");
  const corner = page.locator(".corner-heading");
  const firstVisibleRowHeader = page.locator(".compare-row .row-heading").first();
  const initialCorner = await corner.boundingBox();
  const initialRow = await firstVisibleRowHeader.boundingBox();

  await scroll.evaluate((element) => element.scrollTo({ left: 900, top: 0 }));
  await expect
    .poll(async () => (await firstVisibleRowHeader.boundingBox())?.x)
    .toBeCloseTo(initialRow!.x, 0);

  await scroll.evaluate((element) => element.scrollTo({ left: 900, top: 900 }));
  await expect
    .poll(async () => (await corner.boundingBox())?.y)
    .toBeCloseTo(initialCorner!.y, 0);
});

test("keeps the details panel visible and persists a double-click selection", async ({ page }) => {
  const segment = page.locator('[data-master="true"] .version-segment').first();
  const panel = page.locator(".detail-panel");
  await expect(panel).toContainText("点击任意卡牌版本显示详情");
  const panelBox = await panel.boundingBox();
  const viewport = page.viewportSize();
  expect(panelBox!.x + panelBox!.width).toBeCloseTo(viewport!.width, 0);
  await segment.click();
  await expect(panel).toBeVisible();
  await expect(panel).not.toContainText("点击任意卡牌版本显示详情");

  await segment.dblclick();
  await expect(segment).toHaveAttribute("aria-pressed", "true");
  const selectedCount = await page.locator(".toolbar-actions span").textContent();
  expect(selectedCount).not.toBe("0 项已选择");

  await page.reload();
  await expect(
    page.locator('[data-master="true"] .version-segment.selected').first(),
  ).toBeVisible();
});

test("keeps the open detail panel mounted during a double-click", async ({
  page,
}) => {
  const segment = page.locator('[data-master="true"] .version-segment').first();
  await segment.click();
  const panel = page.locator(".detail-panel");
  await expect(panel).toBeVisible();
  await panel.evaluate((element) =>
    element.setAttribute("data-mounted-marker", "true"),
  );

  await segment.dblclick();
  await expect(panel).toHaveAttribute("data-mounted-marker", "true");
});
