// RogueGambit
// Copyright (c) 2026 Guillermo Eugui Sánchez. Licencia MIT.

const BOARD_SIZE = 5;
const BASE_MAX_HAND = 3;            
const MAX_ENERGY = 2;
const MAX_HP = 3;
const MAX_POTIONS = 3;
const SLIDE_MS = 270;
const FINAL_LEVEL = 4; 
const BOSS_HP = 10;                  
const BOSS_SUMMON_THRESHOLD = 3;     
const BOSS_CORRUPT_TILES = 2;        
const TEMAS = ['CAVE', 'ICE', 'MAGIC', 'NORMAL'];
let lastTheme = null;
function pickRandomTheme() {
  // Evita repetir el mismo tema dos niveles seguidos cuando sea posible
  const pool = TEMAS.filter(t => t !== lastTheme);
  const choice = pool[Math.floor(Math.random() * pool.length)];
  lastTheme = choice;
  return choice;
}

const wait = (ms) => new Promise(res => setTimeout(res, ms));

// Si el nivel cambia mientras un FX está en cola, lo tiramos en vez de
// pintarlo encima del tablero nuevo.
let fxGeneration = 0;
function deferFx(fn, ms) {
  const gen = fxGeneration;
  setTimeout(() => { if (gen === fxGeneration) fn(); }, ms);
}

/* ---------------------- RELIQUIAS ---------------------- */
const RELIQUIAS = {
  AGGRESSIVE_PAWNS: {
    name: 'Peones Agresivos', icon: '⚔️', color: '#ef4444',
    desc: 'Los Peones hacen +1 daño pero no dan escudo.'
  },
  PURIFIER: {
    name: 'Purificador', icon: '✨', color: '#22c55e',
    desc: 'En vez de daño, recibes +1 ❤️ en casillas corruptas.'
  },
  BIG_HANDS: {
    name: 'Manos Grandes', icon: '🖐', color: '#fbbf24',
    desc: 'Aumenta el tamaño máximo de la mano en +1.'
  },
  PROPHET_EYE: {
    name: 'Ojo del Profeta', icon: '👁', color: '#a78bfa',
    desc: 'Ves el daño que cada enemigo te hará este turno.'
  },
  BLOOD_FOR_BLOOD: {
    name: 'Sangre por Sangre', icon: '🩸', color: '#dc2626',
    desc: 'Tras recibir daño, tu próxima carta hace +1 daño.'
  }
};

/* ---------------------- HAZARDS / CASILLAS DE ENTORNO ---------------------- */
const PELIGROS = {
  ICE:      { icon: '❄', color: '#7dd3fc', label: 'Hielo' },
  SPIKES:   { icon: '✸', color: '#f87171', label: 'Pinchos' },
  TELEPORT: { icon: '⟳', color: '#a78bfa', label: 'Portal' },
  GOLD:     { icon: '✦', color: '#fcd34d', label: 'Oro' },
  GRAVE:    { icon: '☠', color: '#a3a3a3', label: 'Tumba' }
};
// Paleta de pares de portales: cada par usa un color distinto para que el
// jugador identifique las conexiones de un vistazo (sin texto/ID).
const PALETA_PORTALES = [
  { color: '#ef4444', name: 'Rojo' },     // red
  { color: '#22c55e', name: 'Verde' },    // green
  { color: '#3b82f6', name: 'Azul' },     // blue
  { color: '#fbbf24', name: 'Ámbar' },    // amber
  { color: '#ec4899', name: 'Rosa' },     // pink
  { color: '#06b6d4', name: 'Cian' }      // cyan
];

/* ---------------------- CARTAS ---------------------- */
const CARTAS = {
  PAWN: { name: 'Peón', plural: 'Peones', icon: '♟', desc: 'Mueve vert. · Captura diag. · +1 🛡️', shield: 1, damage: 1, cantrip: false, rarity: 'common', shopCost: 2, moveType: 'PAWN', attackType: 'NORMAL' },
  KNIGHT: { name: 'Caballo', plural: 'Caballos', icon: '♞', desc: 'Salto en L · ⚡ Cantrip', shield: 0, damage: 1, cantrip: true, rarity: 'rare', shopCost: 3, moveType: 'KNIGHT', attackType: 'NORMAL' },
  BISHOP: { name: 'Alfil', plural: 'Alfiles', icon: '♝', desc: 'Diagonales · ⚡ Cantrip', shield: 0, damage: 1, cantrip: true, rarity: 'rare', shopCost: 3, moveType: 'BISHOP', attackType: 'NORMAL' },
  ROOK: { name: 'Torre', plural: 'Torres', icon: '♜', desc: 'Filas/Col. · 2 daño', shield: 0, damage: 2, cantrip: false, rarity: 'epic', shopCost: 5, moveType: 'ROOK', attackType: 'NORMAL' },
  AXE: { name: 'Hacha', plural: 'Hachas', icon: '🪓', desc: 'Recta máx. 2 · Ataque en T · ☠ Veneno', shield: 0, damage: 1, cantrip: false, rarity: 'common', shopCost: 3, moveType: 'AXE', attackType: 'TEE' },
  BOMBER: { name: 'Bombardero', plural: 'Bombarderos', icon: '💣', desc: 'Anillo dist. 2 · Explosión 3×3', shield: 0, damage: 1, cantrip: false, rarity: 'rare', shopCost: 4, moveType: 'RING2', attackType: 'AOE' },
  BULL: { name: 'Toro', plural: 'Toros', icon: '🐂', desc: 'Embiste recto · Empuja al enemigo · 2 daño', shield: 0, damage: 2, cantrip: false, rarity: 'epic', shopCost: 5, moveType: 'BULL', attackType: 'CHARGE' },
  SPIDER: { name: 'Araña', plural: 'Arañas', icon: '🕷', desc: 'Salto en L · Enreda 1 turno · Explosión 3×3', shield: 0, damage: 1, cantrip: false, rarity: 'rare', shopCost: 4, moveType: 'KNIGHT', attackType: 'AOE' },
  SHIELDC: { name: 'Escudo', plural: 'Escudos', icon: '🛡', desc: 'Rey · +10 🛡️ · No ataca', shield: 10, damage: 0, cantrip: false, rarity: 'common', shopCost: 3, moveType: 'KING', attackType: 'NONE', noEnemyTarget: true },
  KING: { name: 'Rey', plural: 'Reyes', icon: '👑', desc: 'Rey · 3 daño plano', shield: 0, damage: 3, cantrip: false, rarity: 'epic', shopCost: 6, moveType: 'KING', attackType: 'NORMAL' },
  OWL: { name: 'Búho Celestial', plural: 'Búhos Celestiales', icon: '🦉', desc: 'Diagonal salto 3 · Permuta', shield: 0, damage: 1, cantrip: false, rarity: 'epic', shopCost: 5, moveType: 'OWL', attackType: 'SWAP' },
  DRAGON: { name: 'Dragón', plural: 'Dragones', icon: '🐉', desc: 'Caballo + Torre · Letal', shield: 0, damage: 1, cantrip: false, rarity: 'legendary', shopCost: 8, moveType: 'DRAGON', attackType: 'NORMAL' },
  QUEEN: { name: 'Reina', plural: 'Reinas', icon: '♛', desc: 'Reina · 2 daño pesado', shield: 0, damage: 2, cantrip: false, rarity: 'legendary', shopCost: 10, moveType: 'QUEEN', attackType: 'NORMAL' },
  WILDCARD: { name: 'Comodín', plural: 'Comodines', icon: '🃏', desc: 'Reina+Caballo · 3 daño · ⚡ · +1🛡 · Atraviesa armadura', shield: 1, damage: 3, cantrip: true, rarity: 'mythic', shopCost: 12, moveType: 'WILDCARD', attackType: 'PIERCE' },
  NIGHTMARE: { name: 'Pesadilla', plural: 'Pesadillas', icon: '💀', desc: 'Maldición · Cuesta 1⚡ · No hace nada', shield: 0, damage: 0, cantrip: false, rarity: 'curse', shopCost: 0, moveType: 'CURSE', attackType: 'NONE', curse: true }
};

/* ---------------------- ENEMIGOS ---------------------- */
const ENEMIGOS = {
  GOBLIN:   { icon: '👺', hp: 1, name: 'Goblin',              label: '→',   gold: 1, melee: true,  armor: 0, desc: 'Avanza 1 casilla directamente hacia ti.' },
  ARCHER:   { icon: '🏹', hp: 1, name: 'Arquero',             label: '✚',   gold: 2, melee: false, armor: 0, desc: 'Ataca a distancia en línea recta u ortogonal.' },
  ORC:      { icon: '👹', hp: 2, name: 'Orco',                label: 'AOE', gold: 3, melee: true,  armor: 0, desc: 'Golpea fuerte en un área de 3x3 a su alrededor.' },
  GOLEM:    { icon: '🗿', hp: 2, name: 'Gólem',               label: 'AOE', gold: 2, melee: true,  armor: 1, desc: 'Área de 3x3. Protegido por una gruesa armadura.' },
  BAT:      { icon: '🦇', hp: 1, name: 'Murciélago Vampiro',  label: 'X2',  gold: 2, melee: true,  armor: 0, desc: 'Salta 2 casillas en diagonal. Roba vida y aumenta su salud máxima.' },
  SHAMAN:   { icon: '🧙', hp: 2, name: 'Chamán Orco',         label: '✚H',  gold: 3, melee: false, armor: 0, desc: 'Cura y otorga armadura a sus aliados cercanos.' },
  ASSASSIN: { icon: '🥷', hp: 1, name: 'Asesino',             label: 'L',   gold: 4, melee: true,  armor: 1, desc: 'Salta en L. Su ataque letal ignora tu escudo.' },
  NECROMANCER:{ icon: '🧟', hp: 2, name: 'Nigromante',        label: '✚S',  gold: 4, melee: false, armor: 0, desc: 'Invoca Esqueletos y potencia su daño a distancia.' },
  SKELETON: { icon: '💀', hp: 1, name: 'Esqueleto',           label: '→',   gold: 1, melee: true,  armor: 0, desc: 'Avanza hacia ti implacablemente. Sin valor pero peligroso en grupo.' },
  BOSS:     { icon: '🔮', hp: BOSS_HP, name: 'Archimago Supremo', label: 'RAYO', gold: 0, melee: false, armor: 0, desc: 'Lanza devastadores rayos cósmicos, invoca esbirros y corrompe casillas.' },
  /* ===== ÉLITES POR BIOMA ===== */
  BERSERKER:      { icon: '🪓', hp: 4, name: 'Berserker',       label: 'AOE', gold: 5, melee: true,  armor: 0, desc: 'Élite de Cueva: doble HP. Al morir explota 1 daño AOE 3×3.', elite: true, biome: 'CAVE' },
  GLACIAL_WARLOCK:{ icon: '❄️', hp: 3, name: 'Brujo Glacial',   label: 'HIELO', gold: 5, melee: false, armor: 0, desc: 'Élite de Hielo: congela una de tus cartas cada turno (slot inactivo).', elite: true, biome: 'ICE' },
  WEAVER:         { icon: '🕸', hp: 3, name: 'Tejedor de Trampas', label: 'MUEVE', gold: 5, melee: false, armor: 0, desc: 'Élite de Magia: cada turno intercambia 2 hazards de lugar.', elite: true, biome: 'MAGIC' },
  VETERAN:        { icon: '🛡', hp: 3, name: 'Veterano',        label: '+🛡',  gold: 5, melee: true,  armor: 2, desc: 'Élite Normal: regenera 1 armadura cada turno y pega como un orco.', elite: true, biome: 'NORMAL' }
};

/* ---------------------- POCIONES ---------------------- */
const POCIONES = {
  LIFE:     { name: 'Poción de Vida',          icon: '❤️', color: '#ef4444', desc: 'Cura 1 ❤️ al instante' },
  SHIELD:   { name: 'Poción de Escudo',        icon: '🛡️', color: '#60a5fa', desc: '+4 🛡️ inmediatos' },
  ENERGY:   { name: 'Poción de Turno',         icon: '⚡', color: '#fbbf24', desc: '+1 ⚡ este turno' },
  TELEPORT: { name: 'Poción de Teletransporte',icon: '🔮', color: '#a78bfa', desc: 'Salta a cualquier casilla vacía' },
  THORNS:   { name: 'Poción de Espinas',       icon: '🌵', color: '#22c55e', desc: 'Devuelve 1 daño en CaC' },
  DISCARD:  { name: 'Poción de Ciclado',       icon: '🔄', color: '#f472b6', desc: 'Descarta la mano actual y roba la misma cantidad' }
};

/* =========================================================================
   TOOLTIPS — datos descriptivos + tooltip flotante global
   ========================================================================= */

/* Info de combate legible por enemigo: daño y efectos especiales. */
const COMBATE_ENEMIGO = {
  GOBLIN:      { dmg: 1, note: 'cuerpo a cuerpo' },
  ARCHER:      { dmg: 1, note: 'a distancia, en línea recta' },
  ORC:         { dmg: 1, note: 'en área 3×3' },
  GOLEM:       { dmg: 1, note: 'en área 3×3', effects: ['🛡 Armadura: absorbe daño antes que su vida.'] },
  BAT:         { dmg: 1, note: 'cuerpo a cuerpo', effects: ['🩸 Roba vida: se cura y sube su vida máxima al golpearte.'] },
  SHAMAN:      { dmg: 0, effects: ['✚ Cura +1❤️ y otorga +1🛡 a los aliados adyacentes.'] },
  ASSASSIN:    { dmg: 1, note: 'salto en L', effects: ['🗡 Su golpe IGNORA tu escudo.', '🛡 Armadura: absorbe daño antes que su vida.'] },
  NECROMANCER: { dmg: 0, effects: ['💀 Invoca Esqueletos a su alrededor.', '⚔ Potencia el daño de sus Esqueletos.', '🌑 A veces siembra una Pesadilla en tu mazo.'] },
  SKELETON:    { dmg: 1, note: 'cuerpo a cuerpo', effects: ['Su daño aumenta si lo potencia un Nigromante.'] },
  BOSS:        { dmg: 1, note: 'rayo cósmico en toda su fila y columna', effects: ['🔮 Corrompe casillas del tablero.', '💀 Invoca esbirros cuando quedan pocos.', '🌑 Puede sembrar Pesadillas en tu mazo.'] },
  BERSERKER:   { dmg: 1, note: 'en área 3×3', effects: ['💥 Al morir explota: 1 de daño en área 3×3.', '❤️ Tiene el doble de vida que un orco.'] },
  GLACIAL_WARLOCK: { dmg: 1, note: 'a distancia (hasta 2 casillas)', effects: ['❄ Congela una de tus cartas al inicio de tu turno.'] },
  WEAVER:      { dmg: 0, effects: ['🕸 Cada turno intercambia de lugar 2 casillas especiales.'] },
  VETERAN:     { dmg: 1, note: 'en área 3×3', effects: ['🛡 Regenera +1 de armadura cada turno.'] }
};

/* Explicaciones de las estadísticas del HUD (clave = data-stat). */
const AYUDAS_HUD = {
  level:     { title: '👑 Nivel', desc: 'Nivel actual de la mazmorra. Supera el nivel 4 para enfrentarte al Archimago Supremo.' },
  hp:        { title: '❤️ Vida', desc: 'Tus puntos de vida. Si llegan a 0, la partida termina.' },
  shield:    { title: '🛡️ Escudo', desc: 'Absorbe el daño antes que tu vida. Se reinicia al empezar tu turno (salvo el escudo permanente de la tienda).' },
  energy:    { title: '⚡ Energía', desc: 'Cada carta cuesta 1⚡. Se recarga por completo al empezar tu turno.' },
  gold:      { title: '💰 Oro', desc: 'Botín de los enemigos derrotados. Gástalo en el campamento entre niveles.' },
  combo:     { title: '🔥 Combo', desc: 'Cartas jugadas este turno. La 3ª carta y siguientes hacen +2 de daño y atraviesan la armadura.' },
  vengeance: { title: '🩸 Venganza', desc: 'Reliquia Sangre por Sangre: tu próxima carta hace +1 de daño por cada golpe que has recibido.' },
  thorns:    { title: '🌵 Espinas', desc: 'Mientras esté activo, devuelves 1 de daño a quien te golpee cuerpo a cuerpo.' }
};

/* Explicaciones de las casillas especiales. */
const AYUDAS_CASILLA = {
  ICE:       { title: '❄ Hielo', desc: 'Te deslizas en tu dirección de movimiento hasta chocar con un borde, un enemigo o un obstáculo.' },
  SPIKES:    { title: '✸ Pinchos', desc: 'Recibes 1 de daño al detenerte sobre esta casilla.' },
  TELEPORT:  { title: '⟳ Portal', desc: 'Te transporta al instante a su portal gemelo del mismo color.' },
  GOLD:      { title: '✦ Casilla de Oro', desc: 'Ganas +2 💰 al pisarla. Después desaparece.' },
  GRAVE:     { title: '☠ Tumba', desc: 'Recuperas +1 ❤️ al pisarla, si no estás al máximo. Después desaparece.' },
  CORRUPTED: { title: '🔥 Casilla Corrupta', desc: 'Si terminas tu turno aquí recibes 1 de daño. La reliquia Purificador la convierte en curación.' },
  VOID:      { title: '⌬ Abismo', desc: 'Casilla intransitable: ni tú ni los enemigos podéis ocuparla.' }
};

/* Tooltip flotante único, reutilizable y anclado al viewport.
   Se coloca debajo del ancla por defecto; si no cabe, se voltea arriba.
   Así nunca solapa el HUD (que está en el borde superior). */
const Tooltip = (() => {
  let el = null;
  function ensure() {
    if (el) return el;
    el = document.getElementById('game-tooltip');
    if (!el) {
      el = document.createElement('div');
      el.id = 'game-tooltip';
      el.setAttribute('role', 'tooltip');
      document.body.appendChild(el);
    }
    return el;
  }
  let anchorEl = null;
  function place(rect, mode) {
    const t = ensure();
    const margin = 8;
    const tw = t.offsetWidth, th = t.offsetHeight;
    // El tooltip nunca debe subir por encima del HUD: ese es el límite superior.
    const hud = document.getElementById('hud-bar');
    const minTop = hud ? hud.getBoundingClientRect().bottom + margin : margin;
    const maxTop = Math.max(minTop, window.innerHeight - th - margin);
    let left, top;
    if (mode === 'side') {
      // Modo lateral (enemigos): a la derecha del ancla para no tapar el tablero.
      if (rect.right + margin + tw <= window.innerWidth - margin) {
        left = rect.right + margin;          // cabe a la derecha
      } else if (rect.left - margin - tw >= margin) {
        left = rect.left - margin - tw;      // si no, a la izquierda
      } else {
        return place(rect, 'below');         // pantalla estrecha → debajo
      }
      top = rect.top;
    } else {
      left = rect.left + rect.width / 2 - tw / 2;
      top = rect.bottom + margin;            // por defecto: debajo del ancla
      if (top + th > window.innerHeight - margin) {
        const above = rect.top - th - margin;
        top = (above >= minTop) ? above : minTop;
      }
    }
    left = Math.max(margin, Math.min(left, window.innerWidth - tw - margin));
    top  = Math.max(minTop, Math.min(top, maxTop));
    t.style.left = Math.round(left) + 'px';
    t.style.top  = Math.round(top) + 'px';
  }
  return {
    show(html, rect, mode, anchor) {
      if (!rect) return;
      const t = ensure();
      t.innerHTML = html;
      t.classList.add('visible');
      anchorEl = anchor || null;
      place(rect, mode || 'below');
    },
    hide() { if (el) el.classList.remove('visible'); anchorEl = null; },
    /* True si el tooltip está visible y anclado a ese elemento concreto. */
    ownerIs(node) { return !!(el && el.classList.contains('visible') && anchorEl === node); }
  };
})();

/* Construye el contenido del tooltip de un enemigo: estado en vivo,
   daño que inflige y lista de efectos especiales. */
function enemyTooltipHTML(enemy) {
  const def = ENEMIGOS[enemy.type] || {};
  const combat = COMBATE_ENEMIGO[enemy.type] || {};
  const stats = [`<span class="tt-stat tt-hp">❤️ ${enemy.hp}/${enemy.maxHp}</span>`];
  if ((enemy.armor || 0) > 0)       stats.push(`<span class="tt-stat tt-armor">🛡 ${enemy.armor}</span>`);
  if ((enemy.poison || 0) > 0)      stats.push(`<span class="tt-stat tt-poison">☠ ${enemy.poison}</span>`);
  if ((enemy.frozenTurns || 0) > 0) stats.push(`<span class="tt-stat tt-frozen">❄ ${enemy.frozenTurns}</span>`);
  if ((enemy.buffed || 0) > 0)      stats.push(`<span class="tt-stat tt-buff">★ Reforzado</span>`);
  const dmgLine = combat.dmg
    ? `<div class="tt-dmg">⚔ Daño: <strong>${combat.dmg}</strong>${combat.note ? ' ' + combat.note : ''}</div>`
    : `<div class="tt-dmg tt-nodmg">No inflige daño directo</div>`;
  const effects = (combat.effects || []).map(e => `<li>${e}</li>`).join('');
  let threat = '';
  if (hasRelic('PROPHET_EYE')) {
    const p = preverGolpeEnemigo(enemy);
    if (p.dmg > 0) {
      threat = `<div class="tt-threat">👁 Te golpeará con <strong>${p.dmg}</strong> este turno${p.bypass ? ' (ignora escudo)' : ''}.</div>`;
    }
  }
  return `
    <div class="tt-title">${def.icon || ''} ${def.name || ''}${def.elite ? ' <span class="tt-elite">ÉLITE</span>' : ''}</div>
    <div class="tt-stats">${stats.join('')}</div>
    ${dmgLine}
    <div class="tt-desc">${def.desc || ''}</div>
    ${effects ? `<ul class="tt-effects">${effects}</ul>` : ''}
    ${threat}
  `;
}

function showEnemyTooltip(enemy) {
  const node = pieceNodes.get('e' + enemy.id);
  if (!node) { Tooltip.hide(); return; }
  // Se ancla al costado del tablero (modo 'side') para no tapar las casillas
  // de movimiento resaltadas del enemigo.
  const anchorRect = (boardWrap || node).getBoundingClientRect();
  Tooltip.show(enemyTooltipHTML(enemy), anchorRect, 'side', node);
}

/* Muestra el tooltip de una casilla especial (hazard / corrupción / abismo). */
function showTileTooltip(x, y) {
  let key = null;
  if (isVoid(x, y)) {
    key = 'VOID';
  } else {
    const h = hazardAt(x, y);
    if (h) key = h.type;
    else if (isCorrupted(x, y)) key = 'CORRUPTED';
  }
  const info = key ? AYUDAS_CASILLA[key] : null;
  if (!info) { Tooltip.hide(); return; }
  const cell = cellAt(x, y);
  if (!cell) { Tooltip.hide(); return; }
  let extra = '';
  if (key === 'TELEPORT') {
    const h = hazardAt(x, y);
    if (h && h.colorName) extra = `<div class="tt-sub">Portal ${h.colorName}</div>`;
  }
  Tooltip.show(
    `<div class="tt-title">${info.title}</div><div class="tt-desc">${info.desc}</div>${extra}`,
    cell.getBoundingClientRect(), 'below', cell
  );
}

