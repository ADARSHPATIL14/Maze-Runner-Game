/**
 * player.js - Player Entity & Grid-Based Movement System
 * Handles keyboard input, grid navigation, smooth interpolation, and collision.
 */

class Player {
  constructor(startX, startY) {
    this.startX = startX;
    this.startY = startY;

    this.gridX = startX;
    this.gridY = startY;

    // Smooth render position in tile units
    this.renderX = startX;
    this.renderY = startY;

    this.targetX = startX;
    this.targetY = startY;

    this.direction = 'down'; // Current facing direction: 'up' | 'down' | 'left' | 'right'
    this.heldDirection = null; // Currently held key direction
    this.nextDirection = null; // Buffered turn direction

    this.speed = 5.5; // Tiles per second for snappy, responsive movement
    this.isMoving = false;

    // Animation state
    this.walkTimer = 0;
    this.walkFrame = 0; // 0 or 1

    // Invulnerability / Hurt state
    this.invulnerableTimer = 0;
    this.invulnerableDuration = 1.6; // Seconds
    this.flickerSpeed = 16; // Hz
  }

  reset(x, y) {
    this.gridX = x !== undefined ? x : this.startX;
    this.gridY = y !== undefined ? y : this.startY;
    this.targetX = this.gridX;
    this.targetY = this.gridY;
    this.renderX = this.gridX;
    this.renderY = this.gridY;
    this.direction = 'down';
    this.heldDirection = null;
    this.nextDirection = null;
    this.isMoving = false;
    this.invulnerableTimer = 0;
    this.walkTimer = 0;
    this.walkFrame = 0;
  }

  setHeldDirection(dir) {
    this.heldDirection = dir;
    if (dir) {
      this.nextDirection = dir;
    }
  }

  getOffsetForDirection(dir) {
    switch (dir) {
      case 'up': return { dx: 0, dy: -1 };
      case 'down': return { dx: 0, dy: 1 };
      case 'left': return { dx: -1, dy: 0 };
      case 'right': return { dx: 1, dy: 0 };
      default: return { dx: 0, dy: 0 };
    }
  }

  attemptMove(dir, maze) {
    if (!dir) return false;
    const { dx, dy } = this.getOffsetForDirection(dir);
    const newX = this.gridX + dx;
    const newY = this.gridY + dy;

    // Face the direction immediately
    this.direction = dir;

    if (maze && maze.isWalkable(newX, newY)) {
      this.targetX = newX;
      this.targetY = newY;
      this.isMoving = true;
      if (window.sound) window.sound.playStep();
      return true;
    } else {
      return false;
    }
  }

  takeDamage() {
    if (this.invulnerableTimer > 0) return false;
    this.invulnerableTimer = this.invulnerableDuration;
    if (window.sound) window.sound.playHit();
    return true;
  }

  isInvulnerable() {
    return this.invulnerableTimer > 0;
  }

  shouldDraw() {
    if (this.invulnerableTimer <= 0) return true;
    // Flicker during invulnerability
    return Math.floor(this.invulnerableTimer * this.flickerSpeed) % 2 === 0;
  }

  update(dt, maze) {
    // Tick invulnerability
    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer = Math.max(0, this.invulnerableTimer - dt);
    }

    if (this.isMoving) {
      // Step timer for footstep walk frames
      this.walkTimer += dt * 8;
      this.walkFrame = Math.floor(this.walkTimer) % 2;

      // Move render coordinates towards target
      const dx = this.targetX - this.renderX;
      const dy = this.targetY - this.renderY;
      const dist = Math.hypot(dx, dy);
      const step = this.speed * dt;

      if (dist <= step) {
        // Arrived at target grid cell!
        this.renderX = this.targetX;
        this.renderY = this.targetY;
        this.gridX = this.targetX;
        this.gridY = this.targetY;
        this.isMoving = false;

        // 1. Try buffered turn direction first
        let moved = false;
        if (this.nextDirection) {
          moved = this.attemptMove(this.nextDirection, maze);
          if (moved) {
            this.nextDirection = null;
          }
        }

        // 2. If no turn, check if currently held key direction can continue
        if (!moved && this.heldDirection) {
          moved = this.attemptMove(this.heldDirection, maze);
        }
      } else {
        this.renderX += (dx / dist) * step;
        this.renderY += (dy / dist) * step;
      }
    } else {
      // Stationary / Idle
      this.walkFrame = 0;

      // Try next queued direction or currently held direction
      if (this.nextDirection) {
        if (this.attemptMove(this.nextDirection, maze)) {
          this.nextDirection = null;
        }
      } else if (this.heldDirection) {
        this.attemptMove(this.heldDirection, maze);
      }
    }
  }
}

if (typeof window !== 'undefined') {
  window.Player = Player;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Player;
}

