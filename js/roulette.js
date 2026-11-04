/**
 * SMOKE OR DRINK — la roue (50 cases, aiguille honnête, attente avant la prochaine taff)
 */
'use strict';

/* ==========================================================================
   7. ROULETTE
   ========================================================================== */
class Roulette {
  constructor(app) {
    this.app = app;
    this.wheel = $('#wheel');
    this.hub = $('#wheel-hub');
    this.hubValue = $('#hub-value');
    this.hubUnit = $('#hub-unit');
    this.ring = $('#ring-progress');
    this.pointer = $('.wheel-pointer');
    this.rarity = $('#rarity');
    this.mainBtn = $('#roulette-main');
    this.RING = 2 * Math.PI * 104; // circonférence de l'anneau de progression
    this.rotation = 0;
    this.state = 'idle'; // idle | spinning | result | counting | done
    this.raf = null;
    this.order = this.buildOrder();
    this.drawWheel();
    this.mainBtn.addEventListener('click', () => this.onMain());
    this.hub.addEventListener('click', () => { if (this.state === 'idle') this.onMain(); });
  }

  /** Répartit les 50 segments de façon homogène (pas tous les rares collés) */
  buildOrder() {
    const { SEGMENTS, TIERS } = CONFIG.ROULETTE;
    const order = new Array(SEGMENTS).fill(null);
    const place = (tier, count, offset) => {
      for (let k = 0; k < count; k++) {
        let pos = Math.round((k + offset) * SEGMENTS / count) % SEGMENTS;
        while (order[pos]) pos = (pos + 1) % SEGMENTS;
        order[pos] = tier;
      }
    };
    place('legendaire', TIERS.legendaire.count, 0.15);
    place('rare', TIERS.rare.count, 0.55);
    for (let i = 0; i < SEGMENTS; i++) if (!order[i]) order[i] = 'commun';
    return order;
  }

  drawWheel() {
    const NS = 'http://www.w3.org/2000/svg';
    const n = this.order.length;
    const step = 360 / n;
    const R = 96, r = 30;
    const pt = (deg, rad) => {
      const a = (deg - 90) * Math.PI / 180;
      return `${(Math.cos(a) * rad).toFixed(3)} ${(Math.sin(a) * rad).toFixed(3)}`;
    };
    this.wheel.replaceChildren();
    const rim = document.createElementNS(NS, 'circle');
    rim.setAttribute('r', '99');
    rim.setAttribute('fill', '#120a1b');
    rim.setAttribute('stroke', 'rgba(244,236,216,.25)');
    rim.setAttribute('stroke-width', '1');
    this.wheel.append(rim);
    this.segs = this.order.map((tier, i) => {
      const t = CONFIG.ROULETTE.TIERS[tier];
      const a0 = i * step, a1 = (i + 1) * step;
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', `M ${pt(a0, r)} L ${pt(a0, R)} A ${R} ${R} 0 0 1 ${pt(a1, R)} L ${pt(a1, r)} A ${r} ${r} 0 0 0 ${pt(a0, r)} Z`);
      path.setAttribute('fill', i % 2 ? t.alt : t.color);
      path.setAttribute('class', `seg seg-${tier}`);
      this.wheel.append(path);
      return path;
    });
    // Petits plots lumineux sur la jante
    for (let i = 0; i < n; i += 5) {
      const dot = document.createElementNS(NS, 'circle');
      const [x, y] = pt(i * step, 98).split(' ');
      dot.setAttribute('cx', x);
      dot.setAttribute('cy', y);
      dot.setAttribute('r', '1.2');
      dot.setAttribute('fill', '#f4ecd8');
      dot.setAttribute('opacity', '.7');
      this.wheel.append(dot);
    }
  }

  /** En Mashup, la roue suit le camp du joueur (ctx.mode) */
  get mode() { return (this.ctx && this.ctx.mode) || this.app.mode; }

  renderLegend() {
    const mode = this.mode;
    const dur = CONFIG.ROULETTE.DURATIONS[this.app.settings.duration] || CONFIG.ROULETTE.DURATIONS.rapide;
    const fmt = ([a, b]) => (b >= 60 ? `${Math.round(a / 60 * 10) / 10}–${Math.round(b / 60 * 10) / 10} min` : `${a}–${b} s`);
    const rows = [
      ['commun', '70 %', mode === 'fumette' ? fmt(dur.commun) : '1–2 🥃'],
      ['rare', '24 %', mode === 'fumette' ? fmt(dur.rare) : '3–4 🥃'],
      ['legendaire', '6 %', mode === 'fumette' ? fmt(dur.legendaire) : 'cul sec'],
    ];
    $('#roulette-legend').replaceChildren(...rows.map(([tier, pct, val]) =>
      h('li', { style: { '--rc': CONFIG.ROULETTE.TIERS[tier].color } }, h('i'), `${CONFIG.ROULETTE.TIERS[tier].name} ${pct} · ${val}`)));
  }

