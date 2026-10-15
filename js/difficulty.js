/**
 * difficulty.js - Centralized Linear Level Difficulty Progression Manager
 * 
 * Defines deterministic, formulaic progression rules for all gameplay parameters:
 * 1. Hunter Movement Interval: max(180, 600 - 35 * (level - 1)) ms
 * 2. Maze Dimensions: Milestone schedule (15x11, 19x13, 23x15)
 * 3. Required Collectibles: min(15, 5 + 2 * (level - 1))
 * 4. Maze Complexity: Loop factor decreasing from 0.32 down to 0.04
 */

class DifficultyManager {
  /**
   * Calculate hunter step interval in milliseconds
   * Formula: max(180, 600 - 35 * (level - 1))
   * @param {number} level - 1-based level index
   * @returns {number} Interval in ms (bounded [180, 600])
   */
  static getHunterInterval(level) {
    const lvl = Math.max(1, Math.floor(level));
    return Math.max(180, 600 - 35 * (lvl - 1));
  }

  /**
   * Get deterministic maze grid dimensions for current milestone
   * @param {number} level - 1-based level index
   * @returns {{ cols: number, rows: number }}
   */
  static getMazeDimensions(level) {
    const lvl = Math.max(1, Math.floor(level));
    if (lvl <= 2) {
      return { cols: 15, rows: 11 };
    } else if (lvl <= 4) {
      return { cols: 19, rows: 13 };
    } else {
      return { cols: 23, rows: 15 };
    }
  }

  /**
   * Calculate required collectible relics to open exit portal
   * Formula: min(15, 5 + 2 * (level - 1))
   * @param {number} level - 1-based level index
   * @returns {number} Relic count (bounded [5, 15])
   */
  static getRequiredRelics(level) {
    const lvl = Math.max(1, Math.floor(level));
    return Math.min(15, 5 + 2 * (lvl - 1));
  }

  /**
   * Calculate corridor loop factor (braiding chance) for maze complexity.
   * Lower values create more dead ends and branching complexity.
   * @param {number} level - 1-based level index
   * @returns {number} Loop probability [0.04, 0.32]
   */
  static getLoopFactor(level) {
    const lvl = Math.max(1, Math.floor(level));
    return Math.max(0.04, 0.32 - 0.04 * (lvl - 1));
  }

  /**
   * Get hunter navigation mode for a given level
   * Levels 1-3: 'basic' (deterministic corridor patrol & line-of-sight pursuit)
   * Level 4+: 'astar' (genuine A* pathfinding pursuit)
   * @param {number} level - 1-based level index
   * @returns {'basic' | 'astar'}
   */
  static getHunterMode(level) {
    const lvl = Math.max(1, Math.floor(level));
    return lvl <= 3 ? 'basic' : 'astar';
  }

  /**
   * Get complete unified difficulty configuration for a level
   * @param {number} level - 1-based level index
   * @returns {Object} Complete level configuration
   */
  static getLevelConfig(level) {
    const lvl = Math.max(1, Math.floor(level));
    const dims = this.getMazeDimensions(lvl);
    return {
      level: lvl,
      hunterIntervalMs: this.getHunterInterval(lvl),
      hunterMode: this.getHunterMode(lvl),
      cols: dims.cols,
      rows: dims.rows,
      requiredRelics: this.getRequiredRelics(lvl),
      loopFactor: this.getLoopFactor(lvl)
    };
  }
}

// Global browser & CommonJS exports
if (typeof window !== 'undefined') {
  window.DifficultyManager = DifficultyManager;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DifficultyManager;
}
