/**
 * Test « singe » : pour chaque mode et chaque jeu, lance une partie et clique au hasard
 * sur les boutons visibles pendant un moment. Échoue s'il y a la moindre erreur JavaScript.
 * Usage : node tests/monkey.cjs [url] [nombre d'actions par jeu]
 * Lancé automatiquement par GitHub avant chaque publication.
 */
const { chromium } = require('playwright');

const URL = process.argv[2] || 'http://localhost:8080/';
const STEPS = Number(process.argv[3] || 35);
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const NAMES = ['Ethan', 'Léa', 'Tom', 'Inès'];
const SKIP = '[data-action="quit"],[data-action="undo"],[data-action="rules"],[data-action="back"],[data-action="toggle-sound"],[data-action="home"],[data-action="info"],.back-btn,.quit-btn,.icon-btn';

async function fresh(page) {
  await page.goto(URL);
  await page.waitForTimeout(700);
  // événements surprise fréquents pour les tester partout
  await page.evaluate(() => { sodApp.settings.events = 'often'; sodApp.save(); });
  const ok = await page.$('#sheet:not([hidden]) [data-sheet=cancel]');
  if (ok) { await ok.click().catch(() => {}); await page.waitForTimeout(300); }
}

async function play(page, mode, game, errors) {
  await fresh(page);
  await page.click(`.mode-card[data-mode=${mode}]`);
  await page.waitForTimeout(500);
  await page.click(`.game-card[data-game=${game}]`);
  await page.waitForTimeout(500);
  let ins = await page.$$('#players-list input');
  while (ins.length < NAMES.length) { await page.click('#add-player'); ins = await page.$$('#players-list input'); }
  for (let i = 0; i < NAMES.length; i++) await ins[i].fill(NAMES[i]);
  if (mode === 'mashup') {
    const camps = await page.$$('#players-list .camp-toggle');
    if (camps[1]) await camps[1].click();
  }
  const start = await page.$('#start-game:not([disabled])');
  if (!start) { console.log(`  ⚠️  ${mode}/${game} : impossible de lancer (configuration incomplète)`); return; }
  await start.click();
  await page.waitForTimeout(900);
  const before = errors.length;
  for (let s = 0; s < STEPS; s++) {
    // événement surprise : on clique dans la feuille
    const ev = await page.$('#event-sheet:not([hidden])');
    if (ev) {
      const eb = await page.$$('#event-sheet:not([hidden]) button:not([disabled])');
      if (eb.length) await eb[Math.floor(Math.random() * eb.length)].click({ timeout: 1500 }).catch(() => {});
      await page.waitForTimeout(400);
      continue;
    }
    // feuille de dialogue ouverte : on valide
    const sheetOk = await page.$('#sheet:not([hidden]) [data-sheet=ok]');
    if (sheetOk && await sheetOk.isVisible()) { await sheetOk.click().catch(() => {}); await page.waitForTimeout(300); continue; }
    const btns = await page.$$(`.screen.is-active button:not([disabled]):not(${SKIP}), .screen.is-active [role="button"]`);
    const visible = [];
    for (const b of btns) if (await b.isVisible().catch(() => false)) visible.push(b);
    if (!visible.length) { await page.waitForTimeout(1200); continue; }
    const pick = visible[Math.floor(Math.random() * visible.length)];
    await pick.click({ timeout: 1500 }).catch(() => {});
    await page.waitForTimeout(250 + Math.random() * 250);
    if (await page.evaluate(() => sodApp.router.current) === 'end') break;
  }
  const screen = await page.evaluate(() => sodApp.router.current);
  console.log(`  ${errors.length > before ? '❌' : '✅'} ${mode}/${game} (écran final : ${screen})`);
  // quitter proprement
  const quit = await page.$('.screen.is-active .quit-btn');
  if (quit && await quit.isVisible()) {
    await quit.click().catch(() => {});
    await page.waitForTimeout(300);
    const ok = await page.$('[data-sheet=ok]');
    if (ok) await ok.click().catch(() => {});
    await page.waitForTimeout(400);
  }
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|net::ERR|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  // l'écran « quoi de neuf » ne doit pas gêner : on marque la version comme vue
  await page.evaluate(() => localStorage.setItem('sod_seen_version', CONFIG.VERSION.split('.').slice(0, 2).join('.')));
  for (const mode of ['alcool', 'fumette', 'mashup']) {
    await fresh(page);
    await page.click(`.mode-card[data-mode=${mode}]`);
    await page.waitForTimeout(500);
    const games = await page.$$eval('.game-card', (els) => els.map((e) => e.dataset.game));
    console.log(`Mode ${mode} : ${games.join(', ')}`);
    for (const game of games) {
      if (ONLY && !ONLY.includes(game)) continue;
      try { await play(page, mode, game, errors); }
      catch (e) { errors.push(`${mode}/${game} : ${e.message.split('\n')[0]}`); console.log(`  ❌ ${mode}/${game} : ${e.message.split('\n')[0]}`); }
    }
  }
  await browser.close();
  if (errors.length) {
    console.log(`\n${errors.length} erreur(s) :`);
    [...new Set(errors)].forEach((e) => console.log(' - ' + e));
    process.exit(1);
  }
  console.log('\nAucune erreur 🎉');
})();
