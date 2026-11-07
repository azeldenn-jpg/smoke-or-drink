/**
 * SMOKE OR DRINK — Tu préfères…
 * ------------------------------------------------------------------------------
 *  Un dilemme s'affiche. « Votez ! » : 3, 2, 1… et tout le monde pointe à gauche
 *  ou à droite avec le doigt, en même temps. On indique ensuite qui a choisi A :
 *  la minorité boit 2 gorgées (1 taff). Égalité : tout le monde boit 1.
 *  Unanimité : personne. Ambiance Chill / Soirée / Hot + cartes perso.
 * ------------------------------------------------------------------------------
 */
'use strict';

const PF_LOSE = 2;   // gorgées pour la minorité
const PF_TIE = 1;    // gorgées pour tout le monde en cas d'égalité

GAME_HOOKS.preferes = {
  screen: 'preferes',
  start() { this.pfStart(); },
  info(mix) { return `// ${this.pfPool().length} dilemmes · la minorité boit ${PF_LOSE} · égalité : tout le monde ${PF_TIE}${mix}`; },
  score: {
    title() { return 'Fois dans la minorité · bues'; },
    line(p) { return { v: `${p.minority || 0}|${p.taken}`, main: `${p.minority || 0} ✋`, small: ` · ${p.taken} ${this.campOf(p) === 'alcool' ? '🥃' : '🌿'}` }; },
    key(p) { return (p.minority || 0) * 1000 + p.taken; },
  },
  end: {
    kicker() { return '// tu préfères…'; },
    crown: 'Le plus à part du groupe',
    key(p) { return (p.minority || 0) * 1000 + p.taken; },
    line(p) { return { main: `${p.minority || 0} ✋`, sub: `fois dans la minorité · ${p.taken} ${this.campOf(p) === 'alcool' ? 'gorgées bues' : 'taffs prises'}` }; },
  },
};