  /**
   * Prépare un tour.
   * ctx = { player, onDone, doneLabel } — onDone est appelé quand le joueur valide.
   */
  setup(ctx) {
    this.cancel();
    this.ctx = ctx;
    this.result = null;
    this.state = 'idle';
    this.wheel.classList.remove('has-result');
    this.segs.forEach((s) => s.classList.remove('hit'));
    this.hub.classList.remove('done');
    this.hub.style.removeProperty('--rc');
    this.ring.style.removeProperty('--rc');
    this.ring.style.strokeDashoffset = this.RING;
    this.hubValue.textContent = '?';
    this.hubValue.style.removeProperty('--rc');
    this.hubUnit.textContent = 'touche-moi';
    this.rarity.replaceChildren();
    this.setButton('TOURNER LA ROUE', true);
    this.renderLegend();
  }

  setButton(label, pulse = false) {
    this.mainBtn.disabled = false;
    this.mainBtn.textContent = label;
    this.mainBtn.classList.toggle('pulse', pulse);
  }

  onMain() {
    switch (this.state) {
      case 'idle': return this.spin();
      case 'result': return this.mode === 'fumette' ? this.startCountdown() : this.finish();
      case 'counting': return this.stopCountdown(false);
      case 'done': return this.finish();
      default: return undefined; // pendant la rotation : on ignore
    }
  }

  spin() {
    this.app.sound.unlock();
    this.state = 'spinning';
    this.mainBtn.disabled = true;
    this.mainBtn.textContent = 'ÇA TOURNE…';
    this.mainBtn.classList.remove('pulse');
    this.hubUnit.textContent = '';

    // 1. Tirage : un segment au hasard (= tirage pondéré 70/24/6)
    const n = this.order.length;
    const step = 360 / n;
    const idx = Math.floor(rand() * n);
    const tierKey = this.order[idx];

    // 2. Angle d'arrivée : le centre du segment (± un peu) sous l'aiguille
    const jitter = (rand() - 0.5) * step * 0.7;
    const target = ((360 - (idx * step + step / 2 + jitter)) % 360 + 360) % 360;
    const current = ((this.rotation % 360) + 360) % 360;
    const delta = ((target - current) + 360) % 360;
    const from = this.rotation;
    const to = this.rotation + (5 + randInt(0, 2)) * 360 + delta; // toujours dans le même sens
    const duration = reducedMotion.matches ? 400 : CONFIG.ROULETTE.SPIN_MS;

    // 3. Animation JS (permet le "clic" de l'aiguille à chaque segment)
    const t0 = performance.now();
    let lastTick = Math.floor(from / step);
    let lastSound = 0;
    const ease = (t) => 1 - Math.pow(1 - t, 4);
    const frame = (now) => {
      const t = Math.min(1, (now - t0) / duration);
      this.rotation = from + (to - from) * ease(t);
      this.wheel.style.transform = `rotate(${this.rotation}deg)`;
      const tickIdx = Math.floor(this.rotation / step);
      if (tickIdx !== lastTick) {
        lastTick = tickIdx;
        if (now - lastSound > 40) {
          lastSound = now;
          this.app.sound.tick(1 - t);
          replay(this.pointer, 'tick');
        }
        if (!reducedMotion.matches) this.hubValue.textContent = this.preview(this.order[(n - (tickIdx % n)) % n]);
      }
      if (t < 1) this.raf = requestAnimationFrame(frame);
      else this.land(idx, tierKey);
    };
    this.raf = requestAnimationFrame(frame);
  }

  /** Valeur "fantôme" qui défile dans le moyeu pendant la rotation */
  preview(tierKey) {
    if (this.mode === 'fumette') {
      const d = CONFIG.ROULETTE.DURATIONS[this.app.settings.duration] || CONFIG.ROULETTE.DURATIONS.rapide;
      return formatTime(randInt(...d[tierKey]));
    }
    const g = CONFIG.ROULETTE.GORGEES[tierKey];
    return g ? String(randInt(...g)) : '💀';
  }