function showHudTooltip(chip) {
  let info;
  if (chip.classList.contains('mute-btn')) {
    info = { title: '🔊 Sonido', desc: 'Activa o silencia los efectos de sonido del juego. Atajo: tecla M.' };
  } else {
    info = AYUDAS_HUD[chip.dataset.stat];
  }
  if (!info) { Tooltip.hide(); return; }
  Tooltip.show(
    `<div class="tt-title">${info.title}</div><div class="tt-desc">${info.desc}</div>`,
    chip.getBoundingClientRect(), 'below', chip
  );
}

/* Tooltip de una poción (o ranura vacía). */
function showPotionTooltip(slot) {
  const idx = parseInt(slot.dataset.slot, 10);
  let html;
  if (idx < partida.potions.length) {
    const def = POCIONES[partida.potions[idx]];
    html = `<div class="tt-title" style="color:${def.color}">${def.icon} ${def.name}</div>`
         + `<div class="tt-desc">${def.desc}</div>`;
  } else {
    html = `<div class="tt-title">🧪 Ranura de poción</div>`
         + `<div class="tt-desc">Vacía. Consigue pociones en la tienda o en eventos.</div>`;
  }
  Tooltip.show(html, slot.getBoundingClientRect(), 'below', slot);
}

/* ---------------------- ESTADO ---------------------- */
const partida = {
  hero: { x: 2, y: 2, hp: MAX_HP, maxHp: MAX_HP, shield: 0, thorns: false },
  enemies: [],
  deck: [],
  hand: [],          
  discardPile: [],
  deckExtras: [],
  energy: MAX_ENERGY,
  maxEnergy: MAX_ENERGY,
  currentLevel: 1,
  selectedCardIndex: null,
  selectedPotionSlot: null,
  hoveredCardIdx: null,
  validTargets: [],
  previewTargets: [],
  phase: 'PLAYER_TURN',
  nextEnemyId: 1,
  inputLocked: false,
  gold: 0,
  hoveredEnemyId: null,
  potions: [],
  corruptedTiles: [],
  shopOffers: null,
  relics: [],
  hazards: [],
  voids: [],
  // === Mecánicas EVO ===
  chainCount: 0,              // cartas jugadas este turno (combo)
  cardsPlayedThisTurn: 0,     // total acumulado del turno actual (auxiliar para HUD)
  vengeance: 0,               // Sangre por Sangre: stack de +1 dmg pendiente
  freeCantripUsedThisTurn: false, // bioma Magia: 1 cantrip universal/turno
  frozenSlot: null,           // Brujo Glacial congela un slot
  undoSnapshot: null,         // estado para deshacer
  undoUsedThisLevel: false,
  heroClass: 'BARBARIAN',     // o 'WITCH'
  nextLevelMode: 'normal',    // o 'elite'
  audioMuted: false,
  currentBiome: 'NORMAL'      // fuente de verdad del bioma (no derivar del DOM)
};

// Modo de juego: ascensión persistente en localStorage
function getAscension() {
  const v = parseInt(localStorage.getItem('roguegambit_ascension') || '0', 10);
  return Number.isFinite(v) ? Math.max(0, Math.min(v, 4)) : 0;
}
function setAscension(v) {
  localStorage.setItem('roguegambit_ascension', String(Math.max(0, Math.min(v, 4))));
}
const MODOS_ASCENSION = [
  { name: 'Mortal',   desc: 'Sin modificadores.' },
  { name: 'A1',       desc: 'Enemigos +1 HP a partir del nivel 2.' },
  { name: 'A2',       desc: 'Drops de oro -1 (mín 1).' },
  { name: 'A3',       desc: 'Empiezas con una Pesadilla en el mazo.' },
  { name: 'A4',       desc: 'El Archimago Supremo tiene +3 HP.' }
];

/* ===== HEROES ===== */
const CLASES_HEROE = {
  BARBARIAN: {
    name: 'Bárbaro',
    icon: '⚔️',
    desc: 'Equilibrado. 3 ❤️ máx, 2 ⚡, mazo balanceado.',
    maxHp: 3,
    maxEnergy: 2,
    deck: ['PAWN','PAWN','PAWN','PAWN','KNIGHT','KNIGHT','KNIGHT','BISHOP','BISHOP','ROOK','ROOK']
  },
  WITCH: {
    name: 'Bruja',
    icon: '🧙‍♀️',
    desc: 'Frágil pero veloz. 2 ❤️ máx, 3 ⚡, mazo de magia.',
    maxHp: 2,
    maxEnergy: 3,
    deck: ['BISHOP','BISHOP','BISHOP','KNIGHT','KNIGHT','PAWN','PAWN','ROOK','OWL','BOMBER','BISHOP']
  }
};

/* ===== EVENTOS NARRATIVOS ===== */
const EVENTOS = [
  {
    id: 'fountain',
    icon: '⛲',
    title: 'La Fuente Eterna',
    text: 'Una fuente cristalina canta tu nombre. Beber sana tu cuerpo… pero el agua exige un tributo en oro.',
    options: [
      { label: 'Beber: +2 ❤️ y −1 💰', cond: () => partida.gold >= 1 && partida.hero.hp < partida.hero.maxHp,
        exec: () => {
          partida.hero.hp = Math.min(partida.hero.maxHp, partida.hero.hp + 2);
          partida.gold = Math.max(0, partida.gold - 1);
        } },
      { label: 'Pasar de largo', cond: () => true, exec: () => {} }
    ]
  },
  {
    id: 'altar',
    icon: '🛐',
    title: 'Altar Sangriento',
    text: 'Un altar oscuro pide tributo. Devora una de tus cartas más comunes y deja oro a cambio.',
    options: [
      { label: 'Ofrendar 1 Peón: +2 💰', cond: () => deckHasCard('PAWN'),
        exec: () => { removeOneCardFromDeck('PAWN'); partida.gold += 2; } },
      { label: 'Ofrendar 1 Caballo: +3 💰', cond: () => deckHasCard('KNIGHT'),
        exec: () => { removeOneCardFromDeck('KNIGHT'); partida.gold += 3; } },
      { label: 'No ofrendar', cond: () => true, exec: () => {} }
    ]
  },
  {
    id: 'caravan',
    icon: '🐫',
    title: 'Caravana del Mercader',
    text: 'Una caravana itinerante ofrece refuerzos por oro.',
    options: [
      { label: 'Comprar poción al azar: 3 💰', cond: () => partida.gold >= 3 && partida.potions.length < MAX_POTIONS,
        exec: () => {
          partida.gold -= 3;
          const types = Object.keys(POCIONES);
          partida.potions.push(types[Math.floor(Math.random() * types.length)]);
        } },
      { label: 'Comprar carta rara: 5 💰', cond: () => partida.gold >= 5,
        exec: () => {
          partida.gold -= 5;
          const pool = ['KNIGHT','BISHOP','BOMBER','AXE','SPIDER'];
          partida.deckExtras.push(pool[Math.floor(Math.random() * pool.length)]);
        } },
      { label: 'Despedirse', cond: () => true, exec: () => {} }
    ]
  }
];

function deckHasCard(key) {
  return partida.deckExtras.includes(key) || partida.deck.includes(key) || partida.discardPile.includes(key) || partida.hand.includes(key);
}
function removeOneCardFromDeck(key) {
  // Prioridad: deckExtras → deck → discardPile
  let i = partida.deckExtras.indexOf(key);
  if (i !== -1) { partida.deckExtras.splice(i, 1); return; }
  i = partida.deck.indexOf(key);
  if (i !== -1) { partida.deck.splice(i, 1); return; }
  i = partida.discardPile.indexOf(key);
  if (i !== -1) { partida.discardPile.splice(i, 1); return; }
}

function getMaxHand() {
  const bigHands = partida.relics.filter(r => r === 'BIG_HANDS').length;
  return BASE_MAX_HAND + bigHands;
}

/* ===== SISTEMA DE SONIDO (Web Audio API, sintetizado puro) =====
   Inicializa el AudioContext de forma diferida (en el primer click del usuario)
   para cumplir las políticas de autoplay del navegador. */
const SFX = (() => {
  let ctx = null;
  function ensure() {
    if (partida.audioMuted) return null;
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { return null; }
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(freq, duration = 0.12, type = 'sine', volume = 0.12, attack = 0.005) {
    const c = ensure();
    if (!c) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(gain).connect(c.destination);
    const now = c.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }
  function noise(duration = 0.2, volume = 0.08, hp = 1200) {
    const c = ensure();
    if (!c) return;
    const buf = c.createBuffer(1, c.sampleRate * duration, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = c.createBufferSource();
    src.buffer = buf;
    const filter = c.createBiquadFilter();
    filter.type = 'highpass'; filter.frequency.value = hp;
    const gain = c.createGain();
    gain.gain.value = volume;
    src.connect(filter).connect(gain).connect(c.destination);
    src.start();
  }
  return {
    click:  () => tone(660, 0.05, 'square', 0.06),
    select: () => { tone(880, 0.07, 'triangle', 0.09); setTimeout(() => tone(1320, 0.06, 'triangle', 0.06), 40); },
    draw:   () => tone(523, 0.08, 'sine', 0.08),
    slash:  () => { tone(880, 0.08, 'sawtooth', 0.14); setTimeout(() => noise(0.12, 0.06, 2000), 30); },
    shieldHit: () => tone(310, 0.18, 'sine', 0.16, 0.003),
    gold:   () => { tone(1320, 0.07, 'triangle', 0.10); setTimeout(() => tone(1760, 0.09, 'triangle', 0.08), 70); },
    hurt:   () => { tone(180, 0.18, 'sawtooth', 0.18); noise(0.15, 0.05, 800); },
    death:  () => { tone(220, 0.35, 'sawtooth', 0.18); setTimeout(() => tone(110, 0.4, 'sine', 0.14), 120); },
    teleport: () => { tone(440, 0.06, 'sine', 0.10); setTimeout(() => tone(880, 0.08, 'sine', 0.10), 60); setTimeout(() => tone(1320, 0.10, 'sine', 0.08), 120); },
    chain:  () => { tone(660, 0.07, 'square', 0.12); setTimeout(() => tone(990, 0.07, 'square', 0.12), 60); setTimeout(() => tone(1320, 0.14, 'triangle', 0.14), 120); },
    victory: () => { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle', 0.16), i * 130)); },
    gameOver: () => { [330, 277, 220, 165].forEach((f, i) => setTimeout(() => tone(f, 0.32, 'sawtooth', 0.16), i * 180)); },
    setMuted(m) { partida.audioMuted = !!m; if (m && ctx) { try { ctx.close(); } catch(e){} ctx = null; } }
  };
})();

function setupHandSlots() {
  const size = getMaxHand();
  while (partida.hand.length < size) partida.hand.push(null);
  while (partida.hand.length > size) {
    const removed = partida.hand.pop();
    if (removed != null) partida.discardPile.push(removed);
  }
  while (prevHandSnapshot.length < size) prevHandSnapshot.push(null);
  while (prevHandSnapshot.length > size) prevHandSnapshot.pop();
}

const hasRelic = (key) => partida.relics.includes(key);

const pieceNodes = new Map();
let prevHandSnapshot = [];
let _handSig = '';                  // si no cambia, no reconstruimos la mano
let handDelegationAttached = false;

/* ---------------------- DOM ---------------------- */
const boardHost      = document.getElementById('board-host');
const boardWrap      = document.getElementById('board-wrap');
const boardEl        = document.getElementById('board');
const pieceLayer     = document.getElementById('piece-layer');
const fxLayer        = document.getElementById('fx-layer');
const handEl         = document.getElementById('hand');
const hpEl           = document.getElementById('hp');
const shieldEl       = document.getElementById('shield');
const energyEl       = document.getElementById('energy');
const levelEl        = document.getElementById('level');
const goldEl         = document.getElementById('gold');
const endTurnBtn     = document.getElementById('end-turn');
const messageEl      = document.getElementById('message');
const overlay        = document.getElementById('overlay');
const overlayTitle   = document.getElementById('overlay-title');
const overlayText    = document.getElementById('overlay-text');
const overlayBtn     = document.getElementById('overlay-btn');
const deckCountEl    = document.getElementById('deck-count');
const discardCountEl = document.getElementById('discard-count');
const deckPileBtn    = document.getElementById('deck-pile');
const discardPileBtn = document.getElementById('discard-pile');
const pileModal      = document.getElementById('pile-modal');
const pileModalTitle = document.getElementById('pile-modal-title');
const pileModalContent = document.getElementById('pile-modal-content');
const pileModalClose = document.getElementById('pile-modal-close');
const mapNodes       = Array.from(document.querySelectorAll('.map-node'));
const mapLinks       = Array.from(document.querySelectorAll('.map-link'));
const potionSlots    = Array.from(document.querySelectorAll('.potion-slot'));
const thornsIndicator = document.getElementById('thorns-indicator');
const relicsBarEl    = document.getElementById('relics-bar'); 

/* ---------------------- UTILS ---------------------- */
const inBounds = (x, y) => x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE;
const isHeroAt = (x, y) => partida.hero.x === x && partida.hero.y === y;
const enemyAt  = (x, y) => partida.enemies.find(e => e.x === x && e.y === y);
const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const chebyshev = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Recompensa de oro unificada al morir un enemigo (aplica Ascensión 2 globalmente).
function processEnemyDeathRewards(enemy) {
  const baseDrop = ENEMIGOS[enemy.type].gold || 0;
  if (baseDrop <= 0) return;
  const drop = Math.max(1, baseDrop - (getAscension() >= 2 ? 1 : 0));
  partida.gold += drop;
  flashChip('gold');
  const ex = enemy.x, ey = enemy.y;
  deferFx(() => floatText(ex, ey, `+${drop} 💰`, '#fcd34d'), 220);
}
function isVoid(x, y) {
  if (partida.currentLevel !== FINAL_LEVEL) return false;
  return partida.voids.some(v => v.x === x && v.y === y);
}
function generateBossVoids(count = 4) {
  // Abismos en cualquier casilla, pero sin pisar al héroe, sin pegar dos
  // abismos juntos y dejándole al menos 2 vecinos libres. Si no sale en 30
  // intentos, tiramos del reparto seguro de abajo.
  const cx = partida.hero.x, cy = partida.hero.y;
  const adjacent = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) === 1;
  for (let attempt = 0; attempt < 30; attempt++) {
    const pool = [];
    for (let x = 0; x < BOARD_SIZE; x++) {
      for (let y = 0; y < BOARD_SIZE; y++) {
        if (x === cx && y === cy) continue;
        pool.push({ x, y });
      }
    }
    shuffle(pool);
    const picked = [];
    for (const c of pool) {
      if (picked.length >= count) break;
      if (picked.some(v => adjacent(v, c))) continue;
      picked.push(c);
    }
    if (picked.length < count) continue;
    // Vecinos king libres del héroe
    let freeNeighbors = 0;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || nx >= BOARD_SIZE || ny < 0 || ny >= BOARD_SIZE) continue;
        if (!picked.some(v => v.x === nx && v.y === ny)) freeNeighbors++;
      }
    }
    if (freeNeighbors >= 2) return picked;
  }
  // Fallback: 4 esquinas (siempre válido)
  return [
    { x: 0, y: 0 }, { x: BOARD_SIZE - 1, y: 0 },
    { x: 0, y: BOARD_SIZE - 1 }, { x: BOARD_SIZE - 1, y: BOARD_SIZE - 1 }
  ].filter(p => !(p.x === cx && p.y === cy)).slice(0, count);
}
function isPassable(x, y) { return inBounds(x, y) && !isVoid(x, y); }
function isCorrupted(x, y) { return partida.corruptedTiles.some(c => c.x === x && c.y === y); }

function hazardAt(x, y) { return partida.hazards.find(h => h.x === x && h.y === y) || null; }
function isHazard(x, y, type) { return !!(hazardAt(x, y) && hazardAt(x,y).type === type); }
function teleportPartner(h) {
  if (!h || h.type !== 'TELEPORT' || h.pairId == null) return null;
  return partida.hazards.find(o => o !== h && o.type === 'TELEPORT' && o.pairId === h.pairId) || null;
}

function sizeBoard() {
  if (!boardHost || !boardWrap) return;
  const rect = boardHost.getBoundingClientRect();
  const size = Math.max(80, Math.floor(Math.min(rect.width, rect.height)));
  boardWrap.style.width = size + 'px';
  boardWrap.style.height = size + 'px';
}

/* ---------------------- MAZO ---------------------- */
function buildDeck() {
  const cls = CLASES_HEROE[partida.heroClass] || CLASES_HEROE.BARBARIAN;
  return shuffle([...cls.deck, ...partida.deckExtras]);
}

function drawOneIntoSlot(slot) {
  if (partida.deck.length === 0 && partida.discardPile.length > 0) {
    triggerReshuffleFx();
    partida.deck = shuffle(partida.discardPile);
    partida.discardPile = [];
  }
  if (partida.deck.length > 0) {
    partida.hand[slot] = partida.deck.pop();
  }
}

function drawHand() {
  const max = getMaxHand();
  for (let i = 0; i < max; i++) {
    if (partida.hand[i] == null) drawOneIntoSlot(i);
  }
}

/* ---------------------- MOVIMIENTOS ---------------------- */
function getValidMoves(cardType, fromX, fromY) {
  const def = CARTAS[cardType];
  if (!def) return [];
  const moveType = def.moveType || cardType;
  const moves = [];
  const push = (x, y) => {
    if (!isPassable(x, y)) return;
    if (isHeroAt(x, y)) return;
    moves.push({ x, y });
  };
  switch (moveType) {
    case 'PAWN':
      // Mueve adelante/atrás SOLO si la casilla está libre
      for (const [dx,dy] of [[0,-1],[0,1]]) {
        const x = fromX+dx, y = fromY+dy;
        if (!isPassable(x, y) || isHeroAt(x, y) || enemyAt(x, y)) continue;
        moves.push({ x, y });
      }
      // Ataca en diagonal SOLO si hay enemigo
      for (const [dx,dy] of [[-1,-1],[1,-1],[-1,1],[1,1]]) {
        const x = fromX+dx, y = fromY+dy;
        if (!isPassable(x, y) || isHeroAt(x, y)) continue;
        if (!enemyAt(x, y)) continue;
        moves.push({ x, y });
      }
      break;
    case 'KNIGHT':
      for (const [dx,dy] of [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]]) push(fromX+dx, fromY+dy);
      break;
    case 'RING2':
      // Anillo completo a distancia Chebyshev exacta 2: salta las 8 casillas adyacentes.
      for (let dx=-2; dx<=2; dx++)
        for (let dy=-2; dy<=2; dy++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== 2) continue;
          push(fromX+dx, fromY+dy);
        }
      break;
    case 'BULL':
      // Embestida: línea recta ortogonal hasta el primer enemigo en cada dirección.
      for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        let x = fromX+dx, y = fromY+dy;
        while (inBounds(x, y) && !isVoid(x, y)) {
          if (isHeroAt(x, y)) break;
          if (enemyAt(x, y)) { moves.push({ x, y }); break; }
          x += dx; y += dy;
        }
      }
      break;
    case 'BISHOP':
      for (const [dx,dy] of [[1,1],[-1,1],[1,-1],[-1,-1]]) traceLine(fromX, fromY, dx, dy, moves);
      break;
    case 'ROOK':
      for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) traceLine(fromX, fromY, dx, dy, moves);
      break;
    case 'AXE':
      for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        for (let step = 1; step <= 2; step++) {
          const x = fromX + dx*step, y = fromY + dy*step;
          if (!isPassable(x, y)) break;
          if (isHeroAt(x, y)) break;
          moves.push({ x, y });
          if (enemyAt(x, y)) break;
        }
      }
      break;
    case 'KING':
      for (let dx=-1; dx<=1; dx++)
        for (let dy=-1; dy<=1; dy++) {
          if (dx===0 && dy===0) continue;
          push(fromX+dx, fromY+dy);
        }
      break;
    case 'OWL':
      for (const [dx,dy] of [[1,1],[-1,1],[1,-1],[-1,-1]]) {
        for (let step = 1; step <= 3; step++) {
          const x = fromX + dx*step, y = fromY + dy*step;
          if (!inBounds(x, y)) break;          
          if (!isPassable(x, y)) continue;     
          if (isHeroAt(x, y)) continue;        
          moves.push({ x, y });
        }
      }
      break;
    case 'DRAGON':
      for (const [dx,dy] of [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]]) push(fromX+dx, fromY+dy);
      for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) traceLine(fromX, fromY, dx, dy, moves);
      break;
    case 'QUEEN':
      for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) traceLine(fromX, fromY, dx, dy, moves);
      for (const [dx,dy] of [[1,1],[-1,1],[1,-1],[-1,-1]]) traceLine(fromX, fromY, dx, dy, moves);
      break;
    case 'WILDCARD':
      for (const [dx,dy] of [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]]) push(fromX+dx, fromY+dy);
      for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) traceLine(fromX, fromY, dx, dy, moves);
      for (const [dx,dy] of [[1,1],[-1,1],[1,-1],[-1,-1]]) traceLine(fromX, fromY, dx, dy, moves);
      break;
  }
  const seen = new Set();
  let unique = moves.filter(m => {
    // clave numérica en vez de string
    const k = m.y * BOARD_SIZE + m.x;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (def.noEnemyTarget) unique = unique.filter(m => !enemyAt(m.x, m.y));
  return unique;
}

function traceLine(fromX, fromY, dx, dy, out) {
  let x = fromX + dx, y = fromY + dy;
  while (inBounds(x, y)) {
    if (isVoid(x, y)) break;
    if (isHeroAt(x, y)) break;
    out.push({ x, y });
    if (enemyAt(x, y)) break;
    x += dx; y += dy;
  }
}

/* ---------------------- IA ENEMIGOS ---------------------- */
// Goblin, murciélago y asesino se mueven igual: de entre unos saltos fijos,
// el que más les acerca al héroe sin chocar. Solo cambian los saltos.
function mejorSaltoHaciaHeroe(enemy, saltos) {
  let best = null, bestDist = Infinity;
  for (const [dx, dy] of saltos) {
    const x = enemy.x + dx, y = enemy.y + dy;
    if (!isPassable(x, y)) continue;
    if (partida.enemies.some(e => e !== enemy && e.x === x && e.y === y)) continue;
    const d = manhattan({ x, y }, partida.hero);
    if (d < bestDist) { bestDist = d; best = { x, y }; }
  }
  return best;
}

const SALTOS_GOBLIN = [[1,0],[-1,0],[0,1],[0,-1]];
const SALTOS_MURCIELAGO = [[2,2],[-2,2],[2,-2],[-2,-2]];
const SALTOS_CABALLO = [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]];

