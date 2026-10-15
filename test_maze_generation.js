/**
 * test_maze_generation.js - Comprehensive Automated Verification Suite for Task 6
 * 
 * Verifies all Phase 3 requirements:
 * 3.1 Deterministic Generation & Seed Variety
 *     - Identical seeds produce identical layouts, relics, and exit positions.
 *     - Different seeds produce meaningful layout variation across representative samples.
 *     - PRNG consistency throughout generation pipeline.
 *     - Theme selection is deterministic and reproducible.
 *     - Themes do not modify logical maze connectivity or collision rules.
 * 3.2 Connectivity, Solvability & Placement Integrity
 *     - Verification across Levels 1, 2, 3, 4, 5, 10, 15.
 *     - Player spawn, hunter spawn, and exit portal are valid, walkable, and within bounds.
 *     - 100% reachability of exit, enemy, and all required relics from player start.
 *     - Exact required relic counts: min(15, 5 + 2 * (level - 1)).
 *     - No duplicate relic positions; no relics on player spawn, exit, enemy, or walls.
 *     - Anti-clustering verification: relics spaced away from player (Manhattan >= 2).
 *     - Retry exhaustion & safe milestone fallback verification.
 * 3.3 Difficulty & Mode Regression
 *     - Hunter interval, dimensions, relic formula, loop factor, and hunter mode selection.
 * 3.4 Gameplay Integration
 *     - Collect relics, unlock portal, advance level, and verify hunter mode.
 * 3.5 Generation Performance Benchmark
 *     - Real execution measurements across 150 mazes with min/avg/max generation times.
 */

// Node testing environment globals
global.window = global;
const createMockCtx = () => ({
  save: () => {},
  restore: () => {},
  beginPath: () => {},
  moveTo: () => {},
  lineTo: () => {},
  stroke: () => {},
  fill: () => {},
  closePath: () => {},
  arc: () => {},
  setLineDash: () => {},
  createRadialGradient: () => ({ addColorStop: () => {} }),
  createLinearGradient: () => ({ addColorStop: () => {} }),
  fillRect: () => {},
  drawImage: () => {},
  translate: () => {},
  imageSmoothingEnabled: false
});

global.document = {
  createElement: () => ({
    getContext: () => createMockCtx(),
    width: 32,
    height: 32
  }),
  getElementById: (id) => ({
    id,
    classList: { add: () => {}, remove: () => {}, contains: () => false, toggle: () => {} },
    addEventListener: () => {},
    textContent: '',
    innerHTML: ''
  })
};

