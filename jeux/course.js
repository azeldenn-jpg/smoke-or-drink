/**
 * SMOKE OR DRINK — L'Hippodrome (course de chevaux)
 * ------------------------------------------------------------------------------
 *  1. Paddock : 6 chevaux tirés au sort, cotes calculées sur le téléphone en
 *     simulant 500 courses (≈ 0,05 s, aucune donnée réseau). Chacun parie à son
 *     tour, les paris sont visibles.
 *  2. Course : même moteur que la simulation, avec un nouveau tirage. Deux vues
 *     dessinées au canvas (profil / hippodrome vu du dessus), sons WebAudio.
 *  3. Comptes : gagnant = mise × cote (au-delà de 10 : cul sec à offrir ;
 *     fumeur : jetons plafonnés à 12 pour sa jauge). Perdant = sa mise.
 *     Pari sur le dernier = un gage en plus.
 *  Grand Prix : 3 courses, classement des parieurs, roi + gage final.
 * ------------------------------------------------------------------------------
 */
'use strict';

const COURSE_D = 400;            // longueur de la course (m)
const COURSE_GP = 3;             // courses du Grand Prix
const COURSE_SIMS = 500;         // courses simulées pour les cotes
const COURSE_CAP_DRINK = 12;     // au-delà : cul sec à offrir
const COURSE_LOSS_MAX = 8;       // pari perdu : 2 × la mise, au-delà de 8 c'est un cul sec

/** Ce que rapporte un gain à un buveur : gorgées, 1 ou 2 culs secs, ou la traversée du désert */
function courseReward(gain) {
  if (gain >= 22) return { kind: 'desert', label: 'la TRAVERSÉE DU DÉSERT à offrir 🏜️' };
  if (gain >= 18) return { kind: 'cs', n: 2, label: '2 CULS SECS à offrir 🥃🥃' };
  if (gain > COURSE_CAP_DRINK) return { kind: 'cs', n: 1, label: 'un CUL SEC à offrir 🥃' };
  return { kind: 'drink', n: gain, label: `${plural(gain, 'gorgée')} à distribuer 🥃` };
}
/** Pari perdu d'un buveur : il reboit 2 × sa mise (cul sec si ça dépasse 8) */
const courseLoss = (m) => (m * 2 > COURSE_LOSS_MAX ? { cs: true, n: 5, label: 'CUL SEC' } : { cs: false, n: m * 2, label: plural(m * 2, 'gorgée') });
const COURSE_CAP_TOKENS = 12;    // plafond des jetons d'un fumeur

// Couleur de casaque par numéro (code couleur des tapis de course : lisible, jamais deux pareilles)
const COURSE_SILKS = [
  { c1: '#e0443c', ink: '#ffffff' }, { c1: '#f4f4f0', ink: '#151515' }, { c1: '#2667e8', ink: '#ffffff' },
  { c1: '#f3c534', ink: '#151515' }, { c1: '#1c9b4a', ink: '#ffffff' }, { c1: '#1d1d1d', ink: '#f3c534' },
];
const COURSE_C2 = ['#ffffff', '#f3c534', '#e0443c', '#2667e8', '#8b3ae6', '#f58ac0', '#1c9b4a', '#ff8a3d', '#3aa7e0'];
const COURSE_COATS = [
  ['#7b4a2b', '#2a1810'], ['#a5552b', '#6a2f12'], ['#bdb9b0', '#ece8df'], ['#2b2522', '#120e0c'],
  ['#d2a35a', '#f3e6c8'], ['#4b2d1c', '#1a0f09'], ['#8a5a3a', '#3a2214'], ['#cfcac1', '#6b655e'],
];
const COURSE_NAMES = [
  'Pastis Express', 'Gorgée Fatale', 'Tonton Galop', 'Cul Sec', 'La Tournée', 'Petit Jaune', 'Dernier Verre',
  'Gueule de Bois', 'Happy Hour', 'Roulé Boulé', 'Fumée Blanche', 'Comète du Comptoir', 'Sabot d’Or', 'Jean-Galop',
  'Crinière au Vent', 'Tchin Tchin', 'Apéro Géant', 'Biscotte Furieuse', 'Ça Passe Crème', 'Mojito Turbo',
  'Feu de Paille', 'Plat du Jour', 'Tocard Royal', 'Mamie Fusée', 'Brume Légère', 'Spritz Éclair', 'Tête de Mule',
  'Coup de Grisou', 'Belle de Nuit', 'Pas de Bol', 'Pompon Rouge', 'Galopin',
];
const COURSE_TAG_GOOD = [
  'Imbattable sous la pluie', 'A gagné à Borély l’an dernier', 'Finit toujours très fort', 'Le chouchou des turfistes',
  'Grand espoir de l’écurie', 'En pleine forme ce matin', 'Spécialiste des photos-finish', 'Trois victoires d’affilée',
  'Son jockey ne rigole pas', 'Entraîné à la plage tout l’été',
];
const COURSE_TAG_BAD = [
  'Déteste les virages', 'Part vite, tient rarement', 'Son jockey a fait la fête hier', 'Revient de blessure',
  'Personne n’y croit, sauf sa mère', 'A un peu trop mangé', 'Ne supporte pas le bruit', 'Vient de changer de jockey',
  'Ancien cheval de manège', 'Champion des départs ratés', 'A mordu un photographe',
];
// Ambiance des mises et des gages (cumulatif : Soirée contient Chill, Hot contient tout)
const COURSE_STAKES = {
  chill:  { max: 3, emoji: '🙂', label: 'Chill',  small: 'mises 1 à 3' },
  soiree: { max: 5, emoji: '😈', label: 'Soirée', small: 'mises 1 à 5' },
  hot:    { max: 8, emoji: '💀', label: 'Hot',    small: 'mises 1 à 8' },
};
const COURSE_GAGES = {
  chill: [
    'Imite ton cheval qui perd, avec le bruit, pendant 10 secondes',
    'Commente la prochaine course comme un journaliste du PMU',
    'Fais le tour de la table au trot',
    'Garde un surnom de cheval choisi par le groupe jusqu’à la prochaine course',
    'Hennis chaque fois que quelqu’un dit ton prénom jusqu’à la prochaine course',
    'Mime un jockey en plein sprint pendant 10 secondes',
    'Fais un compliment sincère à chaque joueur',
    'Chante le refrain d’une chanson choisie par le gagnant',
    'Raconte ta pire chute, vraie ou inventée',
  ],
  soiree: [
    'Envoie un vocal de 10 secondes en hennissant à la personne de ton choix',
    'Montre la dernière photo de ta galerie',
    'Lis à voix haute le dernier message que tu as envoyé',
    'Fais une déclaration d’amour à ton cheval perdant',
    'Fais 10 squats en criant le nom du cheval gagnant',
    'Imite un joueur jusqu’à ce que le groupe devine qui c’est',
    'Raconte ton dernier râteau',
  ],
  hot: [
    'Réponds sans mentir à une question du gagnant',
    'Montre ta dernière recherche internet',
    'Danse 20 secondes sur une musique choisie par le groupe',
    'Échange un vêtement avec le joueur de ton choix',
    'Laisse ton voisin de gauche écrire ton prochain message (tu valides avant l’envoi)',
    'Appelle quelqu’un et chante-lui « Joyeux anniversaire »',
  ],
};
const COURSE_LEVELS = { chill: ['chill'], soiree: ['chill', 'soiree'], hot: ['chill', 'soiree', 'hot'] };

/* ==========================================================================
   MOTEUR (fonctions pures : servent aussi bien aux cotes qu'à la vraie course)
   ========================================================================== */
