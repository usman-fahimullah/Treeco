#!/usr/bin/env node
/**
 * Generates static Pokemon pages for programmatic SEO.
 * Each page targets long-tail queries like "{pokemon} weakness", "{pokemon} best moveset".
 * Run: node generate-pokemon-pages.js
 * Output: docs/pokemon/{name}/index.html for all 1,025 Pokemon
 */

const fs = require('fs');
const path = require('path');

const POKEAPI = 'https://pokeapi.co/api/v2';
const OUT_DIR = path.join(__dirname, 'pokemon');
const TOTAL = 1025;
const BATCH_SIZE = 50;
const DELAY_MS = 500;

// Type effectiveness chart
const TYPE_CHART = {
  normal: { weak: ['fighting'], resist: [], immune: ['ghost'] },
  fire: { weak: ['water', 'ground', 'rock'], resist: ['fire', 'grass', 'ice', 'bug', 'steel', 'fairy'], immune: [] },
  water: { weak: ['electric', 'grass'], resist: ['fire', 'water', 'ice', 'steel'], immune: [] },
  electric: { weak: ['ground'], resist: ['electric', 'flying', 'steel'], immune: [] },
  grass: { weak: ['fire', 'ice', 'poison', 'flying', 'bug'], resist: ['water', 'electric', 'grass', 'ground'], immune: [] },
  ice: { weak: ['fire', 'fighting', 'rock', 'steel'], resist: ['ice'], immune: [] },
  fighting: { weak: ['flying', 'psychic', 'fairy'], resist: ['bug', 'rock', 'dark'], immune: [] },
  poison: { weak: ['ground', 'psychic'], resist: ['fighting', 'poison', 'bug', 'grass', 'fairy'], immune: [] },
  ground: { weak: ['water', 'grass', 'ice'], resist: ['poison', 'rock'], immune: ['electric'] },
  flying: { weak: ['electric', 'ice', 'rock'], resist: ['fighting', 'bug', 'grass'], immune: ['ground'] },
  psychic: { weak: ['bug', 'ghost', 'dark'], resist: ['fighting', 'psychic'], immune: [] },
  bug: { weak: ['fire', 'flying', 'rock'], resist: ['fighting', 'ground', 'grass'], immune: [] },
  rock: { weak: ['water', 'grass', 'fighting', 'ground', 'steel'], resist: ['normal', 'fire', 'poison', 'flying'], immune: [] },
  ghost: { weak: ['ghost', 'dark'], resist: ['poison', 'bug'], immune: ['normal', 'fighting'] },
  dragon: { weak: ['ice', 'dragon', 'fairy'], resist: ['fire', 'water', 'electric', 'grass'], immune: [] },
  dark: { weak: ['fighting', 'bug', 'fairy'], resist: ['ghost', 'dark'], immune: ['psychic'] },
  steel: { weak: ['fire', 'fighting', 'ground'], resist: ['normal', 'grass', 'ice', 'flying', 'psychic', 'bug', 'rock', 'dragon', 'steel', 'fairy'], immune: ['poison'] },
  fairy: { weak: ['poison', 'steel'], resist: ['fighting', 'bug', 'dark'], immune: ['dragon'] }
};

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function pad(n) { return String(n).padStart(3, '0'); }

function getWeaknesses(types) {
  const multipliers = {};
  for (const type of types) {
    const chart = TYPE_CHART[type];
    if (!chart) continue;
    for (const w of chart.weak) multipliers[w] = (multipliers[w] || 1) * 2;
    for (const r of chart.resist) multipliers[r] = (multipliers[r] || 1) * 0.5;
    for (const i of chart.immune) multipliers[i] = 0;
  }
  const weaknesses = [], resistances = [], immunities = [];
  for (const [type, mult] of Object.entries(multipliers)) {
    if (mult === 0) immunities.push(type);
    else if (mult >= 4) weaknesses.push({ type, mult: '4x' });
    else if (mult >= 2) weaknesses.push({ type, mult: '2x' });
    else if (mult <= 0.25) resistances.push({ type, mult: '0.25x' });
    else if (mult <= 0.5) resistances.push({ type, mult: '0.5x' });
  }
  return { weaknesses, resistances, immunities };
}

