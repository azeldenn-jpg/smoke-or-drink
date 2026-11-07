/**
 * SMOKE OR DRINK — Outils communs aux jeux d'ambiance (duel, cartes, Tu préfères, Time's Up…)
 * ------------------------------------------------------------------------------
 *  Une sanction se compte en « gorgées » ; pour un fumeur elle devient des taffs
 *  (environ 3 gorgées = 1 taff, au moins une), comme à la Bombe.
 * ------------------------------------------------------------------------------
 */
'use strict';

addGame(class {
  /** Combien de taffs pour un nombre de gorgées */
  sipsToTaffs(sips) { return Math.max(1, Math.round(sips / 3)); }

  /** Texte de la sanction selon le camp du joueur (« 2 gorgées » / « 1 taff ») */
  sanctionLabel(p, sips) {
    if (sips === 'cs') return this.campOf(p) === 'alcool' ? 'un CUL SEC' : 'une taff de pompier';
    return this.campOf(p) === 'alcool' ? plural(sips, 'gorgée') : plural(this.sipsToTaffs(sips), 'taff');
  }

  /** Applique la sanction (comptée dans « taken », qui s'affiche en gorgées ou en taffs) et renvoie le texte */
  sanction(p, sips) {
    const label = this.sanctionLabel(p, sips);
    if (sips === 'cs') p.taken += this.campOf(p) === 'alcool' ? 5 : 2;
    else p.taken += this.campOf(p) === 'alcool' ? sips : this.sipsToTaffs(sips);
    return `${this.campOf(p) === 'alcool' ? '🥃' : '🌿'} ${p.name} : ${label}`;
  }

  /** Bruit blanc partagé pour les sons générés */
  partyNoise() {
    const s = this.sound;
    if (!s.ctx) return null;
    if (!this._partyNoise) {
      const len = s.ctx.sampleRate;
      const buf = s.ctx.createBuffer(1, len, s.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this._partyNoise = buf;
    }
    return this._partyNoise;
  }

  /** Coup sourd (battement de cœur, coup de tambour) */
  partyThump(freq = 58, vol = 0.5, at = 0) {
    const s = this.sound;
    if (!s.ready) return;
    const c = s.ctx, t = c.currentTime + at;
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq * 1.8, t);
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.08);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g); g.connect(s.master);
    o.start(t); o.stop(t + 0.25);
  }

  /** Coup de feu : claquement bref + grave */
  partyBang() {
    const s = this.sound;
    if (!s.ready) return;
    const c = s.ctx, t = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = this.partyNoise();
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(4000, t);
    f.frequency.exponentialRampToValueAtTime(300, t + 0.35);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.9, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    src.connect(f); f.connect(g); g.connect(s.master);
    src.start(t, 0, 0.5);
    this.partyThump(45, 0.7);
  }

  /** Bip de compte à rebours (aigu = « go ») */
  partyBeep(high = false) {
    this.sound.tone(high ? 1320 : 660, high ? 0.25 : 0.12, { type: 'square', vol: 0.06 });
  }
});
