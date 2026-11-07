/**
 * SMOKE OR DRINK — Time's Up
 * ------------------------------------------------------------------------------
 *  Deux équipes, les mêmes mots sur 3 manches :
 *   1. Décris (tout sauf le mot)   2. Un seul mot   3. Mime (aucun son)
 *  Chaque tour : un joueur a 30 s pour faire deviner un maximum de mots à son
 *  équipe. « Passer » remet le mot en fin de pile. Une manche se termine quand
 *  tous les mots sont trouvés. L'équipe qui perd une manche boit l'écart
 *  (5 max par joueur) ; à la fin, l'équipe perdante boit 3.
 * ------------------------------------------------------------------------------
 */
'use strict';

const TU_ROUNDS = [
  { title: 'Décris', icon: '🗣️', rule: 'Fais deviner avec autant de mots que tu veux… sauf le mot lui-même (ni une partie, ni une traduction).' },
  { title: 'Un seul mot', icon: '☝️', rule: 'Un seul mot pour faire deviner. Un seul ! Ton équipe n’a droit qu’à une proposition par mot.' },
  { title: 'Mime', icon: '🤐', rule: 'Aucun son, aucun mot : tu mimes. Les bruitages sont interdits aussi !' },
];
const TU_TEAMS = [{ name: 'Rouge', emoji: '🔴', color: '#ff5e7e' }, { name: 'Bleue', emoji: '🔵', color: '#5ec8ff' }];
const TU_MAX_GAP = 5;    // gorgées max par joueur pour l'équipe qui perd une manche
const TU_FINAL = 3;      // gorgées pour l'équipe perdante à la fin

GAME_HOOKS.timesup = {
  screen: 'timesup',
  start() { this.tuStart(); },
  setup() { this.renderTimesUpOptions(); },
  info(mix) {
    const n = this.players.length;
    return `// 2 équipes (${Math.ceil(n / 2)} contre ${Math.floor(n / 2)}) · ${this.settings.tuCards || 40} mots · ${this.settings.tuTime || 30} s par tour · 3 manches${mix}`;
  },
  stop() { this.tuStopTimer(); },
  score: {
    title() { return 'Faiseurs · mots trouvés'; },
    line(p) { const t = TU_TEAMS[p.team] || TU_TEAMS[0]; return { v: `${p.score}|${p.taken}`, main: `${p.score} ✓`, small: ` · ${t.emoji}${p.taken ? ` · ${p.taken} ${this.campOf(p) === 'alcool' ? '🥃' : '🌿'}` : ''}` }; },
    key(p) { return p.score; },
  },
  end: {
    kicker() {
      const g = this.game;
      const [a, b] = g.teams.map((t) => t.total);
      return a === b ? `// égalité ${a} partout` : `// équipe ${TU_TEAMS[a > b ? 0 : 1].name.toLowerCase()} gagne ${Math.max(a, b)} à ${Math.min(a, b)}`;
    },
    crown: 'Le meilleur faiseur',
    key(p) { return p.score; },
    line(p) { const t = TU_TEAMS[p.team] || TU_TEAMS[0]; return { main: `${p.score} ✓`, sub: `${t.emoji} équipe ${t.name.toLowerCase()} · ${p.taken} ${this.campOf(p) === 'alcool' ? 'gorgées bues' : 'taffs prises'}` }; },
  },
};

