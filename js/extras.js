/**
 * SMOKE OR DRINK — fonctions transverses
 * ------------------------------------------------------------------------------
 *  - ↶ Annuler : chaque jeu appelle this.beginTurn('nomDuTour') au début d'un
 *    tour. On garde une photo de l'état (scores, positions, tour…). Annuler
 *    revient au début du tour en cours, ou du tour précédent s'il n'a pas bougé.
 *  - ? Règles : courtes, par jeu (RULES).
 *  - 🆕 Mise à jour : bandeau quand une nouvelle version est prête.
 * ------------------------------------------------------------------------------
 */
'use strict';

const RULES = {
  quiz: [
    'Chacun son tour : choisis ta mise (Facile 1, Moyen 2, Difficile 3), puis réponds.',
    '🥃 Bonne réponse : tu distribues ta mise. Mauvaise : tu la bois.',
    '🌿 Bonne réponse : tu gagnes des points ; tous les 5 points, une taff.',
    'Mashup : un fumeur garde ses jetons pour sa jauge ou les balance pour saboter.',
    'Options : chrono 15 s, mode buzzer (le premier qui tape son nom répond).',
  ],
  jamais: [
    'Le lecteur lit « Je n’ai jamais… ».',
    'Tous ceux qui l’ont DÉJÀ fait se dénoncent et prennent la pénalité.',
    'Personne ? On passe à la suivante.',
    'L’ambiance (Chill, Soirée, Hot) choisit le genre de cartes.',
  ],
  probable: [
    'Le lecteur lit « Qui est le plus susceptible de… ».',
    'Compte à rebours 3, 2, 1, puis tout le monde pointe quelqu’un en même temps.',
    'Le plus désigné prend la pénalité (2 gorgées ou une taff).',
  ],
  memes: [
    'Un meme apparaît avec sa légende.',
    'Au signal, tout le monde pointe le joueur à qui il correspond le plus.',
    'Le plus désigné prend la pénalité de son camp.',
    'Mode Légende libre : pas de légende ! Chacun invente la sienne à voix haute, on vote pour la meilleure, et son auteur choisit qui paie.',
  ],
  bombe: [
    'Un thème apparaît. Celui qui tient le téléphone allume la mèche.',
    'Il cite un mot du thème, puis passe le téléphone à sa gauche, et ainsi de suite.',
    'La mèche est secrète (20 à 50 s). Celui qui a la bombe quand elle explose prend la pénalité.',
    'Variante « lettre imposée » : tous les mots doivent commencer par la lettre tirée.',
  ],
  roulette: [
    'Classique : la roue tire le temps d’attente avant ta prochaine taff (Commun 70 %, Rare 24 %, Légendaire 6 %).',
    'Séance : entre la durée du film, l’appli tire tout le plan et sonne quand c’est ton tour.',
    'Mode alcool : la roue décide combien tu bois (6 % de cul sec).',
  ],
  preferes: [
    'Le lecteur lit le dilemme à voix haute. Appuyez sur « Votez ! » : 3, 2, 1…',
    'Au signal, tout le monde pointe en même temps : à gauche pour A, à droite pour B. Pas le droit d’hésiter !',
    'Tapez ensuite qui a choisi A. La minorité boit 2 gorgées (1 taff pour un fumeur).',
    'Égalité parfaite : tout le monde boit 1. Unanimité : personne ne boit.',
    'L’ambiance (Chill, Soirée, Hot) choisit les dilemmes. Ajoute les tiens avec « Mes cartes » : sépare les deux choix par « ou ».',
  ],
  plusmoins: [
    'Une carte est posée. Annonce si la suivante sera PLUS haute, PLUS basse, ou ÉGALE. L’As est la plus forte.',
    'Bonne réponse : ta série continue. Les pourcentages affichés t’aident : ils sont calculés sur les cartes qui restent.',
    'Raté : tu bois la pile, c’est-à-dire 1 + ta série. Carte égale sans l’avoir annoncée : cul sec !',
    'Égalité annoncée et juste : tu offres un cul sec.',
    '✋ Dès 3 bonnes réponses, tu peux passer la main au joueur suivant et distribuer ta série.',
  ],
  kings: [
    'Chacun son tour, tire une carte : sa règle s’affiche. L’app retient les rôles (maître du pouce, des questions, binômes) et les règles inventées.',
    'As : cascade · 2 : tu donnes 2 · 3 : tu bois 3 · 4 : par terre · 5 : maître du pouce · 6 : le ciel · 7 : tout le monde boit.',
    '8 : binôme · 9 : rimes · 10 : catégorie · Valet : maître des questions · Dame : je n’ai jamais · Roi : nouvelle règle.',
    '👑 Au 4e Roi, celui qui le tire boit la coupe (cul sec) et la partie est finie.',
    'Dans la configuration, touche une carte pour changer sa règle.',
  ],
  duel: [
    'Posez le téléphone à plat entre vous deux : chacun son côté de l’écran (celui du haut est retourné).',
    'Tapez chacun sur votre moitié pour dire « prêt ». La tension monte… puis « FEU ! » : le premier qui tape gagne.',
    'Tirer avant le FEU, ou sur un faux mot (FEUILLE, FÊTE…), c’est un faux départ : tu perds et tu prends 3 gorgées (1 taff).',
    'Le plus lent boit 2 gorgées (1 taff pour un fumeur). Ton temps de réaction s’affiche en millisecondes.',
    '🏆 Tournoi : élimination directe. Le champion désigne qui prend autant de gorgées qu’il y a de joueurs.',
  ],
  course: [
    'Six chevaux au départ, avec leur cote : plus elle est haute, moins il a de chances… et plus il rapporte.',
    'Chacun son tour, choisis un cheval et ta mise. Les paris sont visibles, et le premier parieur change à chaque course.',
    '🥃 Tu bois ta mise tout de suite pour valider ton pari. Ton cheval perd : tu rebois le double (au-delà de 8 : cul sec).',
    '🥃 Ton cheval gagne : tu distribues mise × cote. Plus de 12 : un cul sec à offrir · 18 : deux culs secs · 22 : la traversée du désert 🏜️.',
    '🌿 Ton cheval gagne : mise × cote en jetons (12 max) pour ta jauge, ou pour saboter. Il perd : ta mise sort de ta jauge.',
    '🥈 Personne n’a misé sur le gagnant : ceux qui ont le cheval le mieux placé encaissent à sa place (mise × sa cote).',
    '🎭 Tu as misé sur le dernier : un gage en plus. Égalité parfaite à l’arrivée : les deux chevaux sont gagnants.',
    '🏆 Grand Prix : 3 courses. Le meilleur parieur est sacré roi et offre un cul sec ; le dernier prend un gage.',
  ],
  oie: [
    'Lance le dé et avance. Il faut tomber pile sur la dernière case : si tu dépasses, tu rebondis avec un malus du surplus.',
    'Arriver sur une case occupée : le dernier arrivé prend un malus.',
    'Malus : un buveur boit, un fumeur perd de la jauge (3 points = une taff). Bonus : tu distribues, ou un fumeur garde pour sa jauge.',
    'Cases classiques : 🦢 oie, 🌉 pont, 🍻 auberge, 🕳️ puits, 🌀 labyrinthe, ⛓️ prison, 💀 tête de mort. Les autres lancent des mini-jeux.',
    'L’intensité (Soft, Normal, Hardcore) multiplie les malus par 1, 2 ou 3.',
  ],
};

