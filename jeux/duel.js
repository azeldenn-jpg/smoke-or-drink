/**
 * SMOKE OR DRINK — Le Duel au saloon
 * ------------------------------------------------------------------------------
 *  Le téléphone est posé à plat entre deux joueurs, chacun son côté de l'écran
 *  (le haut est retourné). Les deux tapent « prêt », la tension monte, puis
 *  « FEU ! » : le premier qui tape gagne. Tirer trop tôt, ou sur un faux mot
 *  (FEUILLE, FÊTE…), c'est perdre. Temps de réaction affiché en millisecondes.
 *  Formats : tournoi (le champion distribue) ou duels libres.
 * ------------------------------------------------------------------------------
 */
'use strict';

const DUEL_TRAPS = ['FEUILLE', 'FÊTE', 'FEMME', 'FERME', 'FEUTRE', 'FENÊTRE', 'FÉE', 'FEUX ROUGES', 'FAUX', 'FONCE… PAS', 'FEU… ILLETÉ', 'FEUILLETON'];
const DUEL_LOSE = 2;       // gorgées pour le perdant
const DUEL_FAUL = 3;       // gorgées pour un faux départ
const DUEL_OPTS = {
  mode: [
    { id: 'tournoi', emoji: '🏆', label: 'Tournoi', small: 'élimination · le champion distribue' },
    { id: 'libre', emoji: '🔁', label: 'Duels libres', small: 'au hasard, sans fin' },
  ],
  traps: [
    { id: 'on', emoji: '🪤', label: 'Avec pièges', small: 'FEUILLE, FÊTE… ne tire pas !' },
    { id: 'off', emoji: '🎯', label: 'Sans pièges', small: 'réflexes purs' },
  ],
};

GAME_HOOKS.duel = {
  screen: 'duel',
  start() { this.duelStart(); },
  setup() { this.renderDuelOptions(); },
  info(mix) {
    const n = this.players.length;
    return this.settings.duelMode === 'libre' ? `// duels au hasard · perdant ${DUEL_LOSE} 🥃 · faux départ ${DUEL_FAUL} 🥃${mix}` : `// tournoi à ${n} · ${Math.max(1, n - 1)} duels · perdant ${DUEL_LOSE} 🥃${mix}`;
  },
  stop() { this.duelStop(); },
  score: {
    title() { return 'Victoires · meilleur temps'; },
    line(p) {
      return { v: `${p.score}|${p.taken}`, main: plural(p.score, 'victoire'), small: ` · ${p.best ? `${p.best} ms` : '—'} · ${p.taken} ${this.campOf(p) === 'alcool' ? '🥃' : '🌿'}` };
    },
    key(p) { return p.score * 10000 - (p.best || 9999); },
  },
  end: {
    kicker() { return '// duel au saloon'; },
    crown: 'La gâchette la plus rapide',
    key(p) { return p.score * 10000 - (p.best || 9999); },
    line(p) {
      return { main: plural(p.score, 'victoire'), sub: `${p.best ? `⚡ ${p.best} ms` : 'pas de victoire'} · ${p.taken} ${this.campOf(p) === 'alcool' ? 'gorgées bues' : 'taffs prises'}${p.fauls ? ` · ${plural(p.fauls, 'faux départ')}` : ''}` };
    },
  },
};