const preverGoblin     = (enemy) => mejorSaltoHaciaHeroe(enemy, SALTOS_GOBLIN);
const preverMurcielago = (enemy) => mejorSaltoHaciaHeroe(enemy, SALTOS_MURCIELAGO);
const preverAsesino    = (enemy) => mejorSaltoHaciaHeroe(enemy, SALTOS_CABALLO);

function preverPasoRey(enemy, preferredDist = 1) {
  const cands = [];
  for (let dx=-1; dx<=1; dx++)
    for (let dy=-1; dy<=1; dy++) {
      if (dx===0 && dy===0) continue;
      cands.push({ x: enemy.x + dx, y: enemy.y + dy });
    }
  let best = null, bestScore = -Infinity;
  for (const c of cands) {
    if (!isPassable(c.x, c.y)) continue;
    const blocker = partida.enemies.find(e => e !== enemy && e.x === c.x && e.y === c.y);
    if (blocker) continue;
    const d = chebyshev(c, partida.hero);
    // Sin azar, para que lo que telegrafiamos coincida con lo que hace luego.
    const score = -Math.abs(d - preferredDist) * 100 - manhattan(c, partida.hero);
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return best;
}

function getQueenSlides(fromX, fromY, ignoreEnemy) {
  const dests = [];
  for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]) {
    let x = fromX + dx, y = fromY + dy;
    while (inBounds(x, y) && !isVoid(x, y)) {
      if (isHeroAt(x, y)) break;
      const blocker = partida.enemies.find(e => e !== ignoreEnemy && e.x === x && e.y === y);
      if (blocker) break;
      dests.push({ x, y });
      x += dx; y += dy;
    }
  }
  return dests;
}

function preverJefe(boss) {
  const heroPos = partida.hero;
  const options = getQueenSlides(boss.x, boss.y, boss);
  options.push({ x: boss.x, y: boss.y });
  let best = null, bestScore = -Infinity;
  for (const o of options) {
    const aligned = (o.x === heroPos.x || o.y === heroPos.y) ? 1 : 0;
    const dist = chebyshev(o, heroPos);
    const distPref = -Math.abs(dist - 2);
    const score = aligned * 100 + distPref + Math.random() * 0.01;
    if (score > bestScore) { bestScore = score; best = o; }
  }
  return best;
}

function calcularIntencion(enemy) {
  if (enemy.type === 'ORC' || enemy.type === 'GOLEM') {
    // Si el héroe ya está adyacente → mostrar AOE 3x3 (va a golpear)
    // Si no → mostrar paso de aproximación (va a moverse)
    const adjacent = chebyshev(enemy, partida.hero) === 1;
    if (adjacent) {
      const tiles = [];
      for (let dx=-1; dx<=1; dx++)
        for (let dy=-1; dy<=1; dy++) {
          if (dx===0 && dy===0) continue;
          const x = enemy.x + dx, y = enemy.y + dy;
          if (isPassable(x, y)) tiles.push({ x, y });
        }
      return tiles;
    }
    const step = preverPasoRey(enemy, 1);
    return step ? [step] : [];
  }
  if (enemy.type === 'ARCHER' || enemy.type === 'BOSS') {
    const tiles = [];
    for (let i = 0; i < BOARD_SIZE; i++) {
      if (i !== enemy.x && isPassable(i, enemy.y)) tiles.push({ x: i, y: enemy.y });
      if (i !== enemy.y && isPassable(enemy.x, i)) tiles.push({ x: enemy.x, y: i });
    }
    return tiles;
  }
  if (enemy.type === 'GOBLIN') {
    const t = preverGoblin(enemy);
    return t ? [t] : [];
  }
  if (enemy.type === 'BAT') {
    const t = preverMurcielago(enemy);
    return t ? [t] : [];
  }
  if (enemy.type === 'ASSASSIN') {
    const t = preverAsesino(enemy);
    return t ? [t] : [];
  }
  if (enemy.type === 'SHAMAN') {
    const tiles = [];
    for (let dx=-1; dx<=1; dx++)
      for (let dy=-1; dy<=1; dy++) {
        if (dx===0 && dy===0) continue;
        const x = enemy.x + dx, y = enemy.y + dy;
        if (isPassable(x, y)) tiles.push({ x, y });
      }
    return tiles;
  }
  if (enemy.type === 'NECROMANCER') {
    const tiles = [];
    for (let dx=-1; dx<=1; dx++)
      for (let dy=-1; dy<=1; dy++) {
        if (dx===0 && dy===0) continue;
        const x = enemy.x + dx, y = enemy.y + dy;
        if (isPassable(x, y)) tiles.push({ x, y });
      }
    return tiles;
  }
  if (enemy.type === 'SKELETON') {
    const t = preverPasoRey(enemy, 1);
    return t ? [t] : [];
  }
  if (enemy.type === 'BERSERKER' || enemy.type === 'VETERAN') {
    const adjacent = chebyshev(enemy, partida.hero) === 1;
    if (adjacent) {
      const tiles = [];
      for (let dx=-1; dx<=1; dx++)
        for (let dy=-1; dy<=1; dy++) {
          if (dx===0 && dy===0) continue;
          const x = enemy.x + dx, y = enemy.y + dy;
          if (isPassable(x, y)) tiles.push({ x, y });
        }
      return tiles;
    }
    const step = preverPasoRey(enemy, 1);
    return step ? [step] : [];
  }
  if (enemy.type === 'GLACIAL_WARLOCK') {
    return (chebyshev(enemy, partida.hero) <= 2) ? [{ x: partida.hero.x, y: partida.hero.y }] : [];
  }
  if (enemy.type === 'WEAVER') {
    const step = preverPasoRey(enemy, 2);
    return step ? [step] : [];
  }
  return [];
}
function refrescarIntenciones() { for (const e of partida.enemies) e.intent = calcularIntencion(e); }

/* Devuelve el destino que el enemigo telegrafió al jugador (intención congelada
   al inicio del turno enemigo). Si esa casilla ya no es válida, recalcula. */
function destinoComprometido(enemy, recompute) {
  const c = enemy._committedMove;
  if (c) {
    const occupied = partida.enemies.some(e => e !== enemy && e.x === c.x && e.y === c.y);
    if (isHeroAt(c.x, c.y) || (isPassable(c.x, c.y) && !occupied)) return c;
  }
  return recompute(enemy);
}

/* Predicción del daño que un enemigo te hará en su próximo turno (para Ojo del Profeta).
   Devuelve { dmg, bypass }: bypass = ignora escudo (asesino). */
function preverGolpeEnemigo(enemy) {
  const heroTile = { x: partida.hero.x, y: partida.hero.y };
  let dmg = 0, bypass = false;
  if ((enemy.frozenTurns || 0) > 0) return { dmg: 0, bypass: false };
  switch (enemy.type) {
    case 'GOBLIN': {
      const t = preverGoblin(enemy);
      if (t && t.x === heroTile.x && t.y === heroTile.y) dmg = 1;
      break;
    }
    case 'BAT': {
      const t = preverMurcielago(enemy);
      if (t && t.x === heroTile.x && t.y === heroTile.y) dmg = 1;
      break;
    }
    case 'ASSASSIN': {
      const t = preverAsesino(enemy);
      if (t && t.x === heroTile.x && t.y === heroTile.y) { dmg = 1; bypass = true; }
      break;
    }
    case 'SKELETON': {
      const t = preverPasoRey(enemy, 1);
      if (t && t.x === heroTile.x && t.y === heroTile.y) dmg = 1 + (enemy.bonusDamage || 0);
      break;
    }
    case 'ORC':
    case 'GOLEM':
    case 'BERSERKER':
    case 'VETERAN': {
      if (chebyshev(enemy, heroTile) === 1) dmg = 1;
      break;
    }
    case 'ARCHER': {
      if (enemy.x === heroTile.x || enemy.y === heroTile.y) dmg = 1;
      break;
    }
    case 'GLACIAL_WARLOCK': {
      if (chebyshev(enemy, heroTile) <= 2) dmg = 1;
      break;
    }
    case 'BOSS': {
      const dest = preverJefe(enemy) || enemy;
      if (dest.x === heroTile.x || dest.y === heroTile.y) dmg = 1;
      break;
    }
    // SHAMAN/NECROMANCER/WEAVER: 0 dmg directo
  }
  return { dmg, bypass };
}

function pickMinionType(level) {
  const r = Math.random();
  if (level === 1) {
    if (r < 0.55) return 'GOBLIN';
    if (r < 0.80) return 'ORC';
    return 'BAT';
  }
  if (level === 2) {
    if (r < 0.22) return 'GOBLIN';
    if (r < 0.42) return 'ARCHER';
    if (r < 0.55) return 'ORC';
    if (r < 0.68) return 'BAT';
    if (r < 0.80) return 'SHAMAN';
    if (r < 0.92) return 'ASSASSIN';
    return 'NECROMANCER';
  }
  if (r < 0.18) return 'GOBLIN';
  if (r < 0.34) return 'ARCHER';
  if (r < 0.48) return 'ORC';
  if (r < 0.62) return 'BAT';
  if (r < 0.74) return 'SHAMAN';
  if (r < 0.86) return 'ASSASSIN';
  return 'NECROMANCER';
}

/* ---------------------- NIVEL ---------------------- */
function empezarNivel(level) {
  fxGeneration++;          // invalida cualquier FX diferido del nivel anterior
  Tooltip.hide();
  // Estado de la partida al entrar al nivel. La vida, el oro, el mazo extra,
  // las reliquias y la clase del héroe se conservan: eso no se toca aquí.
  Object.assign(partida, {
    currentLevel: level,
    enemies: [], hand: [], discardPile: [], deck: buildDeck(),
    energy: partida.maxEnergy || MAX_ENERGY,
    chainCount: 0, vengeance: 0, freeCantripUsedThisTurn: false, frozenSlot: null,
    undoSnapshot: null, undoUsedThisLevel: false,
    selectedCardIndex: null, selectedPotionSlot: null, hoveredCardIdx: null, hoveredEnemyId: null,
    validTargets: [], previewTargets: [],
    corruptedTiles: [], hazards: [], voids: [], shopOffers: null,
    phase: 'PLAYER_TURN', inputLocked: false,
  });
  Object.assign(partida.hero, { x: 2, y: 2, shield: 0, thorns: false });
  prevHandSnapshot = [];
  setupHandSlots();

  pieceLayer.innerHTML = '';
  fxLayer.innerHTML = '';
  pieceNodes.clear();

  // Generar voids ANTES de construir el board para que las celdas reciban la clase .void
  if (level === FINAL_LEVEL) {
    partida.voids = generateBossVoids(4);
  }

  buildBoardCells();
  sizeBoard();

  let currentTheme = 'BOSS';

  if (level === FINAL_LEVEL) {
    setupBossLevel();
    // Ascensión 4: boss +3 HP
    if (getAscension() >= 4) {
      const boss = partida.enemies.find(e => e.type === 'BOSS');
      if (boss) { boss.hp += 3; boss.maxHp += 3; }
    }
    setMessage(`⚠ NIVEL ${level} – ¡EL ARCHIMAGO SUPREMO!`);
  } else {
    currentTheme = pickRandomTheme();
    spawnRegularEnemies(level, currentTheme);
    const eliteSuffix = partida.nextLevelMode === 'elite' ? ' ⚔ ¡ÉLITE!' : '';
    setMessage(`Nivel ${level} – elimina a todos los enemigos.${eliteSuffix}`);
  }

  document.body.classList.remove('theme-cave', 'theme-ice', 'theme-magic', 'theme-boss', 'theme-normal');
  document.body.classList.add('theme-' + currentTheme.toLowerCase());
  partida.currentBiome = currentTheme;

  generateHazards(level, currentTheme);
  refrescarIntenciones();
  drawHand();
  pintar();
}

function generateHazards(level, theme) {
  if (theme === 'BOSS') return;
  // El bioma NORMAL tiene sus propios hazards "amistosos" (oro y tumba). El resto sigue abajo.
  if (theme === 'NORMAL') {
    // mismo barrido de casillas libres que abajo
    const occupied = new Set();
    occupied.add(`${partida.hero.x},${partida.hero.y}`);
    for (const e of partida.enemies) occupied.add(`${e.x},${e.y}`);
    const free = [];
    for (let x = 0; x < BOARD_SIZE; x++) {
      for (let y = 0; y < BOARD_SIZE; y++) {
        if (!isPassable(x, y)) continue;
        if (occupied.has(`${x},${y}`)) continue;
        if (Math.abs(x - partida.hero.x) + Math.abs(y - partida.hero.y) <= 1) continue;
        free.push({ x, y });
      }
    }
    shuffle(free);
    const goldCount = 1 + Math.floor(Math.random() * 2); // 1-2 casillas de oro
    for (let i = 0; i < goldCount && free.length > 0; i++) {
      const c = free.pop();
      partida.hazards.push({ x: c.x, y: c.y, type: 'GOLD' });
    }
    if (free.length > 0 && Math.random() < 0.5) {
      const c = free.pop();
      partida.hazards.push({ x: c.x, y: c.y, type: 'GRAVE' });
    }
    return;
  }

  const occupied = new Set();
  occupied.add(`${partida.hero.x},${partida.hero.y}`);
  for (const e of partida.enemies) occupied.add(`${e.x},${e.y}`);

  const free = [];
  for (let x = 0; x < BOARD_SIZE; x++) {
    for (let y = 0; y < BOARD_SIZE; y++) {
      if (!isPassable(x, y)) continue;
      if (occupied.has(`${x},${y}`)) continue;
      if (Math.abs(x - partida.hero.x) + Math.abs(y - partida.hero.y) <= 1) continue;
      free.push({ x, y });
    }
  }
  shuffle(free);

  const isTooClose = (x, y) => partida.hazards.some(h => chebyshev(h, {x, y}) <= 1);

  const takeSpaced = () => {
    for (let i = 0; i < free.length; i++) {
      if (!isTooClose(free[i].x, free[i].y)) {
        return free.splice(i, 1)[0];
      }
    }
    return free.pop() || null; 
  };

  const numHazards = 4 + Math.floor(level / 2);

  if (theme === 'CAVE') {
    for (let i = 0; i < numHazards + 1; i++) {
      const c = takeSpaced(); if (!c) break;
      partida.hazards.push({ x: c.x, y: c.y, type: 'SPIKES' });
    }
  } else if (theme === 'ICE') {
    for (let i = 0; i < numHazards; i++) {
      const c = takeSpaced(); if (!c) break;
      partida.hazards.push({ x: c.x, y: c.y, type: 'ICE' });
    }
  } else if (theme === 'MAGIC') {
    const pairs = Math.min(Math.ceil(numHazards / 2), PALETA_PORTALES.length);
    const palette = [...PALETA_PORTALES];
    shuffle(palette);
    for (let i = 0; i < pairs; i++) {
      const a = takeSpaced(), b = takeSpaced();
      if (!a || !b) break;
      const pairId = Math.random().toString(36).slice(2, 8);
      const p = palette[i];
      partida.hazards.push({ x: a.x, y: a.y, type: 'TELEPORT', pairId, color: p.color, colorName: p.name });
      partida.hazards.push({ x: b.x, y: b.y, type: 'TELEPORT', pairId, color: p.color, colorName: p.name });
    }
  }
}

function spawnRegularEnemies(level, themeForElite = null) {
  const edgeCells = [];
  for (let x=0; x<BOARD_SIZE; x++)
    for (let y=0; y<BOARD_SIZE; y++) {
      const isEdge = (x===0 || x===BOARD_SIZE-1 || y===0 || y===BOARD_SIZE-1);
      if (isEdge && !isHeroAt(x,y) && !isVoid(x,y)) edgeCells.push({ x, y });
    }
  shuffle(edgeCells);
  let num = Math.min(3 + Math.floor((level-1)/2), 8);
  // Si es nivel "élite" elegido en el shop, el siguiente nivel tiene 1 enemigo menos + 1 élite del bioma
  let eliteType = null;
  if (partida.nextLevelMode === 'elite' && themeForElite) {
    const map = { CAVE: 'BERSERKER', ICE: 'GLACIAL_WARLOCK', MAGIC: 'WEAVER', NORMAL: 'VETERAN' };
    eliteType = map[themeForElite];
  }
  if (eliteType && edgeCells.length > 0) {
    const e = edgeCells.shift();
    spawnEnemy(eliteType, e.x, e.y);
    num = Math.max(1, num - 1);
  }
  // Aplicar ascensión: HP+1 a enemigos a partir de nivel 2 si A>=1
  for (let i = 0; i < num && i < edgeCells.length; i++) {
    const enemy = spawnEnemy(pickMinionType(level), edgeCells[i].x, edgeCells[i].y);
    if (getAscension() >= 1 && level >= 2 && enemy && enemy.type !== 'SKELETON') {
      enemy.hp += 1; enemy.maxHp += 1;
    }
  }
}

function setupBossLevel() {
  const baseCandidates = [
    { x: 2, y: 0 }, { x: 2, y: 4 }, { x: 0, y: 2 }, { x: 4, y: 2 },
    { x: 1, y: 0 }, { x: 3, y: 0 }, { x: 0, y: 1 }, { x: 4, y: 1 },
    { x: 1, y: 4 }, { x: 3, y: 4 }, { x: 0, y: 3 }, { x: 4, y: 3 }
  ];
  // Garantizar al menos 3 spots libres para boss + 2 minions; regenerar voids si bloquearon todo
  let candidates = baseCandidates.filter(p => isPassable(p.x, p.y) && !isHeroAt(p.x, p.y));
  let tries = 0;
  while (candidates.length < 3 && tries++ < 10) {
    partida.voids = generateBossVoids(4);
    // Reconstruir celdas para que las clases .void se actualicen
    buildBoardCells();
    candidates = baseCandidates.filter(p => isPassable(p.x, p.y) && !isHeroAt(p.x, p.y));
  }
  shuffle(candidates);
  spawnEnemy('BOSS', candidates[0].x, candidates[0].y);
  const minionPositions = candidates.slice(1).filter(p => chebyshev(p, partida.hero) >= 2 && !partida.enemies.some(e => e.x===p.x && e.y===p.y));
  for (let i = 0; i < 2 && i < minionPositions.length; i++) {
    const r = Math.random();
    const t = r < 0.35 ? 'GOBLIN' : (r < 0.65 ? 'ARCHER' : (r < 0.85 ? 'GOLEM' : 'BAT'));
    spawnEnemy(t, minionPositions[i].x, minionPositions[i].y);
  }
}

function spawnEnemy(type, x, y) {
  const def = ENEMIGOS[type];
  const enemy = {
    id: partida.nextEnemyId++,
    type, x, y,
    hp: def.hp, maxHp: def.hp,
    armor: def.armor || 0,
    buffed: 0,
    intent: []
  };
  if (type === 'NECROMANCER') enemy.necroCooldown = 0;
  if (type === 'SKELETON') enemy.bonusDamage = 0;
  partida.enemies.push(enemy);
  return enemy;
}

/* ---------------------- TABLERO EVENT DELEGATION ---------------------- */
let boardListenersAttached = false;

function attachBoardListeners() {
  if (boardListenersAttached) return;
  boardListenersAttached = true;

  const getCoords = (target) => {
    const cell = target?.closest?.('.cell');
    if (!cell || cell.parentNode !== boardEl) return null;
    const x = parseInt(cell.dataset.x, 10);
    const y = parseInt(cell.dataset.y, 10);
    if (Number.isNaN(x) || Number.isNaN(y)) return null;
    return { x, y };
  };

  boardEl.addEventListener('click', (e) => {
    const c = getCoords(e.target);
    if (c) onCellClick(c.x, c.y);
  });
  boardEl.addEventListener('mouseover', (e) => {
    const c = getCoords(e.target);
    if (c) onCellEnter(c.x, c.y);
  });
  boardEl.addEventListener('mouseout', (e) => {
    const c = getCoords(e.target);
    if (!c) return;
    const toCell = e.relatedTarget && e.relatedTarget.closest?.('.cell');
    if (toCell && toCell.parentNode === boardEl) return;
    onCellLeave(c.x, c.y);
  });

  // En táctil no hay hover, así que un toque en la casilla muestra su tooltip.
  boardEl.addEventListener('pointerup', (e) => {
    if (e.pointerType !== 'touch') return;
    const c = getCoords(e.target);
    if (c) onCellEnter(c.x, c.y);
  });
  // Tocar fuera del tablero/HUD oculta el tooltip flotante.
  document.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    if (!e.target.closest?.('.cell, .stat-chip, .potion-slot, #game-tooltip')) Tooltip.hide();
  }, true);
}

function buildBoardCells() {
  boardEl.innerHTML = '';
  const frag = document.createDocumentFragment();
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      const cell = document.createElement('div');
      const light = (x + y) % 2 === 0;
      cell.className = `cell ${light ? 'light' : 'dark'}`;
      if (isVoid(x, y)) cell.classList.add('void');
      cell.dataset.x = x;
      cell.dataset.y = y;
      frag.appendChild(cell);
    }
  }
  boardEl.appendChild(frag);
  attachBoardListeners();
}

function cellAt(x, y) {
  const idx = y * BOARD_SIZE + x;
  return boardEl.children[idx] || null;
}

