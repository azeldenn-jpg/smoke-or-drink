/**
 * SMOKE OR DRINK — Plus ou moins
 * ------------------------------------------------------------------------------
 *  Une carte est posée. Tu paries que la suivante sera plus haute, plus basse ou
 *  égale (l'As est la plus forte). Bonne réponse : ta série continue. Raté : tu
 *  bois la pile (1 + ta série). Carte égale sans l'avoir annoncée : cul sec.
 *  Égalité annoncée et juste : un cul sec à offrir. Dès 3 bonnes réponses, tu
 *  peux passer la main et distribuer ta série.
 *  Les pourcentages affichés sont calculés sur les cartes qui restent.
 * ------------------------------------------------------------------------------
 */
'use strict';

const PM_PASS = 3;  // bonnes réponses avant de pouvoir passer la main

GAME_HOOKS.plusmoins = {
  screen: 'plusmoins',
  start() { this.pmStart(); },
  info(mix) { return `// 52 cartes · As fort · raté = la pile · égalité = cul sec${mix}`; },
  score: {
    title() { return 'Meilleure série · bues'; },
    line(p) { return { v: `${p.bestStreak}|${p.taken}`, main: `🔥 ${p.bestStreak || 0}`, small: ` · ${p.taken} ${this.campOf(p) === 'alcool' ? '🥃' : '🌿'}` }; },
    key(p) { return (p.bestStreak || 0) * 1000 - p.taken; },
  },
  end: {
    kicker() { return '// plus ou moins'; },
    crown: 'Le devin de la soirée',
    key(p) { return (p.bestStreak || 0) * 1000 - p.taken; },
    line(p) { return { main: `🔥 ${p.bestStreak || 0}`, sub: `meilleure série · ${p.taken} ${this.campOf(p) === 'alcool' ? 'gorgées bues' : 'taffs prises'}` }; },
  },
};

