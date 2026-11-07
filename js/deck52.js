/**
 * SMOKE OR DRINK — Le jeu de 52 cartes commun (Plus ou moins, King's Cup, et plus tard
 * la Traversée du désert) : paquet mélangé, dessin des cartes, retournement en 3D.
 */
'use strict';

const SUITS = [
  { s: '♠', name: 'pique', red: false }, { s: '♥', name: 'cœur', red: true },
  { s: '♦', name: 'carreau', red: true }, { s: '♣', name: 'trèfle', red: false },
];
// rang : 2..10, 11 = Valet, 12 = Dame, 13 = Roi, 14 = As (l'As est la plus forte)
const RANK_LABEL = { 11: 'V', 12: 'D', 13: 'R', 14: 'A' };
const RANK_NAME = { 11: 'Valet', 12: 'Dame', 13: 'Roi', 14: 'As' };
const rankLabel = (r) => RANK_LABEL[r] || String(r);
const rankName = (r) => RANK_NAME[r] || String(r);

/** Un paquet de 52 cartes mélangé */
function deck52() {
  const cards = [];
  SUITS.forEach((suit) => { for (let r = 2; r <= 14; r++) cards.push({ r, ...suit }); });
  return shuffle(cards);
}

/** Face d'une carte (sans conteneur 3D) */
function cardFace(c) {
  const lab = rankLabel(c.r);
  const face = c.r >= 11 && c.r <= 13;
  return h('div', { class: `pcard-face front ${c.red ? 'red' : 'black'}${face ? ' court' : ''}` },
    h('span', { class: 'pc-corner tl' }, h('b', { text: lab }), h('i', { text: c.s })),
    h('span', { class: 'pc-center', text: face ? lab : c.s }),
    face ? h('span', { class: 'pc-suit', text: c.s }) : null,
    h('span', { class: 'pc-corner br' }, h('b', { text: lab }), h('i', { text: c.s })));
}

/**
 * Carte retournable. `el.show(card)` la retourne face visible (avec animation),
 * `el.hide()` la remet de dos.
 */
function flipCard(card = null, { small = false } = {}) {
  const inner = h('div', { class: 'pcard-inner' },
    h('div', { class: 'pcard-face back' }, h('span', { class: 'pc-logo', text: '🃏' })));
  const el = h('div', { class: `pcard${small ? ' small' : ''}` }, inner);
  el.show = (c, animate = true) => {
    const old = $('.front', inner);
    if (old) old.remove();
    inner.append(cardFace(c));
    if (!animate) { el.classList.add('flipped', 'instant'); requestAnimationFrame(() => el.classList.remove('instant')); return; }
    el.classList.remove('flipped');
    void el.offsetWidth;
    el.classList.add('flipped');
  };
  el.hide = () => el.classList.remove('flipped');
  if (card) el.show(card, false);
  return el;
}

addGame(class {
  /** Distribue des gorgées (taffs en mode fumette) au choix du joueur, converties selon le camp de chaque cible */
  partyGive(area, giver, sips, onDone) {
    const fum = this.mode === 'fumette';
    const total = fum ? this.sipsToTaffs(sips) : sips;
    const others = this.game.players.filter((t) => t.id !== giver.id);
    const dist = new Map(others.map((t) => [t.id, 0]));
    let left = total;
    const label = h('p', { class: 'give-label' }, `Tape sur tes victimes · reste `, h('b', { text: String(left) }), fum ? ' 🌿' : ' 🥃');
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
    this.renderChips(chips, others, {
      labelOf: this.isMashup ? (t) => h('span', { class: 'chip-main' }, t.name, h('small', { text: t.camp === 'alcool' ? '🥃 boit' : '🌿 3 = 1 taff' })) : null,
      counters: (p, chip) => {
        if (left <= 0) { replay(label, 'bump'); return; }
        dist.set(p.id, dist.get(p.id) + 1);
        left -= 1;
        this.fx.burstFrom(chip, { colors: [p.color, '#fff'], count: 12, power: 4 });
        refresh();
      },
    });
    reset.addEventListener('click', () => { others.forEach((t) => dist.set(t.id, 0)); left = total; refresh(); });
    validate.addEventListener('click', once(() => {
      const recap = [];
      others.forEach((t) => {
        const n = dist.get(t.id);
        if (!n) return;
        giver.given += n;
        if (fum) { t.taken += n; recap.push(`🌿 ${t.name} : ${plural(n, 'taff')}`); } else recap.push(this.sanction(t, n));
      });
      if (recap.length) this.toast(recap.join(' · '), 'bad');
      this.sound.bad();
      onDone();
    }));
    area.append(label, chips, h('div', { class: 'result-actions' }, validate, reset));
  }

  /** Choisir une seule victime (cul sec offert, etc.) */
  partyPick(area, giver, label, onPick) {
    const others = this.game.players.filter((t) => t.id !== giver.id);
    const ok = h('button', { class: 'btn-primary', text: label, disabled: true });
    const chips = h('div', { class: 'chips' });
    const sel = this.renderChips(chips, others, { onChange: (s) => { ok.disabled = !s.size; } });
    ok.addEventListener('click', once(() => {
      const v = others.find((x) => sel.has(x.id));
      if (v) onPick(v);
    }));
    area.append(chips, h('div', { class: 'result-actions' }, ok));
  }

  /** Verbes et unités selon le mode (« boit » / « taffe ») */
  get verbs() {
    if (this.isMashup) return { v: 'boit (ou taffe)', v2: 'bois (ou taffes)', v3: 'boivent (ou taffent)', n: 'gorgées (ou taffs)', one: 'gorgée' };
    if (this.mode === 'fumette') return { v: 'tire une taff', v2: 'tires une taff', v3: 'tirent une taff', n: 'taffs', one: 'taff' };
    return { v: 'boit', v2: 'bois', v3: 'boivent', n: 'gorgées', one: 'gorgée' };
  }
});