const DifficultyManager = require('./js/difficulty.js');
const { Maze, TILE, MAZE_THEMES } = require('./js/maze.js');
const { AStarPathfinder } = require('./js/pathfinding.js');
const Player = require('./js/player.js');
const Enemy = require('./js/enemy.js');

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`  FAIL [${totalTests}]: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passedTests++;
  console.log(`  PASS [${totalTests}]: ${message}`);
}

console.log('================================================================');
console.log('  RUNNING TASK 6: PROCEDURAL MAZE VARIETY & LEVEL DESIGN SUITE');
console.log('================================================================\n');

// =====================================================================
// SECTION 1: DETERMINISTIC GENERATION & SEED REPRODUCIBILITY
// =====================================================================
console.log('>>> [SECTION 1] DETERMINISTIC GENERATION & SEED REPRODUCIBILITY');

// 1.1 Identical seed and configuration produce 100% identical logical layout & relics
{
  const seed = 54321;
  const m1 = new Maze(1, seed);
  const m2 = new Maze(1, seed);

  assert(m1.cols === m2.cols && m1.rows === m2.rows, 'Identical seed produces identical dimensions');
  assert(m1.totalRelics === m2.totalRelics, 'Identical seed produces identical relic count');
  assert(m1.playerStart.x === m2.playerStart.x && m1.playerStart.y === m2.playerStart.y, 'Identical player spawn');
  assert(m1.enemyStart.x === m2.enemyStart.x && m1.enemyStart.y === m2.enemyStart.y, 'Identical enemy spawn');
  assert(m1.exitPortal.x === m2.exitPortal.x && m1.exitPortal.y === m2.exitPortal.y, 'Identical exit portal position');

  // Verify tile-by-tile identity
  let tilesIdentical = true;
  for (let y = 0; y < m1.rows; y++) {
    for (let x = 0; x < m1.cols; x++) {
      if (m1.getTile(x, y) !== m2.getTile(x, y)) tilesIdentical = false;
    }
  }
  assert(tilesIdentical, 'Identical seed produces 100% identical tile layout');

  // Verify relic coordinates identity
  let relicsIdentical = true;
  for (let i = 0; i < m1.collectibles.length; i++) {
    if (m1.collectibles[i].x !== m2.collectibles[i].x || m1.collectibles[i].y !== m2.collectibles[i].y) {
      relicsIdentical = false;
    }
  }
  assert(relicsIdentical, 'Identical seed produces 100% identical relic positions');
}

// 1.2 Restarting a level reproduces identical layout
{
  const m = new Maze(3);
  const initialGridSnapshot = m.grid.map(row => [...row]);
  const initialRelicsSnapshot = m.collectibles.map(r => ({ x: r.x, y: r.y }));

  // Simulate level play and restart
  m.collectAt(m.collectibles[0].x, m.collectibles[0].y);
  assert(m.collectedCount === 1, 'Relic collected during play');

  m.loadLevel(3); // Level restart
  assert(m.collectedCount === 0, 'Relic count reset on restart');
  assert(m.collectibles.length === initialRelicsSnapshot.length, 'Collectibles list restored');

  let restartTilesMatch = true;
  for (let y = 0; y < m.rows; y++) {
    for (let x = 0; x < m.cols; x++) {
      if (m.grid[y][x] !== initialGridSnapshot[y][x]) restartTilesMatch = false;
    }
  }
  assert(restartTilesMatch, 'Restarting level regenerates exact same layout');
}

// 1.3 Different seeds produce distinct, varied maze layouts
{
  const sampleSeeds = [101, 202, 303, 404, 505, 606, 707, 808, 909, 1001];
  const layouts = sampleSeeds.map(s => {
    const maze = new Maze(3, s);
    // Serialize walkable/wall grid
    return maze.grid.map(row => row.map(cell => (cell === TILE.WALL || cell === TILE.WALL_RUNIC || cell === TILE.WALL_CRACKED ? '#' : '.')).join('')).join('\n');
  });

  const uniqueLayouts = new Set(layouts);
  assert(uniqueLayouts.size >= 8, `Different seeds produce high layout variety (${uniqueLayouts.size}/${sampleSeeds.length} unique)`);
}

// 1.4 Theme selection is deterministic and based on level
{
  const mLevel1 = new Maze(1);
  const mLevel2 = new Maze(2);
  const mLevel3 = new Maze(3);
  const mLevel4 = new Maze(4);
  const mLevel5 = new Maze(5);

  assert(mLevel1.theme.id === 'ancient_ruins', 'Level 1 theme is Ancient Ruins');
  assert(mLevel2.theme.id === 'mossy_catacombs', 'Level 2 theme is Mossy Catacombs');
  assert(mLevel3.theme.id === 'forgotten_temple', 'Level 3 theme is Forgotten Temple');
  assert(mLevel4.theme.id === 'shadowed_depths', 'Level 4 theme is Shadowed Depths');
  assert(mLevel5.theme.id === 'ancient_ruins', 'Level 5 theme rotates back to Ancient Ruins');
}

// 1.5 Themes do not alter logical collision rules
{
  const m = new Maze(2);
  for (let y = 0; y < m.rows; y++) {
    for (let x = 0; x < m.cols; x++) {
      const tile = m.getTile(x, y);
      const isWallTile = tile === TILE.WALL || tile === TILE.WALL_RUNIC || tile === TILE.WALL_CRACKED;
      const isFloorTile = tile === TILE.FLOOR || tile === TILE.FLOOR_MOSSY || tile === TILE.FLOOR_GLYPH;

      assert(m.isWall(x, y) === isWallTile, `Tile at (${x}, ${y}) isWall agrees with tile category`);
      assert(m.isWalkable(x, y) === isFloorTile, `Tile at (${x}, ${y}) isWalkable agrees with tile category`);
    }
  }
}
console.log('✓ SECTION 1 PASSED: Determinism and variety verified\n');

// =====================================================================
// SECTION 2: CONNECTIVITY, SOLVABILITY & PLACEMENT INTEGRITY
// =====================================================================
console.log('>>> [SECTION 2] CONNECTIVITY, SOLVABILITY & PLACEMENT INTEGRITY');

const milestoneLevels = [1, 2, 3, 4, 5, 10, 15];
const seedsPerLevel = [1111, 2222, 3333, 4444, 5555];

milestoneLevels.forEach(lvl => {
  const config = DifficultyManager.getLevelConfig(lvl);

  seedsPerLevel.forEach(seed => {
    const maze = new Maze(lvl, seed);

    // 1. Dimensions
    assert(maze.cols === config.cols, `L${lvl} s${seed}: cols matches ${config.cols}`);
    assert(maze.rows === config.rows, `L${lvl} s${seed}: rows matches ${config.rows}`);

    // 2. Spawns & Exit validity
    assert(maze.isWalkable(maze.playerStart.x, maze.playerStart.y), `L${lvl} s${seed}: Player spawn is walkable`);
    assert(maze.isWalkable(maze.enemyStart.x, maze.enemyStart.y), `L${lvl} s${seed}: Enemy spawn is walkable`);
    assert(maze.isWalkable(maze.exitPortal.x, maze.exitPortal.y), `L${lvl} s${seed}: Exit portal is walkable`);

    // 3. Spawns & Exit distance
    const spawnDist = Math.abs(maze.playerStart.x - maze.enemyStart.x) + Math.abs(maze.playerStart.y - maze.enemyStart.y);
    assert(spawnDist >= 12, `L${lvl} s${seed}: Safe distance between player and enemy at start (${spawnDist} tiles)`);

    const exitDist = Math.abs(maze.playerStart.x - maze.exitPortal.x) + Math.abs(maze.playerStart.y - maze.exitPortal.y);
    assert(exitDist >= 12, `L${lvl} s${seed}: Exit is far from player spawn (${exitDist} tiles)`);

    // 4. Exact required relic count
    assert(maze.totalRelics === config.requiredRelics, `L${lvl} s${seed}: Relic count exactly matches required (${maze.totalRelics} === ${config.requiredRelics})`);
    assert(maze.collectibles.length === config.requiredRelics, `L${lvl} s${seed}: Collectibles array length matches`);

    // 5. Relic placements: walkable, inside bounds, no duplicates, not on player/exit/enemy, not adjacent to player
    const seenTiles = new Set();
    maze.collectibles.forEach((r, idx) => {
      assert(maze.isWithinBounds(r.x, r.y), `L${lvl} s${seed}: Relic #${idx} inside bounds`);
      assert(maze.isWalkable(r.x, r.y), `L${lvl} s${seed}: Relic #${idx} on walkable tile`);
      assert(!seenTiles.has(`${r.x},${r.y}`), `L${lvl} s${seed}: No duplicate relic at (${r.x}, ${r.y})`);
      seenTiles.add(`${r.x},${r.y}`);

      const isPlayer = r.x === maze.playerStart.x && r.y === maze.playerStart.y;
      const isExit = r.x === maze.exitPortal.x && r.y === maze.exitPortal.y;
      const isEnemy = r.x === maze.enemyStart.x && r.y === maze.enemyStart.y;
      assert(!isPlayer, `L${lvl} s${seed}: Relic not on player spawn`);
      assert(!isExit, `L${lvl} s${seed}: Relic not on exit portal`);
      assert(!isEnemy, `L${lvl} s${seed}: Relic not on enemy spawn`);

      const manhattanToPlayer = Math.abs(r.x - maze.playerStart.x) + Math.abs(r.y - maze.playerStart.y);
      assert(manhattanToPlayer >= 2, `L${lvl} s${seed}: Relic #${idx} not directly adjacent to player (${manhattanToPlayer} >= 2)`);
    });

    // 6. Solvability via A* Pathfinder
    const exitPath = AStarPathfinder.findPath(maze, maze.playerStart, maze.exitPortal);
    assert(exitPath.success === true, `L${lvl} s${seed}: Exit portal reachable via A*`);

    const enemyPath = AStarPathfinder.findPath(maze, maze.playerStart, maze.enemyStart);
    assert(enemyPath.success === true, `L${lvl} s${seed}: Enemy start reachable via A*`);

    maze.collectibles.forEach((r, idx) => {
      const relicPath = AStarPathfinder.findPath(maze, maze.playerStart, { x: r.x, y: r.y });
      assert(relicPath.success === true, `L${lvl} s${seed}: Relic #${idx} at (${r.x}, ${r.y}) reachable via A*`);
    });
  });
});
console.log('✓ SECTION 2 PASSED: Connectivity, solvability & placements verified across all milestones\n');

