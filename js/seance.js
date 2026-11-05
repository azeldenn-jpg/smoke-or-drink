/**
 * SMOKE OR DRINK — mode Séance (plan de taffs calé sur un film)
 */
'use strict';

/* ==========================================================================
   7b. SÉANCE — un plan de taffs tiré d'avance et calé sur un film
   --------------------------------------------------------------------------
   - Le temps tiré par la roue = l'attente avant la prochaine taff
     (Commun 70 % = longue attente, Rare 24 %, Légendaire 6 % = presque tout de suite).
   - "Le joint tourne" : une seule suite d'attentes, les taffs passent de main en main.
   - "Chacun son joint" : une suite d'attentes par joueur, fusionnées dans le temps.
   - Tout est calé sur le temps du FILM : pause / recaler suivent la vidéo.
   - L'état est sauvegardé : fermer l'appli ou verrouiller l'iPad ne perd rien.
   ========================================================================== */
const SEANCE_KEY = 'sod_seance';

function fmtClock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  return `${hh}:${String(mm).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
function fmtDuration(totalSeconds) {
  const m = Math.round(totalSeconds / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
}
/** "42:10" → 42 min 10 s · "1:02:30" → 1 h 02 min 30 s · "35" → 35 min */
function parsePosition(str) {
  const parts = String(str).trim().split(/[:hH.,\s]+/).filter(Boolean).map(Number);
  if (!parts.length || parts.some((n) => !Number.isFinite(n) || n < 0)) return null;
  if (parts.length === 1) return parts[0] * 60;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}
/** Durée de film : "1:52" → 112 min · "95" → 95 min · "2h" → 120 min */
function parseFilmMinutes(str) {
  const parts = String(str).trim().split(/[:hH.,\s]+/).filter((x) => x !== '').map(Number);
  if (!parts.length || parts.some((n) => !Number.isFinite(n) || n < 0)) return null;
  const min = parts.length === 1 ? parts[0] : parts[0] * 60 + parts[1];
  return min >= 1 && min <= 600 ? Math.round(min) : null;
}

class Seance {
  constructor(app) {
    this.app = app;
    this.s = null;          // état sauvegardable
    this.timer = null;
    this.lastAlarm = 0;
    this.alarms = 0;
    this.RING = 2 * Math.PI * 104;
    this.el = {
      dial: $('#se-dial'), ring: $('#se-ring'), time: $('#se-time'), unit: $('#se-unit'), badge: $('#se-badge'),
      names: $('#se-names'), label: $('#se-label'), next: $('#se-next'), count: $('#se-count'),
      now: $('#se-film-now'), total: $('#se-film-total'), bar: $('#se-bar'), scores: $('#se-scores'),
      ready: $('#se-actions-ready'), run: $('#se-actions-run'), pause: $('#se-pause'),
      resyncBox: $('#se-resync-box'), resyncInput: $('#se-resync-input'),
    };
    this.el.dial.addEventListener('click', () => this.onDial());
    $('#se-start').addEventListener('click', () => this.start());
    $('#se-reroll').addEventListener('click', () => { this.build(); this.app.sound.good(); this.app.fx.burstFrom(this.el.dial, { colors: ['#7ee07a', '#3498db', '#e74c3c', '#fff'], count: 40, power: 8 }); });
    this.el.pause.addEventListener('click', () => (this.s && this.s.due ? this.ack() : this.togglePause()));
    $('#se-resync').addEventListener('click', () => this.openResync());
    $('#se-resync-cancel').addEventListener('click', () => { this.el.resyncBox.hidden = true; });
    $('#se-resync-ok').addEventListener('click', () => this.resync());
    this.el.resyncInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); this.resync(); } });
  }

  /* ---------- Tirage du plan ---------- */
  drawTier() {
    // 50 cases : 3 légendaires, 12 rares, 35 communes
    const n = randInt(0, CONFIG.ROULETTE.SEGMENTS - 1);
    const { legendaire, rare } = CONFIG.ROULETTE.TIERS;
    return n < legendaire.count ? 'legendaire' : n < legendaire.count + rare.count ? 'rare' : 'commun';
  }

  build() {
    const set = this.app.settings;
    const film = set.film * 60;
    const D = CONFIG.ROULETTE.DURATIONS[set.duration] || CONFIG.ROULETTE.DURATIONS.raisonnable;
    const players = this.app.game.players;
    const each = set.joint === 'chacun' && players.length > 1;
    const events = [];
    const chain = (only) => {
      let t = 0;
      let k = 0;
      for (;;) {
        const tier = this.drawTier();
        const wait = randInt(...D[tier]);
        t += wait;
        if (t > film) break;
        const p = only != null ? players[only] : players[k % players.length];
        k += 1;
        events.push({ t, tier, wait, ids: [p.id] });
      }
    };
    if (each) players.forEach((_, i) => chain(i)); else chain(null);
    events.sort((a, b) => a.t - b.t);
    // Taffs quasi simultanées (≤ 3 s) : une seule alarme pour tout le monde
    const plan = [];
    for (const e of events) {
      const last = plan[plan.length - 1];
      if (last && e.t - last.t <= 3) last.ids.push(...e.ids);
      else plan.push({ ...e, ids: [...e.ids] });
    }
    players.forEach((p) => { p.taffs = 0; p.planned = plan.reduce((n, e) => n + (e.ids.includes(p.id) ? 1 : 0), 0); });
    this.s = { v: 1, film, joint: each ? 'chacun' : 'tourne', rhythm: set.duration, plan, idx: 0, base: 0, runSince: null, started: false, due: false, players };
    this.render();
  }

  /* ---------- Horloge du film ---------- */
  elapsed() {
    const s = this.s;
    return s.base + (s.runSince ? (Date.now() - s.runSince) / 1000 : 0);
  }
  get running() { return Boolean(this.s && this.s.runSince); }

  start() {
    if (!this.s || this.s.started) return;
    this.app.sound.unlock();
    this.s.started = true;
    this.s.runSince = Date.now();
    this.app.keepAwake(true);
    this.save();
    this.loop();
    this.app.sound.good();
    this.app.toast('🎬 Séance lancée, bon film !', 'good');
    this.render();
  }

  togglePause() {
    const s = this.s;
    if (!s || !s.started) return;
    if (s.runSince) { s.base = this.elapsed(); s.runSince = null; this.app.toast('⏸ Séance en pause'); }
    else { s.runSince = Date.now(); this.app.toast('▶ C’est reparti'); }
    this.save();
    this.render();
  }

  openResync() {
    this.el.resyncBox.hidden = false;
    this.el.resyncInput.value = fmtClock(this.elapsed());
    this.el.resyncInput.focus();
    this.el.resyncInput.select();
  }

  resync() {
    const s = this.s;
    const pos = parsePosition(this.el.resyncInput.value);
    if (pos == null || pos > s.film) { this.app.toast('Format attendu : 42:10 ou 1:02:30', 'bad'); return; }
    s.base = pos;
    if (s.runSince) s.runSince = Date.now();
    s.due = false;
    s.idx = s.plan.findIndex((e) => e.t >= pos);
    if (s.idx < 0) s.idx = s.plan.length;
    this.el.resyncBox.hidden = true;
    this.el.resyncInput.blur();
    this.save();
    this.app.toast(`⏱ Recalé sur ${fmtClock(pos)}`, 'good');
    this.render();
  }

  /* ---------- Boucle ---------- */
  loop() {
    clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), 250);
    this.tick();
  }
  stop() {
    clearInterval(this.timer);
    this.timer = null;
  }

  tick() {
    const s = this.s;
    if (!s || !s.started) return;
    const now = this.elapsed();
    if (!s.due && s.idx < s.plan.length && now >= s.plan[s.idx].t) this.trigger();
    if (s.due && Date.now() - this.lastAlarm > 9000 && this.alarms < 4) this.ring();
    if (now >= s.film && s.runSince) {
      s.base = s.film;
      s.runSince = null;
      this.save();
    }
    this.render(now);
  }

  trigger() {
    const s = this.s;
    s.due = true;
    this.alarms = 0;
    this.save();
    this.ring();
    const ev = s.plan[s.idx];
    const color = CONFIG.ROULETTE.TIERS[ev.tier].color;
    this.app.fx.flash(color);
    this.app.fx.burstFrom(this.el.dial, { colors: [color, '#7ee07a', '#fff'], count: ev.tier === 'legendaire' ? 120 : 50, power: 10 });
    if (ev.tier === 'legendaire') this.app.fx.shake();
  }

  ring() {
    this.lastAlarm = Date.now();
    this.alarms += 1;
    this.app.sound.alarm();
    haptic([200, 100, 200]);
  }

  onDial() {
    if (!this.s) return;
    if (!this.s.started) { this.start(); return; }
    if (this.s.due) this.ack();
    else if (this.s.idx >= this.s.plan.length) this.app.finish();
    else this.togglePause();
  }

  ack() {
    const s = this.s;
    if (!s || !s.due) return;
    const ev = s.plan[s.idx];
    s.players.forEach((p) => { if (ev.ids.includes(p.id)) p.taffs += 1; });
    s.due = false;
    s.idx += 1;
    this.save();
    this.app.sound.good();
    haptic(30);
    this.render();
    replay(this.el.dial, 'swap');
    this.tick(); // si la taff suivante est déjà passée, elle sonne tout de suite
  }

  /* ---------- Sauvegarde / reprise ---------- */
  save() {
    try { localStorage.setItem(SEANCE_KEY, JSON.stringify(this.s)); } catch (e) { /* ignore */ }
  }
  clear() {
    this.stop();
    this.s = null;
    try { localStorage.removeItem(SEANCE_KEY); } catch (e) { /* ignore */ }
  }
  static loadSaved() {
    try {
      const s = JSON.parse(localStorage.getItem(SEANCE_KEY) || 'null');
      if (s && s.v === 1 && s.started && Array.isArray(s.plan) && Array.isArray(s.players)) return s;
    } catch (e) { /* ignore */ }
    return null;
  }
  resume(saved) {
    this.s = saved;
    this.loop();
    this.render();
  }

  /* ---------- Affichage ---------- */
  namesOf(ids) {
    return ids.map((id) => this.s.players.find((p) => p.id === id)).filter(Boolean);
  }

  setNames(players) {
    const key = players.map((p) => p.id).join(',');
    if (this._namesKey === key) return;
    this._namesKey = key;
    this.el.names.replaceChildren(...players.map((p) => h('span', { class: 'se-n', style: { '--pc': p.color } }, this.app.avatar(p, 'dot'), h('span', { text: p.name }))));
  }

  render(now = this.s ? this.elapsed() : 0) {
    const s = this.s;
    if (!s) return;
    const el = this.el;
    const solo = s.players.length === 1;
    el.total.textContent = `/ ${fmtClock(s.film)}`;
    el.now.textContent = fmtClock(now);
    el.bar.style.width = `${Math.min(100, (now / s.film) * 100)}%`;
    el.count.textContent = s.started ? `TAFF ${Math.min(s.idx + (s.due ? 1 : 0), s.plan.length)}/${s.plan.length}` : `${s.plan.length} TAFFS`;
    el.ready.hidden = s.started;
    el.run.hidden = !s.started || s.idx >= s.plan.length;
    el.dial.classList.toggle('is-paused', s.started && !s.runSince && !s.due);
    el.dial.classList.toggle('is-due', s.due);
    // Le badge n'est recréé que s'il change (sinon son animation rejouerait 4 fois par seconde)
    let badgeKey = '';
    const setBadge = (key, make) => { badgeKey = key; if (this._badgeKey !== key) { this._badgeKey = key; el.badge.replaceChildren(...(make ? [make()] : [])); } };

    const setRing = (f, color) => {
      el.ring.style.strokeDashoffset = String(this.RING * (1 - Math.max(0, Math.min(1, f))));
      if (color) el.ring.style.setProperty('--rc', color); else el.ring.style.removeProperty('--rc');
      if (color) el.dial.style.setProperty('--rc', color); else el.dial.style.removeProperty('--rc');
    };
    const badge = (tier) => h('span', { class: `badge${tier === 'legendaire' ? ' legend' : ''}`, style: { '--rc': CONFIG.ROULETTE.TIERS[tier].color }, text: CONFIG.ROULETTE.TIERS[tier].name.toUpperCase() });

    // Plan prêt, pas encore lancé
    if (!s.started) {
      const leg = s.plan.filter((e) => e.tier === 'legendaire').length;
      el.label.textContent = s.joint === 'chacun' ? '// chacun son joint' : solo ? '// ta séance' : '// le joint tourne';
      this.setNames([]);
      el.time.textContent = String(s.plan.length);
      el.unit.textContent = `taff${s.plan.length > 1 ? 's' : ''} prévue${s.plan.length > 1 ? 's' : ''}`;
      setBadge(`ready${leg}`, leg ? () => h('span', { class: 'badge legend', style: { '--rc': '#e74c3c' }, text: `${leg} LÉGENDAIRE${leg > 1 ? 'S' : ''}` }) : null);
      el.next.replaceChildren('Lance quand tu appuies sur ', h('b', { text: 'Play' }), ' · 🎲 pour un autre plan');
      setRing(0);
      this.renderScores();
      return;
    }

    // Plus aucune taff au programme
    if (s.idx >= s.plan.length && !s.due) {
      el.label.textContent = '// séance terminée';
      this.setNames([]);
      el.time.textContent = 'FINI';
      el.unit.textContent = 'touche pour le bilan';
      setBadge('end', null);
      el.next.textContent = now < s.film ? `Plus de taff prévue · encore ${fmtDuration(s.film - now)} de film` : 'Le film est fini 🎬';
      setRing(1);
      this.renderScores();
      return;
    }

    const ev = s.plan[s.idx];
    const who = this.namesOf(ev.ids);
    const color = CONFIG.ROULETTE.TIERS[ev.tier].color;

    if (s.due) {
      el.label.textContent = who.length > 1 ? '// à vous de fumer' : '// à toi de fumer';
      this.setNames(who);
      el.time.textContent = 'À TOI';
      if (who.length > 1) el.time.textContent = 'À VOUS';
      el.unit.textContent = 'touche quand c’est fumé';
      setBadge(`due${s.idx}`, () => badge(ev.tier));
      el.pause.textContent = '✓ C’EST FUMÉ';
      el.pause.classList.add('pulse');
      setRing(1, '#7ee07a');
    } else {
      const prev = s.idx > 0 ? s.plan[s.idx - 1].t : 0;
      const remaining = Math.max(0, ev.t - now);
      el.label.textContent = s.runSince ? '// prochaine taff' : '// en pause';
      this.setNames(solo ? [] : who);
      el.time.textContent = formatTime(remaining);
      el.unit.textContent = s.runSince ? 'avant la taff' : 'touche pour reprendre';
      setBadge(`wait${s.idx}`, () => badge(ev.tier));
      el.pause.textContent = s.runSince ? '⏸ PAUSE' : '▶ REPRENDRE';
      el.pause.classList.toggle('pulse', !s.runSince);
      setRing((now - prev) / Math.max(1, ev.t - prev), color);
    }

    const after = s.plan[s.idx + 1];
    if (after) {
      const afterWho = this.namesOf(after.ids).map((p) => p.name).join(' + ');
      const gap = after.t - ev.t;
      el.next.replaceChildren('Ensuite : ', h('b', { text: solo ? 'toi' : afterWho }), `, ${gap < 90 ? `${Math.round(gap)} s` : `environ ${fmtDuration(gap)}`} après`);
    } else {
      el.next.textContent = 'C’est la dernière taff du film';
    }
    if (this._lastScores !== s.idx) this.renderScores();
  }

  renderScores() {
    const s = this.s;
    this._lastScores = s.idx;
    this.el.scores.replaceChildren(...s.players.map((p) => h('li', { class: 'score-row', style: { '--pc': p.color } },
      this.app.avatar(p, 'sdot'),
      h('span', { class: 'sname', text: p.name }),
      h('span', { class: 'sval' }, `${p.taffs} 🌿`, h('small', { text: ` / ${p.planned} prévues` })))));
  }
}
