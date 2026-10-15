/**
 * pathfinding.js - Standalone A* Pathfinding AI Engine
 * 
 * Provides an exact, non-approximated A* implementation on 2D grid mazes:
 * - Four-directional movement (Up, Down, Left, Right)
 * - Impassable wall collision detection via maze.isWalkable(x, y)
 * - Admissible Manhattan distance heuristic: h(n) = |x1 - x2| + |y1 - y2|
 * - Min-priority queue open set with tie-breaking on heuristic h(n)
 * - Tracked closed set (expanded nodes)
 * - Full path reconstruction via predecessor map (cameFrom)
 * - Returns route, explored node count, computation duration (ms), and success status
 * - Safe handling of unreachable or out-of-bounds targets
 */

class PriorityQueue {
  constructor() {
    this.heap = [];
  }

  push(item) {
    this.heap.push(item);
    this._bubbleUp(this.heap.length - 1);
  }

  pop() {
    if (this.heap.length === 0) return null;
    const top = this.heap[0];
    const bottom = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = bottom;
      this._sinkDown(0);
    }
    return top;
  }

  get size() {
    return this.heap.length;
  }

  isEmpty() {
    return this.heap.length === 0;
  }

  _bubbleUp(index) {
    const item = this.heap[index];
    while (index > 0) {
      const parentIdx = (index - 1) >> 1;
      const parent = this.heap[parentIdx];
      // Compare f-score; tie-break on lower h-score
      if (item.f < parent.f || (item.f === parent.f && item.h < parent.h)) {
        this.heap[index] = parent;
        index = parentIdx;
      } else {
        break;
      }
    }
    this.heap[index] = item;
  }

  _sinkDown(index) {
    const length = this.heap.length;
    const item = this.heap[index];

    while (true) {
      let swap = -1;
      const leftIdx = (index << 1) + 1;
      const rightIdx = leftIdx + 1;

      if (leftIdx < length) {
        const left = this.heap[leftIdx];
        if (left.f < item.f || (left.f === item.f && left.h < item.h)) {
          swap = leftIdx;
        }
      }

      if (rightIdx < length) {
        const right = this.heap[rightIdx];
        const compareTo = (swap === -1) ? item : this.heap[leftIdx];
        if (right.f < compareTo.f || (right.f === compareTo.f && right.h < compareTo.h)) {
          swap = rightIdx;
        }
      }

      if (swap === -1) break;

      this.heap[index] = this.heap[swap];
      index = swap;
    }
    this.heap[index] = item;
  }
}

class AStarPathfinder {
  /**
   * Calculate Manhattan distance heuristic: h(n) = |x1 - x2| + |y1 - y2|
   * Admissible and consistent for 4-directional grid graphs.
   */
  static heuristic(x1, y1, x2, y2) {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
  }

