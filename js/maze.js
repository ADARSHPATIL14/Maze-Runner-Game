/**
 * maze.js - Maze Data, Tile Definitions & Layout Management
 * Handles grid representation, wall collisions, and deterministic level generation.
 */

// Tile Types
const TILE = {
  FLOOR: 0,
  WALL: 1,
  WALL_RUNIC: 2,
  WALL_CRACKED: 3,
  FLOOR_MOSSY: 4,
  FLOOR_GLYPH: 5
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
  constructor(level) {
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

    if (level !== undefined) {
      this.loadLevel(level);
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
   */
  loadLevel(level) {
    const lvl = Math.max(1, Math.floor(level));
    this.currentLevel = lvl;

    const DM = resolveDifficultyManager();
    const config = DM ? DM.getLevelConfig(lvl) : {
      level: lvl,
      hunterIntervalMs: Math.max(300, 900 - 50 * (lvl - 1)),
      cols: lvl <= 2 ? 15 : (lvl <= 4 ? 19 : 23),
      rows: lvl <= 2 ? 11 : (lvl <= 4 ? 13 : 15),
      requiredRelics: Math.min(15, 5 + 2 * (lvl - 1)),
      loopFactor: Math.max(0.04, 0.32 - 0.04 * (lvl - 1))
    };

    this.cols = config.cols;
    this.rows = config.rows;

    // Seeded PRNG specific to this level index: guarantees identical layout on restart
    const rng = createMulberry32(lvl * 10007 + 42);

    // Initialize all tiles as solid walls
    this.grid = [];
    for (let y = 0; y < this.rows; y++) {
      const row = new Array(this.cols).fill(TILE.WALL);
      this.grid.push(row);
    }

    // Standard odd-indexed grid nodes for randomized DFS spanning tree
    // odd cols: 1, 3, ..., cols - 2; odd rows: 1, 3, ..., rows - 2
    const visited = Array.from({ length: this.rows }, () => new Array(this.cols).fill(false));
    const stack = [{ x: 1, y: 1 }];
    visited[1][1] = true;
    this.grid[1][1] = TILE.FLOOR;

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
        if (nx > 0 && nx < this.cols - 1 && ny > 0 && ny < this.rows - 1 && !visited[ny][nx]) {
          neighbors.push({ x: nx, y: ny, wallX: current.x + d.dx / 2, wallY: current.y + d.dy / 2 });
        }
      }

      if (neighbors.length > 0) {
        // Deterministic pseudo-random pick
        const chosenIndex = Math.floor(rng() * neighbors.length);
        const chosen = neighbors[chosenIndex];

        // Carve wall and destination cell
        this.grid[chosen.wallY][chosen.wallX] = TILE.FLOOR;
        this.grid[chosen.y][chosen.x] = TILE.FLOOR;
        visited[chosen.y][chosen.x] = true;
        stack.push({ x: chosen.x, y: chosen.y });
      } else {
        stack.pop();
      }
    }

    // Add controlled corridor loops based on loopFactor (braiding)
    // Decreasing loopFactor increases dead ends & route complexity
    for (let y = 1; y < this.rows - 1; y++) {
      for (let x = 1; x < this.cols - 1; x++) {
        if (this.grid[y][x] === TILE.WALL) {
          // Check if wall separates horizontal or vertical passages
          const isHorizPassage = this.grid[y][x - 1] === TILE.FLOOR && this.grid[y][x + 1] === TILE.FLOOR;
          const isVertPassage = this.grid[y - 1][x] === TILE.FLOOR && this.grid[y + 1][x] === TILE.FLOOR;

          if ((isHorizPassage || isVertPassage) && !(isHorizPassage && isVertPassage)) {
            if (rng() < config.loopFactor) {
              this.grid[y][x] = TILE.FLOOR;
            }
          }
        }
      }
    }

    // Key Milestone Positions (always odd coordinates, guaranteed connected)
    this.playerStart = { x: 1, y: 1 };
    this.enemyStart = { x: this.cols - 2, y: 1 };
    this.exitPortal = { x: this.cols - 2, y: this.rows - 2 };

    this.grid[this.playerStart.y][this.playerStart.x] = TILE.FLOOR;
    this.grid[this.enemyStart.y][this.enemyStart.x] = TILE.FLOOR;
    this.grid[this.exitPortal.y][this.exitPortal.x] = TILE.FLOOR;

    // Distribute required relics deterministically across valid floor cells
    const floorCells = [];
    for (let y = 1; y < this.rows - 1; y++) {
      for (let x = 1; x < this.cols - 1; x++) {
        if (this.grid[y][x] === TILE.FLOOR) {
          const isPlayerStart = x === this.playerStart.x && y === this.playerStart.y;
          const isEnemyStart = x === this.enemyStart.x && y === this.enemyStart.y;
          const isExitPortal = x === this.exitPortal.x && y === this.exitPortal.y;
          // Avoid placing relic directly on player spawn
          if (!isPlayerStart && !isEnemyStart && !isExitPortal) {
            floorCells.push({ x, y });
          }
        }
      }
    }

    // Seeded Fisher-Yates shuffle
    for (let i = floorCells.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const temp = floorCells[i];
      floorCells[i] = floorCells[j];
      floorCells[j] = temp;
    }

    const relicCount = Math.min(config.requiredRelics, floorCells.length);
    this.initialRelics = floorCells.slice(0, relicCount).map(c => ({ x: c.x, y: c.y }));
    this.totalRelics = this.initialRelics.length;
    this.resetCollectibles();

    // Visual Tile Aesthetic Variety (Runic / Cracked Walls, Mossy / Glyph Floors)
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const isBorder = x === 0 || x === this.cols - 1 || y === 0 || y === this.rows - 1;

        if (this.grid[y][x] === TILE.WALL) {
          const rand = rng();
          if (isBorder) {
            // Periodic runic pillar seals on borders
            if ((x === 0 || x === this.cols - 1) && y % 5 === 0) {
              this.grid[y][x] = TILE.WALL_RUNIC;
            } else if ((y === 0 || y === this.rows - 1) && x % 7 === 0) {
              this.grid[y][x] = TILE.WALL_RUNIC;
            }
          } else {
            if (rand < 0.12) {
              this.grid[y][x] = TILE.WALL_RUNIC;
            } else if (rand < 0.22) {
              this.grid[y][x] = TILE.WALL_CRACKED;
            }
          }
        } else if (this.grid[y][x] === TILE.FLOOR) {
          const isSpecial = (x === this.playerStart.x && y === this.playerStart.y) ||
                            (x === this.enemyStart.x && y === this.enemyStart.y) ||
                            (x === this.exitPortal.x && y === this.exitPortal.y);
          if (!isSpecial) {
            const rand = rng();
            if (rand < 0.12) {
              this.grid[y][x] = TILE.FLOOR_MOSSY;
            } else if (rand < 0.18) {
              this.grid[y][x] = TILE.FLOOR_GLYPH;
            }
          }
        }
      }
    }

    // Verify Solvability via BFS
    this._verifySolvability();
  }

  /**
   * Internal verification that player can reach exit, enemy, and all relics
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

    // Exit must be reachable
    const exitOk = reachable[this.exitPortal.y][this.exitPortal.x];
    const enemyOk = reachable[this.enemyStart.y][this.enemyStart.x];
    const relicsOk = this.initialRelics.every(r => reachable[r.y][r.x]);

    if (!exitOk || !enemyOk || !relicsOk) {
      console.warn(`[Maze] Solvability check notice for Level ${this.currentLevel}: exit=${exitOk}, enemy=${enemyOk}, relics=${relicsOk}`);
    }
    return exitOk && enemyOk && relicsOk;
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
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Maze, TILE };
}
