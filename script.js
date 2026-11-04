/**
 * ==============================================================================
 * SMOKE OR DRINK — Moteur de jeu PWA (v3)
 * ==============================================================================
 * 100 % Vanilla JS, aucune dépendance. Pensé pour Safari iOS / iPadOS (Koder).
 *
 * Organisation du fichier :
 *   1. CONFIG ............ réglages du jeu (catégories, roulette, jeux…)
 *   2. OUTILS ............ $, h(), hasard crypto, Deck (paquet sans répétition)
 *   3. Store ............. sauvegarde locale (joueurs + réglages)
 *   4. Sound ............. effets sonores générés en WebAudio (aucun fichier)
 *   5. FX ................ particules, flash, secousse
 *   6. Router ............ navigation entre écrans + pile d'historique
 *   7. Roulette .......... roue à 50 segments, aiguille honnête, chrono
 *   8. SmokeOrDrinkApp ... l'application (setup, quiz, cartes, bombe, fin)
 * ==============================================================================
 */
'use strict';

/* ==========================================================================
   1. CONFIG
   ========================================================================== */
const CONFIG = {
  VERSION: '3.0.0',
  STORAGE_KEY: 'sod_v3',
  MAX_PLAYERS: 10,
  PLAYER_COLORS: ['#7ee07a', '#ff5e9e', '#6dc7e8', '#ffc857', '#a667d4', '#ff8855', '#5fb878', '#e85a8c', '#5ec8ff', '#f48fb1'],

  CATEGORIES: {
    histoire:    { name: 'Histoire',         emoji: '🏛️', color: '#d4a574' },
    geo:         { name: 'Géographie',       emoji: '🌍', color: '#5fb878' },
    sciences:    { name: 'Sciences',         emoji: '🔬', color: '#6dc7e8' },
    sport:       { name: 'Sport',            emoji: '⚽', color: '#ff8855' },
    cinema:      { name: 'Ciné & Séries',    emoji: '🎬', color: '#e85a8c' },
    musique:     { name: 'Musique',          emoji: '🎵', color: '#a667d4' },
    jeuxvideo:   { name: 'Jeux Vidéo',       emoji: '🎮', color: '#7ee0b8' },
    internet:    { name: 'Internet & Memes', emoji: '💻', color: '#5ec8ff' },
    bouffe:      { name: 'Bouffe & Drinks',  emoji: '🍕', color: '#ffc857' },
    litterature: { name: 'Littérature',      emoji: '📚', color: '#c97b63' },
    art:         { name: 'Art',              emoji: '🎨', color: '#f48fb1' },
    actu:        { name: 'Actu & People',    emoji: '📰', color: '#9ca3af' },
  },
  UNKNOWN_CATEGORY: { name: 'Divers', emoji: '❓', color: '#9ca3af' },

  // value = points (fumette) ou gorgées (alcool) en jeu sur la question
  DIFFS: {
    easy:   { name: 'Facile',    emoji: '🟢', color: '#7ee07a', value: 1 },
    medium: { name: 'Moyen',     emoji: '🟡', color: '#ffc857', value: 2 },
    hard:   { name: 'Difficile', emoji: '🔴', color: '#ff5e7e', value: 3 },
  },

  TAFF_EVERY: 5, // Mode fumette : 1 taff débloquée tous les 5 points

  // Pénalités des jeux de groupe (en gorgées pour l'alcool ; 1 taff en fumette)
  PENALTY: { jamais: 1, probable: 2, bombe: 3 },

  /**
   * Roulette : 50 segments → 35 Commun (70 %), 12 Rare (24 %), 3 Légendaire (6 %).
   * On tire UN segment au hasard et l'aiguille s'arrête dessus : les probabilités
   * affichées sont exactement celles du tirage, et la roue ne ment jamais.
   */
  ROULETTE: {
    SEGMENTS: 50,
    TIERS: {
      commun:     { name: 'Commun',     color: '#2ecc71', alt: '#26ad5f', count: 35 },
      rare:       { name: 'Rare',       color: '#3498db', alt: '#2c82c0', count: 12 },
      legendaire: { name: 'Légendaire', color: '#e74c3c', alt: '#e74c3c', count: 3 },
    },
    // Durées en secondes [min, max] (plages sans chevauchement)
    DURATIONS: {
      rapide:      { label: 'Rapide',      emoji: '⚡', commun: [15, 30],   rare: [6, 14],    legendaire: [3, 5] },
      raisonnable: { label: 'Raisonnable', emoji: '⏱️', commun: [180, 360], rare: [60, 179],  legendaire: [30, 59] },
      long:        { label: 'Long',        emoji: '🐢', commun: [300, 600], rare: [120, 299], legendaire: [60, 119] },
    },
    GORGEES: { commun: [1, 2], rare: [3, 4], legendaire: null }, // null = cul sec
    SPIN_MS: 4200,
  },

  GAMES: [
    { id: 'quiz', short: "QUIZ", icon: '🧠', title: 'Quiz Culture G', min: 2, kind: 'quiz',
      desc: { fumette: 'Choisis ta mise, réponds juste, débloque des taffs à la roulette.',
              alcool:  'Choisis ta mise : bonne réponse tu distribues, mauvaise tu bois.' } },
    { id: 'jamais', short: "JE N'AI JAMAIS", icon: '🙊', title: "Je n'ai jamais", min: 2, kind: 'cards',
      desc: { fumette: "Ceux qui l'ont déjà fait prennent une taff. Les secrets tombent.",
              alcool:  "Ceux qui l'ont déjà fait boivent. Les secrets tombent." } },
    { id: 'probable', short: "QUI POURRAIT", icon: '👉', title: 'Qui pourrait…', min: 3, kind: 'cards',
      desc: { fumette: 'Tout le monde pointe du doigt en même temps. Le plus désigné prend une taff.',
              alcool:  'Tout le monde pointe du doigt en même temps. Le plus désigné boit 2 gorgées.' } },
    { id: 'bombe', short: "BOMBE", icon: '💣', title: 'La Bombe', min: 2, kind: 'bombe', isNew: true,
      desc: { fumette: "Un thème, un téléphone qui tourne, une mèche invisible. Celui qui l'a quand ça pète prend une taff.",
              alcool:  "Un thème, un téléphone qui tourne, une mèche invisible. Celui qui l'a quand ça pète boit 3 gorgées." } },
    { id: 'roulette', short: "ROULETTE", icon: '🎡', title: 'Roulette', min: 1, kind: 'roulette',
      desc: { fumette: 'Fais tourner la roue : la rareté décide de la durée de ta taff.',
              alcool:  'La roue décide combien tu bois. 6 % de chances de cul sec.' } },
  ],

  END_OPTIONS: {
    quiz: [
      { id: 'free', e: '∞', l: 'Libre' },
      { id: 'r10', e: '10', l: '10 manches', rounds: 10 },
      { id: 'r20', e: '20', l: '20 manches', rounds: 20 },
      { id: 'p15', e: '🏆', l: '1er à 15 pts', points: 15 },
      { id: 'p25', e: '🏆', l: '1er à 25 pts', points: 25 },
    ],
    cards: [
      { id: 'free', e: '∞', l: 'Libre' },
      { id: 'n10', e: '10', l: '10 cartes', cards: 10 },
      { id: 'n20', e: '20', l: '20 cartes', cards: 20 },
      { id: 'n30', e: '30', l: '30 cartes', cards: 30 },
    ],
    bombe: [
      { id: 'free', e: '∞', l: 'Libre' },
      { id: 'n5', e: '5', l: '5 explosions', cards: 5 },
      { id: 'n10', e: '10', l: '10 explosions', cards: 10 },
    ],
  },
};

