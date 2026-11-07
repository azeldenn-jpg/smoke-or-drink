/**
 * SMOKE OR DRINK — La Roue des défis (mode soirée)
 * ------------------------------------------------------------------------------
 *  À chaque tour, la roue tourne et tombe sur une manche d'un autre jeu :
 *  question du quiz, Je n'ai jamais, Qui pourrait, Tu préfères, Plus ou moins,
 *  thème de la Bombe, carte du King's Cup, mime express, duel du regard ou
 *  événement surprise. Une manche, puis la roue repart pour le joueur suivant.
 * ------------------------------------------------------------------------------
 */
'use strict';

const ROUE_GAMES = [
  { id: 'quiz', icon: '🧠', label: 'Question de quiz' },
  { id: 'jamais', icon: '🙊', label: 'Je n’ai jamais' },
  { id: 'probable', icon: '👉', label: 'Qui pourrait…' },
  { id: 'preferes', icon: '🤔', label: 'Tu préfères…' },
  { id: 'plusmoins', icon: '🃏', label: 'Plus ou moins' },
  { id: 'theme', icon: '💣', label: 'Thème express' },
  { id: 'king', icon: '👑', label: 'Carte du King’s Cup' },
  { id: 'mime', icon: '🤐', label: 'Mime express' },
  { id: 'regard', icon: '👀', label: 'Duel du regard' },
  { id: 'event', icon: '🎲', label: 'Événement surprise' },
];

GAME_HOOKS.roue = {
  screen: 'roue',
  start() { this.roueStart(); },
  info(mix) { return `// ${ROUE_GAMES.length} mini-jeux tirés au sort · une manche chacun${mix}`; },
  stop() { this.roueStopTimer(); },
  score: {
    title() { return this.isMashup ? 'Données ↗ · prises ↘ (gorgées 🥃 / taffs 🌿)' : 'Données ↗ · prises ↘'; },
    line(p) { return { v: `${p.taken}|${p.given}`, main: `${p.taken} ${this.campOf(p) === 'alcool' ? '🥃' : '🌿'}`, small: ` · ${p.given}↗` }; },
    key(p) { return p.taken; },
  },
  end: {
    kicker() { return '// la roue des défis'; },
    crown: 'Le plus servi par la roue',
    key(p) { return p.taken; },
    line(p) { return { main: `${p.taken} ${this.campOf(p) === 'alcool' ? '🥃' : '🌿'}`, sub: `${p.given} distribuées · ${plural(p.spins || 0, 'tour')} de roue` }; },
  },
};

