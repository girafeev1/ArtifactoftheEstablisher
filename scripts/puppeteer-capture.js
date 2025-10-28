#!/usr/bin/env node
/*
  Usage examples:
  - TARGET_URL=https://pms.theestablishers.com/dashboard/new-ui/projects \ 
    OUTPUT_DIR=tmp/puppeteer \ 
    COOKIES_PATH=./cookies.json \ 
    node scripts/puppeteer-capture.js

  Produces:
  - OUTPUT_DIR/screenshot.png
  - OUTPUT_DIR/page.html
  - OUTPUT_DIR/console.json
  - OUTPUT_DIR/network.json
*/
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const TARGET_URL = process.env.TARGET_URL || 'http://localhost:3000';
const OUTPUT_DIR = process.env.OUTPUT_DIR || path.join('tmp','puppeteer');
const COOKIES_PATH = process.env.COOKIES_PATH || '';
const HEADLESS = String(process.env.HEADLESS || 'true') !== 'false';
const WAIT_MS = parseInt(process.env.WAIT_MS || '8000', 10);

async function readCookies(domain) {
  if (!COOKIES_PATH) return [];
  try {
    const raw = fs.readFileSync(COOKIES_PATH, 'utf8');
    const json = JSON.parse(raw);
    if (Array.isArray(json)) {
      return json.map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain || domain,
        path: c.path || '/',
        httpOnly: !!c.httpOnly,
        secure: !!c.secure,
        sameSite: c.sameSite || 'Lax',
      }));
    }
    return [];
  } catch (e) {
    console.error('[capture] Failed to parse cookies:', e.message);
    return [];
  }
}

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const browser = await puppeteer.launch({ headless: HEADLESS, args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();

  const consoleLogs = [];
  page.on('console', (msg) => {
    consoleLogs.push({ type: msg.type(), text: msg.text(), ts: new Date().toISOString() });
  });

  const networkLogs = [];
  page.on('requestfinished', async (req) => {
    try {
      const res = await req.response();
      const url = req.url();
      const status = res.status();
      const headers = res.headers();
      const ct = headers['content-type'] || '';
      let body = null;
      if (/json|text|javascript/.test(ct)) {
        try { body = await res.text(); } catch {}
      }
      networkLogs.push({ url, status, headers, body, ts: new Date().toISOString() });
    } catch {}
  });

  // Set cookies if provided
  try {
    const domain = new URL(TARGET_URL).hostname;
    const cookies = await readCookies(domain);
    if (cookies.length) {
      await page.setCookie(...cookies);
      console.log(`[capture] Loaded ${cookies.length} cookies for ${domain}`);
    }
  } catch (e) { console.error('[capture] Cookie load error', e.message); }

  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(WAIT_MS);

  // Save outputs
  const screenshotPath = path.join(OUTPUT_DIR, 'screenshot.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  fs.writeFileSync(path.join(OUTPUT_DIR, 'console.json'), JSON.stringify(consoleLogs, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'network.json'), JSON.stringify(networkLogs, null, 2));
  const html = await page.content();
  fs.writeFileSync(path.join(OUTPUT_DIR, 'page.html'), html);

  console.log('[capture] Wrote:', { OUTPUT_DIR, screenshotPath, entries: networkLogs.length });
  await browser.close();
})().catch((err) => { console.error('[capture] Failed:', err); process.exit(1); });
