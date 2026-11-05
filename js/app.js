/**
 * SMOKE OR DRINK — l'application : écrans, joueurs, configuration, scores, fin de partie
 */
'use strict';

/* ==========================================================================
   8. APPLICATION
   ========================================================================== */
class SmokeOrDrinkApp {
  constructor() {
    const saved = Store.load();
    this.players = Array.isArray(saved.players) && saved.players.length
      ? saved.players.slice(0, CONFIG.MAX_PLAYERS).map((p, i) => ({ id: p.id || uid(), name: String(p.name || ''), camp: p.camp === 'alcool' ? 'alcool' : 'fumette', emoji: p.emoji || CONFIG.AVATARS[i % CONFIG.AVATARS.length] }))
      : [{ id: uid(), name: '', camp: 'fumette', emoji: CONFIG.AVATARS[0] }, { id: uid(), name: '', camp: 'alcool', emoji: CONFIG.AVATARS[1] }];
    this.settings = {
      sound: true,
      cats: ['all'],
      diff: 'bet',            // 'bet' (mise libre) | 'random'
      duration: 'rapide',
      rtype: 'classique',     // roulette : 'classique' | 'seance'
      film: 105,              // durée du film en minutes
      joint: 'tourne',        // 'tourne' | 'chacun'
      end: { quiz: 'free', cards: 'free', bombe: 'free' },
      intensity: 'normal',    // jeu de l'oie : 'soft' | 'normal' | 'hard'
      memeLevel: 'soiree',    // ambiance des memes, Je n'ai jamais, Qui pourrait… : 'chill' | 'soiree' | 'hot' (cumulatif)
      ...(saved.settings || {}),
    };
    this.mode = null;          // 'fumette' | 'alcool'
    this.gameId = null;
    this.game = null;          // état de la partie en cours
    this.data = { quiz: [], jamais: [], probable: [], bombe: [] };
    this.dataReady = false;
    this.wakeLock = null;
    this.timers = new Set();

    this.sound = new Sound();
    this.sound.enabled = this.settings.sound !== false;
    this.fx = new FX($('#fx'));
    this.router = new Router((from, to) => this.onLeave(from, to));
    this.roulette = new Roulette(this);
    this.seance = new Seance(this);

    this.init();
  }

  /* ---------------------------------------------------------------------- */
  /* INIT                                                                    */
  /* ---------------------------------------------------------------------- */
  async init() {
    document.body.classList.toggle('is-muted', !this.sound.enabled);
    document.body.classList.toggle('big-text', Boolean(this.settings.bigText));
    this.installGameButtons();
    this.bindEvents();
    this.refreshRecapButtons();
    this.registerServiceWorker();
    await this.loadData();
    this.offerResume();
  }

  /** Une séance tournait quand l'appli a été fermée : on propose de la reprendre */
  async offerResume() {
    const saved = Seance.loadSaved();
    if (!saved) return;
    const ok = await this.confirm('Reprendre la séance ?', `Une séance est en cours (${saved.players.map((p) => p.name).join(', ')}). Le chrono a continué pendant ton absence.`, 'reprendre', false);
    if (!ok) { this.seance.clear(); return; }
    this.mode = 'fumette';
    this.setTheme('fumette');
    this.gameId = 'roulette';
    this.settings.rtype = 'seance';
    this.renderHub();
    this.renderSetup();
    this.game = { id: 'seance', kind: 'seance', players: saved.players, end: { id: 'free' }, turn: 0, round: 1, count: saved.idx, over: false };
    this.seance.resume(saved);
    this.keepAwake(true);
    this.router.resetTo(['home', 'hub', 'setup', 'seance'], 'fwd');
  }

  async loadData() {
    const get = async (url) => {
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`${url} : HTTP ${res.status}`);
      return res.json();
    };
    const [quizRes, cardsRes] = await Promise.allSettled([get('data.json'), get('cards.json')]);

    // Quiz : accepte un tableau (format actuel) ou { quiz: [...] }
    let quiz = quizRes.status === 'fulfilled' ? quizRes.value : null;
    if (quiz && !Array.isArray(quiz)) quiz = quiz.quiz;
    this.data.quiz = (Array.isArray(quiz) ? quiz : FALLBACK.quiz).filter((q) =>
      q && typeof q.q === 'string' && Array.isArray(q.choices) && q.choices.length >= 2 &&
      Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.choices.length);
    this.data.quiz.forEach((q) => { if (!CONFIG.DIFFS[q.diff]) q.diff = 'medium'; });
    if (!this.data.quiz.length) this.data.quiz = FALLBACK.quiz;

