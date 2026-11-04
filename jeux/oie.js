/**
 * SMOKE OR DRINK — Jeu de l'oie (format téléphone)
 * ------------------------------------------------------------------------------
 * - Plateau de 63 cases qui serpente de bas en haut ; la "caméra" suit le pion.
 * - Deux dés ; il faut tomber pile sur 63 (sinon on rebondit en arrière).
 * - Cases classiques : oie (on rejoue son lancer), pont, auberge, puits,
 *   labyrinthe, prison, tête de mort. Les autres cases lancent des mini-jeux.
 * - Chaque effet s'adapte au camp du joueur (comme le Mashup) :
 *     malus  → buveur : il boit · fumeur : sa jauge descend
 *     bonus  → buveur : il distribue · fumeur : il garde (jauge) ou balance
 *   5 points de jauge = une taff.
 * ------------------------------------------------------------------------------
 */
'use strict';

const OIE = {
  LAST: 63,
  COLS: 5,
  CELL_TYPES: {
    depart:     { icon: '🏁', name: 'Départ',          color: '#f4ecd8' },
    finish:     { icon: '🏆', name: 'Arrivée',         color: '#ffc857' },
    oie:        { icon: '🦢', name: 'Oie',             color: '#f4ecd8', text: 'Tu avances encore du même nombre !' },
    pont:       { icon: '🌉', name: 'Le pont',         color: '#6dc7e8', text: 'Tu traverses directement jusqu’à la case 12.' },
    auberge:    { icon: '🍻', name: 'L’auberge',       color: '#ffc857', text: 'Petite pause : tu passes ton prochain tour.' },
    puits:      { icon: '🕳️', name: 'Le puits',        color: '#a667d4', text: 'Tu es coincé au fond : 2 tours sans jouer.' },
    labyrinthe: { icon: '🌀', name: 'Le labyrinthe',   color: '#5ec8ff', text: 'Tu te perds… retour à la case 30.' },
    prison:     { icon: '⛓️', name: 'La prison',       color: '#9ca3af', text: 'Enfermé : 2 tours sans jouer.' },
    mort:       { icon: '💀', name: 'La tête de mort', color: '#ff5e7e', text: 'Retour au départ… et une pénalité en prime.' },
    calm:       { icon: '',   name: 'Case tranquille', color: 'rgba(244,236,216,.3)' },
    malus:      { icon: '😬', name: 'Pas de chance',   color: '#ff8855' },
    cadeau:     { icon: '🎁', name: 'Cadeau',          color: '#7ee07a' },
    tous:       { icon: '🍾', name: 'Tournée générale', color: '#ffa845' },
    avance:     { icon: '⏩', name: 'Raccourci',       color: '#7ee0b8', text: 'Tu avances de 3 cases.' },
    recule:     { icon: '⏪', name: 'Glissade',        color: '#ff8855', text: 'Tu recules de 3 cases.' },
    echange:    { icon: '🔄', name: 'Échange',         color: '#5ec8ff', text: 'Choisis un joueur : vous échangez vos places.' },
    quiz:       { icon: '🧠', name: 'Question',        color: '#a667d4' },
    jamais:     { icon: '🙊', name: "Je n'ai jamais",  color: '#e85a8c' },
    probable:   { icon: '👉', name: 'Qui pourrait…',   color: '#ffc857' },
    theme:      { icon: '💬', name: 'Trois en cinq',   color: '#6dc7e8' },
    duel:       { icon: '⚔️', name: 'Duel',            color: '#ff5e7e' },
  },
  SPECIAL: { 6: 'pont', 19: 'auberge', 31: 'puits', 42: 'labyrinthe', 52: 'prison', 58: 'mort' },
  GEESE: [9, 18, 27, 36, 45, 54],
  // Les autres cases reçoivent ces événements dans cet ordre (le plateau est toujours le même)
  CYCLE: ['quiz', 'calm', 'jamais', 'malus', 'theme', 'cadeau', 'calm', 'quiz', 'probable', 'duel', 'calm', 'avance',
    'quiz', 'tous', 'jamais', 'calm', 'recule', 'echange', 'theme', 'quiz', 'calm', 'probable', 'malus', 'cadeau'],
};

