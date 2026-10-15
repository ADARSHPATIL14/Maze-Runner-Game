/**
 * maze.js - Maze Data, Tile Definitions, Themes & Procedural Generation
 * Handles grid representation, wall collisions, seeded PRNG generation,
 * anti-clustering relic placement, connectivity validation, and visual themes.
 */

// Logical Tile Types
const TILE = {
  FLOOR: 0,
  WALL: 1,
  WALL_RUNIC: 2,
  WALL_CRACKED: 3,
  FLOOR_MOSSY: 4,
  FLOOR_GLYPH: 5
};

// Subtle visual theme palettes (aesthetic variation strictly decoupled from collision logic)
const MAZE_THEMES = {
  ANCIENT_RUINS: {
    id: 'ancient_ruins',
    name: 'Ancient Ruins',
    wallRunicChance: 0.12,
    wallCrackedChance: 0.10,
    floorMossyChance: 0.08,
    floorGlyphChance: 0.06,
    moteColors: ['#ffe082', '#ffb74d'], // Warm amber/gold
    vignetteColor: 'rgba(4, 7, 10, 0.65)'
  },
  MOSSY_CATACOMBS: {
    id: 'mossy_catacombs',
    name: 'Mossy Catacombs',
    wallRunicChance: 0.06,
    wallCrackedChance: 0.18,
    floorMossyChance: 0.28,
    floorGlyphChance: 0.04,
    moteColors: ['#81c784', '#aed581'], // Overgrown emerald/moss
    vignetteColor: 'rgba(3, 10, 6, 0.68)'
  },
  FORGOTTEN_TEMPLE: {
    id: 'forgotten_temple',
    name: 'Forgotten Temple',
    wallRunicChance: 0.22,
    wallCrackedChance: 0.06,
    floorMossyChance: 0.05,
    floorGlyphChance: 0.22,
    moteColors: ['#80deea', '#4dd0e1'], // Cyan/teal ethereal
    vignetteColor: 'rgba(2, 8, 14, 0.65)'
  },
  SHADOWED_DEPTHS: {
    id: 'shadowed_depths',
    name: 'Shadowed Depths',
    wallRunicChance: 0.15,
    wallCrackedChance: 0.20,
    floorMossyChance: 0.04,
    floorGlyphChance: 0.08,
    moteColors: ['#b39ddb', '#9575cd'], // Abyssal violet
    vignetteColor: 'rgba(6, 3, 12, 0.72)'
  }
};

/**
 * 32-bit deterministic Mulberry32 Pseudo-Random Number Generator
 * @param {number} seed 
 * @returns {() => number} Returns float in [0, 1)
 */
