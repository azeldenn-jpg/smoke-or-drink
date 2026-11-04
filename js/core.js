/**
 * SMOKE OR DRINK — outils communs : $, h(), hasard, Deck, Store, Sound, FX, Router
 */
'use strict';

/* ==========================================================================
   2. OUTILS
   ========================================================================== */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

/** Création d'éléments DOM sans innerHTML (aucun risque d'injection via les noms) */
function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'style') for (const [sk, sv] of Object.entries(v)) el.style.setProperty(sk, sv);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

/** Hasard cryptographique (meilleure distribution que Math.random) */
function rand() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] / 4294967296;
}
const randInt = (min, max) => min + Math.floor(rand() * (max - min + 1));
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const plural = (n, word, pl = word + 's') => `${n} ${n > 1 ? pl : word}`;
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const uid = () => Math.floor(rand() * 1e9).toString(36) + Date.now().toString(36);
function formatTime(totalSeconds) {
  const s = Math.max(0, Math.ceil(totalSeconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
function haptic(pattern = 15) {
  // iOS ne supporte pas navigator.vibrate : on compense par du feedback visuel
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* ignore */ }
}
/** Rejoue une animation CSS en retirant/remettant la classe */
function replay(el, cls) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth; // force le reflow
  el.classList.add(cls);
}
/** Bouton à usage unique : impossible de déclencher deux fois (anti double-tap) */
function once(fn) {
  let done = false;
  return function (e) {
    if (done) return;
    done = true;
    if (e && e.currentTarget && 'disabled' in e.currentTarget) e.currentTarget.disabled = true;
    fn.call(this, e);
  };
}

/**
 * Paquet de cartes : mélangé, épuisé avant d'être remélangé,
 * et jamais deux fois la même carte d'affilée lors du remélange.
 */
class Deck {
  constructor(items) {
    this.source = [...items];
    this.pile = [];
    this.last = null;
    this.reshuffled = false;
  }
  get size() { return this.source.length; }
  draw() {
    if (!this.source.length) return null;
    this.reshuffled = false;
    if (!this.pile.length) {
      this.pile = shuffle(this.source);
      const n = this.pile.length;
      if (n > 1 && this.pile[n - 1] === this.last) [this.pile[0], this.pile[n - 1]] = [this.pile[n - 1], this.pile[0]];
      this.reshuffled = this.last !== null;
    }
    this.last = this.pile.pop();
    return this.last;
  }
}

/* ==========================================================================
   3. STORE — sauvegarde locale
   ========================================================================== */
const Store = {
  load() {
    try {
      const data = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || 'null');
      if (data) return data;
      // Migration depuis l'ancienne version (liste de noms)
      const old = JSON.parse(localStorage.getItem('sod_players_list') || 'null');
      if (Array.isArray(old)) return { players: old.filter((n) => typeof n === 'string').map((name) => ({ id: uid(), name })) };
    } catch (e) { /* stockage indisponible (navigation privée) */ }
    return {};
  },
  save(data) {
    try { localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
  },
};

/* ==========================================================================
   4. SOUND — effets générés en WebAudio
   Safari bloque l'audio tant qu'il n'y a pas eu de tap : unlock() est appelé
   à chaque interaction, ce qui permet ensuite à l'alarme du chrono de sonner.
   ========================================================================== */
class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
  }
  unlock() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!this.ctx) {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
      // Buffer silencieux : "réveille" l'audio sur iOS
      const src = this.ctx.createBufferSource();
      src.buffer = this.ctx.createBuffer(1, 1, 22050);
      src.connect(this.ctx.destination);
      src.start(0);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }
  get ready() { return this.enabled && this.ctx && this.ctx.state === 'running'; }

  tone(freq, dur = 0.1, { type = 'sine', vol = 0.3, at = 0, slide = null } = {}) {
    if (!this.ready) return;
    const t = this.ctx.currentTime + at;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  noise(dur = 1, vol = 0.6) {
    if (!this.ready) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2);
    const src = this.ctx.createBufferSource();
    const f = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    src.buffer = buf;
    f.type = 'lowpass';
    f.frequency.setValueAtTime(3000, this.ctx.currentTime);
    f.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + dur);
    g.gain.value = vol;
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start();
  }

  tap()    { this.tone(540, 0.045, { type: 'triangle', vol: 0.08 }); }
  tick(p = 0) { this.tone(1300 + p * 600, 0.025, { type: 'square', vol: 0.05 }); }
  good()   { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.2, { type: 'triangle', vol: 0.18, at: i * 0.07 })); }
  bad()    { this.tone(240, 0.38, { type: 'sawtooth', vol: 0.12, slide: 110 }); }
  reward() { [784, 988, 1175, 1568, 1976].forEach((f, i) => this.tone(f, 0.25, { type: 'sine', vol: 0.2, at: i * 0.06 })); }
  beep()   { this.tone(880, 0.12, { type: 'square', vol: 0.1 }); }
  alarm()  {
    for (let i = 0; i < 6; i++) {
      this.tone(988, 0.11, { type: 'square', vol: 0.16, at: i * 0.26 });
      this.tone(1319, 0.11, { type: 'square', vol: 0.12, at: i * 0.26 + 0.12 });
    }
  }
  boom()   { this.noise(1.4, 0.9); this.tone(90, 0.9, { type: 'sine', vol: 0.7, slide: 28 }); }
}