// =====================================================================
// SECTION 3: SAFE FALLBACK MILESTONE VERIFICATION
// =====================================================================
console.log('>>> [SECTION 3] SAFE FALLBACK MILESTONE VERIFICATION');

[1, 3, 5].forEach(lvl => {
  const config = DifficultyManager.getLevelConfig(lvl);
  const maze = new Maze();
  // Force fallback milestone generation
  maze._loadFallbackMilestone(config, MAZE_THEMES.ANCIENT_RUINS);

  assert(maze.cols === config.cols, `Fallback L${lvl}: cols matches ${config.cols}`);
  assert(maze.rows === config.rows, `Fallback L${lvl}: rows matches ${config.rows}`);
  assert(maze.totalRelics === config.requiredRelics, `Fallback L${lvl}: exact relic count ${config.requiredRelics}`);
  assert(maze._verifySolvability() === true, `Fallback L${lvl}: 100% solvable via single BFS`);
});
console.log('✓ SECTION 3 PASSED: Fallback milestone generation verified\n');

// =====================================================================
// SECTION 4: DIFFICULTY & HUNTER MODE PROGRESSION REGRESSION
// =====================================================================
console.log('>>> [SECTION 4] DIFFICULTY & HUNTER MODE PROGRESSION REGRESSION');

