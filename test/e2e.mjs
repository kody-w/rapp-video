// RAPP Video e2e — drives the real page, generates real videos, saves them for inspection.
// Usage: node test/e2e.mjs [url]   (default http://localhost:8377/index.html)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const URL = process.argv[2] || 'http://localhost:8377/index.html';
const OUT = path.join(__dirname, 'out');
const ASSETS = path.join(__dirname, 'assets');
fs.mkdirSync(OUT, { recursive: true });

const report = { url: URL, steps: [], consoleErrors: [], pass: true };
const step = (name, ok, detail = '') => {
  report.steps.push({ name, ok, detail });
  if (!ok) report.pass = false;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
};

const b64ToFile = (b64, file) => fs.writeFileSync(file, Buffer.from(b64, 'base64'));

const grabBlob = (page, expr) => page.evaluate(async (e) => {
  const blob = await eval(e);
  const buf = await blob.arrayBuffer();
  let s = '', bytes = new Uint8Array(buf), chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  return { b64: btoa(s), size: blob.size, type: blob.type };
}, expr);

const CONTRACT_IDS = ['preset-grid','file-input','prompt-input','subject-input','style-input','duration-input','aspect-select','resolution-select','intensity-input','generate-btn','progress-bar','result-video','download-btn','copy-recipe-btn','provider-select','wt-video-input','wt-doc-input','wt-draft-btn','wt-timeline','wt-render-btn','wt-progress-bar','wt-result-video','wt-download-btn'];

const browser = await chromium.launch({
  channel: 'chromium',
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
page.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.location()?.url || '') && !/404/.test(m.text())) report.consoleErrors.push(m.text()); });
page.on('pageerror', e => report.consoleErrors.push('pageerror: ' + e.message));

try {
  // 1. Load
  await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => window.RAPP_VIDEO && window.RAPP_VIDEO.state === 'idle', null, { timeout: 15000 });
  step('page loads, RAPP_VIDEO idle', true);

  // 2. Contract
  const missing = await page.evaluate((ids) => ids.filter(id => !document.getElementById(id)), CONTRACT_IDS);
  step('contract DOM ids present', missing.length === 0, missing.length ? 'missing: ' + missing.join(',') : 'all ' + CONTRACT_IDS.length);
  const api = await page.evaluate(() => ({
    version: window.RAPP_VIDEO.version,
    fns: ['generate','renderWalkthrough','draftTimeline'].filter(f => typeof window.RAPP_VIDEO[f] !== 'function'),
    presetCount: window.RAPP_VIDEO.presets.length,
    camera: window.RAPP_VIDEO.presets.filter(p => p.kind === 'camera').length,
    fx: window.RAPP_VIDEO.presets.filter(p => p.kind === 'fx').length,
  }));
  step('debug API complete', api.fns.length === 0, JSON.stringify(api));
  step('preset roster (>=20 camera, >=12 fx)', api.camera >= 20 && api.fx >= 12, `${api.camera} camera, ${api.fx} fx`);

  // 3. Motion Studio via UI: image upload + crash zoom
  const crashId = await page.evaluate(() => {
    const p = window.RAPP_VIDEO.presets.find(p => /crash/i.test(p.name) && /in/i.test(p.name)) || window.RAPP_VIDEO.presets.find(p => p.kind === 'camera');
    return p.id;
  });
  await page.setInputFiles('#file-input', path.join(ASSETS, 'test-image.png'));
  await page.click(`[data-preset-id="${crashId}"]`);
  await page.fill('#duration-input', '4');
  await page.click('#generate-btn');
  await page.waitForFunction(() => window.RAPP_VIDEO.state === 'done' || window.RAPP_VIDEO.state === 'error', null, { timeout: 180000, polling: 500 });
  const uiState = await page.evaluate(() => ({ state: window.RAPP_VIDEO.state, blob: window.RAPP_VIDEO.lastBlob }));
  step('UI generate (image + crash zoom, 4s)', uiState.state === 'done' && uiState.blob && uiState.blob.size > 50000, JSON.stringify(uiState.blob));
  let uiFile = null;
  if (uiState.state === 'done') {
    const g = await grabBlob(page, `fetch(document.getElementById('result-video').src).then(r=>r.blob())`);
    uiFile = path.join(OUT, 'ui-crash-zoom' + (/mp4/.test(g.type) ? '.mp4' : '.webm'));
    b64ToFile(g.b64, uiFile);
    step('UI blob saved', g.size > 50000, `${g.size} bytes ${g.type}`);
  }

  // 4. Programmatic: text-to-video + orbit + fx
  const orbitId = await page.evaluate(() => {
    const p = window.RAPP_VIDEO.presets.find(p => /orbit/i.test(p.name)) || window.RAPP_VIDEO.presets.find(p => p.kind === 'camera');
    return p.id;
  });
  const prog = await grabBlob(page, `window.RAPP_VIDEO.generate({ presetId: ${JSON.stringify(orbitId)}, mode: 'text', prompt: 'neon city at night', duration: 3, resolution: '720p' })`);
  b64ToFile(prog.b64, path.join(OUT, 'prog-orbit' + (/mp4/.test(prog.type) ? '.mp4' : '.webm')));
  step('programmatic generate (text scene + orbit, 3s)', prog.size > 50000, `${prog.size} bytes ${prog.type}`);

  // 5. Walkthrough Studio: use the UI-generated video as the source recording
  await page.click('[data-tab="walkthrough"]');
  await page.setInputFiles('#wt-video-input', uiFile);
  await page.waitForTimeout(1500); // metadata
  await page.fill('#wt-doc-input', 'Open the studio and pick a preset\nUpload your source image\nGenerate and download the result');
  await page.click('#wt-draft-btn');
  const timelineLen = await page.evaluate(() => { try { return JSON.parse(document.getElementById('wt-timeline').value).length; } catch { return 0; } });
  step('walkthrough draft (3 steps -> timeline)', timelineLen >= 3, `${timelineLen} segments`);
  await page.click('#wt-render-btn');
  await page.waitForFunction(() => window.RAPP_VIDEO.state === 'rendering' || window.RAPP_VIDEO.state === 'error', null, { timeout: 15000, polling: 100 })
    .catch(() => step('walkthrough enters rendering state', false, 'state never left ' + 'idle/done — render did not start'));
  await page.waitForFunction(() => window.RAPP_VIDEO.state === 'done' || window.RAPP_VIDEO.state === 'error', null, { timeout: 240000, polling: 500 });
  const wtState = await page.evaluate(() => ({ state: window.RAPP_VIDEO.state, blob: window.RAPP_VIDEO.lastBlob }));
  step('walkthrough render', wtState.state === 'done' && wtState.blob && wtState.blob.size > 50000, JSON.stringify(wtState.blob));
  if (wtState.state === 'done') {
    const g = await grabBlob(page, `fetch(document.getElementById('wt-result-video').src).then(r=>r.blob())`);
    b64ToFile(g.b64, path.join(OUT, 'walkthrough' + (/mp4/.test(g.type) ? '.mp4' : '.webm')));
    step('walkthrough blob saved', g.size > 50000, `${g.size} bytes ${g.type}`);
  }

  // 6. Console cleanliness
  step('zero console errors', report.consoleErrors.length === 0, report.consoleErrors.slice(0, 5).join(' | '));
} catch (e) {
  step('harness exception', false, e.message);
} finally {
  await browser.close();
}

fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
console.log(report.pass ? '\nALL PASS' : '\nFAILURES PRESENT');
process.exit(report.pass ? 0 : 1);
