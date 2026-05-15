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

await page.goto(`${ROOT}/lineage`, { waitUntil: "domcontentloaded" });
await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
await page
  .waitForSelector(".react-flow__node", { timeout: 15_000 })
  .catch(() => {});

async function clickNode(label) {
  await page.evaluate((l) => {
    const node = Array.from(
      document.querySelectorAll(".react-flow__node"),
    ).find((el) => el.textContent?.trim().includes(l));
    if (!node) throw new Error("no node " + l);
    node.scrollIntoView({ block: "center", inline: "center" });
    for (const type of ["pointerdown", "pointerup", "click"]) {
      node.dispatchEvent(
        new PointerEvent(type, { bubbles: true, cancelable: true }),
      );
    }
  }, label);
  await page.waitForTimeout(2_500);
}

async function clickByText(label, role = null) {
  return await page.evaluate(
    ({ l, r }) => {
      const all = Array.from(
        document.querySelectorAll(r ?? "button, [role=tab]"),
      );
      const node = all.find((el) =>
        new RegExp(l, "i").test(el.textContent ?? ""),
      );
      if (!node) return false;
      node.dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true, cancelable: true }),
      );
      node.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
      return true;
    },
    { l: label, r: role },
  );
}

// Open stg_customers (has 1 added column → 1 card already) and fire CLL on
// CUSTOMER_ID — that marks it impacted, so it becomes a 2nd card *and*
// CUSTOMER_ID is a NUMBER, so its column-name heuristic gives a chart.
await clickNode("stg_customers");
await clickByText("^columns$", "[role=tab],button");
await page.waitForTimeout(1_000);
const fired = await page.evaluate(() => {
  const chip = Array.from(document.querySelectorAll(".schema-gallery-chip"))
    .find((c) => /customer_id/i.test(c.textContent ?? ""));
  if (!chip) return false;
  for (const t of ["pointerdown", "pointerup", "click"]) {
    chip.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true }));
  }
  return true;
});
console.log("fired CLL on CUSTOMER_ID:", fired);
await page.waitForTimeout(6_000);

// Debug: see what API state looks like.
const debug = await page.evaluate(() => {
  return {
    rowClasses: Array.from(document.querySelectorAll(".schema-gallery-chip"))
      .slice(0, 10)
      .map((c) => ({
        text: c.querySelector("span")?.textContent,
        cls: c.className,
      })),
    headerTabs: Array.from(document.querySelectorAll('[role="tab"]')).map(
      (t) => t.textContent,
    ),
    cardNames: Array.from(document.querySelectorAll(".schema-card-name")).map(
      (c) => c.textContent,
    ),
    cardChartSvgs: document.querySelectorAll(".schema-card-chart svg").length,
  };
});
console.log("debug:", JSON.stringify(debug, null, 2));

await page.screenshot({
  path: path.join(OUT_DIR, "drc3390-phase1-grid-chartslot.png"),
  fullPage: true,
});

const summary = await page.evaluate(() => ({
  cards: document.querySelectorAll(".schema-card").length,
  cardsWithChart: document.querySelectorAll(".schema-card-chart").length,
  cardChartSvgs: document.querySelectorAll(".schema-card-chart svg").length,
  uniqueLabels: Array.from(
    document.querySelectorAll(".schema-card-quad-lbl"),
  ).filter((e) => e.textContent?.toLowerCase() === "unique").length,
  quadCountFirstCard: (() => {
    const card = document.querySelector(".schema-card");
    return card?.querySelectorAll(".schema-card-quad").length ?? 0;
  })(),
  cardNames: Array.from(document.querySelectorAll(".schema-card-name"))
    .slice(0, 6)
    .map((c) => c.textContent),
}));
console.log("summary:", JSON.stringify(summary, null, 2));

await browser.close();
