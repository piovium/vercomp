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

test("opens details and persists a double-click selection", async ({ page }) => {
  const segment = page.locator('[data-master="true"] .version-segment').first();
  await segment.click();
  const drawer = page.locator(".detail-drawer");
  await expect(drawer).toBeVisible();
  await drawer.evaluate((element) =>
    Promise.all(element.getAnimations().map((animation) => animation.finished)),
  );
  await page.getByRole("button", { name: "关闭详情" }).click();

  await segment.dblclick();
  await expect(segment).toHaveAttribute("aria-pressed", "true");
  const selectedCount = await page.locator(".toolbar-actions span").textContent();
  expect(selectedCount).not.toBe("0 项已选择");

  await page.reload();
  await expect(
    page.locator('[data-master="true"] .version-segment.selected').first(),
  ).toBeVisible();
});

test("does not restart the open drawer animation on double-click", async ({
  page,
}) => {
  const segment = page.locator('[data-master="true"] .version-segment').first();
  await segment.click();
  const drawer = page.locator(".detail-drawer");
  await expect(drawer).toBeVisible();
  await drawer.evaluate((element) => {
    (window as typeof window & { drawerAnimationStarts: number })
      .drawerAnimationStarts = 0;
    document.addEventListener("animationstart", (event) => {
      if ((event.target as Element).classList.contains("detail-drawer")) {
        (window as typeof window & { drawerAnimationStarts: number })
          .drawerAnimationStarts += 1;
      }
    });
  });

  await segment.dblclick();

  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as typeof window & { drawerAnimationStarts: number })
            .drawerAnimationStarts,
      ),
    )
    .toBe(0);
});