/* ==========================================================================
   5. FX — particules, flash, secousse
   ========================================================================== */
class FX {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.parts = [];
    this.running = false;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  burst(x, y, { colors = ['#fff'], count = 60, power = 9, gravity = 0.22, spread = Math.PI * 2, angle = -Math.PI / 2 } = {}) {
    if (reducedMotion.matches) return;
    for (let i = 0; i < count; i++) {
      const a = angle + (rand() - 0.5) * spread;
      const v = power * (0.35 + rand() * 0.85);
      this.parts.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: gravity,
        life: 1, decay: 0.008 + rand() * 0.014, size: 3 + rand() * 5,
        color: colors[i % colors.length], rot: rand() * 6, vr: (rand() - 0.5) * 0.3,
        circle: i % 3 === 0,
      });
    }
    this.loop();
  }
  burstFrom(el, opts) {
    if (!el) return;
    const r = el.getBoundingClientRect();
    this.burst(r.left + r.width / 2, r.top + r.height / 2, opts);
  }
  confetti(colors) {
    const w = window.innerWidth, hgt = window.innerHeight;
    this.burst(0, hgt, { colors, count: 70, power: 17, angle: -Math.PI / 3, spread: 0.7 });
    this.burst(w, hgt, { colors, count: 70, power: 17, angle: -Math.PI * 2 / 3, spread: 0.7 });
  }
  loop() {
    if (this.running) return;
    this.running = true;
    const step = () => {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      this.parts = this.parts.filter((p) => p.life > 0);
      for (const p of this.parts) {
        p.vx *= 0.985;
        p.vy = p.vy * 0.985 + p.g;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.life -= p.decay;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        if (p.circle) { ctx.beginPath(); ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2); ctx.fill(); }
        else ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      if (this.parts.length) requestAnimationFrame(step);
      else this.running = false;
    };
    requestAnimationFrame(step);
  }
  flash(color = '#fff') {
    const f = $('#flash');
    f.style.setProperty('--flash', color);
    replay(f, 'on');
  }
  shake() {
    if (reducedMotion.matches) return;
    const app = $('#app');
    replay(app, 'shake');
    setTimeout(() => app.classList.remove('shake'), 550);
  }
}

/* ==========================================================================
   6. ROUTER — navigation avec pile d'historique
   Une seule transition à la fois : les taps pendant l'animation sont ignorés,
   ce qui supprime les bugs de double navigation.
   ========================================================================== */
class Router {
  constructor(onLeave) {
    this.stack = ['home'];
    this.busy = false;
    this.root = $('#app');
    this.onLeave = onLeave;
  }
  get current() { return this.stack[this.stack.length - 1]; }
  screen(id) { return $(`.screen[data-screen="${id}"]`); }

  async go(id, { replace = false } = {}) {
    if (this.busy || id === this.current) return false;
    const prev = this.current;
    if (replace) this.stack[this.stack.length - 1] = id;
    else this.stack.push(id);
    return this._swap(prev, id, 'fwd');
  }
  async back() {
    if (this.busy || this.stack.length <= 1) return false;
    const prev = this.stack.pop();
    return this._swap(prev, this.current, 'back');
  }
  /** Remplace toute la pile, ex. resetTo(['home', 'hub']) */
  async resetTo(path, dir = 'back') {
    if (this.busy) return false;
    const prev = this.current;
    this.stack = [...path];
    if (prev === this.current) return true;
    return this._swap(prev, this.current, dir);
  }
  async _swap(fromId, toId, dir) {
    this.busy = true;
    this.root.classList.add('is-busy');
    this.onLeave && this.onLeave(fromId, toId);
    const from = this.screen(fromId);
    const to = this.screen(toId);
    if (from) {
      from.classList.add('is-leaving');
      from.classList.remove('is-active');
      await wait(reducedMotion.matches ? 0 : 170);
      from.classList.remove('is-leaving');
    }
    this.root.dataset.dir = dir;
    to.classList.add('is-active');
    window.scrollTo(0, 0);
    await wait(60);
    this.root.classList.remove('is-busy');
    this.busy = false;
    return true;
  }
}
