/**
 * SMOKE OR DRINK — Récap de soirée
 * ------------------------------------------------------------------------------
 * Chaque partie terminée est ajoutée à la "soirée" en cours (sauvegardée sur le
 * téléphone). Une soirée se termine toute seule après 8 h sans partie, ou quand
 * on appuie sur « nouvelle soirée ».
 * Le récap cumule tout, décerne des trophées et fabrique une image à partager.
 * ------------------------------------------------------------------------------
 */
'use strict';

const SOIREE_KEY = 'sod_soiree';
const SOIREE_GAP = 8 * 3600 * 1000;

const TROPHIES = [
  { id: 'king',   icon: '🏆', title: 'Roi de la soirée',     unit: (n) => plural(n, 'couronne'),         key: (s) => s.wins },
  { id: 'drunk',  icon: '🍺', title: 'Le plus arrosé',        unit: (n) => plural(n, 'gorgée') + ' bue' + (n > 1 ? 's' : ''), key: (s) => s.drinks },
  { id: 'smoker', icon: '🌿', title: 'Le plus gros fumeur',   unit: (n) => plural(n, 'taff'),             key: (s) => s.smokes },
  { id: 'brain',  icon: '🧠', title: 'Le cerveau',            unit: (n) => plural(n, 'point') + ' au quiz', key: (s) => s.points },
  { id: 'boss',   icon: '😈', title: 'Le bourreau',           unit: (n) => `${n} distribué${n > 1 ? 's' : ''}`, key: (s) => s.given },
  { id: 'target', icon: '🎯', title: 'Le plus saboté',        unit: (n) => `${n} sabotage${n > 1 ? 's' : ''} subi${n > 1 ? 's' : ''}`, key: (s) => s.sabotaged },
];

