/**
 * SMOKE OR DRINK — Le meme de la soirée
 * ------------------------------------------------------------------------------
 * Un meme (légende + image) apparaît, tout le monde pointe du doigt le joueur
 * à qui il correspond le plus. Le plus désigné prend la pénalité de son camp.
 *
 * - Les memes sont dans memes.json (texte léger, chargé au lancement du jeu).
 * - Les images viennent d'Internet (Imgflip) et ne se chargent qu'au moment
 *   de les afficher ; le service worker les garde ensuite pour le hors-ligne.
 * - Image introuvable ou pas de réseau : la légende s'affiche quand même.
 * ------------------------------------------------------------------------------
 */
'use strict';

const MEME_LEVELS = {
  chill:  { emoji: '🙂', label: 'Chill',  small: 'galères & honte', includes: ['chill'] },
  soiree: { emoji: '😈', label: 'Soirée', small: '+ alcool, fumette', includes: ['chill', 'soiree'] },
  hot:    { emoji: '🔥', label: 'Hot 18+', small: '+ drague, ex, plans', includes: ['chill', 'soiree', 'hot'] },
};

addGame(class {
  /* ---------- Configuration ---------- */
  renderMemeLevel() {
    $('#memelevel-grid').replaceChildren(...Object.entries(MEME_LEVELS).map(([id, l]) => this.pill({
      on: this.settings.memeLevel === id, emoji: l.emoji, label: l.label, small: l.small,
      onClick: () => { this.settings.memeLevel = id; this.save(); this.renderMemeLevel(); this.validateSetup(); },
    })));
  }

  renderMemeMode() {
    const opts = [
      { id: 'point', emoji: '👉', label: 'On pointe', small: 'à qui ça correspond ?' },
      { id: 'libre', emoji: '✍️', label: 'Légende libre', small: 'inventez, votez' },
    ];
    $('#mememode-grid').replaceChildren(...opts.map((o) => this.pill({
      on: (this.settings.memeMode || 'point') === o.id, emoji: o.emoji, label: o.label, small: o.small,
      onClick: () => { this.settings.memeMode = o.id; this.save(); this.renderMemeMode(); this.validateSetup(); },
    })));
  }

  get memeLibre() { return this.settings.memeMode === 'libre'; }

  memesInfo() {
    const lvl = MEME_LEVELS[this.settings.memeLevel] || MEME_LEVELS.soiree;
    if (!this.memeDb) { this.loadMemes().then(() => this.validateSetup()); return '// chargement des memes…'; }
    const n = this.memeDb.filter((m) => lvl.includes.includes(m.level)).length;
    return `// ${n} memes · images chargées à la demande`;
  }

  async loadMemes() {
    if (this.memeDb) return this.memeDb;
    if (this._memeLoading) return this._memeLoading;
    this._memeLoading = fetch('memes.json', { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => (Array.isArray(d) ? d : d.memes || []))
      .catch((e) => { console.warn('[Memes] memes.json indisponible', e); return []; })
      .then((list) => {
        this.memeDb = list.filter((m) => m && typeof m.caption === 'string' && m.caption.trim());
        if (!this.memeDb.length) {
          this.memeDb = [{ id: 'fb1', img: '', template: '', caption: 'Celui qui dit « je bois juste un verre »', level: 'chill' }];
        }
        return this.memeDb;
      });
    return this._memeLoading;
  }

  /* ---------- Partie ---------- */
  async memesStart() {
    const g = this.game;
    await this.loadMemes();
    const lvl = MEME_LEVELS[this.settings.memeLevel] || MEME_LEVELS.soiree;
    // Légende libre : il faut une image, la légende d'origine n'est qu'un bonus
    const pool = this.memeDb.filter((m) => lvl.includes.includes(m.level) && (!this.memeLibre || m.img));
    g.deck = new Deck(pool.length ? pool : this.memeDb);
    g.failed = new Set(); // images qui n'ont pas pu se charger
    if (!g.memeBound) {
      g.memeBound = true;
      $('#meme-count').onclick = () => {
        if (!this.memeLibre) { this.countdown321($('#meme-count')); return; }
        const cap = $('#meme-caption');
        cap.classList.toggle('revealed');
        cap.textContent = cap.classList.contains('revealed') ? `💡 ${this.game.deck.last.caption}` : '✍️ À vous d’inventer la légende !';
      };
      $('#meme-skip').onclick = () => this.memesNext(false);
      $('#meme-validate').onclick = () => this.memesNext(true);
    }
    this.memesTurn(true);
  }

  /** Charge une image avec un délai max ; renvoie true si elle s'affiche */
  memeLoadImage(src, timeout = 7000) {
    return new Promise((resolve) => {
      if (!src) { resolve(false); return; }
      const img = new Image();
      const t = setTimeout(() => { img.src = ''; resolve(false); }, timeout);
      img.onload = () => { clearTimeout(t); resolve(true); };
      img.onerror = () => { clearTimeout(t); resolve(false); };
      img.src = src;
    });
  }

  async memesTurn(first = false) {
    this.beginTurn('memesTurn');
    const g = this.game;
    if (!g || g.over) return;
    if (this.checkEnd()) { this.finish(); return; }
    g.locked = true;
    const meme = g.deck.draw();
    if (g.deck.reshuffled) this.toast('🔀 Tous les memes sont passés, on remélange !');

    const card = $('#meme-card');
    const wrap = $('#meme-img-wrap');
    const img = $('#meme-img');
    const libre = this.memeLibre;
    const fill = () => {
      const reader = g.players[g.turn];
      const cap = $('#meme-caption');
      cap.classList.toggle('free', libre);
      cap.classList.remove('revealed');
      cap.textContent = libre ? '✍️ À vous d’inventer la légende !' : meme.caption;
      $('#meme-tpl').textContent = libre
        ? `🎤 ${reader.name} commence, puis on tourne`
        : meme.template ? `${meme.template} · 📖 ${reader.name} lit` : `📖 ${reader.name} lit`;
      $('#meme-count').textContent = libre ? '💡 voir la légende d’origine' : '3 · 2 · 1 → pointez !';
      $('#meme-round').textContent = `MEME ${g.count + 1}${g.end.cards ? '/' + g.end.cards : ''}`;
      wrap.classList.remove('loaded', 'failed');
      wrap.classList.add('loading');
      img.removeAttribute('src');
      card.classList.remove('out');
      replay(card, 'in');

      // Image : chargée maintenant, et la suivante préchargée en arrière-plan
      const src = meme.img;
      if (!src || g.failed.has(src)) {
        wrap.classList.remove('loading');
        wrap.classList.add('failed');
      } else {
        this.memeLoadImage(src).then((ok) => {
          if (g.deck.last !== meme || this.game !== g) return; // on est déjà passé au meme suivant
          wrap.classList.remove('loading');
          if (ok) { img.src = src; wrap.classList.add('loaded'); g.skips = 0; } else {
            g.failed.add(src); wrap.classList.add('failed');
            // Sans image, pas de légende à inventer : on passe au suivant
            if (libre && (g.skips = (g.skips || 0) + 1) <= 5) { this.toast('🖼️ Image indisponible, meme suivant'); this.later(() => this.memesTurn(), 600); }
          }
        });
      }
      const upcoming = g.deck.pile[g.deck.pile.length - 1];
      if (upcoming && upcoming.img) this.memeLoadImage(upcoming.img, 15000);

      // Vote
      const mash = this.isMashup;
      const fum = this.mode === 'fumette';
      $('#meme-label').textContent = mash
        ? 'Le plus désigné : 🥃 boit 2 · 🌿 prend une taff'
        : `Le plus désigné ${fum ? 'prend une taff 🌿' : `boit ${this.unit(CONFIG.PENALTY.memes)} 🥃`}`;
      const validate = $('#meme-validate');
      validate.disabled = true;
      validate.textContent = 'VALIDER';
      if (libre) {
        // Étape 1 : la meilleure légende · étape 2 : son auteur choisit qui paie
        const label = $('#meme-label');
        const pen = mash ? '🥃 2 gorgées ou 🌿 une taff' : fum ? 'une taff 🌿' : `${this.unit(CONFIG.PENALTY.memes)} 🥃`;
        label.textContent = '🏆 Qui a sorti la meilleure légende ?';
        g.best = null;
        g.selected = new Set();
        this.renderChips($('#meme-chips'), g.players, {
          onChange: (sel) => {
            const best = g.players.find((x) => sel.has(x.id));
            if (!best) return;
            g.best = best;
            best.memeWins = (best.memeWins || 0) + 1;
            this.sound.reward();
            haptic([30, 30, 30]);
            label.textContent = `🎯 ${best.name} choisit qui prend ${pen}`;
            const others = g.players.filter((x) => x !== best);
            g.selected = this.renderChips($('#meme-chips'), others, {
              onChange: (s2) => { validate.disabled = s2.size === 0; validate.classList.toggle('pulse', s2.size > 0); },
            });
          },
        });
      } else {
        g.selected = this.renderChips($('#meme-chips'), g.players, {
          onChange: (sel) => { validate.disabled = sel.size === 0; validate.classList.toggle('pulse', sel.size > 0); },
        });
      }
      $('#meme-count').disabled = false;
      g.locked = false;
      this.renderScores('memes');
    };
    if (first || reducedMotion.matches) fill();
    else { replay(card, 'out'); this.later(fill, 280); }
  }

  memesNext(apply) {
    const g = this.game;
    if (!g || g.over || g.locked) return;
    if (apply) {
      const target = g.players.find((p) => g.selected.has(p.id));
      if (!target) return;
      g.locked = true;
      const camp = this.campOf(target);
      const n = camp === 'fumette' ? 1 : CONFIG.PENALTY.memes;
      target.taken += n;
      const chip = $(`#meme-chips .chip[data-id="${target.id}"]`);
      this.fx.burstFrom(chip, { colors: [target.color, '#fff', '#ffc857'], count: 40, power: 8 });
      this.sound.good();
      haptic(30);
      this.toast(camp === 'fumette' ? `🌿 ${target.name} prend une taff` : `🥃 ${target.name} boit ${n}`, 'good');
      g.count += 1;
    } else {
      g.locked = true;
    }
    $('#meme-validate').classList.remove('pulse');
    g.turn = (g.turn + 1) % g.players.length;
    this.later(() => this.memesTurn(), apply ? 300 : 0);
  }
});
