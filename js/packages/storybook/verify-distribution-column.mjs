import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

const PORT = process.env.RECCE_PORT ?? "8821";
const ROOT = `http://localhost:${PORT}`;
const OUT_DIR = path.resolve(
  process.cwd(),
  "../../../docs/feature-exploration/profile-render-modes-paired-histograms",
);
fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ["--headless=new"],
});
const context = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
});
const page = await context.newPage();
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
page.on("console", (msg) => {
  const t = msg.type();
  if (t === "error" || t === "warning") console.log(`CONSOLE ${t}:`, msg.text());
});

await page.goto(`${ROOT}/lineage`, { waitUntil: "domcontentloaded" });
await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});

await page
  .waitForSelector(".react-flow__node", { timeout: 15_000 })
  .catch(() => {});

const nodeNames = await page
  .locator(".react-flow__node")
  .evaluateAll((els) =>
    els.map((el) => el.textContent?.trim()?.slice(0, 80)).filter(Boolean),
  );
console.log("nodes (first 12):", nodeNames.slice(0, 12));

const targets = [
  "customer_lifetime_value",
  "customer_segments_final",
  "customers",
  "orders",
];
let chosen = null;
for (const name of targets) {
  for (const got of nodeNames) {
    if (got && got.includes(name)) {
      chosen = got;
      break;
    }
  }
  if (chosen) break;
}
console.log("chosen node:", chosen);

if (chosen) {
  await page
    .locator(`.react-flow__node:has-text("${chosen}")`)
    .first()
    .click({ timeout: 5_000 });
  await page.waitForTimeout(2_500);
}

const after1 = await page.evaluate(() => ({
  tabs: Array.from(document.querySelectorAll('[role="tab"]')).map((t) =>
    t.textContent?.trim(),
  ),
  buttons: Array.from(document.querySelectorAll("button"))
    .map((b) => b.textContent?.trim() ?? "")
    .filter((t) => /column|schema|profile/i.test(t))
    .slice(0, 20),
}));
console.log("after-click tabs:", after1.tabs);
console.log("after-click profile/columnish:", after1.buttons);

await page.screenshot({
  path: path.join(OUT_DIR, "drc3390-phase1-after-click.png"),
  fullPage: true,
});

for (const label of [/columns/i, /schema/i]) {
  const t = page
    .getByRole("tab", { name: label })
    .or(page.getByRole("button", { name: label }))
    .first();
  if (await t.count()) {
    await t.click({ timeout: 3_000 }).catch(() => {});
    console.log("clicked tab:", label);
    await page.waitForTimeout(1_500);
    break;
  }
}

// SchemaView starts in "grid" (gallery) mode by default; the distribution
// column lives in wide/strip. Switch to wide.
const wideBtn = page
  .getByRole("button", { name: /^wide$/i })
  .first();
if (await wideBtn.count()) {
  await wideBtn.click({ timeout: 3_000 }).catch(() => {});
  console.log("switched to wide mode");
  await page.waitForTimeout(1_500);
}

await page.waitForTimeout(2_000);
await page.screenshot({
  path: path.join(OUT_DIR, "drc3390-phase1-schema-final.png"),
  fullPage: true,
});

const summary = await page.evaluate(() => ({
  headers: Array.from(document.querySelectorAll(".ag-header-cell-text"))
    .map((e) => e.textContent?.trim())
    .filter(Boolean),
  schemaRows: document.querySelectorAll(".ag-row").length,
  distributionCells: document.querySelectorAll(
    ".schema-column-profile-distribution",
  ).length,
  distributionSvgs: document.querySelectorAll(
    ".schema-column-profile-distribution svg",
  ).length,
}));
console.log("summary:", JSON.stringify(summary, null, 2));

await browser.close();