addGame(class {
  renderTimesUpOptions() {
    const grid = (id, opts, key, def) => $(id).replaceChildren(...opts.map((o) => this.pill({
      on: String(this.settings[key] || def) === String(o.id), emoji: o.emoji, label: o.label, small: o.small,
      onClick: () => { this.settings[key] = o.id; this.save(); this.renderTimesUpOptions(); this.validateSetup(); },
    })));
    grid('#tucards-grid', [
      { id: 30, emoji: '⚡', label: '30 mots', small: '~25 min' },
      { id: 40, emoji: '🎯', label: '40 mots', small: '~35 min' },
      { id: 50, emoji: '🔥', label: '50 mots', small: '~45 min' },
    ], 'tuCards', 40);
    grid('#tutime-grid', [
      { id: 30, emoji: '⏱️', label: '30 s', small: 'nerveux' },
      { id: 45, emoji: '⏳', label: '45 s', small: 'plus cool' },
    ], 'tuTime', 30);
    grid('#tuteams-grid', [
      { id: 'ordre', emoji: '↔️', label: 'Un sur deux', small: 'dans l’ordre de la liste' },
      { id: 'hasard', emoji: '🔀', label: 'Au hasard', small: 'tirées au sort' },
    ], 'tuTeams', 'ordre');
  }

  tuStart() {
    const g = this.game;
    const n = g.players.length;
    const order = this.settings.tuTeams === 'hasard' ? shuffle(g.players.map((_, i) => i)) : g.players.map((_, i) => i);
    g.teams = [0, 1].map(() => ({ members: [], pts: [0, 0, 0], total: 0, next: 0 }));
    order.forEach((pi, k) => { g.teams[k % 2].members.push(pi); g.players[pi].team = k % 2; });
    // Les mots de la partie, pris dans tous les thèmes
    const all = [];
    Object.values(TIMESUP_WORDS).forEach((cat) => cat.words.forEach((w) => all.push({ w, cat: cat.label, e: cat.emoji })));
    const seen = new Set();
    g.words = shuffle(all).filter((x) => (seen.has(x.w) ? false : seen.add(x.w))).slice(0, Number(this.settings.tuCards) || 40);
    g.manche = 0;
    g.team = randInt(0, 1);
    g.time = Number(this.settings.tuTime) || 30;
    void n;
    this.tuNewManche();
  }

  tuTeamsBar() {
    const g = this.game;
    $('#tu-teams').replaceChildren(...g.teams.map((t, k) => h('div', { class: `tu-team${g.team === k ? ' is-on' : ''}`, style: { '--tc': TU_TEAMS[k].color } },
      h('span', { class: 'tu-tname', text: `${TU_TEAMS[k].emoji} ${TU_TEAMS[k].name}` }),
      h('span', { class: 'tu-tmem', text: t.members.map((i) => g.players[i].emoji || g.players[i].name.slice(0, 1)).join(' ') }),
      h('b', { class: 'tu-tpts', text: String(t.total) }))));
  }

  tuNewManche() {
    const g = this.game;
    g.remaining = shuffle(g.words.slice());
    const r = TU_ROUNDS[g.manche];
    $('#tu-round').textContent = `MANCHE ${g.manche + 1}/3`;
    this.tuIntro(true);
    void r;
  }

  /** Écran avant un tour : la règle de la manche et qui fait deviner */
  tuIntro(newManche = false) {
    const g = this.game;
    const team = g.teams[g.team];
    const pi = team.members[team.next % team.members.length];
    g.turn = pi;
    const p = g.players[pi];
    const r = TU_ROUNDS[g.manche];
    this.tuTeamsBar();
    $('#tu-main').replaceChildren(
      h('div', { class: `tu-rule${newManche ? ' fresh' : ''}` },
        h('p', { class: 'tu-rnum pixel', text: `manche ${g.manche + 1}` }),
        h('p', { class: 'tu-rtitle', text: `${r.icon} ${r.title}` }),
        h('p', { class: 'tu-rtext', text: r.rule })),
      h('p', { class: 'turn-label pixel', text: `// équipe ${TU_TEAMS[g.team].name.toLowerCase()} · ${g.remaining.length} mots à trouver` }),
      h('p', { class: 'turn-name', style: { '--pc': TU_TEAMS[g.team].color } }, h('span', { class: `dot${p.emoji ? ' emo' : ''}`, text: p.emoji || '' }), h('span', { class: 'name', text: p.name })),
      h('p', { class: 'tu-hint', text: `Prends le téléphone, ${p.name}. Ton équipe devine, l’autre surveille !` }),
      h('div', { class: 'result-actions' }, h('button', { class: 'btn-primary pulse', text: `▶ GO · ${g.time} S`, onclick: once(() => this.tuPlay()) })));
    this.renderScores('timesup');
  }

  tuStopTimer() {
    const g = this.game;
    if (g && g.tuTimer) { clearInterval(g.tuTimer); g.tuTimer = null; }
  }

  /** Le tour : chrono, mot affiché, « trouvé » / « passer » */
  tuPlay() {
    const g = this.game;
    const p = g.players[g.turn];
    g.found = [];
    g.tuEnd = Date.now() + g.time * 1000;
    this.sound.unlock();
    this.partyBeep(true);
    haptic(20);
    const secs = h('b', { class: 'tu-secs', text: String(g.time) });
    const fill = h('i', { class: 'tu-fill' });
    const word = h('div', { class: 'tu-word' });
    const left = h('p', { class: 'tu-left pixel' });
    const pass = h('button', { class: 'tu-btn pass', 'aria-label': 'Passer ce mot' }, h('b', { text: '✗' }), h('small', { text: 'passer' }));
    const ok = h('button', { class: 'tu-btn ok', 'aria-label': 'Mot trouvé' }, h('b', { text: '✓' }), h('small', { text: 'trouvé !' }));
    const show = () => {
      const c = g.remaining[0];
      word.replaceChildren(h('span', { class: 'tu-cat', text: `${c.e} ${c.cat}` }), h('p', { class: 'tu-w', text: c.w }));
      replay(word, 'pop-val');
      left.textContent = `${g.remaining.length} mot${g.remaining.length > 1 ? 's' : ''} restant${g.remaining.length > 1 ? 's' : ''}`;
    };
    ok.addEventListener('click', () => {
      if (!g.tuTimer) return;
      const c = g.remaining.shift();
      g.found.push(c);
      g.teams[g.team].pts[g.manche] += 1;
      g.teams[g.team].total += 1;
      p.score += 1;
      this.sound.good();
      haptic(15);
      this.tuTeamsBar();
      if (!g.remaining.length) { this.tuEndTurn(true); return; }
      show();
    });
    pass.addEventListener('click', () => {
      if (!g.tuTimer || g.remaining.length < 2) return;
      g.remaining.push(g.remaining.shift());
      this.sound.tick(0.4);
      haptic(8);
      show();
    });
    $('#tu-main').replaceChildren(
      h('div', { class: 'tu-timer' }, h('span', { class: 'tu-bar' }, fill), secs),
      word, left,
      h('div', { class: 'tu-btns' }, pass, ok));
    show();
    let lastBeep = g.time + 1;
    g.tuTimer = setInterval(() => {
      if (this.game !== g || g.over) { clearInterval(g.tuTimer); return; }
      const ms = Math.max(0, g.tuEnd - Date.now());
      const s = Math.ceil(ms / 1000);
      secs.textContent = String(s);
      fill.style.width = `${(ms / (g.time * 1000)) * 100}%`;
      fill.classList.toggle('hurry', s <= 5);
      if (s <= 5 && s < lastBeep && s > 0) { lastBeep = s; this.partyBeep(); }
      if (ms <= 0) this.tuEndTurn(false);
    }, 100);
  }

  tuEndTurn(cleared) {
    const g = this.game;
    this.tuStopTimer();
    const team = g.teams[g.team];
    team.next += 1;
    if (!cleared) { this.sound.tone(160, 0.5, { type: 'sawtooth', vol: 0.12 }); this.sound.tone(120, 0.6, { type: 'sawtooth', vol: 0.1, at: 0.25 }); }
    else this.sound.reward();
    const n = g.found.length;
    this.tuTeamsBar();
    const done = !g.remaining.length;
    $('#tu-main').replaceChildren(
      h('div', { class: `result ${n ? 'good' : 'bad'}` },
        h('p', { class: 'verdict', text: cleared ? 'TOUS TROUVÉS !' : '⏱️ TEMPS ÉCOULÉ' }),
        h('p', { class: 'line', text: `+${n} pour l’équipe ${TU_TEAMS[g.team].name.toLowerCase()}` })),
      ...(n ? [h('div', { class: 'tu-found' }, g.found.map((c) => h('span', { text: c.w })))] : []),
      h('div', { class: 'result-actions' }, h('button', { class: 'btn-primary', text: done ? 'FIN DE LA MANCHE →' : 'ÉQUIPE SUIVANTE →', onclick: once(() => {
        g.count += 1;
        g.team = 1 - g.team;
        if (done) this.tuEndManche(); else this.tuIntro();
      }) })));
    this.renderScores('timesup');
  }

  /** Fin de manche : l'équipe qui a perdu la manche boit l'écart */
  tuEndManche() {
    const g = this.game;
    const m = g.manche;
    const [a, b] = g.teams.map((t) => t.pts[m]);
    const lines = [];
    let title;
    if (a === b) title = `Égalité ${a} partout`;
    else {
      const lose = a < b ? 0 : 1;
      const gap = Math.min(Math.abs(a - b), TU_MAX_GAP);
      title = `L’équipe ${TU_TEAMS[lose].name.toLowerCase()} perd la manche de ${Math.abs(a - b)}`;
      g.teams[lose].members.forEach((pi) => lines.push(this.sanction(g.players[pi], gap)));
    }
    const last = m >= TU_ROUNDS.length - 1;
    this.tuTeamsBar();
    $('#tu-main').replaceChildren(
      h('div', { class: 'tu-score' }, ...g.teams.map((t, k) => h('div', { style: { '--tc': TU_TEAMS[k].color } },
        h('span', { text: `${TU_TEAMS[k].emoji} ${TU_TEAMS[k].name}` }), h('b', { text: String(t.pts[m]) })))),
      h('div', { class: 'result bad' }, h('p', { class: 'verdict', text: title }), ...lines.map((l) => h('p', { class: 'sub', text: l }))),
      h('div', { class: 'result-actions' }, h('button', { class: 'btn-primary pulse', text: last ? '🏆 RÉSULTATS' : `MANCHE ${m + 2} : ${TU_ROUNDS[m + 1].title.toUpperCase()} →`, onclick: once(() => {
        if (last) { this.tuFinal(); return; }
        g.manche += 1;
        this.tuNewManche();
      }) })));
    this.renderScores('timesup');
  }

  tuFinal() {
    const g = this.game;
    const [a, b] = g.teams.map((t) => t.total);
    const lines = [];
    let title;
    if (a === b) title = `Égalité parfaite, ${a} partout !`;
    else {
      const win = a > b ? 0 : 1;
      title = `L’équipe ${TU_TEAMS[win].name.toLowerCase()} gagne ${Math.max(a, b)} à ${Math.min(a, b)} !`;
      g.teams[1 - win].members.forEach((pi) => lines.push(this.sanction(g.players[pi], TU_FINAL)));
      this.fx.confetti([TU_TEAMS[win].color, '#ffffff', '#ffcf3f']);
    }
    this.sound.reward();
    $('#tu-main').replaceChildren(
      h('div', { class: 'result good' }, h('p', { class: 'verdict', text: title }), ...lines.map((l) => h('p', { class: 'sub', text: l }))),
      h('div', { class: 'result-actions' }, h('button', { class: 'btn-primary', text: 'VOIR LE CLASSEMENT 🏆', onclick: once(() => this.finish()) })));
    this.renderScores('timesup');
  }
});
