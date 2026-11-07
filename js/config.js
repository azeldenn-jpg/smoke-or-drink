/**
 * SMOKE OR DRINK — configuration (catégories, roulette, liste des jeux)
 */
'use strict';

/* ==========================================================================
   1. CONFIG
   ========================================================================== */
const CONFIG = {
  VERSION: '5.0.0',
  STORAGE_KEY: 'sod_v3',
  MAX_PLAYERS: 10,
  AVATARS: ['😎', '🤠', '👽', '🦊', '🐸', '🐼', '🦁', '🐙', '🦄', '🐯', '👻', '🤖', '🍕', '🌵', '🔥', '⚡', '🍄', '🐲', '🦩', '🐵', '🥑', '💀', '🧠', '🍉', '🐻', '🦈', '😈', '🤡', '🧙', '🎸'],
  PLAYER_COLORS: ['#7ee07a', '#ff5e9e', '#6dc7e8', '#ffc857', '#a667d4', '#ff8855', '#5fb878', '#e85a8c', '#5ec8ff', '#f48fb1'],

  CATEGORIES: {
    histoire:    { name: 'Histoire',         emoji: '🏛️', color: '#d4a574' },
    geo:         { name: 'Géographie',       emoji: '🌍', color: '#5fb878' },
    sciences:    { name: 'Sciences',         emoji: '🔬', color: '#6dc7e8' },
    sport:       { name: 'Sport',            emoji: '🏅', color: '#ff8855' },
    cinema:      { name: 'Ciné & Séries',    emoji: '🎬', color: '#e85a8c' },
    musique:     { name: 'Musique',          emoji: '🎵', color: '#a667d4' },
    jeuxvideo:   { name: 'Jeux Vidéo',       emoji: '🎮', color: '#7ee0b8' },
    internet:    { name: 'Internet & Memes', emoji: '💻', color: '#5ec8ff' },
    bouffe:      { name: 'Bouffe & Drinks',  emoji: '🍕', color: '#ffc857' },
    litterature: { name: 'Littérature',      emoji: '📚', color: '#c97b63' },
    art:         { name: 'Art',              emoji: '🎨', color: '#f48fb1' },
    actu:        { name: 'Actu & People',    emoji: '📰', color: '#9ca3af' },
    insolite:    { name: 'Insolite',         emoji: '🤯', color: '#ff9f43' },
  },
  UNKNOWN_CATEGORY: { name: 'Divers', emoji: '❓', color: '#9ca3af' },

  // value = points (fumette) ou gorgées (alcool) en jeu sur la question
  DIFFS: {
    easy:   { name: 'Facile',    emoji: '🟢', color: '#7ee07a', value: 1 },
    medium: { name: 'Moyen',     emoji: '🟡', color: '#ffc857', value: 2 },
    hard:   { name: 'Difficile', emoji: '🔴', color: '#ff5e7e', value: 3 },
  },

  TAFF_EVERY: 5, // Mode fumette : 1 taff débloquée tous les 5 points

  // Pénalités des jeux de groupe (en gorgées pour l'alcool ; 1 taff en fumette)
  PENALTY: { jamais: 1, probable: 2, bombe: 3, memes: 2 },

  /**
   * Roulette : 50 segments → 35 Commun (70 %), 12 Rare (24 %), 3 Légendaire (6 %).
   * On tire UN segment au hasard et l'aiguille s'arrête dessus : les probabilités
   * affichées sont exactement celles du tirage, et la roue ne ment jamais.
   */
  ROULETTE: {
    SEGMENTS: 50,
    TIERS: {
      commun:     { name: 'Commun',     color: '#2ecc71', alt: '#26ad5f', count: 35 },
      rare:       { name: 'Rare',       color: '#3498db', alt: '#2c82c0', count: 12 },
      legendaire: { name: 'Légendaire', color: '#e74c3c', alt: '#e74c3c', count: 3 },
    },
    // Durées en secondes [min, max] (plages sans chevauchement)
    DURATIONS: {
      rapide:      { label: 'Rapide',      emoji: '⚡', commun: [15, 30],   rare: [6, 14],    legendaire: [3, 5] },
      raisonnable: { label: 'Raisonnable', emoji: '⏱️', commun: [180, 360], rare: [60, 179],  legendaire: [30, 59] },
      long:        { label: 'Long',        emoji: '🐢', commun: [300, 600], rare: [120, 299], legendaire: [60, 119] },
    },
    GORGEES: { commun: [1, 2], rare: [3, 4], legendaire: null }, // null = cul sec
    SPIN_MS: 4200,
  },

  GAMES: [
    { id: 'course', short: 'HIPPODROME', icon: '🏇', title: 'L’Hippodrome', min: 2, kind: 'course', since: '4.8', mashup: true,
      desc: { fumette: 'Six chevaux, des cotes, vos paris. Ton cheval gagne : mise × cote en jetons pour ta jauge.',
              alcool:  'Six chevaux, des cotes, vos paris. Bois ta mise pour parier : ton cheval gagne, tu distribues mise × cote ; il perd, tu rebois le double.',
              mashup:  'Six chevaux, vos paris : les buveurs distribuent leurs gains, les fumeurs remplissent leur jauge.' } },
    { id: 'memes', short: 'MEMES', icon: '🖼️', title: 'Le meme de la soirée', min: 3, kind: 'memes', since: '4.6', mashup: true,
      desc: { fumette: 'Un meme apparaît, tout le monde pointe celui à qui il colle le mieux. Le plus désigné prend une taff.',
              alcool:  'Un meme apparaît, tout le monde pointe celui à qui il colle le mieux. Le plus désigné boit 2 gorgées.',
              mashup:  'Un meme, un vote, une victime : 2 gorgées pour un buveur, une taff pour un fumeur.' } },
    { id: 'oie', short: "JEU DE L'OIE", icon: '🦢', title: "Jeu de l'oie", min: 2, kind: 'oie', since: '4.6', mashup: true,
      desc: { fumette: '63 cases, deux dés, des pièges et des mini-jeux. Remplis ta jauge pour fumer, sabote celle des autres.',
              alcool:  '63 cases, deux dés, des pièges et des mini-jeux. Chaque case peut te faire boire… ou distribuer.',
              mashup:  'Le plateau classique, chaque case s’adapte à ton camp : gorgées pour les buveurs, jauge pour les fumeurs.' } },
    { id: 'quiz', short: "QUIZ", icon: '🧠', title: 'Quiz Culture G', min: 2, kind: 'quiz', mashup: true,
      desc: { fumette: 'Choisis ta mise, réponds juste : tous les 5 points, une taff débloquée.',
              alcool:  'Choisis ta mise : bonne réponse tu distribues, mauvaise tu bois.',
              mashup:  'Fumeurs et buveurs, même quiz : garde tes jetons pour fumer ou balance-les pour saboter.' } },
    { id: 'jamais', short: "JE N'AI JAMAIS", icon: '🙊', title: "Je n'ai jamais", min: 2, kind: 'cards',
      desc: { fumette: "Ceux qui l'ont déjà fait prennent une taff. Les secrets tombent.",
              alcool:  "Ceux qui l'ont déjà fait boivent. Les secrets tombent." } },
    { id: 'probable', short: "QUI POURRAIT", icon: '👉', title: 'Qui pourrait…', min: 3, kind: 'cards',
      desc: { fumette: 'Tout le monde pointe du doigt en même temps. Le plus désigné prend une taff.',
              alcool:  'Tout le monde pointe du doigt en même temps. Le plus désigné boit 2 gorgées.' } },
    { id: 'bombe', short: "BOMBE", icon: '💣', title: 'La Bombe', min: 2, kind: 'bombe', mashup: true,
      desc: { fumette: "Un thème, un téléphone qui tourne, une mèche invisible. Celui qui l'a quand ça pète prend une taff.",
              alcool:  "Un thème, un téléphone qui tourne, une mèche invisible. Celui qui l'a quand ça pète boit 3 gorgées.",
              mashup:  "Un thème, un téléphone qui tourne, une mèche invisible. Quand ça pète : 3 gorgées pour un buveur, une taff pour un fumeur." } },
    { id: 'roulette', short: "ROULETTE", icon: '🎡', title: 'Roulette', min: 1, kind: 'roulette', mashup: true,
      desc: { fumette: 'Classique : la roue tire le temps avant ta prochaine taff. Séance : tout un plan de taffs calé sur ton film.',
              alcool:  'La roue décide combien tu bois. 6 % de chances de cul sec.',
              mashup:  'Chacun sa roue : le temps avant ta prochaine taff si tu fumes, tes gorgées si tu bois.' } },
  ],

  END_OPTIONS: {
    quiz: [
      { id: 'free', e: '∞', l: 'Libre' },
      { id: 'r10', e: '10', l: '10 manches', rounds: 10 },
      { id: 'r20', e: '20', l: '20 manches', rounds: 20 },
      { id: 'p15', e: '🏆', l: '1er à 15 pts', points: 15 },
      { id: 'p25', e: '🏆', l: '1er à 25 pts', points: 25 },
    ],
    cards: [
      { id: 'free', e: '∞', l: 'Libre' },
      { id: 'n10', e: '10', l: '10 cartes', cards: 10 },
      { id: 'n20', e: '20', l: '20 cartes', cards: 20 },
      { id: 'n30', e: '30', l: '30 cartes', cards: 30 },
    ],
    bombe: [
      { id: 'free', e: '∞', l: 'Libre' },
      { id: 'n5', e: '5', l: '5 explosions', cards: 5 },
      { id: 'n10', e: '10', l: '10 explosions', cards: 10 },
    ],
  },
};

