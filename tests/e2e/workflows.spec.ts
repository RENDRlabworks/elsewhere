import { expect, test, type Page } from "@playwright/test";

/**
 * Essential workflows, exercised through the real UI in local development mode.
 * The development sketch provider stands in for a live image provider and its
 * outputs are labelled as such.
 */

/** Open Create in a new tab on a blank scene. Tabs are saved, so earlier tabs may reopen first. */
async function openStudio(page: Page) {
  await page.goto("/studio");
  await page.getByRole("button", { name: "New tab", exact: true }).click();
  await page.getByRole("button", { name: /^Blank scene/ }).click();
  await expect(page.getByRole("button", { name: /^Generate/ }).first()).toBeVisible();
}

/** New, then Blank scene: a scene with nothing carried over. */
async function newBlankScene(page: Page) {
  await page.getByRole("button", { name: "New scene", exact: true }).click();
  await page.getByRole("button", { name: /^Blank scene/ }).click();
  await expect(page.getByRole("button", { name: /^Generate/ }).first()).toBeVisible();
}

/** Open a Create chip (Look, Subject, Colour, Setting, Phenomenon) if it is closed. */
async function openChip(page: Page, name: string) {
  const chip = page.getByRole("button", { name: new RegExp(`^${name}`) }).first();
  if ((await chip.getAttribute("aria-expanded")) !== "true") await chip.click();
}

/** Open Fine-tune and its Scene section, where the title and description live. */
async function openSceneFields(page: Page) {
  const fineTune = page.getByRole("button", { name: "Fine-tune" });
  if ((await fineTune.getAttribute("aria-expanded")) !== "true") await fineTune.click();
  const section = page.getByRole("button", { name: "Scene", exact: true });
  if ((await section.getAttribute("aria-expanded")) !== "true") await section.click();
}

test.describe.configure({ mode: "serial" });

test("bootstraps the workspace with Style DNA presets and Volume I", async ({ page }) => {
  await page.goto("/collections");
  await expect(page.getByText("Elsewhere: Volume I").first()).toBeVisible();
  await page.goto("/style-dna");
  for (const name of ["Elsewhere Volume I", "Elsewhere Photographic", "Cosmic Minimalism", "Nocturnal Nature", "Atmospheric Monochrome", "Surreal Geological", "Quiet Architectural"]) {
    await expect(page.getByText(name).first()).toBeVisible();
  }
});

test("directs a scene, sees the prompt update live, and generates", async ({ page }) => {
  await openStudio(page);
  await newBlankScene(page);
  await openSceneFields(page);
  await page.getByLabel("Title", { exact: true }).fill("The Frozen Hour");
  await openChip(page, "Setting");
  await page.getByLabel("Environment", { exact: true }).fill("a frozen plain beneath a pale sky");
  await openChip(page, "Phenomenon");
  await page.getByLabel("Impossible phenomenon", { exact: true }).fill("a single raindrop the size of a house, suspended above the ice");

  // The prompt sent is one click away in Details, and updates live.
  await page.getByRole("button", { name: "Details", exact: true }).click();
  await page.getByRole("tab", { name: "Prompt sent" }).click();
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
  await openChip(page, "Setting");
  const env = page.getByLabel("Environment", { exact: true });
  await env.fill("a locked basalt shore");
  await page.getByRole("button", { name: "Lock Environment" }).click();
  await page.getByRole("button", { name: /Surprise me \(unlocked\)/ }).click();
  await expect(page.getByText(/New direction:/)).toBeVisible();
  await expect(env).toHaveValue("a locked basalt shore");
});

test("finds generations in the archive by search", async ({ page }) => {
  await page.goto("/archive?q=frozen");
  await expect(page.getByRole("button", { name: /Open The Frozen Hour/ }).first()).toBeVisible({ timeout: 15_000 });
  await page.goto("/archive?q=nothing-matches-this-query");
  await expect(page.getByRole("button", { name: /Open The Frozen Hour/ })).toHaveCount(0);
});