/* ---------------------- PIEZAS ---------------------- */
function syncPieces() {
  const activeIds = new Set();
  activeIds.add('hero');
  let heroNode = pieceNodes.get('hero');
  if (!heroNode) {
    heroNode = document.createElement('div');
    heroNode.className = 'piece piece-hero';
    const heroIcon = (CLASES_HEROE[partida.heroClass] || CLASES_HEROE.BARBARIAN).icon;
    heroNode.innerHTML = `<span class="ico">${heroIcon}</span>`;
    pieceLayer.appendChild(heroNode);
    pieceNodes.set('hero', heroNode);
  }
  positionPiece(heroNode, partida.hero.x, partida.hero.y);
  heroNode.classList.toggle('thorns-on', !!partida.hero.thorns);
  heroNode.classList.toggle('vengeance-on', (partida.vengeance || 0) > 0);

  for (const enemy of partida.enemies) {
    const id = 'e' + enemy.id;
    activeIds.add(id);
    let node = pieceNodes.get(id);
    if (!node) {
      node = document.createElement('div');
      node.className = 'piece piece-' + enemy.type.toLowerCase();
	const def = ENEMIGOS[enemy.type];
      node.innerHTML = `
        <span class="ico">${def.icon}</span>
        <div class="hp-bar"></div>
        <div class="intent-tag"></div>
      `;
      pieceLayer.appendChild(node);
      pieceNodes.set(id, node);
      node.classList.add('spawn-in');
      setTimeout(() => node.classList.remove('spawn-in'), 480);
    }
    positionPiece(node, enemy.x, enemy.y);
    node.classList.toggle('buffed', (enemy.buffed || 0) > 0);

    const hpBar = node.querySelector('.hp-bar');
    if (hpBar) hpBar.textContent = `${enemy.hp}/${enemy.maxHp}`;
    const intentTag = node.querySelector('.intent-tag');
    if (intentTag) intentTag.textContent = ENEMIGOS[enemy.type].label;

    let armorBadge = node.querySelector('.armor-badge');
    if ((enemy.armor || 0) > 0) {
      if (!armorBadge) {
        armorBadge = document.createElement('div');
        armorBadge.className = 'armor-badge';
        node.appendChild(armorBadge);
      }
      armorBadge.textContent = `🛡${enemy.armor}`;
    } else if (armorBadge) {
      armorBadge.remove();
    }

    // Veneno
    let poisonBadge = node.querySelector('.poison-badge');
    if ((enemy.poison || 0) > 0) {
      if (!poisonBadge) {
        poisonBadge = document.createElement('div');
        poisonBadge.className = 'poison-badge';
        node.appendChild(poisonBadge);
      }
      poisonBadge.textContent = `☠${enemy.poison}`;
      node.classList.add('poisoned');
    } else {
      if (poisonBadge) poisonBadge.remove();
      node.classList.remove('poisoned');
    }

    // Congelado
    node.classList.toggle('frozen', (enemy.frozenTurns || 0) > 0);

    // Élite tag visual
    if (ENEMIGOS[enemy.type] && ENEMIGOS[enemy.type].elite) {
      node.classList.add('elite');
    }

    // Ojo del Profeta: badge de amenaza con daño predicho
    let threatBadge = node.querySelector('.threat-badge');
    if (hasRelic('PROPHET_EYE')) {
      const { dmg, bypass } = preverGolpeEnemigo(enemy);
      if (dmg > 0) {
        if (!threatBadge) {
          threatBadge = document.createElement('div');
          threatBadge.className = 'threat-badge';
          node.appendChild(threatBadge);
        }
        threatBadge.textContent = `${bypass ? '🗡' : '⚔'}${dmg}`;
        threatBadge.classList.toggle('bypass', bypass);
      } else if (threatBadge) {
        threatBadge.remove();
      }
    } else if (threatBadge) {
      threatBadge.remove();
    }
  }
  for (const [id, node] of [...pieceNodes.entries()]) {
    if (!activeIds.has(id)) {
      pieceNodes.delete(id);
      // Si el tooltip flotante apuntaba a esta pieza que muere, ciérralo:
      // su 'mouseout' nunca llegará a dispararse al eliminarse el nodo.
      if (Tooltip.ownerIs(node)) {
        Tooltip.hide();
        partida.hoveredEnemyId = null;
      }
      node.classList.add('despawn');
      const dead = node;
      setTimeout(() => { if (dead.parentNode) dead.remove(); }, 420);
    }
  }
}
function positionPiece(node, x, y) {
  node.style.left = `${x * (100 / BOARD_SIZE)}%`;
  node.style.top  = `${y * (100 / BOARD_SIZE)}%`;
}

/* ---------------------- RENDER ---------------------- */
function pintar() {
  levelEl.textContent = partida.currentLevel;
  hpEl.textContent = `${partida.hero.hp}/${partida.hero.maxHp}`;
  const perm = partida._permShield || 0;
  shieldEl.textContent = perm > 0
    ? `${partida.hero.shield} (+${perm}/turno)`
    : partida.hero.shield;
  energyEl.textContent = `${partida.energy}/${partida.maxEnergy || MAX_ENERGY}`;
  goldEl.textContent = partida.gold;

  // Chip de combo
  const comboEl = document.getElementById('combo');
  if (comboEl) {
    comboEl.textContent = `${Math.min(partida.chainCount, 3)}/3`;
    const chip = comboEl.closest('.stat-chip');
    if (chip) {
      chip.classList.toggle('max', partida.chainCount >= 3);
      chip.classList.toggle('hidden', partida.chainCount === 0);
    }
  }
  // Chip de venganza (sangre por sangre)
  const vengEl = document.getElementById('vengeance');
  if (vengEl) {
    vengEl.textContent = partida.vengeance || 0;
    const chip = vengEl.closest('.stat-chip');
    if (chip) chip.classList.toggle('hidden', !hasRelic('BLOOD_FOR_BLOOD') || !partida.vengeance);
  }
  // Botón Deshacer
  const undoBtn = document.getElementById('undo-btn');
  if (undoBtn) {
    const canUndo = !!partida.undoSnapshot && !partida.undoUsedThisLevel
                    && partida.phase === 'PLAYER_TURN' && !partida.inputLocked;
    undoBtn.disabled = !canUndo;
    undoBtn.classList.toggle('hidden', !partida.undoSnapshot);
  }
  deckCountEl.textContent = partida.deck.length;
  discardCountEl.textContent = partida.discardPile.length;

  deckPileBtn.classList.toggle('empty', partida.deck.length === 0);
  discardPileBtn.classList.toggle('empty', partida.discardPile.length === 0);

  pintarCorrupcion();
  pintarPeligros();  
  pintarReliquias();   
  updateBoardHighlights();
  syncPieces();
  pintarMano();
  pintarPociones();
  pintarMapa();

  endTurnBtn.disabled = partida.phase !== 'PLAYER_TURN' || partida.inputLocked;
}

function pintarPeligros() {
  for (const cell of boardEl.children) {
    cell.classList.remove('hazard-ice', 'hazard-spikes', 'hazard-teleport', 'hazard-gold', 'hazard-grave');
    cell.style.removeProperty('--portal-color');
    const old = cell.querySelector('.hazard-mark');
    if (old) old.remove();
  }
  for (const h of partida.hazards) {
    const cell = cellAt(h.x, h.y);
    if (!cell) continue;
    if (h.type === 'ICE')      cell.classList.add('hazard-ice');
    if (h.type === 'SPIKES')   cell.classList.add('hazard-spikes');
    if (h.type === 'GOLD')     cell.classList.add('hazard-gold');
    if (h.type === 'GRAVE')    cell.classList.add('hazard-grave');
    if (h.type === 'TELEPORT') {
      cell.classList.add('hazard-teleport');
      if (h.color) cell.style.setProperty('--portal-color', h.color);
    }
    const mark = document.createElement('div');
    mark.className = 'hazard-mark hazard-mark-' + h.type;
    mark.textContent = PELIGROS[h.type].icon;
    if (h.type === 'TELEPORT' && h.color) {
      mark.style.setProperty('--portal-color', h.color);
      mark.setAttribute('aria-label', `Portal ${h.colorName || ''}`);
    }
    cell.appendChild(mark);
  }
}

function pintarReliquias() {
  if (!relicsBarEl) return;
  if (!partida.relics.length) {
    relicsBarEl.classList.add('hidden');
    relicsBarEl.innerHTML = '';
    return;
  }
  relicsBarEl.classList.remove('hidden');
  relicsBarEl.innerHTML = partida.relics.map(key => {
    const r = RELIQUIAS[key];
    return `
      <div class="relic-container" role="img" aria-label="${r.name}: ${r.desc}">
        <span class="relic-icon" style="color:${r.color};">${r.icon}</span>
        <div class="relic-tooltip">
          <div class="relic-tooltip-title" style="color:${r.color};">${r.name}</div>
          <div class="relic-tooltip-desc">${r.desc}</div>
        </div>
      </div>
    `;
  }).join('');
}

function pintarCorrupcion() {
  for (const cell of boardEl.children) {
    const x = parseInt(cell.dataset.x, 10);
    const y = parseInt(cell.dataset.y, 10);
    const fire = cell.querySelector('.corruption-fire');
    if (isCorrupted(x, y)) {
      cell.classList.add('corrupted');
      if (!fire) {
        const f = document.createElement('div');
        f.className = 'corruption-fire';
        f.textContent = '🔥';
        cell.appendChild(f);
      }
    } else {
      cell.classList.remove('corrupted');
      if (fire) fire.remove();
    }
  }
}

// Listeners de la mano por delegación: se enganchan una vez, no uno por carta.
function attachHandListeners() {
  if (handDelegationAttached) return;
  handDelegationAttached = true;
  const idxOf = (target) => {
    const card = target?.closest?.('.card');
    if (!card || card.parentNode !== handEl) return -1;
    return Array.prototype.indexOf.call(handEl.children, card);
  };
  handEl.addEventListener('click', (e) => {
    const i = idxOf(e.target);
    if (i >= 0) onCardClick(i);
  });
  handEl.addEventListener('mouseover', (e) => {
    const i = idxOf(e.target);
    if (i >= 0) onCardHover(i, true);
  });
  handEl.addEventListener('mouseout', (e) => {
    const i = idxOf(e.target);
    if (i < 0) return;
    const card = handEl.children[i];
    if (e.relatedTarget && card.contains(e.relatedTarget)) return;
    onCardHover(i, false);
    card.style.transform = '';   // reset tilt
  });
  handEl.addEventListener('focusin', (e) => {
    const i = idxOf(e.target);
    if (i >= 0) onCardHover(i, true);
  });
  handEl.addEventListener('focusout', (e) => {
    const i = idxOf(e.target);
    if (i >= 0) onCardHover(i, false);
  });
  // Tilt 3D parallax delegado
  handEl.addEventListener('mousemove', (e) => {
    const i = idxOf(e.target);
    if (i < 0) return;
    const card = handEl.children[i];
    if (card.classList.contains('empty') || card.disabled) return;
    const rect = card.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top)  / rect.height - 0.5;
    const selected = card.classList.contains('selected');
    const baseY = selected ? -8 : -6;
    const baseScale = selected ? 1.04 : 1.03;
    card.style.transform = `perspective(700px) rotateY(${px * 12}deg) rotateX(${-py * 12}deg) translateY(${baseY}px) scale(${baseScale})`;
  });
}

function pintarMano() {
  const max = getMaxHand();
  // Si nada visible de la mano cambió, no tocamos el DOM. Esto importa en el
  // turno enemigo, cuando pintar() se llama un montón de veces con la mano vacía.
  const sig = max + '|' + partida.hand.join(',') + '|' + partida.selectedCardIndex
            + '|' + partida.energy + '|' + partida.phase + '|' + partida.inputLocked
            + '|' + partida.frozenSlot;
  if (sig === _handSig) return;
  _handSig = sig;
  handEl.innerHTML = '';
  handEl.style.gridTemplateColumns = `repeat(${max}, minmax(0, 1fr))`;
  for (let i = 0; i < max; i++) {
    const cardType = partida.hand[i];
    const cardEl = document.createElement(cardType != null ? 'button' : 'div');
    if (cardType != null) {
      cardEl.type = 'button';
      const def = CARTAS[cardType];
      cardEl.className = 'card';
      if (def.rarity) cardEl.classList.add('rarity-' + def.rarity);
      if (def.cantrip) cardEl.classList.add('cantrip');
      if (def.curse) cardEl.classList.add('curse');
      const frozen = partida.frozenSlot === i;
      if (frozen) cardEl.classList.add('frozen-slot');
      const disabled = (partida.energy < 1 && !def.curse) || partida.phase !== 'PLAYER_TURN' || partida.inputLocked || frozen;
      if (partida.selectedCardIndex === i) cardEl.classList.add('selected');
      if (disabled) cardEl.classList.add('disabled');
      cardEl.disabled = disabled;
      cardEl.setAttribute('aria-pressed', partida.selectedCardIndex === i ? 'true' : 'false');
      cardEl.setAttribute('aria-label',
        `${def.name}. ${def.desc}. Atajo tecla ${i + 1}.${disabled ? ' Sin energía.' : ''}`);
      const rarityTag = def.rarity && def.rarity !== 'common'
        ? `<span class="rarity-badge ${def.rarity}">${def.rarity}</span>` : '';
      const kbd = i < 3 ? `<span class="card-kbd" aria-hidden="true">${i + 1}</span>` : '';
      cardEl.innerHTML = `
        ${kbd}
        <span class="card-icon">${def.icon}</span>
        <span class="card-name">${def.name}</span>
        <span class="card-desc">${def.desc}</span>
        ${rarityTag}
      `;
      const wasEmpty = prevHandSnapshot[i] == null;
      if (wasEmpty) {
        cardEl.classList.add('card-draw-in');
        cardEl.style.animationDelay = (i * 110) + 'ms';
      }
      // Los eventos (click, hover, foco, tilt) van por delegación en attachHandListeners().
    } else {
      cardEl.className = 'card empty';
      cardEl.setAttribute('aria-hidden', 'true');
      cardEl.innerHTML = `
        <span class="card-icon">∅</span>
        <span class="card-name">—</span>
        <span class="card-desc">vacío</span>
      `;
    }
    handEl.appendChild(cardEl);
  }
  prevHandSnapshot = [...partida.hand];
}

function pintarPociones() {
  for (let i = 0; i < MAX_POTIONS; i++) {
    const slot = potionSlots[i];
    if (!slot) continue;
    slot.classList.remove('filled', 'teleport-active',
      'type-LIFE','type-SHIELD','type-ENERGY','type-TELEPORT','type-THORNS', 'type-DISCARD');
    
    slot.innerHTML = '';
    slot.removeAttribute('title');

    if (i < partida.potions.length) {
      const type = partida.potions[i];
      const def = POCIONES[type];
      slot.classList.add('filled', 'type-' + type);

      slot.innerHTML = `
        ${def.icon}
        <span class="potion-kbd" aria-hidden="true">${['Q','W','E'][i] || ''}</span>
      `;

      slot.setAttribute('aria-label', `${def.name}: ${def.desc} — pulsa para usar`);
      if (partida.phase === 'TELEPORT_TARGETING' && partida.selectedPotionSlot === i) {
        slot.classList.add('teleport-active');
      }
    } else {
      slot.setAttribute('aria-label', `Slot de poción ${i + 1} vacío`);
    }
  }
  thornsIndicator.classList.toggle('hidden', !partida.hero.thorns);
}

function pintarMapa() {
  mapNodes.forEach((node, idx) => {
    const lvl = idx + 1;
    node.classList.remove('done', 'current');
    if (lvl < partida.currentLevel) node.classList.add('done');
    else if (lvl === partida.currentLevel) node.classList.add('current');
  });
  mapLinks.forEach((link, idx) => {
    link.classList.remove('done');
    if (idx + 1 < partida.currentLevel) link.classList.add('done');
  });
}

function setMessage(msg) { messageEl.textContent = msg; }

function flashChip(stat) {
  const chip = document.querySelector(`.stat-chip[data-stat="${stat}"]`);
  if (!chip) return;
  chip.classList.remove('glow');
  void chip.offsetWidth;
  chip.classList.add('glow');
  setTimeout(() => chip.classList.remove('glow'), 700);
}

/* ---------------------- HIGHLIGHTS ---------------------- */
function updateBoardHighlights() {
  for (const cell of boardEl.children) {
    cell.classList.remove('move-target', 'preview-target', 'teleport-target', 'danger', 'support');
  }
  let tiles = [], klass = '';
  if (partida.phase === 'TELEPORT_TARGETING') {
    tiles = partida.validTargets; klass = 'teleport-target';
  } else if (partida.selectedCardIndex !== null) {
    tiles = partida.validTargets; klass = 'move-target';
  } else if (partida.hoveredCardIdx !== null) {
    tiles = partida.previewTargets; klass = 'preview-target';
  }
  for (const t of tiles) {
    const c = cellAt(t.x, t.y);
    if (c) c.classList.add(klass);
  }
  
  if (partida.hoveredEnemyId != null) {
    const e = partida.enemies.find(en => en.id === partida.hoveredEnemyId);
    if (e) {
      const auraClass = e.type === 'SHAMAN' ? 'support' : 'danger';
      for (const tile of e.intent) {
        const c = cellAt(tile.x, tile.y);
        if (c) c.classList.add(auraClass);
      }
    }
  }

  // Refresca el tooltip flotante del enemigo bajo el cursor con su estado en vivo.
  if (partida.hoveredEnemyId != null) {
    const he = partida.enemies.find(en => en.id === partida.hoveredEnemyId);
    if (he) showEnemyTooltip(he);
    else Tooltip.hide();
  }
}

function onCellEnter(x, y) {
  // Los tooltips funcionan en cualquier fase; el resaltado de amenaza solo en turno del jugador.
  const playerPhase = (partida.phase === 'PLAYER_TURN' || partida.phase === 'TELEPORT_TARGETING')
                      && !partida.inputLocked;
  const e = enemyAt(x, y);
  if (e) {
    if (playerPhase && partida.hoveredEnemyId !== e.id) {
      partida.hoveredEnemyId = e.id;
      updateBoardHighlights();
    }
    showEnemyTooltip(e);
  } else {
    if (playerPhase && partida.hoveredEnemyId !== null) {
      partida.hoveredEnemyId = null;
      updateBoardHighlights();
    }
    showTileTooltip(x, y);
  }
}
function onCellLeave(x, y) {
  const e = enemyAt(x, y);
  if (e && e.id === partida.hoveredEnemyId) {
    partida.hoveredEnemyId = null;
    if (partida.phase === 'PLAYER_TURN' || partida.phase === 'TELEPORT_TARGETING') {
      updateBoardHighlights();
    }
  }
  Tooltip.hide();
}

function onCardHover(index, enter) {
  if (partida.phase !== 'PLAYER_TURN' || partida.inputLocked) return;
  if (enter) {
    if (index >= getMaxHand()) return;
    const card = partida.hand[index];
    if (card == null) return;
    if (partida.energy < 1) return;
    if (partida.selectedCardIndex !== null) return;
    partida.hoveredCardIdx = index;
    partida.previewTargets = getValidMoves(card, partida.hero.x, partida.hero.y);
  } else {
    if (partida.hoveredCardIdx === index) {
      partida.hoveredCardIdx = null;
      partida.previewTargets = [];
    }
  }
  updateBoardHighlights();
}

/* ---------------------- FX ---------------------- */
function floatText(x, y, text, color = '#f8fafc', big = false) {
  const span = document.createElement('span');
  span.className = 'float-text' + (big ? ' big' : '');
  span.style.color = color;
  span.style.left = `${(x + 0.5) / BOARD_SIZE * 100}%`;
  span.style.top  = `${(y + 0.5) / BOARD_SIZE * 100}%`;
  span.textContent = text;
  fxLayer.appendChild(span);
  setTimeout(() => { if (span.parentNode) span.remove(); }, 1100);
}
function shakeBoard(heavy = false) {
  boardEl.classList.remove('shake', 'shake-heavy');
  void boardEl.offsetWidth;
  boardEl.classList.add(heavy ? 'shake-heavy' : 'shake');
  setTimeout(() => boardEl.classList.remove('shake', 'shake-heavy'), 600);
}
function flashCell(x, y, klass = 'attack-flash') {
  const cell = cellAt(x, y);
  if (!cell) return;
  cell.classList.remove(klass);
  void cell.offsetWidth;
  cell.classList.add(klass);
  setTimeout(() => cell.classList.remove(klass), 560);
}
function impactHero() {
  const node = pieceNodes.get('hero');
  if (!node) return;
  node.classList.remove('hero-impact');
  void node.offsetWidth;
  node.classList.add('hero-impact');
  setTimeout(() => node.classList.remove('hero-impact'), 360);
}
function lungeHero() {
  const node = pieceNodes.get('hero');
  if (!node) return;
  node.classList.remove('attack-lunge');
  void node.offsetWidth;
  node.classList.add('attack-lunge');
  setTimeout(() => node.classList.remove('attack-lunge'), 320);
}
function slashAt(x, y) {
  const s = document.createElement('div');
  s.className = 'slash-fx';
  s.style.left = `${(x + 0.5) / BOARD_SIZE * 100}%`;
  s.style.top  = `${(y + 0.5) / BOARD_SIZE * 100}%`;
  fxLayer.appendChild(s);
  setTimeout(() => { if (s.parentNode) s.remove(); }, 400);
}
function aoeRingAt(x, y) {
  const r = document.createElement('div');
  r.className = 'aoe-ring';
  r.style.left = `${(x + 0.5) / BOARD_SIZE * 100}%`;
  r.style.top  = `${(y + 0.5) / BOARD_SIZE * 100}%`;
  fxLayer.appendChild(r);
  setTimeout(() => { if (r.parentNode) r.remove(); }, 580);
}
function teleportRingAt(x, y) {
  const r = document.createElement('div');
  r.className = 'teleport-ring';
  r.style.left = `${(x + 0.5) / BOARD_SIZE * 100}%`;
  r.style.top  = `${(y + 0.5) / BOARD_SIZE * 100}%`;
  fxLayer.appendChild(r);
  setTimeout(() => { if (r.parentNode) r.remove(); }, 720);
}
function particleBurst(x, y, color, glyph='✦', count=10, radius=38) {
  const frag = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    const p = document.createElement('span');
    p.className = 'particle';
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
    const dist = radius + Math.random() * 14;
    p.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
    p.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);
    p.style.left = `${(x + 0.5) / BOARD_SIZE * 100}%`;
    p.style.top  = `${(y + 0.5) / BOARD_SIZE * 100}%`;
    p.style.color = color;
    p.textContent = glyph;
    frag.appendChild(p);
    setTimeout(() => { if (p.parentNode) p.remove(); }, 900);
  }
  fxLayer.appendChild(frag);
}
function animateRelicFly(fromRect, relicKey) {
  if (!relicsBarEl) return;
  const clone = document.createElement('div');
  clone.className = 'fly-relic';
  clone.innerHTML = RELIQUIAS[relicKey].icon;
  clone.style.color = RELIQUIAS[relicKey].color;
  clone.style.left = fromRect.left + 'px';
  clone.style.top = fromRect.top + 'px';
  clone.style.width = fromRect.width + 'px';
  clone.style.height = fromRect.height + 'px';
  document.body.appendChild(clone);

  // Forzar reflow para que la animación CSS se ejecute desde el frame 0
  void clone.offsetWidth;

  requestAnimationFrame(() => {
    const destNodes = relicsBarEl.querySelectorAll('.relic-container');
    // Si ya existe en la barra, vamos al último añadido; si no, al contenedor general
    const destEl = destNodes.length > 0 ? destNodes[destNodes.length - 1] : relicsBarEl;
    const toRect = destEl.getBoundingClientRect();

    clone.style.transition = 'all 0.65s cubic-bezier(0.34, 1.56, 0.64, 1)';
    // Calculamos la distancia hacia el centro del destino
    const dx = toRect.left - fromRect.left + (toRect.width - fromRect.width) / 2;
    const dy = toRect.top - fromRect.top + (toRect.height - fromRect.height) / 2;
    
    clone.style.transform = `translate(${dx}px, ${dy}px) scale(0.6) rotate(360deg)`;
    clone.style.opacity = '0';
  });

  // Limpiar del DOM al acabar
  setTimeout(() => { if (clone.parentNode) clone.remove(); }, 700);
}

function beamTrail(fromX, fromY, toX, toY, color = '#fb923c', steps = 6) {
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = fromX + (toX - fromX) * t;
    const y = fromY + (toY - fromY) * t;
    deferFx(() => {
      const p = document.createElement('span');
      p.className = 'particle';
      p.style.color = color;
      p.textContent = '✦';
      p.style.left = `${(x + 0.5) / BOARD_SIZE * 100}%`;
      p.style.top  = `${(y + 0.5) / BOARD_SIZE * 100}%`;
      p.style.setProperty('--dx', '0px');
      p.style.setProperty('--dy', '0px');
      fxLayer.appendChild(p);
      setTimeout(() => { if (p.parentNode) p.remove(); }, 800);
    }, i * 55);
  }
}

