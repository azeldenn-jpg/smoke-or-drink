/**
 * SMOKE OR DRINK — Éditeur de cartes perso
 * ------------------------------------------------------------------------------
 * Chacun peut ajouter ses propres cartes (Je n'ai jamais, Qui pourrait…, thèmes
 * de la Bombe). Elles restent sur le téléphone (localStorage) et se mélangent
 * aux cartes officielles selon l'ambiance choisie.
 * « Proposer mes cartes » ouvre une issue GitHub pré-remplie : il suffit de
 * l'envoyer pour qu'elles rejoignent le jeu pour tout le monde.
 * ------------------------------------------------------------------------------
 */
'use strict';

const CUSTOM_KEY = 'sod_custom_cards';
const CUSTOM_TYPES = {
  jamais:   { label: 'Jamais', emoji: '🙊', prefix: "Je n'ai jamais…", ph: 'dormi dans une baignoire' },
  probable: { label: 'Qui pourrait', emoji: '👉', prefix: 'Qui est le plus susceptible de…', ph: 'finir la soirée en pyjama' },
  bombe:    { label: 'Bombe', emoji: '💣', prefix: 'Thème :', ph: 'Marques de chips' },
};
const REPO_ISSUES = 'https://github.com/azeldenn-jpg/smoke-or-drink/issues/new';

addGame(class {
  customCards() {
    if (this._custom) return this._custom;
    let c = null;
    try { c = JSON.parse(localStorage.getItem(CUSTOM_KEY) || 'null'); } catch (e) { /* ignore */ }
    this._custom = { jamais: [], probable: [], bombe: [], ...(c || {}) };
    return this._custom;
  }

  saveCustom() {
    try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(this.customCards())); } catch (e) { /* ignore */ }
  }

  get customCount() {
    const c = this.customCards();
    return c.jamais.length + c.probable.length + c.bombe.length;
  }

  /** Bouton « Mes cartes » dans l'écran de configuration */
  renderCustomButton() {
    const g = this.gameDef;
    const box = $('#custom-cards-box');
    if (!box || !g) return;
    const type = CUSTOM_TYPES[g.id] ? g.id : null;
    if (!type) { box.replaceChildren(); return; }
    const n = this.customCards()[type].length;
    box.replaceChildren(h('button', {
      class: 'btn-ghost custom-open', onclick: () => this.openEditor(type),
    }, `✏️ Mes cartes${n ? ` · ${n}` : ''}`));
  }

  openEditor(type = 'jamais') {
    const sheet = $('#editor-sheet');
    const close = () => {
      sheet.classList.add('closing');
      setTimeout(() => { sheet.hidden = true; sheet.classList.remove('closing'); }, 220);
      this.renderCustomButton();
      if (this.gameDef) this.validateSetup();
    };
    let cur = type;
    let lvl = 'soiree';
    const tabs = h('div', { class: 'ed-tabs' });
    const prefix = h('p', { class: 'ed-prefix pixel' });
    const input = h('input', { class: 'ed-input', type: 'text', maxlength: 120, autocomplete: 'off', enterkeyhint: 'done' });
    const lvls = h('div', { class: 'ed-lvls' });
    const list = h('ul', { class: 'ed-list' });
    const share = h('button', { class: 'btn-ghost', text: '📤 Proposer mes cartes' });

    const add = () => {
      let t = input.value.trim().replace(/\s+/g, ' ');
      if (!t) { input.focus(); return; }
      if (cur !== 'bombe') t = t.replace(/^(je n'?ai jamais|qui (est le plus susceptible de|pourrait)|de)\s*/i, '').replace(/[?.!…]+$/, '');
      const all = this.customCards()[cur];
      if (all.some((c) => c.t.toLowerCase() === t.toLowerCase())) { this.toast('Déjà dans tes cartes'); return; }
      all.unshift({ t, lvl, at: Date.now() });
      this.saveCustom();
      input.value = '';
      haptic(15);
      this.sound.reward();
      draw();
      input.focus();
    };
    input.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } };

    const draw = () => {
      const c = this.customCards();
      tabs.replaceChildren(...Object.entries(CUSTOM_TYPES).map(([id, t]) => h('button', {
        class: `ed-tab${id === cur ? ' is-on' : ''}`, onclick: () => { cur = id; draw(); },
      }, `${t.emoji} ${t.label}`, c[id].length ? h('b', { text: c[id].length }) : null)));
      prefix.textContent = CUSTOM_TYPES[cur].prefix;
      input.placeholder = CUSTOM_TYPES[cur].ph;
      lvls.replaceChildren(...Object.entries(MEME_LEVELS).map(([id, l]) => h('button', {
        class: `ed-lvl${id === lvl ? ' is-on' : ''}`, onclick: () => { lvl = id; draw(); },
      }, `${l.emoji} ${l.label}`)));
      const items = c[cur];
      list.replaceChildren(...(items.length ? items.map((it) => h('li', {},
        h('span', { class: 'ed-l', text: MEME_LEVELS[it.lvl] ? MEME_LEVELS[it.lvl].emoji : '🙂' }),
        h('span', { class: 'ed-t', text: it.t }),
        h('button', { class: 'ed-del', 'aria-label': 'Supprimer', text: '×', onclick: () => {
          c[cur] = c[cur].filter((x) => x !== it); this.saveCustom(); draw();
        } })))
        : [h('li', { class: 'ed-empty', text: 'Aucune carte pour l’instant. Écris la tienne au-dessus ✍️' })]));
      share.disabled = this.customCount === 0;
    };

    share.onclick = () => this.proposeCards();
    $('#editor-body').replaceChildren(tabs, prefix,
      h('div', { class: 'ed-row' }, input, h('button', { class: 'btn-primary ed-add', text: '+', 'aria-label': 'Ajouter', onclick: add })),
      lvls, list,
      h('p', { class: 'ed-note', text: 'Tes cartes restent sur ce téléphone et se mélangent aux autres selon l’ambiance. Pour les ajouter au jeu de tout le monde, propose-les : ça ouvre une page GitHub déjà remplie, tu n’as qu’à cliquer sur « Create ».' }),
      h('div', { class: 'ed-actions' }, share, h('button', { class: 'btn-primary', text: 'TERMINÉ', onclick: close })));
    $$('[data-editor="close"]', sheet).forEach((b) => { b.onclick = close; });
    draw();
    sheet.hidden = false;
    sheet.classList.remove('closing');
  }

  /** Ouvre une issue GitHub pré-remplie avec les cartes perso (format JSON prêt à fusionner) */
  proposeCards() {
    const c = this.customCards();
    const lines = [];
    Object.entries(CUSTOM_TYPES).forEach(([id, t]) => {
      if (!c[id].length) return;
      lines.push(`### ${t.emoji} ${t.label}`, '```json', JSON.stringify(c[id].map(({ t: tx, lvl }) => ({ t: tx, lvl })), null, 0), '```', '');
    });
    const body = `Cartes proposées depuis l'appli (v${CONFIG.VERSION}) :\n\n${lines.join('\n')}`;
    const title = `🃏 ${this.customCount} carte${this.customCount > 1 ? 's' : ''} proposée${this.customCount > 1 ? 's' : ''}`;
    const url = `${REPO_ISSUES}?labels=cartes&title=${encodeURIComponent(title)}&body=${encodeURIComponent(body.slice(0, 6000))}`;
    window.open(url, '_blank', 'noopener');
  }
});
