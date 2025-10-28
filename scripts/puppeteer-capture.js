#!/usr/bin/env node
/*
  Usage examples:
  - TARGET_URL=https://pms.theestablishers.com/dashboard/new-ui/projects     COOKIES_PATH=./cookies.json     OUTPUT_DIR=tmp/puppeteer     EXPORT_ALL_ELEMENTS=1 EXPORT_A11Y=1 EXPORT_DOM_SNAPSHOT=1     SELECTORS=".client-panel,.billing-section,.invoice-row"     node scripts/puppeteer-capture.js

  Outputs:
  - screenshot.png, page.html, console.json, network.json
  - all-elements.json (if EXPORT_ALL_ELEMENTS=1)
  - a11y.json (if EXPORT_A11Y=1)
  - dom-snapshot.json (if EXPORT_DOM_SNAPSHOT=1)
  - styles.json (if SELECTORS set): computed styles + rect for matches
*/
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const TARGET_URL = process.env.TARGET_URL || 'http://localhost:3000';
const OUTPUT_DIR = process.env.OUTPUT_DIR || path.join('tmp','puppeteer');
const COOKIES_PATH = process.env.COOKIES_PATH || '';
const HEADLESS = String(process.env.HEADLESS || 'true') !== 'false';
const WAIT_MS = parseInt(process.env.WAIT_MS || '8000', 10);
const EXPORT_ALL_ELEMENTS = process.env.EXPORT_ALL_ELEMENTS === '1';
const EXPORT_A11Y = process.env.EXPORT_A11Y === '1';
const EXPORT_DOM_SNAPSHOT = process.env.EXPORT_DOM_SNAPSHOT === '1';
const SELECTORS = (process.env.SELECTORS || '').split(',').map(s=>s.trim()).filter(Boolean);
const MAX_ELEMENTS = parseInt(process.env.MAX_ELEMENTS || '20000', 10);

function saveJSON(file, data) {
  fs.writeFileSync(path.join(OUTPUT_DIR, file), JSON.stringify(data, null, 2));
}

async function readCookies(domain) {
  if (!COOKIES_PATH) return [];
  try {
    const raw = fs.readFileSync(COOKIES_PATH, 'utf8');
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    // Normalize sameSite casing for Puppeteer
    return arr.map(c => ({
      name: c.name,
      value: c.value,
      domain: c.domain || domain,
      path: c.path || '/',
      httpOnly: !!c.httpOnly,
      secure: !!c.secure,
      sameSite: (c.sameSite || 'Lax').charAt(0).toUpperCase() + (c.sameSite || 'Lax').slice(1),
      expires: typeof c.expirationDate === 'number' ? Math.floor(c.expirationDate) : undefined,
    }));
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
  // Puppeteer v22 does not expose page.waitForTimeout; use a simple delay instead
  await new Promise((resolve) => setTimeout(resolve, WAIT_MS));

  // Optional: export accessibility tree
  if (EXPORT_A11Y) {
    try {
      const a11y = await page.accessibility.snapshot({ interestingOnly: false });
      saveJSON('a11y.json', a11y);
    } catch (e) { console.error('[capture] a11y export error:', e.message); }
  }

  // Optional: export DOM snapshot via CDP
  if (EXPORT_DOM_SNAPSHOT) {
    try {
      const client = await page.target().createCDPSession();
      const result = await client.send('DOMSnapshot.captureSnapshot', {
        computedStyles: [
          'display','position','font-family','font-size','font-weight','color','background-color',
          'text-align','margin-top','margin-right','margin-bottom','margin-left',
          'padding-top','padding-right','padding-bottom','padding-left','border-top-width',
          'border-right-width','border-bottom-width','border-left-width'
        ],
        includeDOMRects: true,
        includePaintOrder: true,
      });
      saveJSON('dom-snapshot.json', result);
    } catch (e) { console.error('[capture] dom-snapshot error:', e.message); }
  }

  // Optional: export all elements summary (safe subset)
  if (EXPORT_ALL_ELEMENTS) {
    const elements = await page.evaluate((max) => {
      const list = Array.from(document.querySelectorAll('*')).slice(0, max);
      return list.map((el) => {
        const r = el.getBoundingClientRect();
        const text = (el.textContent || '').replace(/\s+/g,' ').trim();
        return {
          tag: el.tagName.toLowerCase(),
          id: el.id || null,
          class: el.className || null,
          text: text.length > 120 ? text.slice(0,120)+'…' : text,
          rect: { x: r.x, y: r.y, width: r.width, height: r.height },
          visibility: (el && el.offsetParent !== null) || r.width > 0 || r.height > 0,
        };
      });
    }, MAX_ELEMENTS);
    saveJSON('all-elements.json', elements);
  }

  // Optional: export computed styles for provided selectors
  if (SELECTORS.length) {
    const styles = await page.evaluate((selectors) => {
      const pick = (cs) => ({
        display: cs.display,
        position: cs.position,
        fontFamily: cs.fontFamily,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        color: cs.color,
        backgroundColor: cs.backgroundColor,
        textAlign: cs.textAlign,
        margin: `${cs.marginTop} ${cs.marginRight} ${cs.marginBottom} ${cs.marginLeft}`,
        padding: `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`,
        borderTopWidth: cs.borderTopWidth,
        borderRightWidth: cs.borderRightWidth,
        borderBottomWidth: cs.borderBottomWidth,
        borderLeftWidth: cs.borderLeftWidth,
      });
      const data = [];
      selectors.forEach((sel) => {
        const nodes = Array.from(document.querySelectorAll(sel));
        nodes.forEach((el, idx) => {
          const cs = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          data.push({
            selector: sel,
            index: idx,
            tag: el.tagName.toLowerCase(),
            id: el.id || null,
            class: el.className || null,
            rect: { x: r.x, y: r.y, width: r.width, height: r.height },
            styles: pick(cs),
            text: (el.textContent || '').trim().slice(0,200),
            outerHTML: el.outerHTML.slice(0,4000),
          });
        });
      });
      return data;
    }, SELECTORS);
    saveJSON('styles.json', styles);
  }

  // Save core outputs
  const screenshotPath = path.join(OUTPUT_DIR, 'screenshot.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  saveJSON('console.json', consoleLogs);
  saveJSON('network.json', networkLogs);
  const html = await page.content();
  fs.writeFileSync(path.join(OUTPUT_DIR, 'page.html'), html);

  console.log('[capture] Wrote:', { OUTPUT_DIR, screenshotPath, networkEntries: networkLogs.length });
  await browser.close();
})().catch((err) => { console.error('[capture] Failed:', err); process.exit(1); });