addGame(class {
  pmStart() {
    const g = this.game;
    g.deck = deck52();
    g.cur = g.deck.pop();
    g.streak = 0;
    g.turn = randInt(0, g.players.length - 1);
    g.players.forEach((p) => { p.bestStreak = 0; });
    this.pmTurn();
  }

  pmDraw() {
    const g = this.game;
    if (!g.deck.length) { g.deck = deck52(); this.toast('🃏 Nouveau paquet mélangé'); }
    return g.deck.pop();
  }

  /** Chances que la prochaine carte soit plus haute / plus basse / égale, d'après les cartes restantes */
  pmOdds() {
    const g = this.game;
    const pool = g.deck.length ? g.deck : deck52();
    let up = 0, down = 0, eq = 0;
    pool.forEach((c) => { if (c.r > g.cur.r) up += 1; else if (c.r < g.cur.r) down += 1; else eq += 1; });
    const n = pool.length;
    return { up: Math.round((up / n) * 100), down: Math.round((down / n) * 100), eq: Math.round((eq / n) * 100) };
  }

  pmTurn() {
    this.beginTurn('pmTurn');
    const g = this.game;
    const p = g.players[g.turn];
    if (this.isMashup) this.setTheme(p.camp);
    $('#pm-round').textContent = `${g.deck.length} CARTES`;
    const cur = flipCard(g.cur, { small: false });
    const next = flipCard();
    next.classList.add('is-next');
    $('#pm-table').replaceChildren(cur, h('span', { class: 'pm-arrow', text: '→' }), next);
    const name = $('#pm-name');
    name.style.setProperty('--pc', p.color);
    name.replaceChildren(h('span', { class: `dot${p.emoji ? ' emo' : ''}`, text: p.emoji || '' }), h('span', { class: 'name', text: p.name }));
    this.pmControls();
    this.renderScores('plusmoins');
  }

  /** Boutons de pari (et « passer la main » dès 3 bonnes réponses) */
  pmControls() {
    const g = this.game;
    const p = g.players[g.turn];
    const o = this.pmOdds();
    $('#pm-streak').replaceChildren(g.streak
      ? h('span', { class: 'pm-fire' }, `🔥 série de ${g.streak}`, h('small', { text: ` · raté = ${this.sanctionLabel(p, g.streak + 1)}` }))
      : h('span', { class: 'pm-hint', text: `Raté : ${this.sanctionLabel(p, 1)} · carte égale : cul sec` }));
    const btn = (kind, label, sub, cls) => h('button', { class: `pm-btn ${cls}`, onclick: once(() => this.pmGuess(kind)) }, h('b', { text: label }), h('small', { text: sub }));
    const area = $('#pm-area');
    area.replaceChildren(
      h('div', { class: 'pm-btns' },
        btn('up', '⬆ PLUS', `${o.up} %`, 'up'),
        btn('eq', '=', `${o.eq} %`, 'eq'),
        btn('down', '⬇ MOINS', `${o.down} %`, 'down')),
      ...(g.streak >= PM_PASS ? [h('button', { class: 'btn-ghost', text: `✋ PASSER LA MAIN ET DISTRIBUER ${g.streak}`, onclick: once(() => this.pmPass()) })] : []));
  }

  pmGuess(kind) {
    const g = this.game;
    const p = g.players[g.turn];
    const prev = g.cur;
    const nc = this.pmDraw();
    const nextEl = $('#pm-table .is-next');
    nextEl.show(nc);
    this.sound.tick(0.6);
    $$('#pm-area button').forEach((b) => { b.disabled = true; });
    this.later(() => {
      g.cur = nc;
      const cmp = nc.r - prev.r;
      const area = $('#pm-area');
      const right = (kind === 'up' && cmp > 0) || (kind === 'down' && cmp < 0) || (kind === 'eq' && cmp === 0);
      if (right) {
        g.streak += 1;
        p.bestStreak = Math.max(p.bestStreak || 0, g.streak);
        nextEl.classList.add('good');
        this.sound.good();
        haptic(20);
        if (kind === 'eq') {
          area.replaceChildren(h('div', { class: 'result good' },
            h('p', { class: 'verdict', text: 'ÉGALITÉ DEVINÉE !' }),
            h('p', { class: 'line', text: `${rankName(nc.r)} sur ${rankName(prev.r)} : tu offres un CUL SEC` })));
          this.fx.confetti(['#ffcf3f', '#ffffff', '#ff5e9e']);
          this.partyPick(area, p, 'OFFRIR LE CUL SEC', (v) => {
            this.toast(this.sanction(v, 'cs'), 'bad');
            p.given += 5;
            this.renderScores('plusmoins');
            this.pmTurn();
          });
          return;
        }
        this.toast(`✅ Bien vu ! Série de ${g.streak}`, 'good');
        this.pmTurn();
        return;
      }
      nextEl.classList.add('bad');
      const tie = cmp === 0;
      const sips = tie ? 'cs' : g.streak + 1;
      const text = this.sanction(p, sips);
      this.sound.bad();
      this.fx.shake();
      haptic([50, 30, 50]);
      area.replaceChildren(h('div', { class: 'result bad' },
        h('p', { class: 'verdict', text: tie ? 'ÉGALITÉ : CUL SEC !' : 'RATÉ !' }),
        h('p', { class: 'line', text: tie ? `${rankName(nc.r)} sur ${rankName(prev.r)}…` : g.streak ? `Tu bois la pile : ta série de ${g.streak} + 1` : `${rankName(nc.r)} après ${rankName(prev.r)}` }),
        h('p', { class: 'sub', text })),
      h('div', { class: 'result-actions' }, h('button', { class: 'btn-primary', text: 'JOUEUR SUIVANT →', onclick: once(() => this.pmNext()) })));
      g.streak = 0;
      this.renderScores('plusmoins');
    }, 700);
  }

  /** Passer la main : on distribue sa série */
  pmPass() {
    const g = this.game;
    const p = g.players[g.turn];
    const n = g.streak;
    const area = $('#pm-area');
    area.replaceChildren(h('div', { class: 'result good' },
      h('p', { class: 'verdict', text: 'LA MAIN PASSE' }),
      h('p', { class: 'line', text: `${p.name} distribue sa série de ${n}` })));
    this.partyGive(area, p, n, () => { this.renderScores('plusmoins'); this.pmNext(); });
  }

  pmNext() {
    const g = this.game;
    g.streak = 0;
    g.count += 1;
    g.turn = (g.turn + 1) % g.players.length;
    this.pmTurn();
  }
});
