/**
 * enemy.js - AI Hunter Entity (Red Stalker Drone)
 * 
 * Implements two distinct operational modes:
 * 1. BASIC HUNTER (Levels 1–3): Rule-based corridor patrol and line-of-sight chase.
 *    No A* or global pathfinding is executed.
 * 2. A* HUNTER (Level 4+): Genuine full-grid A* pathfinding pursuit via AStarPathfinder.
 * 
 * Features:
 * - Strict grid collision respect (no wall phasing, no diagonal stepping)
 * - Deterministic milestone speed derivation: max(300, 900 - 50 * (level - 1)) ms
 * - Sub-pixel smooth translation and visual sensory pulsing
 * - Safe handling of unreachable targets and dead-ends
 * - Pauses cleanly and resets completely on level change
 */

class Enemy {
  constructor(startX, startY) {
    this.startX = startX;
    this.startY = startY;

    this.gridX = startX;
    this.gridY = startY;

    this.renderX = startX;
    this.renderY = startY;

    this.targetX = startX;
    this.targetY = startY;

    this.direction = 'left';
    
    // Hunter operational mode: 'basic' (L1-3) or 'astar' (L4+)
    // Defaults to 'astar' for direct standalone test compatibility,
    // dynamically configured via setLevel(level) in gameplay.
    this.hunterMode = 'astar';
    this.currentLevel = 1;

    // Movement configuration derived from Level Progression formula:
    // max(300, 900 - 50 * (level - 1)) ms per cell step
    this.movementIntervalMs = 900;
    this.movementInterval = 900;
    this.speed = 1000 / this.movementIntervalMs; 
    this.stepPauseDuration = 0; // Continuous smooth glide across calculated movement interval
    this.stepCooldown = 0;
    this.isMoving = false;

    // Line of Sight & Basic Patrol Configuration
    this.sightRange = 7;
    this.patrolWaypoints = [];
    this.patrolIndex = 0;
    this._lastMazeCols = 0;
    this._lastMazeRows = 0;

    // A* Pathfinding route state
    this.currentRoute = []; // Array of { x, y } target cells
    this.routeIndex = 0;
    this.lastPlayerGrid = { x: -1, y: -1 };
    this.recalculateTimer = 0;
    this.recalculateInterval = 0.4; // Seconds between automatic route refreshes

    // Sensory Telemetry & Algorithm Statistics
    this.aiStats = {
      algorithm: 'A*',
      exploredNodes: 0,
      durationMs: 0,
      pathLength: 0,
      target: { x: null, y: null },
      status: 'IDLE',
      cost: 0
    };

    // Visual animation timers
    this.pulseTimer = 0;
    this.eyeGlow = 1;
    this.scanAngle = 0;
  }

