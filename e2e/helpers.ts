import { Page } from "@playwright/test";

// Test fixture data — "apple" scrambled to "LPAPE"
export const TEST_WORD = "apple";
export const TEST_SCRAMBLE = "LPAPE";
export const TEST_HASH =
  "3a7bd3e2360a3d29eea436fcfb7e44c735d117c42d1c1835420b6b9942dd4f1b";
export const TEST_COMPLIMENT = "You're a word wizard!";
export const TEST_GAME_ID = "000000000000000000000001";

export const TEST_CONTACT = {
  name: "Test Artist",
  instagram: "testartist",
};

function makeGameResponse(overrides: Record<string, unknown> = {}) {
  return {
    gameId: TEST_GAME_ID,
    scramble: TEST_SCRAMBLE,
    picture: "https://placehold.co/512x512/png",
    solutionHash: TEST_HASH,
    compliment: TEST_COMPLIMENT,
    contact: TEST_CONTACT,
    ...overrides,
  };
}

function makeCheckResponse(correct: boolean, mismatches: number[] = []) {
  return {
    checkResult: correct,
    compliment: TEST_COMPLIMENT,
    mismatches,
  };
}

/**
 * Intercept API routes so e2e tests don't need MongoDB or OpenAI.
 */
export async function mockApiRoutes(page: Page) {
  // Mock new-game endpoint
  await page.route("**/api/new-game*", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(makeGameResponse()),
    });
  });

  // Mock check-game endpoint — check playerSolution query param
  await page.route("**/api/check-game*", (route) => {
    const url = new URL(route.request().url());
    const solution = url.searchParams.get("playerSolution");
    if (solution === TEST_WORD) {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(makeCheckResponse(true)),
      });
    } else {
      const mismatches = [0, 1]; // first two chars wrong
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(makeCheckResponse(false, mismatches)),
      });
    }
  });

  // Mock default-contact endpoint
  await page.route("**/api/default-contact*", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify("https://example.com/contact"),
    });
  });
}
