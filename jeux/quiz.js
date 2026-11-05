/**
 * SMOKE OR DRINK — Quiz Culture G + Mashup (fumeurs et buveurs)
 */
'use strict';

addGame(class {
  /* ---------------------------------------------------------------------- */
  /* QUIZ                                                                    */
  /* ---------------------------------------------------------------------- */
  quizTurn() {
    this.beginTurn('quizTurn');
    const g = this.game;
    if (this.checkEnd()) { this.finish(); return; }
    const p = g.players[g.turn];
    g.answered = false;
    if (this.isMashup) this.setTheme(p.camp);
    this.setTurnName($('#quiz-player'), p);
    $('#quiz-round').textContent = `MANCHE ${g.round}${g.end.rounds ? '/' + g.end.rounds : ''}`;
    const streak = $('#quiz-streak');
    streak.textContent = p.streak >= 2 ? `🔥 série de ${p.streak}` : '';
    this.renderScores('quiz');

    if (this.settings.quizBuzzer) {
      // Mode buzzer : la question est pour tout le monde, le premier qui se désigne répond
      const tn = $('#quiz-player');
      tn.style.removeProperty('--pc');
      $('.dot', tn).textContent = '🔔';
      $('.dot', tn).classList.add('emo');
      $('.name', tn).textContent = 'Tout le monde';
      streak.textContent = '';
      if (this.isMashup) this.setTheme('mashup');
      this.renderQuestion(this.drawQuestion('all'), { buzz: true });
    } else if (this.settings.diff === 'bet') this.renderBet(p);
    else this.renderQuestion(this.drawQuestion('all'));
  }

  /* ---------- Chrono (option) ---------- */
  startQuizTimer() {
    const g = this.game;
    if (!this.settings.quizTimer || !g) return;
    const secs = 15;
    const bar = $('#quiz-stage .q-timer i');
    if (bar) {
      bar.style.transition = 'none';
      bar.style.transform = 'scaleX(1)';
      void bar.offsetWidth;
      bar.style.transition = `transform ${secs}s linear`;
      bar.style.transform = 'scaleX(0)';
    }
    const q = g.current;
    for (let s = secs - 3; s < secs; s++) this.later(() => { if (!g.answered && g.current === q) this.sound.beep(); }, s * 1000);
    this.later(() => { if (!g.answered && g.current === q) this.answerQuiz(false, null, true); }, secs * 1000);
  }

  drawQuestion(deckKey) {
    const deck = this.game.decks[deckKey];
    const q = deck.draw();
    if (deck.reshuffled) this.toast('🔀 Toutes les questions sont passées, on remélange !');
    return q;
  }

  renderBet(p) {
    const fum = this.campOf(p) === 'fumette';
    const mash = this.isMashup;
    const cards = Object.entries(CONFIG.DIFFS).map(([key, d], i) => {
      const empty = this.game.decks[key].size === 0;
      return h('button', {
        class: 'bet-card', style: { '--dc': d.color, '--i': i }, disabled: empty,
        onclick: once((e) => {
          haptic(15);
          this.sound.tap();
          e.currentTarget.classList.add('picked');
          $$('.bet-card').forEach((b) => { b.disabled = true; });
          this.later(() => this.renderQuestion(this.drawQuestion(key)), reducedMotion.matches ? 0 : 380);
        }),
      },
      h('span', { class: 'be', text: d.emoji }),
      h('span', { class: 'bn', text: d.name }),
      h('span', { class: 'bv', text: mash ? `${d.value} ${fum ? '🌿' : '🥃'}` : fum ? `+${d.value} pt${d.value > 1 ? 's' : ''}` : `${d.value} 🥃` }),
      h('span', { class: 'bl', text: empty ? 'aucune question' : mash ? (fum ? 'garder ou balancer' : 'à donner ou à boire') : fum ? 'si bonne réponse' : 'à donner ou à boire' }));
    });
    $('#quiz-stage').replaceChildren(h('div', { class: 'bet' },
      h('p', { class: 'bet-title', text: `${p.name}, choisis ta mise` }),
      h('p', { class: 'bet-sub', text: mash
        ? (fum ? 'Bonne réponse : des jetons pour ta jauge ou pour saboter. Raté : ta jauge descend.' : 'Bonne réponse : tu distribues. Raté : tu bois ta mise.')
        : fum ? 'Plus c’est dur, plus ça rapporte.' : 'Plus tu mises, plus tu distribues… ou plus tu bois.' }),
      h('div', { class: 'bet-grid' }, cards)));
  }

  renderQuestion(q, { buzz = false } = {}) {
    const g = this.game;
    const cat = CONFIG.CATEGORIES[q.cat] || CONFIG.UNKNOWN_CATEGORY;
    const diff = CONFIG.DIFFS[q.diff];
    // Les choix sont mélangés à chaque fois : la bonne réponse n'est plus toujours "B"
    const order = shuffle(q.choices.map((_, i) => i));
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    g.current = { q, value: diff.value };

    const choices = order.map((orig, i) => h('button', {
      class: 'choice', style: { '--i': i }, dataset: { orig },
      onclick: (e) => this.answerQuiz(orig === q.answer, e.currentTarget),
    }, h('span', { class: 'letter', text: letters[i] }), h('span', { text: q.choices[orig] })));

    let buzzBox = null;
    if (buzz) {
      choices.forEach((b) => { b.disabled = true; });
      const chips = h('div', { class: 'chips' });
      buzzBox = h('div', { class: 'buzz-box' }, h('p', { class: 'chips-label', text: '🔔 Qui buzze en premier ?' }), chips);
      this.renderChips(chips, g.players, {
        onChange: (sel) => {
          const idx = g.players.findIndex((x) => sel.has(x.id));
          if (idx < 0 || g.buzzed) return;
          g.buzzed = true;
          g.turn = idx;
          const p = g.players[idx];
          this.setTurnName($('#quiz-player'), p);
          if (this.isMashup) this.setTheme(p.camp);
          this.sound.reward();
          haptic([40, 30, 40]);
          buzzBox.replaceChildren(h('p', { class: 'chips-label', text: `🔔 ${p.name} répond !` }));
          choices.forEach((b) => { b.disabled = false; });
          this.renderScores('quiz');
          this.startQuizTimer();
        },
      });
    }
    g.buzzed = false;
    $('#quiz-stage').replaceChildren(h('article', { class: 'q-card', style: { '--cat': cat.color } },
      this.settings.quizTimer ? h('div', { class: 'q-timer' }, h('i')) : null,
      h('div', { class: 'q-meta' },
        h('span', { class: 'tag', style: { '--tc': cat.color }, text: `${cat.emoji} ${cat.name.toUpperCase()}` }),
        h('span', { class: 'tag', style: { '--tc': diff.color }, text: `${diff.emoji} ${diff.name.toUpperCase()} · ${diff.value}` })),
      h('p', { class: 'q-text', text: q.q }),
      buzzBox,
      h('div', { class: 'choices' }, choices),
      h('div', { class: 'result-area' })));
    if (!buzz) this.startQuizTimer();
  }

  answerQuiz(correct, btnEl, timeout = false) {
    const g = this.game;
    if (!g || g.answered) return;
    g.answered = true;
    const bar = $('#quiz-stage .q-timer');
    if (bar) bar.classList.add('stopped');
    if (timeout) this.toast('⏱ Temps écoulé !', 'bad');
    const { q, value } = g.current;
    const p = g.players[g.turn];
    const fum = this.mode === 'fumette';

    $$('#quiz-stage .choice').forEach((b) => {
      b.disabled = true;
      const orig = Number(b.dataset.orig);
      if (orig === q.answer) b.classList.add('correct');
      else if (b === btnEl) b.classList.add('wrong');
      else b.classList.add('faded');
    });

    const area = $('#quiz-stage .result-area');
    const actions = h('div', { class: 'result-actions' });
    const continueBtn = (label = 'CONTINUER →') => h('button', { class: 'btn-primary', text: label, onclick: once(() => this.quizNext()) });

    if (this.isMashup) {
      this.answerMashup(correct, btnEl, p, q, value, area, actions, continueBtn);
    } else if (correct) {
      p.score += value;
      p.streak += 1;
      p.best = Math.max(p.best || 0, p.streak);
      this.sound.good();
      haptic(25);
      const accent = getComputedStyle(document.body).getPropertyValue('--accent').trim();
      this.fx.burstFrom(btnEl, { colors: [accent, '#fff', '#d4ff5e'], count: 45, power: 8 });
      const streak = $('#quiz-streak');
      if (p.streak >= 2) { streak.textContent = `🔥 série de ${p.streak}`; replay(streak, 'bump'); }

      if (fum) {
        const before = p.taffs;
        p.taffs = Math.floor(p.score / this.gaugeMax);
        const gained = p.taffs - before;
        const lines = [h('p', { class: 'line' }, h('span', { class: 'big', text: `+${value}` }), ` PT${value > 1 ? 'S' : ''}`)];
        if (gained > 0) {
          lines.push(h('p', { class: 'line', text: `🌿 ${gained > 1 ? gained + ' TAFFS DÉBLOQUÉES' : 'TAFF DÉBLOQUÉE'} !` }));
          this.later(() => { this.sound.reward(); this.fx.flash('rgba(126,224,122,.35)'); this.fx.burstFrom(area, { colors: ['#7ee07a', '#d4ff5e', '#fff'], count: 90, power: 11 }); }, 350);
          lines.push(h('p', { class: 'sub', text: 'Va fumer, on t’attend 🌿' }));
          actions.append(h('button', { class: 'btn-primary pulse', text: '✓ C’EST FUMÉ →', onclick: once(() => this.quizNext()) }));
        } else {
          const left = this.gaugeMax - (p.score % this.gaugeMax);
          lines.push(h('p', { class: 'sub', text: `encore ${plural(left, 'point')} avant la prochaine taff` }));
          actions.append(continueBtn());
        }
        area.replaceChildren(h('div', { class: 'result good' }, h('p', { class: 'verdict', text: 'BIEN JOUÉ' }), lines), actions);
      } else {
        area.replaceChildren(h('div', { class: 'result good' },
          h('p', { class: 'verdict', text: 'BIEN JOUÉ' }),
          h('p', { class: 'line' }, 'Tu distribues ', h('span', { class: 'big', text: String(value) }), ` gorgée${value > 1 ? 's' : ''} 🥃`)));
        this.renderGive(area, p, value);
      }
    } else {
      p.streak = 0;
      $('#quiz-streak').textContent = '';
      this.sound.bad();
      haptic([30, 40, 30]);
      this.fx.flash('rgba(255,94,126,.22)');
      const answer = q.choices[q.answer];
      const lines = [h('p', { class: 'verdict', text: 'RATÉ' }), h('p', { class: 'sub' }, 'La réponse était ', h('b', { text: answer }))];
      if (!fum) {
        p.taken += value;
        lines.push(h('p', { class: 'line' }, `🥃 ${p.name} boit `, h('span', { class: 'big', text: String(value) }), ` gorgée${value > 1 ? 's' : ''}`));
      } else {
        lines.push(h('p', { class: 'line', text: 'Pas de point cette fois.' }));
      }
      actions.append(continueBtn());
      area.replaceChildren(h('div', { class: 'result bad' }, lines), actions);
    }
    if (q.fact) area.prepend(h('p', { class: 'q-fact', text: `💡 ${q.fact}` }));
    this.renderScores('quiz');
    if (this.checkEnd()) $$('.result-actions .btn-primary, .result-actions .btn-ghost', area).forEach((b) => { if (b.textContent.startsWith('CONTINUER')) b.textContent = 'VOIR LE CLASSEMENT 🏆'; });
    this.later(() => area.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'nearest' }), 250);
  }

  /**
   * Distribuer ses jetons en tapant sur les joueurs.
   * Mode alcool : gorgées aux autres. Mashup : effet selon le camp de la cible ;
   * avec keep=true (fumeur), une pastille "Garder" alimente sa propre jauge.
   */
  renderGive(area, giver, total, { keep = false, tokens = this.isMashup, screen = 'quiz', onDone = null } = {}) {
    const mash = tokens;
    const others = this.game.players.filter((t) => t.id !== giver.id);
    const targets = keep ? [giver, ...others] : others;
    const dist = new Map(targets.map((t) => [t.id, 0]));
    let left = total;
    const label = h('p', { class: 'give-label' }, keep ? 'Garde ou balance · reste ' : 'Tape sur tes victimes · reste ', h('b', { text: String(left) }));
    const labelOf = mash ? (t) => (t.id === giver.id
      ? h('span', { class: 'chip-main' }, '🌿 Garder', h('small', { text: `jauge ${t.gauge}/${this.gaugeMax}` }))
      : h('span', { class: 'chip-main' }, t.name, h('small', { text: t.camp === 'alcool' ? '🥃 boit' : `🌿 jauge ${t.gauge}` }))) : null;
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
    this.renderChips(chips, targets, {
      labelOf,
      counters: (p, chip) => {
        if (left <= 0) { replay(label, 'bump'); return; }
        dist.set(p.id, dist.get(p.id) + 1);
        left -= 1;
        this.fx.burstFrom(chip, { colors: [p.color, '#fff'], count: 12, power: 4 });
        refresh();
      },
    });
    reset.addEventListener('click', () => { targets.forEach((t) => dist.set(t.id, 0)); left = total; refresh(); });
    validate.addEventListener('click', once(() => {
      const recap = [];
      if (mash) {
        let gained = 0;
        targets.forEach((t) => {
          const n = dist.get(t.id);
          if (!n) return;
          const res = this.applyTokens(giver, t, n);
          gained += res.gained;
          recap.push(res.text);
          if (res.sabotage) {
            const chip = $(`.chip[data-id="${t.id}"]`, chips);
            this.fx.burstFrom(chip, { colors: ['#ff5e7e', '#7ee07a', '#fff'], count: 30, power: 7, gravity: 0.35 });
          }
        });
        if (recap.some((r) => r.startsWith('🔻'))) { this.sound.bad(); this.fx.shake(); }
        this.toast(recap.join(' · '), 'good');
        this.renderScores(screen);
        if (onDone) onDone(gained);
        else if (gained > 0) this.showTaffUnlocked(giver, gained);
        else this.quizNext();
        return;
      }
      targets.forEach((t) => {
        const n = dist.get(t.id);
        if (n > 0) { t.taken += n; giver.given += n; recap.push(`${t.name} ${n}`); }
      });
      this.toast(`🥃 ${recap.join(' · ')}`, 'good');
      if (onDone) onDone(0); else this.quizNext();
    }));

    // Un seul choix possible : distribution automatique
    if (targets.length === 1) { dist.set(targets[0].id, total); left = 0; }
    refresh();
    area.append(label, chips, h('div', { class: 'result-actions' }, validate, targets.length > 1 ? reset : null));
  }

  /* ---------------------------------------------------------------------- */
  /* MASHUP : fumeurs et buveurs dans le même quiz                           */
  /* Chacun gagne et perd dans sa monnaie :                                  */
  /*  - buveur : distribue ses jetons / boit sa mise                         */
  /*  - fumeur : jetons → sa jauge (5 = une taff) ou sabotage des autres     */
  /*  - un jeton reçu = 1 gorgée (buveur) ou -1 point de jauge (fumeur)      */
  /* ---------------------------------------------------------------------- */
  answerMashup(correct, btnEl, p, q, value, area, actions, continueBtn) {
    const smoker = p.camp === 'fumette';
    const accent = getComputedStyle(document.body).getPropertyValue('--accent').trim();
    const streak = $('#quiz-streak');
    if (correct) {
      p.score += value;
      p.streak += 1;
      this.sound.good();
      haptic(25);
      this.fx.burstFrom(btnEl, { colors: [accent, '#fff'], count: 45, power: 8 });
      if (p.streak >= 2) { streak.textContent = `🔥 série de ${p.streak}`; replay(streak, 'bump'); }
      area.replaceChildren(h('div', { class: 'result good' },
        h('p', { class: 'verdict', text: 'BIEN JOUÉ' }),
        h('p', { class: 'line' }, `+${value} pt${value > 1 ? 's' : ''} · `, h('span', { class: 'big', text: String(value) }), ` jeton${value > 1 ? 's' : ''} ${smoker ? '🌿' : '🥃'}`),
        smoker ? h('p', { class: 'sub', text: `Jauge ${p.gauge}/${this.gaugeMax} · garde pour fumer plus vite, ou balance pour saboter` } ) : null));
      this.renderGive(area, p, value, { keep: smoker });
    } else {
      p.streak = 0;
      streak.textContent = '';
      this.sound.bad();
      haptic([30, 40, 30]);
      this.fx.flash('rgba(255,94,126,.22)');
      const lines = [h('p', { class: 'verdict', text: 'RATÉ' }), h('p', { class: 'sub' }, 'La réponse était ', h('b', { text: q.choices[q.answer] }))];
      if (smoker) {
        const lost = Math.min(p.gauge, value);
        p.gauge -= lost;
        lines.push(h('p', { class: 'line' }, '🔻 Jauge ', h('span', { class: 'big', text: `-${lost}` }), ` · ${p.gauge}/${this.gaugeMax}`));
        if (!lost) lines.push(h('p', { class: 'sub', text: 'Ta jauge était déjà vide, tu t’en sors bien.' }));
      } else {
        p.taken += value;
        lines.push(h('p', { class: 'line' }, `🥃 ${p.name} boit `, h('span', { class: 'big', text: String(value) }), ` gorgée${value > 1 ? 's' : ''}`));
      }
      actions.append(continueBtn());
      area.replaceChildren(h('div', { class: 'result bad' }, lines), actions);
    }
  }

  /** Applique un paquet de jetons d'un donneur vers une cible (Mashup). Renvoie les taffs gagnées. */
  applyTokens(giver, target, n) {
    if (target.id === giver.id) {
      target.gauge += n;
      let gained = 0;
      while (target.gauge >= this.gaugeMax) { target.gauge -= this.gaugeMax; target.taffs += 1; gained += 1; }
      return { gained, text: `🌿 ${giver.name} garde ${n}` };
    }
    giver.given += n;
    if (target.camp === 'alcool') {
      target.taken += n;
      return { gained: 0, text: `🥃 ${target.name} boit ${n}` };
    }
    const lost = Math.min(target.gauge, n);
    target.gauge -= lost;
    target.sabotaged += n;
    return { gained: 0, text: lost ? `🔻 ${target.name} −${lost} jauge` : `🛡️ ${target.name} : jauge déjà vide`, sabotage: lost ? target : null };
  }

  /** Mashup : écran "taff débloquée" après distribution */
  showTaffUnlocked(p, gained) {
    const area = $('#quiz-stage .result-area');
    if (!area) { this.quizNext(); return; }
    area.replaceChildren(
      h('div', { class: 'result good' },
        h('p', { class: 'verdict', text: gained > 1 ? `${gained} TAFFS !` : 'TAFF !' }),
        h('p', { class: 'line', text: `🌿 ${p.name}, ta jauge est pleine` }),
        h('p', { class: 'sub', text: `Va fumer ! Jauge remise à ${p.gauge}/${this.gaugeMax}` })),
      h('div', { class: 'result-actions' },
        h('button', { class: 'btn-primary pulse', text: '✓ C’EST FUMÉ →', onclick: once(() => this.quizNext()) })));
    this.sound.reward();
    this.fx.flash('rgba(126,224,122,.35)');
    this.fx.burstFrom(area, { colors: ['#7ee07a', '#d4ff5e', '#fff'], count: 90, power: 11 });
    haptic([40, 30, 80]);
  }

  quizNext() {
    const g = this.game;
    if (!g || g.over) return;
    g.count += 1;
    g.turn += 1;
    if (g.turn >= g.players.length) { g.turn = 0; g.round += 1; }
    this.quizTurn();
  }
});