  land(idx, tierKey) {
    this.raf = null;
    const tier = CONFIG.ROULETTE.TIERS[tierKey];
    const color = tier.color;
    this.wheel.classList.add('has-result');
    this.segs[idx].classList.add('hit');
    this.hub.style.setProperty('--rc', color);
    this.hubValue.style.setProperty('--rc', color);
    this.ring.style.setProperty('--rc', color);

    const badge = h('span', { class: `badge${tierKey === 'legendaire' ? ' legend' : ''}`, style: { '--rc': color }, text: tier.name.toUpperCase() });
    this.rarity.replaceChildren(badge);

    const player = this.ctx.player;
    if (this.mode === 'fumette') {
      const d = CONFIG.ROULETTE.DURATIONS[this.app.settings.duration] || CONFIG.ROULETTE.DURATIONS.rapide;
      const secs = randInt(...d[tierKey]);
      this.result = { tierKey, secs };
      this.hubValue.textContent = formatTime(secs);
      this.hubUnit.textContent = 'avant ta taff';
      this.state = 'result';
      this.setButton('▶ LANCER L’ATTENTE', true);
    } else {
      const g = CONFIG.ROULETTE.GORGEES[tierKey];
      const n = g ? randInt(...g) : 5; // cul sec compté comme 5 gorgées dans les stats
      this.result = { tierKey, gorgees: n, culSec: !g };
      this.hubValue.textContent = g ? String(n) : 'CUL SEC';
      this.hubValue.style.fontSize = g ? '' : 'clamp(20px, 6vw, 26px)';
      this.hubUnit.textContent = g ? (n > 1 ? 'gorgées' : 'gorgée') : '💀';
      this.state = 'done';
      this.setButton(`${player ? player.name + ' a bu' : "C'est bu"} ✓`, true);
    }

    // Effets selon la rareté
    if (tierKey === 'legendaire') {
      this.app.sound.reward();
      this.app.fx.flash(color);
      this.app.fx.shake();
      this.app.fx.burstFrom(this.hub, { colors: [color, '#ff9f43', '#fff', '#ffd36b'], count: 120, power: 13 });
      haptic([60, 40, 120]);
    } else {
      this.app.sound.good();
      this.app.fx.burstFrom(this.hub, { colors: [color, '#fff'], count: 40, power: 8 });
      haptic(30);
    }
  }

  startCountdown() {
    const total = this.result.secs;
    const end = Date.now() + total * 1000; // horodaté : insensible aux pauses de Safari
    this.state = 'counting';
    this.setButton('⏹ ARRÊTER');
    this.mainBtn.classList.remove('pulse');
    this.hubUnit.textContent = 'avant ta taff';
    this.ring.style.transition = 'none';
    this.app.keepAwake(true);
    let lastShown = -1;
    const frame = () => {
      const remaining = Math.max(0, (end - Date.now()) / 1000);
      const shown = Math.ceil(remaining);
      if (shown !== lastShown) {
        lastShown = shown;
        this.hubValue.textContent = formatTime(shown);
        if (shown <= 5 && shown > 0) { this.app.sound.beep(); replay(this.hubValue, 'bump-num'); }
      }
      this.ring.style.strokeDashoffset = String(this.RING * (1 - remaining / total));
      if (remaining <= 0) return this.stopCountdown(true);
      this.raf = requestAnimationFrame(frame);
      return undefined;
    };
    this.ring.style.strokeDashoffset = '0';
    this.raf = requestAnimationFrame(frame);
  }

  stopCountdown(natural) {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    this.state = 'done';
    this.hubValue.textContent = '00:00';
    this.ring.style.strokeDashoffset = String(this.RING);
    if (natural) {
      this.app.sound.alarm();
      this.app.fx.flash(this.result ? CONFIG.ROULETTE.TIERS[this.result.tierKey].color : '#fff');
      this.hub.classList.add('done');
      haptic([200, 100, 200]);
      this.hubValue.textContent = 'À TOI';
      this.hubUnit.textContent = '🌿 fume !';
    } else {
      this.hubUnit.textContent = 'arrêté';
    }
    this.setButton(natural ? `✓ C'EST FUMÉ · ${this.ctx.doneLabel || 'SUIVANT →'}` : (this.ctx.doneLabel || 'SUIVANT →'), true);
  }

  finish() {
    if (this.state === 'finished') return;
    this.state = 'finished';
    this.mainBtn.disabled = true;
    const cb = this.ctx && this.ctx.onDone;
    if (cb) cb(this.result);
  }

  cancel() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    this.hubValue.style.fontSize = '';
  }
}
