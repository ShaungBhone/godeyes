import { test, expect } from "@playwright/test";
test("inspect, annotate, drag, lock, export, and preserve the analyzed graph", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByTestId("card-validate")).toBeVisible();
  const report = await (await page.request.get("/api/report")).json();
  await page.getByTestId("card-validate").click();
  await expect(page.getByText("STEP DETAILS", { exact: true })).toBeVisible();
  await expect(page.getByText("Source evidence", { exact: true })).toBeVisible();
  await page.getByLabel("Step note", { exact: true }).fill("Check validation rules with the team");
  await page.reload(); await page.getByTestId("card-validate").click();
  await expect(page.getByLabel("Step note", { exact: true })).toHaveValue("Check validation rules with the team");
  await page.getByLabel("Close inspector", { exact: true }).click();
  await page.getByLabel("Fit view", { exact: true }).click(); await page.waitForTimeout(400);
  const card = page.getByTestId("card-validate");
  const bounds = (await card.boundingBox())!;
  await page.mouse.move(bounds.x+bounds.width/2,bounds.y+12); await page.mouse.down(); await page.mouse.move(bounds.x+bounds.width/2+70,bounds.y+52,{steps:12}); await page.mouse.up();
  const moved = (await card.boundingBox())!;
  expect(Math.abs(moved.x-bounds.x)).toBeGreaterThan(30);
  const positions = await page.evaluate(() => JSON.parse(Object.entries(localStorage).find(([k]) => k.startsWith("repo-flow-canvas:v1:"))![1]).positions);
  expect(positions.validate).toBeTruthy();
  await page.getByLabel("Lock node movement", { exact: true }).click();
  const locked = (await card.boundingBox())!;
  await page.mouse.move(locked.x+locked.width/2,locked.y+12); await page.mouse.down(); await page.mouse.move(locked.x+locked.width/2+60,locked.y+52,{steps:10}); await page.mouse.up();
  expect(await page.evaluate(() => JSON.parse(Object.entries(localStorage).find(([k]) => k.startsWith("repo-flow-canvas:v1:"))![1]).positions)).toEqual(positions);
  await card.click(); await expect(page.getByText("STEP DETAILS", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Findings", exact: false }).click();
  await expect(page.getByText("Success does not establish a login session", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Locate on canvas" }).first().click();
  await expect(page.getByRole("heading", { name: "Open dashboard screen" })).toBeVisible();
  const download = page.waitForEvent("download"); await page.getByRole("button", { name: "Export report" }).click();
  expect((await download).suggestedFilename()).toContain("flow-review.json");
  expect(await (await page.request.get("/api/report")).json()).toEqual(report);
  await page.getByLabel("Toggle theme", { exact: true }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  expect(errors).toEqual([]);
});
test("show overview, connection evidence, and malformed-report errors", async ({ page }) => {
  await page.goto("/"); await expect(page.getByTestId("card-submit")).toBeVisible();
  await page.getByRole("button", { name: "App overview" }).click();
  await expect(page.getByRole("heading", { name: "Analysis boundaries" })).toBeVisible();
  await page.getByRole("tab", { name: "Flow canvas" }).click();
  await page.locator('.react-flow__edge').first().click({ force: true });
  await expect(page.getByLabel("Close connection evidence")).toBeVisible();
  await page.route("**/api/report", (route) => route.fulfill({status:422,contentType:"application/json",body:JSON.stringify({error:"Invalid fixture report"})}));
  await page.reload(); await expect(page.locator('[data-slot="alert"]')).toContainText("Invalid fixture report");
});

test("compact sidebar gives the canvas room and supports desktop and mobile navigation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("card-submit")).toBeVisible();
  const sidebar = page.locator('[data-slot="sidebar"][data-state]');
  await expect(sidebar).toHaveAttribute("data-state", "collapsed");
  await expect(page.getByRole("button", { name: "Login flow", exact: true })).toHaveAttribute("aria-current", "page");
  await page.getByRole("button", { name: "Code review", exact: true }).hover();
  await expect(page.locator('[data-slot="tooltip-content"]').filter({ hasText: "Code review" })).toBeVisible();
  await page.getByRole("button", { name: "Code review", exact: true }).click();
  await expect(page.getByRole("tab", { name: /Findings/ })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Login flow", exact: true }).click();
  const compactCanvas = (await page.getByTestId("canvas").boundingBox())!;
  await page.getByRole("button", { name: "Toggle sidebar", exact: true }).click();
  await expect(sidebar).toHaveAttribute("data-state", "expanded");
  await page.getByLabel("Search flows", { exact: true }).fill("nothing matches");
  await expect(page.getByText("No matching flows.")).toBeVisible();
  await page.getByLabel("Search flows", { exact: true }).fill("");
  await page.waitForTimeout(250);
  const expandedCanvas = (await page.getByTestId("canvas").boundingBox())!;
  expect(compactCanvas.width - expandedCanvas.width).toBeGreaterThan(140);
  expect((await page.locator('[data-slot="sidebar-container"]').boundingBox())!.width).toBeLessThanOrEqual(208);
  await page.keyboard.press("ControlOrMeta+b");
  await expect(sidebar).toHaveAttribute("data-state", "collapsed");
  await page.getByRole("button", { name: "App overview", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Analysis boundaries" })).toBeVisible();
  await expect(page.getByRole("button", { name: "App overview", exact: true })).toHaveAttribute("aria-current", "page");
  await page.setViewportSize({ width: 600, height: 900 });
  await page.getByRole("button", { name: "Toggle sidebar", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Sidebar", exact: true })).toBeVisible();
  expect((await page.getByRole("dialog", { name: "Sidebar", exact: true }).boundingBox())!.width).toBeLessThanOrEqual(288);
  await page.getByRole("button", { name: "Login flow", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Sidebar", exact: true })).not.toBeVisible();
  await expect(page.getByTestId("card-submit")).toBeVisible();
});

test("shadcn tabs and source disclosures support keyboard navigation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("card-submit")).toBeVisible();
  expect((await page.locator(".tab-strip").boundingBox())!.height).toBe(36);
  const canvas = page.getByRole("tab", { name: "Flow canvas", exact: true });
  await canvas.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: /Findings/ })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("tab", { name: /Findings/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel", { name: /Findings/ })).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Overview", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("tab", { name: "Overview", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Home");
  await page.keyboard.press("Enter");
  await expect(canvas).toHaveAttribute("aria-selected", "true");
  await page.getByTestId("card-validate").click();
  const source = page.locator(".inspector .source-trigger").first();
  await expect(source).toHaveAttribute("aria-expanded", "true");
  await source.focus();
  await page.keyboard.press("Enter");
  await expect(source).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(".inspector pre")).not.toBeVisible();
  await page.keyboard.press("Enter");
  await expect(source).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".inspector pre")).toBeVisible();
  await page.getByLabel("Close inspector", { exact: true }).click();
  await page.getByTestId("card-validate").focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "View source for Check required fields", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Add note to Check required fields", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Step note", { exact: true })).toBeFocused();
});

test("source code blocks wrap, keep source line numbers, and copy exact evidence", async ({ page }) => {
  const report = await (await page.request.get("/api/report")).json();
  const evidence = report.flows[0].nodes.find((node: { id: string }) => node.id === "validate").evidence[0];
  evidence.startLine = 47;
  evidence.endLine = 49;
  evidence.excerpt = `const url = "${"a".repeat(180)}";\n\nreturn url;\n`;
  await page.route("**/api/report", (route) => route.fulfill({ json: report }));
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { value: { writeText: async (value: string) => {
      if (sessionStorage.getItem("test-clipboard-fails")) throw new Error("Clipboard denied");
      sessionStorage.setItem("test-copied-text", value);
    } } });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByTestId("card-validate").click();
  const block = page.locator('.inspector [data-slot="code-block"]');
  const content = block.locator('[data-slot="code-block-content"]');
  const wrap = block.getByRole("button", { name: "Wrap lines", exact: true });
  await expect(wrap).toHaveAttribute("aria-pressed", "false");
  expect(await content.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  await wrap.click();
  await expect(wrap).toHaveAttribute("aria-pressed", "true");
  await expect(content).toHaveAttribute("data-wrap", "true");
  await expect(content).toHaveAttribute("data-numbered", "true");
  expect(await content.evaluate((element) => element.style.counterReset)).toBe("line 46");
  await expect(block.locator('[data-slot="code-block-line"]')).toHaveCount(3);
  await expect(block.locator('[data-slot="code-block-line-content"]').nth(1)).toHaveText("\n");
  expect(await content.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await content.focus();
  await expect(content).toBeFocused();
  const ref = `${evidence.file}:47`;
  const copyCode = page.getByRole("button", { name: `Copy code from ${ref}`, exact: true });
  await copyCode.click();
  await expect(copyCode).toHaveAttribute("data-copied", "true");
  expect(await page.evaluate(() => sessionStorage.getItem("test-copied-text"))).toBe(evidence.excerpt);
  await page.getByRole("button", { name: `Copy ${ref}`, exact: true }).click();
  expect(await page.evaluate(() => sessionStorage.getItem("test-copied-text"))).toBe(ref);
  await page.evaluate(() => sessionStorage.setItem("test-clipboard-fails", "true"));
  await copyCode.click();
  await expect(page.getByRole("status").filter({ hasText: "Could not copy code." })).toBeVisible();
});

test("source headers keep their controls inside the block when collapsed", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("card-check").click();
  const block = page.locator('.inspector [data-slot="code-block"]').first();
  const header = block.locator('[data-slot="code-block-header"]');
  const height = (await header.boundingBox())!.height;
  const trigger = block.locator(".source-trigger");
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(block.locator("pre")).not.toBeVisible();
  expect((await header.boundingBox())!.height).toBe(height);
  expect(await header.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return [...element.querySelectorAll("button")].every((button) => {
      const rect = button.getBoundingClientRect();
      return rect.top >= bounds.top && rect.bottom <= bounds.bottom && rect.left >= bounds.left && rect.right <= bounds.right;
    });
  })).toBe(true);
  await trigger.click();
  await expect(block.locator("pre")).toBeVisible();
  await expect(block.getByRole("button", { name: "Wrap lines", exact: true })).toHaveAttribute("aria-pressed", "false");
});

test("confidence tooltips explain source support on hover and keyboard focus", async ({ page }) => {
  const report = await (await page.request.get("/api/report")).json();
  const node = report.flows[0].nodes.find((step: { id: string }) => step.id === "validate");
  await page.route("**/api/report", (route) => route.fulfill({ json: report }));
  const explanations = {
    confirmed: "Supported directly by the captured source code.",
    inferred: "Deduced from the available source code, but not directly established.",
    unresolved: "There is not enough source code to verify this step or connection.",
  };
  for (const [confidence, explanation] of Object.entries(explanations)) {
    node.confidence = confidence;
    await page.goto("/");
    await page.getByTestId("card-validate").click();
    const badge = page.locator(".inspector .confidence");
    const tooltip = page.locator('[data-slot="tooltip-content"]').filter({ hasText: explanation });
    await badge.hover();
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText("static analysis, not a runtime test");
    await page.keyboard.press("Escape");
    await expect(tooltip).not.toBeVisible();
    await page.mouse.move(0, 0);
    await page.getByLabel("Close inspector", { exact: true }).focus();
    await page.keyboard.press("Tab");
    await expect(badge).toBeFocused();
    await expect(tooltip).toBeVisible();
    await page.keyboard.press("Escape");
  }
  await page.getByLabel("Close inspector", { exact: true }).click();
  await page.locator(".react-flow__edge").first().click({ force: true });
  await page.locator(".edge-inspector .confidence").hover();
  await expect(page.locator('[data-slot="tooltip-content"]').filter({ hasText: explanations.confirmed })).toBeVisible();
});
