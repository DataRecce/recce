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

const browser = await chromium.launch({ headless: true, args: ["--headless=new"] });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await context.newPage();
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
page.on("console", (msg) => {
  if (msg.type() === "error" || msg.type() === "warning") {
    console.log(`CONSOLE ${msg.type()}:`, msg.text().slice(0, 200));
  }
});
page.on("response", async (resp) => {
  const url = resp.url();
  if (!url.includes("/api/runs")) return;
  try {
    const body = await resp.json();
    if (body?.type !== "profile_distribution") return;
    if (body?.status !== "Finished") return;
    const cols = body?.result?.columns ?? {};
    const sample = Object.entries(cols)
      .slice(0, 2)
      .map(([k, v]) => `${k}=${v ? v.kind : "null"}`);
    console.log(
      `DIST DONE keys=[${Object.keys(cols).slice(0, 5).join(",")}] sample=${sample.join(", ")}`,
    );
  } catch {}
});

// Capture network errors and react-query state by tapping window.
await page.addInitScript(() => {
  const orig = window.fetch;
  window.fetch = async (...args) => {
    const r = await orig.apply(window, args);
    return r;
  };
});

await page.goto(`${ROOT}/lineage`, { waitUntil: "domcontentloaded" });
await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
await page.waitForSelector(".react-flow__node", { timeout: 15_000 }).catch(() => {});

async function dispatchClickOnNode(label) {
  await page.evaluate((l) => {
    const node = Array.from(document.querySelectorAll(".react-flow__node")).find(
      (el) => el.textContent?.trim().includes(l),
    );
    if (!node) throw new Error("no node " + l);
    node.scrollIntoView({ block: "center", inline: "center" });
    for (const t of ["pointerdown", "pointerup", "click"]) {
      node.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true }));
    }
  }, label);
}

async function clickByText(label, role = "button, [role=tab]") {
  return await page.evaluate(
    ({ l, r }) => {
      const all = Array.from(document.querySelectorAll(r));
      const node = all.find((el) => new RegExp(l, "i").test(el.textContent ?? ""));
      if (!node) return false;
      for (const t of ["pointerdown", "pointerup", "click"]) {
        node.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true }));
      }
      node.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      return true;
    },
    { l: label, r: role },
  );
}

// Open store_performance — its base + current are identical, so the
// previous overlap-with-alpha rendering looked all-blue. New stacked
// rendering should be all-shmellow.
await dispatchClickOnNode("store_performance");
await page.waitForTimeout(2_500);
await clickByText("^columns$");
await page.waitForTimeout(1_500);
await clickByText("^wide$");
await page.waitForTimeout(500);

// Expand to all columns — fires the distribution fetch for everything.
await clickByText("profile all columns");
await clickByText("profile remaining columns");
await page.waitForTimeout(500);

// Grab the pending state right after firing (before backend returns).
await page.screenshot({
  path: path.join(OUT_DIR, "drc3390-phase2-pending.png"),
  fullPage: true,
});
const pending = await page.evaluate(() => ({
  headers: Array.from(document.querySelectorAll(".ag-header-cell-text"))
    .map((e) => e.textContent?.trim())
    .filter(Boolean),
  rows: document.querySelectorAll(".ag-row").length,
  pendingDots: document.querySelectorAll('[data-testid="distribution-pending"]')
    .length,
  distributionSvgs: document.querySelectorAll(".schema-column-profile-distribution svg")
    .length,
}));
console.log("pending snapshot:", JSON.stringify(pending, null, 2));

// Wait for the backend run to finish. store_performance has ~12 cols, each
// runs a cardinality + topk/histogram dispatch, so the run takes longer.
await page.waitForTimeout(30_000);
await page.screenshot({
  path: path.join(OUT_DIR, "drc3390-phase2-real.png"),
  fullPage: true,
});
// Scroll the grid horizontally to bring the Distribution column into view.
await page.evaluate(() => {
  const viewport = document.querySelector(".ag-body-horizontal-scroll-viewport");
  if (viewport) viewport.scrollLeft = 9999;
});
await page.waitForTimeout(800);
// Re-capture with the distribution column in view.
await page.screenshot({
  path: path.join(OUT_DIR, "drc3390-phase2-real.png"),
  fullPage: true,
});

const finished = await page.evaluate(() => ({
  pendingDots: document.querySelectorAll('[data-testid="distribution-pending"]').length,
  distributionSvgs: document.querySelectorAll(".schema-column-profile-distribution svg").length,
  distributionCellCount: document.querySelectorAll(".schema-column-profile-distribution").length,
  headers: Array.from(document.querySelectorAll(".ag-header-cell-text"))
    .map((e) => e.textContent?.trim()).filter(Boolean),
  rowNames: Array.from(document.querySelectorAll(".ag-row"))
    .map((r) => r.querySelector(".schema-column")?.textContent?.trim())
    .slice(0, 6),
  // Debug peeks from the hook
  distData: window.__DIST_DATA__,
  distMap: window.__DIST_MAP__,
}));
console.log("distMap:", JSON.stringify(finished.distMap));
console.log("distData keys:", finished.distData ? Object.keys(finished.distData.columns ?? {}) : "no data");
const profile = await page.evaluate(() => ({
  data: window.__PROFILE_DATA__,
  map: window.__PROFILE_MAP__,
  flags: { newCll: window.__RECCE_NEW_CLL ?? "?" },
}));
console.log("profileData has data:", !!profile.data, "map:", profile.map);
console.log("counts:", JSON.stringify({ pendingDots: finished.pendingDots, distributionSvgs: finished.distributionSvgs, distributionCellCount: finished.distributionCellCount, headers: finished.headers }));

await browser.close();