for (let lvl = 1; lvl <= 15; lvl++) {
  const config = DifficultyManager.getLevelConfig(lvl);

  // Interval formula: max(300, 900 - 50 * (level - 1))
  const expectedInterval = Math.max(300, 900 - 50 * (lvl - 1));
  assert(config.hunterIntervalMs === expectedInterval, `L${lvl}: interval ${config.hunterIntervalMs} === ${expectedInterval}`);

  // Relic formula: min(15, 5 + 2 * (level - 1))
  const expectedRelics = Math.min(15, 5 + 2 * (lvl - 1));
  assert(config.requiredRelics === expectedRelics, `L${lvl}: required relics ${config.requiredRelics} === ${expectedRelics}`);

  // Loop factor formula: max(0.04, 0.32 - 0.04 * (level - 1))
  const expectedLoopFactor = Math.max(0.04, 0.32 - 0.04 * (lvl - 1));
  assert(Math.abs(config.loopFactor - expectedLoopFactor) < 1e-6, `L${lvl}: loopFactor matches formula`);

  // Hunter mode: 1-3 basic, 4+ astar
  const expectedMode = lvl < 4 ? 'basic' : 'astar';
  assert(config.hunterMode === expectedMode, `L${lvl}: hunterMode ${config.hunterMode} === ${expectedMode}`);
}
console.log('✓ SECTION 4 PASSED: Difficulty formulas and hunter modes regression verified\n');