function createMulberry32(seed) {
  let s = (seed ^ 0xDEADBEEF) >>> 0;
  return function() {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function resolveDifficultyManager() {
  if (typeof window !== 'undefined' && window.DifficultyManager) {
    return window.DifficultyManager;
  }
  if (typeof global !== 'undefined' && global.DifficultyManager) {
    return global.DifficultyManager;
  }
  if (typeof DifficultyManager !== 'undefined') {
    return DifficultyManager;
  }
  if (typeof require === 'function') {
    try {
      const dm = require('./difficulty.js');
      return dm.DifficultyManager || dm;
    } catch (e) {
      return null;
    }
  }
  return null;
}

class Maze {
  constructor(level, seed) {
    this.tileSize = 32; // Nominal rendered pixel size per tile

    // Static solvable ancient stone labyrinth (23 x 15) for backward compatibility
    this.rawLayout = [
      [1, 2, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 2, 1, 1, 1],
      [1, 0, 0, 0, 4, 1, 0, 0, 0, 0, 1, 4, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1],
      [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1],
      [1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1],
      [1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 2, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1],
      [1, 4, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 4, 1],
      [1, 1, 1, 0, 1, 0, 1, 1, 1, 3, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1],
      [2, 0, 0, 0, 0, 0, 1, 5, 0, 0, 1, 0, 1, 0, 5, 1, 1, 0, 0, 0, 0, 0, 2],
      [1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1],
      [1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1],
      [1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 2, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1],
      [1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1],
      [1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 0, 1],
      [1, 0, 0, 4, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 4, 0, 0, 1],
      [1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1]
    ];

    // Default coordinates configuration
    this.playerStart = { x: 1, y: 1 };
    this.enemyStart = { x: 21, y: 1 };
    this.exitPortal = { x: 21, y: 13 };

    // Initial collectible positions (Amber Relics)
    this.initialRelics = [
      { x: 3, y: 1 },
      { x: 9, y: 1 },
      { x: 14, y: 1 },
      { x: 1, y: 5 },
      { x: 7, y: 3 },
      { x: 15, y: 3 },
      { x: 21, y: 5 },
      { x: 7, y: 7 },
      { x: 14, y: 7 },
      { x: 1, y: 9 },
      { x: 11, y: 9 },
      { x: 21, y: 9 },
      { x: 3, y: 13 },
      { x: 11, y: 13 },
      { x: 17, y: 13 }
    ];

    this.cols = 23;
    this.rows = 15;
    this.grid = [];
    this.collectibles = [];
    this.totalRelics = this.initialRelics.length;
    this.collectedCount = 0;
    this.currentLevel = level || 1;
    this.seed = null;
    this.retryCount = 0;
    this.theme = MAZE_THEMES.ANCIENT_RUINS;

    if (level !== undefined) {
      this.loadLevel(level, seed);
    } else {
      this.init();
    }
  }

  init() {
    this.cols = this.rawLayout[0].length;
    this.rows = this.rawLayout.length;
    this.grid = this.rawLayout.map(row => [...row]);
    this.resetCollectibles();
  }

  resetCollectibles() {
    this.collectibles = this.initialRelics.map(r => ({ ...r, collected: false }));
    this.collectedCount = 0;
  }

  /**
   * Deterministically generate and load a level based on progression rules
   * @param {number} level - 1-based level index
   * @param {number|null} [customSeed] - Optional specific seed override for reproducibility tests
   */
  loadLevel(level, customSeed) {
    const lvl = Math.max(1, Math.floor(level));
    this.currentLevel = lvl;

    const DM = resolveDifficultyManager();
    const config = DM ? DM.getLevelConfig(lvl) : {
      level: lvl,
      hunterIntervalMs: Math.max(180, 600 - 35 * (lvl - 1)),
      cols: lvl <= 2 ? 15 : (lvl <= 4 ? 19 : 23),
      rows: lvl <= 2 ? 11 : (lvl <= 4 ? 13 : 15),
      requiredRelics: Math.min(15, 5 + 2 * (lvl - 1)),
      loopFactor: Math.max(0.04, 0.32 - 0.04 * (lvl - 1))
    };

    // Deterministic base seed: each level has its own default seed, reproducible across restarts
    const baseSeed = (customSeed !== undefined && customSeed !== null)
      ? (customSeed >>> 0)
      : ((lvl * 10007 + 42) >>> 0);

    // Deterministic theme selection (4 rotating themes: Ancient Ruins -> Mossy Catacombs -> Forgotten Temple -> Shadowed Depths)
    const THEME_KEYS = Object.keys(MAZE_THEMES);
    const themeKey = THEME_KEYS[(lvl - 1) % THEME_KEYS.length];
    this.theme = MAZE_THEMES[themeKey];

    // Retry loop with bounded limit (max 10 retries)
    const MAX_RETRIES = 10;
    let attemptSuccess = false;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      // Deterministic retry seed progression
      const currentSeed = attempt === 0 ? baseSeed : ((baseSeed + attempt * 7919) >>> 0);
      const res = this._generateAttempt(currentSeed, config, this.theme);

      if (res && res.success) {
        this.seed = currentSeed;
        this.retryCount = attempt;
        attemptSuccess = true;
        break;
      }
    }

    if (!attemptSuccess) {
      console.warn(`[Maze] Procedural generation retries exhausted (${MAX_RETRIES}) for Level ${lvl}. Engaging safe fallback milestone.`);
      this._loadFallbackMilestone(config, this.theme);
      this.seed = baseSeed;
      this.retryCount = MAX_RETRIES;
    }

    this.resetCollectibles();
  }

  /**
   * Internal procedural generation attempt with comprehensive BFS reachability validation
   * @private
   */
  _generateAttempt(seed, config, theme) {
    const rng = createMulberry32(seed);
    const cols = config.cols;
    const rows = config.rows;

    // 1. Initialize solid wall grid
    const grid = [];
    for (let y = 0; y < rows; y++) {
      grid.push(new Array(cols).fill(TILE.WALL));
    }

    // 2. Randomized DFS spanning tree from seeded odd-indexed start node
    const oddCols = (cols - 1) / 2;
    const oddRows = (rows - 1) / 2;
    const startNodeX = 1 + 2 * Math.floor(rng() * oddCols);
    const startNodeY = 1 + 2 * Math.floor(rng() * oddRows);

    const visited = Array.from({ length: rows }, () => new Array(cols).fill(false));
    const stack = [{ x: startNodeX, y: startNodeY }];
    visited[startNodeY][startNodeX] = true;
    grid[startNodeY][startNodeX] = TILE.FLOOR;

    const dirs = [
      { dx: 0, dy: -2 },
      { dx: 0, dy: 2 },
      { dx: -2, dy: 0 },
      { dx: 2, dy: 0 }
    ];

    while (stack.length > 0) {
      const current = stack[stack.length - 1];
      const neighbors = [];

      for (const d of dirs) {
        const nx = current.x + d.dx;
        const ny = current.y + d.dy;
        if (nx > 0 && nx < cols - 1 && ny > 0 && ny < rows - 1 && !visited[ny][nx]) {
          neighbors.push({ x: nx, y: ny, wallX: current.x + d.dx / 2, wallY: current.y + d.dy / 2 });
        }
      }

      if (neighbors.length > 0) {
        const chosenIndex = Math.floor(rng() * neighbors.length);
        const chosen = neighbors[chosenIndex];

        grid[chosen.wallY][chosen.wallX] = TILE.FLOOR;
        grid[chosen.y][chosen.x] = TILE.FLOOR;
        visited[chosen.y][chosen.x] = true;
        stack.push({ x: chosen.x, y: chosen.y });
      } else {
        stack.pop();
      }
    }

    // 3. Loop braiding using configured loopFactor
    // Decreasing loopFactor decreases loop cuts, generating more dead ends & tactical route complexity
    for (let y = 1; y < rows - 1; y++) {
      for (let x = 1; x < cols - 1; x++) {
        if (grid[y][x] === TILE.WALL) {
          const isHorizPassage = grid[y][x - 1] === TILE.FLOOR && grid[y][x + 1] === TILE.FLOOR;
          const isVertPassage = grid[y - 1][x] === TILE.FLOOR && grid[y + 1][x] === TILE.FLOOR;

          if ((isHorizPassage || isVertPassage) && !(isHorizPassage && isVertPassage)) {
            if (rng() < config.loopFactor) {
              grid[y][x] = TILE.FLOOR;
            }
          }
        }
      }
    }

    // 4. Milestone positions (always odd coordinates, carved as walkable floors)
    const playerStart = { x: 1, y: 1 };
    const enemyStart = { x: cols - 2, y: 1 };
    const exitPortal = { x: cols - 2, y: rows - 2 };

    grid[playerStart.y][playerStart.x] = TILE.FLOOR;
    grid[enemyStart.y][enemyStart.x] = TILE.FLOOR;
    grid[exitPortal.y][exitPortal.x] = TILE.FLOOR;

    // 5. Single BFS Pass for Reachability and Shortest-Path Distances from Player Start
    const dist = Array.from({ length: rows }, () => new Array(cols).fill(-1));
    const queue = [{ x: playerStart.x, y: playerStart.y }];
    dist[playerStart.y][playerStart.x] = 0;

    const cardinalOffsets = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 }
    ];

    while (queue.length > 0) {
      const curr = queue.shift();
      for (const offset of cardinalOffsets) {
        const nx = curr.x + offset.dx;
        const ny = curr.y + offset.dy;
        if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && grid[ny][nx] !== TILE.WALL && dist[ny][nx] === -1) {
          dist[ny][nx] = dist[curr.y][curr.x] + 1;
          queue.push({ x: nx, y: ny });
        }
      }
    }

    // Exit and enemy must be reachable from player spawn
    if (dist[exitPortal.y][exitPortal.x] === -1) return { success: false, reason: 'EXIT_UNREACHABLE' };
    if (dist[enemyStart.y][enemyStart.x] === -1) return { success: false, reason: 'ENEMY_UNREACHABLE' };

    // 6. Anti-Clustering Relic Placement
    // Candidate tiles: reachable, not player/enemy/exit, Manhattan distance from player >= 2
    const candidateCells = [];
    for (let y = 1; y < rows - 1; y++) {
      for (let x = 1; x < cols - 1; x++) {
        if (grid[y][x] === TILE.FLOOR && dist[y][x] > 0) {
          const isPlayer = x === playerStart.x && y === playerStart.y;
          const isEnemy = x === enemyStart.x && y === enemyStart.y;
          const isExit = x === exitPortal.x && y === exitPortal.y;
          const manhattanToPlayer = Math.abs(x - playerStart.x) + Math.abs(y - playerStart.y);

          if (!isPlayer && !isEnemy && !isExit && manhattanToPlayer >= 2) {
            candidateCells.push({ x, y });
          }
        }
      }
    }

    if (candidateCells.length < config.requiredRelics) {
      return { success: false, reason: 'INSUFFICIENT_FLOOR_TILES' };
    }

    // Seeded Fisher-Yates shuffle on candidates
    for (let i = candidateCells.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = candidateCells[i];
      candidateCells[i] = candidateCells[j];
      candidateCells[j] = tmp;
    }

    // Greedy dispersed selection with decreasing spacing filter (3 -> 2 -> 1)
    let selectedRelics = [];
    const minSpacings = [3, 2, 1];

    for (const spacing of minSpacings) {
      const picked = [];
      for (const cand of candidateCells) {
        const tooClose = picked.some(p => (Math.abs(p.x - cand.x) + Math.abs(p.y - cand.y)) < spacing);
        if (!tooClose) {
          picked.push({ x: cand.x, y: cand.y });
          if (picked.length === config.requiredRelics) break;
        }
      }
      if (picked.length === config.requiredRelics) {
        selectedRelics = picked;
        break;
      }
    }

    if (selectedRelics.length < config.requiredRelics) {
      // Fallback to first N shuffled candidates
      selectedRelics = candidateCells.slice(0, config.requiredRelics).map(c => ({ x: c.x, y: c.y }));
    }

    // Verify all selected relics are reachable
    const allRelicsReachable = selectedRelics.every(r => dist[r.y][r.x] > 0);
    if (!allRelicsReachable) {
      return { success: false, reason: 'RELIC_UNREACHABLE' };
    }

    // 7. Theme-Based Aesthetic Tile Decoration (strictly cosmetic; collision semantics unchanged)
    const relicSet = new Set(selectedRelics.map(r => `${r.x},${r.y}`));

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const isBorder = x === 0 || x === cols - 1 || y === 0 || y === rows - 1;

        if (grid[y][x] === TILE.WALL) {
          if (isBorder) {
            // Periodic runic pillars on perimeter seals
            if ((x === 0 || x === cols - 1) && y % 5 === 0) {
              grid[y][x] = TILE.WALL_RUNIC;
            } else if ((y === 0 || y === rows - 1) && x % 7 === 0) {
              grid[y][x] = TILE.WALL_RUNIC;
            }
          } else {
            const r = rng();
            if (r < theme.wallRunicChance) {
              grid[y][x] = TILE.WALL_RUNIC;
            } else if (r < theme.wallRunicChance + theme.wallCrackedChance) {
              grid[y][x] = TILE.WALL_CRACKED;
            }
          }
        } else if (grid[y][x] === TILE.FLOOR) {
          const isSpecial = (x === playerStart.x && y === playerStart.y) ||
                            (x === enemyStart.x && y === enemyStart.y) ||
                            (x === exitPortal.x && y === exitPortal.y) ||
                            relicSet.has(`${x},${y}`);
          if (!isSpecial) {
            const r = rng();
            if (r < theme.floorMossyChance) {
              grid[y][x] = TILE.FLOOR_MOSSY;
            } else if (r < theme.floorMossyChance + theme.floorGlyphChance) {
              grid[y][x] = TILE.FLOOR_GLYPH;
            }
          }
        }
      }
    }

    // 8. Commit generation state
    this.cols = cols;
    this.rows = rows;
    this.grid = grid;
    this.playerStart = playerStart;
    this.enemyStart = enemyStart;
    this.exitPortal = exitPortal;
    this.initialRelics = selectedRelics;
    this.totalRelics = selectedRelics.length;

    return { success: true };
  }

  /**
   * Safe, verified fallback milestone generator if all procedural retries are exhausted.
   * Guarantees 100% reachability, correct dimensions, and exact relic count.
   * @private
   */
  _loadFallbackMilestone(config, theme) {
    const cols = config.cols;
    const rows = config.rows;

    const grid = Array.from({ length: rows }, () => new Array(cols).fill(TILE.WALL));

    // Serpentine alternating corridors guarantee 100% connectivity for any odd dimensions
    for (let y = 1; y < rows - 1; y += 2) {
      for (let x = 1; x < cols - 1; x++) {
        grid[y][x] = TILE.FLOOR;
      }
      // Connect to next row alternating on right and left edges
      if (y + 2 < rows - 1) {
        const connX = ((y - 1) / 2) % 2 === 0 ? cols - 2 : 1;
        grid[y + 1][connX] = TILE.FLOOR;
      }
    }

    this.playerStart = { x: 1, y: 1 };
    this.enemyStart = { x: cols - 2, y: 1 };
    this.exitPortal = { x: cols - 2, y: rows - 2 };

    grid[this.playerStart.y][this.playerStart.x] = TILE.FLOOR;
    grid[this.enemyStart.y][this.enemyStart.x] = TILE.FLOOR;
    grid[this.exitPortal.y][this.exitPortal.x] = TILE.FLOOR;

    // Pick valid floor cells for relics
    const candidates = [];
    for (let y = 1; y < rows - 1; y++) {
      for (let x = 1; x < cols - 1; x++) {
        if (grid[y][x] === TILE.FLOOR) {
          const isPlayer = x === this.playerStart.x && y === this.playerStart.y;
          const isEnemy = x === this.enemyStart.x && y === this.enemyStart.y;
          const isExit = x === this.exitPortal.x && y === this.exitPortal.y;
          const manhattan = Math.abs(x - this.playerStart.x) + Math.abs(y - this.playerStart.y);
          if (!isPlayer && !isEnemy && !isExit && manhattan >= 2) {
            candidates.push({ x, y });
          }
        }
      }
    }

    this.cols = cols;
    this.rows = rows;
    this.grid = grid;
    this.initialRelics = candidates.slice(0, config.requiredRelics);
    this.totalRelics = this.initialRelics.length;
  }

  /**
   * Public reachability and solvability verification (using single BFS traversal)
   * @returns {boolean} True if player can reach exit, enemy, and all relics
   */
  _verifySolvability() {
    const reachable = Array.from({ length: this.rows }, () => new Array(this.cols).fill(false));
    const queue = [{ x: this.playerStart.x, y: this.playerStart.y }];
    reachable[this.playerStart.y][this.playerStart.x] = true;

    while (queue.length > 0) {
      const curr = queue.shift();
      const nbrs = [
        { x: curr.x + 1, y: curr.y },
        { x: curr.x - 1, y: curr.y },
        { x: curr.x, y: curr.y + 1 },
        { x: curr.x, y: curr.y - 1 }
      ];
      for (const n of nbrs) {
        if (this.isWalkable(n.x, n.y) && !reachable[n.y][n.x]) {
          reachable[n.y][n.x] = true;
          queue.push(n);
        }
      }
    }

    const exitOk = reachable[this.exitPortal.y] && reachable[this.exitPortal.y][this.exitPortal.x];
    const enemyOk = reachable[this.enemyStart.y] && reachable[this.enemyStart.y][this.enemyStart.x];
    const relicsOk = this.initialRelics.every(r => reachable[r.y] && reachable[r.y][r.x]);

    if (!exitOk || !enemyOk || !relicsOk) {
      console.warn(`[Maze] Solvability check notice for Level ${this.currentLevel}: exit=${exitOk}, enemy=${enemyOk}, relics=${relicsOk}`);
    }
    return Boolean(exitOk && enemyOk && relicsOk);
  }

  isWithinBounds(x, y) {
    return x >= 0 && x < this.cols && y >= 0 && y < this.rows;
  }

  isWall(x, y) {
    if (!this.isWithinBounds(x, y)) return true;
    const tile = this.grid[y][x];
    return tile === TILE.WALL || tile === TILE.WALL_RUNIC || tile === TILE.WALL_CRACKED;
  }

  isWalkable(x, y) {
    return this.isWithinBounds(x, y) && !this.isWall(x, y);
  }

  getTile(x, y) {
    if (!this.isWithinBounds(x, y)) return TILE.WALL;
    return this.grid[y][x];
  }

  // Check if player collects an amber relic at tile (x, y)
  collectAt(x, y) {
    const relic = this.collectibles.find(r => !r.collected && r.x === x && r.y === y);
    if (relic) {
      relic.collected = true;
      this.collectedCount++;
      return true;
    }
    return false;
  }

  getRemainingCollectibles() {
    return this.collectibles.filter(r => !r.collected);
  }

  isExitOpen() {
    // Exit activates when all relics are collected
    return this.collectedCount >= this.totalRelics;
  }

  isExitTile(x, y) {
    return this.exitPortal.x === x && this.exitPortal.y === y;
  }
}

// Global browser & CommonJS exports
if (typeof window !== 'undefined') {
  window.Maze = Maze;
  window.TILE = TILE;
  window.MAZE_THEMES = MAZE_THEMES;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Maze, TILE, MAZE_THEMES };
}
