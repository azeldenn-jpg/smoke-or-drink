/**
 * SMOKE OR DRINK — Menu « Infos » : version, nouveautés, réparation
 * ------------------------------------------------------------------------------
 *  - Bouton ⓘ sur l'accueil.
 *  - « Quoi de neuf » s'ouvre tout seul une fois après chaque nouvelle version.
 *  - « Réparer l'app » vide le cache hors-ligne et recharge, SANS toucher aux
 *    joueurs, cartes perso, réglages ni à l'historique de soirée.
 *  - Badge NEW : visible pendant la version de sortie du jeu, et disparaît dès
 *    qu'on y a joué une fois sur ce téléphone.
 * ------------------------------------------------------------------------------
 */
'use strict';

/** Nouveautés, de la plus récente à la plus ancienne (clé = version majeure.mineure) */
const CHANGELOG = [
  { v: '5.0', title: 'La grosse mise à jour de nuit', items: [
    '🛡️ Tests automatiques : chaque jeu est joué par un robot avant chaque publication. Si quelque chose plante, la mise à jour n’arrive pas sur ton téléphone.',
    'ⓘ Ce menu Infos : version, nouveautés, et un bouton pour réparer l’app en cas de souci.',
    '🆕 Le badge NEW disparaît à la version suivante, ou dès que tu as joué au jeu une fois.',
  ] },
  { v: '4.8', title: 'L’Hippodrome', items: [
    '🏇 Six chevaux, des cotes calculées sur le téléphone, des paris visibles et une vraie course en deux vues (profil / dessus).',
    '🥃 Mise bue d’avance, ×2 si tu perds ; gros gains en culs secs ou traversée du désert ; Grand Prix en 3 courses.',
    '📸 Photo-finish au ralenti, podium avec les parieurs, sons de sabots, cloche et fanfare.',
  ] },
  { v: '4.7', title: 'Oie Express et éditeur de cartes', items: [
    '🦢 Oie Express (32 cases), dé 3D et reprise de partie.',
    '🧠 Quiz : chrono, buzzer et 1 431 questions dont 798 « Insolite ».',
    '✏️ Tes propres cartes pour Je n’ai jamais, Qui pourrait… et la Bombe.',
  ] },
];

const SEEN_KEY = 'sod_seen_version';
const PLAYED_KEY = 'sod_played';
const minorOf = (v) => v.split('.').slice(0, 2).join('.');

addGame(class {
  /** Jeux déjà lancés au moins une fois sur ce téléphone */
  get playedGames() {
    try { return JSON.parse(localStorage.getItem(PLAYED_KEY) || '[]'); } catch (e) { return []; }
  }

  markPlayed(id) {
    const list = this.playedGames;
    if (list.includes(id)) return;
    list.push(id);
    try { localStorage.setItem(PLAYED_KEY, JSON.stringify(list)); } catch (e) { /* ignore */ }
  }

  /** Le badge NEW s'affiche pendant la version de sortie, tant qu'on n'y a pas joué */
  isNewGame(g) {
    return Boolean(g.since) && g.since === minorOf(CONFIG.VERSION) && !this.playedGames.includes(g.id);
  }

  /** Après une mise à jour : on montre les nouveautés une seule fois */
  maybeShowWhatsNew() {
    let seen = null;
    try { seen = localStorage.getItem(SEEN_KEY); } catch (e) { /* ignore */ }
    const cur = minorOf(CONFIG.VERSION);
    try { localStorage.setItem(SEEN_KEY, cur); } catch (e) { /* ignore */ }
    // Première installation : rien à montrer. Version déjà vue : rien non plus.
    const firstRun = !seen && !localStorage.getItem('sod_settings');
    if (firstRun || seen === cur) return;
    this.later(() => this.openInfos(true), 900);
  }

  openInfos(whatsNew = false) {
    const sheet = $('#about-sheet');
    const body = $('#about-body');
    const entries = whatsNew ? CHANGELOG.slice(0, 1) : CHANGELOG;
    body.replaceChildren(
      h('p', { class: 'sheet-title', text: whatsNew ? `✨ Quoi de neuf dans la v${minorOf(CONFIG.VERSION)}` : 'ⓘ Infos' }),
      whatsNew ? null : h('p', { class: 'about-ver pixel', text: `Smoke or Drink · version ${CONFIG.VERSION}` }),
      ...entries.map((e) => h('div', { class: 'about-block' },
        h('p', { class: 'about-h' }, h('span', { class: 'about-tag pixel', text: `v${e.v}` }), e.title),
        h('ul', { class: 'info-list' }, e.items.map((it) => h('li', { text: it }))))),
      whatsNew ? null : h('div', { class: 'about-tools' },
        h('p', { class: 'section-label', text: 'Un souci ?' }),
        h('button', { class: 'btn-ghost', text: '🔧 RÉPARER L’APP', onclick: () => this.repairApp() }),
        h('p', { class: 'about-note', text: 'Vide le cache hors-ligne et recharge la dernière version. Tes joueurs, tes cartes perso et ton historique sont conservés.' }),
        h('button', { class: 'btn-ghost danger-ghost', text: '🗑️ TOUT RÉINITIALISER', onclick: () => this.resetApp() })),
      h('button', { class: 'btn-primary', text: whatsNew ? 'C’EST PARTI !' : 'FERMER', dataset: { about: 'close' } }));
    sheet.hidden = false;
    sheet.classList.remove('closing');
    const close = () => {
      sheet.classList.add('closing');
      setTimeout(() => { sheet.hidden = true; sheet.classList.remove('closing'); }, 220);
    };
    $$('[data-about="close"]', sheet).forEach((b) => { b.onclick = close; });
  }

  /** Vide le cache du mode hors-ligne puis recharge (les données locales restent) */
  async repairApp() {
    this.toast('🔧 Réparation en cours…');
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if (window.caches) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch (e) { /* on recharge quand même */ }
    setTimeout(() => location.reload(), 600);
  }

  async resetApp() {
    const ok = await this.confirm('Tout réinitialiser ?', 'Joueurs, réglages, cartes perso et historique de soirée seront effacés de ce téléphone. Impossible de revenir en arrière.', 'tout effacer', true);
    if (!ok) return;
    try { localStorage.clear(); } catch (e) { /* ignore */ }
    this.repairApp();
  }
});