const TYPE_COLORS = {
  normal: '#A8A77A', fire: '#EE8130', water: '#6390F0', electric: '#F7D02C',
  grass: '#7AC74C', ice: '#96D9D6', fighting: '#C22E28', poison: '#A33EA1',
  ground: '#E2BF65', flying: '#A98FF3', psychic: '#F95587', bug: '#A6B91A',
  rock: '#B6A136', ghost: '#735797', dragon: '#6F35FC', dark: '#705746',
  steel: '#B7B7CE', fairy: '#D685AD'
};

function generatePage(pokemon) {
  const { id, name, types, stats, abilities, height, weight, moves } = pokemon;
  const displayName = capitalize(name);
  const typeNames = types.map(t => t.type.name);
  const { weaknesses, resistances, immunities } = getWeaknesses(typeNames);
  const primaryType = typeNames[0];
  const typeColor = TYPE_COLORS[primaryType] || '#059669';

  const statMap = {};
  stats.forEach(s => { statMap[s.stat.name] = s.base_stat; });
  const bst = stats.reduce((sum, s) => sum + s.base_stat, 0);

  const abilityNames = abilities.map(a => capitalize(a.ability.name.replace('-', ' '))).join(', ');
  const topMoves = moves.slice(0, 8).map(m => capitalize(m.move.name.replace('-', ' ')));

  const weakStr = weaknesses.map(w => `${capitalize(w.type)} (${w.mult})`).join(', ') || 'None';
  const resistStr = resistances.map(r => `${capitalize(r.type)} (${r.mult})`).join(', ') || 'None';
  const immuneStr = immunities.map(i => capitalize(i)).join(', ') || 'None';

  const typeBadges = typeNames.map(t =>
    `<span class="type-pill" style="background:${TYPE_COLORS[t]}">${t}</span>`
  ).join(' ');

  const statBars = [
    ['HP', statMap.hp],
    ['Attack', statMap.attack],
    ['Defense', statMap.defense],
    ['Sp. Atk', statMap['special-attack']],
    ['Sp. Def', statMap['special-defense']],
    ['Speed', statMap.speed]
  ].map(([label, val]) => `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
      <span style="width:80px;font-family:var(--mono);font-size:12px;color:var(--ink3);text-align:right;text-transform:uppercase;letter-spacing:0.04em;">${label}</span>
      <span style="width:36px;font-family:var(--display);font-size:16px;color:var(--ink);">${val}</span>
      <div style="flex:1;height:8px;background:var(--border);border-radius:4px;overflow:hidden;">
        <div style="width:${Math.min(val / 255 * 100, 100)}%;height:100%;background:${typeColor};border-radius:4px;"></div>
      </div>
    </div>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${displayName} — Stats, Weaknesses, Moves | Tree Co. Pokédex</title>
  <meta name="description" content="${displayName} (#${pad(id)}) — ${typeNames.map(capitalize).join('/')} type. Base stat total: ${bst}. Weak to ${weaknesses.slice(0,3).map(w => capitalize(w.type)).join(', ')}. Full stats, moves, abilities, and type matchups in Tree Co. for iOS.">
  <link rel="canonical" href="https://www.treeco.app/pokemon/${name}/">
  <meta property="og:title" content="${displayName} — Pokédex Entry | Tree Co.">
  <meta property="og:description" content="${typeNames.map(capitalize).join('/')} type. BST ${bst}. Full stats, weaknesses, and competitive data.">
  <meta property="og:image" content="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png">
  <meta property="og:url" content="https://www.treeco.app/pokemon/${name}/">
  <link rel="icon" href="../../icon-dark.png">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "What is ${displayName} weak against?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "${displayName} is a ${typeNames.map(capitalize).join('/')} type Pokémon. It is weak to ${weakStr}. It resists ${resistStr}.${immunities.length ? ' It is immune to ' + immuneStr + '.' : ''}"
        }
      },
      {
        "@type": "Question",
        "name": "What are ${displayName}'s base stats?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "${displayName} has a base stat total of ${bst}. HP: ${statMap.hp}, Attack: ${statMap.attack}, Defense: ${statMap.defense}, Sp. Atk: ${statMap['special-attack']}, Sp. Def: ${statMap['special-defense']}, Speed: ${statMap.speed}."
        }
      },
      {
        "@type": "Question",
        "name": "What are ${displayName}'s abilities?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "${displayName}'s abilities are: ${abilityNames}."
        }
      }
    ]
  }
  </script>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Tree Co.", "item": "https://www.treeco.app/" },
      { "@type": "ListItem", "position": 2, "name": "Pokédex", "item": "https://www.treeco.app/pokemon/" },
      { "@type": "ListItem", "position": 3, "name": "${displayName}", "item": "https://www.treeco.app/pokemon/${name}/" }
    ]
  }
  </script>
  <style>
    @font-face { font-family: 'MomoTrustDisplay'; src: url('../../fonts/MomoTrustDisplay-Regular.ttf') format('truetype'); font-weight: 400; font-display: swap; }
    @font-face { font-family: 'MomoTrustSans'; src: url('../../fonts/MomoTrustSans-Regular.ttf') format('truetype'); font-weight: 400; font-display: swap; }
    @font-face { font-family: 'MomoTrustSans'; src: url('../../fonts/MomoTrustSans-Medium.ttf') format('truetype'); font-weight: 500; font-display: swap; }
    @font-face { font-family: 'MomoTrustSans'; src: url('../../fonts/MomoTrustSans-SemiBold.ttf') format('truetype'); font-weight: 600; font-display: swap; }
    @font-face { font-family: 'GeistMono'; src: url('../../fonts/GeistMono-Regular.ttf') format('truetype'); font-weight: 400; font-display: swap; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    :root {
      --bg: #EFEEE9; --surface: #FAF9F5; --border: #E2E0DA;
      --ink: #1A1E1B; --ink2: #52594F; --ink3: #626962;
      --accent: #047857; --accent-hi: #059669; --accent-lo: rgba(4,120,87,0.09);
      --display: 'MomoTrustDisplay', Georgia, serif;
      --body: 'MomoTrustSans', -apple-system, sans-serif;
      --mono: 'GeistMono', 'SF Mono', monospace;
    }
    body { font-family: var(--body); background: var(--bg); color: var(--ink); -webkit-font-smoothing: antialiased; }
    .container { max-width: 800px; margin: 0 auto; padding: 24px; }
    nav {
      position: fixed; top: 12px; left: 50%; transform: translateX(-50%);
      z-index: 100; width: calc(100% - 32px); max-width: 800px; padding: 0 20px;
      background: color-mix(in srgb, var(--bg) 75%, transparent);
      backdrop-filter: blur(24px) saturate(1.4); -webkit-backdrop-filter: blur(24px) saturate(1.4);
      border: 1px solid color-mix(in srgb, var(--border) 40%, transparent);
      border-radius: 100px; box-shadow: 0 4px 24px rgba(0,0,0,0.06);
      display: flex; align-items: center; justify-content: space-between; height: 52px;
    }
    .nav-logo { font-family: var(--display); font-weight: 400; font-size: 18px; color: var(--ink); text-decoration: none; display: flex; align-items: center; gap: 8px; }
    .nav-logo img { width: 28px; height: 28px; border-radius: 6px; }
    .dl-btn {
      display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px;
      background: var(--ink); color: var(--bg); border-radius: 100px;
      font-family: var(--body); font-size: 13px; font-weight: 600;
      text-decoration: none; text-transform: uppercase; letter-spacing: 0.04em;
    }
    .dl-btn svg { width: 14px; height: 14px; }
    .dl-btn:hover { opacity: 0.85; }
    .hero { text-align: center; padding: 80px 0 40px; }
    .hero img { width: 220px; height: 220px; image-rendering: auto; filter: drop-shadow(0 8px 24px rgba(0,0,0,0.1)); }
    .dex-num { font-family: var(--mono); font-size: 14px; color: var(--ink3); margin-bottom: 8px; letter-spacing: 0.04em; }
    h1 { font-family: var(--display); font-size: 40px; font-weight: 400; letter-spacing: -0.03em; margin-bottom: 12px; }
    .types { display: flex; gap: 8px; justify-content: center; margin-bottom: 24px; }
    .section { background: var(--surface); border-radius: 16px; padding: 24px; margin-bottom: 16px; }
    .section h2 { font-family: var(--display); font-size: 20px; font-weight: 400; margin-bottom: 16px; color: var(--ink); letter-spacing: -0.02em; }
    .matchup-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
    .matchup-label { font-family: var(--mono); font-size: 11px; color: var(--ink3); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.06em; }
    .type-pill { padding: 4px 12px; border-radius: 100px; font-family: var(--body); font-size: 12px; font-weight: 600; color: #fff; text-transform: uppercase; }
    .moves-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
    .move { font-family: var(--body); font-size: 14px; color: var(--ink2); padding: 10px 14px; background: var(--bg); border-radius: 10px; }
    .cta { text-align: center; padding: 48px 24px; }
    .cta h2 { font-family: var(--display); font-size: 28px; font-weight: 400; letter-spacing: -0.03em; margin-bottom: 12px; }
    .cta p { font-size: 16px; color: var(--ink2); margin-bottom: 24px; }
    .cta-btn { display: inline-flex; align-items: center; gap: 8px; padding: 14px 28px; background: var(--accent); color: #fff; border: none; border-radius: 100px; font-family: var(--body); font-size: 16px; font-weight: 600; cursor: pointer; text-decoration: none; }
    .cta-btn:hover { opacity: 0.85; }
    .cta-btn svg { width: 20px; height: 20px; }
    .breadcrumb { font-family: var(--mono); font-size: 12px; color: var(--ink3); margin-bottom: 16px; letter-spacing: 0.02em; }
    .breadcrumb a { color: var(--accent); text-decoration: none; }
    .breadcrumb a:hover { text-decoration: underline; }
    .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; text-align: center; }
    .info-label { font-family: var(--mono); font-size: 11px; color: var(--ink3); margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.06em; }
    .info-value { font-family: var(--display); font-size: 20px; }
    footer {
      border-top: 1px solid color-mix(in srgb, var(--border) 40%, transparent);
      text-align: center; padding: 32px 24px; font-size: 12px; color: var(--ink3);
    }
    footer a { color: var(--accent); text-decoration: none; }
    footer a:hover { text-decoration: underline; }
    @media (max-width: 480px) {
      h1 { font-size: 32px; }
      .hero { padding: 72px 0 32px; }
      .hero img { width: 180px; height: 180px; }
      .moves-grid { grid-template-columns: 1fr; }
      .info-grid { grid-template-columns: 1fr; gap: 12px; }
      nav { width: calc(100% - 24px); padding: 0 14px; height: 48px; }
      .nav-logo { font-size: 16px; }
    }
  </style>
</head>
<body>
  <nav>
    <a href="../../" class="nav-logo"><img src="../../icon-dark.png" alt="Tree Co."> Tree Co.</a>
    <a href="../../" class="dl-btn">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
      Download App
    </a>
  </nav>
  <div class="container">
    <div class="breadcrumb">
      <a href="../../">Home</a> › <a href="../">Pokédex</a> › ${displayName}
    </div>
    <div class="hero">
      <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png" alt="${displayName} official artwork" loading="lazy">
      <div class="dex-num">#${pad(id)}</div>
      <h1>${displayName}</h1>
      <div class="types">${typeBadges}</div>
    </div>

    <div class="section">
      <div class="info-grid">
        <div class="info-item"><div class="info-label">Height</div><div class="info-value">${(height / 10).toFixed(1)}m</div></div>
        <div class="info-item"><div class="info-label">Weight</div><div class="info-value">${(weight / 10).toFixed(1)}kg</div></div>
        <div class="info-item"><div class="info-label">BST</div><div class="info-value">${bst}</div></div>
      </div>
    </div>

    <div class="section">
      <h2>Base Stats</h2>
      ${statBars}
    </div>

    <div class="section">
      <h2>Type Effectiveness</h2>
      <div class="matchup-label">Weak to</div>
      <div class="matchup-row">
        ${weaknesses.map(w => `<span class="type-pill" style="background:${TYPE_COLORS[w.type]}">${capitalize(w.type)} ${w.mult}</span>`).join('')}
      </div>
      <div class="matchup-label">Resists</div>
      <div class="matchup-row">
        ${resistances.map(r => `<span class="type-pill" style="background:${TYPE_COLORS[r.type]}">${capitalize(r.type)} ${r.mult}</span>`).join('')}
      </div>
      ${immunities.length ? `<div class="matchup-label">Immune to</div><div class="matchup-row">${immunities.map(i => `<span class="type-pill" style="background:${TYPE_COLORS[i]}">${capitalize(i)}</span>`).join('')}</div>` : ''}
    </div>

    <div class="section">
      <h2>Abilities</h2>
      <p style="font-size:15px;color:#52594F;line-height:1.6;">${abilityNames}</p>
    </div>

    ${topMoves.length ? `<div class="section">
      <h2>Notable Moves</h2>
      <div class="moves-grid">
        ${topMoves.map(m => `<div class="move">${m}</div>`).join('')}
      </div>
    </div>` : ''}

    <div class="cta">
      <h2>Get the full ${displayName} analysis</h2>
      <p>Competitive movesets, team suggestions, and AI-powered insights in Tree Co. for iOS.</p>
      <a href="../../" class="cta-btn">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
        Download Tree Co.
      </a>
    </div>
  </div>
  <footer>
    <p>&copy; 2026 Tree Co. · <a href="../../privacy.html">Privacy</a> · <a href="mailto:fahimullahusman@gmail.com">Support</a></p>
    <p style="margin-top:8px;">Pokémon and all related names are trademarks of Nintendo / Creatures Inc. / GAME FREAK inc.</p>
  </footer>
</body>
</html>`;
}

async function fetchPokemon(id) {
  const res = await fetch(`${POKEAPI}/pokemon/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch Pokemon ${id}: ${res.status}`);
  return res.json();
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log(`Generating pages for ${TOTAL} Pokémon...`);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Generate index page
  const indexPokemon = [];

  for (let batch = 0; batch < Math.ceil(TOTAL / BATCH_SIZE); batch++) {
    const start = batch * BATCH_SIZE + 1;
    const end = Math.min((batch + 1) * BATCH_SIZE, TOTAL);
    console.log(`Fetching batch ${batch + 1}: Pokemon ${start}-${end}...`);

    const promises = [];
    for (let id = start; id <= end; id++) {
      promises.push(fetchPokemon(id).catch(err => {
        console.error(`  Skipping #${id}: ${err.message}`);
        return null;
      }));
    }

    const results = await Promise.all(promises);

    for (const pokemon of results) {
      if (!pokemon) continue;
      const dir = path.join(OUT_DIR, pokemon.name);
      fs.mkdirSync(dir, { recursive: true });
      const html = generatePage(pokemon);
      fs.writeFileSync(path.join(dir, 'index.html'), html);
      indexPokemon.push({ id: pokemon.id, name: pokemon.name, types: pokemon.types.map(t => t.type.name) });
    }

    if (batch < Math.ceil(TOTAL / BATCH_SIZE) - 1) {
      await sleep(DELAY_MS);
    }
  }

  // Generate Pokedex index page
  console.log('Generating Pokédex index page...');
  const indexHtml = generateIndexPage(indexPokemon);
  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), indexHtml);

  // Update sitemap
  console.log('Updating sitemap...');
  const sitemapEntries = indexPokemon.map(p =>
    `  <url><loc>https://www.treeco.app/pokemon/${p.name}/</loc><changefreq>monthly</changefreq><priority>0.6</priority></url>`
  ).join('\n');
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.treeco.app/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>
  <url><loc>https://www.treeco.app/privacy.html</loc><changefreq>monthly</changefreq><priority>0.3</priority></url>
  <url><loc>https://www.treeco.app/pokemon/</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>