function courseRunner(h, i) {
  return {
    h, i, d: 0, v: 0, done: false, time: 0,
    react: 0.12 + Math.random() * 0.3 + (Math.random() < 0.08 ? 0.75 : 0),   // 8 % de départs ratés
    w1: 0.35 + Math.random() * 0.5, w2: 0.9 + Math.random() * 0.8,
    p1: Math.random() * 6.28, p2: Math.random() * 6.28,
    kick: (Math.random() * 2 - 1) * 1.6 + (h.str - 0.5) * 0.5,                 // fin de course
    stT: Math.random() < 0.05 ? 4 + Math.random() * 14 : -1,                    // 5 % de faux pas
    form: (Math.random() * 2 - 1) * 0.35,                                       // forme du jour
    phase: Math.random(), off: 0,
  };
}
function courseStep(r, t, dt) {
  let target;
  if (t < r.react) target = 0;
  else if (r.d > COURSE_D + 1) target = Math.max(5, 15 - (r.d - COURSE_D) * 0.35);   // petit galop après la ligne
  else {
    const prog = r.d / COURSE_D;
    target = 16.5 + 0.3 * r.h.str + r.form + 0.45 * Math.sin(r.w1 * t + r.p1) + 0.3 * Math.sin(r.w2 * t + r.p2);
    if (prog > 0.6) target += r.kick * Math.min(1, (prog - 0.6) / 0.25);
    if (r.stT > 0 && t > r.stT && t < r.stT + 0.8) target *= 0.6;
  }
  r.v += (target - r.v) * Math.min(1, (target > r.v ? 1.1 : 1.8) * dt);
  const nd = r.d + r.v * dt;
  if (!r.done && nd >= COURSE_D) { r.done = true; r.time = t - dt + (COURSE_D - r.d) / Math.max(r.v, 0.1); }
  r.d = nd;
}
/** Cotes : on fait courir le plateau COURSE_SIMS fois et on compte les victoires */
function courseOdds(field) {
  const wins = new Array(field.length).fill(0), dt = 0.1;
  for (let n = 0; n < COURSE_SIMS; n++) {
    const rs = field.map(courseRunner);
    let t = 0, w = -1;
    while (w < 0) {
      t += dt;
      for (const r of rs) courseStep(r, t, dt);
      let bt = 1e9;
      for (const r of rs) if (r.done && r.time < bt) { bt = r.time; w = r.i; }
    }
    wins[w] += 1;
  }
  field.forEach((h, i) => {
    const p = Math.max(wins[i] / COURSE_SIMS, 0.025);
    const c = Math.max(1.5, 0.88 / p);
    h.cote = c < 10 ? Math.round(c * 2) / 2 : Math.round(c);
  });
}
function courseRank(runners) {
  return runners.slice().sort((a, b) => {
    if (a.done && b.done) return a.time - b.time;
    if (a.done) return -1;
    if (b.done) return 1;
    return b.d - a.d;
  });
}
/** Tire 6 chevaux : noms, robes, casaques, force, forme affichée et petite phrase */
function courseField() {
  const names = shuffle(COURSE_NAMES).slice(0, 6);
  const strs = shuffle([0.95, 0.78, 0.6, 0.45, 0.28, 0.1].map((s) => s + (Math.random() - 0.5) * 0.08));
  const good = shuffle(COURSE_TAG_GOOD), bad = shuffle(COURSE_TAG_BAD);
  return names.map((name, i) => {
    const [coat, mane] = COURSE_COATS[randInt(0, COURSE_COATS.length - 1)];
    const c2s = COURSE_C2.filter((c) => c !== COURSE_SILKS[i].c1);
    const str = strs[i];
    return {
      n: i + 1, i, name, coat, mane, ...COURSE_SILKS[i], c2: c2s[randInt(0, c2s.length - 1)], str,
      form: [0, 1, 2].map(() => (Math.random() < 0.2 + 0.6 * str ? 1 : 0)),
      tag: str > 0.5 ? good.pop() : bad.pop(),
    };
  });
}
const courseFmt = (x, d = 1) => x.toFixed(d).replace('.', ',');
const courseCote = (c) => courseFmt(c, c % 1 ? 1 : 0);
const courseClamp = (v, a, b) => Math.max(a, Math.min(b, v));
const courseHash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
function courseShade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const m = f < 0 ? 0 : 255, k = Math.abs(f);
  r = Math.round(r + (m - r) * k); g = Math.round(g + (m - g) * k); b = Math.round(b + (m - b) * k);
  return `rgb(${r},${g},${b})`;
}
const courseSilkBg = (h) => `linear-gradient(135deg, ${h.c1} 0 40%, ${h.c2} 40% 60%, ${h.c1} 60%)`;
const COURSE_FONT = '"Space Grotesk", system-ui, sans-serif';

