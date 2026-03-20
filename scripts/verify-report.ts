import { chromium } from 'playwright';
import * as path from 'node:path';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });

  await page.goto('http://localhost:5173/polyhedral-maze/report/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  const dir = path.resolve(import.meta.dirname, '..', 'paper', 'figures');

  // Section 3 with three-layer model figure
  await page.evaluate(() => {
    const h2 = Array.from(document.querySelectorAll('h2')).find(h => h.textContent?.includes('3. Three-Layer'));
    h2?.scrollIntoView();
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(dir, 'report-sec3.png') });

  // Section 6 with experimental results
  await page.evaluate(() => {
    const h3 = Array.from(document.querySelectorAll('h3')).find(h => h.textContent?.includes('6.1'));
    h3?.scrollIntoView();
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(dir, 'report-sec6.png') });

  // Figures - all solids
  await page.evaluate(() => {
    const fig = Array.from(document.querySelectorAll('figcaption')).find(f => f.textContent?.includes('Figure 2'));
    fig?.scrollIntoView();
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(dir, 'report-fig2.png') });

  console.log('Report section screenshots saved');
  await browser.close();
}

main().catch(console.error);
