/**
 * SMOKE OR DRINK — Événements surprise
 * ------------------------------------------------------------------------------
 *  Au début d'un tour, dans n'importe quel jeu, une roue peut tomber sur un
 *  événement : tournée générale, duel du regard, mot interdit, pile ou face…
 *  Fréquence réglable (Jamais / Rare / Souvent). Jamais deux de suite, jamais
 *  pendant le tout premier tour, ni quand un chrono démarre tout seul.
 *  Les sanctions passent par sanction() : gorgées pour un buveur, taffs pour
 *  un fumeur (3 gorgées = 1 taff).
 * ------------------------------------------------------------------------------
 */
'use strict';

const EVENT_FREQ = {
  off:   { emoji: '🚫', label: 'Jamais', small: 'on joue tranquille', p: 0 },
  rare:  { emoji: '🎲', label: 'Rare', small: '~1 tour sur 10', p: 0.1 },
  often: { emoji: '🌪️', label: 'Souvent', small: '~1 tour sur 5', p: 0.2 },
};
// Jeux où un chrono ou une animation démarre tout seul au début du tour : pas d'événement
const EVENT_SKIP = ['timesup', 'seance'];

/** Chaque événement : icône, titre, texte (avec les joueurs tirés au sort), et éventuellement une action */
const EVENTS = [
  { id: 'tournee', icon: '🍻', title: 'Tournée générale', text: () => 'Tout le monde trinque : 1 chacun !',
    run(app, ctx, area, done) { const l = app.game.players.map((p) => app.sanction(p, 1)); area.append(h('p', { class: 'ev-sub', text: l.join(' · ') })); done(); } },
  { id: 'cible', icon: '🎯', title: 'Le ciblé', text: (ctx) => `Le destin a choisi ${ctx.a.name} : 2 pour toi !`,
    run(app, ctx, area, done) { area.append(h('p', { class: 'ev-sub', text: app.sanction(ctx.a, 2) })); done(); } },
  { id: 'roi', icon: '👑', title: 'Le roi du moment', text: (ctx) => `${ctx.a.name} distribue 3 à qui il veut.`,
    run(app, ctx, area, done) { app.partyGive(area, ctx.a, 3, done); } },
  { id: 'pitie', icon: '🆘', title: 'Pitié pour le plus arrosé', text: (ctx) => `${ctx.most.name} a le plus pris jusqu’ici : il distribue 2 pour se venger.`,
    run(app, ctx, area, done) { app.partyGive(area, ctx.most, 2, done); } },
  { id: 'sage', icon: '😇', title: 'Trop sage', text: (ctx) => `${ctx.least.name} a le moins pris jusqu’ici : 2 pour rattraper.`,
    run(app, ctx, area, done) { area.append(h('p', { class: 'ev-sub', text: app.sanction(ctx.least, 2) })); done(); } },
  { id: 'regard', icon: '👀', title: 'Duel du regard', text: (ctx) => `${ctx.a.name} contre ${ctx.b.name} : fixez-vous dans les yeux. Le premier qui rit ou détourne le regard prend 2.`,
    run(app, ctx, area, done) { app.eventLoser(area, [ctx.a, ctx.b], 2, done); } },
  { id: 'pile', icon: '🪙', title: 'Pile ou face', text: (ctx) => `${ctx.a.name}, choisis ! Gagné : tu distribues 2. Perdu : tu prends 2.`,
    run(app, ctx, area, done) { app.eventCoin(area, ctx.a, done); } },
  { id: 'silence', icon: '🤫', title: 'Silence total', text: () => '20 secondes de silence absolu. Le premier qui parle (ou rit) prend 2.',
    run(app, ctx, area, done) { app.eventSilence(area, done); } },
  { id: 'jumeaux', icon: '👯', title: 'Les jumeaux', text: (ctx) => `${ctx.a.name} et ${ctx.b.name} sont liés : quand l’un boit, l’autre aussi, jusqu’au prochain événement.` },
  { id: 'mot', icon: '🚫', title: 'Mot interdit', text: (ctx) => `Jusqu’au prochain événement, interdit de dire « ${ctx.word} ». Qui le dit prend 1.` },
  { id: 'accent', icon: '🗣️', title: 'Accent imposé', text: (ctx) => `${ctx.a.name} parle avec l’accent ${ctx.accent} jusqu’à son prochain tour. Sinon : 2.` },
  { id: 'main', icon: '🫲', title: 'Mauvaise main', text: () => 'Jusqu’au prochain événement, tout le monde boit de sa main faible. Oubli = 1.' },
  { id: 'places', icon: '🔄', title: 'Chaises musicales', text: (ctx) => `${ctx.a.name} et ${ctx.b.name} échangent leur place, tout de suite !` },
  { id: 'chanson', icon: '🎤', title: 'Karaoké express', text: (ctx) => `${ctx.a.name} chante le refrain d’une chanson choisie par ${ctx.b.name}. Refus ou trou de mémoire : 3.`,
    run(app, ctx, area, done) { app.eventDidIt(area, ctx.a, 3, 'Il a chanté 🎶', 'Il a calé', done); } },
  { id: 'verite', icon: '🫵', title: 'Vérité express', text: (ctx) => `${ctx.b.name} pose une question à ${ctx.a.name}. Réponse franche, ou 3.`,
    run(app, ctx, area, done) { app.eventDidIt(area, ctx.a, 3, 'Il a répondu', 'Il a refusé', done); } },
  { id: 'selfie', icon: '🤳', title: 'Selfie grimace', text: () => 'Tout le monde dans le cadre pour un selfie grimace ! Le dernier prêt prend 1.',
    run(app, ctx, area, done) { app.eventLoser(area, app.game.players, 1, done, 'Qui était le dernier ?'); } },
  { id: 'compliment', icon: '💐', title: 'Minute douceur', text: (ctx) => `${ctx.a.name} fait un vrai compliment à chaque joueur. Personne ne boit… pour cette fois.` },
  { id: 'happy', icon: '⏩', title: 'Happy hour', text: () => 'Jusqu’au prochain événement, toutes les sanctions comptent double. À vous de suivre !' },
];
const EV_WORDS = ['oui', 'non', 'genre', 'boire', 'quoi', 'je', 'mec', 'grave', 'trop', 'en vrai'];
const EV_ACCENTS = ['marseillais', 'ch’ti', 'québécois', 'belge', 'anglais', 'italien', 'du Sud-Ouest', 'russe'];