    const cards = cardsRes.status === 'fulfilled' ? cardsRes.value : {};
    for (const key of ['jamais', 'probable', 'bombe']) {
      // Une carte = un texte, ou { t: texte, lvl: 'chill' | 'soiree' | 'hot' }
      const list = (Array.isArray(cards[key]) ? cards[key] : [])
        .map((c) => (typeof c === 'string' ? { t: c, lvl: 'chill' } : c))
        .filter((c) => c && typeof c.t === 'string' && c.t.trim());
      this.data[key] = list.length ? list : FALLBACK[key].map((t) => ({ t, lvl: 'chill' }));
    }
    if (quizRes.status === 'rejected' || cardsRes.status === 'rejected') {
      console.warn('[Data] Chargement partiel, contenu de secours activé.', quizRes.reason || cardsRes.reason);
    }
    this.dataReady = true;
    if (this.router.current === 'setup') this.renderSetup();
  }

  registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    // Le SW n'existe qu'en HTTPS ou sur localhost (pas sur une IP locale en http)
    const secure = location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname);
    if (!secure) return;
    const register = () => navigator.serviceWorker.register('service-worker.js')
      .then((reg) => this.watchUpdates(reg))
      .catch((err) => console.warn('[PWA] Service Worker :', err));
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }

  save() {
    Store.save({
      players: this.players.map((p) => ({ id: p.id, name: p.name, camp: p.camp, emoji: p.emoji })),
      settings: this.settings,
    });
  }

  /* ---------------------------------------------------------------------- */
  /* ÉVÉNEMENTS (délégation : un seul écouteur pour toute l'appli)           */
  /* ---------------------------------------------------------------------- */
  bindEvents() {
    const unlock = () => this.sound.unlock();
    document.addEventListener('touchend', unlock, { passive: true });
    document.addEventListener('click', unlock);

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn || btn.disabled) return;
      if (!btn.closest('.choice, .bet-card, .wheel-hub')) this.sound.tap();

      const action = btn.dataset.action;
      if (action === 'back') this.router.back();
      else if (action === 'toggle-sound') this.toggleSound();
      else if (action === 'quit') this.askQuit();
      else if (action === 'undo') this.undo();
      else if (action === 'toggle-big') this.toggleBig();
      else if (action === 'recap') this.openRecap();
      else if (action === 'rules') this.showRules();
      else if (btn.classList.contains('mode-card')) this.chooseMode(btn.dataset.mode);
      else if (btn.classList.contains('game-card')) this.chooseGame(btn.dataset.game);
    });

    $('#add-player').addEventListener('click', () => this.addPlayer());
    $('#start-game').addEventListener('click', () => this.startGame());
    $('#cards-skip').addEventListener('click', () => this.cardsNext(false));
    $('#cards-validate').addEventListener('click', () => this.cardsNext(true));
    $('#pc-count').addEventListener('click', () => this.countdown321());
    $('#bomb-start').addEventListener('click', () => this.bombLight());
    $('#end-restart').addEventListener('click', () => this.startGame(true));
    $('#end-hub').addEventListener('click', () => this.goHub());
    $('#end-home').addEventListener('click', () => this.goHome());
    $('#recap-share').addEventListener('click', () => this.shareRecap());
    $('#recap-new').addEventListener('click', () => this.newSoiree());

    // Retour au premier plan : on réactive l'écran allumé si une partie tourne
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.game && !this.game.over) {
        this.keepAwake(true);
        if (this.game.kind === 'seance') this.seance.tick(); // rattrape une taff tombée pendant la veille
      }
    });
  }

  /** Mode gros texte (lisible à 3 h du mat) */
  toggleBig() {
    this.settings.bigText = !this.settings.bigText;
    document.body.classList.toggle('big-text', this.settings.bigText);
    this.save();
    this.toast(this.settings.bigText ? '🔠 Gros texte activé' : '🔡 Texte normal');
  }

  toggleSound() {
    this.sound.enabled = !this.sound.enabled;
    this.settings.sound = this.sound.enabled;
    document.body.classList.toggle('is-muted', !this.sound.enabled);
    this.save();
    if (this.sound.enabled) { this.sound.unlock(); this.sound.good(); }
    this.toast(this.sound.enabled ? '🔊 Son activé' : '🔇 Son coupé');
  }

  /** Garde l'écran allumé pendant une partie (Safari 16.4+) */
  async keepAwake(on) {
    try {
      if (on && 'wakeLock' in navigator && !this.wakeLock) {
        this.wakeLock = await navigator.wakeLock.request('screen');
        this.wakeLock.addEventListener('release', () => { this.wakeLock = null; });
      } else if (!on && this.wakeLock) {
        await this.wakeLock.release();
        this.wakeLock = null;
      }
    } catch (e) { /* non supporté : sans conséquence */ }
  }

  /** Appelé par le Router à chaque changement d'écran */
  onLeave(from) {
    if (from === 'roulette') this.roulette.cancel();
    if (from === 'bomb') this.bombStop();
  }

  later(fn, ms) {
    const id = setTimeout(() => { this.timers.delete(id); fn(); }, ms);
    this.timers.add(id);
    return id;
  }
  clearTimers() {
    this.timers.forEach((id) => clearTimeout(id));
    this.timers.clear();
  }

  /* ---------------------------------------------------------------------- */
  /* UI GÉNÉRIQUE : toasts, confirmation                                     */
  /* ---------------------------------------------------------------------- */
  toast(msg, type = '') {
    const box = $('#toasts');
    while (box.children.length >= 3) box.firstElementChild.remove();
    const t = h('div', { class: `toast ${type}`, text: msg });
    box.append(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, 2300);
  }

  confirm(title, text, okLabel = 'confirmer', danger = true) {
    return new Promise((resolve) => {
      const sheet = $('#sheet');
      $('#sheet-title').textContent = title;
      $('#sheet-text').textContent = text;
      $('[data-sheet="ok"]', sheet).textContent = okLabel;
      $('[data-sheet="ok"]', sheet).classList.toggle('danger', danger);
      sheet.hidden = false;
      sheet.classList.remove('closing');
      const close = (val) => {
        sheet.removeEventListener('click', onClick);
        sheet.classList.add('closing');
        setTimeout(() => { sheet.hidden = true; sheet.classList.remove('closing'); }, 220);
        resolve(val);
      };
      const onClick = (e) => {
        const k = e.target.closest('[data-sheet]');
        if (k) close(k.dataset.sheet === 'ok');
      };
      sheet.addEventListener('click', onClick);
    });
  }

  /* ---------------------------------------------------------------------- */
  /* MODE & HUB                                                              */
  /* ---------------------------------------------------------------------- */
  get isMashup() { return this.mode === 'mashup'; }
  /** Taille de la jauge de taff : 3 au jeu de l'oie, 5 ailleurs */
  get gaugeMax() { return this.game && this.game.id === 'oie' ? OIE.GAUGE : CONFIG.TAFF_EVERY; }
  get unitEmoji() { return this.isMashup ? '🌿🥃' : this.mode === 'fumette' ? '🌿' : '🥃'; }
  /** Camp d'un joueur : le sien en Mashup, sinon celui de la partie */
  campOf(p) { return this.isMashup ? p.camp : this.mode; }
  /** Pile d'écrans jusqu'à la configuration (le Mashup saute le hub) */
  get setupPath() { return ['home', 'hub', 'setup']; }
  /** Thème vert/orange : en Mashup il suit le joueur dont c'est le tour */
  setTheme(name) {
    document.body.classList.remove('mode-none', 'mode-fumette', 'mode-alcool', 'mode-mashup');
    document.body.classList.add(`mode-${name}`);
  }
  unit(n) { return this.mode === 'fumette' ? plural(n, 'taff') : plural(n, 'gorgée'); }
  get gameDef() { return CONFIG.GAMES.find((g) => g.id === this.gameId); }

  chooseMode(mode) {
    this.mode = mode;
    this.setTheme(mode);
    haptic(20);
    this.renderHub();
    this.router.go('hub');
  }

  renderHub() {
    $('#hub-title').textContent = this.isMashup ? '🌿🥃 MASHUP' : this.mode === 'fumette' ? '🌿 MODE FUMETTE' : '🥃 MODE ALCOOL';
    $('#hub-sub').textContent = this.isMashup ? '// fumeurs et buveurs ensemble · choisis ton jeu' : '// choisis ton jeu';
    const games = CONFIG.GAMES.filter((g) => !this.isMashup || g.mashup);
    $('#game-list').replaceChildren(...games.map((g, i) =>
      h('button', { class: 'game-card stagger', dataset: { game: g.id }, style: { '--i': i } },
        h('span', { class: 'gc-icon', text: g.icon }),
        h('span', { class: 'gc-body' },
          h('span', { class: 'gc-title', text: g.title }),
          h('span', { class: 'gc-desc', text: g.desc[this.mode] })),
        h('span', { class: 'gc-tag pixel', text: `${g.min}+ 👤` }),
        g.isNew ? h('span', { class: 'gc-new', text: 'NEW' }) : null)));
  }

  chooseGame(id) {
    this.gameId = id;
    this.renderSetup();
    this.router.go('setup');
  }

  goHub() {
    this.endGame();
    this.renderHub();
    this.router.resetTo(['home', 'hub']);
  }

  goHome() {
    this.endGame();
    this.setTheme('none');
    this.router.resetTo(['home']);
  }

  /* ---------------------------------------------------------------------- */
  /* CONFIGURATION                                                           */
  /* ---------------------------------------------------------------------- */
  get kind() { return this.gameDef ? this.gameDef.kind : 'quiz'; }
  get isRouletteFumette() { return this.gameId === 'roulette' && this.mode === 'fumette'; }
  get isSeance() { return this.isRouletteFumette && this.settings.rtype === 'seance'; }
  get endKey() { return this.kind === 'cards' || this.kind === 'memes' ? 'cards' : this.kind; }

  renderSetup() {
    const g = this.gameDef;
    if (!g) return;
    $('#setup-title').textContent = `${g.icon} ${g.title.toUpperCase()}`;
    $('#setup-sub').textContent = this.isMashup ? `// mashup · chacun choisit son camp · ${g.min}+ joueurs` : `// mode ${this.mode} · ${g.min}+ joueurs`;

    $$('.setup-section[data-for]').forEach((sec) => {
      const tags = sec.dataset.for.split(' ');
      sec.hidden = !(tags.includes(g.id) || (tags.includes('roulette-fumette') && this.isRouletteFumette) || (tags.includes('seance') && this.isSeance));
    });

    this.renderPlayers();
    if (g.id === 'quiz') { this.renderCategories(); this.renderDiffs(); }
    if (this.isRouletteFumette) { this.renderRType(); this.renderDurations(); }
    if (this.isSeance) { this.renderFilm(); this.renderJoint(); }
    if (g.id === 'oie') this.renderIntensity();
    if (['memes', 'jamais', 'probable', 'oie'].includes(g.id)) this.renderMemeLevel();
    if (CONFIG.END_OPTIONS[this.endKey]) this.renderEnds();
    this.validateSetup();
  }

  renderPlayers(focusIndex = -1) {
    const list = $('#players-list');
    list.replaceChildren(...this.players.map((p, i) => {
      const color = CONFIG.PLAYER_COLORS[i % CONFIG.PLAYER_COLORS.length];
      const input = h('input', {
        type: 'text', maxlength: '14', placeholder: `Joueur ${i + 1}`, enterkeyhint: i === this.players.length - 1 ? 'done' : 'next',
        autocomplete: 'off', autocapitalize: 'words', spellcheck: 'false', 'aria-label': `Nom du joueur ${i + 1}`,
      });
      input.value = p.name;
      input.addEventListener('input', () => { p.name = input.value; this.save(); this.validateSetup(); });
      input.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const next = list.querySelectorAll('input')[i + 1];
        if (next) next.focus();
        else if (this.players.length < CONFIG.MAX_PLAYERS && input.value.trim()) this.addPlayer();
        else input.blur();
      });
      const camp = this.isMashup
        ? h('button', {
          class: `camp-toggle is-${p.camp}`, 'aria-label': `Camp de ${p.name || `joueur ${i + 1}`}`,
          onclick: (e) => {
            p.camp = p.camp === 'fumette' ? 'alcool' : 'fumette';
            const b = e.currentTarget;
            b.className = `camp-toggle is-${p.camp}`;
            b.replaceChildren(h('span', { text: p.camp === 'fumette' ? '🌿' : '🥃' }), p.camp === 'fumette' ? 'fume' : 'boit');
            replay(b, 'flip');
            haptic(10);
            this.save();
            this.validateSetup();
          },
        }, h('span', { text: p.camp === 'fumette' ? '🌿' : '🥃' }), p.camp === 'fumette' ? 'fume' : 'boit')
        : null;
      const row = h('div', { class: 'player-row', style: { '--pc': color } },
        h('button', { class: 'avatar-btn', 'aria-label': 'Changer d’avatar', text: p.emoji, onclick: () => this.pickAvatar(p) }), input, camp,
        this.players.length > 1
          ? h('button', { class: 'remove', 'aria-label': `Retirer ${p.name || `le joueur ${i + 1}`}`, text: '×', onclick: () => this.removePlayer(p.id, row) })
          : null);
      return row;
    }));
    $('#players-count').textContent = `${this.players.length}/${CONFIG.MAX_PLAYERS}`;
    $('#add-player').disabled = this.players.length >= CONFIG.MAX_PLAYERS;
    if (focusIndex >= 0) {
      const inp = list.querySelectorAll('input')[focusIndex];
      if (inp) inp.focus({ preventScroll: false });
    }
  }

  addPlayer() {
    if (this.players.length >= CONFIG.MAX_PLAYERS) return;
    const last = this.players[this.players.length - 1];
    const used = new Set(this.players.map((p) => p.emoji));
    const emoji = CONFIG.AVATARS.find((e) => !used.has(e)) || CONFIG.AVATARS[0];
    this.players.push({ id: uid(), name: '', camp: last ? last.camp : 'fumette', emoji });
    this.save();
    this.renderPlayers(this.players.length - 1);
    this.validateSetup();
  }

  removePlayer(id, row) {
    if (this.players.length <= 1) return;
    row.classList.add('is-leaving');
    setTimeout(() => {
      this.players = this.players.filter((p) => p.id !== id);
      this.save();
      this.renderPlayers();
      this.validateSetup();
    }, 230);
  }

  pill({ on, emoji, label, small, color, onClick }) {
    return h('button', { class: `pill${on ? ' is-on' : ''}`, style: color ? { '--pc': color } : {}, onclick: onClick, 'aria-pressed': on ? 'true' : 'false' },
      h('span', { class: 'pe', text: emoji }), label, small ? h('small', { text: small }) : null);
  }

  renderCategories() {
    const counts = {};
    this.data.quiz.forEach((q) => { counts[q.cat] = (counts[q.cat] || 0) + 1; });
    const sel = this.settings.cats;
    const all = this.pill({
      on: sel.includes('all'), emoji: '🎲', label: 'Mix complet', small: `${this.data.quiz.length} q.`, color: 'var(--accent-2)',
      onClick: () => { this.settings.cats = ['all']; this.save(); this.renderCategories(); this.validateSetup(); },
    });
    const pills = Object.entries(CONFIG.CATEGORIES).filter(([id]) => counts[id]).map(([id, c]) => this.pill({
      on: sel.includes(id), emoji: c.emoji, label: c.name, small: `${counts[id]} q.`, color: c.color,
      onClick: () => {
        let cats = this.settings.cats.filter((x) => x !== 'all');
        cats = cats.includes(id) ? cats.filter((x) => x !== id) : [...cats, id];
        this.settings.cats = cats.length ? cats : ['all'];
        this.save();
        this.renderCategories();
        this.validateSetup();
      },
    }));
    $('#cat-grid').replaceChildren(all, ...pills);
  }

  renderDiffs() {
    const opts = [
      { id: 'bet', emoji: '🎲', label: 'Mise libre', small: 'chacun choisit son niveau' },
      { id: 'random', emoji: '🔀', label: 'Aléatoire', small: 'le jeu choisit' },
    ];
    $('#diff-grid').replaceChildren(...opts.map((o) => this.pill({
      on: this.settings.diff === o.id, emoji: o.emoji, label: o.label, small: o.small,
      onClick: () => { this.settings.diff = o.id; this.save(); this.renderDiffs(); },
    })));
  }

  renderDurations() {
    const fmt = (s) => (s >= 60 ? `${Math.round(s / 60)} min` : `${s} s`);
    $('#duration-grid').replaceChildren(...Object.entries(CONFIG.ROULETTE.DURATIONS).map(([id, d]) => this.pill({
      on: this.settings.duration === id, emoji: d.emoji, label: d.label, small: `${fmt(d.legendaire[0])} → ${fmt(d.commun[1])}`,
      onClick: () => { this.settings.duration = id; this.save(); this.renderDurations(); },
    })));
  }

  renderRType() {
    const opts = [
      { id: 'classique', emoji: '🎡', label: 'Classique', small: 'on tourne à chaque taff' },
      { id: 'seance', emoji: '🎬', label: 'Séance', small: 'un plan calé sur un film' },
    ];
    $('#rtype-grid').replaceChildren(...opts.map((o) => this.pill({
      on: this.settings.rtype === o.id, emoji: o.emoji, label: o.label, small: o.small,
      onClick: () => {
        this.settings.rtype = o.id;
        // Sur un film, le rythme Rapide (15-30 s) donnerait des centaines de taffs : on passe en Raisonnable
        if (o.id === 'seance' && this.settings.duration === 'rapide') this.settings.duration = 'raisonnable';
        this.save();
        this.renderSetup();
      },
    })));
  }

  renderFilm() {
    const presets = [[20, 'Court'], [45, 'Épisode'], [90, 'Film'], [105, 'Film'], [120, 'Film'], [150, 'Long film']];
    const fmt = (m) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ' ' + String(m % 60).padStart(2, '0') : ''}`);
    $('#film-grid').replaceChildren(...presets.map(([m, l]) => this.pill({
      on: this.settings.film === m, emoji: fmt(m), label: l,
      onClick: () => { this.settings.film = m; $('#film-input').value = ''; this.save(); this.renderFilm(); this.validateSetup(); },
    })));
    const input = $('#film-input');
    if (!presets.some(([m]) => m === this.settings.film) && document.activeElement !== input) input.value = `${Math.floor(this.settings.film / 60)}:${String(this.settings.film % 60).padStart(2, '0')}`;
    if (!input.dataset.bound) {
      input.dataset.bound = '1';
      input.addEventListener('input', () => {
        const m = parseFilmMinutes(input.value);
        if (m) { this.settings.film = m; this.save(); this.renderFilm(); this.validateSetup(); }
      });
    }
  }

  renderJoint() {
    const opts = [
      { id: 'tourne', emoji: '🔄', label: 'Le joint tourne', small: 'un plan, chacun son tour' },
      { id: 'chacun', emoji: '🙌', label: 'Chacun son joint', small: 'un plan par joueur' },
    ];
    $('#joint-grid').replaceChildren(...opts.map((o) => this.pill({
      on: this.settings.joint === o.id, emoji: o.emoji, label: o.label, small: o.small,
      onClick: () => { this.settings.joint = o.id; this.save(); this.renderJoint(); this.validateSetup(); },
    })));
  }

  renderIntensity() {
    const opts = [
      { id: 'soft', emoji: '🙂', label: 'Soft', small: 'malus ×1' },
      { id: 'normal', emoji: '😈', label: 'Normal', small: 'malus ×2' },
      { id: 'hard', emoji: '💀', label: 'Hardcore', small: 'malus ×3' },
    ];
    $('#intensity-grid').replaceChildren(...opts.map((o) => this.pill({
      on: this.settings.intensity === o.id, emoji: o.emoji, label: o.label, small: o.small,
      onClick: () => { this.settings.intensity = o.id; this.save(); this.renderIntensity(); },
    })));
  }

  renderEnds() {
    const key = this.endKey;
    const opts = CONFIG.END_OPTIONS[key];
    if (!opts.some((o) => o.id === this.settings.end[key])) this.settings.end[key] = 'free';
    $('#end-grid').replaceChildren(...opts.map((o) => this.pill({
      on: this.settings.end[key] === o.id, emoji: o.e, label: o.l,
      onClick: () => { this.settings.end[key] = o.id; this.save(); this.renderEnds(); },
    })));
  }

  /** Estimation du nombre de taffs (moyenne des attentes pondérée 70/24/6) */
  seanceEstimate() {
    const D = CONFIG.ROULETTE.DURATIONS[this.settings.duration] || CONFIG.ROULETTE.DURATIONS.raisonnable;
    const mid = ([a, b]) => (a + b) / 2;
    const mean = 0.7 * mid(D.commun) + 0.24 * mid(D.rare) + 0.06 * mid(D.legendaire);
    const n = Math.max(0, Math.round((this.settings.film * 60) / mean) - 0);
    const each = this.settings.joint === 'chacun' && this.players.length > 1;
    return `// ≈ ${n} taffs ${each ? 'chacun ' : ''}sur ${fmtDuration(this.settings.film * 60)}`;
  }

  /** Textes d'un paquet de cartes, filtrés selon l'ambiance choisie (chill ⊂ soirée ⊂ hot) */
  cardPool(key) {
    const lvl = (typeof MEME_LEVELS !== 'undefined' && MEME_LEVELS[this.settings.memeLevel]) || { includes: ['chill', 'soiree'] };
    const all = this.data[key] || [];
    const pool = all.filter((c) => lvl.includes.includes(c.lvl || 'chill')).map((c) => c.t);
    return pool.length ? pool : all.map((c) => c.t);
  }

  quizPool() {
    const cats = this.settings.cats;
    return cats.includes('all') ? this.data.quiz : this.data.quiz.filter((q) => cats.includes(q.cat));
  }

  validateSetup() {
    const g = this.gameDef;
    const btn = $('#start-game');
    const info = $('#pool-info');
    const names = this.players.map((p) => p.name.trim());
    let reason = '';
    if (!this.dataReady) reason = 'CHARGEMENT…';
    else if (this.players.length < g.min) reason = `IL FAUT ${g.min} JOUEURS MINIMUM`;
    else if (names.some((n) => !n)) reason = 'NOMME TOUS LES JOUEURS';
    else if (new Set(names.map((n) => n.toLowerCase())).size !== names.length) reason = 'DEUX JOUEURS ONT LE MÊME NOM';

    let count = 0;
    if (this.dataReady) {
      if (g.id === 'quiz') count = this.quizPool().length;
      else if (g.kind === 'cards' || g.kind === 'bombe') count = this.cardPool(g.id).length;
      if (!reason && g.id === 'quiz' && !count) reason = 'AUCUNE QUESTION POUR CES THÈMES';
    }
    btn.disabled = Boolean(reason);
    btn.textContent = reason || 'LANCER LA PARTIE';
    const mix = this.isMashup ? ` · ${this.players.filter((p) => p.camp === 'fumette').length} 🌿 · ${this.players.filter((p) => p.camp === 'alcool').length} 🥃` : '';
    info.textContent = !this.dataReady ? '' : g.id === 'quiz'
      ? `// ${count} questions dispo${mix}`
      : g.id === 'memes' ? this.memesInfo()
      : g.id === 'oie' ? `// 63 cases · 1 dé · jauge de ${OIE.GAUGE} pour une taff`
      : this.isSeance ? this.seanceEstimate()
      : g.kind === 'roulette' ? '// 50 cases · 70 / 24 / 6 %' : `// ${count} cartes dans le paquet`;
  }

  /* ---------------------------------------------------------------------- */
  /* DÉMARRAGE / FIN DE PARTIE                                               */
  /* ---------------------------------------------------------------------- */
  startGame(isRestart = false) {
    if (!isRestart) {
      $('#start-game').blur();
      if ($('#start-game').disabled) return;
    }
    const g = this.gameDef;
    const endOpt = (CONFIG.END_OPTIONS[this.endKey] || []).find((o) => o.id === this.settings.end[this.endKey]) || { id: 'free' };
    this.clearTimers();
    this.game = {
      id: g.id, kind: g.kind, end: endOpt,
      players: this.players.map((p, i) => ({
        id: p.id, name: p.name.trim(), color: CONFIG.PLAYER_COLORS[i % CONFIG.PLAYER_COLORS.length],
        camp: this.isMashup ? p.camp : this.mode, emoji: p.emoji,
        score: 0, taffs: 0, given: 0, taken: 0, streak: 0, time: 0, gauge: 0, sabotaged: 0, pos: 0, skip: 0,
      })),
      turn: 0, round: 1, count: 0, over: false,
    };

    $$('[data-game-tag]').forEach((el) => { el.textContent = `${this.unitEmoji} ${g.short}`; });
    this.keepAwake(true);
    const kind = this.isSeance ? 'seance' : g.kind;
    const target = { quiz: 'quiz', cards: 'cards', bombe: 'bomb', roulette: 'roulette', seance: 'seance', oie: 'oie', memes: 'memes' }[kind];

    if (g.kind === 'quiz') {
      const pool = this.quizPool();
      this.game.decks = {
        all: new Deck(pool),
        easy: new Deck(pool.filter((q) => q.diff === 'easy')),
        medium: new Deck(pool.filter((q) => q.diff === 'medium')),
        hard: new Deck(pool.filter((q) => q.diff === 'hard')),
      };
      this.quizTurn();
    } else if (g.kind === 'cards') {
      this.game.deck = new Deck(this.cardPool(g.id));
      this.cardsTurn(true);
    } else if (g.kind === 'bombe') {
      this.game.deck = new Deck(this.cardPool('bombe'));
      this.game.turn = randInt(0, this.game.players.length - 1);
      this.bombTurn();
    } else if (kind === 'memes') {
      this.memesStart();
    } else if (kind === 'oie') {
      this.oieStart();
    } else if (kind === 'seance') {
      this.game.id = 'seance';
      this.game.kind = 'seance';
      this.seance.clear();
      this.seance.build();
    } else {
      this.rouletteTurn();
    }
    this.router.go(target, { replace: isRestart });
  }

  checkEnd() {
    const g = this.game;
    const e = g.end;
    if (e.rounds && g.round > e.rounds) return true;
    if (e.points && g.players.some((p) => p.score >= e.points)) return true;
    if (e.cards && g.count >= e.cards) return true;
    return false;
  }

  async askQuit() {
    if (!this.game || this.game.over) return;
    const played = this.game.count > 0 || this.game.players.some((p) => p.score || p.taken || p.taffs) || (this.game.kind === 'seance' && this.seance.s && this.seance.s.started);
    const ok = await this.confirm('Terminer la partie ?',
      played ? 'Vous allez voir le classement final.' : 'Aucun tour joué, retour à la configuration.',
      played ? 'voir le classement' : 'quitter');
    if (!ok || !this.game) return;
    if (played) this.finish();
    else { this.endGame(); if (this.isMashup) this.setTheme('mashup'); this.router.resetTo(this.setupPath); }
  }

  endGame() {
    if (this.isMashup) this.setTheme('mashup');
    if (this.game && this.game.kind === 'seance') this.seance.clear();
    this.clearTimers();
    this.bombStop();
    this.roulette.cancel();
    if (this.game) this.game.over = true;
    this.keepAwake(false);
  }

  finish() {
    const g = this.game;
    if (!g) return;
    this.endGame();
    const fum = this.mode === 'fumette';
    const conf = {
      quiz:     { kicker: this.isMashup ? '// mashup · fumeurs vs buveurs' : fum ? '// classement des taffeurs' : '// le bourreau de la soirée', crown: 'Le cerveau de la soirée', key: (p) => p.score },
      jamais:   { kicker: "// je n'ai jamais", crown: 'La vie la plus remplie', key: (p) => p.taken },
      probable: { kicker: '// qui pourrait…', crown: 'La star du groupe', key: (p) => p.taken },
      bombe:    { kicker: '// la bombe', crown: "L'artificier maudit", key: (p) => p.taken },
      roulette: { kicker: '// roulette', crown: fum ? 'Le chouchou de la roue' : 'Le plus arrosé', key: (p) => (fum ? p.taffs * 1e6 - p.time : p.taken) },
      seance:   { kicker: '// séance', crown: 'Le plus gros fumeur', key: (p) => p.taffs },
      oie:      { kicker: "// jeu de l'oie", crown: 'Premier arrivé', key: (p) => p.pos },
      memes:    { kicker: '// le meme de la soirée', crown: 'Le meme vivant', key: (p) => p.taken },
    }[g.id];

    const ranked = [...g.players].sort((a, b) => conf.key(b) - conf.key(a) || a.taken - b.taken);
    $('#end-kicker').textContent = conf.kicker;
    $('#end-title').textContent = fum || this.isMashup ? 'FIN DE PARTIE' : "C'EST FINI";
    $('#winner').replaceChildren(conf.crown, h('b', { text: `👑 ${ranked[0].emoji ? ranked[0].emoji + ' ' : ''}${ranked[0].name}` }));
    this.soireeRecord(g, ranked);

    $('#podium').replaceChildren(...ranked.map((p, i) => {
      let main, sub = '';
      if (g.id === 'quiz' && this.isMashup) {
        main = `${p.score} pts`;
        sub = p.camp === 'fumette'
          ? `🌿 ${plural(p.taffs, 'taff')} · ${plural(p.given, 'balancé')} · ${p.sabotaged} subi${p.sabotaged > 1 ? 's' : ''}`
          : `🥃 ${p.given} données · ${p.taken} bues`;
      } else if (g.id === 'quiz') {
        main = `${p.score} pts`;
        sub = fum ? `${plural(p.taffs, 'taff')} 🌿` : `🥃 ${p.given} données · ${p.taken} bues`;
      } else if (g.id === 'roulette') {
        main = fum ? `${p.taffs} 🌿` : `${p.taken} 🥃`;
        sub = fum ? `attente totale ${formatTime(p.time)}` : '';
      } else if (g.id === 'oie') {
        main = p.pos >= 63 ? '🏆 63' : `case ${p.pos}`;
        sub = p.camp === 'fumette' ? `🌿 ${plural(p.taffs, 'taff')} · jauge ${p.gauge}/${this.gaugeMax}` : `🥃 ${p.taken} bues · ${p.given} données`;
      } else if (g.id === 'seance') {
        main = `${p.taffs} 🌿`;
        sub = plural(p.taffs, 'taff');
      } else {
        main = `${p.taken} ${this.isMashup ? (p.camp === 'fumette' ? '🌿' : '🥃') : this.unitEmoji}`;
        sub = this.isMashup ? (p.camp === 'fumette' ? `${plural(p.taken, 'taff')} prise${p.taken > 1 ? 's' : ''}` : `${plural(p.taken, 'gorgée')} bue${p.taken > 1 ? 's' : ''}`) : fum ? plural(p.taken, 'taff') + ' prise' + (p.taken > 1 ? 's' : '') : plural(p.taken, 'gorgée') + ' bue' + (p.taken > 1 ? 's' : '');
      }
      return h('li', { class: i === 0 ? 'first' : '', style: { '--i': i, '--pc': p.color } },
        h('span', { class: 'rank', text: String(i + 1) }),
        h('span', { class: 'pname', text: `${p.emoji ? p.emoji + ' ' : ''}${p.name}${this.isMashup ? (p.camp === 'fumette' ? ' 🌿' : ' 🥃') : ''}` }),
        h('span', { class: 'pscore' }, main, sub ? h('small', { text: sub }) : null));
    }));

    this.router.resetTo([...this.setupPath, 'end'], 'fwd').then(() => {
      this.sound.reward();
      const accent = getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#fff';
      this.fx.confetti([accent, '#ff5e9e', '#ffc857', '#ffffff', '#6dc7e8']);
    });
  }

  /* ---------------------------------------------------------------------- */
  /* AFFICHAGE COMMUN : joueur actif + tableau des scores                    */
  /* ---------------------------------------------------------------------- */
  /** Pastille d'un joueur : son emoji s'il en a un, sinon un point de couleur */
  avatar(p, cls) {
    return p.emoji ? h('span', { class: `${cls} emo`, style: { '--pc': p.color }, text: p.emoji }) : h('span', { class: cls, style: { '--pc': p.color } });
  }

  /** Choix de l'avatar d'un joueur */
  pickAvatar(p) {
    const taken = new Set(this.players.filter((x) => x.id !== p.id).map((x) => x.emoji));
    const sheet = $('#avatar-sheet');
    const close = () => { sheet.classList.add('closing'); setTimeout(() => { sheet.hidden = true; sheet.classList.remove('closing'); }, 220); };
    $('#avatar-grid').replaceChildren(...CONFIG.AVATARS.map((e) => h('button', {
      class: `avatar-pick${e === p.emoji ? ' is-on' : ''}`, text: e, disabled: taken.has(e),
      onclick: () => { p.emoji = e; this.save(); this.renderPlayers(); haptic(10); close(); },
    })));
    $$('[data-avatar="close"]', sheet).forEach((b) => { b.onclick = close; });
    sheet.hidden = false;
    sheet.classList.remove('closing');
  }

  setTurnName(el, player) {
    el.style.setProperty('--pc', player.color);
    const dot = $('.dot', el);
    if (dot) { dot.textContent = player.emoji || ''; dot.classList.toggle('emo', Boolean(player.emoji)); }
    $('.name', el).textContent = player.name;
    replay(el, 'swap');
  }

  scoreLine(p) {
    const g = this.game;
    const fum = this.mode === 'fumette';
    if (g.id === 'oie') {
      return p.camp === 'fumette'
        ? { v: `${p.pos}|${p.gauge}|${p.taffs}`, main: `case ${p.pos}`, small: ` · ${p.taffs} 🌿` }
        : { v: `${p.pos}|${p.taken}|${p.given}`, main: `case ${p.pos}`, small: ` · ${p.given}↗ ${p.taken}↘` };
    }
    if (g.id === 'quiz' && this.isMashup) {
      return p.camp === 'fumette'
        ? { v: `${p.score}|${p.gauge}|${p.taffs}`, main: `${p.score} pts`, small: ` · ${p.taffs} 🌿` }
        : { v: `${p.score}|${p.given}|${p.taken}`, main: `${p.score} pts`, small: ` · ${p.given}↗ ${p.taken}↘` };
    }
    if (g.id === 'quiz') {
      return fum
        ? { v: `${p.score}|${p.taffs}`, main: `${p.score} pts · ${p.taffs} 🌿`, small: '' }
        : { v: `${p.score}|${p.given}|${p.taken}`, main: `${p.score} pts`, small: ` · ${p.given}↗ ${p.taken}↘` };
    }
    if (g.id === 'roulette') {
      return fum
        ? { v: `${p.taffs}`, main: `${p.taffs} 🌿`, small: ` · ${formatTime(p.time)} d'attente` }
        : { v: `${p.taken}`, main: `${p.taken} 🥃`, small: '' };
    }
    return { v: `${p.taken}`, main: `${p.taken} ${this.isMashup ? (p.camp === 'fumette' ? '🌿' : '🥃') : this.unitEmoji}`, small: '' };
  }

  /** Tableau des scores avec animation FLIP : les lignes glissent quand le classement change */
  renderScores(screenId) {
    const g = this.game;
    const screen = this.router.screen(screenId);
    const list = $('[data-score-list]', screen);
    const title = $('[data-score-title]', screen);
    const fum = this.mode === 'fumette';
    title.textContent = g.id === 'oie' ? (this.isMashup ? 'Position · jauge 🌿 · gorgées 🥃' : fum ? 'Position · jauge 🌿' : 'Position · données ↗ bues ↘') : g.id === 'quiz' && this.isMashup ? 'Scores · jauge 🌿 · gorgées 🥃' : g.id === 'quiz' ? (fum ? 'Scores & taffs' : 'Scores · données ↗ bues ↘') : g.id === 'roulette' ? (fum ? 'Taffs' : 'Gorgées') : this.isMashup ? 'Taffs 🌿 · gorgées 🥃' : (fum ? 'Taffs prises' : 'Gorgées bues');

    const before = new Map([...list.children].map((li) => [li.dataset.id, { top: li.getBoundingClientRect().top, v: li.dataset.v, g: li.dataset.g }]));
    const showGauge = (p) => (g.id === 'oie' || (this.isMashup && g.id === 'quiz')) && p.camp === 'fumette';
    const sortKey = (p) => (g.id === 'oie' ? p.pos : g.id === 'quiz' ? p.score : g.id === 'roulette' && fum ? p.taffs : p.taken);
    const sorted = [...g.players].sort((a, b) => sortKey(b) - sortKey(a));
    const current = g.players[g.turn];

    list.replaceChildren(...sorted.map((p) => {
      const line = this.scoreLine(p);
      const gauge = showGauge(p);
      return h('li', { class: `score-row${current && p.id === current.id && g.kind !== 'cards' ? ' current' : ''}${gauge ? ' has-gauge' : ''}`, dataset: { id: p.id, v: line.v, g: gauge ? p.gauge : '' }, style: { '--pc': p.color } },
        this.avatar(p, 'sdot'),
        h('span', { class: 'sname', text: this.isMashup ? `${p.camp === 'fumette' ? '🌿' : '🥃'} ${p.name}` : p.name }),
        h('span', { class: 'sval' }, line.main, line.small ? h('small', { text: line.small }) : null),
        gauge ? h('span', { class: 'gauge', 'aria-label': `Jauge ${p.gauge} sur ${this.gaugeMax}` },
          ...Array.from({ length: this.gaugeMax }, (_, k) => h('i', { class: k < p.gauge ? 'on' : '' }))) : null);
    }));

    this.refreshUndo();
    if (reducedMotion.matches) return;
    [...list.children].forEach((li) => {
      const old = before.get(li.dataset.id);
      if (!old) return;
      const dy = old.top - li.getBoundingClientRect().top;
      if (dy && li.animate) li.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 480, easing: 'cubic-bezier(.16,1,.3,1)' });
      if (old.v !== li.dataset.v) replay($('.sval', li), 'pop-val');
      if (old.g !== undefined && old.g !== '' && li.dataset.g !== '' && Number(li.dataset.g) < Number(old.g)) replay($('.gauge', li), 'drain');
    });
    this.refreshUndo();
  }

  /** Pastilles joueurs sélectionnables (multi ou simple) */
  renderChips(container, players, { multi = false, counters = null, onChange = () => {}, labelOf = null } = {}) {
    const selected = new Set();
    container.replaceChildren(...players.map((p, i) => {
      const chip = h('button', { class: 'chip', style: { '--pc': p.color, '--i': i }, dataset: { id: p.id }, 'aria-pressed': 'false' },
        this.avatar(p, 'cdot'), labelOf ? labelOf(p) : p.name, counters ? h('span', { class: 'cbadge', text: '0' }) : null);
      chip.addEventListener('click', () => {
        haptic(10);
        if (counters) { counters(p, chip); return; }
        if (multi) {
          if (selected.has(p.id)) selected.delete(p.id); else selected.add(p.id);
        } else {
          selected.clear();
          selected.add(p.id);
        }
        [...container.children].forEach((c) => {
          const on = selected.has(c.dataset.id);
          c.classList.toggle('is-on', on);
          c.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        onChange(selected);
      });
      return chip;
    }));
    return selected;
  }
}

/**
 * Chaque jeu vit dans son propre fichier (dossier jeux/) et ajoute ses méthodes
 * à l'application : addGame(class { maMethode() { ... } }).
 * On écrit donc les jeux comme des classes normales, sans aucun outil de build.
 */
function addGame(mixin) {
  for (const key of Object.getOwnPropertyNames(mixin.prototype)) {
    if (key === 'constructor') continue;
    Object.defineProperty(SmokeOrDrinkApp.prototype, key, Object.getOwnPropertyDescriptor(mixin.prototype, key));
  }
}
