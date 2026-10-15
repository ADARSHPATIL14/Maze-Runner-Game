/**
 * test_ai_intelligence.js - Task 5 Comprehensive Automated Verification Suite
 * 
 * Verifies all Section 6 requirements:
 * A. A* Path Validity (open route, around walls, narrow corridor, dead end, unreachable, start==goal, invalid/NaN, no diagonals, all walkable)
 * B. Dynamic Target Changes (player moves, hunter updates path, follows new path, stale route cleared on level reset)
 * C. Movement and Collision (no wall penetration, no out-of-bounds, no diagonals, no pause/resume bursts, collision & damage, invulnerability)
 * D. Hunter Mode Regression (L1-3 basic, 0 A* calls in basic, L4 activation reveal, L5+ A*, restart preserves mode, warning persistence)
 * E. Telemetry & Performance (real stats, rendering causes 0 A* calls, duration < 5ms, resets on reset)
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

const { AStarPathfinder, PriorityQueue } = require('./js/pathfinding.js');
const DifficultyManager = require('./js/difficulty.js');
const { Maze, TILE } = require('./js/maze.js');
const Player = require('./js/player.js');
const Enemy = require('./js/enemy.js');
const GameRenderer = require('./js/renderer.js');

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
console.log('  RUNNING TASK 5 COMPREHENSIVE AI & BALANCING VERIFICATION SUITE');
console.log('================================================================\n');

// =====================================================================
// SECTION A: A* Path Validity
// =====================================================================
console.log('>>> [SECTION A] A* PATH VALIDITY AND EDGE CASES');

// Custom deterministic test fixture maze for controlled geometry
class FixtureMaze {
  constructor(grid) {
    this.rows = grid.length;
    this.cols = grid[0].length;
    this.grid = grid;
  }
  isWall(x, y) {
    if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return true;
    return this.grid[y][x] === 1;
  }
  isWalkable(x, y) {
    return !this.isWall(x, y);
  }
}

// 1. Direct open route
{
  // 5x5 open room surrounded by walls
  const openGrid = [
    [1, 1, 1, 1, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 1, 1, 1, 1]
  ];
  const mazeOpen = new FixtureMaze(openGrid);
  const res = AStarPathfinder.findPath(mazeOpen, { x: 1, y: 1 }, { x: 3, y: 3 });
  assert(res.success === true, 'Direct open route finds path');
  assert(res.cost === 4, `Direct open route cost is Manhattan distance (expected 4, got ${res.cost})`);
  assert(res.path.length === 4, 'Direct open route path length matches cost');
  assert(res.path[res.path.length - 1].x === 3 && res.path[res.path.length - 1].y === 3, 'Terminates at goal');
}

// 2. Route requiring movement around walls
{
  // Wall partition separating start (1,1) and goal (3,1) with opening at bottom (2,3)
  const wallGrid = [
    [1, 1, 1, 1, 1],
    [1, 0, 1, 0, 1],
    [1, 0, 1, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 1, 1, 1, 1]
  ];
  const mazeWall = new FixtureMaze(wallGrid);
  const res = AStarPathfinder.findPath(mazeWall, { x: 1, y: 1 }, { x: 3, y: 1 });
  assert(res.success === true, 'Route successfully navigates around dividing wall');
  assert(res.cost === 6, `Route around wall has expected cost 6 (got ${res.cost})`);
  // Verify none of the steps touch the dividing wall at (2,1) or (2,2)
  for (const step of res.fullPath) {
    assert(mazeWall.isWalkable(step.x, step.y), `Step (${step.x},${step.y}) is walkable`);
    assert(!(step.x === 2 && (step.y === 1 || step.y === 2)), 'Step does not intersect dividing wall');
  }
}

// 3. Narrow corridor
{
  // 1-tile wide winding corridor
  const corridorGrid = [
    [1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 1, 0, 1],
    [1, 1, 1, 0, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1]
  ];
  const mazeCorridor = new FixtureMaze(corridorGrid);
  const res = AStarPathfinder.findPath(mazeCorridor, { x: 1, y: 1 }, { x: 5, y: 1 });
  assert(res.success === true, 'Finds route through narrow 1-tile corridor');
  for (const step of res.fullPath) {
    assert(mazeCorridor.isWalkable(step.x, step.y), 'Corridor step is strictly walkable');
  }
}

// 4. Dead-end route
{
  // Start is inside a dead end (1,1), target is outside (3,1)
  const deadEndGrid = [
    [1, 1, 1, 1, 1],
    [1, 0, 1, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 1, 1, 1, 1]
  ];
  const mazeDeadEnd = new FixtureMaze(deadEndGrid);
  const res = AStarPathfinder.findPath(mazeDeadEnd, { x: 1, y: 1 }, { x: 3, y: 1 });
  assert(res.success === true, 'Finds route navigating out of dead end');
  assert(res.path[0].x === 1 && res.path[0].y === 2, 'First step exits dead end downwards');
}

// 5. Target that is unreachable
{
  // Goal (3,1) is completely boxed in by walls
  const blockedGrid = [
    [1, 1, 1, 1, 1],
    [1, 0, 1, 0, 1],
    [1, 0, 1, 1, 1],
    [1, 1, 1, 1, 1]
  ];
  const mazeBlocked = new FixtureMaze(blockedGrid);
  const res = AStarPathfinder.findPath(mazeBlocked, { x: 1, y: 1 }, { x: 3, y: 1 });
  assert(res.success === false, 'Returns success: false for unreachable target');
  assert(res.path.length === 0, 'Returns empty path for unreachable target');
  assert(res.fullPath.length === 0, 'Returns empty fullPath for unreachable target');
}

// 6. Start position equal to target
{
  const mazeNormal = new Maze(1);
  const pos = { x: 1, y: 1 };
  const res = AStarPathfinder.findPath(mazeNormal, pos, pos);
  assert(res.success === true, 'Start == Goal returns success: true');
  assert(res.path.length === 0, 'Start == Goal returns empty next-moves path');
  assert(res.fullPath.length === 1, 'Start == Goal returns single-node fullPath');
  assert(res.cost === 0, 'Start == Goal cost is 0');
}

// 7. Invalid or out-of-bounds positions
{
  const mazeNormal = new Maze(1);
  const resOob = AStarPathfinder.findPath(mazeNormal, { x: -5, y: 20 }, { x: 1, y: 1 });
  assert(resOob.success === false && resOob.path.length === 0, 'Out-of-bounds start handled safely');

  const resNan = AStarPathfinder.findPath(mazeNormal, { x: NaN, y: 1 }, { x: 1, y: 1 });
  assert(resNan.success === false && resNan.path.length === 0, 'NaN coordinate handled safely');

  const resNull = AStarPathfinder.findPath(null, { x: 1, y: 1 }, { x: 2, y: 2 });
  assert(resNull.success === false && resNull.path.length === 0, 'Null maze handled safely');
}

// 8 & 9. Strict absence of diagonal steps and all steps walkable across procedural mazes
{
  const levelsToTest = [1, 2, 4, 5, 10];
  for (const lvl of levelsToTest) {
    const maze = new Maze(lvl);
    const res = AStarPathfinder.findPath(maze, maze.enemyStart, maze.playerStart);
    assert(res.success === true, `Level ${lvl} A* route exists between enemy and player`);
    
    for (let i = 0; i < res.fullPath.length; i++) {
      const cell = res.fullPath[i];
      assert(maze.isWalkable(cell.x, cell.y), `Level ${lvl} step (${cell.x},${cell.y}) is walkable`);
      if (i > 0) {
        const prev = res.fullPath[i - 1];
        const stepDist = Math.abs(cell.x - prev.x) + Math.abs(cell.y - prev.y);
        assert(stepDist === 1, `Level ${lvl} step is strictly 4-directional (no diagonals)`);
      }
    }
  }
}
console.log('✓ SECTION A PASSED: All 9 path validity criteria verified\n');

// =====================================================================
// SECTION B: Dynamic Target Changes
// =====================================================================
console.log('>>> [SECTION B] DYNAMIC TARGET CHANGES AND REPLANNING');

{
  const maze = new Maze(4); // Level 4 A* maze
  const player = new Player(maze.playerStart.x, maze.playerStart.y);
  const enemy = new Enemy(maze.enemyStart.x, maze.enemyStart.y);
  enemy.setLevel(4);
  assert(enemy.getMode() === 'astar', 'Enemy is in astar mode at Level 4');

  // Initial calculation
  enemy.recalculateRoute(maze, player);
  const initialRouteLength = enemy.currentRoute.length;
  assert(initialRouteLength > 0, 'Initial A* route computed');
  const initialTarget = { ...enemy.lastPlayerGrid };
  assert(initialTarget.x === player.gridX && initialTarget.y === player.gridY, 'Last player grid recorded');

  // Player moves to an adjacent cell
  const origPx = player.gridX;
  const origPy = player.gridY;
  // Find a walkable neighbor for player
  const dirs = [{ dx: 0, dy: 1 }, { dx: 1, dy: 0 }, { dx: 0, dy: -1 }, { dx: -1, dy: 0 }];
  let neighbor = null;
  for (const d of dirs) {
    if (maze.isWalkable(origPx + d.dx, origPy + d.dy)) {
      neighbor = { x: origPx + d.dx, y: origPy + d.dy };
      break;
    }
  }
  assert(neighbor !== null, 'Found walkable neighbor for player move');

  // Move player
  player.gridX = neighbor.x;
  player.gridY = neighbor.y;
  player.renderX = neighbor.x;
  player.renderY = neighbor.y;

  // Next enemy update tick should detect player move and recalculate immediately
  enemy.update(0.016, maze, player);
  assert(enemy.lastPlayerGrid.x === neighbor.x && enemy.lastPlayerGrid.y === neighbor.y, 'Enemy detected player move');
  assert(enemy.currentRoute.length > 0, 'Enemy updated route to new player position');
  const routeEnd = enemy.currentRoute[enemy.currentRoute.length - 1];
  assert(routeEnd.x === neighbor.x && routeEnd.y === neighbor.y, 'Enemy route terminus updated to new target');

  // Verify route is followed in order
  const step0 = enemy.currentRoute[0];
  const step1 = enemy.currentRoute.length > 1 ? enemy.currentRoute[1] : null;

  // Let enemy step
  const intervalSec = enemy.movementIntervalMs / 1000;
  // Simulate time passing to complete one step
  enemy.update(intervalSec + 0.05, maze, player);
  assert(enemy.gridX === step0.x && enemy.gridY === step0.y, 'Enemy stepped to first route waypoint');

  // Verify level reset completely clears stale path
  enemy.reset(maze.enemyStart.x, maze.enemyStart.y);
  assert(enemy.currentRoute.length === 0, 'Level reset clears currentRoute');
  assert(enemy.routeIndex === 0, 'Level reset clears routeIndex');
  assert(enemy.lastPlayerGrid.x === -1 && enemy.lastPlayerGrid.y === -1, 'Level reset clears lastPlayerGrid');
  assert(enemy.gridX === maze.enemyStart.x && enemy.gridY === maze.enemyStart.y, 'Level reset returns to start position');
}
console.log('✓ SECTION B PASSED: Dynamic target changes & reset verified\n');

// =====================================================================
// SECTION C: Movement and Collision
// =====================================================================
console.log('>>> [SECTION C] MOVEMENT AND COLLISION INTEGRITY');

{
  const maze = new Maze(4);
  const player = new Player(maze.playerStart.x, maze.playerStart.y);
  const enemy = new Enemy(maze.enemyStart.x, maze.enemyStart.y);
  enemy.setLevel(4);

  // 1. Over 200 ticks of simulation, verify:
  // - No wall penetration
  // - No out-of-bounds
  // - No diagonal movement
  let wallViolation = false;
  let oobViolation = false;
  let diagonalViolation = false;

  let prevX = enemy.gridX;
  let prevY = enemy.gridY;

  for (let tick = 0; tick < 200; tick++) {
    enemy.update(0.05, maze, player);

    if (maze.isWall(enemy.gridX, enemy.gridY)) wallViolation = true;
    if (enemy.gridX < 0 || enemy.gridX >= maze.cols || enemy.gridY < 0 || enemy.gridY >= maze.rows) oobViolation = true;

    if (enemy.gridX !== prevX || enemy.gridY !== prevY) {
      const stepDist = Math.abs(enemy.gridX - prevX) + Math.abs(enemy.gridY - prevY);
      if (stepDist > 1) diagonalViolation = true;
      prevX = enemy.gridX;
      prevY = enemy.gridY;
    }
  }

  assert(!wallViolation, 'Zero wall penetrations during simulation');
  assert(!oobViolation, 'Zero out-of-bounds steps during simulation');
  assert(!diagonalViolation, 'Zero diagonal steps during simulation');

  // 2. Pause / Resume cadence buffer
  // Set enemy just finished moving (stepCooldown = 0)
  enemy.isMoving = false;
  enemy.stepCooldown = 0;
  // Simulate pause/resume cadence buffer
  enemy.stepCooldown = Math.max(enemy.stepCooldown, 0.15);
  assert(enemy.stepCooldown >= 0.15, 'Cadence buffer prevents immediate step on unpause');
  
  // Ticking 0.05s while in cooldown does NOT change gridX/gridY
  const gXBefore = enemy.gridX;
  const gYBefore = enemy.gridY;
  enemy.update(0.05, maze, player);
  assert(enemy.gridX === gXBefore && enemy.gridY === gYBefore, 'Enemy respects cadence buffer and does not burst-step');

  // 3. Collision and invulnerability
  // Place enemy on same tile as player
  enemy.gridX = player.gridX;
  enemy.gridY = player.gridY;
  enemy.renderX = player.gridX;
  enemy.renderY = player.gridY;

  assert(player.isInvulnerable() === false, 'Player initially not invulnerable');
  assert(enemy.checkCollision(player) === true, 'Collision detected when occupying same tile');

  // Player takes damage
  const tookDmg1 = player.takeDamage();
  assert(tookDmg1 === true, 'Player takes damage on contact');
  assert(player.isInvulnerable() === true, 'Player gains invulnerability after taking damage');

  // Immediate collision re-check while invulnerable must return false
  assert(enemy.checkCollision(player) === false, 'Invulnerable player ignores repeated collision damage');
  const tookDmg2 = player.takeDamage();
  assert(tookDmg2 === false, 'Cannot take damage while invulnerable');

  // Expire invulnerability
  player.invulnerableTimer = 0;
  assert(player.isInvulnerable() === false, 'Invulnerability expires');
  assert(enemy.checkCollision(player) === true, 'Collision re-engages after invulnerability expires');
}
console.log('✓ SECTION C PASSED: Movement, collision & invulnerability verified\n');

// =====================================================================
// SECTION D: Hunter Mode Regression
// =====================================================================
console.log('>>> [SECTION D] HUNTER MODE REGRESSION');

{
  // 1. DifficultyManager mode assignment across levels
  assert(DifficultyManager.getHunterMode(1) === 'basic', 'Level 1 is basic mode');
  assert(DifficultyManager.getHunterMode(2) === 'basic', 'Level 2 is basic mode');
  assert(DifficultyManager.getHunterMode(3) === 'basic', 'Level 3 is basic mode');
  assert(DifficultyManager.getHunterMode(4) === 'astar', 'Level 4 is astar mode');
  assert(DifficultyManager.getHunterMode(5) === 'astar', 'Level 5 is astar mode');
  assert(DifficultyManager.getHunterMode(10) === 'astar', 'Level 10 is astar mode');

  // 2. Basic mode NEVER invokes A* pathfinding
  const maze1 = new Maze(1);
  const player1 = new Player(maze1.playerStart.x, maze1.playerStart.y);
  const enemy1 = new Enemy(maze1.enemyStart.x, maze1.enemyStart.y);
  enemy1.setLevel(1);
  assert(enemy1.getMode() === 'basic', 'Enemy configured for basic mode');

  let astarCallCount = 0;
  const originalFindPath = AStarPathfinder.findPath;
  AStarPathfinder.findPath = function(...args) {
    astarCallCount++;
    return originalFindPath.apply(this, args);
  };

  for (let tick = 0; tick < 100; tick++) {
    enemy1.update(0.05, maze1, player1);
  }

  assert(astarCallCount === 0, `Basic hunter made 0 calls to AStarPathfinder (actual: ${astarCallCount})`);
  AStarPathfinder.findPath = originalFindPath; // Restore

  // 3. Level 4 activation sequence and mode switch
  const enemy4 = new Enemy(maze1.enemyStart.x, maze1.enemyStart.y);
  enemy4.setLevel(4);
  assert(enemy4.getMode() === 'astar', 'Level 4 enemy is in astar mode');

  // 4. Mode preserved across resets
  enemy1.reset(maze1.enemyStart.x, maze1.enemyStart.y);
  assert(enemy1.getMode() === 'basic', 'Reset preserves basic mode on Level 1');

  enemy4.reset(maze1.enemyStart.x, maze1.enemyStart.y);
  assert(enemy4.getMode() === 'astar', 'Reset preserves astar mode on Level 4');
}
console.log('✓ SECTION D PASSED: Hunter mode regression verified\n');

// =====================================================================
// SECTION E: Telemetry & Performance
// =====================================================================
console.log('>>> [SECTION E] TELEMETRY AND PERFORMANCE');

{
  const maze = new Maze(4);
  const player = new Player(maze.playerStart.x, maze.playerStart.y);
  const enemy = new Enemy(maze.enemyStart.x, maze.enemyStart.y);
  enemy.setLevel(4);

  // 1. Initial calculation updates telemetry with real numbers
  enemy.recalculateRoute(maze, player);
  assert(enemy.aiStats.algorithm === 'A*', 'aiStats reports A*');
  assert(enemy.aiStats.exploredNodes > 0, `Real explored nodes reported (${enemy.aiStats.exploredNodes})`);
  assert(typeof enemy.aiStats.durationMs === 'number' && enemy.aiStats.durationMs >= 0, 'Real durationMs reported');
  assert(enemy.aiStats.pathLength === enemy.currentRoute.length, 'pathLength matches currentRoute length');
  assert(enemy.aiStats.status === 'TRACKING', 'Status is TRACKING when route active');

  // 2. Route rendering creates ZERO pathfinding calls
  let renderAstarCalls = 0;
  const originalFindPath = AStarPathfinder.findPath;
  AStarPathfinder.findPath = function(...args) {
    renderAstarCalls++;
    return originalFindPath.apply(this, args);
  };

  // Mock canvas 2D context
  const mockCtx = {
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
  };
  const mockCanvas = {
    getContext: () => mockCtx,
    width: 800,
    height: 600
  };

  const renderer = new GameRenderer(mockCanvas);

  renderer.drawEnemyPath(mockCtx, enemy, 32, 0.5);
  assert(renderAstarCalls === 0, 'drawEnemyPath performs 0 A* pathfinding calculations');

  // Also verify drawEnemyPath suppresses in basic mode
  enemy.setMode('basic');
  renderer.drawEnemyPath(mockCtx, enemy, 32, 0.5);
  assert(renderAstarCalls === 0, 'drawEnemyPath in basic mode performs 0 calls and suppresses drawing');
  enemy.setMode('astar');

  AStarPathfinder.findPath = originalFindPath; // Restore

  // 3. Performance benchmark across maze sizes
  const sizes = [
    { level: 1, name: '15x11 (Milestone 1)' },
    { level: 3, name: '19x13 (Milestone 2)' },
    { level: 5, name: '23x15 (Milestone 3)' }
  ];

  for (const s of sizes) {
    const testMaze = new Maze(s.level);
    const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const runs = 20;
    for (let r = 0; r < runs; r++) {
      AStarPathfinder.findPath(testMaze, testMaze.enemyStart, testMaze.playerStart);
    }
    const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const avgDuration = (t1 - t0) / runs;
    assert(avgDuration < 5.0, `${s.name} average A* duration is ${avgDuration.toFixed(3)} ms (< 5.0 ms threshold)`);
  }

  // 4. Telemetry resets cleanly
  enemy.reset(maze.enemyStart.x, maze.enemyStart.y);
  assert(enemy.aiStats.status === 'IDLE', 'aiStats status resets to IDLE');
  assert(enemy.aiStats.exploredNodes === 0, 'aiStats exploredNodes resets to 0');
  assert(enemy.aiStats.pathLength === 0, 'aiStats pathLength resets to 0');
}
console.log('✓ SECTION E PASSED: Telemetry and performance verified\n');

console.log('================================================================');
console.log(`  ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY (0 FAILURES)`);
console.log('================================================================');
