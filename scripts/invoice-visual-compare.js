/**
 * Invoice Visual Comparison Script
 *
 * This script uses Puppeteer to capture screenshots of both the legacy
 * DynamicInvoice renderer and the new React component-based renderer
 * for side-by-side visual comparison.
 *
 * Usage:
 *   node scripts/invoice-visual-compare.js <invoice-preview-url>
 *
 * Example:
 *   node scripts/invoice-visual-compare.js "http://localhost:3000/projects/abc123/invoice/001/preview?year=2024"
 *
 * Prerequisites:
 *   - Dev server running on localhost:3000
 *   - Logged in session (script will use existing cookies)
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '../tmp/invoice-comparison');

async function captureComparison(url) {
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: false, // Use false for debugging, true for CI
    defaultViewport: { width: 1200, height: 1600 },
  });

  const page = await browser.newPage();

  // Set a reasonable timeout
  page.setDefaultTimeout(30000);

  console.log(`Navigating to: ${url}`);
  await page.goto(url, { waitUntil: 'networkidle2' });

  // Wait for the page to be ready
  await page.waitForSelector('[data-ready="1"]', { timeout: 30000 });
  console.log('Invoice loaded (data-ready=1)');

  // Give fonts time to load
  await new Promise(r => setTimeout(r, 2000));

  // === Capture Legacy Renderer ===
  console.log('Capturing legacy renderer (DynamicInvoice)...');

  // Make sure we're on the legacy renderer (toggle off)
  const newRendererSwitch = await page.$('.ant-switch:has(+ *:has-text("New Renderer"))');
  if (newRendererSwitch) {
    const isChecked = await newRendererSwitch.evaluate(el => el.classList.contains('ant-switch-checked'));
    if (isChecked) {
      await newRendererSwitch.click();
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  await page.screenshot({
    path: path.join(OUTPUT_DIR, 'legacy-renderer.png'),
    fullPage: true,
  });
  console.log('Saved: tmp/invoice-comparison/legacy-renderer.png');

  // === Capture New Renderer ===
  console.log('Capturing new renderer (React components)...');

  // Toggle to new renderer
  const toggles = await page.$$('button.ant-switch');
  for (const toggle of toggles) {
    const text = await page.evaluate(el => el.parentElement?.textContent || '', toggle);
    if (text.includes('New Renderer')) {
      await toggle.click();
      break;
    }
  }

  await new Promise(r => setTimeout(r, 2000)); // Wait for render

  await page.screenshot({
    path: path.join(OUTPUT_DIR, 'new-renderer.png'),
    fullPage: true,
  });
  console.log('Saved: tmp/invoice-comparison/new-renderer.png');

  // === Capture New Renderer with Grid ===
  console.log('Capturing new renderer with grid overlay...');

  // Enable grid overlay
  for (const toggle of await page.$$('button.ant-switch')) {
    const text = await page.evaluate(el => el.parentElement?.textContent || '', toggle);
    if (text.includes('Grid')) {
      const isChecked = await toggle.evaluate(el => el.classList.contains('ant-switch-checked'));
      if (!isChecked) {
        await toggle.click();
        await new Promise(r => setTimeout(r, 500));
      }
      break;
    }
  }

  await page.screenshot({
    path: path.join(OUTPUT_DIR, 'new-renderer-grid.png'),
    fullPage: true,
  });
  console.log('Saved: tmp/invoice-comparison/new-renderer-grid.png');

  // === Capture New Renderer with Flex Debug ===
  console.log('Capturing new renderer with flex debug...');

  // Enable flex debug
  for (const toggle of await page.$$('button.ant-switch')) {
    const text = await page.evaluate(el => el.parentElement?.textContent || '', toggle);
    if (text.includes('Flex Debug')) {
      const isChecked = await toggle.evaluate(el => el.classList.contains('ant-switch-checked'));
      if (!isChecked) {
        await toggle.click();
        await new Promise(r => setTimeout(r, 500));
      }
      break;
    }
  }

  await page.screenshot({
    path: path.join(OUTPUT_DIR, 'new-renderer-flex-debug.png'),
    fullPage: true,
  });
  console.log('Saved: tmp/invoice-comparison/new-renderer-flex-debug.png');

  console.log('\n=== Comparison Complete ===');
  console.log(`Output directory: ${OUTPUT_DIR}`);
  console.log('\nFiles generated:');
  console.log('  - legacy-renderer.png (DynamicInvoice)');
  console.log('  - new-renderer.png (React components)');
  console.log('  - new-renderer-grid.png (with grid overlay)');
  console.log('  - new-renderer-flex-debug.png (with flex debug borders)');

  await browser.close();
}

// Main execution
const url = process.argv[2];

if (!url) {
  console.log(`
Invoice Visual Comparison Script

Usage:
  node scripts/invoice-visual-compare.js <invoice-preview-url>

Example:
  node scripts/invoice-visual-compare.js "http://localhost:3000/projects/abc123/invoice/001/preview?year=2024"

This script will capture screenshots of both renderers for comparison.
Make sure:
  1. Dev server is running (npm run dev)
  2. You are logged in via the browser
  `);
  process.exit(1);
}

captureComparison(url).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