// Petit jeu de secours si data.json / cards.json ne se chargent pas
const FALLBACK = {
  quiz: [
    { q: 'Qui a peint la Joconde ?', choices: ['Michel-Ange', 'Léonard de Vinci', 'Raphaël', 'Botticelli'], answer: 1, cat: 'art', diff: 'easy' },
    { q: 'Quelle est la capitale de l’Australie ?', choices: ['Sydney', 'Melbourne', 'Canberra', 'Perth'], answer: 2, cat: 'geo', diff: 'medium' },
    { q: 'Combien de cœurs a une pieuvre ?', choices: ['1', '2', '3', '4'], answer: 2, cat: 'sciences', diff: 'hard' },
    { q: 'Quel groupe a chanté « Bohemian Rhapsody » ?', choices: ['Queen', 'Led Zeppelin', 'The Beatles', 'Pink Floyd'], answer: 0, cat: 'musique', diff: 'easy' },
    { q: 'Quel studio a créé Elden Ring ?', choices: ['Capcom', 'FromSoftware', 'Square Enix', 'Konami'], answer: 1, cat: 'jeuxvideo', diff: 'medium' },
    { q: 'Quel traité met fin à la guerre de Trente Ans ?', choices: ['Westphalie', 'Utrecht', 'Versailles', 'Tilsit'], answer: 0, cat: 'histoire', diff: 'hard' },
  ],
  jamais: ['envoyé un message à la mauvaise personne', 'chanté au karaoké', 'raté un train', 'stalké un ex sur les réseaux'],
  probable: ['devenir célèbre', "s'endormir en premier ce soir", 'rater son vol', 'devenir millionnaire'],
  bombe: ['Fruits', 'Pays d’Europe', 'Marques de voiture', 'Pokémon'],
};