// Petit jeu de secours si data.json / cards.json ne se chargent pas
const FALLBACK = {
  quiz: [
    { q: 'Qui a peint la Joconde ?', choices: ['Michel-Ange', 'Léonard de Vinci', 'Raphaël', 'Botticelli'], answer: 1, cat: 'art', diff: 'easy' },
    { q: 'Quelle est la capitale de l’Australie ?', choices: ['Sydney', 'Melbourne', 'Canberra', 'Perth'], answer: 2, cat: 'geo', diff: 'medium' },
    { q: 'Combien de cœurs a une pieuvre ?', choices: ['1', '2', '3', '4'], answer: 2, cat: 'sciences', diff: 'hard' },
    { q: 'Quel groupe a chanté « Bohemian Rhapsody » ?', choices: ['Queen', 'Led Zeppelin', 'The Beatles', 'Pink Floyd'], answer: 0, cat: 'musique', diff: 'easy' },
    { q: 'Quel studio a créé Elden Ring ?', choices: ['Capcom', 'FromSoftware', 'Square Enix', 'Konami'], answer: 1, cat: 'jeuxvideo', diff: 'medium' },
    { q: 'Quel traité met fin à la guerre de Trente Ans ?', choices: ['Westphalie', 'Utrecht', 'Versailles', 'Tilsit'], answer: 0, cat: 'histoire', diff: 'hard' },
  ],
  jamais: ['envoyé un message à la mauvaise personne', 'chanté au karaoké', 'raté un train', 'stalké un ex sur les réseaux'],
  probable: ['devenir célèbre', "s'endormir en premier ce soir", 'rater son vol', 'devenir millionnaire'],
  bombe: ['Fruits', 'Pays d’Europe', 'Marques de voiture', 'Pokémon'],
};

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

  renderLegend() {
    const mode = this.app.mode;
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
      case 'result': return this.app.mode === 'fumette' ? this.startCountdown() : this.finish();
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
    if (this.app.mode === 'fumette') {
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
    if (this.app.mode === 'fumette') {
      const d = CONFIG.ROULETTE.DURATIONS[this.app.settings.duration] || CONFIG.ROULETTE.DURATIONS.rapide;
      const secs = randInt(...d[tierKey]);
      this.result = { tierKey, secs };
      this.hubValue.textContent = formatTime(secs);
      this.hubUnit.textContent = 'de taff';
      this.state = 'result';
      this.setButton('▶ LANCER LE CHRONO', true);
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
    this.hubUnit.textContent = 'restant';
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
      this.hubUnit.textContent = 'TERMINÉ !';
    } else {
      this.hubUnit.textContent = 'arrêté';
    }
    this.setButton(this.ctx.doneLabel || 'SUIVANT →', true);
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

/* ==========================================================================
   8. APPLICATION
   ========================================================================== */
class SmokeOrDrinkApp {
  constructor() {
    const saved = Store.load();
    this.players = Array.isArray(saved.players) && saved.players.length
      ? saved.players.slice(0, CONFIG.MAX_PLAYERS).map((p) => ({ id: p.id || uid(), name: String(p.name || '') }))
      : [{ id: uid(), name: '' }, { id: uid(), name: '' }];
    this.settings = {
      sound: true,
      cats: ['all'],
      diff: 'bet',            // 'bet' (mise libre) | 'random'
      duration: 'rapide',
      end: { quiz: 'free', cards: 'free', bombe: 'free' },
      ...(saved.settings || {}),
    };
    this.mode = null;          // 'fumette' | 'alcool'
    this.gameId = null;
    this.game = null;          // état de la partie en cours
    this.data = { quiz: [], jamais: [], probable: [], bombe: [] };
    this.dataReady = false;
    this.wakeLock = null;
    this.timers = new Set();

    this.sound = new Sound();
    this.sound.enabled = this.settings.sound !== false;
    this.fx = new FX($('#fx'));
    this.router = new Router((from, to) => this.onLeave(from, to));
    this.roulette = new Roulette(this);

    this.init();
  }

  /* ---------------------------------------------------------------------- */
  /* INIT                                                                    */
  /* ---------------------------------------------------------------------- */
  async init() {
    document.body.classList.toggle('is-muted', !this.sound.enabled);
    this.bindEvents();
    this.registerServiceWorker();
    await this.loadData();
  }

  async loadData() {
    const get = async (url) => {
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`${url} : HTTP ${res.status}`);
      return res.json();
    };
    const [quizRes, cardsRes] = await Promise.allSettled([get('data.json'), get('cards.json')]);

    // Quiz : accepte un tableau (format actuel) ou { quiz: [...] }
    let quiz = quizRes.status === 'fulfilled' ? quizRes.value : null;
    if (quiz && !Array.isArray(quiz)) quiz = quiz.quiz;
    this.data.quiz = (Array.isArray(quiz) ? quiz : FALLBACK.quiz).filter((q) =>
      q && typeof q.q === 'string' && Array.isArray(q.choices) && q.choices.length >= 2 &&
      Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.choices.length);
    this.data.quiz.forEach((q) => { if (!CONFIG.DIFFS[q.diff]) q.diff = 'medium'; });
    if (!this.data.quiz.length) this.data.quiz = FALLBACK.quiz;

    const cards = cardsRes.status === 'fulfilled' ? cardsRes.value : {};
    for (const key of ['jamais', 'probable', 'bombe']) {
      const list = Array.isArray(cards[key]) ? cards[key].filter((s) => typeof s === 'string' && s.trim()) : [];
      this.data[key] = list.length ? list : FALLBACK[key];
    }
    if (quizRes.status === 'rejected' || cardsRes.status === 'rejected') {
      console.warn('[Data] Chargement partiel, contenu de secours activé.', quizRes.reason || cardsRes.reason);
    }
    this.dataReady = true;
    if (this.router.current === 'setup') this.renderSetup();
  }

  registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    // Le SW n'existe qu'en HTTPS ou sur localhost (pas sur une IP locale en http)
    const secure = location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname);
    if (!secure) return;
    const register = () => navigator.serviceWorker.register('service-worker.js')
      .catch((err) => console.warn('[PWA] Service Worker :', err));
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }

  save() {
    Store.save({
      players: this.players.map((p) => ({ id: p.id, name: p.name })),
      settings: this.settings,
    });
  }

  /* ---------------------------------------------------------------------- */
  /* ÉVÉNEMENTS (délégation : un seul écouteur pour toute l'appli)           */
  /* ---------------------------------------------------------------------- */
  bindEvents() {
    const unlock = () => this.sound.unlock();
    document.addEventListener('touchend', unlock, { passive: true });
    document.addEventListener('click', unlock);

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn || btn.disabled) return;
      if (!btn.closest('.choice, .bet-card, .wheel-hub')) this.sound.tap();

      const action = btn.dataset.action;
      if (action === 'back') this.router.back();
      else if (action === 'toggle-sound') this.toggleSound();
      else if (action === 'quit') this.askQuit();
      else if (btn.classList.contains('mode-card')) this.chooseMode(btn.dataset.mode);
      else if (btn.classList.contains('game-card')) this.chooseGame(btn.dataset.game);
    });

    $('#add-player').addEventListener('click', () => this.addPlayer());
    $('#start-game').addEventListener('click', () => this.startGame());
    $('#cards-skip').addEventListener('click', () => this.cardsNext(false));
    $('#cards-validate').addEventListener('click', () => this.cardsNext(true));
    $('#pc-count').addEventListener('click', () => this.countdown321());
    $('#bomb-start').addEventListener('click', () => this.bombLight());
    $('#end-restart').addEventListener('click', () => this.startGame(true));
    $('#end-hub').addEventListener('click', () => this.goHub());
    $('#end-home').addEventListener('click', () => this.goHome());

    // Retour au premier plan : on réactive l'écran allumé si une partie tourne
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.game && !this.game.over) this.keepAwake(true);
    });
  }

  toggleSound() {
    this.sound.enabled = !this.sound.enabled;
    this.settings.sound = this.sound.enabled;
    document.body.classList.toggle('is-muted', !this.sound.enabled);
    this.save();
    if (this.sound.enabled) { this.sound.unlock(); this.sound.good(); }
    this.toast(this.sound.enabled ? '🔊 Son activé' : '🔇 Son coupé');
  }

  /** Garde l'écran allumé pendant une partie (Safari 16.4+) */
  async keepAwake(on) {
    try {
      if (on && 'wakeLock' in navigator && !this.wakeLock) {
        this.wakeLock = await navigator.wakeLock.request('screen');
        this.wakeLock.addEventListener('release', () => { this.wakeLock = null; });
      } else if (!on && this.wakeLock) {
        await this.wakeLock.release();
        this.wakeLock = null;
      }
    } catch (e) { /* non supporté : sans conséquence */ }
  }

  /** Appelé par le Router à chaque changement d'écran */
  onLeave(from) {
    if (from === 'roulette') this.roulette.cancel();
    if (from === 'bomb') this.bombStop();
  }

  later(fn, ms) {
    const id = setTimeout(() => { this.timers.delete(id); fn(); }, ms);
    this.timers.add(id);
    return id;
  }
  clearTimers() {
    this.timers.forEach((id) => clearTimeout(id));
    this.timers.clear();
  }

  /* ---------------------------------------------------------------------- */
  /* UI GÉNÉRIQUE : toasts, confirmation                                     */
  /* ---------------------------------------------------------------------- */
  toast(msg, type = '') {
    const box = $('#toasts');
    while (box.children.length >= 3) box.firstElementChild.remove();
    const t = h('div', { class: `toast ${type}`, text: msg });
    box.append(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, 2300);
  }

  confirm(title, text, okLabel = 'confirmer') {
    return new Promise((resolve) => {
      const sheet = $('#sheet');
      $('#sheet-title').textContent = title;
      $('#sheet-text').textContent = text;
      $('[data-sheet="ok"]', sheet).textContent = okLabel;
      sheet.hidden = false;
      sheet.classList.remove('closing');
      const close = (val) => {
        sheet.removeEventListener('click', onClick);
        sheet.classList.add('closing');
        setTimeout(() => { sheet.hidden = true; sheet.classList.remove('closing'); }, 220);
        resolve(val);
      };
      const onClick = (e) => {
        const k = e.target.closest('[data-sheet]');
        if (k) close(k.dataset.sheet === 'ok');
      };
      sheet.addEventListener('click', onClick);
    });
  }

  /* ---------------------------------------------------------------------- */
  /* MODE & HUB                                                              */
  /* ---------------------------------------------------------------------- */
  get unitEmoji() { return this.mode === 'fumette' ? '🌿' : '🥃'; }
  unit(n) { return this.mode === 'fumette' ? plural(n, 'taff') : plural(n, 'gorgée'); }
  get gameDef() { return CONFIG.GAMES.find((g) => g.id === this.gameId); }

  chooseMode(mode) {
    this.mode = mode;
    document.body.classList.remove('mode-none', 'mode-fumette', 'mode-alcool');
    document.body.classList.add(`mode-${mode}`);
    haptic(20);
    this.renderHub();
    this.router.go('hub');
  }

  renderHub() {
    $('#hub-title').textContent = this.mode === 'fumette' ? '🌿 MODE FUMETTE' : '🥃 MODE ALCOOL';
    $('#game-list').replaceChildren(...CONFIG.GAMES.map((g, i) =>
      h('button', { class: 'game-card stagger', dataset: { game: g.id }, style: { '--i': i } },
        h('span', { class: 'gc-icon', text: g.icon }),
        h('span', { class: 'gc-body' },
          h('span', { class: 'gc-title', text: g.title }),
          h('span', { class: 'gc-desc', text: g.desc[this.mode] })),
        h('span', { class: 'gc-tag pixel', text: `${g.min}+ 👤` }),
        g.isNew ? h('span', { class: 'gc-new', text: 'NEW' }) : null)));
  }

  chooseGame(id) {
    this.gameId = id;
    this.renderSetup();
    this.router.go('setup');
  }

  goHub() {
    this.endGame();
    this.renderHub();
    this.router.resetTo(['home', 'hub']);
  }

  goHome() {
    this.endGame();
    document.body.classList.remove('mode-fumette', 'mode-alcool');
    document.body.classList.add('mode-none');
    this.router.resetTo(['home']);
  }

  /* ---------------------------------------------------------------------- */
  /* CONFIGURATION                                                           */
  /* ---------------------------------------------------------------------- */
  get kind() { return this.gameDef ? this.gameDef.kind : 'quiz'; }
  get endKey() { return this.kind === 'cards' ? 'cards' : this.kind; }

  renderSetup() {
    const g = this.gameDef;
    if (!g) return;
    $('#setup-title').textContent = `${g.icon} ${g.title.toUpperCase()}`;
    $('#setup-sub').textContent = `// mode ${this.mode} · ${g.min}+ joueurs`;

    $$('.setup-section[data-for]').forEach((sec) => {
      const tags = sec.dataset.for.split(' ');
      sec.hidden = !(tags.includes(g.id) || (g.id === 'roulette' && this.mode === 'fumette' && tags.includes('roulette-fumette')));
    });

    this.renderPlayers();
    if (g.id === 'quiz') { this.renderCategories(); this.renderDiffs(); }
    if (g.id === 'roulette') this.renderDurations();
    if (CONFIG.END_OPTIONS[this.endKey]) this.renderEnds();
    this.validateSetup();
  }

  renderPlayers(focusIndex = -1) {
    const list = $('#players-list');
    list.replaceChildren(...this.players.map((p, i) => {
      const color = CONFIG.PLAYER_COLORS[i % CONFIG.PLAYER_COLORS.length];
      const input = h('input', {
        type: 'text', maxlength: '14', placeholder: `Joueur ${i + 1}`, enterkeyhint: i === this.players.length - 1 ? 'done' : 'next',
        autocomplete: 'off', autocapitalize: 'words', spellcheck: 'false', 'aria-label': `Nom du joueur ${i + 1}`,
      });
      input.value = p.name;
      input.addEventListener('input', () => { p.name = input.value; this.save(); this.validateSetup(); });
      input.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const next = list.querySelectorAll('input')[i + 1];
        if (next) next.focus();
        else if (this.players.length < CONFIG.MAX_PLAYERS && input.value.trim()) this.addPlayer();
        else input.blur();
      });
      const row = h('div', { class: 'player-row', style: { '--pc': color } },
        h('span', { class: 'pdot' }), input,
        this.players.length > 1
          ? h('button', { class: 'remove', 'aria-label': `Retirer ${p.name || `le joueur ${i + 1}`}`, text: '×', onclick: () => this.removePlayer(p.id, row) })
          : null);
      return row;
    }));
    $('#players-count').textContent = `${this.players.length}/${CONFIG.MAX_PLAYERS}`;
    $('#add-player').disabled = this.players.length >= CONFIG.MAX_PLAYERS;
    if (focusIndex >= 0) {
      const inp = list.querySelectorAll('input')[focusIndex];
      if (inp) inp.focus({ preventScroll: false });
    }
  }

  addPlayer() {
    if (this.players.length >= CONFIG.MAX_PLAYERS) return;
    this.players.push({ id: uid(), name: '' });
    this.save();
    this.renderPlayers(this.players.length - 1);
    this.validateSetup();
  }

  removePlayer(id, row) {
    if (this.players.length <= 1) return;
    row.classList.add('is-leaving');
    setTimeout(() => {
      this.players = this.players.filter((p) => p.id !== id);
      this.save();
      this.renderPlayers();
      this.validateSetup();
    }, 230);
  }

  pill({ on, emoji, label, small, color, onClick }) {
    return h('button', { class: `pill${on ? ' is-on' : ''}`, style: color ? { '--pc': color } : {}, onclick: onClick, 'aria-pressed': on ? 'true' : 'false' },
      h('span', { class: 'pe', text: emoji }), label, small ? h('small', { text: small }) : null);
  }

  renderCategories() {
    const counts = {};
    this.data.quiz.forEach((q) => { counts[q.cat] = (counts[q.cat] || 0) + 1; });
    const sel = this.settings.cats;
    const all = this.pill({
      on: sel.includes('all'), emoji: '🎲', label: 'Mix complet', small: `${this.data.quiz.length} q.`, color: 'var(--accent-2)',
      onClick: () => { this.settings.cats = ['all']; this.save(); this.renderCategories(); this.validateSetup(); },
    });
    const pills = Object.entries(CONFIG.CATEGORIES).filter(([id]) => counts[id]).map(([id, c]) => this.pill({
      on: sel.includes(id), emoji: c.emoji, label: c.name, small: `${counts[id]} q.`, color: c.color,
      onClick: () => {
        let cats = this.settings.cats.filter((x) => x !== 'all');
        cats = cats.includes(id) ? cats.filter((x) => x !== id) : [...cats, id];
        this.settings.cats = cats.length ? cats : ['all'];
        this.save();
        this.renderCategories();
        this.validateSetup();
      },
    }));
    $('#cat-grid').replaceChildren(all, ...pills);
  }

  renderDiffs() {
    const opts = [
      { id: 'bet', emoji: '🎲', label: 'Mise libre', small: 'chacun choisit son niveau' },
      { id: 'random', emoji: '🔀', label: 'Aléatoire', small: 'le jeu choisit' },
    ];
    $('#diff-grid').replaceChildren(...opts.map((o) => this.pill({
      on: this.settings.diff === o.id, emoji: o.emoji, label: o.label, small: o.small,
      onClick: () => { this.settings.diff = o.id; this.save(); this.renderDiffs(); },
    })));
  }

  renderDurations() {
    const fmt = (s) => (s >= 60 ? `${Math.round(s / 60)} min` : `${s} s`);
    $('#duration-grid').replaceChildren(...Object.entries(CONFIG.ROULETTE.DURATIONS).map(([id, d]) => this.pill({
      on: this.settings.duration === id, emoji: d.emoji, label: d.label, small: `${fmt(d.legendaire[0])} → ${fmt(d.commun[1])}`,
      onClick: () => { this.settings.duration = id; this.save(); this.renderDurations(); },
    })));
  }

  renderEnds() {
    const key = this.endKey;
    const opts = CONFIG.END_OPTIONS[key];
    if (!opts.some((o) => o.id === this.settings.end[key])) this.settings.end[key] = 'free';
    $('#end-grid').replaceChildren(...opts.map((o) => this.pill({
      on: this.settings.end[key] === o.id, emoji: o.e, label: o.l,
      onClick: () => { this.settings.end[key] = o.id; this.save(); this.renderEnds(); },
    })));
  }

  quizPool() {
    const cats = this.settings.cats;
    return cats.includes('all') ? this.data.quiz : this.data.quiz.filter((q) => cats.includes(q.cat));
  }

  validateSetup() {
    const g = this.gameDef;
    const btn = $('#start-game');
    const info = $('#pool-info');
    const names = this.players.map((p) => p.name.trim());
    let reason = '';
    if (!this.dataReady) reason = 'CHARGEMENT…';
    else if (this.players.length < g.min) reason = `IL FAUT ${g.min} JOUEURS MINIMUM`;
    else if (names.some((n) => !n)) reason = 'NOMME TOUS LES JOUEURS';
    else if (new Set(names.map((n) => n.toLowerCase())).size !== names.length) reason = 'DEUX JOUEURS ONT LE MÊME NOM';

    let count = 0;
    if (this.dataReady) {
      if (g.id === 'quiz') count = this.quizPool().length;
      else if (g.kind === 'cards' || g.kind === 'bombe') count = this.data[g.id].length;
      if (!reason && g.id === 'quiz' && !count) reason = 'AUCUNE QUESTION POUR CES THÈMES';
    }
    btn.disabled = Boolean(reason);
    btn.textContent = reason || 'LANCER LA PARTIE';
    info.textContent = !this.dataReady ? '' : g.id === 'quiz'
      ? `// ${count} questions dispo`
      : g.kind === 'roulette' ? '// 50 cases · 70 / 24 / 6 %' : `// ${count} cartes dans le paquet`;
  }

  /* ---------------------------------------------------------------------- */
  /* DÉMARRAGE / FIN DE PARTIE                                               */
  /* ---------------------------------------------------------------------- */
  startGame(isRestart = false) {
    if (!isRestart) {
      $('#start-game').blur();
      if ($('#start-game').disabled) return;
    }
    const g = this.gameDef;
    const endOpt = (CONFIG.END_OPTIONS[this.endKey] || []).find((o) => o.id === this.settings.end[this.endKey]) || { id: 'free' };
    this.clearTimers();
    this.game = {
      id: g.id, kind: g.kind, end: endOpt,
      players: this.players.map((p, i) => ({
        id: p.id, name: p.name.trim(), color: CONFIG.PLAYER_COLORS[i % CONFIG.PLAYER_COLORS.length],
        score: 0, taffs: 0, given: 0, taken: 0, streak: 0, time: 0,
      })),
      turn: 0, round: 1, count: 0, over: false,
    };

    $$('[data-game-tag]').forEach((el) => { el.textContent = `${this.unitEmoji} ${g.short}`; });
    this.keepAwake(true);
    const target = { quiz: 'quiz', cards: 'cards', bombe: 'bomb', roulette: 'roulette' }[g.kind];

    if (g.kind === 'quiz') {
      const pool = this.quizPool();
      this.game.decks = {
        all: new Deck(pool),
        easy: new Deck(pool.filter((q) => q.diff === 'easy')),
        medium: new Deck(pool.filter((q) => q.diff === 'medium')),
        hard: new Deck(pool.filter((q) => q.diff === 'hard')),
      };
      this.quizTurn();
    } else if (g.kind === 'cards') {
      this.game.deck = new Deck(this.data[g.id]);
      this.cardsTurn(true);
    } else if (g.kind === 'bombe') {
      this.game.deck = new Deck(this.data.bombe);
      this.game.turn = randInt(0, this.game.players.length - 1);
      this.bombTurn();
    } else {
      this.rouletteTurn();
    }
    this.router.go(target, { replace: isRestart });
  }

  checkEnd() {
    const g = this.game;
    const e = g.end;
    if (e.rounds && g.round > e.rounds) return true;
    if (e.points && g.players.some((p) => p.score >= e.points)) return true;
    if (e.cards && g.count >= e.cards) return true;
    return false;
  }

  async askQuit() {
    if (!this.game || this.game.over) return;
    const played = this.game.count > 0 || this.game.players.some((p) => p.score || p.taken || p.taffs);
    const ok = await this.confirm('Terminer la partie ?',
      played ? 'Vous allez voir le classement final.' : 'Aucun tour joué, retour à la configuration.',
      played ? 'voir le classement' : 'quitter');
    if (!ok || !this.game) return;
    if (played) this.finish();
    else { this.endGame(); this.router.resetTo(['home', 'hub', 'setup']); }
  }

  endGame() {
    this.clearTimers();
    this.bombStop();
    this.roulette.cancel();
    if (this.game) this.game.over = true;
    this.keepAwake(false);
  }

  finish() {
    const g = this.game;
    if (!g) return;
    this.endGame();
    const fum = this.mode === 'fumette';
    const conf = {
      quiz:     { kicker: fum ? '// classement des taffeurs' : '// le bourreau de la soirée', crown: 'Le cerveau de la soirée', key: (p) => p.score },
      jamais:   { kicker: "// je n'ai jamais", crown: 'La vie la plus remplie', key: (p) => p.taken },
      probable: { kicker: '// qui pourrait…', crown: 'La star du groupe', key: (p) => p.taken },
      bombe:    { kicker: '// la bombe', crown: "L'artificier maudit", key: (p) => p.taken },
      roulette: { kicker: '// roulette', crown: fum ? 'Le chouchou de la roue' : 'Le plus arrosé', key: (p) => (fum ? p.time : p.taken) },
    }[g.id];

    const ranked = [...g.players].sort((a, b) => conf.key(b) - conf.key(a) || a.taken - b.taken);
    $('#end-kicker').textContent = conf.kicker;
    $('#end-title').textContent = fum ? 'FIN DE PARTIE' : "C'EST FINI";
    $('#winner').replaceChildren(conf.crown, h('b', { text: `👑 ${ranked[0].name}` }));

    $('#podium').replaceChildren(...ranked.map((p, i) => {
      let main, sub = '';
      if (g.id === 'quiz') {
        main = `${p.score} pts`;
        sub = fum ? `${plural(p.taffs, 'taff')} 🌿` : `🥃 ${p.given} données · ${p.taken} bues`;
      } else if (g.id === 'roulette') {
        main = fum ? formatTime(p.time) : `${p.taken} 🥃`;
        sub = fum ? `${plural(p.taffs, 'taff')}` : '';
      } else {
        main = `${p.taken} ${this.unitEmoji}`;
        sub = fum ? plural(p.taken, 'taff') + ' prise' + (p.taken > 1 ? 's' : '') : plural(p.taken, 'gorgée') + ' bue' + (p.taken > 1 ? 's' : '');
      }
      return h('li', { class: i === 0 ? 'first' : '', style: { '--i': i, '--pc': p.color } },
        h('span', { class: 'rank', text: String(i + 1) }),
        h('span', { class: 'pname', text: p.name }),
        h('span', { class: 'pscore' }, main, sub ? h('small', { text: sub }) : null));
    }));

    this.router.resetTo(['home', 'hub', 'setup', 'end'], 'fwd').then(() => {
      this.sound.reward();
      const accent = getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#fff';
      this.fx.confetti([accent, '#ff5e9e', '#ffc857', '#ffffff', '#6dc7e8']);
    });
  }

  /* ---------------------------------------------------------------------- */
  /* AFFICHAGE COMMUN : joueur actif + tableau des scores                    */
  /* ---------------------------------------------------------------------- */
  setTurnName(el, player) {
    el.style.setProperty('--pc', player.color);
    $('.name', el).textContent = player.name;
    replay(el, 'swap');
  }

  scoreLine(p) {
    const g = this.game;
    const fum = this.mode === 'fumette';
    if (g.id === 'quiz') {
      return fum
        ? { v: `${p.score}|${p.taffs}`, main: `${p.score} pts · ${p.taffs} 🌿`, small: '' }
        : { v: `${p.score}|${p.given}|${p.taken}`, main: `${p.score} pts`, small: ` · ${p.given}↗ ${p.taken}↘` };
    }
    if (g.id === 'roulette') {
      return fum
        ? { v: `${p.time}`, main: formatTime(p.time), small: ` · ${p.taffs} 🌿` }
        : { v: `${p.taken}`, main: `${p.taken} 🥃`, small: '' };
    }
    return { v: `${p.taken}`, main: `${p.taken} ${this.unitEmoji}`, small: '' };
  }

  /** Tableau des scores avec animation FLIP : les lignes glissent quand le classement change */
  renderScores(screenId) {
    const g = this.game;
    const screen = this.router.screen(screenId);
    const list = $('[data-score-list]', screen);
    const title = $('[data-score-title]', screen);
    const fum = this.mode === 'fumette';
    title.textContent = g.id === 'quiz' ? (fum ? 'Scores & taffs' : 'Scores · données ↗ bues ↘') : g.id === 'roulette' ? (fum ? 'Temps de taff' : 'Gorgées') : (fum ? 'Taffs prises' : 'Gorgées bues');

    const before = new Map([...list.children].map((li) => [li.dataset.id, { top: li.getBoundingClientRect().top, v: li.dataset.v }]));
    const sortKey = (p) => (g.id === 'quiz' ? p.score : g.id === 'roulette' && fum ? p.time : p.taken);
    const sorted = [...g.players].sort((a, b) => sortKey(b) - sortKey(a));
    const current = g.players[g.turn];

    list.replaceChildren(...sorted.map((p) => {
      const line = this.scoreLine(p);
      return h('li', { class: `score-row${current && p.id === current.id && g.kind !== 'cards' ? ' current' : ''}`, dataset: { id: p.id, v: line.v }, style: { '--pc': p.color } },
        h('span', { class: 'sdot' }),
        h('span', { class: 'sname', text: p.name }),
        h('span', { class: 'sval' }, line.main, line.small ? h('small', { text: line.small }) : null));
    }));

    if (reducedMotion.matches) return;
    [...list.children].forEach((li) => {
      const old = before.get(li.dataset.id);
      if (!old) return;
      const dy = old.top - li.getBoundingClientRect().top;
      if (dy && li.animate) li.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 480, easing: 'cubic-bezier(.16,1,.3,1)' });
      if (old.v !== li.dataset.v) replay($('.sval', li), 'pop-val');
    });
  }

  /** Pastilles joueurs sélectionnables (multi ou simple) */
  renderChips(container, players, { multi = false, counters = null, onChange = () => {} } = {}) {
    const selected = new Set();
    container.replaceChildren(...players.map((p, i) => {
      const chip = h('button', { class: 'chip', style: { '--pc': p.color, '--i': i }, dataset: { id: p.id }, 'aria-pressed': 'false' },
        h('span', { class: 'cdot' }), p.name, counters ? h('span', { class: 'cbadge', text: '0' }) : null);
      chip.addEventListener('click', () => {
        haptic(10);
        if (counters) { counters(p, chip); return; }
        if (multi) {
          if (selected.has(p.id)) selected.delete(p.id); else selected.add(p.id);
        } else {
          selected.clear();
          selected.add(p.id);
        }
        [...container.children].forEach((c) => {
          const on = selected.has(c.dataset.id);
          c.classList.toggle('is-on', on);
          c.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        onChange(selected);
      });
      return chip;
    }));
    return selected;
  }

  /* ---------------------------------------------------------------------- */
  /* QUIZ                                                                    */
  /* ---------------------------------------------------------------------- */
  quizTurn() {
    const g = this.game;
    if (this.checkEnd()) { this.finish(); return; }
    const p = g.players[g.turn];
    g.answered = false;
    this.setTurnName($('#quiz-player'), p);
    $('#quiz-round').textContent = `MANCHE ${g.round}${g.end.rounds ? '/' + g.end.rounds : ''}`;
    const streak = $('#quiz-streak');
    streak.textContent = p.streak >= 2 ? `🔥 série de ${p.streak}` : '';
    this.renderScores('quiz');

    if (this.settings.diff === 'bet') this.renderBet(p);
    else this.renderQuestion(this.drawQuestion('all'));
  }

  drawQuestion(deckKey) {
    const deck = this.game.decks[deckKey];
    const q = deck.draw();
    if (deck.reshuffled) this.toast('🔀 Toutes les questions sont passées, on remélange !');
    return q;
  }

  renderBet(p) {
    const fum = this.mode === 'fumette';
    const cards = Object.entries(CONFIG.DIFFS).map(([key, d], i) => {
      const empty = this.game.decks[key].size === 0;
      return h('button', {
        class: 'bet-card', style: { '--dc': d.color, '--i': i }, disabled: empty,
        onclick: once((e) => {
          haptic(15);
          this.sound.tap();
          e.currentTarget.classList.add('picked');
          $$('.bet-card').forEach((b) => { b.disabled = true; });
          this.later(() => this.renderQuestion(this.drawQuestion(key)), reducedMotion.matches ? 0 : 380);
        }),
      },
      h('span', { class: 'be', text: d.emoji }),
      h('span', { class: 'bn', text: d.name }),
      h('span', { class: 'bv', text: fum ? `+${d.value} pt${d.value > 1 ? 's' : ''}` : `${d.value} 🥃` }),
      h('span', { class: 'bl', text: empty ? 'aucune question' : fum ? 'si bonne réponse' : 'à donner ou à boire' }));
    });
    $('#quiz-stage').replaceChildren(h('div', { class: 'bet' },
      h('p', { class: 'bet-title', text: `${p.name}, choisis ta mise` }),
      h('p', { class: 'bet-sub', text: fum ? 'Plus c’est dur, plus ça rapporte.' : 'Plus tu mises, plus tu distribues… ou plus tu bois.' }),
      h('div', { class: 'bet-grid' }, cards)));
  }

  renderQuestion(q) {
    const g = this.game;
    const cat = CONFIG.CATEGORIES[q.cat] || CONFIG.UNKNOWN_CATEGORY;
    const diff = CONFIG.DIFFS[q.diff];
    // Les choix sont mélangés à chaque fois : la bonne réponse n'est plus toujours "B"
    const order = shuffle(q.choices.map((_, i) => i));
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    g.current = { q, value: diff.value };

    const choices = order.map((orig, i) => h('button', {
      class: 'choice', style: { '--i': i }, dataset: { orig },
      onclick: (e) => this.answerQuiz(orig === q.answer, e.currentTarget),
    }, h('span', { class: 'letter', text: letters[i] }), h('span', { text: q.choices[orig] })));

    $('#quiz-stage').replaceChildren(h('article', { class: 'q-card', style: { '--cat': cat.color } },
      h('div', { class: 'q-meta' },
        h('span', { class: 'tag', style: { '--tc': cat.color }, text: `${cat.emoji} ${cat.name.toUpperCase()}` }),
        h('span', { class: 'tag', style: { '--tc': diff.color }, text: `${diff.emoji} ${diff.name.toUpperCase()} · ${diff.value}` })),
      h('p', { class: 'q-text', text: q.q }),
      h('div', { class: 'choices' }, choices),
      h('div', { class: 'result-area' })));
  }

  answerQuiz(correct, btnEl) {
    const g = this.game;
    if (!g || g.answered) return;
    g.answered = true;
    const { q, value } = g.current;
    const p = g.players[g.turn];
    const fum = this.mode === 'fumette';

    $$('#quiz-stage .choice').forEach((b) => {
      b.disabled = true;
      const orig = Number(b.dataset.orig);
      if (orig === q.answer) b.classList.add('correct');
      else if (b === btnEl) b.classList.add('wrong');
      else b.classList.add('faded');
    });

    const area = $('#quiz-stage .result-area');
    const actions = h('div', { class: 'result-actions' });
    const continueBtn = (label = 'CONTINUER →') => h('button', { class: 'btn-primary', text: label, onclick: once(() => this.quizNext()) });

    if (correct) {
      p.score += value;
      p.streak += 1;
      p.best = Math.max(p.best || 0, p.streak);
      this.sound.good();
      haptic(25);
      const accent = getComputedStyle(document.body).getPropertyValue('--accent').trim();
      this.fx.burstFrom(btnEl, { colors: [accent, '#fff', '#d4ff5e'], count: 45, power: 8 });
      const streak = $('#quiz-streak');
      if (p.streak >= 2) { streak.textContent = `🔥 série de ${p.streak}`; replay(streak, 'bump'); }

      if (fum) {
        const before = p.taffs;
        p.taffs = Math.floor(p.score / CONFIG.TAFF_EVERY);
        const gained = p.taffs - before;
        const lines = [h('p', { class: 'line' }, h('span', { class: 'big', text: `+${value}` }), ` PT${value > 1 ? 'S' : ''}`)];
        if (gained > 0) {
          lines.push(h('p', { class: 'line', text: `🌿 ${gained > 1 ? gained + ' TAFFS DÉBLOQUÉES' : 'TAFF DÉBLOQUÉE'} !` }));
          this.later(() => { this.sound.reward(); this.fx.flash('rgba(126,224,122,.35)'); this.fx.burstFrom(area, { colors: ['#7ee07a', '#d4ff5e', '#fff'], count: 90, power: 11 }); }, 350);
          actions.append(
            h('button', { class: 'btn-primary pulse', text: '🎡 TOURNER LA ROULETTE', onclick: once(() => this.openQuizRoulette(p)) }),
            h('button', { class: 'btn-ghost', text: 'plus tard', onclick: once(() => this.quizNext()) }));
        } else {
          const left = CONFIG.TAFF_EVERY - (p.score % CONFIG.TAFF_EVERY);
          lines.push(h('p', { class: 'sub', text: `encore ${plural(left, 'point')} avant la prochaine taff` }));
          actions.append(continueBtn());
        }
        area.replaceChildren(h('div', { class: 'result good' }, h('p', { class: 'verdict', text: 'BIEN JOUÉ' }), lines), actions);
      } else {
        area.replaceChildren(h('div', { class: 'result good' },
          h('p', { class: 'verdict', text: 'BIEN JOUÉ' }),
          h('p', { class: 'line' }, 'Tu distribues ', h('span', { class: 'big', text: String(value) }), ` gorgée${value > 1 ? 's' : ''} 🥃`)));
        this.renderGive(area, p, value);
      }
    } else {
      p.streak = 0;
      $('#quiz-streak').textContent = '';
      this.sound.bad();
      haptic([30, 40, 30]);
      this.fx.flash('rgba(255,94,126,.22)');
      const answer = q.choices[q.answer];
      const lines = [h('p', { class: 'verdict', text: 'RATÉ' }), h('p', { class: 'sub' }, 'La réponse était ', h('b', { text: answer }))];
      if (!fum) {
        p.taken += value;
        lines.push(h('p', { class: 'line' }, `🥃 ${p.name} boit `, h('span', { class: 'big', text: String(value) }), ` gorgée${value > 1 ? 's' : ''}`));
      } else {
        lines.push(h('p', { class: 'line', text: 'Pas de point cette fois.' }));
      }
      actions.append(continueBtn());
      area.replaceChildren(h('div', { class: 'result bad' }, lines), actions);
    }
    this.renderScores('quiz');
    if (this.checkEnd()) $$('.result-actions .btn-primary, .result-actions .btn-ghost', area).forEach((b) => { if (b.textContent.startsWith('CONTINUER')) b.textContent = 'VOIR LE CLASSEMENT 🏆'; });
    this.later(() => area.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'nearest' }), 250);
  }

  /** Mode alcool : distribuer ses gorgées en tapant sur les joueurs */
  renderGive(area, giver, total) {
    const targets = this.game.players.filter((t) => t.id !== giver.id);
    const dist = new Map(targets.map((t) => [t.id, 0]));
    let left = total;
    const label = h('p', { class: 'give-label' }, 'Tape sur tes victimes · reste ', h('b', { text: String(left) }));
    const chips = h('div', { class: 'chips' });
    const validate = h('button', { class: 'btn-primary', text: 'VALIDER →', disabled: true });
    const reset = h('button', { class: 'btn-ghost', text: '↺ recommencer' });

    const refresh = () => {
      $('b', label).textContent = String(left);
      [...chips.children].forEach((c) => {
        const n = dist.get(c.dataset.id);
        $('.cbadge', c).textContent = String(n);
        c.classList.toggle('is-on', n > 0);
      });
      validate.disabled = left > 0;
      validate.classList.toggle('pulse', left === 0);
    };
    this.renderChips(chips, targets, {
      counters: (p, chip) => {
        if (left <= 0) { replay(label, 'bump'); return; }
        dist.set(p.id, dist.get(p.id) + 1);
        left -= 1;
        this.fx.burstFrom(chip, { colors: [p.color, '#fff'], count: 12, power: 4 });
        refresh();
      },
    });
    reset.addEventListener('click', () => { targets.forEach((t) => dist.set(t.id, 0)); left = total; refresh(); });
    validate.addEventListener('click', once(() => {
      const recap = [];
      targets.forEach((t) => {
        const n = dist.get(t.id);
        if (n > 0) { t.taken += n; giver.given += n; recap.push(`${t.name} ${n}`); }
      });
      this.toast(`🥃 ${recap.join(' · ')}`, 'good');
      this.quizNext();
    }));

    // Un seul adversaire : distribution automatique
    if (targets.length === 1) { dist.set(targets[0].id, total); left = 0; }
    refresh();
    area.append(label, chips, h('div', { class: 'result-actions' }, validate, targets.length > 1 ? reset : null));
  }

  quizNext() {
    const g = this.game;
    if (!g || g.over) return;
    g.count += 1;
    g.turn += 1;
    if (g.turn >= g.players.length) { g.turn = 0; g.round += 1; }
    this.quizTurn();
  }

  openQuizRoulette(player) {
    $('#roulette-quit').hidden = true;
    $('#roulette-label').textContent = '// taff débloquée pour';
    $('#roulette-round').textContent = '';
    this.setTurnName($('#roulette-player'), player);
    this.roulette.setup({
      player,
      doneLabel: '← RETOUR AU QUIZ',
      onDone: (res) => {
        if (res && res.secs) player.time += res.secs;
        $('#roulette-quit').hidden = false;
        this.quizNext(); // prépare le tour suivant pendant la transition
        if (this.game && !this.game.over) this.router.back();
      },
    });
    this.router.go('roulette');
  }

  /* ---------------------------------------------------------------------- */
  /* ROULETTE (jeu autonome)                                                 */
  /* ---------------------------------------------------------------------- */
  rouletteTurn() {
    const g = this.game;
    const p = g.players[g.turn];
    $('#roulette-quit').hidden = false;
    $('#roulette-label').textContent = '// au tour de';
    $('#roulette-round').textContent = `TOUR ${g.count + 1}`;
    this.setTurnName($('#roulette-player'), p);
    this.roulette.setup({
      player: p,
      doneLabel: g.players.length > 1 ? 'JOUEUR SUIVANT →' : 'ENCORE UN TOUR →',
      onDone: (res) => {
        if (!res) return;
        if (this.mode === 'fumette') { p.taffs += 1; p.time += res.secs; }
        else p.taken += res.gorgees;
        g.count += 1;
        g.turn = (g.turn + 1) % g.players.length;
        this.rouletteTurn();
      },
    });
  }

  /* ---------------------------------------------------------------------- */
  /* JEUX DE CARTES : Je n'ai jamais / Qui pourrait…                         */
  /* ---------------------------------------------------------------------- */
  cardsTurn(first = false) {
    const g = this.game;
    if (this.checkEnd()) { this.finish(); return; }
    const isJamais = g.id === 'jamais';
    const fum = this.mode === 'fumette';
    const penalty = fum ? 1 : CONFIG.PENALTY[g.id];
    const text = g.deck.draw();
    if (g.deck.reshuffled) this.toast('🔀 Paquet terminé, on remélange !');
    g.selected = new Set();
    g.penalty = penalty;

    const card = $('#play-card');
    const fill = () => {
      const reader = g.players[g.turn];
      $('#pc-kicker').textContent = isJamais ? "// je n'ai jamais…" : '// qui est le plus susceptible de…';
      $('#pc-text').textContent = isJamais ? `${capitalize(text)}.` : `${capitalize(text)} ?`;
      $('#pc-count').hidden = isJamais;
      $('#cards-round').textContent = `CARTE ${g.count + 1}${g.end.cards ? '/' + g.end.cards : ''}`;
      $('#pc-reader').textContent = `📖 ${reader.name} lit la carte`;
      $('#chips-label').textContent = isJamais
        ? `Ceux qui l'ont déjà fait ${fum ? 'prennent une taff 🌿' : `boivent ${this.unit(penalty)} 🥃`}`
        : `Le plus désigné ${fum ? 'prend une taff 🌿' : `boit ${this.unit(penalty)} 🥃`}`;
      const validate = $('#cards-validate');
      validate.disabled = !isJamais;
      validate.textContent = isJamais ? 'PERSONNE →' : 'VALIDER';
      g.selected = this.renderChips($('#cards-chips'), g.players, {
        multi: isJamais,
        onChange: (sel) => {
          validate.disabled = sel.size === 0 && !isJamais;
          validate.textContent = isJamais ? (sel.size ? `VALIDER (${sel.size})` : 'PERSONNE →') : 'VALIDER';
        },
      });
      card.classList.remove('out');
      replay(card, 'in');
      g.locked = false;
      this.renderScores('cards');
    };
    if (first || reducedMotion.matches) fill();
    else { replay(card, 'out'); this.later(fill, 300); }
  }

  cardsNext(apply) {
    const g = this.game;
    if (!g || g.over || g.locked) return;
    if (apply) {
      if (!g.selected.size && g.id === 'probable') return;
      g.locked = true;
      const hit = g.players.filter((p) => g.selected.has(p.id));
      hit.forEach((p) => {
        p.taken += g.penalty;
        const chip = $(`#cards-chips .chip[data-id="${p.id}"]`);
        this.fx.burstFrom(chip, { colors: [p.color, '#fff'], count: 18, power: 5 });
      });
      if (hit.length) {
        this.sound.good();
        this.toast(`${this.unitEmoji} ${hit.map((p) => p.name).join(', ')} : +${g.penalty}`, 'good');
      } else {
        this.toast('😇 Personne ? Bande de saints.');
      }
      g.count += 1;
    } else {
      g.locked = true;
    }
    g.turn = (g.turn + 1) % g.players.length;
    this.later(() => this.cardsTurn(), apply ? 250 : 0);
  }

  /** Compte à rebours plein écran "3, 2, 1, pointez !" */
  async countdown321() {
    const btn = $('#pc-count');
    if (btn.disabled) return;
    btn.disabled = true;
    const box = h('div', { class: 'big-count' });
    document.body.append(box);
    for (const step of ['3', '2', '1', '👉']) {
      box.replaceChildren(h('span', { text: step }));
      if (step === '👉') { this.sound.reward(); haptic(60); } else { this.sound.beep(); haptic(15); }
      await wait(reducedMotion.matches ? 300 : 750);
    }
    box.remove();
    btn.disabled = false;
  }

  /* ---------------------------------------------------------------------- */
  /* LA BOMBE                                                                */
  /* ---------------------------------------------------------------------- */
  bombTurn() {
    const g = this.game;
    if (this.checkEnd()) { this.finish(); return; }
    const theme = g.deck.draw();
    if (g.deck.reshuffled) this.toast('🔀 Tous les thèmes sont passés, on remélange !');
    const starter = g.players[g.turn];
    const fum = this.mode === 'fumette';
    const penalty = fum ? 1 : CONFIG.PENALTY.bombe;
    g.penalty = penalty;

    const themeEl = $('#bomb-theme');
    themeEl.textContent = theme;
    replay(themeEl, 'swap');
    $('#bomb-round').textContent = `MANCHE ${g.count + 1}${g.end.cards ? '/' + g.end.cards : ''}`;
    $('#bomb-help').textContent = `${starter.name} commence. Cite un mot du thème, puis passe le téléphone à ta gauche. Celui qui l'a en main quand ça pète ${fum ? 'prend une taff' : `boit ${this.unit(penalty)}`}.`;
    $('#bomb-help').hidden = false;
    const wrap = $('#bomb-wrap');
    wrap.classList.remove('lit', 'boom');
    $('#bomb-actions').hidden = false;
    const start = $('#bomb-start');
    start.disabled = false;
    start.textContent = '🔥 ALLUMER LA MÈCHE';
    start.classList.add('pulse');
    $('#bomb-loser').hidden = true;
    this.renderScores('bomb');
  }

  bombLight() {
    const g = this.game;
    if (!g || g.over || g.bombLit) return;
    g.bombLit = true;
    this.sound.unlock();
    const start = $('#bomb-start');
    start.disabled = true;
    start.textContent = '…ÇA BRÛLE';
    start.classList.remove('pulse');
    const wrap = $('#bomb-wrap');
    wrap.classList.add('lit');
    const total = randInt(20, 50) * 1000; // durée secrète
    const t0 = Date.now();
    const tick = () => {
      if (!g.bombLit) return;
      const f = Math.min(1, (Date.now() - t0) / total);
      if (f >= 1) { this.bombExplode(); return; }
      const beat = 950 - 760 * Math.pow(f, 1.4); // le tic-tac accélère
      wrap.style.setProperty('--beat', `${Math.round(beat)}ms`);
      this.sound.tick(f);
      haptic(8);
      g.bombTimer = setTimeout(tick, beat);
    };
    tick();
  }

  bombStop() {
    const g = this.game;
    if (!g) return;
    g.bombLit = false;
    clearTimeout(g.bombTimer);
  }

  bombExplode() {
    const g = this.game;
    this.bombStop();
    const wrap = $('#bomb-wrap');
    wrap.classList.remove('lit');
    wrap.classList.add('boom');
    this.sound.boom();
    this.fx.flash('#fff');
    this.fx.shake();
    this.fx.burstFrom(wrap, { colors: ['#ff7a3a', '#ffd36b', '#ff5e7e', '#fff'], count: 140, power: 15, gravity: 0.15 });
    haptic([300, 80, 200]);

    $('#bomb-actions').hidden = true;
    $('#bomb-help').hidden = true;
    const loserBox = $('#bomb-loser');
    loserBox.hidden = false;
    replay(loserBox, 'bomb-loser');
    const validate = h('button', { class: 'btn-primary', text: 'VALIDER', disabled: true });
    const chips = $('#bomb-chips');
    const sel = this.renderChips(chips, g.players, { onChange: (s) => { validate.disabled = s.size === 0; } });
    validate.addEventListener('click', once(() => {
      const loser = g.players.find((p) => sel.has(p.id));
      if (!loser) return;
      loser.taken += g.penalty;
      this.toast(`💥 ${loser.name} : +${this.unit(g.penalty)}`, 'bad');
      g.count += 1;
      g.turn = g.players.indexOf(loser); // le perdant relance la partie
      this.bombTurn();
    }));
    const old = $('.bomb-validate', loserBox);
    if (old) old.remove();
    loserBox.append(h('div', { class: 'actions single bomb-validate', style: { 'margin-top': '14px' } }, validate));
  }
}

/* ==========================================================================
   DÉMARRAGE
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  window.sodApp = new SmokeOrDrinkApp();
});