  /**
   * Find optimal path from start to goal using A*
   * @param {Object} maze - Maze instance with isWalkable(x, y)
   * @param {Object} start - { x, y } start coordinate
   * @param {Object} goal - { x, y } target coordinate
   * @returns {Object} { path, fullPath, exploredCount, durationMs, success, cost }
   */
  static findPath(maze, start, goal) {
    const startTime = (typeof performance !== 'undefined' && performance.now) 
      ? performance.now() 
      : Date.now();

    // Early validation
    if (!maze || !start || !goal) {
      return this._failureResult(0, startTime);
    }

    if (!Number.isFinite(start.x) || !Number.isFinite(start.y) || 
        !Number.isFinite(goal.x) || !Number.isFinite(goal.y)) {
      return this._failureResult(0, startTime);
    }

    const startX = Math.round(start.x);
    const startY = Math.round(start.y);
    const goalX = Math.round(goal.x);
    const goalY = Math.round(goal.y);

    // Goal or start inside wall or out of bounds
    if (!maze.isWalkable(startX, startY) || !maze.isWalkable(goalX, goalY)) {
      return this._failureResult(0, startTime);
    }

    // Start is already at goal
    if (startX === goalX && startY === goalY) {
      const endTime = (typeof performance !== 'undefined' && performance.now) 
        ? performance.now() 
        : Date.now();
      return {
        path: [],
        fullPath: [{ x: startX, y: startY }],
        exploredCount: 1,
        durationMs: Math.max(0, endTime - startTime),
        success: true,
        cost: 0
      };
    }

    const openQueue = new PriorityQueue();
    const closedSet = new Set();
    const gScores = new Map();
    const cameFrom = new Map();

    const startKey = `${startX},${startY}`;
    const goalKey = `${goalX},${goalY}`;

    const hStart = this.heuristic(startX, startY, goalX, goalY);
    gScores.set(startKey, 0);

    openQueue.push({
      x: startX,
      y: startY,
      key: startKey,
      g: 0,
      h: hStart,
      f: hStart
    });

    // 4-Directional movement (North, South, West, East)
    const DIRECTIONS = [
      { dx: 0, dy: -1 }, // Up
      { dx: 0, dy: 1 },  // Down
      { dx: -1, dy: 0 }, // Left
      { dx: 1, dy: 0 }   // Right
    ];

    let exploredCount = 0;
    let found = false;

    while (!openQueue.isEmpty()) {
      const current = openQueue.pop();
      const currentKey = current.key;

      // Skip outdated duplicate queue entries
      if (closedSet.has(currentKey)) {
        continue;
      }

      closedSet.add(currentKey);
      exploredCount++;

      // Goal reached
      if (current.x === goalX && current.y === goalY) {
        found = true;
        break;
      }

      const currentG = gScores.get(currentKey);

      for (let i = 0; i < 4; i++) {
        const nx = current.x + DIRECTIONS[i].dx;
        const ny = current.y + DIRECTIONS[i].dy;

        // Strict wall & boundary check
        if (!maze.isWalkable(nx, ny)) {
          continue;
        }

        const neighborKey = `${nx},${ny}`;
        if (closedSet.has(neighborKey)) {
          continue;
        }

        const tentativeG = currentG + 1; // Uniform orthogonal movement cost

        const existingG = gScores.has(neighborKey) ? gScores.get(neighborKey) : Infinity;

        if (tentativeG < existingG) {
          cameFrom.set(neighborKey, { x: current.x, y: current.y });
          gScores.set(neighborKey, tentativeG);

          const h = this.heuristic(nx, ny, goalX, goalY);
          const f = tentativeG + h;

          openQueue.push({
            x: nx,
            y: ny,
            key: neighborKey,
            g: tentativeG,
            h: h,
            f: f
          });
        }
      }
    }

    const endTime = (typeof performance !== 'undefined' && performance.now) 
      ? performance.now() 
      : Date.now();
    const durationMs = Math.max(0, endTime - startTime);

    if (!found) {
      return {
        path: [],
        fullPath: [],
        exploredCount: exploredCount,
        durationMs: durationMs,
        success: false,
        cost: 0
      };
    }

    // Reconstruct path backward from goal via cameFrom predecessor map
    const fullPath = [];
    const maxSteps = (maze.cols && maze.rows) ? (maze.cols * maze.rows) : 1000;
    let curr = { x: goalX, y: goalY };
    let currKey = goalKey;

    while (curr && fullPath.length <= maxSteps) {
      fullPath.push(curr);
      if (curr.x === startX && curr.y === startY) break;
      curr = cameFrom.get(currKey);
      if (curr) currKey = `${curr.x},${curr.y}`;
    }

    if (fullPath.length === 0 || fullPath[fullPath.length - 1].x !== startX || fullPath[fullPath.length - 1].y !== startY) {
      return this._failureResult(exploredCount, startTime);
    }

    fullPath.reverse();

    // path is the sequence of next moves from current position
    const path = fullPath.slice(1);

    return {
      path: path,
      fullPath: fullPath,
      exploredCount: exploredCount,
      durationMs: durationMs,
      success: true,
      cost: path.length
    };
  }

  static _failureResult(exploredCount, startTime) {
    const endTime = (typeof performance !== 'undefined' && performance.now) 
      ? performance.now() 
      : Date.now();
    return {
      path: [],
      fullPath: [],
      exploredCount: exploredCount,
      durationMs: Math.max(0, endTime - startTime),
      success: false,
      cost: 0
    };
  }
}

// Export for browser & CommonJS testing
if (typeof window !== 'undefined') {
  window.AStarPathfinder = AStarPathfinder;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AStarPathfinder, PriorityQueue };
}
