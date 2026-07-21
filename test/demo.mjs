// The self-demo: screen-record the studio being driven, then feed that recording
// + doc steps back through the Walkthrough Studio. RAPP Video produces a
// walkthrough of RAPP Video.
// Usage: node test/demo.mjs [url]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const URL = process.argv[2] || 'http://localhost:8377/index.html';
const OUT = path.join(__dirname, 'out');
const ASSETS = path.join(__dirname, 'assets');
fs.mkdirSync(OUT, { recursive: true });

// ---------- Act 1: record a real driving session ----------
const browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: OUT, size: { width: 1280, height: 800 } } });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => window.RAPP_VIDEO && window.RAPP_VIDEO.state === 'idle');
await page.waitForTimeout(2500);                                 // establish the studio

// browse the gallery
await page.mouse.move(900, 400); await page.waitForTimeout(800);
await page.mouse.wheel(0, 350); await page.waitForTimeout(1600);
await page.mouse.wheel(0, -350); await page.waitForTimeout(1200);

// pick a preset
const presetId = await page.evaluate(() => {
  const p = window.RAPP_VIDEO.presets.find(p => /crash/i.test(p.name) && /in/i.test(p.name)) || window.RAPP_VIDEO.presets.find(p => p.kind === 'camera');
  return p.id;
});
const card = page.locator(`[data-preset-id="${presetId}"]`).first();
await card.scrollIntoViewIfNeeded(); await page.waitForTimeout(600);
await card.hover(); await page.waitForTimeout(1000);
await card.click(); await page.waitForTimeout(1500);

// upload the source image
await page.setInputFiles('#file-input', path.join(ASSETS, 'test-image.png'));
await page.waitForTimeout(1800);

// settings
await page.fill('#duration-input', '4'); await page.waitForTimeout(700);
const styleInput = page.locator('#style-input');
await styleInput.click();
await styleInput.pressSequentially('cinematic, moody light', { delay: 55 });
await page.waitForTimeout(900);

// generate + wait for the result
await page.click('#generate-btn');
await page.waitForFunction(() => window.RAPP_VIDEO.state === 'done' || window.RAPP_VIDEO.state === 'error', null, { timeout: 180000, polling: 400 });
await page.waitForTimeout(2500);                                 // show the result playing
await page.evaluate(() => { const v = document.getElementById('result-video'); if (v && v.play) v.play().catch(()=>{}); });
await page.waitForTimeout(3500);

await page.close();
const rawPath = await (async () => { const files = fs.readdirSync(OUT).filter(f => f.endsWith('.webm') && f.length > 30); // playwright hash names
  return files.map(f => path.join(OUT, f)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0]; })();
await ctx.close();
const RAW = path.join(OUT, 'raw-session.webm');
fs.copyFileSync(rawPath, RAW); fs.unlinkSync(rawPath);
console.log('raw session recording:', RAW, fs.statSync(RAW).size, 'bytes');

// ---------- Act 2: produce the walkthrough from recording + doc steps ----------
const page2 = await browser.newPage({ viewport: { width: 1440, height: 950 } });
page2.on('pageerror', e => console.error('pageerror:', e.message));
await page2.goto(URL, { waitUntil: 'load' });
await page2.waitForFunction(() => window.RAPP_VIDEO && window.RAPP_VIDEO.state === 'idle');
await page2.click('[data-tab="walkthrough"]');
await page2.setInputFiles('#wt-video-input', RAW);
await page2.waitForTimeout(2000);
await page2.fill('#wt-doc-input', [
  'Browse the preset gallery — every card is a live preview',
  'Pick a camera move, then upload your source image',
  'Dial in duration, style, and effects',
  'Generate — the engine renders right in your browser',
  'Preview the result and download a real video file',
].join('\n'));
await page2.click('#wt-draft-btn');
await page2.waitForTimeout(800);
// Give the intro card a real title, keep everything else as drafted
await page2.evaluate(() => {
  const ta = document.getElementById('wt-timeline');
  const tl = JSON.parse(ta.value);
  if (tl[0] && tl[0].title) tl[0].title = 'RAPP Video — a full studio in one HTML file';
  ta.value = JSON.stringify(tl, null, 2);
  ta.dispatchEvent(new Event('input', { bubbles: true }));
});
await page2.waitForTimeout(400);
const segs = await page2.evaluate(() => { try { return JSON.parse(document.getElementById('wt-timeline').value).length; } catch { return 0; } });
console.log('drafted segments:', segs);
await page2.click('#wt-render-btn');
await page2.waitForFunction(() => window.RAPP_VIDEO.state === 'done' || window.RAPP_VIDEO.state === 'error', null, { timeout: 300000, polling: 500 });
const state = await page2.evaluate(() => ({ s: window.RAPP_VIDEO.state, b: window.RAPP_VIDEO.lastBlob }));
console.log('walkthrough render:', JSON.stringify(state));
if (state.s === 'done') {
  const g = await page2.evaluate(async () => {
    const blob = await fetch(document.getElementById('wt-result-video').src).then(r => r.blob());
    const buf = await blob.arrayBuffer(); const bytes = new Uint8Array(buf);
    let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return { b64: btoa(s), type: blob.type };
  });
  const outFile = path.join(OUT, 'produced-walkthrough' + (/mp4/.test(g.type) ? '.mp4' : '.webm'));
  fs.writeFileSync(outFile, Buffer.from(g.b64, 'base64'));
  console.log('PRODUCED:', outFile, fs.statSync(outFile).size, 'bytes', g.type);
}
await browser.close();
process.exit(state.s === 'done' ? 0 : 1);