test("recreates an image's style with a new direction", async ({ page }) => {
  await page.goto("/archive?q=frozen");
  const tile = page.getByRole("button", { name: /Open The Frozen Hour/ }).first();
  await expect(tile).toBeVisible({ timeout: 15_000 });
  await tile.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Recreate in this style" }).click();

  await expect(page.getByText(/is attached as the style reference/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("The Frozen Hour (new)", { exact: true }).first()).toBeVisible();

  // The image now sits on the Style DNA reference board as a style reference, sharing its file.
  const { references } = await (await page.request.get("/api/references")).json();
  const ref = references.find((r: { label: string; role: string }) => r.label === "The Frozen Hour" && r.role === "style");
  expect(ref).toBeTruthy();
  const { items } = await (await page.request.get("/api/generations?q=frozen")).json();
  expect(items.some((g: { assetId: string }) => g.assetId === ref.assetId)).toBe(true);
});

test("works from a starting image chosen in the Studio and fills fields with ideas", async ({ page }) => {
  await openStudio(page);
  await newBlankScene(page);
  await page.getByRole("button", { name: "Choose image" }).click();
  await page.getByRole("tab", { name: "All images" }).click();
  await page.getByRole("button", { name: /Select The Frozen Hour/ }).first().click();
  await page.getByRole("button", { name: "Use its look", exact: true }).click();
  await expect(page.getByText("Starting image attached")).toBeVisible();
  await expect(page.getByRole("region", { name: "Starting image" }).getByRole("img", { name: "The Frozen Hour" })).toBeVisible();

  // Ideas fill a field, respect locks, and undo restores the previous text.
  await openChip(page, "Setting");
  const env = page.getByLabel("Environment", { exact: true });
  await env.fill("a quiet shore");
  await page.getByRole("button", { name: "New idea for Environment" }).click();
  await expect(env).not.toHaveValue("a quiet shore");
  await expect(env).not.toHaveValue("");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(env).toHaveValue("a quiet shore");
  await page.getByRole("button", { name: "Lock Environment" }).click();
  await expect(page.getByRole("button", { name: "New idea for Environment" })).toBeDisabled();

  // A new scene starts blank, with one click to keep the starting image and look.
  await newBlankScene(page);
  await expect(page.getByRole("region", { name: "Starting image" }).getByRole("img", { name: "The Frozen Hour" })).toHaveCount(0);
  await page.getByRole("button", { name: "Keep starting image and look" }).click();
  await expect(page.getByRole("region", { name: "Starting image" }).getByRole("img", { name: "The Frozen Hour" })).toBeVisible();
});

test("suggestion menus open with every option even when the field has text", async ({ page }) => {
  await openStudio(page);
  await openChip(page, "Setting");
  const env = page.getByLabel("Environment", { exact: true });
  await env.fill("a black volcanic coastline");
  await env.locator("..").getByRole("button", { name: "Show suggestions" }).click();
  const list = page.getByRole("listbox", { name: "Suggestions" });
  await expect(list.getByRole("option")).toHaveCount(90);
  await expect(list.getByRole("group", { name: "Ice and snow" })).toBeVisible();
  await list.getByRole("option", { name: "a vast salt flat stretching to an invisible horizon" }).click();
  await expect(env).toHaveValue("a vast salt flat stretching to an invisible horizon");
  await expect(list).toBeHidden();
  // Typing filters; ArrowDown and Enter choose.
  await env.fill("forest");
  await expect(list.getByRole("option")).not.toHaveCount(0);
  await env.press("ArrowDown");
  await env.press("Enter");
  await expect(env).toHaveValue(/forest/);
});

test("changing the subject rewrites the fields that name it", async ({ page }) => {
  await openStudio(page);
  await newBlankScene(page);
  await openSceneFields(page);
  await page.getByLabel("Title", { exact: true }).fill("The Fox's Wish");
  await page.getByLabel("Description", { exact: true }).last().fill("A fox beneath a dandelion clock.");
  await openChip(page, "Subject");
  await page.getByLabel("Character", { exact: true }).first().click();
  await page.getByRole("option", { name: "Fox" }).click();
  await page.getByLabel("Character", { exact: true }).first().click();
  await page.getByRole("option", { name: "Horse" }).click();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("The Horse's Wish");
  await expect(page.getByLabel("Description", { exact: true }).last()).toHaveValue("A horse beneath a dandelion clock.");
  await expect(page.getByText(/Updated the title and description to match the horse/)).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).first().click();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("The Fox's Wish");
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
  await page.getByRole("button", { name: /^Shuffle/i }).first().click();
  await page.getByRole("button", { name: /Send to Create/i }).first().click();
  await expect(page).toHaveURL(/\/studio/);
  await expect(page.getByRole("button", { name: /^Generate/ }).first()).toBeVisible();
});