addGame(class {
  /* ---------- Stockage ---------- */
  soireeLoad() {
    try {
      const s = JSON.parse(localStorage.getItem(SOIREE_KEY) || 'null');
      if (s && Array.isArray(s.games)) {
        const last = s.games.length ? s.games[s.games.length - 1].at : s.startedAt;
        if (Date.now() - last < SOIREE_GAP) return s;
      }
    } catch (e) { /* ignore */ }
    return { startedAt: Date.now(), games: [] };
  }
  soireeSave(s) {
    try { localStorage.setItem(SOIREE_KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
  }

  /** Appelé à la fin de chaque partie : on range ses résultats dans la soirée */
  soireeRecord(g, ranked) {
    const played = g.count > 0 || g.players.some((p) => p.score || p.taken || p.taffs || p.given);
    if (!played) return;
    const def = CONFIG.GAMES.find((x) => x.id === (g.id === 'seance' ? 'roulette' : g.id));
    const smokesFromTaken = ['jamais', 'probable', 'bombe', 'memes', 'roulette'].includes(g.id);
    const s = this.soireeLoad();
    s.games.push({
      at: Date.now(), id: g.id, title: g.id === 'seance' ? 'Séance' : def ? def.title : g.id, icon: g.id === 'seance' ? '🎬' : def ? def.icon : '🎲',
      winner: ranked[0] ? ranked[0].id : null,
      players: g.players.map((p) => {
        const smoker = p.camp === 'fumette';
        return {
          id: p.id, name: p.name, emoji: p.emoji || '', color: p.color, camp: p.camp,
          drinks: smoker ? 0 : p.taken,
          smokes: smoker ? p.taffs + (smokesFromTaken ? p.taken : 0) : 0,
          points: g.id === 'quiz' ? p.score : 0,
          given: p.given || 0,
          sabotaged: p.sabotaged || 0,
        };
      }),
    });
    this.soireeSave(s);
    this.refreshRecapButtons();
  }

  /** Cumul par joueur (un même nom = un même joueur d'une partie à l'autre) */
  soireeStats(s = this.soireeLoad()) {
    const map = new Map();
    s.games.forEach((game) => game.players.forEach((p) => {
      const key = p.name.toLowerCase();
      const cur = map.get(key) || { name: p.name, emoji: p.emoji, color: p.color, camps: new Set(), drinks: 0, smokes: 0, points: 0, given: 0, sabotaged: 0, wins: 0, games: 0 };
      cur.emoji = p.emoji || cur.emoji;
      cur.camps.add(p.camp);
      ['drinks', 'smokes', 'points', 'given', 'sabotaged'].forEach((k) => { cur[k] += p[k] || 0; });
      cur.games += 1;
      if (game.winner === p.id) cur.wins += 1;
      map.set(key, cur);
    }));
    return [...map.values()];
  }

  soireeTrophies(stats) {
    return TROPHIES.map((t) => {
      const best = [...stats].sort((a, b) => t.key(b) - t.key(a))[0];
      return best && t.key(best) > 0 ? { ...t, who: best, value: t.key(best) } : null;
    }).filter(Boolean);
  }

  refreshRecapButtons() {
    const n = this.soireeLoad().games.length;
    $$('[data-action="recap"]').forEach((b) => {
      b.hidden = n === 0;
      const c = $('.rc-count', b);
      if (c) c.textContent = plural(n, 'partie');
    });
  }

  /* ---------- Écran du récap ---------- */
  openRecap() {
    const s = this.soireeLoad();
    if (!s.games.length) { this.toast('Aucune partie terminée ce soir'); return; }
    const stats = this.soireeStats(s);
    const trophies = this.soireeTrophies(stats);
    const ranked = [...stats].sort((a, b) => b.wins - a.wins || (b.drinks + b.smokes) - (a.drinks + a.smokes));
    const since = new Date(s.startedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    $('#recap-sub').textContent = `// ${plural(s.games.length, 'partie')} depuis ${since}`;
    $('#recap-games').replaceChildren(...s.games.map((g) => {
      const w = g.players.find((p) => p.id === g.winner);
      return h('span', { class: 'rg-chip' }, `${g.icon} ${g.title}`, w ? h('small', { text: ` · 👑 ${w.name}` }) : null);
    }));
    $('#recap-trophies').replaceChildren(...trophies.map((t, i) => h('li', { class: 'trophy', style: { '--i': i, '--pc': t.who.color } },
      h('span', { class: 'tr-icon', text: t.icon }),
      h('span', { class: 'tr-body' }, h('span', { class: 'tr-title', text: t.title }), h('span', { class: 'tr-who', text: `${t.who.emoji || ''} ${t.who.name}` })),
      h('span', { class: 'tr-val', text: t.unit(t.value) }))));
    $('#recap-table').replaceChildren(...ranked.map((p, i) => h('li', { class: `podium-row${i === 0 ? ' first' : ''}`, style: { '--i': i, '--pc': p.color } },
      h('span', { class: 'rank', text: String(i + 1) }),
      h('span', { class: 'pname', text: `${p.emoji || ''} ${p.name}` }),
      h('span', { class: 'pscore' }, plural(p.wins, 'couronne'),
        h('small', { text: [p.drinks ? `🥃 ${p.drinks}` : '', p.smokes ? `🌿 ${p.smokes}` : '', p.points ? `🧠 ${p.points}` : ''].filter(Boolean).join(' · ') || '—' })))));

    // L'image est préparée tout de suite : au moment du tap, le partage part sans attendre
    this._recapBlob = null;
    this.recapImage(s, stats, trophies, ranked).then((blob) => { this._recapBlob = blob; });
    this.router.go('recap');
  }

  async newSoiree() {
    const ok = await this.confirm('Nouvelle soirée ?', 'Le récap actuel sera effacé.', 'effacer');
    if (!ok) return;
    this.soireeSave({ startedAt: Date.now(), games: [] });
    this.refreshRecapButtons();
    this.toast('🌙 Nouvelle soirée, compteurs à zéro');
    this.router.back();
  }

  async shareRecap() {
    const blob = this._recapBlob;
    if (!blob) { this.toast('Image en préparation… réessaie dans une seconde'); return; }
    const file = new File([blob], 'smoke-or-drink-soiree.png', { type: 'image/png' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Smoke or Drink', text: 'Le récap de la soirée 🏆' });
        return;
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return; // partage annulé
    }
    // Pas de partage natif : on télécharge l'image
    const a = h('a', { href: URL.createObjectURL(blob), download: 'smoke-or-drink-soiree.png' });
    document.body.append(a);
    a.click();
    a.remove();
    this.toast('📥 Image enregistrée');
  }

  /* ---------- Image à partager (canvas 1080 × 1350) ---------- */
  async recapImage(s, stats, trophies, ranked) {
    try { await document.fonts.ready; } catch (e) { /* ignore */ }
    const W = 1080, H = 1350;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    const accent = getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#c9e35c';
    // Fond
    const bg = x.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0a0612'); bg.addColorStop(1, '#1a0d26');
    x.fillStyle = bg; x.fillRect(0, 0, W, H);
    const glow = (cx, cy, r, col) => { const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, col); g.addColorStop(1, 'transparent'); x.fillStyle = g; x.fillRect(0, 0, W, H); };
    glow(150, 120, 520, 'rgba(126,224,122,.28)');
    glow(950, 1250, 600, 'rgba(255,168,69,.25)');
    // Titre
    x.textAlign = 'center';
    x.fillStyle = accent;
    x.font = '36px VT323, monospace';
    x.fillText('// RÉCAP DE LA SOIRÉE', W / 2, 110);
    x.fillStyle = '#f4ecd8';
    x.font = '76px "Major Mono Display", monospace';
    x.fillText('SMOKE or DRINK', W / 2, 210);
    x.font = '34px "Space Grotesk", sans-serif';
    x.fillStyle = '#a89b85';
    x.fillText(`${plural(s.games.length, 'partie')} · ${new Date(s.startedAt).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}`, W / 2, 265);
    // Podium (3 premiers)
    const top = ranked.slice(0, 3);
    const slots = [{ i: 1, x: 260, h: 190 }, { i: 0, x: 540, h: 260 }, { i: 2, x: 820, h: 140 }];
    slots.forEach(({ i, x: px, h: ph }) => {
      const p = top[i];
      if (!p) return;
      const base = 700;
      x.fillStyle = i === 0 ? accent : 'rgba(244,236,216,.14)';
      x.globalAlpha = i === 0 ? 0.9 : 1;
      x.beginPath(); x.roundRect(px - 120, base - ph, 240, ph, 24); x.fill();
      x.globalAlpha = 1;
      x.fillStyle = '#fff';
      x.font = '110px serif';
      x.fillText(p.emoji || '🙂', px, base - ph - 40);
      x.fillStyle = i === 0 ? '#0a0612' : '#f4ecd8';
      x.font = '700 64px "Space Grotesk", sans-serif';
      x.fillText(String(i + 1), px, base - ph + 80);
      x.fillStyle = '#f4ecd8';
      x.font = '600 40px "Space Grotesk", sans-serif';
      x.fillText(p.name.slice(0, 12), px, base + 56);
      x.fillStyle = '#a89b85';
      x.font = '30px "Space Grotesk", sans-serif';
      x.fillText(plural(p.wins, 'couronne'), px, base + 98);
    });
    // Trophées
    x.textAlign = 'left';
    let y = 900;
    trophies.slice(0, 5).forEach((t) => {
      x.fillStyle = 'rgba(255,255,255,.05)';
      x.beginPath(); x.roundRect(90, y - 62, 900, 84, 20); x.fill();
      x.font = '52px serif'; x.fillStyle = '#fff';
      x.fillText(t.icon, 120, y);
      x.font = '600 34px "Space Grotesk", sans-serif'; x.fillStyle = '#f4ecd8';
      x.fillText(t.title, 200, y - 14);
      x.font = '28px "Space Grotesk", sans-serif'; x.fillStyle = '#a89b85';
      x.fillText(`${t.who.emoji || ''} ${t.who.name}`, 200, y + 18);
      x.textAlign = 'right'; x.font = '34px VT323, monospace'; x.fillStyle = accent;
      x.fillText(t.unit(t.value), 960, y);
      x.textAlign = 'left';
      y += 98;
    });
    return new Promise((resolve) => c.toBlob((b) => resolve(b), 'image/png'));
  }
});