/* ---------------------- ANIMACIONES DE CARTAS ---------------------- */
function animateCardToDiscard(cardEl, delayMs = 0) {
  if (!cardEl || !cardEl.classList.contains('card') || cardEl.classList.contains('empty')) return;
  const cardRect = cardEl.getBoundingClientRect();
  if (!cardRect.width || !discardPileBtn) return; // node already detached → skip
  const targetRect = discardPileBtn.getBoundingClientRect();
  const clone = cardEl.cloneNode(true);
  clone.classList.remove('selected', 'card-draw-in');
  clone.classList.add('card-fly-clone');
  clone.style.left = cardRect.left + 'px';
  clone.style.top = cardRect.top + 'px';
  clone.style.width = cardRect.width + 'px';
  clone.style.height = cardRect.height + 'px';
  clone.style.margin = '0';
  document.body.appendChild(clone);
  const trigger = () => {
    if (!clone.parentNode) return;
    clone.style.transition = 'transform 0.5s cubic-bezier(0.5, 0, 1, 0.5), opacity 0.45s ease-in 0.08s';
    const dx = (targetRect.left + targetRect.width/2) - (cardRect.left + cardRect.width/2);
    const dy = (targetRect.top + targetRect.height/2) - (cardRect.top + cardRect.height/2);
    clone.style.transform = `translate(${dx}px, ${dy}px) rotate(38deg) scale(0.35)`;
    clone.style.opacity = '0';
  };
  if (delayMs > 0) setTimeout(() => requestAnimationFrame(trigger), delayMs);
  else requestAnimationFrame(trigger);
  setTimeout(() => { if (clone.parentNode) clone.remove(); }, delayMs + 560);
}

function triggerReshuffleFx() {
  if (!deckPileBtn || !discardPileBtn) return;
  deckPileBtn.classList.add('reshuffle-flash');
  discardPileBtn.classList.add('reshuffle-flash');
  setTimeout(() => {
    deckPileBtn.classList.remove('reshuffle-flash');
    discardPileBtn.classList.remove('reshuffle-flash');
  }, 900);
  const dRect = discardPileBtn.getBoundingClientRect();
  const kRect = deckPileBtn.getBoundingClientRect();
  for (let i = 0; i < 6; i++) {
    setTimeout(() => spawnReshuffleFlyer(dRect, kRect), i * 70);
  }
}
function spawnReshuffleFlyer(fromRect, toRect) {
  const card = document.createElement('div');
  card.className = 'fly-card-reshuffle';
  const w = Math.min(40, fromRect.width * 0.65);
  const h = Math.min(56, fromRect.height * 0.6);
  card.style.left = (fromRect.left + (fromRect.width - w)/2) + 'px';
  card.style.top  = (fromRect.top + (fromRect.height - h)/2) + 'px';
  card.style.width = w + 'px';
  card.style.height = h + 'px';
  document.body.appendChild(card);
  requestAnimationFrame(() => {
    card.style.transition = 'transform 0.55s cubic-bezier(0.5, 0, 0.5, 1), opacity 0.5s ease-in 0.1s';
    const dx = (toRect.left + toRect.width/2) - (fromRect.left + fromRect.width/2);
    const dy = (toRect.top + toRect.height/2) - (fromRect.top + fromRect.height/2);
    card.style.transform = `translate(${dx}px, ${dy}px) rotate(-22deg) scale(0.7)`;
    card.style.opacity = '0';
  });
  setTimeout(() => { if (card.parentNode) card.remove(); }, 700);
}

/* ---------------------- INTERACCIÓN ---------------------- */
function onCardClick(index) {
  if (partida.phase !== 'PLAYER_TURN' || partida.inputLocked) return;
  if (index >= getMaxHand()) return;
  // Slot congelado por Brujo Glacial: no se puede jugar
  if (partida.frozenSlot === index) {
    setMessage('Esta carta está congelada este turno.');
    SFX.click();
    return;
  }
  const card = partida.hand[index];
  if (card == null) return;
  // Maldiciones: auto-descarta consumiendo 1⚡
  if (CARTAS[card] && CARTAS[card].curse) {
    autoDiscardCurse(index);
    return;
  }
  if (partida.energy < 1) {
    setMessage('Sin energía. Termina el turno o usa una poción.');
    return;
  }
  SFX.click();
  if (partida.selectedCardIndex === index) {
    partida.selectedCardIndex = null;
    partida.validTargets = [];
    setMessage('Carta deseleccionada.');
  } else {
    partida.selectedCardIndex = index;
    partida.hoveredCardIdx = null;
    partida.previewTargets = [];
    const def = CARTAS[card];
    partida.validTargets = getValidMoves(card, partida.hero.x, partida.hero.y);
    if (partida.validTargets.length === 0) {
      setMessage(`Sin movimientos válidos con ${def.name}.`);
    } else {
      setMessage(`Elige casilla para ${def.name}.`);
    }
  }
  pintar();
}

function onCellClick(x, y) {
  if (partida.phase === 'TELEPORT_TARGETING') {
    const valid = partida.validTargets.find(t => t.x === x && t.y === y);
    if (valid) executeTeleport(x, y);
    return;
  }
  if (partida.phase !== 'PLAYER_TURN' || partida.inputLocked) return;
  if (partida.selectedCardIndex === null) return;
  const target = partida.validTargets.find(t => t.x === x && t.y === y);
  if (!target) return;
  jugarCarta(partida.selectedCardIndex, x, y);
}

/* Una Pesadilla simplemente quema 1⚡ y se autodescarta */
async function autoDiscardCurse(slotIdx) {
  if (partida.energy < 1) {
    setMessage('Sin energía para limpiar la Pesadilla. Termina turno.');
    return;
  }
  partida.inputLocked = true;
  const cardEl = handEl.children[slotIdx];
  if (cardEl) animateCardToDiscard(cardEl);
  partida.discardPile.push(partida.hand[slotIdx]);
  partida.hand[slotIdx] = null;
  partida.energy -= 1;
  partida.chainCount += 1; // las maldiciones también cuentan para el combo
  setMessage('La Pesadilla se desvanece. ⚡−1');
  particleBurst(partida.hero.x, partida.hero.y, '#c084fc', '💀', 8, 28);
  SFX.click();
  pintar();
  await wait(280);
  partida.inputLocked = false;
  pintar();
}

function addCurse(reason = '') {
  partida.discardPile.push('NIGHTMARE');
  particleBurst(partida.hero.x, partida.hero.y, '#c084fc', '💀', 10, 32);
  floatText(partida.hero.x, partida.hero.y, '¡PESADILLA en el mazo!', '#c084fc', true);
  if (reason) setMessage(reason);
}

function golpearEnemigo(enemy, baseDmg, pierces) {
  if (baseDmg <= 0) {
    return { hpDmg: 0, armorAbsorbed: 0, killed: false, blocked: false };
  }
  if (pierces) {
    enemy.hp -= baseDmg;
    return { hpDmg: baseDmg, armorAbsorbed: 0, killed: enemy.hp <= 0, blocked: false };
  }
  const currentArmor = enemy.armor || 0;
  const absorbed = Math.min(baseDmg, currentArmor);
  enemy.armor = currentArmor - absorbed;
  const remaining = baseDmg - absorbed;
  if (remaining > 0) enemy.hp -= remaining;
  return {
    hpDmg: remaining,
    armorAbsorbed: absorbed,
    killed: enemy.hp <= 0,
    blocked: false
  };
}

function resolverAtaque(def, destX, destY, oldX, oldY, cardKey) {
  const result = { bounce: false, swapEnemyId: null, hits: [], killedAny: false };
  const baseDmg = cardKey ? effectiveCardDamage(cardKey, def) : def.damage;
  if (def.attackType === 'NONE' || baseDmg <= 0) return result;

  // La embestida del Toro tiene su propia resolución (empuje + posible ataque torre).
  if (def.attackType === 'CHARGE') {
    return resolverEmbestida(destX, destY, oldX, oldY, baseDmg, partida.chainCount >= 3);
  }

  let targets = [];
  switch (def.attackType) {
    case 'NORMAL':
    case 'PIERCE':
    case 'SWAP':
      targets = [{ x: destX, y: destY }];
      break;
    case 'FAN': {
      const dx = Math.sign(destX - oldX);
      const dy = Math.sign(destY - oldY);
      const tiles = [{ x: destX, y: destY }];
      if (dx !== 0 && dy === 0) {
        tiles.push({ x: destX + dx, y: destY - 1 });
        tiles.push({ x: destX + dx, y: destY + 1 });
      } else if (dy !== 0 && dx === 0) {
        tiles.push({ x: destX - 1, y: destY + dy });
        tiles.push({ x: destX + 1, y: destY + dy });
      } else if (dx !== 0 && dy !== 0) {
        tiles.push({ x: destX + dx, y: destY });
        tiles.push({ x: destX, y: destY + dy });
      }
      targets = tiles;
      break;
    }
    case 'AOE': {
      for (let dx=-1; dx<=1; dx++)
        for (let dy=-1; dy<=1; dy++)
          targets.push({ x: destX + dx, y: destY + dy });
      break;
    }
    case 'TEE': {
      // Ataque en T invertida: barra de 3 perpendicular al destino + tallo hacia delante.
      const dx = Math.sign(destX - oldX);
      const dy = Math.sign(destY - oldY);
      const tiles = [{ x: destX, y: destY }];
      if (dx !== 0 && dy === 0) {
        tiles.push({ x: destX, y: destY - 1 });
        tiles.push({ x: destX, y: destY + 1 });
        tiles.push({ x: destX + dx, y: destY });
      } else if (dy !== 0 && dx === 0) {
        tiles.push({ x: destX - 1, y: destY });
        tiles.push({ x: destX + 1, y: destY });
        tiles.push({ x: destX, y: destY + dy });
      }
      targets = tiles;
      break;
    }
  }

  // Combo: la 3ª carta del turno y siguientes traspasan armadura
  const pierces = def.attackType === 'PIERCE' || partida.chainCount >= 3;

  for (const t of targets) {
    if (!inBounds(t.x, t.y)) continue;
    const en = enemyAt(t.x, t.y);
    if (!en) continue;
    const r = golpearEnemigo(en, baseDmg, pierces);
    result.hits.push({
      x: t.x, y: t.y, enemy: en,
      hpDmg: r.hpDmg,
      armorAbsorbed: r.armorAbsorbed,
      killed: r.killed
    });
    if (r.killed) result.killedAny = true;
  }

  const destHit = result.hits.find(h => h.x === destX && h.y === destY);
  if (def.attackType === 'SWAP') {
    if (destHit && !destHit.killed) {
      if (destHit.enemy.type === 'BOSS') result.bounce = true;
      else result.swapEnemyId = destHit.enemy.id;
    }
  } else {
    if (destHit && !destHit.killed) result.bounce = true;
  }

  const killed = result.hits.filter(h => h.killed).map(h => h.enemy);
  if (killed.length > 0) {
    partida.enemies = partida.enemies.filter(e => !killed.includes(e));
    let skeletonDied = false;
    for (const e of killed) {
      processEnemyDeathRewards(e);
      if (e.type === 'SKELETON') skeletonDied = true;
    }
    if (skeletonDied) {
      for (const en of partida.enemies) {
        if (en.type === 'NECROMANCER') en.necroCooldown = 2;
      }
    }
  }
  return result;
}

/* Resolución de la carta Toro: embiste al enemigo, lo empuja y ocupa su casilla.
   Si no puede empujarlo recto (borde/obstáculo) lo desvía a un lado y añade un
   ataque de torre de alcance corto en la dirección de embestida. */
function resolverEmbestida(destX, destY, oldX, oldY, baseDmg, pierces) {
  const result = { bounce: false, swapEnemyId: null, hits: [], killedAny: false, charge: null };
  const dx = Math.sign(destX - oldX);
  const dy = Math.sign(destY - oldY);
  const target = enemyAt(destX, destY);
  if (!target || (dx === 0 && dy === 0)) { result.bounce = true; return result; }

  const cellFree = (x, y) =>
    inBounds(x, y) && !isVoid(x, y) && !enemyAt(x, y) && !isHeroAt(x, y);

  // 1) empuje recto en la dirección de embestida
  let pushTo = null, sideways = false;
  if (cellFree(destX + dx, destY + dy)) {
    pushTo = { x: destX + dx, y: destY + dy };
  } else {
    // 2) empuje lateral si el enemigo está contra un borde/obstáculo
    for (const [px, py] of [[dy, dx], [-dy, -dx]]) {
      if (cellFree(destX + px, destY + py)) {
        pushTo = { x: destX + px, y: destY + py };
        sideways = true;
        break;
      }
    }
  }

  // daño al enemigo embestido
  const r = golpearEnemigo(target, baseDmg, pierces);
  result.hits.push({ x: destX, y: destY, enemy: target,
    hpDmg: r.hpDmg, armorAbsorbed: r.armorAbsorbed, killed: r.killed });
  if (r.killed) result.killedAny = true;

  if (!r.killed) {
    if (pushTo) {
      target.x = pushTo.x;
      target.y = pushTo.y;
      result.charge = { id: target.id, sideways };
    } else {
      // el enemigo no se puede mover en ninguna dirección: la embestida rebota
      result.bounce = true;
    }
  }

  // 3) empuje lateral → ataque de torre de alcance corto (2 casillas)
  if (sideways) {
    for (let step = 1; step <= 2; step++) {
      const tx = destX + dx * step, ty = destY + dy * step;
      if (!inBounds(tx, ty) || isVoid(tx, ty)) break;
      const en = enemyAt(tx, ty);
      if (!en) continue;
      const rr = golpearEnemigo(en, baseDmg, pierces);
      result.hits.push({ x: tx, y: ty, enemy: en,
        hpDmg: rr.hpDmg, armorAbsorbed: rr.armorAbsorbed, killed: rr.killed });
      if (rr.killed) result.killedAny = true;
    }
  }

  // procesar muertes (recompensas + interacción Esqueleto/Nigromante)
  const killed = result.hits.filter(h => h.killed).map(h => h.enemy);
  if (killed.length > 0) {
    partida.enemies = partida.enemies.filter(e => !killed.includes(e));
    let skeletonDied = false;
    for (const e of killed) {
      processEnemyDeathRewards(e);
      if (e.type === 'SKELETON') skeletonDied = true;
    }
    if (skeletonDied) {
      for (const en of partida.enemies) {
        if (en.type === 'NECROMANCER') en.necroCooldown = 2;
      }
    }
  }
  return result;
}

async function jugarCarta(slotIdx, destX, destY) {
  const cardType = partida.hand[slotIdx];
  if (cardType == null) return;
  const def = CARTAS[cardType];

  // Snapshot ANTES de cualquier mutación para el botón Deshacer (1 uso/nivel)
  if (!partida.undoUsedThisLevel) {
    partida.undoSnapshot = snapshotState();
  }

  const oldX = partida.hero.x;
  const oldY = partida.hero.y;

  partida.inputLocked = true;
  partida.selectedCardIndex = null;
  partida.validTargets = [];
  partida.hoveredCardIdx = null;
  partida.previewTargets = [];
  partida.hoveredEnemyId = null;
  Tooltip.hide();

  const cardEl = handEl.children[slotIdx];
  if (cardEl) animateCardToDiscard(cardEl);

  partida.discardPile.push(cardType);
  partida.hand[slotIdx] = null;
  // Combo: incrementar contador ANTES de calcular daño
  partida.chainCount += 1;

  // Cantrip universal del bioma Magia: la primera carta del turno es gratis
  const magicFreebie = currentBiome() === 'MAGIC' && !partida.freeCantripUsedThisTurn;
  if (magicFreebie) {
    partida.freeCantripUsedThisTurn = true;
    floatText(destX, destY, '⚡ MAGIA', '#86efac');
  } else {
    partida.energy -= 1;
  }

  SFX.select();

  const pawnRelic = (cardType === 'PAWN' && hasRelic('AGGRESSIVE_PAWNS'));
  if (def.shield > 0 && !pawnRelic) {
    partida.hero.shield += def.shield;
    floatText(destX, destY, `+${def.shield} 🛡️`, '#60a5fa');
    particleBurst(destX, destY, '#60a5fa', '✦', 6, 24);
    flashChip('shield');
    SFX.shieldHit();
  }

  partida.hero.x = destX;
  partida.hero.y = destY;

  // Mostrar feedback de combo al llegar a la 3ª
  if (partida.chainCount === 3) {
    floatText(destX, destY, '¡COMBO x3! +2⚔ 🗡', '#fb923c', true);
    particleBurst(destX, destY, '#fb923c', '✦', 14, 42);
    flashChip('combo');
    SFX.chain();
  }

  pintar();

  await wait(SLIDE_MS + 20);

  const result = resolverAtaque(def, destX, destY, oldX, oldY, cardType);
  if (def.attackType === 'AOE') aoeRingAt(destX, destY);
  if (result.hits.length > 0) lungeHero();

  for (const hit of result.hits) {
    if (hit.armorAbsorbed > 0) {
      floatText(hit.x, hit.y, `-${hit.armorAbsorbed} 🛡`, '#60a5fa');
    }
    if (hit.hpDmg > 0) {
      const delay = hit.armorAbsorbed > 0 ? 90 : 0;
      deferFx(() => floatText(hit.x, hit.y, `-${hit.hpDmg} HP`, '#fb923c'), delay);
      slashAt(hit.x, hit.y);
      SFX.slash();
    }
  }

  // Hacha aplica veneno al objetivo principal
  if (cardType === 'AXE') {
    const main = result.hits.find(h => h.x === destX && h.y === destY);
    if (main && !main.killed) {
      main.enemy.poison = Math.max(main.enemy.poison || 0, 2);
      floatText(main.x, main.y, '☠ Veneno 2', '#22c55e');
    }
  }

  // La Araña enreda a los enemigos golpeados: pierden su próximo turno
  if (cardType === 'SPIDER') {
    for (const hit of result.hits) {
      if (hit.killed) continue;
      hit.enemy.frozenTurns = Math.max(hit.enemy.frozenTurns || 0, 1);
      const hx = hit.enemy.x, hy = hit.enemy.y;
      deferFx(() => {
        floatText(hx, hy, '🕸 Enredado', '#a78bfa');
        particleBurst(hx, hy, '#a78bfa', '✦', 6, 24);
      }, 120);
    }
  }

  // El Toro empuja: feedback visual sobre el enemigo desplazado
  if (cardType === 'BULL' && result.charge) {
    const pushed = partida.enemies.find(e => e.id === result.charge.id);
    if (pushed) {
      floatText(pushed.x, pushed.y, result.charge.sideways ? '¡DESVÍO!' : '¡EMBESTIDA!', '#f59e0b');
      particleBurst(pushed.x, pushed.y, '#f59e0b', '✦', 8, 30);
    }
  }

  // Daño elemental Hielo: al matar enemigos, congela al más cercano superviviente
  let frozenByBiome = null;
  if (result.killedAny && currentBiome() === 'ICE') {
    let nearest = null, nDist = Infinity;
    for (const en of partida.enemies) {
      const d = chebyshev(en, partida.hero);
      if (d < nDist) { nDist = d; nearest = en; }
    }
    if (nearest) {
      nearest.frozenTurns = (nearest.frozenTurns || 0) + 1;
      frozenByBiome = nearest;
      deferFx(() => {
        floatText(nearest.x, nearest.y, '❄ Congelado', '#7dd3fc');
        particleBurst(nearest.x, nearest.y, '#7dd3fc', '✦', 8, 28);
      }, 200);
    }
  }

  for (const hit of result.hits) {
    if (!hit.killed) continue;
    const isBoss = hit.enemy.type === 'BOSS';
    if (isBoss) {
      floatText(hit.x, hit.y, '¡ARCHIMAGO DERROTADO!', '#c084fc', true);
      particleBurst(hit.x, hit.y, '#c084fc', '✦', 22, 56);
      particleBurst(hit.x, hit.y, '#fbbf24', '✶', 14, 40);
      shakeBoard(true);
      SFX.death();
    } else {
      particleBurst(hit.x, hit.y, '#fb923c', '✸', 6, 28);
      SFX.death();
    }
    // Berserker élite: explosión 3×3 al morir
    if (hit.enemy.type === 'BERSERKER') {
      aoeRingAt(hit.x, hit.y);
      floatText(hit.x, hit.y, '¡EXPLOSIÓN!', '#ef4444', true);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const ex = hit.x + dx, ey = hit.y + dy;
          if (!inBounds(ex, ey)) continue;
          if (partida.hero.x === ex && partida.hero.y === ey) {
            golpearHeroe(1, hit.enemy, false);
          } else {
            const other = enemyAt(ex, ey);
            if (other) {
              const r = golpearEnemigo(other, 1, true);
              if (r.killed) {
                processEnemyDeathRewards(other);
                partida.enemies = partida.enemies.filter(e => e !== other);
                particleBurst(ex, ey, '#fb923c', '✸', 6, 24);
              }
            }
          }
        }
      }
    }
  }

  // Consumir el stack de venganza tras impactar
  if (partida.vengeance > 0 && hasRelic('BLOOD_FOR_BLOOD')) {
    partida.vengeance = Math.max(0, partida.vengeance - 1);
  }

  if (result.bounce) {
    partida.hero.x = oldX;
    partida.hero.y = oldY;
    shakeBoard(false);
  }
  if (result.swapEnemyId) {
    const swap = partida.enemies.find(e => e.id === result.swapEnemyId);
    if (swap) {
      swap.x = oldX; swap.y = oldY;
      particleBurst(destX, destY, '#a78bfa', '✶', 8, 28);
      particleBurst(oldX, oldY, '#a78bfa', '✶', 8, 28);
      floatText(destX, destY, '¡PERMUTA!', '#a78bfa');
    }
  }

  if (result.killedAny && def.cantrip) {
    const refund = Math.min(1, partida.maxEnergy - partida.energy);
    if (refund > 0) {
      partida.energy += refund;
      deferFx(() => {
        floatText(partida.hero.x, partida.hero.y, '¡CANTRIP! ⚡', '#fbbf24', true);
        particleBurst(partida.hero.x, partida.hero.y, '#fbbf24', '✦', 10, 36);
        flashChip('energy');
      }, 150);
    }
  }

  refrescarIntenciones();
  pintar();

  if (result.killedAny) {
    const names = result.hits.filter(h => h.killed).map(h => ENEMIGOS[h.enemy.type].name);
    setMessage(`¡Eliminado ${names.join(', ')}!`);
  } else if (result.bounce) {
    setMessage(`Golpe sin matar. Rebote a (${oldX},${oldY}).`);
  } else if (result.swapEnemyId) {
    setMessage('Permuta con el enemigo.');
  } else {
    setMessage(`Movimiento con ${def.name}.`);
  }

  const settle = result.bounce ? SLIDE_MS + 80 : (result.killedAny ? 280 : 130);
  await wait(settle);

  if (partida.enemies.length === 0) {
    partida.phase = 'LEVEL_CLEAR';
    partida.inputLocked = false;
    // Reward extra si el nivel era élite
    if (partida.nextLevelMode === 'elite' && partida.eliteRewardPending) {
      partida.gold += partida.eliteRewardPending;
      flashChip('gold');
      floatText(partida.hero.x, partida.hero.y, `+${partida.eliteRewardPending} 💰 ¡ÉLITE!`, '#fcd34d', true);
      partida.eliteRewardPending = 0;
    }
    partida.nextLevelMode = 'normal';
    pintar();
    await wait(380);
    if (partida.currentLevel >= FINAL_LEVEL) { SFX.victory(); showVictoryOverlay(); }
    else if (Math.random() < 0.34) showEventOverlay();
    else showChestOverlay();
    return;
  }

  if (!result.bounce) {
    const dx = Math.sign(destX - oldX);
    const dy = Math.sign(destY - oldY);
    await applyHazardsToHero(dx, dy);
  }

  if (partida.hero.hp <= 0) {
    partida.phase = 'GAME_OVER';
    partida.inputLocked = true;
    pintar();
    await wait(650);
    showGameOverOverlay();
    return;
  }

  partida.inputLocked = false;
  pintar();
}