test("live previews can be set in Settings", async ({ page }) => {
  await page.goto("/settings");
  const group = page.getByRole("radiogroup", { name: "Live previews per image" });
  await expect(group).toBeVisible();
  await group.getByText("3", { exact: true }).click();
  await expect.poll(async () => (await (await page.request.get("/api/bootstrap")).json()).preferences.defaults.partialImages).toBe(3);
  await group.getByText("2", { exact: true }).click();
  await expect.poll(async () => (await (await page.request.get("/api/bootstrap")).json()).preferences.defaults.partialImages).toBe(2);
});

test("command palette navigates", async ({ page }) => {
  await openStudio(page);
  await page.keyboard.press("Control+k");
  await page.getByPlaceholder("Type a command or search…").fill("Settings");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/settings/);
});

test("shares an image with a crop, caption and alt text", async ({ page }) => {
  await page.goto("/archive?q=frozen");
  const tile = page.locator("main").getByRole("button", { name: /Open The Frozen Hour/ }).first();
  await expect(tile).toBeVisible({ timeout: 15_000 });
  await tile.click({ button: "right" });
  await page.getByRole("menuitem", { name: /Share or export/ }).click();
  const sheet = page.getByRole("dialog", { name: /Share The Frozen Hour/ });
  await expect(sheet).toBeVisible();
  await sheet.getByRole("radio", { name: "1:1" }).click();
  await sheet.getByRole("radio", { name: "Social" }).click();
  await expect(sheet.getByText("1080 × 1080 px")).toBeVisible();
  await expect(sheet.getByRole("textbox", { name: "Alt text" })).not.toHaveValue("");
  await sheet.getByRole("textbox", { name: "Caption" }).fill("The Frozen Hour\n\nA quiet test caption.");
  await sheet.getByRole("textbox", { name: "Alt text" }).click();
  await expect(sheet.getByText(/^Saved$|kept while this sheet is open/)).toBeVisible();

  const download = page.waitForEvent("download");
  await sheet.getByRole("link", { name: "Download" }).click();
  expect((await download).suggestedFilename()).toBe("the-frozen-hour-1x1.jpg");

  // The export endpoint returns exactly the chosen size.
  const href = await sheet.getByRole("link", { name: "Download" }).getAttribute("href");
  const res = await page.request.get(href!);
  expect(res.headers()["content-type"]).toBe("image/jpeg");
  expect(res.headers()["x-image-width"]).toBe("1080");
  expect(res.headers()["x-image-height"]).toBe("1080");
});

test("reviews new images one at a time", async ({ page }) => {
  await page.goto("/archive/review");
  await expect(page.getByRole("group", { name: "Review this image" })).toBeVisible({ timeout: 15_000 });
  const title = await page.locator("main h1").innerText();
  await page.keyboard.press("a");
  await expect(page.locator("main h1")).not.toHaveText(title);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.locator("main h1")).toHaveText(title);
  await page.getByRole("button", { name: /^Reject/ }).click();
  const { items } = await (await page.request.get("/api/generations?filter=rejected&limit=200")).json();
  expect(items.some((g: { title: string }) => g.title === title)).toBe(true);
});