${sitemapEntries}
</urlset>`;
  fs.writeFileSync(path.join(__dirname, 'sitemap.xml'), sitemap);

  console.log(`Done! Generated ${indexPokemon.length} pages + index + sitemap.`);
}

function generateIndexPage(pokemon) {
  // Generation ranges
  const gens = [
    { label: 'All', range: [1, 1025] },
    { label: 'I', range: [1, 151] },
    { label: 'II', range: [152, 251] },
    { label: 'III', range: [252, 386] },
    { label: 'IV', range: [387, 493] },
    { label: 'V', range: [494, 649] },
    { label: 'VI', range: [650, 721] },
    { label: 'VII', range: [722, 809] },
    { label: 'VIII', range: [810, 905] },
    { label: 'IX', range: [906, 1025] }
  ];

  const items = pokemon.map(p =>
    `<a href="${p.name}/" class="poke-cell" data-id="${p.id}" data-name="${p.name}" data-types="${p.types.join(',')}" title="${capitalize(p.name)} #${pad(p.id)}">
      <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png" alt="${capitalize(p.name)}" width="48" height="48" loading="lazy">
      <span class="cell-num">${pad(p.id)}</span>
    </a>`
  ).join('\n');

  const genBtns = gens.map((g, i) =>
    `<button class="gen-btn${i === 0 ? ' active' : ''}" data-min="${g.range[0]}" data-max="${g.range[1]}">${g.label}</button>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Complete Pokédex — All 1,025 Pokémon | Tree Co.</title>
  <meta name="description" content="Browse all 1,025 Pokémon with full stats, type matchups, weaknesses, moves, and abilities. Free online Pokédex by Tree Co. for iOS.">
  <link rel="canonical" href="https://www.treeco.app/pokemon/">
  <link rel="icon" href="../icon-dark.png">
  <style>
    @font-face { font-family: 'MomoTrustDisplay'; src: url('../fonts/MomoTrustDisplay-Regular.ttf') format('truetype'); font-display: swap; }
    @font-face { font-family: 'MomoTrustSans'; src: url('../fonts/MomoTrustSans-Regular.ttf') format('truetype'); font-weight: 400; font-display: swap; }
    @font-face { font-family: 'MomoTrustSans'; src: url('../fonts/MomoTrustSans-Medium.ttf') format('truetype'); font-weight: 500; font-display: swap; }
    @font-face { font-family: 'GeistMono'; src: url('../fonts/GeistMono-Regular.ttf') format('truetype'); font-display: swap; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    :root {
      --bg: #EFEEE9; --surface: #FAF9F5; --border: #E2E0DA;
      --ink: #1A1E1B; --ink2: #52594F; --ink3: #626962;
      --accent: #047857; --accent-lo: rgba(4,120,87,0.09);
      --display: 'MomoTrustDisplay', Georgia, serif;
      --body: 'MomoTrustSans', -apple-system, sans-serif;
      --mono: 'GeistMono', 'SF Mono', monospace;
    }
    body { font-family: var(--body); background: var(--bg); color: var(--ink); -webkit-font-smoothing: antialiased; }
    .container { max-width: 1080px; margin: 0 auto; padding: 24px; }
    nav {
      position: fixed; top: 12px; left: 50%; transform: translateX(-50%);
      z-index: 100; width: calc(100% - 32px); max-width: 1080px; padding: 0 20px;
      background: color-mix(in srgb, var(--bg) 75%, transparent);
      backdrop-filter: blur(24px) saturate(1.4); -webkit-backdrop-filter: blur(24px) saturate(1.4);
      border: 1px solid color-mix(in srgb, var(--border) 40%, transparent);
      border-radius: 100px; box-shadow: 0 4px 24px rgba(0,0,0,0.06);
      display: flex; align-items: center; justify-content: space-between; height: 52px;
    }
    .nav-logo { font-family: var(--display); font-weight: 400; font-size: 18px; color: var(--ink); text-decoration: none; display: flex; align-items: center; gap: 8px; }
    .nav-logo img { width: 28px; height: 28px; border-radius: 6px; }
    .dl-btn {
      display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px;
      background: var(--ink); color: var(--bg); border-radius: 100px;
      font-family: var(--body); font-size: 13px; font-weight: 600;
      text-decoration: none; text-transform: uppercase; letter-spacing: 0.04em;
    }
    .dl-btn svg { width: 14px; height: 14px; }
    h1 { font-family: var(--display); font-size: 36px; font-weight: 400; letter-spacing: -0.03em; margin-bottom: 8px; }
    .subtitle { font-size: 16px; color: var(--ink2); margin-bottom: 24px; }
    .controls { display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; align-items: center; }
    .search-input {
      flex: 1; min-width: 200px; padding: 10px 16px; border-radius: 100px;
      border: 1px solid var(--border); background: var(--surface);
      font-family: var(--body); font-size: 14px; color: var(--ink);
      outline: none; transition: border-color 0.2s;
    }
    .search-input:focus { border-color: var(--accent); }
    .search-input::placeholder { color: var(--ink3); }
    .gen-bar { display: flex; gap: 4px; flex-wrap: wrap; }
    .gen-btn {
      font-family: var(--mono); font-size: 12px; padding: 6px 12px;
      border: 1px solid var(--border); border-radius: 100px;
      background: transparent; color: var(--ink3); cursor: pointer;
      transition: all 0.2s;
    }
    .gen-btn:hover { border-color: var(--accent); color: var(--accent); }
    .gen-btn.active { background: var(--accent); color: #fff; border-color: var(--accent); }
    .count { font-family: var(--mono); font-size: 12px; color: var(--ink3); margin-bottom: 16px; }
    .grid {
      display: grid; grid-template-columns: repeat(10, 1fr); gap: 4px;
    }
    .poke-cell {
      display: flex; flex-direction: column; align-items: center; gap: 2px;
      padding: 8px 4px; background: var(--surface); border-radius: 10px;
      text-decoration: none; color: var(--ink); transition: all 0.15s;
    }
    .poke-cell:hover { transform: scale(1.08); background: var(--accent-lo); z-index: 1; }
    .poke-cell img { width: 48px; height: 48px; image-rendering: pixelated; }
    .cell-num { font-family: var(--mono); font-size: 9px; color: var(--ink3); }
    .poke-cell.hidden { display: none; }
    footer {
      border-top: 1px solid color-mix(in srgb, var(--border) 40%, transparent);
      text-align: center; padding: 32px 24px; font-size: 12px; color: var(--ink3); margin-top: 48px;
    }
    footer a { color: var(--accent); text-decoration: none; }
    @media (max-width: 768px) { .grid { grid-template-columns: repeat(6, 1fr); } }
    @media (max-width: 480px) {
      .grid { grid-template-columns: repeat(5, 1fr); }
      nav { width: calc(100% - 24px); height: 48px; }
      h1 { font-size: 28px; }
      .controls { flex-direction: column; }
    }
  </style>
</head>
<body>
  <nav>
    <a href="../" class="nav-logo"><img src="../icon-dark.png" alt="Tree Co."> Tree Co.</a>
    <a href="../" class="dl-btn">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
      Download
    </a>
  </nav>
  <div class="container" style="padding-top:80px;">
    <h1>Complete Pokédex</h1>
    <p class="subtitle">All 1,025 Pokémon — tap any sprite for full stats, weaknesses, and moves.</p>
    <div class="controls">
      <input type="text" class="search-input" placeholder="Search Pokémon..." id="searchInput">
      <div class="gen-bar">${genBtns}</div>
    </div>
    <div class="count" id="countLabel">Showing 1,025 Pokémon</div>
    <div class="grid" id="pokeGrid">
      ${items}
    </div>
  </div>
  <footer>
    <p>&copy; 2026 Tree Co. · <a href="../privacy.html">Privacy</a> · <a href="mailto:fahimullahusman@gmail.com">Support</a></p>
    <p style="margin-top:8px;">Pokémon and all related names are trademarks of Nintendo / Creatures Inc. / GAME FREAK inc.</p>
  </footer>
  <script>
    (function() {
      var cells = document.querySelectorAll('.poke-cell');
      var searchInput = document.getElementById('searchInput');
      var countLabel = document.getElementById('countLabel');
      var genBtns = document.querySelectorAll('.gen-btn');
      var currentMin = 1, currentMax = 1025;

      function filter() {
        var query = searchInput.value.toLowerCase().trim();
        var visible = 0;
        cells.forEach(function(cell) {
          var id = parseInt(cell.dataset.id);
          var name = cell.dataset.name;
          var inGen = id >= currentMin && id <= currentMax;
          var matchesSearch = !query || name.indexOf(query) !== -1 || String(id).indexOf(query) !== -1;
          if (inGen && matchesSearch) { cell.classList.remove('hidden'); visible++; }
          else { cell.classList.add('hidden'); }
        });
        countLabel.textContent = 'Showing ' + visible.toLocaleString() + ' Pokémon';
      }

      searchInput.addEventListener('input', filter);

      genBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
          genBtns.forEach(function(b) { b.classList.remove('active'); });
          btn.classList.add('active');
          currentMin = parseInt(btn.dataset.min);
          currentMax = parseInt(btn.dataset.max);
          filter();
        });
      });
    })();
  </script>
</body>
</html>`;
}

main().catch(console.error);