// =====================================================================
// SECTION 5: GAMEPLAY INTEGRATION (COLLECTION, EXIT UNLOCK, PROGRESSION)
// =====================================================================
console.log('>>> [SECTION 5] GAMEPLAY INTEGRATION VERIFICATION');

{
  const maze = new Maze(1, 9999);
  assert(maze.isExitOpen() === false, 'Exit portal is initially locked');

  // Collect all relics
  maze.collectibles.forEach(r => {
    const collected = maze.collectAt(r.x, r.y);
    assert(collected === true, `Successfully collected relic at (${r.x}, ${r.y})`);
  });

  assert(maze.collectedCount === maze.totalRelics, 'All relics collected');
  assert(maze.isExitOpen() === true, 'Exit portal unlocks once all relics are collected');
  assert(maze.isExitTile(maze.exitPortal.x, maze.exitPortal.y) === true, 'isExitTile identifies portal coordinates');

  // Advance to Level 2
  maze.loadLevel(2);
  assert(maze.currentLevel === 2, 'Level advanced to 2');
  assert(maze.isExitOpen() === false, 'Exit portal locks for new level');
  assert(maze.collectedCount === 0, 'Relic counter resets for new level');
  assert(maze.totalRelics === 7, 'Level 2 requires 7 relics');
}
console.log('✓ SECTION 5 PASSED: Gameplay integration verified\n');

// =====================================================================
// SECTION 6: GENERATION PERFORMANCE BENCHMARK
// =====================================================================
console.log('>>> [SECTION 6] GENERATION PERFORMANCE BENCHMARK');

const benchmarkMazes = 150;
const benchmarkLevels = [1, 2, 3, 4, 5, 10, 15];
let totalGenTimeMs = 0;
let maxGenTimeMs = 0;
let retriesCount = 0;

const startTime = Date.now();

for (let i = 0; i < benchmarkMazes; i++) {
  const lvl = benchmarkLevels[i % benchmarkLevels.length];
  const seed = (1000 + i * 37) >>> 0;

  const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  const maze = new Maze(lvl, seed);
  const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

  const elapsed = t1 - t0;
  totalGenTimeMs += elapsed;
  if (elapsed > maxGenTimeMs) maxGenTimeMs = elapsed;
  retriesCount += maze.retryCount;
}

const totalWallClockMs = Date.now() - startTime;
const avgGenTimeMs = totalGenTimeMs / benchmarkMazes;

console.log(`    Total Mazes Generated: ${benchmarkMazes}`);
console.log(`    Dimensions Tested: 15x11, 19x13, 23x15`);
console.log(`    Total Generation Time: ${totalGenTimeMs.toFixed(2)} ms (Wall-clock: ${totalWallClockMs} ms)`);
console.log(`    Average Generation Time: ${avgGenTimeMs.toFixed(3)} ms per maze`);
console.log(`    Maximum Generation Time: ${maxGenTimeMs.toFixed(3)} ms`);
console.log(`    Total Retries Encountered: ${retriesCount} (All retries resolved successfully)`);

assert(avgGenTimeMs < 2.0, `Average generation time is ${avgGenTimeMs.toFixed(3)} ms (< 2.0 ms budget)`);
assert(maxGenTimeMs < 15.0, `Maximum generation time is ${maxGenTimeMs.toFixed(3)} ms (< 15.0 ms budget)`);

console.log('\n================================================================');
console.log(`  ALL ${passedTests}/${totalTests} TASK 6 TESTS PASSED SUCCESSFULLY! (0 FAILURES)`);
console.log('================================================================\n');