async function applyHazardsToHero(dirX, dirY) {
  let safety = 8;
  while (safety-- > 0) {
    const h = hazardAt(partida.hero.x, partida.hero.y);
    if (!h) return;

    // Casilla de oro: el jugador recibe +2 💰 y la casilla desaparece
    if (h.type === 'GOLD') {
      partida.gold += 2;
      flashChip('gold');
      floatText(partida.hero.x, partida.hero.y, '+2 💰', '#fcd34d', true);
      particleBurst(partida.hero.x, partida.hero.y, '#fcd34d', '✦', 10, 32);
      SFX.gold();
      partida.hazards = partida.hazards.filter(x => x !== h);
      pintar();
      return;
    }
    // Tumba: cura 1 HP (max) y desaparece
    if (h.type === 'GRAVE') {
      if (partida.hero.hp < partida.hero.maxHp) {
        partida.hero.hp += 1;
        flashChip('hp');
        floatText(partida.hero.x, partida.hero.y, '+1 ❤️ tumba', '#22c55e', true);
        particleBurst(partida.hero.x, partida.hero.y, '#a3a3a3', '✦', 8, 28);
      } else {
        floatText(partida.hero.x, partida.hero.y, 'Tumba vacía', '#a3a3a3');
      }
      partida.hazards = partida.hazards.filter(x => x !== h);
      pintar();
      return;
    }

    if (h.type === 'SPIKES') {
      floatText(partida.hero.x, partida.hero.y, '¡PINCHOS!', '#f87171');
      particleBurst(partida.hero.x, partida.hero.y, '#f87171', '✸', 8, 28);
      golpearHeroe(1, null, false, true); 
      return;
    }

    if (h.type === 'TELEPORT') {
      const pair = teleportPartner(h);
      if (!pair) return;
      teleportRingAt(partida.hero.x, partida.hero.y);
      particleBurst(partida.hero.x, partida.hero.y, '#a78bfa', '✦', 10, 32);
      partida.hero.x = pair.x;
      partida.hero.y = pair.y;
      pintar();
      await wait(SLIDE_MS);
      teleportRingAt(pair.x, pair.y);
      particleBurst(pair.x, pair.y, '#a78bfa', '✦', 10, 32);
      floatText(pair.x, pair.y, '¡PORTAL!', '#a78bfa');
      refrescarIntenciones();
      pintar();
      dirX = 0; dirY = 0;
      return; 
    }

    if (h.type === 'ICE') {
      if (dirX === 0 && dirY === 0) return; 
      const nx = partida.hero.x + dirX;
      const ny = partida.hero.y + dirY;
      if (!isPassable(nx, ny) || enemyAt(nx, ny)) {
        floatText(partida.hero.x, partida.hero.y, '¡HIELO!', '#7dd3fc');
        return;
      }
      partida.hero.x = nx;
      partida.hero.y = ny;
      floatText(nx, ny, '↣', '#7dd3fc');
      pintar();
      await wait(Math.max(140, SLIDE_MS - 70));
      continue;
    }
    return;
  }
}

async function applyHazardsToEnemy(enemy, dirX, dirY) {
  let safety = 8;
  while (safety-- > 0) {
    if (!partida.enemies.includes(enemy)) return true;
    const h = hazardAt(enemy.x, enemy.y);
    if (!h) return false;

    if (h.type === 'SPIKES') {
      floatText(enemy.x, enemy.y, '¡PINCHOS!', '#f87171');
      particleBurst(enemy.x, enemy.y, '#f87171', '✸', 6, 24);
      enemy.hp -= 1;
      if (enemy.hp <= 0) {
        partida.enemies = partida.enemies.filter(e => e !== enemy);
        particleBurst(enemy.x, enemy.y, '#fb923c', '✸', 6, 28);
        processEnemyDeathRewards(enemy);
        pintar();
        return true;
      }
      pintar();
      return false;
    }

    if (h.type === 'TELEPORT') {
      const pair = teleportPartner(h);
      if (!pair) return false;
      if (isHeroAt(pair.x, pair.y) || partida.enemies.find(e => e !== enemy && e.x === pair.x && e.y === pair.y)) return false;
      teleportRingAt(enemy.x, enemy.y);
      enemy.x = pair.x; enemy.y = pair.y;
      pintar();
      await wait(SLIDE_MS);
      teleportRingAt(pair.x, pair.y);
      dirX = 0; dirY = 0;
      return false;
    }

    if (h.type === 'ICE') {
      if (dirX === 0 && dirY === 0) return false;
      const nx = enemy.x + dirX, ny = enemy.y + dirY;
      if (!isPassable(nx, ny)) return false;
      if (isHeroAt(nx, ny)) return false;
      if (partida.enemies.find(e => e !== enemy && e.x === nx && e.y === ny)) return false;
      enemy.x = nx; enemy.y = ny;
      pintar();
      await wait(Math.max(120, SLIDE_MS - 90));
      continue;
    }
    return false;
  }
  return false;
}

function effectiveCardDamage(cardKey, def) {
  let dmg = def.damage;
  if (cardKey === 'PAWN' && hasRelic('AGGRESSIVE_PAWNS')) dmg += 1;
  // Combo: la 3ª carta o más del turno hace +2 daño y pierce
  if (partida.chainCount >= 3) dmg += 2;
  // Sangre por Sangre: el stack de venganza se consume al jugar la siguiente carta
  if (hasRelic('BLOOD_FOR_BLOOD') && partida.vengeance > 0) dmg += 1;
  // Daño elemental cueva: 20% chance de +1
  if (currentBiome() === 'CAVE' && Math.random() < 0.20) dmg += 1;
  return dmg;
}
function currentBiome() {
  return partida.currentBiome || 'NORMAL';
}

/* ---------------------- POCIONES ---------------------- */
function onPotionSlotClick(slot) {
  if (partida.phase === 'TELEPORT_TARGETING') {
    if (partida.selectedPotionSlot === slot) cancelTeleport();
    return;
  }
  if (partida.phase !== 'PLAYER_TURN' || partida.inputLocked) return;
  if (slot >= partida.potions.length) return;
  usePotion(slot);
}

function usePotion(slot) {
  const type = partida.potions[slot];
  const def = POCIONES[type];

  if (type === 'TELEPORT') {
    partida.selectedCardIndex = null;
    partida.validTargets = computeTeleportTargets();
    partida.selectedPotionSlot = slot;
    partida.phase = 'TELEPORT_TARGETING';
    setMessage('Elige una casilla vacía para teletransportarte.');
    pintar();
    return;
  }

  if (type === 'LIFE') {
    if (partida.hero.hp >= partida.hero.maxHp) { setMessage('Tu vida ya está al máximo.'); return; }
    partida.hero.hp += 1;
    floatText(partida.hero.x, partida.hero.y, '+1 ❤️', '#ef4444');
    particleBurst(partida.hero.x, partida.hero.y, '#ef4444', '❤', 8, 32);
    flashChip('hp');
  } else if (type === 'SHIELD') {
    partida.hero.shield += 4;
    floatText(partida.hero.x, partida.hero.y, '+4 🛡️', '#60a5fa');
    particleBurst(partida.hero.x, partida.hero.y, '#60a5fa', '✦', 10, 32);
    flashChip('shield');
  } else if (type === 'ENERGY') {
    partida.energy += 1;
    floatText(partida.hero.x, partida.hero.y, '+1 ⚡', '#fbbf24');
    particleBurst(partida.hero.x, partida.hero.y, '#fbbf24', '⚡', 8, 32);
    flashChip('energy');
  } else if (type === 'THORNS') {
    partida.hero.thorns = true;
    floatText(partida.hero.x, partida.hero.y, '¡ESPINAS!', '#22c55e');
    particleBurst(partida.hero.x, partida.hero.y, '#22c55e', '✿', 12, 36);
  } else if (type === 'DISCARD') {
    const max = getMaxHand();
    let discardedCount = 0;
    
    // Primero, animar y descartar
    for (let i = 0; i < max; i++) {
      if (partida.hand[i] != null) {
        const cardEl = handEl.children[i];
        if (cardEl) animateCardToDiscard(cardEl);
        partida.discardPile.push(partida.hand[i]);
        partida.hand[i] = null;
        discardedCount++;
      }
    }
    
    // Segundo, robar la misma cantidad exacta
    for (let i = 0; i < max; i++) {
      if (discardedCount > 0 && partida.hand[i] == null) {
        drawOneIntoSlot(i);
        discardedCount--;
      }
    }
    floatText(partida.hero.x, partida.hero.y, '¡CICLADO! 🔄', '#f472b6', true);
    particleBurst(partida.hero.x, partida.hero.y, '#f472b6', '🔄', 10, 36);
  }

  partida.potions.splice(slot, 1);
  setMessage(`Has usado ${def.name}.`);
  pintar();
}

function computeTeleportTargets() {
  const tiles = [];
  for (let x=0; x<BOARD_SIZE; x++)
    for (let y=0; y<BOARD_SIZE; y++) {
      if (!isPassable(x, y)) continue;
      if (isHeroAt(x, y)) continue;
      if (enemyAt(x, y)) continue;
      tiles.push({ x, y });
    }
  return tiles;
}
async function executeTeleport(x, y) {
  const slot = partida.selectedPotionSlot;
  if (slot == null) return;
  partida.potions.splice(slot, 1);
  particleBurst(partida.hero.x, partida.hero.y, '#a78bfa', '✦', 12, 40);
  teleportRingAt(partida.hero.x, partida.hero.y);
  partida.hero.x = x; partida.hero.y = y;
  setTimeout(() => {
    particleBurst(x, y, '#a78bfa', '✦', 12, 40);
    teleportRingAt(x, y);
    floatText(x, y, '¡TELEPORT!', '#a78bfa', true);
  }, 60);
  partida.phase = 'PLAYER_TURN';
  partida.validTargets = [];
  partida.selectedPotionSlot = null;
  refrescarIntenciones();
  setMessage('Te has teletransportado.');
  pintar();

  // Al aterrizar aplicamos peligros (pinchos, portal). El hielo no resbala:
  // no hay dirección de entrada, caes en seco.
  if (hazardAt(partida.hero.x, partida.hero.y)) {
    partida.inputLocked = true;
    pintar();
    await wait(SLIDE_MS);
    await applyHazardsToHero(0, 0);
    if (partida.hero.hp <= 0) {
      partida.phase = 'GAME_OVER';
      pintar();
      await wait(650);
      showGameOverOverlay();
      return;
    }
    partida.inputLocked = false;
    refrescarIntenciones();
    pintar();
  }
}
function cancelTeleport() {
  partida.phase = 'PLAYER_TURN';
  partida.validTargets = [];
  partida.selectedPotionSlot = null;
  setMessage('Teletransporte cancelado.');
  pintar();
}

/* ---------------------- TURNO ENEMIGO ---------------------- */
async function terminarTurno() {
  if (partida.phase !== 'PLAYER_TURN' || partida.inputLocked) return;
  SFX.click();
  // Reset de combos al cerrar turno (mecánica EVO)
  partida.chainCount = 0;
  partida.cardsPlayedThisTurn = 0;

  if (isCorrupted(partida.hero.x, partida.hero.y)) {
    if (hasRelic('PURIFIER')) {
      const healed = partida.hero.hp < partida.hero.maxHp;
      if (healed) {
        partida.hero.hp += 1;
        flashChip('hp');
        floatText(partida.hero.x, partida.hero.y, '✨ PURIFICADO +1 ❤️', '#22c55e', true);
      } else {
        floatText(partida.hero.x, partida.hero.y, '✨ PURIFICADO', '#22c55e', true);
      }
      particleBurst(partida.hero.x, partida.hero.y, '#22c55e', '✦', 10, 32);
    } else {
      floatText(partida.hero.x, partida.hero.y, '¡CORRUPCIÓN!', '#c084fc', true);
      particleBurst(partida.hero.x, partida.hero.y, '#c084fc', '🔥', 8, 30);
      golpearHeroe(1);
      if (partida.hero.hp <= 0) {
        partida.phase = 'GAME_OVER';
        partida.inputLocked = true;
        pintar();
        await wait(700);
        showGameOverOverlay();
        return;
      }
    }
  }

  partida.phase = 'ENEMY_TURN';
  partida.inputLocked = true;
  partida.selectedCardIndex = null;
  partida.validTargets = [];
  partida.hoveredCardIdx = null;
  partida.previewTargets = [];
  partida.hoveredEnemyId = null;
  Tooltip.hide();

  const max = getMaxHand();
  // Capturamos los clones ya: el pintar() de abajo quita las cartas de la mano.
  let staggerIdx = 0;
  for (let i = 0; i < max; i++) {
    if (partida.hand[i] != null) {
      const cardEl = handEl.children[i];
      if (cardEl) animateCardToDiscard(cardEl, staggerIdx * 70);
      staggerIdx++;
    }
  }
  for (let i = 0; i < max; i++) {
    if (partida.hand[i] != null) {
      partida.discardPile.push(partida.hand[i]);
      partida.hand[i] = null;
    }
  }
  prevHandSnapshot = new Array(max).fill(null);

  setMessage('Turno del enemigo…');
  pintar();
  await wait(450);
  await ejecutarTurnoEnemigo();
}

async function ejecutarTurnoEnemigo() {
  const boss = partida.enemies.find(e => e.type === 'BOSS');
  if (boss) {
    bossCorruptTiles();
    const totalEnemies = partida.enemies.length;
    if (totalEnemies < BOSS_SUMMON_THRESHOLD) {
      for (let i = 0; i < 2; i++) bossSummon();
    }
    // El Archimago puede inyectar una Pesadilla cuando le quedan pocos HP
    if (boss.hp <= Math.ceil(boss.maxHp * 0.4) && Math.random() < 0.5) {
      addCurse('El Archimago siembra una Pesadilla en tu mazo.');
    }
    refrescarIntenciones();
    pintar();
    await wait(700);
  }
  // Élite Tejedor de Trampas: intercambia 2 hazards al inicio del turno enemigo
  const weaver = partida.enemies.find(e => e.type === 'WEAVER');
  if (weaver && partida.hazards.length >= 2) {
    const haz = [...partida.hazards];
    shuffle(haz);
    const a = haz[0], b = haz[1];
    const ax = a.x, ay = a.y;
    a.x = b.x; a.y = b.y;
    b.x = ax; b.y = ay;
    floatText(weaver.x, weaver.y, '🕸 ¡Trampas movidas!', '#a78bfa', true);
    particleBurst(a.x, a.y, '#a78bfa', '✦', 6, 24);
    particleBurst(b.x, b.y, '#a78bfa', '✦', 6, 24);
    pintar();
    await wait(450);
  }
  // Élite Veterano: regenera 1 armadura
  for (const veteran of partida.enemies.filter(e => e.type === 'VETERAN')) {
    veteran.armor = (veteran.armor || 0) + 1;
    floatText(veteran.x, veteran.y, '+1 🛡', '#60a5fa');
  }
  // Nigromante puede inyectar Pesadilla raramente
  const necro = partida.enemies.find(e => e.type === 'NECROMANCER');
  if (necro && Math.random() < 0.10) {
    addCurse('El Nigromante invoca una Pesadilla en tu mazo.');
  }
  refrescarIntenciones();
  pintar();
  await seguirTurnoEnemigo();
}

/* Aplica el tick de veneno a todos los enemigos envenenados al final del turno enemigo.
   El veneno traspasa armadura y reduce el contador. */
async function applyPoisonTick() {
  const poisoned = partida.enemies.filter(e => (e.poison || 0) > 0);
  if (poisoned.length === 0) return;
  for (const en of poisoned) {
    en.hp -= 1;
    en.poison -= 1;
    floatText(en.x, en.y, '☠ -1', '#22c55e');
    particleBurst(en.x, en.y, '#22c55e', '✿', 4, 18);
  }
  // Limpiar muertos por veneno
  const survivors = [];
  for (const en of partida.enemies) {
    if (en.hp <= 0) {
      processEnemyDeathRewards(en);
      particleBurst(en.x, en.y, '#22c55e', '✶', 6, 24);
    } else survivors.push(en);
  }
  partida.enemies = survivors;
  pintar();
  await wait(420);
}

function bossCorruptTiles() {
  partida.corruptedTiles = [];
  const candidates = [];
  for (let x=0; x<BOARD_SIZE; x++)
    for (let y=0; y<BOARD_SIZE; y++) {
      if (isVoid(x, y)) continue;
      if (isHeroAt(x, y)) continue; // no corrompemos la casilla donde está el héroe
      candidates.push({ x, y });
    }
  shuffle(candidates);
  for (let i = 0; i < BOSS_CORRUPT_TILES && i < candidates.length; i++) {
    const c = candidates[i];
    partida.corruptedTiles.push(c);
    particleBurst(c.x, c.y, '#c084fc', '🔥', 8, 28);
  }
  if (partida.corruptedTiles.length > 0) {
    floatText(2, 2, '¡CORRUPCIÓN!', '#c084fc', true);
  }
}

function bossSummon() {
  const candidates = [];
  for (let x=0; x<BOARD_SIZE; x++)
    for (let y=0; y<BOARD_SIZE; y++) {
      if (!isPassable(x, y)) continue;
      if (isHeroAt(x, y)) continue;
      if (enemyAt(x, y)) continue;
      candidates.push({ x, y });
    }
  if (candidates.length === 0) return false;
  const pos = candidates[Math.floor(Math.random() * candidates.length)];
  const r = Math.random();
  let type;
  if (r < 0.30) type = 'GOBLIN';
  else if (r < 0.55) type = 'ARCHER';
  else if (r < 0.75) type = 'GOLEM';
  else if (r < 0.90) type = 'BAT';
  else type = 'ASSASSIN';
  spawnEnemy(type, pos.x, pos.y);
  particleBurst(pos.x, pos.y, '#c084fc', '✦', 12, 36);
  floatText(pos.x, pos.y, `¡${ENEMIGOS[type].name}!`, '#c084fc');
  return true;
}

// Orco, gólem, berserker y veterano se comportan igual: si están pegados al
// héroe le machacan el 3x3; si no, se acercan un paso.
async function atacanteAreaCuerpoACuerpo(enemy, prevX, prevY) {
  if (chebyshev(enemy, partida.hero) === 1) {
    let acierta = false;
    for (const tile of enemy.intent) {
      flashCell(tile.x, tile.y);
      if (tile.x === partida.hero.x && tile.y === partida.hero.y) acierta = true;
    }
    if (acierta) golpearHeroe(1, enemy, true);
    pintar();
    await wait(320);
    return;
  }
  const dest = destinoComprometido(enemy, e => preverPasoRey(e, 1));
  if (dest) { enemy.x = dest.x; enemy.y = dest.y; }
  refrescarIntenciones(); pintar();
  await wait(280);
  await postMoveHazards(enemy, prevX, prevY);
}