  _getDifficultyManager() {
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

  /**
   * Set hunter operational mode
   * @param {'basic' | 'astar'} mode 
   */
  setMode(mode) {
    this.hunterMode = mode === 'basic' ? 'basic' : 'astar';
    this.aiStats.algorithm = this.hunterMode === 'basic' ? 'Basic Rule-Based' : 'A*';
    this.currentRoute = [];
    this.routeIndex = 0;
  }

  /**
   * Get current hunter operational mode
   * @returns {'basic' | 'astar'}
   */
  getMode() {
    return this.hunterMode;
  }

  /**
   * Configure sight range for line-of-sight detection
   * @param {number} range 
   */
  setSightRange(range) {
    this.sightRange = Math.max(1, Math.min(20, range));
  }

  /**
   * Set exact movement interval in milliseconds
   * @param {number} intervalMs 
   */
  setMovementInterval(intervalMs) {
    this.movementIntervalMs = Math.max(300, Math.min(1500, Math.round(intervalMs)));
    this.movementInterval = this.movementIntervalMs;
    this.speed = 1000 / this.movementIntervalMs;
    this.stepPauseDuration = 0;
  }

  /**
   * Get current movement interval in milliseconds
   * @returns {number}
   */
  getMovementInterval() {
    return this.movementIntervalMs;
  }

  /**
   * Configure hunter difficulty and mode directly from level number
   * @param {number} level 
   */
  setLevel(level) {
    this.currentLevel = Math.max(1, Math.floor(level));
    const DM = this._getDifficultyManager();
    const interval = DM ? DM.getHunterInterval(this.currentLevel) : Math.max(300, 900 - 50 * (this.currentLevel - 1));
    const mode = DM && DM.getHunterMode ? DM.getHunterMode(this.currentLevel) : (this.currentLevel <= 3 ? 'basic' : 'astar');
    this.setMovementInterval(interval);
    this.setMode(mode);
  }

  reset(x, y) {
    this.gridX = x !== undefined ? x : this.startX;
    this.gridY = y !== undefined ? y : this.startY;
    this.targetX = this.gridX;
    this.targetY = this.gridY;
    this.renderX = this.gridX;
    this.renderY = this.gridY;
    this.direction = 'left';
    this.isMoving = false;
    this.pulseTimer = 0;
    this.stepCooldown = 0;
    
    // Refresh speed from current movement interval
    if (this.movementIntervalMs) {
      this.speed = 1000 / this.movementIntervalMs;
    }
    
    // Clear pathfinding and patrol state
    this.currentRoute = [];
    this.routeIndex = 0;
    this.patrolIndex = 0;
    this.patrolWaypoints = [];
    this.lastPlayerGrid = { x: -1, y: -1 };
    this.recalculateTimer = 0;

    this.aiStats = {
      algorithm: this.hunterMode === 'basic' ? 'Basic Rule-Based' : 'A*',
      exploredNodes: 0,
      durationMs: 0,
      pathLength: 0,
      target: { x: null, y: null },
      status: 'IDLE',
      cost: 0
    };
  }

  setSpeed(s) {
    this.speed = Math.max(1.0, Math.min(8.0, s));
    this.movementIntervalMs = Math.round(1000 / this.speed);
    this.movementInterval = this.movementIntervalMs;
  }

  setStepPause(duration) {
    this.stepPauseDuration = Math.max(0, duration);
  }

  setRecalculateInterval(interval) {
    this.recalculateInterval = Math.max(0.05, interval);
  }

  _getPathfinder() {
    if (typeof window !== 'undefined' && window.AStarPathfinder) {
      return window.AStarPathfinder;
    }
    if (typeof global !== 'undefined' && global.AStarPathfinder) {
      return global.AStarPathfinder;
    }
    if (typeof AStarPathfinder !== 'undefined') {
      return AStarPathfinder;
    }
    if (typeof require === 'function') {
      try {
        const pf = require('./pathfinding.js');
        return pf.AStarPathfinder || pf;
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  /**
   * Check direct line-of-sight to target coordinates along clear corridor
   * @param {Object} maze 
   * @param {number} targetX 
   * @param {number} targetY 
   * @returns {{ visible: boolean, dir: string | null, dist: number }}
   */
  checkLineOfSight(maze, targetX, targetY) {
    if (!maze) return { visible: false, dir: null, dist: Infinity };

    // Same column: vertical line of sight
    if (this.gridX === targetX) {
      const dist = Math.abs(this.gridY - targetY);
      if (dist > 0 && dist <= this.sightRange) {
        const minY = Math.min(this.gridY, targetY);
        const maxY = Math.max(this.gridY, targetY);
        let blocked = false;
        for (let y = minY + 1; y < maxY; y++) {
          if (maze.isWall(this.gridX, y)) {
            blocked = true;
            break;
          }
        }
        if (!blocked) {
          return {
            visible: true,
            dir: targetY > this.gridY ? 'down' : 'up',
            dist
          };
        }
      }
    }
    // Same row: horizontal line of sight
    else if (this.gridY === targetY) {
      const dist = Math.abs(this.gridX - targetX);
      if (dist > 0 && dist <= this.sightRange) {
        const minX = Math.min(this.gridX, targetX);
        const maxX = Math.max(this.gridX, targetX);
        let blocked = false;
        for (let x = minX + 1; x < maxX; x++) {
          if (maze.isWall(x, this.gridY)) {
            blocked = true;
            break;
          }
        }
        if (!blocked) {
          return {
            visible: true,
            dir: targetX > this.gridX ? 'right' : 'left',
            dist
          };
        }
      }
    }

    return { visible: false, dir: null, dist: Infinity };
  }

  /**
   * Initialize or update deterministic perimeter patrol waypoints for current maze
   * @param {Object} maze 
   */
  _ensurePatrolWaypoints(maze) {
    if (!maze) return;
    if (this.patrolWaypoints.length === 0 || this._lastMazeCols !== maze.cols || this._lastMazeRows !== maze.rows) {
      this._lastMazeCols = maze.cols;
      this._lastMazeRows = maze.rows;
      // 4 key corner waypoints in clockwise sequence (guaranteed odd walkable cells)
      this.patrolWaypoints = [
        { x: maze.cols - 2, y: 1 },                 // Top-right
        { x: maze.cols - 2, y: maze.rows - 2 },     // Bottom-right
        { x: 1, y: maze.rows - 2 },                 // Bottom-left
        { x: 1, y: 1 }                              // Top-left
      ];
      this.patrolIndex = 0;
    }
  }

  /**
   * Rule-based movement for Levels 1–3 (Basic Hunter)
   * Strictly uses 1-step local decisions; never invokes A* or BFS.
   */
  updateBasicMovement(maze, player) {
    if (!maze || !player) return;

    // If already at player cell, hold position
    if (this.gridX === player.gridX && this.gridY === player.gridY) {
      return;
    }

    this._ensurePatrolWaypoints(maze);

    // 1. Check Line of Sight
    const los = this.checkLineOfSight(maze, player.gridX, player.gridY);

    if (los.visible) {
      // Direct visual pursuit along hallway
      this.aiStats = {
        algorithm: 'Basic Rule-Based',
        exploredNodes: 0,
        durationMs: 0,
        pathLength: 1,
        target: { x: player.gridX, y: player.gridY },
        status: 'LOS_PURSUIT',
        cost: 0
      };

      const offset = this.getOffset(los.dir);
      const nextX = this.gridX + offset.dx;
      const nextY = this.gridY + offset.dy;

      if (maze.isWalkable(nextX, nextY)) {
        this.direction = los.dir;
        this.targetX = nextX;
        this.targetY = nextY;
        this.isMoving = true;
        return;
      }
    }

    // 2. If player is not visible: corridor patrol towards waypoint
    const targetWaypoint = this.patrolWaypoints[this.patrolIndex];
    const distToWaypoint = Math.abs(this.gridX - targetWaypoint.x) + Math.abs(this.gridY - targetWaypoint.y);

    if (distToWaypoint <= 1) {
      this.patrolIndex = (this.patrolIndex + 1) % this.patrolWaypoints.length;
    }

    const currentTarget = this.patrolWaypoints[this.patrolIndex];
    this.aiStats = {
      algorithm: 'Basic Rule-Based',
      exploredNodes: 0,
      durationMs: 0,
      pathLength: 1,
      target: { x: currentTarget.x, y: currentTarget.y },
      status: 'PATROLLING',
      cost: 0
    };

    // Find all valid adjacent walkable steps
    const dirs = ['up', 'down', 'left', 'right'];
    const walkableDirs = [];

    for (const d of dirs) {
      const off = this.getOffset(d);
      const nx = this.gridX + off.dx;
      const ny = this.gridY + off.dy;
      if (maze.isWalkable(nx, ny)) {
        walkableDirs.push({ dir: d, x: nx, y: ny });
      }
    }

    if (walkableDirs.length === 0) return;

    let chosen = null;
    if (walkableDirs.length === 1) {
      // Dead-end: reverse direction cleanly
      chosen = walkableDirs[0];
    } else {
      // Avoid immediate 180 reverse unless blocked
      const oppositeDir = this.getOpposite(this.direction);
      const nonReverseDirs = walkableDirs.filter(w => w.dir !== oppositeDir);
      const candidates = nonReverseDirs.length > 0 ? nonReverseDirs : walkableDirs;

      // Select candidate closest to current waypoint
      let bestScore = Infinity;
      for (const cand of candidates) {
        let score = Math.abs(cand.x - currentTarget.x) + Math.abs(cand.y - currentTarget.y);
        // Momentum bias: slightly prefer continuing straight ahead
        if (cand.dir === this.direction) {
          score -= 0.1;
        }
        if (score < bestScore) {
          bestScore = score;
          chosen = cand;
        }
      }
    }

    if (chosen) {
      this.direction = chosen.dir;
      this.targetX = chosen.x;
      this.targetY = chosen.y;
      this.isMoving = true;
    }
  }

  /**
   * Run A* pathfinding towards target coordinates (Level 4+)
   */
  recalculateRoute(maze, player) {
    if (!player || !maze) return;

    const start = { x: this.gridX, y: this.gridY };
    const goal = { x: player.gridX, y: player.gridY };

    const Pathfinder = this._getPathfinder();
    if (!Pathfinder) {
      console.warn('AStarPathfinder engine not found');
      return;
    }

    const result = Pathfinder.findPath(maze, start, goal);

    this.aiStats = {
      algorithm: 'A*',
      exploredNodes: result.exploredCount,
      durationMs: result.durationMs,
      pathLength: result.path.length,
      target: { x: goal.x, y: goal.y },
      status: result.success ? (result.path.length === 0 ? 'AT_TARGET' : 'TRACKING') : 'UNREACHABLE',
      cost: result.cost
    };

    if (result.success && result.path.length > 0) {
      this.currentRoute = result.path;
      this.routeIndex = 0;
    } else {
      this.currentRoute = [];
      this.routeIndex = 0;
    }

    this.lastPlayerGrid = { x: goal.x, y: goal.y };
    this.recalculateTimer = 0;
  }

  /**
   * Follow computed A* path (Level 4+)
   */
  updateAStarMovement(maze, player) {
    if (!maze || !player) return;

    // If already at player cell, remain alert and hold position
    if (this.gridX === player.gridX && this.gridY === player.gridY) {
      if (this.currentRoute.length > 0) {
        this.currentRoute = [];
        this.routeIndex = 0;
      }
      this.aiStats.status = 'AT_TARGET';
      return;
    }

    // Check conditions to recalculate path:
    // 1. Player moved to a new grid cell
    // 2. Previously calculated route has been fully traversed
    // 3. No route currently exists and scheduled replan timer elapsed
    // 4. Periodic safety refresh when timer expires
    const playerMoved = (
      player.gridX !== this.lastPlayerGrid.x || 
      player.gridY !== this.lastPlayerGrid.y
    );
    const routeDepleted = this.currentRoute.length > 0 && this.routeIndex >= this.currentRoute.length;
    const noRoute = this.currentRoute.length === 0;
    const timerExpired = this.recalculateTimer >= this.recalculateInterval;

    if (playerMoved || routeDepleted || timerExpired) {
      this.recalculateRoute(maze, player);
    }

    // Follow next cell in current A* route
    if (this.currentRoute && this.routeIndex < this.currentRoute.length) {
      const nextCell = this.currentRoute[this.routeIndex];

      // Strict physical movement assertions: must be walkable and strictly 1 orthogonal step away
      const isOrthogonalAdjacent = Math.abs(nextCell.x - this.gridX) + Math.abs(nextCell.y - this.gridY) === 1;
      const isWalkable = maze && maze.isWalkable(nextCell.x, nextCell.y);

      if (isOrthogonalAdjacent && isWalkable) {
        // Update facing direction
        if (nextCell.x > this.gridX) this.direction = 'right';
        else if (nextCell.x < this.gridX) this.direction = 'left';
        else if (nextCell.y > this.gridY) this.direction = 'down';
        else if (nextCell.y < this.gridY) this.direction = 'up';

        this.targetX = nextCell.x;
        this.targetY = nextCell.y;
        this.isMoving = true;
        this.routeIndex++;
      } else {
        // Route blocked or invalid: invalidate and recalculate immediately
        this.currentRoute = [];
        this.routeIndex = 0;
        this.recalculateRoute(maze, player);
      }
    }
  }

  getOffset(dir) {
    switch (dir) {
      case 'up': return { dx: 0, dy: -1 };
      case 'down': return { dx: 0, dy: 1 };
      case 'left': return { dx: -1, dy: 0 };
      case 'right': return { dx: 1, dy: 0 };
      default: return { dx: 0, dy: 0 };
    }
  }

  getOpposite(dir) {
    switch (dir) {
      case 'up': return 'down';
      case 'down': return 'up';
      case 'left': return 'right';
      case 'right': return 'left';
      default: return null;
    }
  }

  /**
   * Main game tick update
   */
  update(dt, maze, player) {
    // Visual sensory pulse animation
    this.pulseTimer += dt * 4;
    this.eyeGlow = 0.7 + Math.sin(this.pulseTimer) * 0.3;

    // Advance path recalculation timer
    this.recalculateTimer += dt;

    if (this.isMoving) {
      // Sub-pixel smooth translation towards current target cell
      const dx = this.targetX - this.renderX;
      const dy = this.targetY - this.renderY;
      const dist = Math.hypot(dx, dy);
      const step = this.speed * dt;

      if (dist <= step) {
        // Snap precisely to target cell
        this.renderX = this.targetX;
        this.renderY = this.targetY;
        this.gridX = this.targetX;
        this.gridY = this.targetY;
        this.isMoving = false;
        this.stepCooldown = this.stepPauseDuration;
      } else {
        this.renderX += (dx / dist) * step;
        this.renderY += (dy / dist) * step;
      }
    } else {
      // Brief step pause for cadence
      if (this.stepCooldown > 0) {
        this.stepCooldown = Math.max(0, this.stepCooldown - dt);
        return;
      }

      // Branch behavior based on active mode
      if (this.hunterMode === 'basic') {
        this.updateBasicMovement(maze, player);
      } else {
        this.updateAStarMovement(maze, player);
      }
    }
  }

  // Check collision with player
  checkCollision(player) {
    if (!player || player.isInvulnerable()) return false;
    const dx = this.renderX - player.renderX;
    const dy = this.renderY - player.renderY;
    const dist = Math.hypot(dx, dy);
    return dist < 0.65; // Collision radius
  }
}

// Global browser & CommonJS exports
if (typeof window !== 'undefined') {
  window.Enemy = Enemy;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Enemy;
}