addGame(class {
  /* ======================================================================
     DÉROULÉ
     ====================================================================== */
  get courseStake() { return COURSE_STAKES[this.settings.courseStake] || COURSE_STAKES.soiree; }

  courseStart() {
    const g = this.game;
    g.view = this.settings.courseView === 'B' ? 'B' : 'A';
    g.gp = this.settings.courseMode === 'gp';
    g.players.forEach((p) => { p.bigWin = 0; p.tocards = 0; p.bets = 0; });
    if (!this._courseBound) {
      this._courseBound = true;
      $('#course-vA').addEventListener('click', () => this.courseSetView('A'));
      $('#course-vB').addEventListener('click', () => this.courseSetView('B'));
      window.addEventListener('resize', () => { if (this.game && this.game.kind === 'course' && !this.game.over) this.courseResize(); });
    }
    this.courseSetView(g.view, true);
    this.courseTurn();
  }

  /** Nouvelle course : tirage du plateau, calcul des cotes, ouverture des paris */
  courseTurn() {
    this.beginTurn('courseTurn');
    this.courseStop();
    const g = this.game;
    const no = g.count + 1;
    $('#course-round').textContent = g.gp ? `GRAND PRIX · ${no}/${COURSE_GP}` : `COURSE ${no}`;
    const field = courseField();
    courseOdds(field);
    g.race = {
      field, runners: field.map(courseRunner), state: 'idle', t: 0, count: 0, ts: 1, tsT: 1,
      finish: [], dust: [], camX: -6, flags: {}, leaderCand: -1, leaderSince: 0, leaderSaid: -1, lastMsgT: -9,
      rankAt60: null, rec: [], geo: null, raf: 0, last: 0, crowd: 0,
    };
    g.race.runners.forEach((r) => { r.off = (r.i + 0.5) * 8; });
    g.bets = {};
    const n = g.players.length;
    const start = g.count % n;            // le premier parieur change à chaque course
    g.betOrder = Array.from({ length: n }, (_, k) => (start + k) % n);
    g.betIdx = 0;
    $('#course-overlay').replaceChildren();
    $('#course-board').hidden = true;
    this.courseSay('Les partants entrent dans les stalles…', true);
    this.coursePaddock();
    this.renderScores('course');
    this.courseResize();
    requestAnimationFrame(() => this.courseResize());
    this.later(() => this.courseResize(), 320);
  }

  courseSetView(v, silent = false) {
    const g = this.game;
    if (g) g.view = v;
    this.settings.courseView = v;
    this.save();
    $('#course-vA').classList.toggle('is-on', v === 'A');
    $('#course-vB').classList.toggle('is-on', v === 'B');
    $('#course-vA').setAttribute('aria-pressed', v === 'A');
    $('#course-vB').setAttribute('aria-pressed', v === 'B');
    if (!silent) haptic(10);
    this.courseResize();
  }

  courseResize() {
    const g = this.game;
    const cv = $('#course-cv');
    const stage = $('#course-stage');
    if (!g || !g.race || !cv || !stage) return;
    const W = stage.clientWidth;
    if (!W) return;
    const H = g.view === 'A'
      ? Math.round(courseClamp(window.innerHeight * 0.42, 300, 470))
      : Math.round(courseClamp(W * 1.2, 380, Math.max(380, window.innerHeight * 0.62)));
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    cv.style.height = `${H}px`;
    g.race.W = W; g.race.H = H; g.race.dpr = dpr; g.race.geo = null;
    this.courseDraw(0);
  }

  /* ---------- Paddock : les paris ---------- */
  coursePaddock() {
    const g = this.game;
    const race = g.race;
    const panel = $('#course-panel');
    const all = g.betIdx >= g.betOrder.length;
    const p = all ? null : g.players[g.betOrder[g.betIdx]];
    if (p) g.turn = g.betOrder[g.betIdx];
    const max = this.courseStake.max;
    let pick = -1;
    let stake = Math.min(2, max);

    const bettorsOf = (i) => g.players.filter((x) => g.bets[x.id] && g.bets[x.id].h === i);
    const cards = race.field.map((hs) => {
      const bettors = bettorsOf(hs.i);
      return h('button', { class: 'horse-card', dataset: { i: hs.i }, disabled: all, style: { '--silk': hs.c1 }, 'aria-pressed': 'false' },
        h('span', { class: 'hc-num silk-n', style: { background: courseSilkBg(hs), color: hs.ink, '--c1': hs.c1 } }, h('span', { text: String(hs.n) })),
        h('span', { class: 'hc-body' },
          h('span', { class: 'hc-name', text: hs.name }),
          h('span', { class: 'hc-tag', text: hs.tag }),
          bettors.length ? h('span', { class: 'hc-bets' }, ...bettors.map((x) => h('span', { class: 'hc-bet', style: { '--pc': x.color } },
            `${x.emoji || '•'} ${x.name}`, h('b', { text: ` ${g.bets[x.id].m}` })))) : null),
        h('span', { class: 'hc-side' },
          h('span', { class: 'hc-cote' }, h('small', { text: 'cote' }), courseCote(hs.cote)),
          h('span', { class: 'hc-form', 'aria-label': 'Forme sur les 3 dernières courses' },
            ...hs.form.map((f) => h('i', { class: f ? 'up' : 'down', text: f ? '▲' : '▼' })))));
    });
    const list = h('div', { class: 'horse-list' }, cards);

    if (all) {
      const launch = h('button', { class: 'btn-primary pulse', text: '🔔 LANCER LA COURSE', onclick: once(() => this.courseLaunch()) });
      panel.replaceChildren(
        h('div', { class: 'cp-head' }, h('p', { class: 'turn-label pixel', text: '// les jeux sont faits' }),
          h('p', { class: 'cp-title', text: 'Tous les paris sont posés' })),
        list, h('div', { class: 'result-actions' }, launch));
      this.refreshUndo();
      return;
    }

    const smoker = p.camp === 'fumette';
    const unitWord = (n) => (smoker ? plural(n, 'point') : plural(n, 'gorgée'));
    const valueEl = h('b', { class: 'stake-val', text: String(stake) });
    const gainEl = h('p', { class: 'stake-gain' });
    const minus = h('button', { class: 'stake-btn', 'aria-label': 'Baisser la mise', text: '−' });
    const plus = h('button', { class: 'stake-btn', 'aria-label': 'Monter la mise', text: '+' });
    const validate = h('button', { class: 'btn-primary', text: 'CHOISIS UN CHEVAL', disabled: true });
    const refresh = () => {
      valueEl.textContent = String(stake);
      minus.disabled = stake <= 1;
      plus.disabled = stake >= max;
      cards.forEach((c) => { const on = Number(c.dataset.i) === pick; c.classList.toggle('is-on', on); c.setAttribute('aria-pressed', on); });
      const loss = courseLoss(stake);
      const lose = smoker ? `Si tu perds : −${unitWord(stake)} de jauge.` : `Tu bois tes ${unitWord(stake)} maintenant pour valider. Si tu perds : ${loss.cs ? 'CUL SEC' : `tu en bois ${loss.n} de plus`} (×2).`;
      if (pick < 0) { gainEl.textContent = lose; return; }
      const hs = race.field[pick];
      const gain = Math.round(stake * hs.cote);
      const win = smoker ? `${Math.min(gain, COURSE_CAP_TOKENS)} jetons 🌿 pour ta jauge` : courseReward(gain).label;
      gainEl.replaceChildren('Si ', h('b', { text: hs.name }), ` gagne : ${stake} × ${courseCote(hs.cote)} = `, h('b', { text: win }), '.', h('br'), lose);
      validate.disabled = false;
      validate.textContent = smoker ? `PARIER ${stake} SUR LE N°${hs.n}` : `🥃 J’AI BU ${stake} · PARIER SUR LE N°${hs.n}`;
    };
    cards.forEach((c) => c.addEventListener('click', () => { pick = Number(c.dataset.i); haptic(10); refresh(); }));
    minus.addEventListener('click', () => { if (stake > 1) { stake -= 1; haptic(8); refresh(); } });
    plus.addEventListener('click', () => { if (stake < max) { stake += 1; haptic(8); refresh(); } });
    validate.addEventListener('click', once(() => {
      if (pick < 0) return;
      g.bets[p.id] = { h: pick, m: stake };
      if (!smoker) p.taken += stake;   // les gorgées pariées se boivent tout de suite
      g.betIdx += 1;
      this.sound.tick(0.5);
      haptic(20);
      this.coursePaddock();
      this.renderScores('course');
    }));

    const name = h('p', { class: 'turn-name' }, h('span', { class: `dot${p.emoji ? ' emo' : ''}`, text: p.emoji || '' }), h('span', { class: 'name', text: p.name }));
    name.style.setProperty('--pc', p.color);
    panel.replaceChildren(
      h('div', { class: 'cp-head' },
        h('p', { class: 'turn-label pixel', text: `// pari ${g.betIdx + 1}/${g.betOrder.length} · à toi de jouer` }), name),
      list,
      h('div', { class: 'stake' },
        h('span', { class: 'stake-label' }, 'Mise', h('small', { text: smoker ? 'points de jauge' : 'gorgées' })),
        h('span', { class: 'stake-ctl' }, minus, valueEl, plus)),
      gainEl,
      h('div', { class: 'result-actions' }, validate));
    refresh();
    this.refreshUndo();
  }

  /* ---------- Départ ---------- */
  courseLaunch() {
    const g = this.game;
    const race = g.race;
    if (race.state !== 'idle') return;
    this.sound.unlock();
    haptic(30);
    race.state = 'countdown';
    race.count = 3.2;
    race.lastBeep = 4;
    $('#course-panel').replaceChildren(h('p', { class: 'cp-hint pixel', text: '// change de vue quand tu veux pendant la course' }));
    this.courseBuildBoard();
    $('#course-board').hidden = false;
    this.courseSay('Attention… Les stalles vont s’ouvrir.', true);
    $('#course-stage').scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'start' });
    this.courseRun();
  }

  courseRun() {
    const g = this.game;
    const race = g.race;
    race.last = performance.now();
    const frame = (now) => {
      if (this.game !== g || g.over || g.race !== race) return;
      const dt = Math.min(0.05, (now - race.last) / 1000);
      race.last = now;
      this.courseTick(dt);
      this.courseDraw(dt);
      if (race.state !== 'done') race.raf = requestAnimationFrame(frame);
    };
    race.raf = requestAnimationFrame(frame);
  }

  courseStop() {
    const g = this.game;
    if (g && g.race) { cancelAnimationFrame(g.race.raf); g.race.raf = 0; }
    this.courseCrowd(0, true);
  }

  /** Avance la simulation d'une image */
  courseTick(dt) {
    const g = this.game;
    const race = g.race;
    if (race.state === 'countdown') {
      race.count -= dt;
      const n = Math.ceil(race.count);
      if (n < race.lastBeep && n > 0) { race.lastBeep = n; this.sound.beep(); }
      if (race.count <= 0) {
        race.state = 'race'; race.t = 0;
        this.courseBell(1.3);
        this.courseSay('Et c’est parti !', true);
        haptic(40);
      }
      return;
    }
    if (race.state === 'replay') { this.courseReplayTick(dt); return; }
    if (race.state !== 'race' && race.state !== 'finish') return;
    race.ts += (race.tsT - race.ts) * Math.min(1, dt * 5);
    const simdt = dt * race.ts;
    const n = Math.max(1, Math.ceil(simdt / (1 / 120)));
    let thuds = 0;
    for (let k = 0; k < n; k++) {
      race.t += simdt / n;
      for (const r of race.runners) {
        const was = r.done;
        courseStep(r, race.t, simdt / n);
        const before = r.phase;
        r.phase += r.v * (simdt / n) / 6.8;
        // Galop à 4 temps : un bruit de sabot à chaque appui
        if (r.v > 4 && thuds < 6) {
          for (const b of [0, 0.13, 0.46, 0.59]) {
            if (Math.floor(before - b) !== Math.floor(r.phase - b)) { thuds += 1; this.courseThud(0.05 + 0.05 * Math.min(1, r.v / 16)); }
          }
        }
        if (!was && r.done) this.courseCrossed(r);
      }
    }
    // Enregistrement des dernières secondes pour le ralenti
    const lead = courseRank(race.runners)[0];
    if (lead.d > COURSE_D - 45 && (!race.finish.length || race.t < race.finish[0].time + 1.2)) {
      race.rec.push({ t: race.t, r: race.runners.map((r) => [r.d, r.v, r.phase, r.off]) });
    }
    if (race.state === 'race') this.courseCommentary();
    if (race.finish.length === race.runners.length && race.t > race.finish[race.finish.length - 1].time + 1.6) {
      race.state = 'done';
      this.courseResults();
    }
  }

  courseCrossed(r) {
    const g = this.game;
    const race = g.race;
    race.finish.push(r);
    if (race.finish.length !== 1) return;
    race.state = 'finish';
    const rk = courseRank(race.runners);
    const gap = rk[0].d - rk[1].d;
    race.close = gap < 0.6;
    this.courseSay(gap < 0.6 ? `${r.h.name} l’emporte d’un nez !` : gap < 2.5 ? `${r.h.name} l’emporte d’une encolure !` : `${r.h.name} gagne nettement !`, true);
    this.later(() => { if (this.game === g && g.race === race) race.tsT = 1; }, 700);
    this.courseBell(0.7);
    this.courseFanfare();
    haptic([80, 50, 80, 50, 160]);
  }

  /* ---------- Commentateur ---------- */
  courseSay(text, force = false) {
    const g = this.game;
    const race = g && g.race;
    if (race && !force && race.t - race.lastMsgT < 1.7) return;
    if (race) race.lastMsgT = race.t;
    const el = $('#course-msg');
    el.classList.add('swap');
    clearTimeout(this._courseMsgT);
    this._courseMsgT = setTimeout(() => { el.textContent = text; el.classList.remove('swap'); }, 170);
  }

  courseCommentary() {
    const race = this.game.race;
    const t = race.t, f = race.flags;
    const rk = courseRank(race.runners);
    const lead = rk[0];
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    for (const r of race.runners) {
      if (!f[`bad${r.i}`] && r.react > 0.75 && t > 0.9) { f[`bad${r.i}`] = 1; this.courseSay(`Départ raté pour ${r.h.name} !`, true); }
      if (!f[`st${r.i}`] && r.stT > 0 && t > r.stT) { f[`st${r.i}`] = 1; this.courseSay(`${r.h.name} trébuche ! Il perd du terrain.`, true); }
    }
    if (lead.i !== race.leaderCand) { race.leaderCand = lead.i; race.leaderSince = t; }
    if (t > 2.5 && t - race.leaderSince > 0.6 && race.leaderSaid !== race.leaderCand) {
      const first = race.leaderSaid === -1;
      race.leaderSaid = race.leaderCand;
      this.courseSay(first ? `${lead.h.name} prend les commandes.` : pick([`${lead.h.name} passe en tête !`, `${lead.h.name} prend la tête !`, `Changement en tête : ${lead.h.name} !`]));
    }
    const prog = lead.d / COURSE_D;
    if (prog > 0.5 && !f.mid) { f.mid = 1; this.courseSay(`Mi-course : ${rk[0].h.name} mène devant ${rk[1].h.name}.`, true); }
    if (prog > 0.6 && !race.rankAt60) { race.rankAt60 = {}; rk.forEach((r, k) => { race.rankAt60[r.i] = k; }); }
    if (prog > 0.75 && !f.last) { f.last = 1; this.courseSay('Dernière ligne droite !', true); }
    if (race.rankAt60 && prog > 0.7 && prog < 0.98) {
      rk.forEach((r, k) => {
        if (!f[`up${r.i}`] && race.rankAt60[r.i] - k >= 2) { f[`up${r.i}`] = 1; this.courseSay(`${r.h.name} remonte comme une flèche !`); }
      });
    }
    if (!f.photo && rk[0].d > COURSE_D - 14 && rk[1].d > rk[0].d - 1.1) {
      f.photo = 1; race.tsT = 0.3;
      this.courseSay('Photo-finish !', true);
      this.courseClick();
    }
  }

  /* ---------- Classement en direct ---------- */
  courseBuildBoard() {
    const race = this.game.race;
    const board = $('#course-board');
    race.rows = race.field.map((hs) => {
      const el = h('div', { class: 'cb-row' },
        h('span', { class: 'cb-rk' }),
        h('span', { class: 'cb-silk silk-n', style: { background: courseSilkBg(hs), color: hs.ink, '--c1': hs.c1 } }, h('span', { text: String(hs.n) })),
        h('span', { class: 'cb-name' }, hs.name, h('span', { class: 'cb-bets', text: this.courseBettors(hs.i) })),
        h('span', { class: 'cb-val' }));
      return { el, rk: el.children[0], val: el.children[3] };
    });
    board.replaceChildren(...race.rows.map((r) => r.el));
    this.courseUpdateBoard();
  }

  /** Emojis des joueurs qui ont parié sur un cheval */
  courseBettors(i) {
    const g = this.game;
    return g.players.filter((x) => g.bets[x.id] && g.bets[x.id].h === i).map((x) => x.emoji || x.name.slice(0, 1)).join(' ');
  }

  courseUpdateBoard() {
    const race = this.game.race;
    if (!race.rows) return;
    const order = courseRank(race.runners);
    const lead = order[0];
    order.forEach((r, k) => {
      const row = race.rows[r.i];
      row.el.style.transform = `translateY(${k * 34}px)`;
      row.el.classList.toggle('first', k === 0 && race.state !== 'countdown');
      row.rk.textContent = String(k + 1);
      let v;
      if (race.state === 'countdown') v = `cote ${courseCote(r.h.cote)}`;
      else if (r.done) v = k === 0 ? `${courseFmt(r.time, 2)} s` : `+${courseFmt(r.time - lead.time, 2)} s`;
      else if (k === 0) v = 'Tête';
      else v = `−${courseFmt(Math.max(0, lead.d - r.d))} m`;
      if (row.val.textContent !== v) row.val.textContent = v;
    });
  }

  /* ======================================================================
     RÉSULTATS ET COMPTES
     ====================================================================== */
  courseResults() {
    const g = this.game;
    const race = g.race;
    const rk = courseRank(race.runners);
    // Dead-heat : moins d'un centième d'écart, les deux gagnent
    let winners = new Set(rk.filter((r) => r.time - rk[0].time < 0.01).map((r) => r.i));
    // Personne sur le gagnant : c'est le cheval parié le mieux placé qui encaisse
    const betOn = new Set(Object.values(g.bets).map((b) => b.h));
    let proxy = null;
    if (![...winners].some((i) => betOn.has(i))) {
      const best = rk.find((r) => betOn.has(r.i));
      if (best) {
        winners = new Set(rk.filter((r) => betOn.has(r.i) && Math.abs(r.time - best.time) < 0.01).map((r) => r.i));
        proxy = { h: best.h, place: rk.indexOf(best) + 1 };
      }
    }
    const last = rk[rk.length - 1].i;
    const lvl = COURSE_LEVELS[this.settings.courseStake] || COURSE_LEVELS.soiree;
    const gages = shuffle(lvl.flatMap((l) => COURSE_GAGES[l]));
    const queue = [];
    const lines = [];

    g.players.forEach((p) => {
      const bet = g.bets[p.id];
      if (!bet) return;
      const hs = race.field[bet.h];
      p.bets += 1;
      if (hs.cote >= 8) p.tocards += 1;
      const tag = `${hs.n} · ${hs.name} (cote ${courseCote(hs.cote)})`;
      p.betLog = [...(p.betLog || []), { c: hs.cote, w: winners.has(bet.h) }];
      if (winners.has(bet.h)) {
        const gain = Math.round(bet.m * hs.cote);
        p.score += gain;
        p.bigWin = Math.max(p.bigWin || 0, gain);
        queue.push({ p, gain, hs, bet });
        lines.push({ p, ok: true, text: `${proxy ? `🥈 ${p.name} · le plus proche (${proxy.place}e)` : `✅ ${p.name}`} · n°${tag}`, sub: `${bet.m} × ${courseCote(hs.cote)} = ${gain}${p.camp === 'fumette' ? ' jetons' : ` → ${courseReward(gain).label}`}` });
      } else if (p.camp === 'alcool') {
        const loss = courseLoss(bet.m);
        p.taken += loss.n;
        lines.push({ p, ok: false, text: loss.cs ? `🥃 ${p.name} : CUL SEC !` : `🥃 ${p.name} boit ${loss.n}`, sub: `misé ${bet.m} sur n°${tag} · perdu = ×2${loss.cs ? ' (plus de 8 : cul sec)' : ''}` });
      } else {
        const lost = Math.min(p.gauge, bet.m);
        p.gauge -= lost;
        p.sabotaged += bet.m;
        lines.push({ p, ok: false, text: lost ? `🔻 ${p.name} −${lost} de jauge` : `🛡️ ${p.name} : jauge déjà vide`, sub: `misé sur n°${tag}` });
      }
      if (bet.h === last && !winners.has(bet.h)) {
        lines.push({ p, gage: true, text: `🎭 Gage pour ${p.name}`, sub: gages.pop() || 'Le gagnant choisit ton gage' });
      }
    });

    // Podium sur la piste
    const pod = h('div', { class: 'course-podium' },
      h('p', { class: 'cpod-title', text: race.close ? '📸 Photo-finish' : '🏁 Arrivée' }),
      h('div', { class: 'cpod-steps' }, ...[1, 0, 2].map((k) => {
        const r = rk[k];
        return h('div', { class: `cpod-step p${k + 1}` },
          h('span', { class: 'cpod-silk silk-n', style: { background: courseSilkBg(r.h), color: r.h.ink, '--c1': r.h.c1 } }, h('span', { text: String(r.h.n) })),
          h('span', { class: 'cpod-name', text: r.h.name }),
          h('span', { class: 'cpod-bets', text: this.courseBettors(r.i) }),
          h('span', { class: 'cpod-blk', text: String(k + 1) }));
      })));
    race.pod = pod;   // il reste affiché jusqu'à la course suivante
    $('#course-overlay').replaceChildren(pod);

    $('#course-board').hidden = true;
    const panel = $('#course-panel');
    const listEl = h('ul', { class: 'course-lines' }, lines.map((l, i) => h('li', { class: l.gage ? 'gage' : l.ok ? 'good' : 'bad', style: { '--i': i, '--pc': l.p.color } },
      h('span', { class: 'cl-main', text: l.text }), h('span', { class: 'cl-sub', text: l.sub }))));
    const area = h('div', { class: 'course-area' });
    panel.replaceChildren(h('div', { class: 'cp-head' },
      h('p', { class: 'turn-label pixel', text: `// gagnant : n°${rk[0].h.n} ${rk[0].h.name} · cote ${courseCote(rk[0].h.cote)}` }),
      h('p', { class: 'cp-title', text: proxy ? '🥈 Le plus proche encaisse !' : `${plural(queue.length, 'parieur')} encaisse${queue.length > 1 ? 'nt' : ''} !` }),
      proxy ? h('p', { class: 'cp-sub', text: `Personne sur le gagnant : c’est ${proxy.h.name} (${proxy.place}e) qui rapporte.` }) : null),
      listEl, area);
    if (queue.length) this.courseCash(); else this.sound.bad();
    this.renderScores('course');
    this.courseWinner(queue, 0, area);
  }

  /** Chaque gagnant encaisse à son tour */
  courseWinner(queue, k, area) {
    const g = this.game;
    const next = () => this.courseWinner(queue, k + 1, area);
    if (k >= queue.length) { this.courseAfter(area); return; }
    const { p, gain, hs, bet } = queue[k];
    g.turn = g.players.indexOf(p);
    this.renderScores('course');
    const smoker = p.camp === 'fumette';
    const head = h('div', { class: 'result good' },
      h('p', { class: 'verdict', text: `${p.emoji ? p.emoji + ' ' : ''}${p.name} encaisse` }),
      h('p', { class: 'line' }, `${bet.m} × ${courseCote(hs.cote)} = `, h('span', { class: 'big', text: String(gain) })));
    area.replaceChildren(head);
    if (smoker) {
      const n = Math.min(gain, COURSE_CAP_TOKENS);
      head.append(h('p', { class: 'sub', text: `${n} jetons${gain > n ? ' (plafond)' : ''} · garde-les pour ta jauge ou balance-les pour saboter` }));
      this.renderGive(area, p, n, {
        tokens: true, keep: true, screen: 'course',
        onDone: (gained) => {
          if (gained > 0) this.courseTaff(area, p, gained, next);
          else next();
        },
      });
      return;
    }
    const rw = courseReward(gain);
    if (rw.kind === 'desert') {
      head.append(h('p', { class: 'sub', text: 'Jackpot : tu offres la TRAVERSÉE DU DÉSERT 🏜️ (à jouer avec un jeu de cartes). Qui la fait ?' }));
      this.courseCulSec(area, p, next, { desert: true });
      return;
    }
    if (rw.kind === 'cs') {
      head.append(h('p', { class: 'sub', text: rw.n === 2 ? 'Tu offres 2 CULS SECS : à une ou deux personnes. Premier cul sec, à qui ?' : 'Trop gros pour des gorgées : tu offres un CUL SEC. À qui ?' }));
      this.courseCulSec(area, p, rw.n === 2 ? () => {
        area.replaceChildren(h('div', { class: 'result good' }, h('p', { class: 'verdict', text: 'Deuxième cul sec' }), h('p', { class: 'sub', text: 'À qui ? (la même personne, si tu veux)' })));
        this.courseCulSec(area, p, next);
      } : next);
      return;
    }
    head.append(h('p', { class: 'sub', text: `Tu distribues ${plural(gain, 'gorgée')}` }));
    this.renderGive(area, p, gain, { tokens: this.isMashup, keep: false, screen: 'course', onDone: () => next() });
  }

  /** Cul sec offert : un buveur le boit, un fumeur voit sa jauge vidée */
  courseCulSec(area, giver, then, { desert = false } = {}) {
    const g = this.game;
    const others = g.players.filter((x) => x.id !== giver.id);
    const ok = h('button', { class: 'btn-primary', text: desert ? '🏜️ LANCER LA TRAVERSÉE' : 'OFFRIR LE CUL SEC', disabled: true });
    const chips = h('div', { class: 'chips' });
    const sel = this.renderChips(chips, others, {
      labelOf: this.isMashup && !desert ? (t) => h('span', { class: 'chip-main' }, t.name, h('small', { text: t.camp === 'alcool' ? '🥃 cul sec' : '🌿 jauge vidée' })) : null,
      onChange: (s) => { ok.disabled = !s.size; },
    });
    ok.addEventListener('click', once(() => {
      const v = others.find((x) => sel.has(x.id));
      if (!v) return;
      giver.given += 5;
      if (desert) {
        this.toast(`🏜️ ${v.name} fait la traversée du désert !`, 'bad');
        this.fx.shake();
        this.sound.bad();
        then();
        return;
      }
      if (v.camp === 'alcool') { v.taken += 5; this.toast(`🥃 ${v.name} : CUL SEC !`, 'bad'); }
      else { v.sabotaged += 5; v.gauge = 0; this.toast(`🔻 ${v.name} : jauge vidée !`, 'bad'); }
      this.fx.shake();
      this.sound.bad();
      this.renderScores('course');
      then();
    }));
    area.append(chips, h('div', { class: 'result-actions' }, ok));
  }

  courseTaff(area, p, gained, then) {
    area.replaceChildren(h('div', { class: 'result good' },
      h('p', { class: 'verdict', text: gained > 1 ? `${gained} TAFFS !` : 'TAFF !' }),
      h('p', { class: 'line', text: `🌿 ${p.name}, ta jauge est pleine` }),
      h('p', { class: 'sub', text: `Va fumer ! Jauge remise à ${p.gauge}/${this.gaugeMax}` })),
    h('div', { class: 'result-actions' }, h('button', { class: 'btn-primary pulse', text: '✓ C’EST FUMÉ →', onclick: once(then) })));
    this.sound.reward();
    this.fx.flash('rgba(126,224,122,.35)');
    this.fx.burstFrom(area, { colors: ['#7ee07a', '#d4ff5e', '#fff'], count: 90, power: 11 });
  }

  /** Fin des comptes : course suivante, cérémonie du Grand Prix, ralenti */
  courseAfter(area) {
    const g = this.game;
    const race = g.race;
    const btns = [];
    if (race.rec.length > 20) btns.push(h('button', { class: 'btn-ghost', text: '📸 REVOIR L’ARRIVÉE AU RALENTI', onclick: () => this.courseReplay() }));
    if (g.gp && g.count + 1 >= COURSE_GP) {
      btns.unshift(h('button', { class: 'btn-primary pulse', text: '🏆 CÉRÉMONIE DU GRAND PRIX', onclick: once(() => { g.count += 1; this.courseCeremony(); }) }));
    } else {
      btns.unshift(h('button', { class: 'btn-primary', text: g.gp ? `COURSE ${g.count + 2}/${COURSE_GP} →` : 'COURSE SUIVANTE →', onclick: once(() => { g.count += 1; this.courseTurn(); }) }));
      if (!g.gp) btns.push(h('button', { class: 'btn-ghost', text: '🏁 TERMINER ET VOIR LE CLASSEMENT', onclick: once(() => { g.count += 1; this.finish(); }) }));
    }
    area.replaceChildren(h('div', { class: 'result-actions' }, btns));
    g.turn = (g.count + 1) % g.players.length;
    this.renderScores('course');
  }

  /** Grand Prix : le roi de l'hippodrome et le gage du dernier */
  courseCeremony() {
    const g = this.game;
    const ranked = [...g.players].sort((a, b) => b.score - a.score || a.taken - b.taken);
    const king = ranked[0];
    const loser = ranked.length > 1 ? ranked[ranked.length - 1] : null;
    const lvl = COURSE_LEVELS[this.settings.courseStake] || COURSE_LEVELS.soiree;
    const gage = shuffle(lvl.flatMap((l) => COURSE_GAGES[l]))[0];
    const panel = $('#course-panel');
    const area = h('div', { class: 'course-area' });
    panel.replaceChildren(
      h('div', { class: 'cp-head' }, h('p', { class: 'turn-label pixel', text: '// fin du grand prix' }),
        h('p', { class: 'cp-title', text: `👑 ${king.emoji || ''} ${king.name}, roi de l’hippodrome` })),
      h('ul', { class: 'course-lines' },
        h('li', { class: 'good', style: { '--pc': king.color } }, h('span', { class: 'cl-main', text: `🏆 ${king.name} · ${king.score} pts` }),
          h('span', { class: 'cl-sub', text: king.camp === 'alcool' ? 'Offre un cul sec à la personne de son choix' : 'Gagne une taff de pompier 🌿' })),
        loser && loser !== king ? h('li', { class: 'gage', style: { '--pc': loser.color } }, h('span', { class: 'cl-main', text: `🎭 Gage final pour ${loser.name}` }), h('span', { class: 'cl-sub', text: gage })) : null),
      area);
    this.sound.reward();
    this.fx.confetti(['#f3c534', '#e0443c', '#2667e8', '#ffffff', '#1c9b4a']);
    haptic([60, 40, 120]);
    const end = () => area.replaceChildren(h('div', { class: 'result-actions' },
      h('button', { class: 'btn-primary', text: 'VOIR LE CLASSEMENT 🏆', onclick: once(() => this.finish()) })));
    if (king.camp === 'alcool') this.courseCulSec(area, king, end);
    else { king.taffs += 1; this.renderScores('course'); end(); }
  }

  /* ---------- Ralenti de l'arrivée ---------- */
  courseReplay() {
    const g = this.game;
    const race = g.race;
    if (race.state !== 'done' || race.rec.length < 2) return;
    race.final = race.runners.map((r) => [r.d, r.v, r.phase, r.off]);
    race.state = 'replay';
    // On démarre le ralenti ~22 m avant la ligne, quand tout le monde est encore à l'image
    const start = Math.max(0, race.rec.findIndex((f) => f.r.some((x) => x[0] >= COURSE_D - 22)));
    race.rp = start;
    race.rpT = race.rec[start].t;
    $('#course-overlay').replaceChildren();
    this.courseSay('Le ralenti de l’arrivée…', true);
    this.courseClick();
    $('#course-stage').scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'start' });
    this.courseRun();
  }

  courseReplayTick(dt) {
    const race = this.game.race;
    race.rpT += dt * 0.3;
    while (race.rp < race.rec.length - 1 && race.rec[race.rp + 1].t <= race.rpT) race.rp += 1;
    const fr = race.rec[race.rp];
    race.runners.forEach((r, i) => { [r.d, r.v, r.phase, r.off] = fr.r[i]; });
    if (race.rp >= race.rec.length - 1) {
      race.runners.forEach((r, i) => { [r.d, r.v, r.phase, r.off] = race.final[i]; });
      race.state = 'done';
      if (race.pod) { race.pod.style.animation = 'none'; $('#course-overlay').replaceChildren(race.pod); }
      const w = courseRank(race.runners)[0];
      this.courseSay(`${w.h.name} au poteau, cote ${courseCote(w.h.cote)}.`, true);
      this.courseDraw(0);
    }
  }

  /* ======================================================================
     DESSIN
     ====================================================================== */
  courseDraw(dt) {
    const g = this.game;
    const race = g && g.race;
    const cv = $('#course-cv');
    if (!race || !race.W || !cv) return;
    const ctx = cv.getContext('2d');
    ctx.save();
    ctx.setTransform(race.dpr, 0, 0, race.dpr, 0, 0);
    ctx.clearRect(0, 0, race.W, race.H);
    if (g.view === 'A') this.courseDrawSide(ctx, race, dt); else this.courseDrawTop(ctx, race, dt);
    if (race.state === 'countdown') {
      const n = Math.ceil(race.count);
      if (n >= 1) {
        const f = race.count - Math.floor(race.count);
        ctx.fillStyle = 'rgba(10,6,18,.5)'; ctx.fillRect(0, 0, race.W, race.H);
        ctx.globalAlpha = Math.min(1, f * 2.5);
        ctx.fillStyle = '#f3c534';
        ctx.font = `700 ${Math.round(100 + (1 - f) * 30)}px ${COURSE_FONT}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(n), race.W / 2, race.H / 2);
        ctx.globalAlpha = 1;
      }
    }
    if (race.state === 'replay') {
      ctx.fillStyle = 'rgba(214,52,44,.92)';
      ctx.beginPath(); ctx.roundRect(10, 44, 104, 22, 5); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `700 11px ${COURSE_FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText('● RALENTI ×0,3', 18, 55.5);
    }
    ctx.restore();
    if (race.state !== 'idle') this.courseUpdateBoard();
  }

  /** Une jambe en deux segments ; a1/a2 = angles depuis la verticale (positif = vers l'avant) */
  courseLeg(ctx, hx, hy, a1, a2, l1, l2, w, col) {
    const x1 = hx + Math.sin(a1) * l1, y1 = hy + Math.cos(a1) * l1;
    const x2 = x1 + Math.sin(a2) * l2, y2 = y1 + Math.cos(a2) * l2;
    ctx.strokeStyle = col; ctx.lineCap = 'round';
    ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.lineWidth = w * 0.62; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = '#1b1612'; ctx.lineWidth = w * 0.75;
    ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 + Math.sin(a2) * 3, y2 + Math.cos(a2) * 3); ctx.stroke();
  }

  /** Cheval + jockey de profil, en unités locales (≈ 113 de long), sabots à y = 0 */
  courseHorseSide(ctx, r, x, y, s) {
    const hs = r.h, sf = courseClamp(r.v / 11, 0, 1), ph = r.phase * Math.PI * 2;
    const bob = -sf * 2.4 * Math.sin(ph * 2 + 0.6);
    const far = courseShade(hs.coat, -0.35);
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(40,25,10,.28)';
    ctx.beginPath(); ctx.ellipse(0, 1.5, 38 * s, 5 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.scale(s, s);
    ctx.translate(0, bob); ctx.rotate(sf * 0.045 * Math.sin(ph + 1.2));
    const fore = (o) => { const a = sf * 0.6 * Math.sin(ph + o); return [a, a - sf * 1.5 * Math.max(0, Math.cos(ph + o))]; };
    const hind = (o) => { const a = -0.3 + sf * 0.55 * Math.sin(ph + o); return [a, a + 0.35 + sf * Math.max(0, Math.cos(ph + o))]; };
    let [a, b] = hind(0); this.courseLeg(ctx, -22, -50, a, b, 26, 24, 8, far);
    [a, b] = fore(2.6); this.courseLeg(ctx, 20, -48, a, b, 24, 25, 7, far);
    const tw = Math.sin(ph) * 3 * sf;
    ctx.strokeStyle = hs.mane; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-33, -63); ctx.quadraticCurveTo(-48 - sf * 6, -62 + tw - sf * 6, -56 - sf * 8, -42 + tw - sf * 10); ctx.stroke();
    ctx.fillStyle = hs.coat;
    ctx.beginPath(); ctx.ellipse(-20, -58, 16, 15, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, -57, 30, 13.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(20, -56, 14, 14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.translate(20, -62); ctx.rotate(sf * 0.07 * Math.sin(ph + 2.2)); ctx.translate(-20, 62);
    ctx.beginPath();
    ctx.moveTo(10, -66); ctx.quadraticCurveTo(28, -74, 38, -92);
    ctx.lineTo(48, -86); ctx.quadraticCurveTo(38, -68, 30, -50); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.translate(50, -80); ctx.rotate(0.72);
    ctx.beginPath(); ctx.ellipse(0, 0, 13, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = courseShade(hs.coat, -0.25); ctx.beginPath(); ctx.ellipse(10, 0, 4.5, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.fillStyle = hs.coat;
    ctx.beginPath(); ctx.moveTo(40, -90); ctx.lineTo(41, -99); ctx.lineTo(45, -90); ctx.fill();
    ctx.fillStyle = '#0d0a08'; ctx.beginPath(); ctx.arc(47, -84, 1.4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = hs.mane; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(39, -92); ctx.quadraticCurveTo(26, -76, 9, -68); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,.09)';
    ctx.beginPath(); ctx.ellipse(-4, -66, 26, 4, 0, 0, Math.PI * 2); ctx.fill();
    // tapis de selle avec le numéro
    ctx.fillStyle = hs.c1;
    ctx.beginPath(); ctx.roundRect(-10, -68, 22, 16, 3); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = hs.ink; ctx.font = `700 12px ${COURSE_FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(hs.n), 1, -59.5);
    [a, b] = hind(0.55); this.courseLeg(ctx, -20, -50, a, b, 26, 24, 8.5, hs.coat);
    [a, b] = fore(3.2); this.courseLeg(ctx, 22, -48, a, b, 24, 25, 7.5, hs.coat);
    // jockey : il compense le rebond et pousse avec les bras
    ctx.save(); ctx.translate(0, -bob * 0.55);
    const pump = sf * 2.2 * Math.sin(ph * 2);
    ctx.strokeStyle = '#f2efe8'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(0, -80); ctx.lineTo(14, -73); ctx.stroke();
    ctx.strokeStyle = '#151515'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(14, -73); ctx.lineTo(7, -64); ctx.stroke();
    ctx.save(); ctx.translate(6, -85); ctx.rotate(-0.18);
    ctx.fillStyle = hs.c1; ctx.beginPath(); ctx.ellipse(0, 0, 12, 6.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.clip(); ctx.fillStyle = hs.c2; ctx.fillRect(-3, -8, 5, 16); ctx.restore();
    if (hs.c1 === '#f4f4f0' || hs.c1 === '#1d1d1d') { ctx.strokeStyle = 'rgba(128,128,128,.5)'; ctx.lineWidth = 0.8; ctx.stroke(); }
    ctx.restore();
    ctx.strokeStyle = hs.c1; ctx.lineWidth = 4.5;
    ctx.beginPath(); ctx.moveTo(13, -88); ctx.lineTo(30 + pump, -78); ctx.stroke();
    ctx.strokeStyle = 'rgba(20,15,10,.8)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(31 + pump, -78); ctx.lineTo(55, -73 - bob * 0.4); ctx.stroke();
    ctx.fillStyle = '#e9b48f'; ctx.beginPath(); ctx.arc(23, -91, 4.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = hs.c2; ctx.beginPath(); ctx.arc(22, -93, 5.4, Math.PI, Math.PI * 2.05); ctx.fill();
    ctx.fillRect(22, -94.5, 9, 2.2);
    ctx.restore();
    ctx.restore();
  }

  /** Vue A : de profil, la caméra suit la tête de course */
  courseDrawSide(ctx, race, dt) {
    const W = race.W, H = race.H;
    const ppm = 24 * Math.min(1.4, W / 390);
    const rk = courseRank(race.runners), lead = rk[0];
    const idle = race.state === 'idle' || race.state === 'countdown';
    const minCam = -W * 0.36 / ppm;
    // La caméra suit la tête puis s'arrête avec la ligne d'arrivée aux 4/5 de l'écran
    const camT = idle ? minCam : Math.min(lead.d - W * 0.62 / ppm, COURSE_D - W * 0.8 / ppm);
    if (race.state === 'replay') race.camX = Math.max(camT, minCam);
    else race.camX += (Math.max(camT, minCam) - race.camX) * (dt ? Math.min(1, dt * 4) : 1);
    if (!dt && idle) race.camX = minCam;
    const camX = race.camX;
    const sx = (m) => (m - camX) * ppm;
    const yS0 = H * 0.07, yS1 = H * 0.2, railT = H * 0.235, yL0 = H * 0.255, yL1 = H * 0.93, railB = H * 0.948;
    // ciel
    let gr = ctx.createLinearGradient(0, 0, 0, yS0);
    gr.addColorStop(0, '#9fc4dc'); gr.addColorStop(1, '#d9e6e4');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, yS0 + 2);
    // tribunes en parallaxe, la foule saute pendant la course
    const px = camX * ppm * 0.45;
    ctx.fillStyle = '#3a3f46'; ctx.fillRect(0, yS0, W, yS1 - yS0);
    const crowd = ['#e0443c', '#f3c534', '#f4f4f0', '#2667e8', '#1c9b4a', '#e88d4a', '#8b3ae6', '#d9d0c0'];
    const cw = 6.5;
    const live = race.state === 'race' || race.state === 'finish';
    for (let row = 0; row < 4; row++) {
      const yy = yS0 + 10 + row * ((yS1 - yS0 - 12) / 4);
      const k0 = Math.floor(px / cw) - 1;
      for (let k = k0; k < k0 + W / cw + 3; k++) {
        const hv = courseHash(k * 7 + row * 131);
        if (hv < 0.12) continue;
        const jump = live && hv > 0.7 ? Math.max(0, Math.sin(race.t * 9 + k)) * 1.6 : 0;
        ctx.fillStyle = crowd[Math.floor(hv * 97) % crowd.length];
        ctx.beginPath(); ctx.arc(k * cw - px + (row % 2) * 3, yy - jump, 2.3, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.fillStyle = '#23272d'; ctx.fillRect(0, yS0, W, 5);
    for (let k = Math.floor(px / 140) - 1; k < (px + W) / 140 + 1; k++) ctx.fillRect(k * 140 - px, yS0, 3, yS1 - yS0);
    ctx.fillStyle = '#3f7a35'; ctx.fillRect(0, yS1, W, yL0 - yS1);
    ctx.fillStyle = '#2f6229'; ctx.fillRect(0, yS1, W, 4);
    // piste et traces dans le sable
    gr = ctx.createLinearGradient(0, yL0, 0, yL1);
    gr.addColorStop(0, '#c99d68'); gr.addColorStop(1, '#d9ae78');
    ctx.fillStyle = gr; ctx.fillRect(0, yL0 - 4, W, railB - yL0 + 6);
    const st = 0.55;
    for (let m = Math.floor(camX / st) * st; m < camX + W / ppm + 1; m += st) {
      const k = Math.round(m / st), hv = courseHash(k);
      ctx.fillStyle = hv > 0.5 ? 'rgba(120,80,40,.16)' : 'rgba(255,240,210,.18)';
      ctx.fillRect(sx(m), yL0 + hv * (yL1 - yL0), 4 + courseHash(k + 9) * 8, 1.5);
    }
    ctx.fillStyle = '#3f7a35'; ctx.fillRect(0, railB + 2, W, H - railB);
    const rails = (y) => {
      ctx.fillStyle = '#f5f3ec'; ctx.fillRect(0, y - 2, W, 3.5);
      for (let m = Math.floor(camX / 2.5) * 2.5; m < camX + W / ppm + 3; m += 2.5) ctx.fillRect(sx(m) - 1, y - 2, 2.5, 10);
    };
    rails(railT); rails(railB);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // poteaux de distance (mètres restants)
    for (let m = 50; m < COURSE_D; m += 50) {
      const x = sx(m);
      if (x < -30 || x > W + 30) continue;
      ctx.fillStyle = '#f5f3ec'; ctx.fillRect(x - 1.5, railT - 22, 3, 22);
      ctx.fillStyle = '#d6342c'; ctx.beginPath(); ctx.roundRect(x - 15, railT - 34, 30, 15, 3); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `700 10px ${COURSE_FONT}`; ctx.fillText(String(COURSE_D - m), x, railT - 26);
    }
    // stalles de départ
    const gx = sx(0.4);
    if (gx > -40 && gx < W + 40) {
      for (let i = 0; i <= 6; i++) { ctx.fillStyle = '#5c6670'; ctx.fillRect(gx - 4, yL0 + i * (yL1 - yL0) / 6 - 3, 8, 6); }
      ctx.fillStyle = 'rgba(92,102,112,.85)'; ctx.fillRect(gx - 2, yL0, 4, yL1 - yL0);
      if (idle) {
        ctx.fillStyle = 'rgba(210,214,218,.9)';
        for (let i = 0; i < 6; i++) ctx.fillRect(gx + 2, yL0 + i * (yL1 - yL0) / 6 + 4, 4, (yL1 - yL0) / 6 - 8);
      }
    }
    // poteau d'arrivée
    const fx = sx(COURSE_D);
    if (fx > -40 && fx < W + 60) {
      ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(fx - 2, yL0 - 4, 4, railB - yL0 + 4);
      ctx.fillStyle = '#f5f3ec'; ctx.fillRect(fx - 2, railT - 46, 4, 46);
      ctx.fillStyle = '#d6342c'; ctx.beginPath(); ctx.arc(fx, railT - 52, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `700 8px ${COURSE_FONT}`; ctx.fillText('ARR.', fx, railT - 52);
    }
    // poussière soulevée par les sabots
    const laneH = (yL1 - yL0) / 6, s = laneH * 1.5 / 100;
    if (!reducedMotion.matches && live && dt) {
      for (const r of race.runners) {
        if (r.v > 6 && Math.random() < (r.v / 17) * 0.55 * Math.min(1, dt * 60)) {
          race.dust.push({ x: r.d - 77 * s / ppm + (Math.random() - 0.5) * 0.6, y: yL0 + (r.i + 0.85) * laneH - 2, vy: -8 - Math.random() * 10, life: 1, rad: 2 + Math.random() * 2 });
        }
      }
    }
    if (dt) {
      for (const p of race.dust) { p.life -= dt * 1.25; p.y += p.vy * dt; p.vy *= 0.96; p.rad += dt * 9; p.x -= dt * 0.8; }
      race.dust = race.dust.filter((p) => p.life > 0);
    }
    for (const p of race.dust) { ctx.fillStyle = `rgba(232,205,160,${0.45 * p.life})`; ctx.beginPath(); ctx.arc(sx(p.x), p.y, p.rad, 0, Math.PI * 2); ctx.fill(); }
    // chevaux, du couloir du fond vers le devant
    for (const r of race.runners) {
      const base = yL0 + (r.i + 0.85) * laneH;
      const nose = sx(r.d);
      const x = nose - 57 * s;
      if (x > -70 * s && x < W + 70 * s) this.courseHorseSide(ctx, r, x, base, s);
      if (nose < 8 && !idle) {
        const ty = base - laneH * 0.62;
        ctx.fillStyle = 'rgba(10,6,18,.8)'; ctx.beginPath(); ctx.roundRect(4, ty, 76, 20, 10); ctx.fill();
        ctx.fillStyle = r.h.c1; ctx.beginPath(); ctx.arc(14, ty + 10, 6.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = r.h.ink; ctx.font = `700 9px ${COURSE_FONT}`; ctx.textAlign = 'center'; ctx.fillText(String(r.h.n), 14, ty + 10.5);
        ctx.fillStyle = '#f4ecd8'; ctx.textAlign = 'left'; ctx.font = `700 11px ${COURSE_FONT}`;
        ctx.fillText(`−${courseFmt(lead.d - r.d)} m`, 24, ty + 10.5);
        ctx.textAlign = 'center';
      }
    }
    this.courseMiniOval(ctx, race, W - 112, 6, 104, Math.min(58, yS1 - 10));
  }

  /** Mini-carte de l'ovale (vue A) : où en est le peloton */
  courseMiniOval(ctx, race, x, y, w, hgt) {
    ctx.fillStyle = 'rgba(10,6,18,.86)'; ctx.beginPath(); ctx.roundRect(x, y, w, hgt, 8); ctx.fill();
    ctx.fillStyle = '#356b2d'; ctx.beginPath(); ctx.roundRect(x + 4, y + 4, w - 8, hgt - 8, 6); ctx.fill();
    const cx = x + w / 2, cy = y + hgt / 2, R = (hgt - 20) / 2, a = Math.max(4, w / 2 - R - 10);
    ctx.strokeStyle = '#c99d68'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(cx - a, cy - R); ctx.lineTo(cx + a, cy - R); ctx.arc(cx + a, cy, R, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(cx - a, cy + R); ctx.arc(cx - a, cy, R, Math.PI / 2, Math.PI * 1.5); ctx.stroke();
    const P = 4 * a + 2 * Math.PI * R, s0 = a * 0.3;
    const pos = (u) => {
      let s = (((u % 1) + 1) % 1) * P;
      if (s < 2 * a) return [cx + a - s, cy + R];
      s -= 2 * a; if (s < Math.PI * R) { const th = s / R; return [cx - a - R * Math.sin(th), cy + R * Math.cos(th)]; }
      s -= Math.PI * R; if (s < 2 * a) return [cx - a + s, cy - R];
      s -= 2 * a; const th = s / R; return [cx + a + R * Math.sin(th), cy - R * Math.cos(th)];
    };
    const [fx, fy] = pos(s0 / P);
    ctx.fillStyle = '#fff'; ctx.fillRect(fx - 1, fy - 4, 2, 8);
    for (const r of courseRank(race.runners).reverse()) {
      const [px, py] = pos(s0 / P + Math.min(r.d, COURSE_D) / COURSE_D);
      ctx.fillStyle = r.h.c1; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(px, py, 3.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }

  /* ---------- Vue B : l'hippodrome vu du dessus ---------- */
  courseGeo(race) {
    const W = race.W, H = race.H;
    const laneW = 8 * Math.min(1.4, W / 390), trackW = laneW * 6 + 8;
    const cx = W * 0.44, R = Math.max(40, Math.min(W * 0.44 - trackW - 22, H / 2 - trackW - 48));
    const cy = H / 2, a = Math.max(20, H / 2 - R - trackW - 18);
    const P = 4 * a + 2 * Math.PI * R;
    return { laneW, trackW, cx, cy, R, a, P, u0: (a * 0.55) / P };
  }

  courseOval(geo, u, off) {
    const { cx, cy, R, a, P } = geo; const rr = R + off;
    let s = (((u % 1) + 1) % 1) * P;
    if (s < 2 * a) return [cx + rr, cy + a - s, -Math.PI / 2];
    s -= 2 * a; if (s < Math.PI * R) { const th = s / R; return [cx + rr * Math.cos(th), cy - a - rr * Math.sin(th), Math.atan2(-Math.cos(th), -Math.sin(th))]; }
    s -= Math.PI * R; if (s < 2 * a) return [cx - rr, cy - a + s, Math.PI / 2];
    s -= 2 * a; const th = s / R; return [cx - rr * Math.cos(th), cy + a + rr * Math.sin(th), Math.atan2(Math.cos(th), Math.sin(th))];
  }

  courseStadium(ctx, geo, rr) {
    const { cx, cy, a } = geo;
    ctx.beginPath(); ctx.moveTo(cx + rr, cy + a); ctx.lineTo(cx + rr, cy - a);
    ctx.arc(cx, cy - a, rr, 0, Math.PI, true); ctx.lineTo(cx - rr, cy + a);
    ctx.arc(cx, cy + a, rr, Math.PI, 0, true); ctx.closePath();
  }

  courseHorseTop(ctx, r, x, y, ang, k) {
    const hs = r.h, ph = r.phase * Math.PI * 2, sf = courseClamp(r.v / 11, 0, 1);
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(k, k);
    ctx.fillStyle = 'rgba(30,20,8,.28)'; ctx.beginPath(); ctx.ellipse(1.5, 2.5, 12, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = courseShade(hs.coat, -0.4); ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    const L = (bx, by, o) => { const f = Math.sin(ph + o) * 3.4 * sf; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + f + 1, by * 1.25); ctx.stroke(); };
    L(6, 3, 2.6); L(6, -3, 3.2); L(-6, 3, 0); L(-6, -3, 0.55);
    ctx.strokeStyle = hs.mane; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(-9, 0); ctx.quadraticCurveTo(-13, Math.sin(ph) * 1.6 * sf, -16 - sf * 2, Math.sin(ph + 1) * 2 * sf); ctx.stroke();
    ctx.fillStyle = hs.coat;
    ctx.beginPath(); ctx.ellipse(0, 0, 10, 4.6, 0, 0, Math.PI * 2); ctx.fill();
    const hx = 11 + Math.sin(ph * 2) * 0.9 * sf;
    ctx.beginPath(); ctx.ellipse(hx, 0, 5.5, 2.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = hs.mane; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(hx + 1, 0); ctx.stroke();
    ctx.fillStyle = hs.c1; ctx.beginPath(); ctx.ellipse(1, 0, 4, 3.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = hs.c2; ctx.fillRect(0, -3.6, 1.8, 7.2);
    ctx.beginPath(); ctx.arc(3.4, 0, 2.3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // numéro, toujours droit, pour ceux qui distinguent mal les couleurs
    const nx = x + Math.cos(ang - Math.PI / 2) * 11 * k, ny = y + Math.sin(ang - Math.PI / 2) * 11 * k;
    ctx.fillStyle = hs.c1; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(nx, ny, 5.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = hs.ink; ctx.font = `700 8px ${COURSE_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(hs.n), nx, ny + 0.5);
  }

  courseDrawTop(ctx, race, dt) {
    const W = race.W, H = race.H;
    race.geo = race.geo || this.courseGeo(race);
    const geo = race.geo;
    const { laneW, trackW, cx, cy, R, a, u0 } = geo;
    for (let y = 0; y < H; y += 22) { ctx.fillStyle = (y / 22) % 2 ? '#3e7834' : '#447f39'; ctx.fillRect(0, y, W, 22); }
    // tribune le long de la ligne d'arrivée
    const tx = cx + R + trackW + 10;
    ctx.fillStyle = '#3a3f46'; ctx.beginPath(); ctx.roundRect(tx, cy - a * 0.2, W - tx - 8, a * 1.15, 4); ctx.fill();
    const crowd = ['#e0443c', '#f3c534', '#f4f4f0', '#2667e8', '#1c9b4a', '#e88d4a'];
    for (let yy = cy - a * 0.2 + 6; yy < cy + a * 0.95 - 4; yy += 6) {
      for (let xx = tx + 5; xx < W - 12; xx += 6) {
        const hv = courseHash(xx * 3.1 + yy * 7.7);
        if (hv < 0.15) continue;
        ctx.fillStyle = crowd[Math.floor(hv * 50) % crowd.length]; ctx.beginPath(); ctx.arc(xx, yy, 1.8, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.fillStyle = '#23272d'; ctx.fillRect(W - 14, cy - a * 0.2, 6, a * 1.15);
    // piste, couloirs, lisses
    ctx.strokeStyle = '#cfa16b'; ctx.lineWidth = trackW; this.courseStadium(ctx, geo, R + trackW / 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,240,210,.12)'; ctx.lineWidth = 1; ctx.setLineDash([3, 7]);
    for (let i = 1; i < 6; i++) { this.courseStadium(ctx, geo, R + 4 + i * laneW); ctx.stroke(); }
    ctx.setLineDash([]);
    ctx.strokeStyle = '#f5f3ec'; ctx.lineWidth = 2; this.courseStadium(ctx, geo, R); ctx.stroke();
    ctx.lineWidth = 2.5; this.courseStadium(ctx, geo, R + trackW); ctx.stroke();
    // pelouse intérieure, étang, massifs
    ctx.fillStyle = '#356b2d'; this.courseStadium(ctx, geo, R - 1.5); ctx.fill();
    ctx.fillStyle = '#4f8fb0'; ctx.beginPath(); ctx.ellipse(cx - R * 0.15, cy + a * 0.25, R * 0.42, R * 0.24, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.ellipse(cx - R * 0.22, cy + a * 0.2, R * 0.18, R * 0.06, -0.3, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 9; i++) {
      const an = i * 0.7 + 0.4, rr = R * (0.45 + courseHash(i) * 0.35);
      const px = cx + Math.cos(an) * rr * 0.75, py = cy - a * 0.6 + Math.sin(an) * rr * 0.5 + (i % 3) * a * 0.12;
      ctx.fillStyle = '#285622'; ctx.beginPath(); ctx.arc(px, py, 6 + courseHash(i + 3) * 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.beginPath(); ctx.arc(px - 2, py - 2, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.save(); ctx.translate(cx + R * 0.35, cy - a * 0.45); ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.font = `700 22px ${COURSE_FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('HIPPODROME', 0, 0); ctx.restore();
    // ligne d'arrivée en damier
    const [fx, fy] = this.courseOval(geo, u0, 0);
    for (let i = 0; i < Math.ceil(trackW / 4); i++) {
      for (let j = 0; j < 2; j++) { ctx.fillStyle = (i + j) % 2 ? '#111' : '#fff'; ctx.fillRect(fx + i * 4, fy - 4 + j * 4, 4, 4); }
    }
    ctx.fillStyle = '#d6342c'; ctx.beginPath(); ctx.arc(fx + trackW + 4, fy, 6, 0, Math.PI * 2); ctx.fill();
    // couloirs qui se resserrent vers la corde, et on évite le cheval devant
    const order = courseRank(race.runners);
    const prog0 = Math.min(1, (order[0].d / COURSE_D) / 0.25);
    if (dt && race.state !== 'replay') {
      for (const r of order) {
        let want = laneW * 0.65 + r.i * laneW * (1 - 0.75 * prog0);
        for (const o of order) {
          if (o === r) continue;
          const dd = o.d - r.d;
          if (dd > -0.5 && dd < 3.4 && Math.abs(o.off - want) < laneW * 0.95) want = o.off + laneW;
        }
        want = courseClamp(want, laneW * 0.6, trackW - laneW * 0.6);
        r.off += (want - r.off) * Math.min(1, dt * 1.6 * Math.max(race.ts, 0.3));
      }
    } else if (race.state === 'idle') {
      race.runners.forEach((r) => { r.off = laneW * 0.65 + r.i * laneW; });
    }
    const k = Math.min(1.5, W / 390 * 1.2);
    const idle = race.state === 'idle' || race.state === 'countdown';
    for (const r of order.slice().reverse()) {
      const [x, y, ang] = this.courseOval(geo, u0 + r.d / COURSE_D, r.off);
      if (r === order[0] && !idle) {
        ctx.strokeStyle = 'rgba(243,197,52,.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 14 * k, 0, Math.PI * 2); ctx.stroke();
      }
      this.courseHorseTop(ctx, r, x, y, ang, k);
    }
  }

  /* ======================================================================
     SONS (générés en WebAudio : aucun fichier à télécharger)
     ====================================================================== */
  courseNoiseBuf() {
    const s = this.sound;
    if (!s.ctx) return null;
    if (!this._courseNoise) {
      const len = s.ctx.sampleRate * 2;
      const buf = s.ctx.createBuffer(1, len, s.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this._courseNoise = buf;
    }
    return this._courseNoise;
  }

  /** Un sabot qui frappe le sable */
  courseThud(vol) {
    const s = this.sound;
    if (!s.ready) return;
    const c = s.ctx, t = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = this.courseNoiseBuf();
    const f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 160 + Math.random() * 140;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol * 1.6, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    src.connect(f); f.connect(g); g.connect(s.master);
    src.start(t, Math.random() * 1.5, 0.1);
  }

  /** La foule : un souffle continu dont on règle le volume */
  courseCrowd(level, stop = false) {
    const s = this.sound;
    if (!s.ctx) return;
    const c = s.ctx, t = c.currentTime;
    if (stop || !s.enabled) {
      if (this._crowd) {
        const cr = this._crowd; this._crowd = null;
        cr.g.gain.setTargetAtTime(0.0001, t, 0.25);
        setTimeout(() => { try { cr.src.stop(); } catch (e) { /* déjà arrêté */ } }, 1200);
      }
      return;
    }
    if (!s.ready) return;
    if (!this._crowd) {
      const src = c.createBufferSource();
      src.buffer = this.courseNoiseBuf(); src.loop = true;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 950; f.Q.value = 0.5;
      const f2 = c.createBiquadFilter(); f2.type = 'lowshelf'; f2.frequency.value = 300; f2.gain.value = 6;
      const g = c.createGain(); g.gain.value = 0.0001;
      src.connect(f); f.connect(f2); f2.connect(g); g.connect(s.master);
      src.start();
      this._crowd = { src, g, f, level: 0 };
    }
    if (Math.abs(this._crowd.level - level) < 0.005) return;
    this._crowd.level = level;
    this._crowd.g.gain.setTargetAtTime(Math.max(0.0001, level), t, 0.35);
    this._crowd.f.frequency.setTargetAtTime(800 + level * 2500, t, 0.4);
  }

  /** La cloche électrique des hippodromes (« dring ») */
  courseBell(dur = 1.2) {
    const s = this.sound;
    if (!s.ready) return;
    const c = s.ctx, t = c.currentTime;
    const out = c.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
    out.gain.setValueAtTime(0.22, t + dur - 0.15);
    out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const am = c.createGain(); am.gain.value = 0.5;
    const lfo = c.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 26;
    const lfoG = c.createGain(); lfoG.gain.value = 0.5;
    lfo.connect(lfoG); lfoG.connect(am.gain);
    [2350, 3530, 4710].forEach((fq, i) => {
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = fq;
      const og = c.createGain(); og.gain.value = [1, 0.5, 0.25][i];
      o.connect(og); og.connect(am); o.start(t); o.stop(t + dur + 0.05);
    });
    am.connect(out); out.connect(s.master);
    lfo.start(t); lfo.stop(t + dur + 0.05);
  }

  /** Petite fanfare de trompette à l'arrivée */
  courseFanfare() {
    const s = this.sound;
    if (!s.ready) return;
    const c = s.ctx;
    const notes = [[392, 0, 0.14], [523, 0.15, 0.14], [659, 0.3, 0.14], [784, 0.45, 0.5], [659, 0.98, 0.14], [784, 1.13, 0.7]];
    notes.forEach(([fq, at, dur]) => {
      const t = c.currentTime + 0.25 + at;
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fq;
      const o2 = c.createOscillator(); o2.type = 'square'; o2.frequency.value = fq * 1.004;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.linearRampToValueAtTime(2600, t + 0.06);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.09, t + 0.03);
      g.gain.setValueAtTime(0.09, t + dur - 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08);
      o.connect(f); o2.connect(f); f.connect(g); g.connect(s.master);
      o.start(t); o2.start(t); o.stop(t + dur + 0.1); o2.stop(t + dur + 0.1);
    });
  }

  /** Déclic d'appareil photo (photo-finish) */
  courseClick() {
    const s = this.sound;
    if (!s.ready) return;
    const c = s.ctx, t = c.currentTime;
    [0, 0.07].forEach((at) => {
      const src = c.createBufferSource(); src.buffer = this.courseNoiseBuf();
      const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t + at);
      g.gain.exponentialRampToValueAtTime(0.35, t + at + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, t + at + 0.04);
      src.connect(f); f.connect(g); g.connect(s.master);
      src.start(t + at, Math.random(), 0.06);
    });
  }

  /** Tiroir-caisse : les gains tombent */
  courseCash() {
    const s = this.sound;
    s.tone(1568, 0.09, { type: 'square', vol: 0.07 });
    s.tone(2093, 0.12, { type: 'square', vol: 0.07, at: 0.08 });
    s.tone(2637, 0.4, { type: 'triangle', vol: 0.12, at: 0.16 });
    s.tone(3136, 0.5, { type: 'sine', vol: 0.08, at: 0.2 });
  }
});
