import { chromium } from 'playwright';

const STORY = process.argv[2] || 'visualizations-paired-histograms-high-card-quantitative--cell-order-amount';
const URL = `http://localhost:6007/iframe.html?viewMode=story&id=${STORY}`;

const browser = await chromium.launch({ headless: true, args: ['--headless=new'] });
const ctx = await browser.newContext();
const page = await ctx.newPage();

const consoleMsgs = [];
const pageErrors = [];
const networkFails = [];
page.on('console', m => consoleMsgs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', e => pageErrors.push(`PAGEERROR: ${e.message}\n${e.stack || ''}`));
page.on('requestfailed', r => networkFails.push(`FAIL ${r.url()} -> ${r.failure()?.errorText}`));
page.on('response', r => {
  if (r.status() >= 400) networkFails.push(`HTTP ${r.status()} ${r.url()}`);
});

await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);

const rootHtml = await page.evaluate(() => {
  const r = document.getElementById('storybook-root') || document.body;
  return r ? r.innerHTML.length : -1;
});
const rootText = await page.evaluate(() => {
  const r = document.getElementById('storybook-root') || document.body;
  return r ? (r.innerText || '').slice(0, 600) : '';
});
const errorDisplayShown = await page.evaluate(() => {
  const els = document.querySelectorAll('[class*="errordisplay"]');
  const lines = [];
  for (const el of els) {
    const style = getComputedStyle(el);
    if (style.display !== 'none' && (el.innerText || '').trim()) {
      lines.push(el.innerText.slice(0, 600));
    }
  }
  return lines.join('\n---\n') || null;
});
const noPreviewVisible = await page.evaluate(() => {
  const np = document.querySelector('.sb-nopreview');
  return np && getComputedStyle(np).display !== 'none';
});

console.log('URL:', URL);
console.log('root html length:', rootHtml);
console.log('root visible text (first 600):', JSON.stringify(rootText));
console.log('no-preview shown:', noPreviewVisible);
console.log('error display:', errorDisplayShown);
console.log('--- console (last 30) ---');
console.log(consoleMsgs.slice(-30).join('\n'));
console.log('--- page errors ---');
console.log(pageErrors.join('\n'));
console.log('--- network fails / 4xx-5xx ---');
console.log(networkFails.join('\n'));

await page.screenshot({ path: '/tmp/sb-story.png', fullPage: true });
console.log('screenshot: /tmp/sb-story.png');

await browser.close();
