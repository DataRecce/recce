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

await dispatchClickOnNode("stg_customers");
await page.waitForTimeout(2_500);
await clickByText("^columns$");
await page.waitForTimeout(1_500);
// Expand profile to all columns so the hook fires for everything.
await clickByText("profile all columns");
await clickByText("profile remaining columns");
await page.waitForTimeout(800);
await clickByText("^wide$");
await page.waitForTimeout(8_000);

await page.screenshot({
  path: path.join(OUT_DIR, "drc3390-phase2-wide-realdata.png"),
  fullPage: true,
});

const summary = await page.evaluate(() => ({
  headers: Array.from(document.querySelectorAll(".ag-header-cell-text"))
    .map((e) => e.textContent?.trim())
    .filter(Boolean),
  rows: document.querySelectorAll(".ag-row").length,
  distributionCells: document.querySelectorAll(".schema-column-profile-distribution").length,
  distributionSvgs: document.querySelectorAll(".schema-column-profile-distribution svg").length,
}));
console.log("summary:", JSON.stringify(summary, null, 2));

await browser.close();