test("library search finds collections as well as images", async ({ page }) => {
  await page.goto("/archive?q=volume");
  await expect(page.getByRole("region", { name: "Matching collections" }).getByText("Elsewhere: Volume I")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("link", { name: "Collections", exact: true }).click();
  await expect(page).toHaveURL(/\/collections\?q=volume/);
  await expect(page.getByLabel("Search collections")).toHaveValue("volume");
  await page.getByLabel("Search collections").fill("no such collection");
  await expect(page.getByText("No collections match")).toBeVisible();
});

test("captures an idea and makes it a scene", async ({ page }) => {
  await page.goto("/archive");
  await expect(page.locator("main").getByRole("heading", { name: "Library" })).toBeVisible({ timeout: 15_000 });
  await page.keyboard.press("n");
  const dialog = page.getByRole("dialog", { name: "Capture an idea" });
  await dialog.getByLabel("Idea", { exact: true }).fill("A heron standing in a flooded ballroom\nThe chandeliers are lit underwater");
  await dialog.getByRole("button", { name: "Save to inbox" }).click();
  await expect(page.getByText("Saved to your inbox")).toBeVisible();

  await page.goto("/inbox");
  const card = page.getByRole("listitem").filter({ hasText: "A heron standing in a flooded ballroom" });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Make a scene" }).click();
  // Create loads the scene from ?scene= and then tidies the address, so check the scene, not the URL.
  await expect(page).toHaveURL(/\/studio/);
  await expect(page.getByText("A heron standing in a flooded ballroom").first()).toBeVisible({ timeout: 15_000 });

  const { ideas } = await (await page.request.get("/api/inbox?status=used")).json();
  expect(ideas.some((i: { text: string; sceneId: string | null }) => i.text.startsWith("A heron") && i.sceneId)).toBe(true);
});

test("things shared from the phone's share sheet land in the inbox", async ({ page }) => {
  const res = await page.request.post("/share-target", {
    multipart: { title: "Morning light", text: "Morning light on the reservoir https://example.com/light" },
    maxRedirects: 0,
  });
  expect(res.status()).toBe(303);
  expect(res.headers()["location"]).toContain("/inbox?shared=1");
  const { ideas } = await (await page.request.get("/api/inbox")).json();
  const idea = ideas.find((i: { text: string }) => i.text.startsWith("Morning light"));
  expect(idea?.url).toBe("https://example.com/light");
  expect(idea?.source).toBe("shared");

  const manifest = await (await page.request.get("/manifest.webmanifest")).json();
  expect(manifest.share_target.action).toBe("/share-target");
});

test("upscales an image with AI from the right-click menu", async ({ page }) => {
  await page.goto("/archive?q=frozen");
  const tile = page.locator("main").getByRole("button", { name: /Open The Frozen Hour/ }).first();
  await expect(tile).toBeVisible({ timeout: 15_000 });
  await tile.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Upscale with AI" }).click();
  await expect(page.getByText(/^Upscaling The Frozen Hour/)).toBeVisible();
  await expect
    .poll(async () => {
      const { items } = await (await page.request.get("/api/generations?q=frozen&limit=50")).json();
      return items.some((g: { tags: string[]; status: string }) => g.tags.includes("upscaled") && g.status === "completed");
    }, { timeout: 20_000 })
    .toBe(true);
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 393, height: 852 }, hasTouch: true, isMobile: true });

  test("navigates with the tab bar and switches Create between image and Direct", async ({ page }) => {
    await page.goto("/studio");
    await page.getByRole("button", { name: /^Tabs, \d+ open/ }).click();
    await page.getByRole("dialog", { name: "Tabs" }).getByRole("button", { name: "New tab", exact: true }).click();
    await page.getByRole("button", { name: /^Blank scene/ }).click();
    const tabs = page.getByRole("navigation", { name: "Primary" }).last();
    await expect(tabs.getByRole("link", { name: "Library" })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("tab", { name: "Direct" }).click();
    await expect(page.getByRole("button", { name: /^Generate/ }).first()).toBeVisible();
    await tabs.getByRole("link", { name: "Library" }).click();
    await expect(page).toHaveURL(/\/archive/);
    await tabs.getByRole("button", { name: "Capture an idea" }).click();
    await expect(page.getByRole("dialog", { name: "Capture an idea" })).toBeVisible();
  });
});

test("a new tab opens on the start screen and resumes a recent scene from it", async ({ page }) => {
  await page.goto("/studio");
  await page.getByRole("button", { name: "New tab", exact: true }).click();
  await expect(page.getByRole("heading", { name: "What are you starting from?" })).toBeVisible({ timeout: 15_000 });
  // Nothing from earlier work is on screen until it is chosen.
  await expect(page.getByRole("listbox", { name: "Images for this scene" })).toHaveCount(0);
  const recent = page.getByRole("region", { name: "Pick up where you left off" });
  await recent.getByRole("button").first().click();
  await expect(page.getByRole("heading", { name: "What are you starting from?" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Generate/ }).first()).toBeVisible();
  // A new tab brings the start screen back.
  await page.getByRole("button", { name: "New tab", exact: true }).click();
  await expect(page.getByRole("heading", { name: "What are you starting from?" })).toBeVisible();
  await page.getByRole("button", { name: /^Start from / }).first().click();
  await expect(page.getByText(/Starting image attached/)).toBeVisible();
});

