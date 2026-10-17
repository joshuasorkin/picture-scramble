import { test, expect, type Page } from "@playwright/test";
import { mockApiRoutes, TEST_CONTACT } from "./helpers";

// One drag solves it: move "B" right past "A" to spell "ABCD"
const SOLVABLE_GAME = {
  gameId: "0000000000000000000000ab",
  scramble: "BACD",
  picture: "https://placehold.co/512x512/png",
  solutionHash: "88d4266fd4e6338d13b845fcf289579d209c897823b9217da3e161936f031589",
  compliment: "Nice!",
  contact: TEST_CONTACT,
};

async function mockSolvableGame(page: Page, onRequest?: (url: URL) => void) {
  await page.route("**/api/new-game*", (route) => {
    onRequest?.(new URL(route.request().url()));
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(SOLVABLE_GAME) });
  });
}

// Desktop Chromium on Linux has no share sheet; capture the clipboard instead
async function captureClipboard(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { value: undefined });
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async (text: string) => {
          (window as unknown as { copied: string }).copied = text;
        },
      },
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
});

test.describe("Timer", () => {
  test("starts at 0:00 and counts up while playing", async ({ page }) => {
    await page.clock.install();
    await page.goto("/");
    await expect(page.locator("#rack-container")).toBeVisible();
    await expect(page.locator("#timer")).toHaveText("0:00");

    await page.clock.runFor(65_000);
    await expect(page.locator("#timer")).toHaveText("1:05");
  });

  test("stops when the puzzle is solved", async ({ page }) => {
    await mockSolvableGame(page);
    await page.clock.install();
    await page.goto("/");
    await expect(page.locator("#rack-container")).toBeVisible();

    await page.clock.runFor(12_000);
    await solveByDragging(page);
    await expect(page.locator("#share-button")).toBeVisible();
    await expect(page.locator("#timer")).toHaveText("0:12");

    await page.clock.runFor(10_000);
    await expect(page.locator("#timer")).toHaveText("0:12");
  });
});

// Pretend the player switched tabs (or came back)
async function setPageHidden(page: Page, hidden: boolean) {
  await page.evaluate((hidden) => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => (hidden ? "hidden" : "visible"),
    });
    document.dispatchEvent(new Event("visibilitychange"));
  }, hidden);
}

// Record the analytics events the page sends
function captureEvents(page: Page): Record<string, unknown>[] {
  const events: Record<string, unknown>[] = [];
  page.route("**/api/game-event*", (route) => {
    events.push(route.request().postDataJSON());
    route.fulfill({ status: 204 });
  });
  return events;
}

test.describe("Away from the puzzle", () => {
  test("the timer pauses while the page is hidden", async ({ page }) => {
    await page.clock.install();
    await page.goto("/");
    await expect(page.locator("#rack-container")).toBeVisible();

    await page.clock.runFor(10_000);
    await setPageHidden(page, true);
    await page.clock.runFor(600_000);
    await setPageHidden(page, false);
    await page.clock.runFor(5_000);
    await expect(page.locator("#timer")).toHaveText("0:15");
  });

  test("records leaving, skipping and solving with visible time", async ({ page }) => {
    await mockSolvableGame(page);
    const events = captureEvents(page);
    await page.clock.install();
    await page.goto("/");
    await expect(page.locator("#rack-container")).toBeVisible();

    await page.clock.runFor(7_000);
    await setPageHidden(page, true);
    await expect.poll(() => events.find((e) => e.type === "hide")).toMatchObject({
      gameId: SOLVABLE_GAME.gameId,
      activeSeconds: 7,
    });

    await page.clock.runFor(60_000);
    await setPageHidden(page, false);
    await page.clock.runFor(3_000);
    await page.locator(".skip-button").click();
    await expect.poll(() => events.find((e) => e.type === "skip")).toMatchObject({
      activeSeconds: 10,
    });

    await expect(page.locator("#rack-container")).toBeVisible();
    await page.clock.runFor(4_000);
    await solveByDragging(page);
    await expect.poll(() => events.find((e) => e.type === "solve")).toMatchObject({
      solveSeconds: 4,
    });
  });
});

test.describe("Share", () => {
  test("is hidden until the puzzle is solved", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#rack-container")).toBeVisible();
    await expect(page.locator("#share-button")).toHaveCount(0);
  });

  test("copies the message with the solve time and a link carrying language and topic", async ({ page }) => {
    await mockSolvableGame(page);
    await captureClipboard(page);
    let shareEvent: unknown = null;
    await page.route("**/api/game-event*", (route) => {
      const body = route.request().postDataJSON();
      if (body?.type === "share") shareEvent = body;
      route.fulfill({ status: 204 });
    });
    await page.clock.install();
    await page.goto("/?lang=Spanish&topic=astronomy");
    await expect(page.locator("#rack-container")).toBeVisible();

    await page.clock.runFor(9_000);
    await solveByDragging(page);
    await page.locator("#share-button").click();
    await expect(page.locator("#share-button")).toHaveText("Link copied!");

    const copied = await page.evaluate(() => (window as unknown as { copied: string }).copied);
    const [text, link] = copied.split(/ (?=http)/);
    expect(text).toBe("I solved this Utu's Wild Words puzzle in 9 seconds, how about you?");
    const url = new URL(link!);
    expect(url.searchParams.get("puzzle")).toBe(SOLVABLE_GAME.gameId);
    expect(url.searchParams.get("lang")).toBe("Spanish");
    expect(url.searchParams.get("topic")).toBe("astronomy");
    expect(url.searchParams.get("utm_source")).toBe("share");
    await expect.poll(() => shareEvent).toEqual({ type: "share", gameId: SOLVABLE_GAME.gameId });
  });
});

test.describe("Opening a shared link", () => {
  test("plays the shared puzzle first, then keeps the language and topic", async ({ page }) => {
    let sharedRequest = "";
    await page.route("**/api/shared-game*", (route) => {
      sharedRequest = route.request().url();
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(SOLVABLE_GAME) });
    });
    const newGameRequests: URL[] = [];
    await mockSolvableGame(page, (url) => newGameRequests.push(url));

    await page.goto(`/?puzzle=${SOLVABLE_GAME.gameId}&lang=Spanish&topic=astronomy&utm_source=share`);
    await expect(page.locator("#rack-container")).toBeVisible();

    expect(new URL(sharedRequest).searchParams.get("id")).toBe(SOLVABLE_GAME.gameId);
    // The puzzle param is dropped so a reload doesn't replay it
    await expect.poll(() => new URL(page.url()).searchParams.get("puzzle")).toBeNull();
    expect(new URL(page.url()).searchParams.get("lang")).toBe("Spanish");

    // Later (preloaded) games use the shared language and topic
    await expect.poll(() => newGameRequests.length).toBeGreaterThan(0);
    for (const url of newGameRequests) {
      expect(url.searchParams.get("lang")).toBe("Spanish");
      expect(url.searchParams.get("topic")).toBe("astronomy");
    }
  });

  test("falls back to a new game when the shared puzzle is missing", async ({ page }) => {
    await page.route("**/api/shared-game*", (route) => {
      route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Puzzle not found" }) });
    });

    await page.goto("/?puzzle=0000000000000000000000ff");
    await expect(page.locator("#rack-container")).toBeVisible();
    await expect(page.locator("#game-message")).toHaveCount(0);
  });
});