addGame(class {
  roueStart() {
    const g = this.game;
    g.turn = randInt(0, g.players.length - 1);
    g.decks = {
      quiz: new Deck(this.data.quiz.filter((q) => q.diff !== 'hard')),
      jamais: new Deck(this.cardPool('jamais')),
      probable: new Deck(this.cardPool('probable')),
      theme: new Deck(this.cardPool('bombe')),
      preferes: new Deck(this.pfPool()),
      mime: new Deck(Object.values(TIMESUP_WORDS).flatMap((c) => c.words)),
    };
    g.players.forEach((p) => { p.spins = 0; });
    this.roueTurn();
  }

  roueStopTimer() {
    const g = this.game;
    if (g && g.roueTimer) { clearInterval(g.roueTimer); g.roueTimer = null; }
  }

  roueTurn() {
    this.beginTurn('roueTurn');
    this.roueStopTimer();
    const g = this.game;
    const p = g.players[g.turn];
    if (this.isMashup) this.setTheme(p.camp);
    $('#roue-round').textContent = `TOUR ${g.count + 1}`;
    const name = $('#roue-name');
    name.style.setProperty('--pc', p.color);
    name.replaceChildren(h('span', { class: `dot${p.emoji ? ' emo' : ''}`, text: p.emoji || '' }), h('span', { class: 'name', text: p.name }));
    $('#roue-reel').replaceChildren(h('span', { class: 'rr-icon', text: '🎪' }), h('span', { class: 'rr-label', text: 'La roue t’attend' }));
    $('#roue-reel').className = 'roue-reel';
    $('#roue-area').replaceChildren(h('div', { class: 'result-actions' },
      h('button', { class: 'btn-primary pulse', text: '🎪 FAIRE TOURNER LA ROUE', onclick: once(() => this.roueSpin()) })));
    this.renderScores('roue');
  }

  roueSpin() {
    const g = this.game;
    const p = g.players[g.turn];
    p.spins = (p.spins || 0) + 1;
    const pick = ROUE_GAMES[randInt(0, ROUE_GAMES.length - 1)];
    const reel = $('#roue-reel');
    reel.classList.add('spinning');
    $('#roue-area').replaceChildren();
    haptic(20);
    let k = randInt(0, ROUE_GAMES.length - 1), delay = 55;
    const step = () => {
      const it = ROUE_GAMES[k % ROUE_GAMES.length];
      reel.replaceChildren(h('span', { class: 'rr-icon', text: it.icon }), h('span', { class: 'rr-label', text: it.label }));
      k += 1;
      this.sound.tick(0.45);
      delay *= 1.14;
      if (delay < 300) setTimeout(step, delay);
      else {
        reel.classList.remove('spinning');
        reel.classList.add('landed');
        reel.replaceChildren(h('span', { class: 'rr-icon', text: pick.icon }), h('span', { class: 'rr-label', text: pick.label }));
        this.sound.reward();
        haptic([30, 30, 60]);
        setTimeout(() => { if (this.game === g && !g.over) this.rouePlay(pick.id); }, 500);
      }
    };
    step();
  }

  /** Bouton « joueur suivant » commun */
  roueNextBtn(area) {
    area.append(h('div', { class: 'result-actions' }, h('button', { class: 'btn-primary', text: 'JOUEUR SUIVANT →', onclick: once(() => this.roueNext()) })));
  }

  roueNext() {
    const g = this.game;
    g.count += 1;
    g.turn = (g.turn + 1) % g.players.length;
    this.roueTurn();
  }

  roueCard(...nodes) { return h('div', { class: 'roue-card' }, ...nodes.filter(Boolean)); }

  rouePlay(id) {
    const g = this.game;
    const p = g.players[g.turn];
    const area = $('#roue-area');
    const done = () => { this.renderScores('roue'); this.roueNextBtn(area); };
    const say = (cls, verdict, line) => area.append(h('div', { class: `result ${cls}` }, h('p', { class: 'verdict', text: verdict }), line ? h('p', { class: 'sub', text: line }) : null));

    if (id === 'quiz') {
      const q = g.decks.quiz.draw();
      const order = shuffle(q.choices.map((c, i) => i));
      const card = this.roueCard(h('p', { class: 'rc-kicker', text: `${p.name}, à toi !` }), h('p', { class: 'rc-text', text: q.q }));
      const btns = h('div', { class: 'roue-choices' }, order.map((i) => h('button', { class: 'roue-choice', text: q.choices[i], onclick: once(() => {
        $$('.roue-choice', btns).forEach((b) => { b.disabled = true; });
        const right = i === q.answer;
        $$('.roue-choice', btns).forEach((b) => { if (b.textContent === q.choices[q.answer]) b.classList.add('good'); });
        if (right) {
          say('good', 'BONNE RÉPONSE !', 'Tu distribues 2.');
          this.sound.good();
          this.partyGive(area, p, 2, done);
        } else {
          say('bad', 'RATÉ', `${q.fact ? q.fact + ' · ' : ''}${this.sanction(p, 2)}`);
          this.sound.bad();
          done();
        }
      }) })));
      area.replaceChildren(card, btns);
      return;
    }
    if (id === 'jamais') {
      const t = g.decks.jamais.draw();
      const chips = h('div', { class: 'chips' });
      const sel = this.renderChips(chips, g.players, { multi: true });
      area.replaceChildren(this.roueCard(h('p', { class: 'rc-kicker', text: `${p.name} lit :` }), h('p', { class: 'rc-text', text: `Je n’ai jamais ${t}` })),
        h('p', { class: 'give-label', text: 'Qui l’a déjà fait ? (1 chacun)' }), chips,
        h('div', { class: 'result-actions' }, h('button', { class: 'btn-primary', text: 'VALIDER', onclick: once(() => {
          const who = g.players.filter((x) => sel.has(x.id));
          chips.remove();
          say(who.length ? 'bad' : 'good', who.length ? 'SANTÉ !' : 'PERSONNE ?! VRAIMENT ?', who.map((x) => this.sanction(x, 1)).join(' · '));
          done();
        }) })));
      return;
    }
    if (id === 'probable' || id === 'regard' || id === 'theme') {
      let text, ask, sips = 2, among = g.players;
      if (id === 'probable') { text = `Qui est le plus susceptible de ${g.decks.probable.draw()} ?`; ask = '3, 2, 1… pointez ! Qui a le plus de doigts ?'; }
      if (id === 'theme') { text = `Thème : ${g.decks.theme.draw()}`; ask = `Chacun son tour cite un élément, en commençant par ${p.name}. Le premier qui sèche ou répète prend 2.`; }
      if (id === 'regard') {
        const o = shuffle(g.players.filter((x) => x.id !== p.id))[0];
        among = [p, o];
        sips = 3;
        text = `${p.name} contre ${o.name}`;
        ask = 'Fixez-vous dans les yeux. Le premier qui rit ou détourne le regard prend 3.';
      }
      const chips = h('div', { class: 'chips' });
      const ok = h('button', { class: 'btn-primary', text: 'QUI A PERDU ?', disabled: true });
      const sel = this.renderChips(chips, among, { onChange: (s) => { ok.disabled = !s.size; ok.textContent = s.size ? 'VALIDER' : 'QUI A PERDU ?'; } });
      ok.addEventListener('click', once(() => {
        const v = among.find((x) => sel.has(x.id));
        chips.remove(); ok.remove();
        say('bad', 'PERDU !', this.sanction(v, sips));
        this.sound.bad();
        done();
      }));
      area.replaceChildren(this.roueCard(h('p', { class: 'rc-text', text }), h('p', { class: 'rc-sub', text: ask })), chips, h('div', { class: 'result-actions' }, ok));
      return;
    }
    if (id === 'preferes') {
      const [a, b] = g.decks.preferes.draw();
      const chips = h('div', { class: 'chips' });
      const sel = this.renderChips(chips, g.players, { multi: true });
      area.replaceChildren(this.roueCard(h('p', { class: 'rc-kicker', text: 'Tu préfères…' }),
        h('p', { class: 'rc-text', text: `👈 ${a}` }), h('p', { class: 'rc-or', text: 'ou' }), h('p', { class: 'rc-text', text: `${b} 👉` }),
        h('p', { class: 'rc-sub', text: '3, 2, 1… tout le monde pointe en même temps !' })),
        h('p', { class: 'give-label', text: 'Qui a choisi la première ?' }), chips,
        h('div', { class: 'result-actions' }, h('button', { class: 'btn-primary', text: 'VALIDER', onclick: once(() => {
          const A = g.players.filter((x) => sel.has(x.id));
          const B = g.players.filter((x) => !sel.has(x.id));
          chips.remove();
          if (!A.length || !B.length) say('good', 'UNANIMITÉ', 'Personne ne boit.');
          else if (A.length === B.length) say('bad', 'ÉGALITÉ', g.players.map((x) => this.sanction(x, 1)).join(' · '));
          else say('bad', 'LA MINORITÉ TRINQUE', (A.length < B.length ? A : B).map((x) => this.sanction(x, 2)).join(' · '));
          done();
        }) })));
      return;
    }
    if (id === 'plusmoins') {
      const deck = deck52();
      const c1 = deck.pop();
      let c2 = deck.pop();
      while (c2.r === c1.r) c2 = deck.pop();
      const cur = flipCard(c1);
      const nxt = flipCard();
      const guess = (up) => {
        btns.remove();
        nxt.show(c2);
        setTimeout(() => {
          if ((c2.r > c1.r) === up) { say('good', 'BIEN VU !', 'Tu distribues 2.'); this.sound.good(); this.partyGive(area, p, 2, done); }
          else { say('bad', 'RATÉ', this.sanction(p, 2)); this.sound.bad(); done(); }
        }, 700);
      };
      const btns = h('div', { class: 'pm-btns two' },
        h('button', { class: 'pm-btn up', onclick: once(() => guess(true)) }, h('b', { text: '⬆ PLUS' })),
        h('button', { class: 'pm-btn down', onclick: once(() => guess(false)) }, h('b', { text: '⬇ MOINS' })));
      area.replaceChildren(h('div', { class: 'pm-table' }, cur, h('span', { class: 'pm-arrow', text: '→' }), nxt), btns);
      return;
    }
    if (id === 'king') {
      const c = deck52()[0];
      const map = this.kcMap;
      const rule = KC_RULES[map[c.r] || KC_DEFAULT[c.r]];
      area.replaceChildren(h('div', { class: 'kc-stage' }, flipCard(c), h('div', { class: 'kc-rule' },
        h('p', { class: 'kc-icon', text: rule.icon }), h('p', { class: 'kc-title', text: `${rankName(c.r)} · ${rule.title}` }), h('p', { class: 'kc-text', text: this.kcText(rule) }))));
      if (rule.act === 'give') this.partyGive(area, p, rule.n, done);
      else if (rule.act === 'self') { say('bad', 'POUR TOI', this.sanction(p, rule.n)); done(); }
      else if (rule.act === 'all') { say('bad', 'TOUT LE MONDE', g.players.map((x) => this.sanction(x, rule.n)).join(' · ')); done(); }
      else if (rule.act === 'jamais') { area.append(h('p', { class: 'kc-quote', text: `Je n’ai jamais ${g.decks.jamais.draw()}` })); done(); }
      else done();
      return;
    }
    if (id === 'mime') {
      const w = g.decks.mime.draw();
      const secs = h('b', { class: 'tu-secs', text: '30' });
      const word = h('div', { class: 'tu-word' }, h('span', { class: 'tu-cat', text: `${p.name} mime, sans un bruit` }), h('p', { class: 'tu-w', text: '???' }));
      const reveal = h('button', { class: 'btn-primary', text: '👁️ VOIR LE MOT (CACHÉ AUX AUTRES) ET LANCER 30 S' });
      const finish = (found) => {
        this.roueStopTimer();
        word.replaceChildren(h('span', { class: 'tu-cat', text: 'C’était' }), h('p', { class: 'tu-w', text: w }));
        $$('.roue-mime-btns', area).forEach((x) => x.remove());
        if (found) { say('good', 'TROUVÉ !', `${p.name} distribue 1.`); this.partyGive(area, p, 1, done); }
        else { say('bad', 'PERSONNE N’A TROUVÉ', this.sanction(p, 2)); this.sound.bad(); done(); }
      };
      reveal.addEventListener('click', once(() => {
        reveal.remove();
        $('.tu-w', word).textContent = w;
        let n = 30;
        g.roueTimer = setInterval(() => {
          if (this.game !== g || g.over) { this.roueStopTimer(); return; }
          n -= 1;
          secs.textContent = String(n);
          if (n <= 5 && n > 0) this.partyBeep();
          if (n <= 0) finish(false);
        }, 1000);
        area.append(h('div', { class: 'ev-row roue-mime-btns' },
          h('button', { class: 'btn-ghost', text: '❌ ABANDON', onclick: once(() => finish(false)) }),
          h('button', { class: 'btn-primary', text: '✓ TROUVÉ !', onclick: once(() => finish(true)) })));
      }));
      area.replaceChildren(h('div', { class: 'tu-timer' }, h('span', { class: 'rc-sub', text: 'Les autres devinent à voix haute' }), secs), word, reveal);
      return;
    }
    // événement surprise
    area.replaceChildren(h('p', { class: 'rc-sub', text: 'La roue déclenche un événement…' }));
    this.showEvent();
    done();
  }
});
