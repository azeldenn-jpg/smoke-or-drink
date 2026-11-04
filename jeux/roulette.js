/**
 * SMOKE OR DRINK — Roulette classique (jeu autonome)
 */
'use strict';

addGame(class {
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
});
