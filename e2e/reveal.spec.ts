import { test, expect, type Page } from "@playwright/test";
import sharp from "sharp";
import { mockApiRoutes } from "./helpers";

// One drag solves it: move "B" right past "A" to spell "ABCD"
const SOLVABLE_GAME = {
  scramble: "BACD",
  solutionHash: "88d4266fd4e6338d13b845fcf289579d209c897823b9217da3e161936f031589",
  compliment: "Nice!",
  contact: {},
};

const PICTURE_HOST = "https://img.reveal.test";

// Each game gets its own picture, served with CORS headers like the R2 bucket
async function mockGamesWithPictures(page: Page) {
  let n = 0;
  await page.route("**/api/new-game*", (route) => {
    n++;
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...SOLVABLE_GAME,
        gameId: n.toString(16).padStart(24, "0"),
        picture: `${PICTURE_HOST}/pic-${n}.png`,
      }),
    });
  });
  await page.route(`${PICTURE_HOST}/**`, async (route) => {
    const shade = Number(route.request().url().match(/pic-(\d+)/)?.[1] ?? 0) * 40;
    const png = await sharp({
      create: { width: 64, height: 64, channels: 3, background: { r: shade % 256, g: 100, b: 200 } },
    })
      .png()
      .toBuffer();
    route.fulfill({
      status: 200,
      contentType: "image/png",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: png,
    });
  });
}

async function solveByDragging(page: Page) {
  const tiles = page.locator("#rack-container g");
  await expect(tiles).toHaveCount(4);
  const first = (await tiles.nth(0).boundingBox())!;
  const second = (await tiles.nth(1).boundingBox())!;
  await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
  await page.mouse.down();
  await page.mouse.move(second.x + second.width * 0.9, first.y + first.height / 2, { steps: 5 });
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
  await mockApiRoutes(page);
  await mockGamesWithPictures(page);
});

test.describe("Picture reveal", () => {
  test("click to continue reveals the next picture over the old one", async ({ page }) => {
    await page.goto("/");
    const image = page.locator("#game-image");
    await expect(image).toHaveAttribute("src", /pic-1\.png/);

    await solveByDragging(page);
    const victory = page.locator("#victory-message");
    await expect(victory).toBeVisible({ timeout: 5000 });
    await victory.click();

    // Canvas covers the picture while the new one grows in, then goes away
    const canvas = page.locator("#reveal-canvas");
    await expect(canvas).toBeVisible();
    await expect(image).toHaveAttribute("src", /pic-[2-9]\.png/);
    const [canvasBox, imageBox] = await Promise.all([canvas.boundingBox(), image.boundingBox()]);
    expect(canvasBox).toEqual(imageBox);
    await expect(canvas).toBeHidden({ timeout: 5000 });
  });

  test("skip swaps the picture in at once", async ({ page }) => {
    await page.goto("/");
    const image = page.locator("#game-image");
    await expect(image).toHaveAttribute("src", /pic-1\.png/);

    await page.locator(".skip-button").click();
    await expect(image).toHaveAttribute("src", /pic-[2-9]\.png/);
    await expect(page.locator("#reveal-canvas")).toBeHidden();
  });

  test("falls back to a swap when the picture can't be read", async ({ page }) => {
    // Pictures without CORS headers can't be loaded for the canvas
    await page.route(`${PICTURE_HOST}/**`, async (route) => {
      const png = await sharp({
        create: { width: 64, height: 64, channels: 3, background: { r: 0, g: 0, b: 0 } },
      })
        .png()
        .toBuffer();
      route.fulfill({ status: 200, contentType: "image/png", body: png });
    });
    await page.goto("/");
    const image = page.locator("#game-image");
    await expect(image).toHaveAttribute("src", /pic-1\.png/);

    await solveByDragging(page);
    const victory = page.locator("#victory-message");
    await expect(victory).toBeVisible({ timeout: 5000 });
    await victory.click();

    await expect(image).toHaveAttribute("src", /pic-[2-9]\.png/);
    await expect(page.locator("#reveal-canvas")).toBeHidden();
  });
});
