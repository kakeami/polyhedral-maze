/**
 * Capture screenshots of the polyhedral maze demo using Playwright.
 * Generates figures for the paper and report.
 */
import { chromium } from 'playwright';
import * as fs from 'node:fs';
import * as path from 'node:path';

const BASE_URL = 'http://localhost:5173/polyhedral-maze/';
const PAPER_DIR = path.resolve(import.meta.dirname, '..', 'paper', 'figures');
const REPORT_DIR = path.resolve(import.meta.dirname, '..', 'public', 'report', 'figures');

fs.mkdirSync(PAPER_DIR, { recursive: true });
fs.mkdirSync(REPORT_DIR, { recursive: true });

interface ScreenshotConfig {
  name: string;
  params: Record<string, string>;
  waitMs?: number;
}

async function waitForRender(page: any, extraMs = 3000) {
  // Three.js appends canvas inside #viewport
  await page.waitForSelector('#viewport canvas', { timeout: 30000 });
  await page.waitForTimeout(extraMs);
}

async function captureScreenshot(page: any, config: ScreenshotConfig) {
  const url = new URL(BASE_URL);
  for (const [k, v] of Object.entries(config.params)) {
    url.searchParams.set(k, v);
  }

  console.log(`  Capturing: ${config.name}`);
  await page.goto(url.toString(), { waitUntil: 'networkidle' });
  await waitForRender(page, config.waitMs ?? 3000);

  // Hide the control panel for clean screenshots
  await page.evaluate(() => {
    const panel = document.querySelector('#controls') as HTMLElement;
    if (panel) panel.style.display = 'none';
    const links = document.querySelectorAll('.github-link, [href*="github"]');
    links.forEach((el: any) => el.style.display = 'none');
  });

  await page.waitForTimeout(500);

  // Take screenshot of the viewport area
  const viewport = await page.$('#viewport');
  if (viewport) {
    const paperPath = path.join(PAPER_DIR, `${config.name}.png`);
    const reportPath = path.join(REPORT_DIR, `${config.name}.png`);
    await viewport.screenshot({ path: paperPath });
    fs.copyFileSync(paperPath, reportPath);
    console.log(`    OK: ${config.name}.png`);
  } else {
    // Fallback to full page
    const paperPath = path.join(PAPER_DIR, `${config.name}.png`);
    const reportPath = path.join(REPORT_DIR, `${config.name}.png`);
    await page.screenshot({ path: paperPath, fullPage: false });
    fs.copyFileSync(paperPath, reportPath);
    console.log(`    OK (fullpage fallback): ${config.name}.png`);
  }
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
    ],
  });
  const context = await browser.newContext({
    viewport: { width: 1200, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  // Suppress console errors from WebGL
  page.on('console', () => {});

  console.log('=== Capturing Maze Screenshots ===\n');

  // --- All five Platonic solids ---
  console.log('--- All 5 Platonic Solids (n=6, k=3, DFS, seed=42, with solution) ---');
  for (const shape of ['tetrahedron', 'cube', 'octahedron', 'dodecahedron', 'icosahedron']) {
    await captureScreenshot(page, {
      name: `maze-${shape}`,
      params: { shape, n: '6', k: '3', algo: 'dfs', seed: '42', solution: '1' },
    });
  }

  // --- Effect of k parameter ---
  console.log('\n--- Effect of k (Icosahedron) ---');
  for (const k of [1, 2, 3, 4]) {
    await captureScreenshot(page, {
      name: `k-effect-${k}`,
      params: { shape: 'icosahedron', n: '6', k: String(k), algo: 'dfs', seed: '42', solution: '1' },
    });
  }

  // --- Algorithm comparison ---
  console.log('\n--- Algorithm comparison (Cube) ---');
  for (const algo of ['kruskal', 'dfs', 'wilson']) {
    await captureScreenshot(page, {
      name: `algo-${algo}`,
      params: { shape: 'cube', n: '6', k: '3', algo, seed: '42', solution: '1' },
    });
  }

  // --- Warp tunnel ---
  console.log('\n--- Warp tunnel (Icosahedron) ---');
  await captureScreenshot(page, {
    name: 'warp-off',
    params: { shape: 'icosahedron', n: '6', k: '3', algo: 'dfs', seed: '42', solution: '1' },
  });
  await captureScreenshot(page, {
    name: 'warp-on',
    params: { shape: 'icosahedron', n: '6', k: '3', algo: 'dfs', seed: '42', warp: '1', solution: '1' },
  });

  // --- Hero image ---
  console.log('\n--- Hero image ---');
  await captureScreenshot(page, {
    name: 'hero-icosahedron',
    params: { shape: 'icosahedron', n: '9', k: '3', algo: 'dfs', seed: '42' },
    waitMs: 3500,
  });

  await browser.close();
  console.log('\n=== Done! ===');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
