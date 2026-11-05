/**
 * SMOKE OR DRINK — La Bombe
 */
'use strict';

addGame(class {
  /* ---------------------------------------------------------------------- */
  /* LA BOMBE                                                                */
  /* ---------------------------------------------------------------------- */
  bombTurn() {
    this.beginTurn('bombTurn');
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
});
