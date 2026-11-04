/**
 * SMOKE OR DRINK — Je n'ai jamais / Qui pourrait…
 */
'use strict';

addGame(class {
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
  async countdown321(btn = $('#pc-count')) {
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
});