test("tabs hold separate scenes, switch, close and come back after a reload", async ({ page }) => {
  await openStudio(page);
  await openSceneFields(page);
  await page.getByLabel("Title", { exact: true }).fill("Tab one");
  await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: "New tab", exact: true }).click();
  await page.getByRole("button", { name: /^Blank scene/ }).click();
  await openSceneFields(page);
  await page.getByLabel("Title", { exact: true }).fill("Tab two");
  await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 10_000 });

  const strip = page.getByRole("tablist", { name: "Open scenes" });
  await strip.getByRole("tab", { name: "Tab one" }).click();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Tab one");
  await expect(strip.getByRole("tab", { name: "Tab one" })).toHaveAttribute("aria-selected", "true");

  // Tabs are saved to preferences, so they survive a reload (and follow you to other devices).
  await page.waitForTimeout(700);
  await page.reload();
  await expect(strip.getByRole("tab", { name: "Tab two" })).toBeVisible({ timeout: 15_000 });
  await expect(strip.getByRole("tab", { name: "Tab one" })).toHaveAttribute("aria-selected", "true");

  // Closing a tab keeps its scene.
  await page.getByRole("button", { name: "Close Tab two" }).click();
  await expect(strip.getByRole("tab", { name: "Tab two" })).toHaveCount(0);
  const { scenes } = await (await page.request.get("/api/scenes")).json();
  expect(scenes.some((s: { title: string }) => s.title === "Tab two")).toBe(true);
});

test("photos can be pasted into the inbox, in the box or anywhere on the page", async ({ page }) => {
  await page.goto("/inbox");
  const composer = page.getByRole("form", { name: "New idea" });
  await expect(composer).toBeVisible({ timeout: 15_000 });

  // Paste with nothing focused, as straight after copying a photo in another app.
  await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 80;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#3b4a6b";
    ctx.fillRect(0, 0, 64, 80);
    const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), "image/png"));
    const dt = new DataTransfer();
    dt.items.add(new File([blob], "copied.png", { type: "image/png" }));
    (document.activeElement as HTMLElement | null)?.blur();
    document.body.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await expect(composer.getByRole("img", { name: "Attached photo" })).toBeVisible();
  await composer.getByLabel("Idea", { exact: true }).fill("Pasted light study");
  await composer.getByRole("button", { name: "Save to inbox" }).click();
  const card = page.getByRole("listitem").filter({ hasText: "Pasted light study" });
  await expect(card).toBeVisible();
  await expect(card.locator("img")).toBeVisible();

  const { ideas } = await (await page.request.get("/api/inbox")).json();
  const idea = ideas.find((i: { text: string }) => i.text === "Pasted light study");
  expect(idea?.assetId).toBeTruthy();
  expect(idea?.source).toBe("photo");
});

test("pastes an image on the start screen and makes variations of it", async ({ page }) => {
  await page.goto("/studio");
  await page.getByRole("button", { name: "New tab", exact: true }).click();
  await expect(page.getByRole("heading", { name: "What are you starting from?" })).toBeVisible({ timeout: 15_000 });

  await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 120;
    c.height = 80;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#4a3b2b";
    ctx.fillRect(0, 0, 120, 80);
    const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), "image/png"));
    const dt = new DataTransfer();
    dt.items.add(new File([blob], "copied.png", { type: "image/png" }));
    (document.activeElement as HTMLElement | null)?.blur();
    document.body.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  });

  const dialog = page.getByRole("dialog", { name: "Variations of an image" });
  await expect(dialog.getByRole("img", { name: "Image to vary" })).toBeVisible();
  await dialog.getByRole("button", { name: "More" }).click();
  await dialog.getByRole("button", { name: "More" }).click();
  await expect(dialog.getByText("Runs as 2 batches")).toBeVisible();
  await dialog.getByLabel("Direction").fill("at dusk");
  await dialog.getByRole("button", { name: "Make 6 variations" }).click();

  // Six variations of the pasted image, in a scene of their own, none of them using a look.
  await expect
    .poll(
      async () => {
        const { items } = await (await page.request.get("/api/generations?limit=200")).json();
        const source = items.find((g: { kind: string; title: string; tags: string[] }) => g.kind === "import" && g.tags.includes("imported") && g.title === "copied");
        if (!source) return -1;
        const kids = items.filter((g: { parentId: string; kind: string; status: string; styleProfileId: string | null }) => g.parentId === source.id && g.kind === "variation" && g.status === "completed" && g.styleProfileId === null);
        return kids.length;
      },
      { timeout: 30_000 },
    )
    .toBe(6);
  await expect(page.getByText("Variations of copied").first()).toBeVisible();
});

test("copies any image to the clipboard from its menu", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/archive?q=frozen");
  const tile = page.locator("main").getByRole("button", { name: /Open The Frozen Hour/ }).first();
  await expect(tile).toBeVisible({ timeout: 15_000 });
  await tile.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Copy image" }).click();
  await expect(page.getByText("Image copied")).toBeVisible({ timeout: 15_000 });
  const types = await page.evaluate(async () => (await navigator.clipboard.read()).flatMap((i) => i.types));
  expect(types).toContain("image/png");
});
