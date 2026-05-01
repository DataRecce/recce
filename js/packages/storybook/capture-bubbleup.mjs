import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });

const SHOTS = [
  [
    "bubbleup-low-card-string-small.png",
    "visualizations-bubbleup-low-card-string--small-with-x-axis",
  ],
  [
    "bubbleup-low-card-string-trimmed.png",
    "visualizations-bubbleup-low-card-string--large-trimmed-no-axis",
  ],
  [
    "bubbleup-low-card-string-side-by-side.png",
    "visualizations-bubbleup-low-card-string--side-by-side",
  ],
  [
    "bubbleup-low-card-numeric.png",
    "visualizations-bubbleup-low-card-numeric--http-status-equal-width",
  ],
  [
    "bubbleup-low-card-numeric-side-by-side.png",
    "visualizations-bubbleup-low-card-numeric--side-by-side",
  ],
  [
    "bubbleup-high-card-quant.png",
    "visualizations-bubbleup-high-card-quantitative--overlapped-default",
  ],
  [
    "bubbleup-high-card-quant-side-by-side.png",
    "visualizations-bubbleup-high-card-quantitative--overlapped-vs-side-by-side",
  ],
];

const browser = await chromium.launch({
  headless: true,
  args: ["--headless=new"],
});
const page = await browser.newPage({
  viewport: { width: 800, height: 240 },
  deviceScaleFactor: 2,
});

for (const [filename, storyId] of SHOTS) {
  const url = `http://localhost:6010/iframe.html?viewMode=story&id=${storyId}`;
  console.log(`-> ${storyId}`);
  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForSelector("svg", { timeout: 10000 }).catch(() => {
    // tolerate stories that don't render an svg (e.g. autodocs pages)
  });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/${filename}`, fullPage: false });
  console.log(`   wrote ${filename}`);
}

await browser.close();
console.log("done");