addGame(class {
  get eventFreq() { return EVENT_FREQ[this.settings.events || 'rare'] || EVENT_FREQ.rare; }

  renderEventsOption() {
    const sec = $('#events-section');
    const g = this.gameDef;
    if (!sec || !g) return;
    sec.hidden = EVENT_SKIP.includes(g.kind) || this.isSeance;
    $('#events-grid').replaceChildren(...Object.entries(EVENT_FREQ).map(([id, o]) => this.pill({
      on: (this.settings.events || 'rare') === id, emoji: o.emoji, label: o.label, small: o.small,
      onClick: () => { this.settings.events = id; this.save(); this.renderEventsOption(); },
    })));
  }

  /** Appelé au début de chaque tour (depuis beginTurn) */
  maybeEvent() {
    const g = this.game;
    const p = this.eventFreq.p;
    if (!g || g.over || !p || this._restoring || EVENT_SKIP.includes(g.kind) || this.isSeance) return;
    if (g.kind === 'quiz' && this.settings.quizTimer) return;
    if (g.count < 2 || g.count - (g.lastEvent ?? -9) < 3) return;
    if (Math.random() >= p) return;
    g.lastEvent = g.count;
    this.later(() => { if (this.game === g && !g.over) this.showEvent(); }, 450);
  }

  /** La roue tourne, puis l'événement s'affiche */
  showEvent(forced = null) {
    const g = this.game;
    const players = g.players;
    const pick = shuffle(players.map((_, i) => i));
    const byTaken = [...players].sort((a, b) => b.taken - a.taken);
    const ctx = {
      a: players[pick[0]], b: players[pick[1] ?? pick[0]],
      most: byTaken[0], least: byTaken[byTaken.length - 1],
      word: EV_WORDS[randInt(0, EV_WORDS.length - 1)], accent: EV_ACCENTS[randInt(0, EV_ACCENTS.length - 1)],
    };
    const pool = EVENTS.filter((e) => players.length >= 2 || !['regard', 'jumeaux', 'places', 'chanson', 'verite'].includes(e.id));
    const ev = forced ? EVENTS.find((e) => e.id === forced) : pool[randInt(0, pool.length - 1)];
    const sheet = $('#event-sheet');
    const panel = $('#event-body');
    const reel = h('p', { class: 'ev-reel', text: '🎲' });
    panel.replaceChildren(h('p', { class: 'ev-kicker pixel', text: '// événement surprise' }), reel);
    sheet.hidden = false;
    sheet.classList.remove('closing');
    haptic(20);
    // la roue : des icônes qui défilent de plus en plus lentement
    const icons = EVENTS.map((e) => e.icon);
    let k = 0, delay = 60;
    const spin = () => {
      reel.textContent = icons[k % icons.length];
      k += 1;
      this.sound.tick(0.4);
      delay *= 1.16;
      if (delay < 320) setTimeout(spin, delay);
      else setTimeout(land, 260);
    };
    const close = () => {
      sheet.classList.add('closing');
      setTimeout(() => { sheet.hidden = true; sheet.classList.remove('closing'); }, 220);
      const scr = this.router.current;
      if (this.game === g && !g.over && this.router.screen(scr) && $('[data-score-list]', this.router.screen(scr))) this.renderScores(scr);
    };
    const land = () => {
      const area = h('div', { class: 'ev-area' });
      const ok = h('button', { class: 'btn-primary', text: 'C’EST NOTÉ ✓', onclick: once(close) });
      panel.replaceChildren(
        h('p', { class: 'ev-kicker pixel', text: '// événement surprise' }),
        h('p', { class: 'ev-icon', text: ev.icon }),
        h('p', { class: 'ev-title', text: ev.title }),
        h('p', { class: 'ev-text', text: ev.text(ctx) }),
        area);
      this.sound.reward();
      this.fx.flash('rgba(255,207,63,.25)');
      if (ev.run) ev.run(this, ctx, area, () => { area.append(h('div', { class: 'result-actions' }, ok)); });
      else area.append(h('div', { class: 'result-actions' }, ok));
    };
    spin();
  }

  /** Choisir qui a perdu parmi quelques joueurs */
  eventLoser(area, among, sips, done, label = 'Qui a perdu ?') {
    const chips = h('div', { class: 'chips' });
    const ok = h('button', { class: 'btn-primary', text: label.toUpperCase(), disabled: true });
    const sel = this.renderChips(chips, among, { onChange: (s) => { ok.disabled = !s.size; ok.textContent = s.size ? 'VALIDER' : label.toUpperCase(); } });
    ok.addEventListener('click', once(() => {
      const v = among.find((x) => sel.has(x.id));
      chips.remove(); ok.remove();
      area.append(h('p', { class: 'ev-sub', text: this.sanction(v, sips) }));
      this.sound.bad();
      done();
    }));
    area.append(chips, ok);
  }

  /** L'a fait / ne l'a pas fait */
  eventDidIt(area, p, sips, yes, no, done) {
    const row = h('div', { class: 'ev-row' },
      h('button', { class: 'btn-ghost', text: `✅ ${yes}`, onclick: once(() => { row.remove(); area.append(h('p', { class: 'ev-sub', text: 'Respect. Personne ne boit.' })); done(); }) }),
      h('button', { class: 'btn-ghost', text: `❌ ${no}`, onclick: once(() => { row.remove(); area.append(h('p', { class: 'ev-sub', text: this.sanction(p, sips) })); this.sound.bad(); done(); }) }));
    area.append(row);
  }

  /** Pile ou face, avec la pièce qui tourne */
  eventCoin(area, p, done) {
    const coin = h('p', { class: 'ev-coin', text: '🪙' });
    const choose = (side) => {
      row.remove();
      area.append(coin);
      coin.classList.add('flip');
      this.sound.tick(0.6);
      setTimeout(() => {
        const res = Math.random() < 0.5 ? 'pile' : 'face';
        coin.classList.remove('flip');
        coin.textContent = res === 'pile' ? '🦅 PILE' : '👑 FACE';
        if (res === side) {
          area.append(h('p', { class: 'ev-sub', text: `Gagné ! ${p.name} distribue 2.` }));
          this.sound.good();
          this.partyGive(area, p, 2, done);
        } else {
          area.append(h('p', { class: 'ev-sub', text: `Perdu… ${this.sanction(p, 2)}` }));
          this.sound.bad();
          done();
        }
      }, 1400);
    };
    const row = h('div', { class: 'ev-row' },
      h('button', { class: 'btn-ghost', text: '🦅 PILE', onclick: once(() => choose('pile')) }),
      h('button', { class: 'btn-ghost', text: '👑 FACE', onclick: once(() => choose('face')) }));
    area.append(row);
  }

  /** 20 secondes de silence, puis on désigne le bavard s'il y en a un */
  eventSilence(area, done) {
    const t = h('p', { class: 'ev-count', text: '20' });
    const start = h('button', { class: 'btn-primary', text: '🤫 LANCER LE SILENCE' });
    start.addEventListener('click', once(() => {
      start.remove();
      area.append(t);
      let n = 20;
      const iv = setInterval(() => {
        n -= 1;
        t.textContent = String(n);
        if (n <= 3 && n > 0) this.partyBeep();
        if (n <= 0) {
          clearInterval(iv);
          this.partyBeep(true);
          t.textContent = 'FINI !';
          const row = h('div', { class: 'ev-row' },
            h('button', { class: 'btn-ghost', text: '😇 Personne n’a parlé', onclick: once(() => { row.remove(); done(); }) }),
            h('button', { class: 'btn-ghost', text: '🗣️ Quelqu’un a parlé', onclick: once(() => { row.remove(); this.eventLoser(area, this.game.players, 2, done, 'Qui a parlé en premier ?'); }) }));
          area.append(row);
        }
      }, 1000);
    }));
    area.append(start);
  }
});
