/**
 * SMOKE OR DRINK — King's Cup
 * ------------------------------------------------------------------------------
 *  Chacun tire une carte à son tour : chaque valeur a sa règle. L'app retient ce
 *  que les cartes ont déclenché (maître du pouce, maître des questions, binômes,
 *  règles inventées par les Rois) et l'affiche en permanence. Au 4e Roi : cul sec
 *  et fin de partie. Chaque groupe peut changer la règle de chaque carte.
 * ------------------------------------------------------------------------------
 */
'use strict';

// Bibliothèque de règles. {v} = « boit », {v2} = « bois », {v3} = « boivent », {n} = « gorgées »
const KC_RULES = {
  cascade:   { icon: '🌊', title: 'Cascade', text: 'Tout le monde {v3} en même temps. Personne ne s’arrête avant que son voisin de droite ait arrêté. Tu commences, tu décides quand ça finit.' },
  donne2:    { icon: '👉', title: 'Deux pour toi', text: 'Tu donnes 2 {n} à qui tu veux.', act: 'give', n: 2 },
  donne3:    { icon: '🎯', title: 'Trois pour toi', text: 'Tu donnes 3 {n} à qui tu veux.', act: 'give', n: 3 },
  moi3:      { icon: '🫵', title: 'Trois pour moi', text: 'Tu {v2} 3 {n}.', act: 'self', n: 3 },
  sol:       { icon: '🖐️', title: 'Par terre !', text: 'Tout le monde touche le sol. Le dernier {v} 2 {n}.' },
  pouce:     { icon: '👍', title: 'Maître du pouce', text: 'Quand tu veux, pose discrètement ton pouce sur la table. Le dernier à t’imiter {v}. Jusqu’au prochain maître du pouce.', role: 'pouce' },
  ciel:      { icon: '🙌', title: 'Le ciel', text: 'Tout le monde lève les mains au ciel. Le dernier {v} 2 {n}.' },
  tous:      { icon: '🍻', title: 'Tout le monde !', text: 'Tout le monde {v3} une fois. Santé !', act: 'all', n: 1 },
  binome:    { icon: '👯', title: 'Binôme', text: 'Choisis un binôme : il {v} chaque fois que tu {v2}, jusqu’à ce qu’un autre binôme soit formé.', role: 'binome' },
  rime:      { icon: '🎤', title: 'Rimes', text: 'Dis un mot. Chacun enchaîne une rime. Le premier qui sèche ou répète {v} 2 {n}.' },
  categorie: { icon: '🗂️', title: 'Catégorie', text: 'Choisis un thème (marques de bière, rappeurs, fromages…). Chacun cite un élément : le premier qui sèche {v} 2 {n}.' },
  questions: { icon: '❓', title: 'Maître des questions', text: 'Quiconque répond à une de tes questions {v}. Jusqu’au prochain maître des questions.', role: 'questions' },
  jamais:    { icon: '🙊', title: 'Je n’ai jamais', text: 'Lis la carte à voix haute : ceux qui l’ont déjà fait {v3}.', act: 'jamais' },
  regle:     { icon: '👑', title: 'Nouvelle règle', text: 'Invente une règle pour toute la partie (interdit de dire « boire », boire de la main gauche…). Qui l’oublie {v}.', act: 'rule' },
  gauche:    { icon: '⬅️', title: 'À gauche', text: 'Ton voisin de gauche {v} 2 {n}.' },
  droite:    { icon: '➡️', title: 'À droite', text: 'Ton voisin de droite {v} 2 {n}.' },
  mime:      { icon: '🎭', title: 'Mime', text: 'Mime un film ou une chanson. Le premier qui trouve donne 2 {n}. Personne ne trouve : tu {v2}.' },
  histoire:  { icon: '📖', title: 'Histoire', text: 'Dis un mot. Chacun répète toute la phrase et ajoute un mot. Le premier qui se trompe {v} 2 {n}.' },
  regard:    { icon: '👀', title: 'Duel du regard', text: 'Choisis un adversaire et fixez-vous dans les yeux. Le premier qui rit ou détourne le regard {v} 3 {n}.' },
};
// Règle par défaut de chaque carte (14 = As)
const KC_DEFAULT = { 14: 'cascade', 2: 'donne2', 3: 'moi3', 4: 'sol', 5: 'pouce', 6: 'ciel', 7: 'tous', 8: 'binome', 9: 'rime', 10: 'categorie', 11: 'questions', 12: 'jamais', 13: 'regle' };
const KC_ORDER = [14, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

GAME_HOOKS.kings = {
  screen: 'kings',
  start() { this.kcStart(); },
  setup() { this.renderKingsRules(); },
  info(mix) { return `// 52 cartes · 4e Roi = cul sec et fin · touche une carte pour changer sa règle${mix}`; },
  score: {
    title() { return this.isMashup ? 'Taffs 🌿 · gorgées 🥃 (comptées)' : this.mode === 'fumette' ? 'Taffs (comptées)' : 'Gorgées (comptées)'; },
    line(p) { return { v: `${p.taken}|${p.kings || 0}`, main: `${p.taken} ${this.campOf(p) === 'alcool' ? '🥃' : '🌿'}`, small: p.kings ? ` · ${'👑'.repeat(p.kings)}` : '' }; },
    key(p) { return p.taken; },
  },
  end: {
    kicker() { return '// king’s cup'; },
    crown: 'Le roi de la coupe',
    key(p) { return p.taken; },
    line(p) { return { main: `${p.taken} ${this.campOf(p) === 'alcool' ? '🥃' : '🌿'}`, sub: `${plural(p.drawn || 0, 'carte')} tirée${(p.drawn || 0) > 1 ? 's' : ''}${p.kings ? ` · ${'👑'.repeat(p.kings)}` : ''}` }; },
  },
};

addGame(class {
  get kcMap() { return { ...KC_DEFAULT, ...(this.settings.kingsRules || {}) }; }

  /** Réglages : une pastille par carte, on la touche pour faire défiler les règles */
  renderKingsRules() {
    const map = this.kcMap;
    const ids = Object.keys(KC_RULES);
    $('#kings-grid').replaceChildren(...KC_ORDER.map((r) => {
      const rule = KC_RULES[map[r]] || KC_RULES[KC_DEFAULT[r]];
      const b = h('button', { class: `kc-rule${map[r] !== KC_DEFAULT[r] ? ' custom' : ''}`, 'aria-label': `Changer la règle du ${rankName(r)}` },
        h('span', { class: 'kc-rank', text: rankLabel(r) }),
        h('span', { class: 'kc-rname' }, h('i', { text: rule.icon }), rule.title));
      b.addEventListener('click', () => {
        const cur = ids.indexOf(map[r]);
        const next = ids[(cur + 1) % ids.length];
        this.settings.kingsRules = { ...(this.settings.kingsRules || {}), [r]: next };
        this.save();
        haptic(8);
        this.renderKingsRules();
      });
      return b;
    }), h('button', { class: 'kc-reset', text: '↺ règles classiques', onclick: () => { this.settings.kingsRules = {}; this.save(); this.renderKingsRules(); } }));
  }

  kcText(rule) {
    const v = this.verbs;
    return rule.text.replace(/\{v3\}/g, v.v3).replace(/\{v2\}/g, v.v2).replace(/\{v\}/g, v.v).replace(/\{n\}/g, v.n);
  }

  kcStart() {
    const g = this.game;
    g.deck = deck52();
    g.kings = 0;
    g.roles = { pouce: null, questions: null, binomes: [], rules: [] };
    g.map = this.kcMap;
    g.turn = randInt(0, g.players.length - 1);
    g.jamais = new Deck(this.cardPool('jamais'));
    g.players.forEach((p) => { p.kings = 0; p.drawn = 0; });
    this.kcTurn();
  }

  kcTurn() {
    this.beginTurn('kcTurn');
    const g = this.game;
    g.hasDrawn = false;
    const p = g.players[g.turn];
    if (this.isMashup) this.setTheme(p.camp);
    this.kcHeader();
    const card = flipCard();
    $('#kc-card').replaceChildren(card);
    $('#kc-rule').replaceChildren(h('p', { class: 'kc-wait', text: 'Touche le paquet pour tirer une carte' }));
    card.addEventListener('click', once(() => this.kcDraw(card)));
    const name = $('#kc-name');
    name.style.setProperty('--pc', p.color);
    name.replaceChildren(h('span', { class: `dot${p.emoji ? ' emo' : ''}`, text: p.emoji || '' }), h('span', { class: 'name', text: p.name }));
    $('#kc-area').replaceChildren(h('div', { class: 'result-actions' },
      h('button', { class: 'btn-primary pulse', text: '🃏 TIRER UNE CARTE', onclick: once(() => this.kcDraw(card)) })));
    this.kcRoles();
    this.renderScores('kings');
  }

  kcHeader() {
    const g = this.game;
    $('#kc-round').textContent = `${g.deck.length} CARTES`;
    $('#kc-crowns').replaceChildren(...[0, 1, 2, 3].map((k) => h('span', { class: k < g.kings ? 'on' : '', text: '👑' })));
  }

  /** Panneau « règles en cours » : rôles, binômes, règles des Rois */
  kcRoles() {
    const g = this.game;
    const r = g.roles;
    const name = (i) => { const p = g.players[i]; return p ? `${p.emoji ? p.emoji + ' ' : ''}${p.name}` : ''; };
    const items = [];
    if (r.pouce !== null) items.push(h('li', {}, h('b', { text: '👍 Maître du pouce' }), name(r.pouce)));
    if (r.questions !== null) items.push(h('li', {}, h('b', { text: '❓ Maître des questions' }), name(r.questions)));
    r.binomes.forEach(([a, b]) => items.push(h('li', {}, h('b', { text: '👯 Binôme' }), `${name(a)} → ${name(b)}`)));
    r.rules.forEach((t, k) => items.push(h('li', { class: 'kc-r' }, h('b', { text: `👑 Règle ${k + 1}` }), t)));
    const box = $('#kc-roles');
    box.hidden = !items.length;
    box.replaceChildren(h('p', { class: 'section-label', text: 'En cours' }), h('ul', {}, items));
  }

  kcDraw(cardEl) {
    const g = this.game;
    const p = g.players[g.turn];
    if (g.hasDrawn) return;
    g.hasDrawn = true;
    const c = g.deck.pop();
    p.drawn += 1;
    cardEl.show(c);
    this.sound.tick(0.7);
    haptic(15);
    $('#kc-area').replaceChildren();
    const ruleId = g.map[c.r] || KC_DEFAULT[c.r];
    const rule = KC_RULES[ruleId];
    this.later(() => {
      this.kcHeader();
      const area = $('#kc-area');
      const nextBtn = (label = 'JOUEUR SUIVANT →') => h('div', { class: 'result-actions' }, h('button', { class: 'btn-primary', text: label, onclick: once(() => this.kcNext()) }));
      // Les Rois : le 4e termine la partie
      if (c.r === 13) {
        g.kings += 1;
        p.kings += 1;
        this.kcHeader();
        if (g.kings >= 4) {
          $('#kc-rule').replaceChildren(h('p', { class: 'kc-icon', text: '🏆' }), h('p', { class: 'kc-title', text: 'Le 4e Roi !' }),
            h('p', { class: 'kc-text', text: `${p.name} boit la coupe : ${this.sanctionLabel(p, 'cs')} ! Fin de la partie.` }));
          this.toast(this.sanction(p, 'cs'), 'bad');
          this.fx.confetti(['#ffcf3f', '#ffffff', '#ff5e3a']);
          this.sound.reward();
          haptic([80, 40, 160]);
          this.renderScores('kings');
          area.replaceChildren(h('div', { class: 'result-actions' }, h('button', { class: 'btn-primary pulse', text: 'VOIR LE CLASSEMENT 🏆', onclick: once(() => this.finish()) })));
          return;
        }
      }
      $('#kc-rule').replaceChildren(
        h('p', { class: 'kc-icon', text: rule.icon }),
        h('p', { class: 'kc-title' }, `${rankName(c.r)} · ${rule.title}`),
        h('p', { class: 'kc-text', text: this.kcText(rule) }));
      if (rule.role === 'pouce' || rule.role === 'questions') {
        g.roles[rule.role] = g.turn;
        this.kcRoles();
        area.append(nextBtn());
      } else if (rule.role === 'binome') {
        const head = h('p', { class: 'give-label', text: 'Qui sera ton binôme ?' });
        area.append(head);
        this.partyPick(area, p, 'FORMER LE BINÔME', (v) => {
          g.roles.binomes = g.roles.binomes.filter(([a]) => a !== g.turn);
          g.roles.binomes.push([g.turn, g.players.indexOf(v)]);
          this.toast(`👯 ${v.name} boit avec ${p.name}`);
          this.kcRoles();
          this.kcNext();
        });
      } else if (rule.act === 'give') {
        this.partyGive(area, p, rule.n, () => { this.renderScores('kings'); this.kcNext(); });
      } else if (rule.act === 'self') {
        this.toast(this.sanction(p, rule.n), 'bad');
        this.renderScores('kings');
        area.append(nextBtn());
      } else if (rule.act === 'all') {
        g.players.forEach((x) => this.sanction(x, rule.n));
        this.toast('🍻 Tout le monde !', 'bad');
        this.renderScores('kings');
        area.append(nextBtn());
      } else if (rule.act === 'jamais') {
        const t = g.jamais.draw();
        $('#kc-rule').append(h('p', { class: 'kc-quote', text: t ? `Je n’ai jamais ${t}` : 'Je n’ai jamais… (invente !)' }));
        area.append(nextBtn());
      } else if (rule.act === 'rule') {
        const input = h('input', { class: 'kc-input', type: 'text', maxlength: '80', placeholder: 'Ta règle (ex. : interdit de dire « boire »)', 'aria-label': 'Nouvelle règle' });
        const add = h('button', { class: 'btn-primary', text: 'AJOUTER LA RÈGLE' });
        add.addEventListener('click', () => {
          const t = input.value.trim();
          if (!t) { replay(input, 'bump'); input.focus(); return; }
          g.roles.rules.push(t);
          this.kcRoles();
          this.kcNext();
        });
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') add.click(); });
        area.append(input, h('div', { class: 'result-actions' }, add,
          h('button', { class: 'btn-ghost', text: 'PAS D’IDÉE, ON CONTINUE', onclick: once(() => this.kcNext()) })));
      } else {
        area.append(nextBtn());
      }
    }, 650);
  }

  kcNext() {
    const g = this.game;
    g.count += 1;
    if (!g.deck.length) { this.finish(); return; }
    g.turn = (g.turn + 1) % g.players.length;
    this.kcTurn();
  }
});