addGame(class {
  renderDuelOptions() {
    const grid = (id, opts, key, def) => $(id).replaceChildren(...opts.map((o) => this.pill({
      on: (this.settings[key] || def) === o.id, emoji: o.emoji, label: o.label, small: o.small,
      onClick: () => { this.settings[key] = o.id; this.save(); this.renderDuelOptions(); this.validateSetup(); },
    })));
    grid('#duelmode-grid', DUEL_OPTS.mode, 'duelMode', 'tournoi');
    grid('#dueltraps-grid', DUEL_OPTS.traps, 'duelTraps', 'on');
  }

  duelStart() {
    const g = this.game;
    g.mode = this.settings.duelMode === 'libre' ? 'libre' : 'tournoi';
    g.traps = this.settings.duelTraps !== 'off';
    g.players.forEach((p) => { p.best = 0; p.fauls = 0; });
    if (g.mode === 'tournoi') this.duelNewRound(shuffle(g.players.map((_, i) => i)), 1);
    if (!this._duelBound) {
      this._duelBound = true;
      ['top', 'bottom'].forEach((side) => {
        $(`#duel-${side}`).addEventListener('pointerdown', (e) => { e.preventDefault(); this.duelTap(side); });
      });
    }
    this.duelTurn();
  }

  /** Prépare un tour du tournoi : paires au hasard, un exempt si le nombre est impair */
  duelNewRound(ids, no) {
    const g = this.game;
    const matches = [];
    for (let i = 0; i + 1 < ids.length; i += 2) matches.push([ids[i], ids[i + 1]]);
    g.bracket = { no, matches, idx: 0, winners: [], bye: ids.length % 2 ? ids[ids.length - 1] : null };
  }

  duelRoundName() {
    const b = this.game.bracket;
    const n = b.matches.length * 2 + (b.bye !== null ? 1 : 0);
    if (b.matches.length === 1 && b.bye === null) return 'FINALE';
    if (n <= 4) return 'DEMI-FINALE';
    if (n <= 8) return 'QUARTS';
    return `TOUR ${b.no}`;
  }

  /** Un duel : choix des deux tireurs, puis attente des « prêt » */
  duelTurn() {
    this.beginTurn('duelTurn');
    this.duelStop();
    const g = this.game;
    let a, b;
    if (g.mode === 'tournoi') {
      [a, b] = g.bracket.matches[g.bracket.idx];
      $('#duel-round').textContent = `${this.duelRoundName()} · ${g.bracket.idx + 1}/${g.bracket.matches.length}`;
    } else {
      const ids = g.players.map((_, i) => i);
      let pair;
      do { pair = shuffle(ids).slice(0, 2); } while (g.lastPair && g.players.length > 2 && pair.every((x) => g.lastPair.includes(x)));
      [a, b] = pair;
      g.lastPair = pair;
      $('#duel-round').textContent = `DUEL ${g.count + 1}`;
    }
    g.turn = a;
    g.duel = { a, b, state: 'ready', ready: { top: false, bottom: false }, fireAt: 0, timers: [], times: {} };
    this.duelSide('top', g.players[b], 'Tape ici quand tu es prêt', 'ready');
    this.duelSide('bottom', g.players[a], 'Tape ici quand tu es prêt', 'ready');
    this.duelMid(h('p', { class: 'dm-vs', text: '🤠 VS 🤠' }), h('p', { class: 'dm-hint pixel', text: '// téléphone à plat, face à face' }));
    this.renderScores('duel');
  }

  duelSide(side, p, msg, cls, big = false) {
    const el = $(`#duel-${side}`);
    el.className = `duel-side ${side} is-${cls}`;
    el.style.setProperty('--pc', p.color);
    el.replaceChildren(
      h('p', { class: 'ds-name' }, p.emoji ? `${p.emoji} ` : '', p.name),
      h('p', { class: `ds-msg${big ? ' big' : ''}`, text: msg }));
  }

  duelSideMsg(side, msg, cls, big = false) {
    const el = $(`#duel-${side}`);
    el.className = `duel-side ${side} is-${cls}`;
    const m = $('.ds-msg', el);
    m.textContent = msg;
    m.classList.toggle('big', big);
  }

  duelMid(...nodes) { $('#duel-mid').replaceChildren(...nodes.filter(Boolean)); }

  duelStop() {
    const g = this.game;
    if (g && g.duel) { g.duel.timers.forEach((t) => clearTimeout(t)); g.duel.timers = []; }
  }

  duelLater(fn, ms) {
    const g = this.game;
    const d = g.duel;
    d.timers.push(setTimeout(() => { if (this.game === g && g.duel === d && !g.over) fn(); }, ms));
  }

  /** Les deux tapent « prêt », puis la tension monte */
  duelTap(side) {
    const g = this.game;
    if (!g || g.over || !g.duel) return;
    const d = g.duel;
    const pi = side === 'bottom' ? d.a : d.b;
    const other = side === 'bottom' ? 'top' : 'bottom';
    if (d.state === 'ready') {
      if (d.ready[side]) return;
      d.ready[side] = true;
      haptic(15);
      this.sound.tick(0.5);
      this.duelSideMsg(side, 'PRÊT ✓', 'armed');
      if (d.ready[other]) this.duelArm();
      return;
    }
    if (d.state === 'wait') { this.duelFoul(pi, side); return; }
    if (d.state === 'fire') {
      const ms = Math.round(performance.now() - d.fireAt);
      if (d.times[side] !== undefined) return;
      d.times[side] = ms;
      haptic(40);
      if (Object.keys(d.times).length === 1 && !d.won) this.duelWin(pi, side, ms);
      else if (d.won) this.duelSideMsg(side, `💀 ${ms} ms · ${this.sanctionLabel(g.players[pi], DUEL_LOSE)}`, 'lose');
    }
  }

  /** Attente aléatoire, battements de cœur, faux mots, puis FEU */
  duelArm() {
    const g = this.game;
    const d = g.duel;
    d.state = 'wait';
    ['top', 'bottom'].forEach((s) => this.duelSideMsg(s, 'Attends…', 'wait'));
    this.duelMid(h('p', { class: 'dm-cactus', text: '🌵' }));
    const total = 2600 + Math.random() * 4200;
    // battements de cœur qui accélèrent
    let t = 0, gap = 900;
    while (t < total - 200) { const at = t; this.duelLater(() => { this.partyThump(55, 0.45); this.partyThump(50, 0.3, 0.16); }, at); t += gap; gap = Math.max(380, gap * 0.86); }
    // faux mots : la tentation
    if (g.traps) {
      const n = Math.random() < 0.75 ? randInt(1, 2) : 0;
      const words = shuffle(DUEL_TRAPS).slice(0, n);
      words.forEach((w, k) => {
        const at = (total * (k + 1)) / (n + 1.4);
        this.duelLater(() => {
          if (d.state !== 'wait') return;
          ['top', 'bottom'].forEach((s) => this.duelSideMsg(s, w, 'trap', true));
          this.sound.tone(520, 0.08, { type: 'square', vol: 0.05 });
        }, at);
        this.duelLater(() => { if (d.state === 'wait') ['top', 'bottom'].forEach((s) => this.duelSideMsg(s, 'Attends…', 'wait')); }, at + 650);
      });
    }
    this.duelLater(() => this.duelFire(), total);
  }

  duelFire() {
    const g = this.game;
    const d = g.duel;
    if (d.state !== 'wait') return;
    d.state = 'fire';
    d.fireAt = performance.now();
    ['top', 'bottom'].forEach((s) => this.duelSideMsg(s, 'FEU !', 'fire', true));
    this.duelMid(h('p', { class: 'dm-bang', text: '💥' }));
    this.partyBang();
    // personne ne tire : les deux boivent
    this.duelLater(() => {
      if (d.state !== 'fire') return;
      d.state = 'done';
      const A = g.players[d.a], B = g.players[d.b];
      const lines = [this.sanction(A, DUEL_LOSE), this.sanction(B, DUEL_LOSE)];
      ['top', 'bottom'].forEach((s) => this.duelSideMsg(s, '😴 Personne n’a tiré', 'lose'));
      this.duelResult(null, null, lines, 'Personne n’a tiré : les deux trinquent');
    }, 4000);
  }

  duelFoul(pi, side) {
    const g = this.game;
    const d = g.duel;
    d.state = 'done';
    this.duelStop();
    const loser = g.players[pi];
    const wi = pi === d.a ? d.b : d.a;
    const winner = g.players[wi];
    loser.fauls = (loser.fauls || 0) + 1;
    winner.score += 1;
    const other = side === 'bottom' ? 'top' : 'bottom';
    this.duelSideMsg(side, `🚫 FAUX DÉPART ! ${this.sanctionLabel(loser, DUEL_FAUL)}`, 'lose');
    this.duelSideMsg(other, '🏆 GAGNÉ, il a tiré trop tôt', 'win');
    this.sound.bad();
    this.fx.shake();
    haptic([60, 40, 60]);
    this.duelResult(wi, pi, [this.sanction(loser, DUEL_FAUL)], `Faux départ de ${loser.name} !`);
  }

  duelWin(wi, side, ms) {
    const g = this.game;
    const d = g.duel;
    d.won = true;
    this.duelStop();
    this.duelLater(() => { d.state = 'done'; }, 1500);
    const li = wi === d.a ? d.b : d.a;
    const winner = g.players[wi], loser = g.players[li];
    winner.score += 1;
    winner.best = winner.best ? Math.min(winner.best, ms) : ms;
    const other = side === 'bottom' ? 'top' : 'bottom';
    this.duelSideMsg(side, `🏆 ${ms} ms`, 'win', true);
    this.duelSideMsg(other, `💀 Trop lent · ${this.sanctionLabel(loser, DUEL_LOSE)}`, 'lose');
    this.sound.reward();
    this.duelResult(wi, li, [this.sanction(loser, DUEL_LOSE)], `${winner.name} dégaine en ${ms} ms !`);
  }

  /** Après le duel : bilan au centre et suite (duel suivant, tour suivant, champion) */
  duelResult(wi, li, lines, title) {
    const g = this.game;
    this.renderScores('duel');
    let next, label;
    if (g.mode === 'tournoi') {
      const b = g.bracket;
      const advance = wi !== null ? wi : g.duel[Math.random() < 0.5 ? 'a' : 'b'];
      label = b.idx + 1 < b.matches.length ? 'DUEL SUIVANT →' : 'TOUR SUIVANT →';
      next = () => {
        b.winners.push(advance);
        b.idx += 1;
        g.count += 1;
        if (b.idx < b.matches.length) { this.duelTurn(); return; }
        const ids = b.bye !== null ? [...b.winners, b.bye] : b.winners;
        if (ids.length <= 1) { this.duelChampion(ids[0]); return; }
        this.duelNewRound(shuffle(ids), b.no + 1);
        this.duelTurn();
      };
      if (b.idx + 1 >= b.matches.length && (b.winners.length + 1 + (b.bye !== null ? 1 : 0)) <= 1) label = '🏆 LE CHAMPION →';
      if (wi === null) lines.push('Personne n’a tiré : on tire au sort qui passe au tour suivant.');
    } else {
      label = 'DUEL SUIVANT →';
      next = () => { g.count += 1; this.duelTurn(); };
    }
    this.duelMid(
      h('p', { class: 'dm-title', text: title }),
      h('p', { class: 'dm-lines', text: lines.join(' · ') }),
      h('button', { class: 'btn-primary dm-next', text: label, onclick: once(next) }));
  }

  /** Fin du tournoi : le champion distribue */
  duelChampion(ci) {
    const g = this.game;
    const champ = g.players[ci];
    g.turn = ci;
    const n = g.players.length;
    this.fx.confetti(['#ffcf3f', '#ff5e3a', '#ffffff', '#7ee07a']);
    this.sound.reward();
    const area = h('div', { class: 'dm-champ' });
    this.duelMid(h('p', { class: 'dm-title', text: `👑 ${champ.emoji || ''} ${champ.name}, gâchette d’or !` }), area);
    const end = () => area.replaceChildren(h('button', { class: 'btn-primary dm-next', text: 'VOIR LE CLASSEMENT 🏆', onclick: once(() => this.finish()) }));
    // Le champion désigne sa victime : n gorgées (ou l'équivalent en taffs pour un fumeur)
    const others = g.players.filter((x) => x.id !== champ.id);
    const ok = h('button', { class: 'btn-primary dm-next', text: 'CHOISIS TA VICTIME', disabled: true });
    const chips = h('div', { class: 'chips' });
    const sel = this.renderChips(chips, others, {
      labelOf: (t) => h('span', { class: 'chip-main' }, t.name, h('small', { text: this.sanctionLabel(t, n) })),
      onChange: (st) => { ok.disabled = !st.size; ok.textContent = st.size ? 'TIRER !' : 'CHOISIS TA VICTIME'; },
    });
    ok.addEventListener('click', once(() => {
      const v = others.find((x) => sel.has(x.id));
      if (!v) return;
      this.toast(this.sanction(v, n), 'bad');
      this.partyBang();
      this.renderScores('duel');
      end();
    }));
    area.append(h('p', { class: 'dm-lines', text: `Le champion désigne qui prend ${plural(n, 'gorgée')} (taffs pour un fumeur)` }), chips, ok);
    this.renderScores('duel');
  }
});
