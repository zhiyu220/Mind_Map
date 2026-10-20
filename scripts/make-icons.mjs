// Renders public/icons/favicon.svg into the PNG sizes iOS and the web manifest want.
// Uses the Chromium that Playwright provides: `npm run icons`.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const svg = readFileSync(new URL('../public/icons/favicon.svg', import.meta.url), 'utf8');
const sizes = { 'apple-touch-icon.png': 180, 'icon-192.png': 192, 'icon-512.png': 512, 'icon-maskable-512.png': 512 };

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const page = await browser.newPage();
for (const [name, size] of Object.entries(sizes)) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
  await page.screenshot({ path: new URL(`../public/icons/${name}`, import.meta.url).pathname });
}
await browser.close();