addGame(class {
  /* ---------------------------------------------------------------------- */
  /* ↶ ANNULER                                                               */
  /* ---------------------------------------------------------------------- */
  /** À appeler en tout début de tour, avec le nom de la méthode du tour */
  beginTurn(fnName) {
    const g = this.game;
    if (!g || this._restoring) return;
    g.turnFn = fnName;
    g.history = g.history || [];
    g.history.push(this.snapshot());
    if (g.history.length > 40) g.history.shift();
    this.refreshUndo();
  }

  snapshot() {
    const g = this.game;
    return JSON.stringify({ turn: g.turn, round: g.round, count: g.count, players: g.players });
  }

  refreshUndo() {
    const g = this.game;
    const can = Boolean(g && !g.over && g.history && (g.history.length > 1 || (g.history.length === 1 && g.history[0] !== this.snapshot())));
    $$('[data-action="undo"]').forEach((b) => { b.disabled = !can; });
  }

  async undo() {
    const g = this.game;
    if (!g || g.over || !g.history || !g.history.length) return;
    const now = this.snapshot();
    let target = g.history[g.history.length - 1];
    if (target === now) {
      // Rien n'a bougé pendant ce tour : on remonte au tour précédent
      if (g.history.length < 2) { this.toast('Rien à annuler'); return; }
      g.history.pop();
      target = g.history[g.history.length - 1];
    }
    const data = JSON.parse(target);
    const who = data.players[data.turn];
    const ok = await this.confirm('Annuler ?', `On revient au début du tour de ${who ? who.name : 'ce joueur'} : les scores et positions d’avant sont restaurés.`, 'annuler le tour', false);
    if (!ok || this.game !== g) return;
    // On coupe tout ce qui est en cours (timers, bombe, roue, déplacements)
    this.clearTimers();
    this.bombStop();
    this.roulette.cancel();
    g.epoch = (g.epoch || 0) + 1;
    g.busy = false;
    g.bombLit = false;
    g.answered = false;
    g.locked = false;
    g.pending = [];
    g.turn = data.turn;
    g.round = data.round;
    g.count = data.count;
    g.players = data.players;
    if (g.kind === 'oie') this.oieBuildBoard();
    this._restoring = true;
    try {
      const fn = this[g.turnFn];
      if (typeof fn === 'function') fn.call(this, true);
    } finally {
      this._restoring = false;
    }
    this.toast(`↶ Retour au tour de ${who ? who.name : '…'}`, 'good');
    this.refreshUndo();
  }

  /* ---------------------------------------------------------------------- */
  /* ? RÈGLES                                                                */
  /* ---------------------------------------------------------------------- */
  showRules(id = this.gameId) {
    const g = CONFIG.GAMES.find((x) => x.id === id);
    const lines = RULES[id];
    if (!g || !lines) return;
    this.info(`${g.icon} ${g.title}`, lines);
  }

  /** Feuille d'information (un seul bouton) */
  info(title, lines) {
    const sheet = $('#info-sheet');
    $('#info-title').textContent = title;
    $('#info-list').replaceChildren(...lines.map((l) => h('li', { text: l })));
    sheet.hidden = false;
    sheet.classList.remove('closing');
    const close = () => {
      sheet.classList.add('closing');
      setTimeout(() => { sheet.hidden = true; sheet.classList.remove('closing'); }, 220);
    };
    $$('[data-info="close"]', sheet).forEach((b) => { b.onclick = close; });
  }

  /** Ajoute les boutons ↶ et ? dans l'en-tête de chaque écran de jeu */
  installGameButtons() {
    $$('.screen .game-top').forEach((top) => {
      const screen = top.closest('.screen').dataset.screen;
      const quit = $('.quit-btn', top);
      const tools = h('div', { class: 'game-tools' },
        screen !== 'seance' ? h('button', { class: 'tool-btn', dataset: { action: 'undo' }, 'aria-label': 'Annuler le dernier tour', disabled: true, text: '↶' }) : null,
        h('button', { class: 'tool-btn', dataset: { action: 'rules' }, 'aria-label': 'Règles du jeu', text: '?' }));
      top.insertBefore(tools, quit);
    });
    const title = $('#setup-title');
    title.after(h('button', { class: 'tool-btn setup-rules', dataset: { action: 'rules' }, 'aria-label': 'Règles du jeu', text: '? règles' }));
  }

  /* ---------------------------------------------------------------------- */
  /* 🆕 MISE À JOUR                                                          */
  /* ---------------------------------------------------------------------- */
  watchUpdates(reg) {
    if (!reg || this._watching) return;
    this._watching = true;
    const hadController = Boolean(navigator.serviceWorker.controller);
    // Le nouveau service worker prend la main tout seul (skipWaiting) : on propose de recharger
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || this._updateShown) return;
      this._updateShown = true;
      this.showUpdateBanner();
    });
    // Quand on revient sur l'appli (iPhone : elle n'est pas rechargée), on vérifie s'il y a du neuf
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
    setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
  }

  showUpdateBanner() {
    if ($('#update-banner')) return;
    const playing = this.game && !this.game.over;
    const banner = h('button', { class: 'update-banner', id: 'update-banner' },
      h('span', { text: '🆕' }),
      h('span', { class: 'ub-text' }, h('b', { text: 'Nouvelle version' }), playing ? ' · à la fin de la partie, touche pour mettre à jour' : ' · touche pour mettre à jour'));
    banner.addEventListener('click', async () => {
      if (this.game && !this.game.over) {
        const ok = await this.confirm('Mettre à jour maintenant ?', 'La partie en cours sera perdue.', 'mettre à jour');
        if (!ok) return;
      }
      location.reload();
    });
    document.body.append(banner);
  }
});
