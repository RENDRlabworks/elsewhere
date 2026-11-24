import { expect, test, type Page } from "@playwright/test";

/**
 * Essential workflows, exercised through the real UI in local development mode.
 * The development sketch provider stands in for a live image provider and its
 * outputs are labelled as such.
 */

async function openStudio(page: Page) {
  await page.goto("/studio");
  await expect(page.getByRole("button", { name: /^Generate/ }).first()).toBeVisible();
}

test.describe.configure({ mode: "serial" });

test("bootstraps the workspace with Style DNA presets and Volume I", async ({ page }) => {
  await page.goto("/collections");
  await expect(page.getByText("Elsewhere: Volume I").first()).toBeVisible();
  await page.goto("/style-dna");
  for (const name of ["Elsewhere Original", "Cosmic Minimalism", "Nocturnal Nature", "Atmospheric Monochrome", "Surreal Geological", "Quiet Architectural"]) {
    await expect(page.getByText(name).first()).toBeVisible();
  }
});

test("directs a scene, sees the prompt update live, and generates", async ({ page }) => {
  await openStudio(page);
  await page.getByRole("button", { name: "New scene" }).click();
  await page.getByLabel("Title", { exact: true }).fill("The Frozen Hour");
  await page.getByLabel("Environment").fill("a frozen plain beneath a pale sky");
  await page.getByLabel("Impossible phenomenon").fill("a single raindrop the size of a house, suspended above the ice");

  // Live, deterministic prompt preview reflects scene direction.
  const promptPanel = page.locator("ol").filter({ hasText: "Impossible phenomenon" });
  await expect(promptPanel).toContainText("raindrop the size of a house");
  await expect(promptPanel).toContainText("No collage");

  await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press("Control+Enter");
  await expect(page.getByText("Development sketch. Not generated artwork.")).toBeVisible({ timeout: 20_000 });

  // Review actions on the generated image.
  await page.getByRole("button", { name: "Favorite" }).click();
  await expect(page.getByText("Added to favorites")).toBeVisible();
});

test("randomizes only unlocked fields", async ({ page }) => {
  await openStudio(page);
  const env = page.getByLabel("Environment");
  await env.fill("a locked basalt shore");
  await page.getByRole("button", { name: "Lock Environment" }).click();
  await page.getByRole("button", { name: /Randomize unlocked/ }).click();
  await expect(page.getByText(/New direction:/)).toBeVisible();
  await expect(env).toHaveValue("a locked basalt shore");
});

test("finds generations in the archive by search", async ({ page }) => {
  await page.goto("/archive?q=frozen");
  await expect(page.getByRole("button", { name: /Open The Frozen Hour/ }).first()).toBeVisible({ timeout: 15_000 });
  await page.goto("/archive?q=nothing-matches-this-query");
  await expect(page.getByRole("button", { name: /Open The Frozen Hour/ })).toHaveCount(0);
});

test("locked Style DNA attributes cannot be changed through the API", async ({ request }) => {
  const { profiles } = await (await request.get("/api/styles")).json();
  const id = profiles[0].id as string;
  await request.post(`/api/styles/${id}/lock`, { data: { lockedAttributes: ["lighting"] } });
  const blocked = await request.patch(`/api/styles/${id}`, { data: { attributes: { lighting: "neon glow" } } });
  expect(blocked.status()).toBe(409);
  const allowed = await request.patch(`/api/styles/${id}`, { data: { attributes: { grain: "fine silver grain" } } });
  expect(allowed.ok()).toBeTruthy();
  const { profile } = await allowed.json();
  expect(profile.attributes.grain).toBe("fine silver grain");
  expect(profile.currentVersion).toBeGreaterThan(1);
  await request.post(`/api/styles/${id}/lock`, { data: { lockedAttributes: [] } });
});

test("explore generates structured concepts and sends one to the Studio", async ({ page }) => {
  await page.goto("/explore");
  await page.getByRole("button", { name: /^Randomize all/i }).first().click();
  await page.getByRole("button", { name: /Send to Studio/i }).first().click();
  await expect(page).toHaveURL(/\/studio/);
  await expect(page.getByRole("button", { name: /^Generate/ }).first()).toBeVisible();
});

test("command palette navigates", async ({ page }) => {
  await openStudio(page);
  await page.keyboard.press("Control+k");
  await page.getByPlaceholder("Type a command or search…").fill("Settings");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/settings/);
});
