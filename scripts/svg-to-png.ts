/**
 * Convert SVG to PNG using Playwright for LaTeX inclusion.
 */
import { chromium } from 'playwright';
import * as fs from 'node:fs';
import * as path from 'node:path';

const FIGURES_DIR = path.resolve(import.meta.dirname, '..', 'public', 'report', 'figures');
const PAPER_DIR = path.resolve(import.meta.dirname, '..', 'paper', 'figures');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const svgPath = path.join(FIGURES_DIR, 'three-layer-model.svg');
  const svgContent = fs.readFileSync(svgPath, 'utf-8');

  const html = `<!DOCTYPE html><html><head><style>body{margin:0;background:white;display:flex;align-items:center;justify-content:center;}</style></head><body>${svgContent}</body></html>`;

  await page.setViewportSize({ width: 1800, height: 620 });
  await page.setContent(html);
  await page.waitForTimeout(500);

  const svg = await page.$('svg');
  if (svg) {
    const pngPath = path.join(PAPER_DIR, 'three-layer-model.png');
    await svg.screenshot({ path: pngPath });
    console.log(`Saved: ${pngPath}`);
  }

  await browser.close();
}

main().catch(console.error);