async function seguirTurnoEnemigo() {
  const order = [...partida.enemies];
  // Congelar el telegrama de intención: cada enemigo de paso simple ejecutará
  // exactamente la casilla que se mostró al jugador en su turno.
  for (const e of partida.enemies) {
    e._committedMove = (e.intent && e.intent.length === 1)
      ? { x: e.intent[0].x, y: e.intent[0].y }
      : null;
  }
  for (const enemy of order) {
    if (partida.hero.hp <= 0) break;
    if (!partida.enemies.includes(enemy)) continue;

    // Daño elemental Hielo: enemigo congelado salta su turno
    if ((enemy.frozenTurns || 0) > 0) {
      enemy.frozenTurns -= 1;
      floatText(enemy.x, enemy.y, '❄ Salta turno', '#7dd3fc');
      pintar();
      await wait(180);
      continue;
    }

    const prevX = enemy.x, prevY = enemy.y;

    if (enemy.type === 'GOBLIN') {
      const dest = destinoComprometido(enemy, preverGoblin);
      if (dest) {
        if (dest.x === partida.hero.x && dest.y === partida.hero.y) {
          flashCell(dest.x, dest.y);
          golpearHeroe(1, enemy, true);
        } else { enemy.x = dest.x; enemy.y = dest.y; }
      }
      refrescarIntenciones(); pintar();
      await wait(260);
      await postMoveHazards(enemy, prevX, prevY);

    } else if (enemy.type === 'BAT') {
      const dest = destinoComprometido(enemy, preverMurcielago);
      if (dest) {
        if (dest.x === partida.hero.x && dest.y === partida.hero.y) {
          flashCell(dest.x, dest.y);
          golpearHeroe(1, enemy, true);
          enemy.hp += 1;
          if (enemy.hp > enemy.maxHp) enemy.maxHp = enemy.hp;
          floatText(enemy.x, enemy.y, '+1 ❤️', '#ef4444');
          particleBurst(enemy.x, enemy.y, '#ef4444', '❤', 6, 26);
        } else { enemy.x = dest.x; enemy.y = dest.y; }
      }
      refrescarIntenciones(); pintar();
      await wait(280);
      await postMoveHazards(enemy, prevX, prevY);

    } else if (enemy.type === 'ORC' || enemy.type === 'GOLEM'
            || enemy.type === 'BERSERKER' || enemy.type === 'VETERAN') {
      await atacanteAreaCuerpoACuerpo(enemy, prevX, prevY);

    } else if (enemy.type === 'ARCHER') {
      let didHit = false;
      for (const tile of enemy.intent) {
        if (tile.x === partida.hero.x && tile.y === partida.hero.y) {
          flashCell(tile.x, tile.y); didHit = true;
        }
      }
      if (didHit) golpearHeroe(1, enemy, false);
      pintar();
      await wait(280);

    } else if (enemy.type === 'ASSASSIN') {
      const dest = destinoComprometido(enemy, preverAsesino);
      if (dest) {
        if (dest.x === partida.hero.x && dest.y === partida.hero.y) {
          flashCell(dest.x, dest.y);
          golpearHeroe(1, enemy, true, true);
          floatText(partida.hero.x, partida.hero.y, '¡IGNORA 🛡!', '#a855f7');
        } else { enemy.x = dest.x; enemy.y = dest.y; }
      }
      refrescarIntenciones(); pintar();
      await wait(280);
      await postMoveHazards(enemy, prevX, prevY);

    } else if (enemy.type === 'SHAMAN') {
      let buffedAny = false;
      for (let dx=-1; dx<=1; dx++)
        for (let dy=-1; dy<=1; dy++) {
          if (dx===0 && dy===0) continue;
          const x = enemy.x + dx, y = enemy.y + dy;
          const ally = enemyAt(x, y);
          if (!ally || ally === enemy) continue;
          if (ally.type === 'BOSS') continue;
          if (ally.hp < ally.maxHp) ally.hp = Math.min(ally.hp + 1, ally.maxHp);
          else { ally.hp += 1; ally.maxHp = ally.hp; }
          ally.armor = (ally.armor || 0) + 1;
          ally.buffed = (ally.buffed || 0) + 1;
          buffedAny = true;
          beamTrail(enemy.x, enemy.y, ally.x, ally.y, '#22c55e', 4);
          setTimeout(() => {
            floatText(ally.x, ally.y, '+1 ❤️ +1 🛡', '#22c55e');
            particleBurst(ally.x, ally.y, '#22c55e', '✦', 6, 26);
            pintar();
          }, 280);
        }
      if (buffedAny) setMessage('El Chamán refuerza a sus aliados.');
      pintar();
      await wait(460);

    } else if (enemy.type === 'NECROMANCER') {
      const skeletons = partida.enemies.filter(e => e.type === 'SKELETON');
      if (skeletons.length >= 2) {
        for (const sk of skeletons) {
          sk.bonusDamage = (sk.bonusDamage || 0) + 1;
          beamTrail(enemy.x, enemy.y, sk.x, sk.y, '#a855f7', 5);
          const sx = sk.x, sy = sk.y;
          setTimeout(() => {
            floatText(sx, sy, '+1 ⚔ NIGROMANCIA', '#a855f7');
            particleBurst(sx, sy, '#a855f7', '✦', 10, 32);
            particleBurst(sx, sy, '#7c3aed', '✶', 6, 22);
            pintar();
          }, 320);
        }
        setMessage('El Nigromante imbuye energía oscura a sus esqueletos.');
        pintar();
        await wait(560);
      } else if ((enemy.necroCooldown || 0) === 0) {
        const adj = [];
        for (let dx=-1; dx<=1; dx++)
          for (let dy=-1; dy<=1; dy++) {
            if (dx===0 && dy===0) continue;
            const x = enemy.x + dx, y = enemy.y + dy;
            if (!isPassable(x, y)) continue;
            if (isHeroAt(x, y)) continue;
            if (enemyAt(x, y)) continue;
            adj.push({ x, y });
          }
        if (adj.length > 0) {
          shuffle(adj);
          const pos = adj[0];
          spawnEnemy('SKELETON', pos.x, pos.y);
          particleBurst(pos.x, pos.y, '#a855f7', '✦', 12, 34);
          floatText(pos.x, pos.y, '¡Esqueleto!', '#a855f7');
          setMessage('El Nigromante invoca un Esqueleto.');
        } else {
          const dest = preverPasoRey(enemy, 3);
          if (dest) { enemy.x = dest.x; enemy.y = dest.y; }
        }
        refrescarIntenciones(); pintar();
        await wait(380);
        await postMoveHazards(enemy, prevX, prevY);
      } else {
        enemy.necroCooldown = Math.max(0, (enemy.necroCooldown || 0) - 1);
        const dest = preverPasoRey(enemy, 3);
        if (dest && !(dest.x === partida.hero.x && dest.y === partida.hero.y)) {
          enemy.x = dest.x; enemy.y = dest.y;
        }
        floatText(enemy.x, enemy.y, `🕒 ${enemy.necroCooldown}`, '#a855f7');
        refrescarIntenciones(); pintar();
        await wait(280);
        await postMoveHazards(enemy, prevX, prevY);
      }

    } else if (enemy.type === 'SKELETON') {
      const dest = destinoComprometido(enemy, e => preverPasoRey(e, 1));
      if (dest) {
        if (dest.x === partida.hero.x && dest.y === partida.hero.y) {
          flashCell(dest.x, dest.y);
          const dmg = 1 + (enemy.bonusDamage || 0);
          golpearHeroe(dmg, enemy, true);
        } else {
          enemy.x = dest.x; enemy.y = dest.y;
        }
      }
      refrescarIntenciones(); pintar();
      await wait(260);
      await postMoveHazards(enemy, prevX, prevY);

    } else if (enemy.type === 'BOSS') {
      const dest = preverJefe(enemy);
      let moved = false;
      if (dest && (dest.x !== enemy.x || dest.y !== enemy.y)) {
        enemy.x = dest.x; enemy.y = dest.y;
        moved = true; refrescarIntenciones(); pintar();
      }
      await wait(moved ? SLIDE_MS + 40 : 100);
      if (enemy.x === partida.hero.x || enemy.y === partida.hero.y) {
        if (enemy.x === partida.hero.x) {
          for (let yy = 0; yy < BOARD_SIZE; yy++) if (isPassable(enemy.x, yy)) flashCell(enemy.x, yy, 'beam-flash');
        }
        if (enemy.y === partida.hero.y) {
          for (let xx = 0; xx < BOARD_SIZE; xx++) if (isPassable(xx, enemy.y)) flashCell(xx, enemy.y, 'beam-flash');
        }
        await wait(340);
        golpearHeroe(1, enemy, false);
      }

    } else if (enemy.type === 'GLACIAL_WARLOCK') {
      // Se queda en posición y a distancia 2 lanza hielo
      if (chebyshev(enemy, partida.hero) <= 2) {
        flashCell(partida.hero.x, partida.hero.y, 'beam-flash');
        await wait(280);
        golpearHeroe(1, enemy, false);
      } else {
        const dest = preverPasoRey(enemy, 2);
        if (dest) { enemy.x = dest.x; enemy.y = dest.y; }
        refrescarIntenciones(); pintar();
        await wait(260);
        await postMoveHazards(enemy, prevX, prevY);
      }

    } else if (enemy.type === 'WEAVER') {
      // Ya intercambió hazards al principio. Aquí solo se acerca con paso de rey.
      const dest = destinoComprometido(enemy, e => preverPasoRey(e, 2));
      if (dest) { enemy.x = dest.x; enemy.y = dest.y; }
      refrescarIntenciones(); pintar();
      await wait(260);
      await postMoveHazards(enemy, prevX, prevY);

    }
  }
  await applyPoisonTick();
  await wait(380);
  acabarTurnoEnemigo();
}

async function postMoveHazards(enemy, prevX, prevY) {
  if (!partida.enemies.includes(enemy)) return;
  const dx = Math.sign(enemy.x - prevX);
  const dy = Math.sign(enemy.y - prevY);
  if (dx === 0 && dy === 0 && !hazardAt(enemy.x, enemy.y)) return;
  await applyHazardsToEnemy(enemy, dx, dy);
  refrescarIntenciones();
  pintar();
}

function acabarTurnoEnemigo() {
  partida.hero.thorns = false;
  if (partida.hero.hp <= 0) {
    partida.phase = 'GAME_OVER';
    partida.inputLocked = false;
    pintar();
    setTimeout(showGameOverOverlay, 650);
    return;
  }

  // El veneno o los pinchos pueden haber matado al último enemigo: nivel superado.
  if (partida.enemies.length === 0) {
    partida.phase = 'LEVEL_CLEAR';
    partida.inputLocked = false;
    if (partida.nextLevelMode === 'elite' && partida.eliteRewardPending) {
      partida.gold += partida.eliteRewardPending;
      flashChip('gold');
      floatText(partida.hero.x, partida.hero.y, `+${partida.eliteRewardPending} 💰 ¡ÉLITE!`, '#fcd34d', true);
      partida.eliteRewardPending = 0;
    }
    partida.nextLevelMode = 'normal';
    pintar();
    setTimeout(() => {
      if (partida.currentLevel >= FINAL_LEVEL) { SFX.victory(); showVictoryOverlay(); }
      else if (Math.random() < 0.34) showEventOverlay();
      else showChestOverlay();
    }, 380);
    return;
  }

  setTimeout(empezarTurnoJugador, 380);
}

function golpearHeroe(amount, attacker = null, melee = false, bypassShield = false) {
  const original = amount;
  if (partida.hero.thorns && attacker && melee && original > 0) {
    const r = golpearEnemigo(attacker, 1, false);
    if (r.armorAbsorbed > 0) floatText(attacker.x, attacker.y, `-${r.armorAbsorbed} 🛡`, '#22c55e');
    if (r.hpDmg > 0) floatText(attacker.x, attacker.y, `-${r.hpDmg} 🌵`, '#22c55e');
    particleBurst(attacker.x, attacker.y, '#22c55e', '✿', 6, 26);
    if (r.killed) {
      processEnemyDeathRewards(attacker);
      partida.enemies = partida.enemies.filter(e => e !== attacker);
      particleBurst(attacker.x, attacker.y, '#22c55e', '✶', 8, 30);
    }
  }
  if (!bypassShield && partida.hero.shield > 0 && amount > 0) {
    const absorbed = Math.min(partida.hero.shield, amount);
    partida.hero.shield -= absorbed;
    amount -= absorbed;
    floatText(partida.hero.x, partida.hero.y, `-${absorbed} 🛡️`, '#60a5fa');
    flashChip('shield');
    SFX.shieldHit();
  }
  if (amount > 0) {
    partida.hero.hp = Math.max(0, partida.hero.hp - amount);
    floatText(partida.hero.x, partida.hero.y, `-${amount} ❤️`, '#ef4444', true);
    impactHero();
    shakeBoard(true);
    flashChip('hp');
    SFX.hurt();
    // Reliquia Sangre por Sangre: cada punto de HP perdido carga +1 daño próximo
    if (hasRelic('BLOOD_FOR_BLOOD')) {
      partida.vengeance = Math.min(partida.vengeance + amount, 3);
      floatText(partida.hero.x, partida.hero.y, `🩸 Venganza +${amount}`, '#dc2626');
      flashChip('vengeance');
    }
  } else if (original > 0) {
    shakeBoard(false);
  }
  pintar();
}

// Deshacer: un uso por nivel.
function snapshotState() {
  const data = {
    hero: partida.hero,
    enemies: partida.enemies,
    hand: partida.hand,
    deck: partida.deck,
    discardPile: partida.discardPile,
    energy: partida.energy,
    chainCount: partida.chainCount,
    vengeance: partida.vengeance,
    freeCantripUsedThisTurn: partida.freeCantripUsedThisTurn,
    corruptedTiles: partida.corruptedTiles,
    hazards: partida.hazards,
    gold: partida.gold
  };
  // structuredClone si existe; si no, el truco de JSON.
  return (typeof structuredClone === 'function')
    ? structuredClone(data)
    : JSON.parse(JSON.stringify(data));
}
function undoLastCard() {
  if (!partida.undoSnapshot) {
    setMessage('Nada que deshacer.');
    return;
  }
  if (partida.undoUsedThisLevel) {
    setMessage('Ya usaste el Deshacer este nivel.');
    return;
  }
  if (partida.phase !== 'PLAYER_TURN' || partida.inputLocked) {
    setMessage('No puedes deshacer ahora.');
    return;
  }
  const snap = partida.undoSnapshot;
  Object.assign(partida.hero, snap.hero);
  partida.enemies = snap.enemies;
  partida.hand = snap.hand;
  partida.deck = snap.deck;
  partida.discardPile = snap.discardPile;
  partida.energy = snap.energy;
  partida.chainCount = snap.chainCount;
  partida.vengeance = snap.vengeance;
  partida.freeCantripUsedThisTurn = snap.freeCantripUsedThisTurn;
  partida.corruptedTiles = snap.corruptedTiles;
  partida.hazards = snap.hazards;
  partida.gold = snap.gold;
  partida.undoSnapshot = null;
  partida.undoUsedThisLevel = true;
  partida.selectedCardIndex = null;
  partida.validTargets = [];
  // Reconstruir piezas desde cero
  pieceLayer.innerHTML = '';
  pieceNodes.clear();
  refrescarIntenciones();
  SFX.teleport();
  floatText(partida.hero.x, partida.hero.y, '⟲ DESHECHO', '#fbbf24', true);
  setMessage('Última carta deshecha. (Único uso del nivel)');
  pintar();
}

function empezarTurnoJugador() {
  partida.phase = 'PLAYER_TURN';
  partida.inputLocked = false;
  partida.energy = partida.maxEnergy || MAX_ENERGY;
  partida.hero.shield = partida._permShield || 0;
  if ((partida._permShield || 0) > 0) {
    floatText(partida.hero.x, partida.hero.y, `+${partida._permShield} 🛡️`, '#60a5fa');
  }
  // Reset de mecánicas EVO al iniciar el turno
  partida.chainCount = 0;
  partida.freeCantripUsedThisTurn = false;
  partida.frozenSlot = null;

  prevHandSnapshot = [...partida.hand];
  drawHand();
  SFX.draw();

  // Élite Brujo Glacial: congela un slot al azar al inicio del turno
  const glacial = partida.enemies.find(e => e.type === 'GLACIAL_WARLOCK');
  if (glacial) {
    const max = getMaxHand();
    const candidates = [];
    for (let i = 0; i < max; i++) if (partida.hand[i] != null) candidates.push(i);
    if (candidates.length > 0) {
      partida.frozenSlot = candidates[Math.floor(Math.random() * candidates.length)];
      setTimeout(() => {
        floatText(partida.hero.x, partida.hero.y, '❄ Carta congelada', '#7dd3fc', true);
      }, 300);
    }
  }

  refrescarIntenciones();
  setMessage('Tu turno. Selecciona una carta o una poción.');
  pintar();
}

/* ---------------------- MODAL ---------------------- */
function showPileModal(title, pile) {
  pileModalTitle.textContent = title;
  if (pile.length === 0) {
    pileModalContent.innerHTML = '<div class="text-slate-400 text-center py-6">Vacío</div>';
    pileModal.classList.remove('hidden');
    pileModal.classList.add('show');
    return;
  }
  const counts = {};
  for (const c of pile) counts[c] = (counts[c] || 0) + 1;
  const order = ['PAWN','KNIGHT','BISHOP','ROOK','AXE','BOMBER','SPIDER','BULL','SHIELDC','KING','OWL','DRAGON','QUEEN','WILDCARD'];
  const parts = order.filter(t => counts[t]).map(t => {
    const def = CARTAS[t];
    const n = counts[t];
    return `${n} ${n > 1 ? def.plural : def.name}`;
  });
  const lblLower = title.replace(/[🃏🗑]/g, '').replace(/\(\d+\)/, '').trim().toLowerCase();
  pileModalContent.innerHTML = `
    <div class="pile-summary">
      Tu <strong>${lblLower}</strong> contiene: ${parts.join(', ')}.
    </div>
    <div class="space-y-2">
      ${order.filter(t => counts[t]).map(t => {
        const def = CARTAS[t];
        return `<div class="pile-row rarity-${def.rarity || 'common'}">
          <span class="pile-icon">${def.icon}</span>
          <div>
            <div class="pile-name">${def.name}</div>
            <div class="pile-desc">${def.desc}</div>
          </div>
          <span class="pile-count">×${counts[t]}</span>
        </div>`;
      }).join('')}
    </div>
  `;
  pileModal.classList.remove('hidden');
  pileModal.classList.add('show');
}
function hidePileModal() {
  pileModal.classList.add('hidden');
  pileModal.classList.remove('show');
}

/* ---------------------- TIENDA ---------------------- */
const NIVELES_TIENDA = {
  common:    { weight: 50, pool: ['PAWN', 'AXE', 'SHIELDC'] },
  rare:      { weight: 30, pool: ['KNIGHT', 'BISHOP', 'BOMBER', 'SPIDER'] },
  epic:      { weight: 15, pool: ['ROOK', 'KING', 'OWL', 'BULL'] },
  legendary: { weight: 5,  pool: ['QUEEN', 'DRAGON', 'WILDCARD'] }
};

function pickShopCard(exclude) {
  const totalWeight = Object.values(NIVELES_TIENDA).reduce((s, t) => s + t.weight, 0);
  let attempts = 30;
  while (attempts-- > 0) {
    let r = Math.random() * totalWeight;
    let chosenTier = null;
    for (const tier of Object.values(NIVELES_TIENDA)) {
      r -= tier.weight;
      if (r < 0) { chosenTier = tier; break; }
    }
    if (!chosenTier) chosenTier = NIVELES_TIENDA.common;
    const pool = chosenTier.pool.filter(k => !exclude.has(k));
    if (pool.length === 0) continue;
    return pool[Math.floor(Math.random() * pool.length)];
  }
  const allKeys = Object.values(NIVELES_TIENDA).flatMap(t => t.pool).filter(k => !exclude.has(k));
  return allKeys[0] || 'PAWN';
}

function generateShopOffers() {
  const offers = [];
  const usedCards = new Set();

  for (let i = 0; i < 2; i++) {
    const k = pickShopCard(usedCards);
    usedCards.add(k);
    offers.push({ kind: 'card', key: k, slotId: offers.length, purchased: false });
  }

  const potPool = [...Object.keys(POCIONES)];
  shuffle(potPool);
  offers.push({ kind: 'potion', key: potPool[0], slotId: offers.length, purchased: false });

  const utilPool = ['heal', 'shield', 'pyre'];
  shuffle(utilPool);
  offers.push({ kind: 'upgrade', key: utilPool[0], slotId: offers.length, purchased: false });

  const unownedRelics = Object.keys(RELIQUIAS).filter(k => !hasRelic(k));
  if (unownedRelics.length > 0) {
    shuffle(unownedRelics);
    offers.push({ kind: 'relic', key: unownedRelics[0], slotId: offers.length, purchased: false });
  } else {
    offers.push({ kind: 'potion', key: potPool[1], slotId: offers.length, purchased: false });
  }

  partida.shopOffers = offers;
}

function getShopOfferInfo(offer) {
  if (offer.kind === 'card') {
    const d = CARTAS[offer.key];
    return { icon: d.icon, name: d.name, meta: d.desc, cost: d.shopCost, rarity: d.rarity || 'common', canBuy: !offer.purchased && partida.gold >= d.shopCost };
  }
  if (offer.kind === 'potion') {
    const d = POCIONES[offer.key];
    return { icon: d.icon, name: d.name, meta: d.desc, cost: 3, rarity: 'common', canBuy: !offer.purchased && partida.gold >= 3 };
  }
  if (offer.kind === 'relic') {
    const d = RELIQUIAS[offer.key];
    return { icon: d.icon, name: d.name, meta: d.desc, cost: 7, rarity: 'legendary', canBuy: !offer.purchased && partida.gold >= 7 };
  }
  if (offer.kind === 'upgrade') {
    if (offer.key === 'heal') {
      return { icon: '🩸', name: 'Sangre del Bárbaro', meta: '+1 ❤️ máx · cura completa', cost: 5, rarity: 'rare', canBuy: !offer.purchased && partida.gold >= 5 };
    }
    if (offer.key === 'shield') {
      return { icon: '🛡️', name: 'Bendición del Muro', meta: '+1 🛡️ permanente cada turno', cost: 4, rarity: 'common', canBuy: !offer.purchased && partida.gold >= 4 };
    }
    if (offer.key === 'pyre') {
      return { icon: '🔥', name: 'Pira: Purgar Carta', meta: 'Quema una carta aleatoria del mazo', cost: 3, rarity: 'common', canBuy: !offer.purchased && partida.gold >= 3 && (partida.deckExtras.length > 0 || partida.deck.length > 0) };
    }
  }
  return { icon: '?', name: '?', meta: '', cost: 0, rarity: 'common', canBuy: false };
}

/* Contexto activo del overlay para la delegación de eventos (ver más abajo). */
let currentEvent = null;
let currentChestOffers = null;

/* ===== FASE 0.5: EVENTO NARRATIVO (aparece con prob 1/3 entre niveles) ===== */
function showEventOverlay() {
  const ev = EVENTOS[Math.floor(Math.random() * EVENTOS.length)];
  currentEvent = ev;
  overlayTitle.textContent = `${ev.icon} ${ev.title}`;
  overlayBtn.style.display = 'none';
  const opts = ev.options.map((o, i) => {
    const enabled = o.cond ? o.cond() : true;
    return `<button class="baroque-button event-option" data-evt-opt="${i}" ${enabled ? '' : 'disabled'}>${o.label}</button>`;
  }).join('');
  overlayText.innerHTML = `
    <div class="event-stage">
      <div class="event-icon">${ev.icon}</div>
      <p class="event-text">${ev.text}</p>
      <div class="event-options">${opts}</div>
    </div>
  `;
  overlay.classList.remove('hidden');
  overlay.classList.add('show');
  // Los clics se gestionan por delegación en overlayText (ver sección LISTENERS).
}

/* ===== FASE 1: COFRE DE REGALO ===== */
function showChestOverlay() {
  overlayTitle.textContent = '✦ Cofre del Destino ✦';
  overlayBtn.style.display = 'none';
  overlayText.innerHTML = `
    <div class="chest-stage">
      <div class="chest-glow"></div>
      <div class="chest" id="chest-emoji" role="button" aria-label="Abrir cofre">🎁</div>
      <p class="chest-hint">Haz clic en el cofre para revelar 3 ofrendas <strong>gratuitas</strong></p>
    </div>
  `;
  overlay.classList.remove('hidden');
  overlay.classList.add('show');
  const chest = document.getElementById('chest-emoji');
  if (chest) chest.addEventListener('click', openChest, { once: true });
}

function openChest() {
  const chest = document.getElementById('chest-emoji');
  if (chest) {
    chest.style.animation = 'chestBurst 0.55s ease-out forwards';
    chest.textContent = '📦';
  }
  setTimeout(revealChestCards, 580);
}