addGame(class {
  /** Les dilemmes de l'ambiance choisie + les cartes perso (« A ou B ») */
  pfPool() {
    const lvl = (MEME_LEVELS[this.settings.memeLevel] || MEME_LEVELS.soiree).includes;
    const code = { c: 'chill', s: 'soiree', h: 'hot' };
    const base = PREFERES.filter(([, , l]) => lvl.includes(code[l])).map(([a, b]) => [a, b]);
    const mine = (this.customCards().preferes || []).filter((c) => lvl.includes(c.lvl || 'chill')).map((c) => {
      const parts = c.t.split(/\s+ou\s+|\s*\/\s*/i);
      return parts.length >= 2 ? [parts[0], parts.slice(1).join(' ou ')] : null;
    }).filter(Boolean);
    return [...base, ...mine];
  }

  pfStart() {
    const g = this.game;
    g.deck = new Deck(this.pfPool());
    g.turn = randInt(0, g.players.length - 1);
    g.players.forEach((p) => { p.minority = 0; });
    this.pfTurn();
  }

  pfTurn() {
    this.beginTurn('pfTurn');
    const g = this.game;
    const reader = g.players[g.turn];
    const [a, b] = g.deck.draw();
    g.cur = { a, b };
    $("#pf-round").textContent = `#${g.count + 1}`;
    $('#pf-reader').replaceChildren(`${reader.emoji ? reader.emoji + ' ' : ''}${reader.name} lit à voix haute`);
    $('#pf-card').className = 'pf-card';
    $('#pf-card').replaceChildren(
      h('p', { class: 'pf-q', text: 'Tu préfères…' }),
      h('div', { class: 'pf-opts' },
        h('div', { class: 'pf-opt a' }, h('span', { class: 'pf-tag', text: '👈 A' }), h('p', { text: a })),
        h('span', { class: 'pf-or', text: 'ou' }),
        h('div', { class: 'pf-opt b' }, h('span', { class: 'pf-tag', text: 'B 👉' }), h('p', { text: b }))));
    $('#pf-area').replaceChildren(h('div', { class: 'result-actions' },
      h('button', { class: 'btn-primary pulse', text: '🗳️ VOTEZ !', onclick: once(() => this.pfCountdown()) }),
      h('button', { class: 'btn-ghost', text: '↻ AUTRE DILEMME', onclick: once(() => this.pfTurn()) })));
    this.renderScores('preferes');
  }

  /** 3, 2, 1… tout le monde pointe en même temps */
  pfCountdown() {
    const g = this.game;
    const card = $('#pf-card');
    const big = h('p', { class: 'pf-count', text: '3' });
    card.append(big);
    card.classList.add('counting');
    $('#pf-area').replaceChildren(h('p', { class: 'pf-hint pixel', text: '// préparez vos doigts…' }));
    this.partyBeep();
    haptic(15);
    [2, 1].forEach((n, k) => this.later(() => { big.textContent = String(n); replay(big, 'bump'); this.partyBeep(); }, (k + 1) * 800));
    this.later(() => {
      big.textContent = 'POINTEZ !';
      big.classList.add('go');
      this.partyBeep(true);
      this.later(() => { card.classList.remove('counting'); big.remove(); this.pfAskVotes(); }, 1300);
    }, 2400);
    void g;
  }

  pfAskVotes() {
    const g = this.game;
    const area = $('#pf-area');
    const chips = h('div', { class: 'chips' });
    const sel = this.renderChips(chips, g.players, { multi: true, onChange: () => { refresh(); } });
    const label = h('p', { class: 'give-label' });
    const ok = h('button', { class: 'btn-primary', text: 'VALIDER LES VOTES' });
    const refresh = () => { label.textContent = `Qui a choisi A ? (${sel.size} pour A · ${g.players.length - sel.size} pour B)`; };
    refresh();
    ok.addEventListener('click', once(() => this.pfResolve(sel)));
    area.replaceChildren(label, chips, h('div', { class: 'result-actions' }, ok));
  }

  pfResolve(selA) {
    const g = this.game;
    const A = g.players.filter((p) => selA.has(p.id));
    const B = g.players.filter((p) => !selA.has(p.id));
    const pct = Math.round((A.length / g.players.length) * 100);
    const bar = h('div', { class: 'pf-bar' },
      h('span', { class: 'pa', style: { width: `${pct}%` }, text: A.length ? `A ${pct} %` : '' }),
      h('span', { class: 'pb', style: { width: `${100 - pct}%` }, text: B.length ? `B ${100 - pct} %` : '' }));
    let verdict, lines = [];
    if (!A.length || !B.length) {
      verdict = 'UNANIMITÉ !';
      lines.push('Tout le monde est d’accord : personne ne boit. Santé quand même.');
      this.sound.good();
    } else if (A.length === B.length) {
      verdict = 'ÉGALITÉ PARFAITE';
      lines = g.players.map((p) => this.sanction(p, PF_TIE));
      this.sound.bad();
    } else {
      const minority = A.length < B.length ? A : B;
      verdict = `LA MINORITÉ (${A.length < B.length ? 'A' : 'B'}) TRINQUE`;
      minority.forEach((p) => { p.minority = (p.minority || 0) + 1; });
      lines = minority.map((p) => this.sanction(p, PF_LOSE));
      this.sound.bad();
      haptic([40, 30, 40]);
    }
    g.count += 1;
    $('#pf-area').replaceChildren(
      bar,
      h('div', { class: 'result bad' }, h('p', { class: 'verdict', text: verdict }), ...lines.map((l) => h('p', { class: 'sub', text: l }))),
      h('div', { class: 'result-actions' }, h('button', { class: 'btn-primary', text: 'DILEMME SUIVANT →', onclick: once(() => {
        g.turn = (g.turn + 1) % g.players.length;
        this.pfTurn();
      }) })));
    this.renderScores('preferes');
  }
});
