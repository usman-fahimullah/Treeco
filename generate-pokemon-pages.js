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
    `<span style="background:${TYPE_COLORS[t]};color:#fff;padding:4px 12px;border-radius:100px;font-size:13px;font-weight:600;text-transform:uppercase;">${t}</span>`
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
      <span style="width:80px;font-size:13px;color:#626962;text-align:right;">${label}</span>
      <span style="width:36px;font-size:14px;font-weight:600;color:#1A1E1B;">${val}</span>
      <div style="flex:1;height:8px;background:#E2E0DA;border-radius:4px;overflow:hidden;">
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
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #EFEEE9; color: #1A1E1B; }
    .container { max-width: 800px; margin: 0 auto; padding: 24px; }
    nav { padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; }
    .nav-logo { font-weight: 700; font-size: 18px; color: #1A1E1B; text-decoration: none; display: flex; align-items: center; gap: 8px; }
    .nav-logo img { width: 28px; height: 28px; border-radius: 6px; }
    .nav-back { font-size: 14px; color: #047857; text-decoration: none; font-weight: 500; }
    .nav-back:hover { text-decoration: underline; }
    .hero { text-align: center; padding: 40px 0; }
    .hero img { width: 200px; height: 200px; image-rendering: auto; }
    .dex-num { font-family: 'SF Mono', monospace; font-size: 14px; color: #626962; margin-bottom: 8px; }
    h1 { font-size: 36px; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 12px; }
    .types { display: flex; gap: 8px; justify-content: center; margin-bottom: 24px; }
    .section { background: #FAF9F5; border-radius: 16px; padding: 24px; margin-bottom: 16px; }
    .section h2 { font-size: 18px; font-weight: 600; margin-bottom: 16px; color: #1A1E1B; }
    .matchup-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
    .matchup-label { font-size: 13px; color: #626962; margin-bottom: 6px; font-weight: 500; }
    .type-pill { padding: 4px 10px; border-radius: 100px; font-size: 12px; font-weight: 600; color: #fff; text-transform: uppercase; }
    .moves-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
    .move { font-size: 14px; color: #52594F; padding: 8px 12px; background: #EFEEE9; border-radius: 8px; }
    .cta { text-align: center; padding: 48px 24px; }
    .cta h2 { font-size: 24px; margin-bottom: 12px; }
    .cta p { font-size: 16px; color: #52594F; margin-bottom: 24px; }
    .cta-btn { display: inline-flex; align-items: center; gap: 8px; padding: 14px 28px; background: #047857; color: #fff; border: none; border-radius: 100px; font-size: 16px; font-weight: 600; cursor: pointer; text-decoration: none; }
    .cta-btn:hover { opacity: 0.9; }
    .cta-btn svg { width: 20px; height: 20px; }
    .breadcrumb { font-size: 13px; color: #626962; margin-bottom: 16px; }
    .breadcrumb a { color: #047857; text-decoration: none; }
    .breadcrumb a:hover { text-decoration: underline; }
    .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; text-align: center; }
    .info-item { }
    .info-label { font-size: 12px; color: #626962; margin-bottom: 4px; }
    .info-value { font-size: 16px; font-weight: 600; }
    footer { text-align: center; padding: 32px 24px; font-size: 12px; color: #626962; }
    footer a { color: #047857; text-decoration: none; }
    @media (max-width: 480px) {
      h1 { font-size: 28px; }
      .hero img { width: 160px; height: 160px; }
      .moves-grid { grid-template-columns: 1fr; }
      .info-grid { grid-template-columns: 1fr; gap: 12px; }
    }
  </style>
</head>
<body>
  <nav>
    <a href="../../" class="nav-logo"><img src="../../icon-dark.png" alt="Tree Co."> Tree Co.</a>
    <a href="../../" class="nav-back">Download App</a>
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
  const rows = pokemon.map(p => {
    const typeBadges = p.types.map(t =>
      `<span style="background:${TYPE_COLORS[t]};color:#fff;padding:2px 8px;border-radius:100px;font-size:11px;font-weight:600;text-transform:uppercase;">${t}</span>`
    ).join(' ');
    return `<a href="${p.name}/" style="display:flex;align-items:center;gap:12px;padding:12px;background:#FAF9F5;border-radius:12px;text-decoration:none;color:#1A1E1B;transition:transform 0.2s;">
      <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png" alt="${capitalize(p.name)}" width="48" height="48" loading="lazy" style="image-rendering:pixelated;">
      <span style="font-weight:600;flex:1;">${capitalize(p.name)}</span>
      <span style="font-family:monospace;font-size:12px;color:#626962;">#${pad(p.id)}</span>
      <span style="display:flex;gap:4px;">${typeBadges}</span>
    </a>`;
  }).join('\n');

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
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #EFEEE9; color: #1A1E1B; }
    .container { max-width: 800px; margin: 0 auto; padding: 24px; }
    nav { padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; }
    .nav-logo { font-weight: 700; font-size: 18px; color: #1A1E1B; text-decoration: none; display: flex; align-items: center; gap: 8px; }
    .nav-logo img { width: 28px; height: 28px; border-radius: 6px; }
    h1 { font-size: 32px; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 8px; }
    .subtitle { font-size: 16px; color: #52594F; margin-bottom: 32px; }
    .grid { display: flex; flex-direction: column; gap: 8px; }
    .grid a:hover { transform: translateX(4px); }
    footer { text-align: center; padding: 32px 24px; font-size: 12px; color: #626962; }
    footer a { color: #047857; text-decoration: none; }
  </style>
</head>
<body>
  <nav>
    <a href="../" class="nav-logo"><img src="../icon-dark.png" alt="Tree Co."> Tree Co.</a>
  </nav>
  <div class="container">
    <h1>Complete Pokédex</h1>
    <p class="subtitle">All 1,025 Pokémon — stats, weaknesses, moves, and abilities.</p>
    <div class="grid">
      ${rows}
    </div>
  </div>
  <footer>
    <p>&copy; 2026 Tree Co. · <a href="../privacy.html">Privacy</a> · <a href="mailto:fahimullahusman@gmail.com">Support</a></p>
    <p style="margin-top:8px;">Pokémon and all related names are trademarks of Nintendo / Creatures Inc. / GAME FREAK inc.</p>
  </footer>
</body>
</html>`;
}

main().catch(console.error);