function buildOieBoard() {
  const board = [];
  let k = 0;
  for (let i = 0; i <= OIE.LAST; i++) {
    let type;
    if (i === 0) type = 'depart';
    else if (i === OIE.LAST) type = 'finish';
    else if (OIE.SPECIAL[i]) type = OIE.SPECIAL[i];
    else if (OIE.GEESE.includes(i)) type = 'oie';
    else { type = OIE.CYCLE[k % OIE.CYCLE.length]; k += 1; }
    board.push(type);
  }
  return board;
}

addGame(class {
  /* ---------------------------------------------------------------------- */
  /* DÉMARRAGE & PLATEAU                                                     */
  /* ---------------------------------------------------------------------- */
  oieStart() {
    const g = this.game;
    g.board = buildOieBoard();
    g.busy = false;
    g.quiz = new Deck(this.data.quiz);
    g.jamais = new Deck(this.data.jamais);
    g.probable = new Deck(this.data.probable);
    g.themes = new Deck(this.data.bombe);
    this.oieBuildBoard();
    this.oieTurn();
    // L'écran n'est visible qu'après la transition : on recadre la caméra à ce moment-là
    this.later(() => { if (g.players.length && !g.busy) { this.oieBuildBoard(); this.oieCamera(g.players[g.turn].pos, false); } }, 420);
  }

  /** Coordonnées (en px) du centre d'une case : serpent de bas en haut */
  oieXY(i) {
    const g = this.game;
    const { COLS } = OIE;
    const r = Math.floor(i / COLS);
    let c = i % COLS;
    if (r % 2 === 1) c = COLS - 1 - c;
    return { x: g.pad + c * g.colW + g.colW / 2, y: g.boardH - (g.pad + r * g.rowH + g.rowH / 2) };
  }

  oieBuildBoard() {
    const g = this.game;
    const boardEl = $('#oie-board');
    const width = $('#oie-viewport').clientWidth || Math.min(window.innerWidth - 36, 524);
    const rows = Math.ceil((OIE.LAST + 1) / OIE.COLS);
    g.pad = 10;
    g.colW = (width - g.pad * 2) / OIE.COLS;
    g.rowH = Math.max(66, g.colW * 0.95);
    g.boardH = rows * g.rowH + g.pad * 2;
    g.width = width;
    const cs = Math.min(g.colW, g.rowH) - 12;
    boardEl.style.height = `${g.boardH}px`;
    boardEl.style.setProperty('--cs', `${cs}px`);

    // Chemin lumineux qui relie les cases
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'oie-path');
    svg.setAttribute('viewBox', `0 0 ${width} ${g.boardH}`);
    const d = g.board.map((_, i) => { const { x, y } = this.oieXY(i); return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`; }).join(' ');
    for (const cls of ['', 'glow']) {
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', d);
      if (cls) path.setAttribute('class', cls);
      svg.append(path);
    }

    const cells = g.board.map((type, i) => {
      const t = OIE.CELL_TYPES[type];
      const { x, y } = this.oieXY(i);
      const special = !['calm', 'quiz', 'jamais', 'probable', 'theme', 'duel'].includes(type);
      return h('div', {
        class: `oie-cell t-${type}${special && type !== 'calm' ? ' is-special' : ''}`, dataset: { i },
        style: { left: `${x}px`, top: `${y}px`, '--cc': t.color },
      }, h('span', { class: 'ci', text: t.icon }), h('span', { class: 'cn', text: i === 0 ? 'GO' : String(i) }));
    });
    g.pawns = new Map();
    const pawns = g.players.map((p) => {
      const el = h('div', { class: 'pawn', style: { '--pc': p.color }, text: p.name.charAt(0).toUpperCase(), 'aria-label': p.name });
      g.pawns.set(p.id, el);
      return el;
    });
    boardEl.replaceChildren(svg, ...cells, ...pawns);

    // Mini-carte : où est chacun sur le parcours
    g.mapDots = new Map();
    $('#oie-map').replaceChildren(h('span', { class: 'oie-map-line' }), ...g.players.map((p) => {
      const dot = h('span', { class: 'mdot', style: { '--pc': p.color } });
      g.mapDots.set(p.id, dot);
      return dot;
    }));
    this.oiePlacePawns();
  }

  /** Place tous les pions (décalés quand plusieurs sont sur la même case) */
  oiePlacePawns() {
    const g = this.game;
    const current = g.players[g.turn];
    const byCell = new Map();
    g.players.forEach((p) => { const list = byCell.get(p.pos) || []; list.push(p); byCell.set(p.pos, list); });
    byCell.forEach((list, pos) => {
      const { x, y } = this.oieXY(pos);
      list.forEach((p, k) => {
        const n = list.length;
        const angle = (k / n) * Math.PI * 2 - Math.PI / 2;
        const r = n > 1 ? Math.min(14, 6 + n * 2) : 0;
        const el = g.pawns.get(p.id);
        el.style.left = `${x + Math.cos(angle) * r}px`;
        el.style.top = `${y + Math.sin(angle) * r + (n > 1 ? 0 : -2)}px`;
        el.classList.toggle('is-turn', current && p.id === current.id);
      });
    });
    g.players.forEach((p) => {
      const dot = g.mapDots.get(p.id);
      dot.style.left = `${(p.pos / OIE.LAST) * 100}%`;
      dot.classList.toggle('is-turn', current && p.id === current.id);
    });
  }

  /** La caméra centre la case demandée dans la fenêtre du plateau */
  oieCamera(pos, smooth = true) {
    const vp = $('#oie-viewport');
    const { y } = this.oieXY(pos);
    vp.scrollTo({ top: Math.max(0, y - vp.clientHeight / 2), behavior: smooth && !reducedMotion.matches ? 'smooth' : 'auto' });
  }

  /* ---------------------------------------------------------------------- */
  /* TOUR DE JEU                                                             */
  /* ---------------------------------------------------------------------- */
  oieTurn() {
    const g = this.game;
    if (!g || g.over) return;
    const p = g.players[g.turn];
    g.busy = false;
    if (this.isMashup) this.setTheme(p.camp);
    this.setTurnName($('#oie-player'), p);
    $('#oie-round').textContent = `TOUR ${g.round}`;
    this.oiePlacePawns();
    this.oieCamera(p.pos);
    this.renderScores('oie');

    const dice = $('#oie-dice');
    if (p.skip > 0) {
      p.skip -= 1;
      dice.classList.remove('can-roll');
      dice.disabled = true;
      const cell = OIE.CELL_TYPES[g.board[p.pos]];
      this.oiePanel({
        icon: '😴', title: 'Tour passé', color: cell.color,
        text: `${p.name} est bloqué (${cell.name.toLowerCase()})${p.skip ? `, encore ${plural(p.skip, 'tour')} après celui-ci` : ''}.`,
        actions: [h('button', { class: 'btn-primary', text: 'JOUEUR SUIVANT →', onclick: once(() => this.oieNext()) })],
      });
      return;
    }
    dice.disabled = false;
    dice.classList.add('can-roll');
    dice.onclick = () => this.oieRoll();
    this.oiePanel({
      icon: '🎲', title: 'À toi de jouer',
      text: p.pos === 0 ? 'Touche les dés pour te lancer sur le plateau.' : `Tu es case ${p.pos}. Touche les dés !`,
      actions: [h('button', { class: 'btn-primary pulse', text: '🎲 LANCER LES DÉS', onclick: once(() => this.oieRoll()) })],
    });
  }

  oieNext() {
    const g = this.game;
    if (!g || g.over) return;
    g.count += 1;
    g.turn += 1;
    if (g.turn >= g.players.length) { g.turn = 0; g.round += 1; }
    this.oieTurn();
  }

  /** Dessine les points d'un dé */
  oieDie(el, v) {
    const spots = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] }[v];
    el.dataset.v = v;
    el.replaceChildren(...Array.from({ length: 9 }, (_, k) => (spots.includes(k + 1) ? h('i', {}) : h('span'))));
  }

  async oieRoll() {
    const g = this.game;
    if (!g || g.over || g.busy) return;
    g.busy = true;
    this.sound.unlock();
    const dice = $('#oie-dice');
    dice.disabled = true;
    dice.onclick = null;
    dice.classList.remove('can-roll');
    $$('#oie-panel button').forEach((b) => { b.disabled = true; });
    const dies = $$('.die', dice);
    const d1 = randInt(1, 6);
    const d2 = randInt(1, 6);
    // Animation : les faces défilent puis se figent
    dies.forEach((d) => replay(d, 'rolling'));
    const t0 = performance.now();
    while (performance.now() - t0 < (reducedMotion.matches ? 0 : 520)) {
      dies.forEach((d) => this.oieDie(d, randInt(1, 6)));
      this.sound.tick(0.3);
      await wait(70);
    }
    this.oieDie(dies[0], d1);
    this.oieDie(dies[1], d2);
    haptic(20);
    this.sound.good();
    const total = d1 + d2;
    g.lastRoll = total;
    const p = g.players[g.turn];
    this.oiePanel({ icon: '🎲', title: `${d1} + ${d2} = ${total}`, text: `${p.name} avance de ${total} cases…` });
    await wait(350);
    await this.oieMove(p, total);
    this.oieResolve(p, 0);
  }

  /** Déplace un pion case par case (avec rebond si on dépasse 63) */
  async oieMove(p, steps) {
    const g = this.game;
    let dir = steps >= 0 ? 1 : -1;
    let left = Math.abs(steps);
    const pawn = g.pawns.get(p.id);
    while (left > 0) {
      if (p.pos + dir > OIE.LAST) dir = -1;   // rebond sur l'arrivée
      if (p.pos + dir < 0) break;
      p.pos += dir;
      left -= 1;
      this.oiePlacePawns();
      replay(pawn, 'hop');
      this.sound.tick(p.pos / OIE.LAST);
      this.oieCamera(p.pos);
      await wait(reducedMotion.matches ? 30 : 210);
    }
    const cell = $(`.oie-cell[data-i="${p.pos}"]`);
    replay(cell, 'hit');
    setTimeout(() => cell && cell.classList.remove('hit'), 700);
  }

  /** Saut direct (pont, labyrinthe, tête de mort, échange) */
  async oieJump(p, to) {
    const g = this.game;
    p.pos = to;
    this.oiePlacePawns();
    replay(g.pawns.get(p.id), 'hop');
    this.oieCamera(to);
    await wait(reducedMotion.matches ? 50 : 650);
  }

  /* ---------------------------------------------------------------------- */
  /* EFFETS DES CASES                                                        */
  /* ---------------------------------------------------------------------- */
  async oieResolve(p, depth) {
    const g = this.game;
    if (!g || g.over) return;
    const type = g.board[p.pos];
    const t = OIE.CELL_TYPES[type];
    const done = (label = 'JOUEUR SUIVANT →') => h('button', { class: 'btn-primary', text: label, onclick: once(() => this.oieNext()) });
    const flash = () => this.fx.flash(color(t.color, 0.3));
    const base = { icon: t.icon, title: t.name, color: t.color };

    switch (type) {
      case 'finish': {
        this.sound.reward();
        this.fx.confetti([p.color, '#ffc857', '#fff', '#7ee07a']);
        this.oiePanel({ ...base, icon: '🏆', title: `${p.name} gagne !`, text: 'Pile sur la case 63. Champion·ne.', actions: [h('button', { class: 'btn-primary pulse', text: 'VOIR LE CLASSEMENT 🏆', onclick: once(() => this.finish()) })] });
        return;
      }
      case 'oie': {
        if (depth >= 3) { this.oiePanel({ ...base, text: 'Les oies sont fatiguées, on s’arrête là.', actions: [done()] }); return; }
        this.sound.good();
        flash();
        this.oiePanel({ ...base, text: `Tu avances encore de ${g.lastRoll} cases !` });
        await wait(900);
        await this.oieMove(p, g.lastRoll);
        this.oieResolve(p, depth + 1);
        return;
      }
      case 'pont': {
        flash();
        this.oiePanel({ ...base, text: t.text });
        await wait(800);
        await this.oieJump(p, 12);
        this.oieResolve(p, depth + 1);
        return;
      }
      case 'labyrinthe': {
        this.sound.bad();
        flash();
        this.oiePanel({ ...base, text: t.text });
        await wait(800);
        await this.oieJump(p, 30);
        this.oiePanel({ ...base, text: 'Te voilà case 30.', actions: [done()] });
        return;
      }
      case 'auberge':
      case 'puits':
      case 'prison': {
        p.skip = type === 'auberge' ? 1 : 2;
        this.sound.bad();
        flash();
        this.oiePanel({ ...base, text: t.text, actions: [done()] });
        return;
      }
      case 'mort': {
        this.sound.boom();
        this.fx.shake();
        this.fx.flash('rgba(255,94,126,.45)');
        this.oiePanel({ ...base, text: t.text });
        await wait(900);
        await this.oieJump(p, 0);
        const fx = this.oieMalus(p, 2);
        this.oiePanel({ ...base, text: 'Retour à la case départ.', effects: [fx], actions: [done()] });
        return;
      }
      case 'avance':
      case 'recule': {
        if (depth >= 3) { this.oiePanel({ ...base, text: 'On en reste là pour ce tour.', actions: [done()] }); return; }
        this.oiePanel({ ...base, text: t.text });
        await wait(700);
        await this.oieMove(p, type === 'avance' ? 3 : -3);
        this.oieResolve(p, depth + 1);
        return;
      }
      case 'calm': {
        this.oiePanel({ ...base, icon: '😌', text: 'Rien ne se passe. Profite.', actions: [done()] });
        return;
      }
      case 'malus': {
        this.sound.bad();
        const fx = this.oieMalus(p, 2);
        this.oiePanel({ ...base, text: 'La case te tombe dessus.', effects: [fx], actions: [done()] });
        return;
      }
      case 'tous': {
        this.sound.good();
        flash();
        const effects = g.players.map((x) => this.oieMalus(x, 1));
        this.oiePanel({ ...base, text: 'Tout le monde trinque, toi compris !', effects, actions: [done()] });
        return;
      }
      case 'cadeau': {
        this.sound.reward();
        flash();
        this.oieBonus(p, 2, base, 'La case t’offre 2 jetons.');
        return;
      }
      case 'echange': return this.oieExchange(p, base);
      case 'quiz': return this.oieQuiz(p, base);
      case 'jamais': return this.oieJamais(p, base);
      case 'probable': {
        const j = OIE.CELL_TYPES.jamais;
        return g.players.length >= 3 ? this.oieProbable(p, base) : this.oieJamais(p, { icon: j.icon, title: j.name, color: j.color });
      }
      case 'theme': return this.oieTheme(p, base);
      case 'duel': return this.oieDuel(p, base);
      default:
        this.oiePanel({ ...base, actions: [done()] });
    }
    return undefined;
  }

  /**
   * Malus adapté au camp : un buveur boit, un fumeur perd des points de jauge.
   * Renvoie la ligne de texte à afficher.
   */
  oieMalus(p, n) {
    if (p.camp === 'alcool') {
      p.taken += n;
      return `🥃 ${p.name} boit ${n}`;
    }
    const lost = Math.min(p.gauge, n);
    p.gauge -= lost;
    p.sabotaged += n;
    return lost ? `🔻 ${p.name} −${lost} jauge (${p.gauge}/${CONFIG.TAFF_EVERY})` : `🛡️ ${p.name} : jauge déjà vide`;
  }

  /** Bonus : le joueur distribue (buveur) ou garde/balance (fumeur) ses jetons */
  oieBonus(p, n, base, text) {
    const body = h('div', { class: 'op-body' });
    this.oiePanel({ ...base, text: `${text} ${p.camp === 'fumette' ? 'Garde-les pour ta jauge ou balance-les.' : 'Distribue-les !'}`, body });
    this.renderGive(body, p, n, {
      keep: p.camp === 'fumette', tokens: true, screen: 'oie',
      onDone: (gained) => {
        if (gained > 0) {
          this.sound.reward();
          this.fx.flash('rgba(126,224,122,.35)');
          this.fx.burstFrom($('#oie-panel'), { colors: ['#7ee07a', '#d4ff5e', '#fff'], count: 90, power: 11 });
          this.oiePanel({ icon: '🌿', title: gained > 1 ? `${gained} TAFFS !` : 'TAFF !', color: '#7ee07a',
            text: `${p.name}, ta jauge est pleine : va fumer !`,
            actions: [h('button', { class: 'btn-primary pulse', text: '✓ C’EST FUMÉ →', onclick: once(() => this.oieNext()) })] });
        } else {
          this.oieNext();
        }
      },
    });
  }

  /* ---------------------------------------------------------------------- */
  /* MINI-JEUX DES CASES                                                     */
  /* ---------------------------------------------------------------------- */
  oieQuiz(p, base) {
    const g = this.game;
    const q = g.quiz.draw();
    if (!q) { this.oieResolveFallback(p, base); return; }
    const value = (CONFIG.DIFFS[q.diff] || CONFIG.DIFFS.medium).value;
    const order = shuffle(q.choices.map((_, i) => i));
    const body = h('div', { class: 'op-body' });
    const choices = h('div', { class: 'choices' }, order.map((orig, i) => h('button', {
      class: 'choice', style: { '--i': i }, dataset: { orig },
      onclick: (e) => answer(orig === q.answer, e.currentTarget),
    }, h('span', { class: 'letter', text: 'ABCD'[i] }), h('span', { text: q.choices[orig] }))));
    body.append(choices);
    const diff = CONFIG.DIFFS[q.diff] || CONFIG.DIFFS.medium;
    this.oiePanel({ ...base, title: `${base.title} · ${diff.emoji} ${value}`, big: q.q, body });
    const answer = (ok, btn) => {
      $$('.choice', choices).forEach((b) => {
        b.disabled = true;
        const orig = Number(b.dataset.orig);
        if (orig === q.answer) b.classList.add('correct'); else if (b === btn) b.classList.add('wrong'); else b.classList.add('faded');
      });
      if (ok) {
        this.sound.good();
        this.fx.burstFrom(btn, { colors: ['#7ee07a', '#fff'], count: 30, power: 7 });
        setTimeout(() => this.oieBonus(p, value, { ...base, icon: '✅', title: 'Bonne réponse !' }, `${plural(value, 'jeton')} pour toi.`), 800);
      } else {
        this.sound.bad();
        const fx = this.oieMalus(p, value);
        setTimeout(() => this.oiePanel({ ...base, icon: '❌', title: 'Raté', color: '#ff5e7e',
          text: `La réponse était « ${q.choices[q.answer]} ».`, effects: [fx],
          actions: [h('button', { class: 'btn-primary', text: 'JOUEUR SUIVANT →', onclick: once(() => this.oieNext()) })] }), 900);
      }
    };
  }

  oieResolveFallback(p, base) {
    this.oiePanel({ ...base, text: 'Case vide cette fois.', actions: [h('button', { class: 'btn-primary', text: 'JOUEUR SUIVANT →', onclick: once(() => this.oieNext()) })] });
  }

  oieJamais(p, base) {
    const g = this.game;
    const text = g.jamais.draw() || 'chanté sous la douche';
    const chips = h('div', { class: 'chips' });
    const validate = h('button', { class: 'btn-primary', text: 'PERSONNE →' });
    const sel = this.renderChips(chips, g.players, {
      multi: true,
      onChange: (s) => { validate.textContent = s.size ? `VALIDER (${s.size})` : 'PERSONNE →'; },
    });
    validate.addEventListener('click', once(() => {
      const hit = g.players.filter((x) => sel.has(x.id));
      const effects = hit.map((x) => this.oieMalus(x, 1));
      if (hit.length) this.sound.good();
      this.renderScores('oie');
      this.oiePanel({ ...base, text: hit.length ? 'Les aveux sont tombés :' : '😇 Personne ? Bande de saints.', effects,
        actions: [h('button', { class: 'btn-primary', text: 'JOUEUR SUIVANT →', onclick: once(() => this.oieNext()) })] });
    }));
    this.oiePanel({ ...base, big: `Je n'ai jamais ${text}.`, text: 'Qui l’a déjà fait ? (tout le monde peut être concerné)', body: h('div', { class: 'op-body' }, chips, validate) });
  }

  oieProbable(p, base) {
    const g = this.game;
    const text = g.probable.draw() || 'devenir célèbre';
    const chips = h('div', { class: 'chips' });
    const validate = h('button', { class: 'btn-primary', text: 'VALIDER', disabled: true });
    const count = h('button', { class: 'pc-count', text: '3 · 2 · 1 → pointez !', onclick: () => this.countdown321(count) });
    const sel = this.renderChips(chips, g.players, { onChange: (s) => { validate.disabled = s.size === 0; } });
    validate.addEventListener('click', once(() => {
      const target = g.players.find((x) => sel.has(x.id));
      const fx = this.oieMalus(target, 2);
      this.sound.good();
      this.renderScores('oie');
      this.oiePanel({ ...base, text: `Le groupe a parlé : ${target.name} !`, effects: [fx],
        actions: [h('button', { class: 'btn-primary', text: 'JOUEUR SUIVANT →', onclick: once(() => this.oieNext()) })] });
    }));
    this.oiePanel({ ...base, big: `Qui est le plus susceptible de ${text} ?`, text: 'Tout le monde pointe en même temps. Le plus désigné prend le malus.', body: h('div', { class: 'op-body' }, count, chips, validate) });
  }

  oieTheme(p, base) {
    const g = this.game;
    const theme = g.themes.draw() || 'Fruits';
    const startBtn = h('button', { class: 'btn-primary pulse', text: '⏱ GO (5 s)' });
    const body = h('div', { class: 'op-body' }, startBtn);
    this.oiePanel({ ...base, big: theme, text: `${p.name}, cite 3 réponses en 5 secondes !`, body });
    startBtn.addEventListener('click', once(async () => {
      this.sound.unlock();
      const num = h('div', { class: 'op-count', text: '5' });
      body.replaceChildren(num);
      for (let s = 5; s > 0; s--) {
        num.textContent = String(s);
        replay(num, 'bump-num');
        this.sound.beep();
        await wait(1000);
      }
      this.sound.alarm();
      num.textContent = 'STOP';
      const fin = (ok) => {
        if (ok) { this.oieBonus(p, 1, { ...base, icon: '✅', title: 'Réussi !' }, '1 jeton pour toi.'); return; }
        const fx = this.oieMalus(p, 2);
        this.sound.bad();
        this.oiePanel({ ...base, icon: '❌', title: 'Raté', color: '#ff5e7e', effects: [fx],
          actions: [h('button', { class: 'btn-primary', text: 'JOUEUR SUIVANT →', onclick: once(() => this.oieNext()) })] });
      };
      body.append(h('div', { class: 'actions' },
        h('button', { class: 'btn-ghost', text: '✗ raté', onclick: once(() => fin(false)) }),
        h('button', { class: 'btn-primary', text: '✓ RÉUSSI', onclick: once(() => fin(true)) })));
    }));
  }

  oieDuel(p, base) {
    const g = this.game;
    const others = g.players.filter((x) => x.id !== p.id);
    const chips = h('div', { class: 'chips' });
    const go = h('button', { class: 'btn-primary', text: 'DUEL !', disabled: true });
    const sel = this.renderChips(chips, others, { onChange: (s) => { go.disabled = s.size === 0; } });
    this.oiePanel({ ...base, text: `${p.name}, choisis ton adversaire pour un pierre-feuille-ciseaux.`, body: h('div', { class: 'op-body' }, chips, go) });
    go.addEventListener('click', once(() => {
      const rival = others.find((x) => sel.has(x.id));
      const pick = h('div', { class: 'chips' });
      const loserSel = this.renderChips(pick, [p, rival], {
        onChange: (s) => {
          const loser = [p, rival].find((x) => s.has(x.id));
          if (!loser) return;
          const fx = this.oieMalus(loser, 2);
          this.sound.bad();
          this.fx.shake();
          this.renderScores('oie');
          this.oiePanel({ ...base, text: `${loser.name} perd le duel.`, effects: [fx],
            actions: [h('button', { class: 'btn-primary', text: 'JOUEUR SUIVANT →', onclick: once(() => this.oieNext()) })] });
        },
      });
      void loserSel;
      this.oiePanel({ ...base, big: `${p.name} ⚔️ ${rival.name}`, text: 'Chi-fou-mi ! Qui a perdu ?', body: h('div', { class: 'op-body' }, pick) });
    }));
  }

  oieExchange(p, base) {
    const g = this.game;
    const others = g.players.filter((x) => x.id !== p.id);
    const chips = h('div', { class: 'chips' });
    this.renderChips(chips, others, {
      labelOf: (x) => h('span', { class: 'chip-main' }, x.name, h('small', { text: `case ${x.pos}` })),
      onChange: async (s) => {
        const other = others.find((x) => s.has(x.id));
        if (!other || g.busy) return;
        g.busy = true;
        $$('button', chips).forEach((b) => { b.disabled = true; });
        const a = p.pos;
        const b = other.pos;
        this.sound.good();
        p.pos = b;
        other.pos = a;
        this.oiePlacePawns();
        replay(g.pawns.get(p.id), 'hop');
        replay(g.pawns.get(other.id), 'hop');
        this.oieCamera(p.pos);
        await wait(700);
        g.busy = false;
        this.renderScores('oie');
        this.oiePanel({ ...base, text: `${p.name} passe case ${p.pos}, ${other.name} case ${other.pos}.`,
          actions: [h('button', { class: 'btn-primary', text: 'JOUEUR SUIVANT →', onclick: once(() => this.oieNext()) })] });
      },
    });
    this.oiePanel({ ...base, text: OIE.CELL_TYPES.echange.text, body: h('div', { class: 'op-body' }, chips) });
  }

  /* ---------------------------------------------------------------------- */
  /* PANNEAU D'ÉVÉNEMENT                                                     */
  /* ---------------------------------------------------------------------- */
  oiePanel({ icon = '', title = '', color: c = null, text = '', big = '', effects = [], body = null, actions = [] }) {
    const card = h('div', { class: 'op-card', style: c ? { '--cc': c } : {} },
      h('div', { class: 'op-head' }, icon ? h('span', { class: 'op-icon', text: icon }) : null, h('span', { class: 'op-title', text: title })),
      big ? h('p', { class: 'op-big', text: big }) : null,
      text ? h('p', { class: 'op-text', text }) : null,
      effects.length ? h('div', { class: 'op-effects' }, effects.map((e) => h('span', { text: e }))) : null,
      body,
      actions.length ? h('div', { class: 'op-body' }, actions) : null);
    $('#oie-panel').replaceChildren(card);
    this.renderScores('oie');
  }
});

/** Couleur hex → rgba avec opacité (pour les flashs) */
function color(hex, alpha) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return `rgba(255,255,255,${alpha})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