function revealChestCards() {
  const pickedCards = new Set();
  const offers = [];

  // El cofre del destino sólo ofrece cartas. Las reliquias se consiguen en la tienda.
  for (let i = 0; i < 3; i++) {
    const k = pickShopCard(pickedCards);
    pickedCards.add(k);
    offers.push({ type: 'card', key: k });
  }
  currentChestOffers = offers;

  overlayText.innerHTML = `
    <div class="text-center text-amber-200 italic mb-3">✨ El cofre revela tres tesoros. Elige uno como regalo. ✨</div>
    <div class="space-y-2 chest-cards">
      ${offers.map((offer, idx) => {
        if (offer.type === 'card') {
          const d = CARTAS[offer.key];
          const tag = d.rarity && d.rarity !== 'common' ? `<span class="shop-rarity-tag ${d.rarity}">${d.rarity}</span>` : '';
          return `
            <button data-chest-idx="${idx}" class="shop-item affordable rarity-${d.rarity || 'common'}">
              <span class="shop-icon">${d.icon}</span>
              <span class="shop-info">
                <div class="shop-name">${d.name}${tag}</div>
                <div class="shop-meta">${d.desc}</div>
              </span>
              <span class="shop-cost" style="color:#4ade80;">GRATIS</span>
            </button>
          `;
        } else {
          const d = RELIQUIAS[offer.key];
          return `
            <button data-chest-idx="${idx}" class="shop-item affordable rarity-epic">
              <span class="shop-icon" style="color:${d.color}">${d.icon}</span>
              <span class="shop-info">
                <div class="shop-name text-amber-300">${d.name} <span class="shop-rarity-tag epic">Reliquia</span></div>
                <div class="shop-meta">${d.desc}</div>
              </span>
              <span class="shop-cost" style="color:#4ade80;">GRATIS</span>
            </button>
          `;
        }
      }).join('')}
    </div>
  `;
  // Los clics del cofre se gestionan por delegación en overlayText.
}

function pickChestReward(offer, fromRect) { // <-- Le añadimos ", fromRect"
  if (offer.type === 'card') {
    partida.deckExtras.push(offer.key);
    const d = CARTAS[offer.key];
    overlayText.innerHTML = `
      <div class="chest-reveal-card">
        <div class="chest-reveal-icon rarity-${d.rarity || 'common'}-text">${d.icon}</div>
        <h3 class="chest-reveal-name">${d.name}</h3>
        <p class="text-emerald-300 italic mt-1">añadido a tu mazo</p>
      </div>
    `;
  } else {
    partida.relics.push(offer.key);
    if (offer.key === 'BIG_HANDS') setupHandSlots();
    const d = RELIQUIAS[offer.key];
    overlayText.innerHTML = `
      <div class="chest-reveal-card">
        <div class="chest-reveal-icon" style="color:${d.color}">${d.icon}</div>
        <h3 class="chest-reveal-name text-amber-300">${d.name}</h3>
        <p class="text-emerald-300 italic mt-1">Reliquia equipada</p>
      </div>
    `;
    pintarReliquias();
    if (fromRect) animateRelicFly(fromRect, offer.key); // <-- Lanzamos animación
  }
  setTimeout(showShopOverlay, 1200);
}

/* ===== FASE 2: TIENDA NORMAL ===== */
function showShopOverlay() {
  if (!partida.shopOffers) generateShopOffers();
  overlayTitle.textContent = '✦ Campamento del Bárbaro ✦';
  pintarTienda();
  overlayBtn.style.display = '';
  overlayBtn.textContent = 'Continuar ➤';
  overlayBtn.className = 'baroque-button';
  overlayBtn.onclick = () => {
    // En lugar de saltar directamente, primero el jugador elige el siguiente reto
    if (partida.currentLevel + 1 >= FINAL_LEVEL) {
      hideOverlay();
      partida.shopOffers = null;
      partida.nextLevelMode = 'normal';
      empezarNivel(partida.currentLevel + 1);
    } else {
      showNextLevelChoice();
    }
  };
  overlay.classList.remove('hidden');
  overlay.classList.add('show');
}

/* Mapa ramificado (versión simplificada): elegir Normal vs Élite */
function showNextLevelChoice() {
  overlayTitle.textContent = '✦ Bifurcación del Camino ✦';
  overlayBtn.style.display = 'none';
  overlayText.innerHTML = `
    <div class="branch-stage">
      <p class="text-amber-200 italic mb-3">Ante ti se abren dos sendas. Elige sabiamente.</p>
      <div class="space-y-2">
        <button class="baroque-button branch-option" data-mode="normal">
          🛡 Senda Normal — enemigos estándar
        </button>
        <button class="baroque-button branch-option danger" data-mode="elite">
          ⚔ Senda del Élite — 1 enemigo élite del bioma (+5 💰 garantizados al limpiar)
        </button>
      </div>
    </div>
  `;
  overlay.classList.remove('hidden');
  overlay.classList.add('show');
  // Los clics de las sendas se gestionan por delegación en overlayText.
}

function pintarTienda() {
  const heartLine =
    '<span class="text-red-400">' + '❤️'.repeat(partida.hero.hp) + '</span>' +
    '<span class="text-slate-600">' + '🖤'.repeat(Math.max(0, partida.hero.maxHp - partida.hero.hp)) + '</span>';

  const renderOffer = (offer) => {
    const info = getShopOfferInfo(offer);
    const purchasedCls = offer.purchased ? 'purchased' : (info.canBuy ? 'affordable' : 'broke');
    const rarityCls = `rarity-${info.rarity}`;
    const rarityTag = info.rarity && info.rarity !== 'common'
      ? `<span class="shop-rarity-tag ${info.rarity}">${info.rarity}</span>` : '';
    const disabled = (offer.purchased || !info.canBuy) ? 'disabled' : '';
    return `
      <button data-shop-slot="${offer.slotId}" class="shop-item ${purchasedCls} ${rarityCls}" ${disabled}>
        <span class="shop-icon" ${offer.kind === 'relic' ? 'style="color:' + RELIQUIAS[offer.key].color + ';"' : ''}>${info.icon}</span>
        <span class="shop-info">
          <div class="shop-name">${info.name}${rarityTag}</div>
          <div class="shop-meta">${info.meta}</div>
        </span>
        <span class="shop-cost">💰 ${info.cost}</span>
      </button>
    `;
  };

  const bossWarning = partida.currentLevel + 1 === FINAL_LEVEL
    ? `<div class="mt-3 p-2 rounded text-center" style="background: rgba(124,58,237,0.3); border: 1px solid #c084fc; color: #f5d0fe; font-family: 'Cinzel', serif; letter-spacing: 0.06em; font-weight: 700; text-transform: uppercase; font-size: 0.85rem;">⚠ El siguiente acto es el Archimago Supremo 🔮</div>`
    : '';

  overlayText.innerHTML = `
    <div class="shop-stats-row">
      <span>💰 <span class="text-amber-300">${partida.gold}</span></span>
      <span>${heartLine}</span>
      <span>🧪 <span class="text-purple-300">${partida.potions.length}/${MAX_POTIONS}</span></span>
    </div>
    <div class="text-center text-xs italic text-amber-200 mb-2">Cinco ofrendas del campamento. Compra con <strong>💰 oro</strong>.</div>
    <div class="shop-section-title">Bazar Aleatorio (5)</div>
    <div class="space-y-2">${partida.shopOffers.map(renderOffer).join('')}</div>
    ${bossWarning}
  `;
  // Los clics de compra se gestionan por delegación en overlayText.
}

function onShopBuy(slotId) {
  const offer = partida.shopOffers.find(o => o.slotId === slotId);
  if (!offer || offer.purchased) return;
  const info = getShopOfferInfo(offer);
  if (!info.canBuy) return;

  // CAPTURAMOS LA POSICIÓN DEL ICONO EN LA TIENDA
  let fromRect = null;
  const btn = overlayText.querySelector(`button[data-shop-slot="${slotId}"]`);
  if (btn) {
    const iconEl = btn.querySelector('.shop-icon');
    if (iconEl) fromRect = iconEl.getBoundingClientRect();
  }

  partida.gold -= info.cost;

  if (offer.kind === 'card') {
    partida.deckExtras.push(offer.key);
    offer.purchased = true;
    setMessage(`Añades 1 ${CARTAS[offer.key].name} al mazo.`);
  } else if (offer.kind === 'potion') {
    if (partida.potions.length < MAX_POTIONS) {
      partida.potions.push(offer.key);
      offer.purchased = true;
      setMessage(`Has comprado ${POCIONES[offer.key].name}.`);
    } else {
      const discarded = partida.potions.shift();
      partida.potions.push(offer.key);
      offer.purchased = true;
      setMessage(`${POCIONES[discarded].name} descartada por ${POCIONES[offer.key].name}.`);
    }
  } else if (offer.kind === 'relic') {
    partida.relics.push(offer.key);
    offer.purchased = true;
    setMessage(`Has obtenido la reliquia: ${RELIQUIAS[offer.key].name}.`);
    if (offer.key === 'BIG_HANDS') setupHandSlots();
    pintarReliquias();
    
    // DISPARAMOS LA ANIMACIÓN DE VUELO
    if (fromRect) animateRelicFly(fromRect, offer.key);
    
  } else if (offer.kind === 'upgrade') {
    if (offer.key === 'heal') {
      partida.hero.maxHp += 1;
      partida.hero.hp = partida.hero.maxHp;
      offer.purchased = true;
      flashChip('hp');
      setMessage('+1 ❤️ máximo y curación completa.');
    } else if (offer.key === 'shield') {
      offer.purchased = true;
      setMessage('+1 🛡️ inicio de turno (próximo nivel).');
      partida._permShield = (partida._permShield || 0) + 1;
    } else if (offer.key === 'pyre') {
      if (partida.deckExtras.length > 0) {
        const idx = Math.floor(Math.random() * partida.deckExtras.length);
        partida.deckExtras.splice(idx, 1);
      } else if (partida.deck.length > 0) {
        partida.deck.splice(Math.floor(Math.random() * partida.deck.length), 1);
      }
      offer.purchased = true;
      setMessage('🔥 Una carta arde en la pira.');
    }
  }
  pintarTienda();
  pintar();
}

/* ---------------------- VICTORIA / GAME OVER ---------------------- */
function showVictoryOverlay() {
  partida.phase = 'VICTORY';
  // Subir ascensión persistente al ganar
  const next = Math.min(4, getAscension() + 1);
  setAscension(next);
  overlayTitle.innerHTML = `<div class="victory-banner">¡VICTORIA ETERNA!</div>`;
  overlayText.innerHTML = `
    <div class="mb-3 text-lg" style="font-family:'Cormorant Garamond',serif;">
      Has destronado al <strong style="color:#c084fc;">Archimago Supremo</strong> 🔮 y purificado el reino.
    </div>
    <div class="space-y-1 text-sm" style="font-family:'Cinzel',serif;">
      <div>💰 Oro final: <span class="text-amber-300 font-bold">${partida.gold}</span></div>
      <div>🧪 Pociones restantes: <span class="text-purple-300 font-bold">${partida.potions.length}</span></div>
      <div>🃏 Cartas extras adquiridas: <span class="text-rose-300 font-bold">${partida.deckExtras.length}</span></div>
    </div>
    <div class="text-amber-200 text-xs mt-3 italic">— El Acto I está completo —</div>
  `;
  overlayBtn.textContent = 'Comenzar nueva leyenda';
  overlayBtn.className = 'baroque-button victory';
  overlayBtn.onclick = () => { hideOverlay(); restartGame(); };
  overlay.classList.remove('hidden');
  overlay.classList.add('show');
}

function showGameOverOverlay() {
  overlayTitle.textContent = '☠ Has caído ☠';
  overlayText.innerHTML = `
    <div class="space-y-1 mb-2" style="font-family:'Cormorant Garamond',serif;">
      <div>Tu bárbaro cae en el <strong style="color:#fbbf24;">nivel ${partida.currentLevel}</strong>.</div>
      <div class="text-amber-300">💰 ${partida.gold} de oro</div>
      <div class="text-purple-300">🧪 ${partida.potions.length} pociones</div>
      <div class="text-slate-400 text-xs mt-2 italic">Todo se perderá al reiniciar.</div>
    </div>
  `;
  overlayBtn.textContent = 'Reiniciar aventura';
  overlayBtn.className = 'baroque-button danger';
  overlayBtn.onclick = () => { hideOverlay(); restartGame(); };
  overlay.classList.remove('hidden');
  overlay.classList.add('show');
}

function hideOverlay() {
  overlay.classList.add('hidden');
  overlay.classList.remove('show');
}

function restartGame() {
  showHeroSelectOverlay();
}

function applyHeroClass(key) {
  const cls = CLASES_HEROE[key] || CLASES_HEROE.BARBARIAN;
  partida.heroClass = key;
  partida.hero.maxHp = cls.maxHp;
  partida.hero.hp = cls.maxHp;
  partida.hero.thorns = false;
  partida.maxEnergy = cls.maxEnergy;
  partida.energy = cls.maxEnergy;
}

function startFreshRun(heroKey) {
  applyHeroClass(heroKey);
  partida.gold = 0;
  partida.deckExtras = [];
  partida._permShield = 0;
  partida.relics = [];
  partida.voids = [];
  partida.chainCount = 0;
  partida.vengeance = 0;
  partida.frozenSlot = null;
  partida.freeCantripUsedThisTurn = false;
  partida.undoSnapshot = null;
  partida.undoUsedThisLevel = false;
  partida.nextLevelMode = 'normal';
  partida.eliteRewardPending = 0;
  lastTheme = null;

  // Ascensión 3: empezar con Pesadilla en el mazo
  if (getAscension() >= 3) partida.deckExtras.push('NIGHTMARE');

  const ptypes = Object.keys(POCIONES);
  partida.potions = [ptypes[Math.floor(Math.random() * ptypes.length)]];
  partida.shopOffers = null;
  empezarNivel(1);
}

function showHeroSelectOverlay() {
  const asc = getAscension();
  overlayTitle.textContent = '⚔ Elige tu Héroe ⚔';
  overlayBtn.style.display = 'none';
  const heroBtn = (key) => {
    const c = CLASES_HEROE[key];
    return `
      <button class="baroque-button hero-option" data-hero="${key}">
        <span class="hero-icon">${c.icon}</span>
        <span class="hero-info">
          <span class="hero-name">${c.name}</span>
          <span class="hero-meta">${c.desc}</span>
        </span>
      </button>
    `;
  };
  const ascendBtns = [0, 1, 2, 3, 4].map(n => {
    const cur = (n === asc) ? 'current' : '';
    return `<button class="asc-pill ${cur}" data-asc="${n}" title="${MODOS_ASCENSION[n].desc}">${n === 0 ? 'Mortal' : 'A' + n}</button>`;
  }).join('');
  overlayText.innerHTML = `
    <div class="hero-select">
      <div class="hero-options">
        ${heroBtn('BARBARIAN')}
        ${heroBtn('WITCH')}
      </div>
      <div class="asc-row">
        <div class="asc-label">Dificultad / Ascensión</div>
        <div class="asc-pills">${ascendBtns}</div>
        <div class="asc-desc text-amber-200 italic" id="asc-desc">${MODOS_ASCENSION[asc].desc}</div>
      </div>
    </div>
  `;
  overlay.classList.remove('hidden');
  overlay.classList.add('show');
  // Los clics de héroe y ascensión se gestionan por delegación en overlayText.
}

/* ---------------------- LISTENERS ---------------------- */
endTurnBtn.addEventListener('click', terminarTurno);
deckPileBtn.addEventListener('click', () => showPileModal(`🃏 Mazo (${partida.deck.length})`, partida.deck));
discardPileBtn.addEventListener('click', () => showPileModal(`🗑 Descarte (${partida.discardPile.length})`, partida.discardPile));
pileModalClose.addEventListener('click', hidePileModal);
pileModal.addEventListener('click', (e) => { if (e.target === pileModal) hidePileModal(); });
potionSlots.forEach((slot, idx) => slot.addEventListener('click', () => onPotionSlotClick(idx)));
attachHandListeners();

// Foco de los overlays: al abrir lo metemos dentro del diálogo, atrapamos el
// Tab y al cerrar lo devolvemos a donde estaba.
let _overlayLastFocus = null;
const _overlayFocusables = () =>
  [...overlay.querySelectorAll('button:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    .filter(el => el.offsetParent !== null);
const _overlayFocusObserver = new MutationObserver(() => {
  const visible = !overlay.classList.contains('hidden');
  if (visible && !overlay.dataset.focused) {
    overlay.dataset.focused = '1';
    _overlayLastFocus = document.activeElement;
    const f = _overlayFocusables();
    if (f[0]) f[0].focus();
  } else if (!visible && overlay.dataset.focused) {
    delete overlay.dataset.focused;
    if (_overlayLastFocus && _overlayLastFocus.focus) _overlayLastFocus.focus();
    _overlayLastFocus = null;
  }
});
_overlayFocusObserver.observe(overlay, { attributes: true, attributeFilter: ['class'] });
overlay.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab') return;
  const f = _overlayFocusables();
  if (f.length === 0) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});

/* Delegación de eventos del overlay: un único listener para tienda, cofre,
   eventos narrativos, bifurcación de camino y selección de héroe/ascensión.
   Evita re-registrar listeners en cada re-pintar (pintarTienda, etc.). */
overlayText.addEventListener('click', (e) => {
  let el;
  // Tienda: comprar una oferta
  if ((el = e.target.closest('[data-shop-slot]'))) {
    onShopBuy(parseInt(el.dataset.shopSlot, 10));
    return;
  }
  // Cofre del Destino: elegir recompensa
  if ((el = e.target.closest('[data-chest-idx]'))) {
    const offer = currentChestOffers && currentChestOffers[parseInt(el.dataset.chestIdx, 10)];
    if (offer) {
      const iconEl = el.querySelector('.shop-icon');
      pickChestReward(offer, iconEl ? iconEl.getBoundingClientRect() : null);
    }
    return;
  }
  // Evento narrativo: elegir opción
  if ((el = e.target.closest('[data-evt-opt]'))) {
    const o = currentEvent && currentEvent.options[parseInt(el.dataset.evtOpt, 10)];
    if (o) {
      try { o.exec(); } catch (err) {}
      SFX.click();
      hideOverlay();
      setTimeout(showChestOverlay, 200);
    }
    return;
  }
  // Bifurcación del camino: senda Normal o Élite
  if ((el = e.target.closest('[data-mode]'))) {
    partida.nextLevelMode = el.dataset.mode;
    if (partida.nextLevelMode === 'elite') partida.eliteRewardPending = 5;
    SFX.click();
    hideOverlay();
    partida.shopOffers = null;
    empezarNivel(partida.currentLevel + 1);
    return;
  }
  // Selección de ascensión
  if ((el = e.target.closest('[data-asc]'))) {
    const v = parseInt(el.dataset.asc, 10);
    setAscension(v);
    overlayText.querySelectorAll('[data-asc]').forEach(b => b.classList.remove('current'));
    el.classList.add('current');
    const descEl = document.getElementById('asc-desc');
    if (descEl) descEl.textContent = MODOS_ASCENSION[v].desc;
    SFX.click();
    return;
  }
  // Selección de héroe: iniciar partida
  if ((el = e.target.closest('[data-hero]'))) {
    SFX.select();
    hideOverlay();
    startFreshRun(el.dataset.hero);
    return;
  }
});

/* Tooltips flotantes del HUD: estadísticas (👑❤️🛡️⚡💰🔥🩸🌵) y botón de silencio.
   Delegación de eventos: un solo par de listeners para toda la barra. */
const hudBarEl = document.getElementById('hud-bar');
if (hudBarEl) {
  hudBarEl.addEventListener('mouseover', (e) => {
    const chip = e.target.closest('.stat-chip');
    if (chip && hudBarEl.contains(chip)) showHudTooltip(chip);
  });
  hudBarEl.addEventListener('mouseout', (e) => {
    const chip = e.target.closest('.stat-chip');
    if (!chip) return;
    if (e.relatedTarget && chip.contains(e.relatedTarget)) return;
    Tooltip.hide();
  });
  hudBarEl.addEventListener('focusin', (e) => {
    const chip = e.target.closest('.stat-chip');
    if (chip) showHudTooltip(chip);
  });
  hudBarEl.addEventListener('focusout', () => Tooltip.hide());
}

/* Tooltips flotantes de las pociones (delegación sobre la barra de pociones). */
const potionBarEl = document.getElementById('potion-bar');
if (potionBarEl) {
  potionBarEl.addEventListener('mouseover', (e) => {
    const slot = e.target.closest('.potion-slot');
    if (slot && potionBarEl.contains(slot)) showPotionTooltip(slot);
  });
  potionBarEl.addEventListener('mouseout', (e) => {
    const slot = e.target.closest('.potion-slot');
    if (!slot) return;
    if (e.relatedTarget && slot.contains(e.relatedTarget)) return;
    Tooltip.hide();
  });
  potionBarEl.addEventListener('focusin', (e) => {
    const slot = e.target.closest('.potion-slot');
    if (slot) showPotionTooltip(slot);
  });
  potionBarEl.addEventListener('focusout', () => Tooltip.hide());
}

window.addEventListener('resize', sizeBoard);
window.addEventListener('resize', () => Tooltip.hide());
if (boardHost) new ResizeObserver(sizeBoard).observe(boardHost);

const undoBtnEl = document.getElementById('undo-btn');
if (undoBtnEl) undoBtnEl.addEventListener('click', undoLastCard);
const muteBtnEl = document.getElementById('mute-btn');
if (muteBtnEl) muteBtnEl.addEventListener('click', () => {
  SFX.setMuted(!partida.audioMuted);
  muteBtnEl.textContent = partida.audioMuted ? '🔇' : '🔊';
  muteBtnEl.setAttribute('aria-pressed', partida.audioMuted ? 'true' : 'false');
});

document.addEventListener('keydown', (e) => {
  // Se usa e.code (posición física de la tecla) en vez de e.key para que los
  // atajos funcionen igual con Bloq Mayús, AZERTY u otras distribuciones.
  const code = e.code;
  if (code === 'Escape') {
    if (!pileModal.classList.contains('hidden')) { hidePileModal(); return; }
    if (partida.phase === 'TELEPORT_TARGETING') { cancelTeleport(); return; }
  }
  if (partida.phase !== 'PLAYER_TURN' || partida.inputLocked) return;
  if (code === 'Digit1' || code === 'Numpad1') {
    onCardClick(0);
  } else if (code === 'Digit2' || code === 'Numpad2') {
    onCardClick(1);
  } else if (code === 'Digit3' || code === 'Numpad3') {
    onCardClick(2);
  } else if (code === 'KeyQ') {
    onPotionSlotClick(0);
  } else if (code === 'KeyW') {
    onPotionSlotClick(1);
  } else if (code === 'KeyE') {
    onPotionSlotClick(2);
  } else if (code === 'Space' || code === 'Enter' || code === 'NumpadEnter') {
    e.preventDefault();
    terminarTurno();
  } else if (code === 'KeyZ') {
    undoLastCard();
  } else if (code === 'KeyM') {
    SFX.setMuted(!partida.audioMuted);
    const mb = document.getElementById('mute-btn');
    if (mb) {
      mb.textContent = partida.audioMuted ? '🔇' : '🔊';
      mb.setAttribute('aria-pressed', partida.audioMuted ? 'true' : 'false');
    }
    setMessage(partida.audioMuted ? '🔇 Sonido silenciado.' : '🔊 Sonido activado.');
    pintar();
  } else if (code === 'Escape') {
    partida.selectedCardIndex = null;
    partida.validTargets = [];
    Tooltip.hide();
    pintar();
  }
});

restartGame();
sizeBoard();