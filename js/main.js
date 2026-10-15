/**
 * main.js - Master Game Controller & State Machine
 * Coordinates input, game loop, entity interactions, audio, and UI transitions.
 */

const STATE = {
  MENU: 'MENU',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  GAMEOVER: 'GAMEOVER',
  VICTORY: 'VICTORY',
  AI_REVEAL: 'AI_REVEAL'
};

class GameController {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.state = STATE.MENU;

    // Subsystems
    this.maze = new window.Maze();
    this.player = new window.Player(this.maze.playerStart.x, this.maze.playerStart.y);
    this.enemy = new window.Enemy(this.maze.enemyStart.x, this.maze.enemyStart.y);
    this.renderer = new window.GameRenderer(this.canvas);

    // Gameplay Statistics
    this.score = 0;
    this.lives = 3;
    this.maxLives = 3;
    this.timer = 0;
    this.level = 1;

    // AI Hunter Level 4 Reveal session tracking
    this.hasShownAiActivation = false;
    this.revealTimer = 0;
    this.revealDuration = 2.0;

    // Load persisted best score (seed with 1240 matching reference image)
    this.bestScore = parseInt(localStorage.getItem('maze_runner_best_score') || '1240', 10);

    // Settings
    this.settings = {
      sound: true,
      volume: 0.4,
      crt: true,
      screenShake: true
    };

    // Timing
    this.lastTime = 0;
    this.elapsedRealTime = 0;

    // Cached UI elements
    this.ui = {
      menu: document.getElementById('main-menu'),
      hud: document.getElementById('game-hud'),
      hudScore: document.getElementById('hud-score'),
      hudRelics: document.getElementById('hud-relics'),
      hudTimer: document.getElementById('hud-timer'),
      hudLevel: document.getElementById('hud-level'),
      hudLives: document.getElementById('hud-lives'),
      hudPauseBtn: document.getElementById('hud-pause-btn'),
      menuBestScore: document.getElementById('menu-best-score'),
      pauseScreen: document.getElementById('pause-screen'),
      gameOverScreen: document.getElementById('game-over-screen'),
      victoryScreen: document.getElementById('victory-screen'),
      aiActivationScreen: document.getElementById('ai-activation-screen'),
      aiLabScreen: document.getElementById('ai-lab-screen'),
      howToPlayScreen: document.getElementById('how-to-play-screen'),
      settingsScreen: document.getElementById('settings-screen'),
      crtOverlay: document.getElementById('crt-overlay')
    };

    this.init();
  }

  init() {
    this.updateBestScoreDisplay();
    this.bindEvents();
    this.bindButtons();

    // Start requestAnimationFrame loop
    this.lastTime = performance.now();
    requestAnimationFrame(this.gameLoop.bind(this));
  }

  updateBestScoreDisplay() {
    if (this.ui.menuBestScore) {
      this.ui.menuBestScore.textContent = this.bestScore.toString();
    }
  }

  saveBestScore() {
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      localStorage.setItem('maze_runner_best_score', this.bestScore.toString());
      this.updateBestScoreDisplay();
    }
  }

  /* -------------------------------------------------------------
   * INPUT HANDLING
   * ------------------------------------------------------------- */
  getDirectionFromCode(code) {
    switch (code) {
      case 'ArrowUp':
      case 'KeyW':
        return 'up';
      case 'ArrowDown':
      case 'KeyS':
        return 'down';
      case 'ArrowLeft':
      case 'KeyA':
        return 'left';
      case 'ArrowRight':
      case 'KeyD':
        return 'right';
      default:
        return null;
    }
  }

  updatePlayerHeldDirection() {
    // Find the most recently pressed active direction
    let activeDir = null;
    for (const code of this.keysHeld) {
      const dir = this.getDirectionFromCode(code);
      if (dir) activeDir = dir;
    }
    this.player.setHeldDirection(activeDir);
  }

  bindEvents() {
    this.keysHeld = new Set();

    window.addEventListener('keydown', e => {
      // Audio unlock on initial user gesture
      if (window.sound) window.sound.ensureContext();

      // Navigation / Controls when playing
      if (this.state === STATE.PLAYING) {
        const moveDir = this.getDirectionFromCode(e.code);
        if (moveDir) {
          e.preventDefault();
          this.keysHeld.add(e.code);
          this.player.setHeldDirection(moveDir);
          return;
        }

        switch (e.code) {
          case 'KeyP':
          case 'Escape':
            e.preventDefault();
            this.togglePause();
            break;
          case 'KeyR':
            e.preventDefault();
            this.restartLevel();
            break;
        }
      } else if (this.state === STATE.PAUSED) {
        if (e.code === 'KeyP' || e.code === 'Escape') {
          e.preventDefault();
          this.togglePause();
        }
      } else if (this.state === STATE.GAMEOVER) {
        if (e.code === 'KeyR' || e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          this.restartLevel();
        }
      } else if (this.state === STATE.VICTORY) {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          this.nextLevel();
        }
      }
    });

    window.addEventListener('keyup', e => {
      if (this.keysHeld.has(e.code)) {
        this.keysHeld.delete(e.code);
        if (this.state === STATE.PLAYING) {
          this.updatePlayerHeldDirection();
        }
      }
    });
  }

  bindButtons() {
    // Menu navigation
    const playBtn = document.getElementById('btn-play');
    if (playBtn) {
      playBtn.addEventListener('click', () => {
        if (window.sound) window.sound.playClick();
        this.startGame();
      });
    }

    const aiLabBtn = document.getElementById('btn-ai-lab');
    if (aiLabBtn) {
      aiLabBtn.addEventListener('click', () => {
        if (window.sound) window.sound.playClick();
        this.updateAiLabTelemetry();
        this.ui.aiLabScreen.classList.remove('hidden');
      });
    }

    const howBtn = document.getElementById('btn-how-to-play');
    if (howBtn) {
      howBtn.addEventListener('click', () => {
        if (window.sound) window.sound.playClick();
        this.ui.howToPlayScreen.classList.remove('hidden');
      });
    }

    const setBtn = document.getElementById('btn-settings');
    if (setBtn) {
      setBtn.addEventListener('click', () => {
        if (window.sound) window.sound.playClick();
        this.ui.settingsScreen.classList.remove('hidden');
      });
    }

    // Close buttons for modals
    document.getElementById('btn-close-ai-lab')?.addEventListener('click', () => {
      if (window.sound) window.sound.playClick();
      this.ui.aiLabScreen.classList.add('hidden');
    });
    document.getElementById('btn-back-ai-lab')?.addEventListener('click', () => {
      if (window.sound) window.sound.playClick();
      this.ui.aiLabScreen.classList.add('hidden');
    });

    document.getElementById('btn-close-how')?.addEventListener('click', () => {
      if (window.sound) window.sound.playClick();
      this.ui.howToPlayScreen.classList.add('hidden');
    });
    document.getElementById('btn-back-how')?.addEventListener('click', () => {
      if (window.sound) window.sound.playClick();
      this.ui.howToPlayScreen.classList.add('hidden');
    });

    document.getElementById('btn-close-settings')?.addEventListener('click', () => {
      if (window.sound) window.sound.playClick();
      this.ui.settingsScreen.classList.add('hidden');
    });
    document.getElementById('btn-back-settings')?.addEventListener('click', () => {
      if (window.sound) window.sound.playClick();
      this.ui.settingsScreen.classList.add('hidden');
    });

    // Pause screen buttons
    this.ui.hudPauseBtn?.addEventListener('click', () => this.togglePause());
    document.getElementById('btn-resume')?.addEventListener('click', () => this.togglePause());
    document.getElementById('btn-pause-restart')?.addEventListener('click', () => this.restartLevel());
    document.getElementById('btn-pause-menu')?.addEventListener('click', () => this.returnToMenu());

    // Game Over buttons
    document.getElementById('btn-game-over-restart')?.addEventListener('click', () => this.restartLevel());
    document.getElementById('btn-game-over-menu')?.addEventListener('click', () => this.returnToMenu());

    // Victory buttons
    document.getElementById('btn-victory-next')?.addEventListener('click', () => this.nextLevel());
    document.getElementById('btn-victory-menu')?.addEventListener('click', () => this.returnToMenu());

    // Settings Controls
    const toggleSoundBtn = document.getElementById('toggle-sound');
    if (toggleSoundBtn) {
      toggleSoundBtn.addEventListener('click', () => {
        this.settings.sound = !this.settings.sound;
        if (window.sound) window.sound.enabled = this.settings.sound;
        toggleSoundBtn.textContent = this.settings.sound ? 'ENABLED' : 'MUTED';
        toggleSoundBtn.classList.toggle('active', this.settings.sound);
        if (window.sound) window.sound.playClick();
      });
    }

    const volumeSlider = document.getElementById('volume-slider');
    if (volumeSlider) {
      volumeSlider.addEventListener('input', e => {
        this.settings.volume = parseFloat(e.target.value);
        if (window.sound) window.sound.setVolume(this.settings.volume);
      });
    }

    const toggleCrtBtn = document.getElementById('toggle-crt');
    if (toggleCrtBtn) {
      toggleCrtBtn.addEventListener('click', () => {
        this.settings.crt = !this.settings.crt;
        this.ui.crtOverlay.classList.toggle('disabled', !this.settings.crt);
        toggleCrtBtn.textContent = this.settings.crt ? 'ENABLED' : 'DISABLED';
        toggleCrtBtn.classList.toggle('active', this.settings.crt);
        if (window.sound) window.sound.playClick();
      });
    }

    const toggleShakeBtn = document.getElementById('toggle-shake');
    if (toggleShakeBtn) {
      toggleShakeBtn.addEventListener('click', () => {
        this.settings.screenShake = !this.settings.screenShake;
        toggleShakeBtn.textContent = this.settings.screenShake ? 'ENABLED' : 'DISABLED';
        toggleShakeBtn.classList.toggle('active', this.settings.screenShake);
        if (window.sound) window.sound.playClick();
      });
    }

    const resetScoreBtn = document.getElementById('btn-reset-score');
    if (resetScoreBtn) {
      resetScoreBtn.addEventListener('click', () => {
        this.bestScore = 0;
        localStorage.setItem('maze_runner_best_score', '0');
        this.updateBestScoreDisplay();
        if (window.sound) window.sound.playClick();
      });
    }

    // AI Lab Simulation Tuning Sliders
    const speedSlider = document.getElementById('ai-speed-slider');
    const speedVal = document.getElementById('ai-speed-val');
    if (speedSlider && speedVal) {
      speedSlider.addEventListener('input', e => {
        const val = parseFloat(e.target.value);
        speedVal.textContent = val.toFixed(1);
        if (this.enemy) this.enemy.speed = val;
      });
    }

    const losSlider = document.getElementById('ai-los-slider');
    const losVal = document.getElementById('ai-los-val');
    if (losSlider && losVal) {
      losSlider.addEventListener('input', e => {
        const val = parseInt(e.target.value, 10);
        losVal.textContent = val.toString();
      });
    }
  }

  /* -------------------------------------------------------------
   * STATE TRANSITIONS
   * ------------------------------------------------------------- */
  updateAiLabTelemetry() {
    if (!this.enemy) return;
    const stats = this.enemy.aiStats;
    const trackEl = document.getElementById('telemetry-tracking');
    const nodesEl = document.getElementById('telemetry-nodes');
    const durEl = document.getElementById('telemetry-duration');
    const pathEl = document.getElementById('telemetry-path');

    if (trackEl) {
      trackEl.textContent = this.enemy.hunterMode === 'basic'
        ? 'BASIC CORRIDOR PATROL'
        : `A* PATHFINDING AI (${stats ? stats.status : 'ACTIVE'})`;
    }
    if (nodesEl) nodesEl.textContent = (stats ? stats.exploredNodes : 0).toString();
    if (durEl) durEl.textContent = `${(stats ? stats.durationMs : 0).toFixed(2)} ms`;
    if (pathEl) pathEl.textContent = `${stats ? stats.pathLength : 0} steps`;
  }

  startGame() {
    document.activeElement?.blur();
    this.score = 0;
    this.lives = this.maxLives;
    this.timer = 0;
    
    // Support safe development query parameter ?level=N
    const urlParams = (typeof window !== 'undefined' && window.location) ? new URLSearchParams(window.location.search) : null;
    const paramLvl = urlParams ? parseInt(urlParams.get('level'), 10) : NaN;
    this.level = (Number.isFinite(paramLvl) && paramLvl > 0) ? paramLvl : 1;
    this.hasShownAiActivation = false; // Fresh game session allows reveal at Level 4

    if (this.keysHeld) this.keysHeld.clear();
    this.maze.loadLevel(this.level);
    this.player.reset(this.maze.playerStart.x, this.maze.playerStart.y);
    this.enemy.setLevel(this.level);
    this.enemy.reset(this.maze.enemyStart.x, this.maze.enemyStart.y);

    this.lastTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (this.enemy) {
      this.enemy.stepCooldown = Math.max(this.enemy.stepCooldown, 0.2);
    }

    this.hideAllModals();
    this.ui.menu.classList.add('hidden');
    this.ui.hud.classList.remove('hidden');

    this.updateHUD();
    
    if (this.level === 4 && !this.hasShownAiActivation) {
      this.triggerAiActivation();
    } else {
      this.state = STATE.PLAYING;
    }
  }

  restartLevel() {
    document.activeElement?.blur();
    if (this.keysHeld) this.keysHeld.clear();
    this.score = 0;
    
    // Reload same level layout & relics deterministically
    this.maze.loadLevel(this.level);
    this.player.reset(this.maze.playerStart.x, this.maze.playerStart.y);
    this.enemy.setLevel(this.level);
    this.enemy.reset(this.maze.enemyStart.x, this.maze.enemyStart.y);

    this.lastTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (this.enemy) {
      this.enemy.stepCooldown = Math.max(this.enemy.stepCooldown, 0.2);
    }

    this.lives = this.maxLives;
    this.timer = 0;

    this.hideAllModals();
    this.ui.hud.classList.remove('hidden');
    this.updateHUD();

    this.state = STATE.PLAYING;
    if (window.sound) window.sound.playClick();
  }

  nextLevel() {
    if (this.keysHeld) this.keysHeld.clear();
    this.level++;
    
    // Deterministic progression for new level
    this.maze.loadLevel(this.level);
    this.player.reset(this.maze.playerStart.x, this.maze.playerStart.y);
    this.enemy.setLevel(this.level);
    this.enemy.reset(this.maze.enemyStart.x, this.maze.enemyStart.y);

    this.lastTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (this.enemy) {
      this.enemy.stepCooldown = Math.max(this.enemy.stepCooldown, 0.2);
    }

    this.timer = 0;

    this.hideAllModals();
    this.ui.hud.classList.remove('hidden');
    this.updateHUD();

    // Check one-time AI Hunter activation sequence on reaching Level 4
    if (this.level === 4 && !this.hasShownAiActivation) {
      this.triggerAiActivation();
    } else {
      this.state = STATE.PLAYING;
      if (window.sound) window.sound.playClick();
    }
  }

  triggerAiActivation() {
    this.hasShownAiActivation = true;
    this.state = STATE.AI_REVEAL;
    this.revealTimer = 0;
    this.player.setHeldDirection(null);
    if (this.keysHeld) this.keysHeld.clear();

    if (this.ui.aiActivationScreen) {
      this.ui.aiActivationScreen.classList.remove('hidden');
    }
    if (window.sound) {
      window.sound.playAiActivation();
    }
    if (this.settings.screenShake) {
      this.renderer.triggerShake(5, 0.4);
    }
  }

  returnToMenu() {
    document.activeElement?.blur();
    if (this.keysHeld) this.keysHeld.clear();
    this.hideAllModals();
    this.ui.hud.classList.add('hidden');
    this.ui.menu.classList.remove('hidden');
    this.updateBestScoreDisplay();
    this.state = STATE.MENU;
    if (window.sound) window.sound.playClick();
  }

  togglePause() {
    if (this.state === STATE.AI_REVEAL) return; // Disallow pause during activation reveal
    document.activeElement?.blur();
    if (this.state === STATE.PLAYING) {
      this.state = STATE.PAUSED;
      this.ui.pauseScreen.classList.remove('hidden');
      if (window.sound) window.sound.playClick();
    } else if (this.state === STATE.PAUSED) {
      this.state = STATE.PLAYING;
      this.lastTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      if (this.enemy) {
        this.enemy.stepCooldown = Math.max(this.enemy.stepCooldown, 0.15);
      }
      this.ui.pauseScreen.classList.add('hidden');
      if (window.sound) window.sound.playClick();
    }
  }

  handleGameOver() {
    this.state = STATE.GAMEOVER;
    this.saveBestScore();

    if (window.sound) window.sound.playGameOver();

    // Populate Game Over stats
    document.getElementById('go-score').textContent = this.score.toString();
    document.getElementById('go-time').textContent = this.formatTime(this.timer);
    document.getElementById('go-relics').textContent = `${this.maze.collectedCount}/${this.maze.totalRelics}`;

    this.ui.gameOverScreen.classList.remove('hidden');
  }

  handleVictory() {
    this.state = STATE.VICTORY;

    // Calculate bonuses
    const timeBonus = Math.max(0, 1000 - Math.floor(this.timer) * 12);
    const totalLevelScore = this.score + timeBonus;
    this.score = totalLevelScore;
    this.saveBestScore();

    if (window.sound) window.sound.playVictory();

    document.getElementById('vic-score').textContent = (this.score - timeBonus).toString();
    document.getElementById('vic-bonus').textContent = `+${timeBonus}`;
    document.getElementById('vic-total').textContent = totalLevelScore.toString();

    this.ui.victoryScreen.classList.remove('hidden');
  }

  hideAllModals() {
    this.ui.pauseScreen?.classList.add('hidden');
    this.ui.gameOverScreen?.classList.add('hidden');
    this.ui.victoryScreen?.classList.add('hidden');
    this.ui.aiActivationScreen?.classList.add('hidden');
  }

  /* -------------------------------------------------------------
   * HUD MANAGEMENT
   * ------------------------------------------------------------- */
  updateHUD() {
    if (this.ui.hudScore) this.ui.hudScore.textContent = this.score.toString();
    if (this.ui.hudRelics) {
      this.ui.hudRelics.textContent = `${this.maze.collectedCount}/${this.maze.totalRelics}`;
      if (this.maze.isExitOpen()) {
        this.ui.hudRelics.textContent = `PORTAL READY!`;
      }
    }
    if (this.ui.hudTimer) this.ui.hudTimer.textContent = this.formatTime(this.timer);
    if (this.ui.hudLevel) this.ui.hudLevel.textContent = this.level.toString();

    // Render Cyan Life Diamonds
    if (this.ui.hudLives) {
      let livesHTML = '';
      for (let i = 0; i < this.maxLives; i++) {
        const isFilled = i < this.lives;
        livesHTML += `<span class="life-icon ${isFilled ? 'full' : 'lost'}">◆</span>`;
      }
      this.ui.hudLives.innerHTML = livesHTML;
    }
  }

  formatTime(seconds) {
    const s = Math.floor(seconds);
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  /* -------------------------------------------------------------
   * MAIN GAME LOOP
   * ------------------------------------------------------------- */
  gameLoop(currentTime) {
    const dt = Math.min((currentTime - this.lastTime) / 1000, 0.05); // Cap delta to prevent tunneling
    this.lastTime = currentTime;
    this.elapsedRealTime += dt;

    if (this.state === STATE.MENU) {
      // Draw atmospheric sunset backdrop panorama matching the reference image!
      this.renderer.renderMenuBackdrop(this.canvas.width, this.canvas.height, this.elapsedRealTime);
    } else if (this.state === STATE.PLAYING) {
      this.timer += dt;

      // 1. Update Player movement and collisions
      this.player.update(dt, this.maze);

      // 2. Check Relic pickup
      if (this.maze.collectAt(this.player.gridX, this.player.gridY)) {
        this.score += 100;
        if (window.sound) window.sound.playPickup();
        if (this.maze.isExitOpen()) {
          if (window.sound) window.sound.playPortalOpen();
          if (this.settings.screenShake) this.renderer.triggerShake(4, 0.25);
        }
        this.updateHUD();
      }

      // 3. Update Enemy AI Hunter
      this.enemy.update(dt, this.maze, this.player);

      // 4. Check Player-Enemy collision
      if (this.enemy.checkCollision(this.player)) {
        const tookDmg = this.player.takeDamage();
        if (tookDmg) {
          this.lives--;
          if (this.settings.screenShake) this.renderer.triggerShake(9, 0.35);
          this.updateHUD();

          if (this.lives <= 0) {
            this.handleGameOver();
          }
        }
      }

      // 5. Check Exit Portal Reach
      if (this.maze.isExitOpen() && this.maze.isExitTile(this.player.gridX, this.player.gridY)) {
        this.handleVictory();
      }

      // 6. Update HUD timer periodically
      this.updateHUD();

      // 7. Render Maze Scene
      this.renderer.renderMaze(
        this.maze,
        this.player,
        this.enemy,
        this.score,
        this.lives,
        this.timer,
        this.level,
        false,
        this.elapsedRealTime
      );
    } else if (this.state === STATE.AI_REVEAL) {
      this.revealTimer += dt;

      // Render static maze beneath warning overlay
      this.renderer.renderMaze(
        this.maze,
        this.player,
        this.enemy,
        this.score,
        this.lives,
        this.timer,
        this.level,
        false,
        this.elapsedRealTime
      );

      // Dismiss overlay and begin active A* gameplay once sequence timer expires
      if (this.revealTimer >= this.revealDuration) {
        if (this.ui.aiActivationScreen) {
          this.ui.aiActivationScreen.classList.add('hidden');
        }
        this.state = STATE.PLAYING;
        this.lastTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        if (this.enemy) {
          this.enemy.stepCooldown = Math.max(this.enemy.stepCooldown, 0.2);
        }
      }
    } else if (this.state === STATE.PAUSED || this.state === STATE.GAMEOVER || this.state === STATE.VICTORY) {
      // Keep rendering static/dimmed maze under modal
      this.renderer.renderMaze(
        this.maze,
        this.player,
        this.enemy,
        this.score,
        this.lives,
        this.timer,
        this.level,
        true,
        this.elapsedRealTime
      );
    }

    requestAnimationFrame(this.gameLoop.bind(this));
  }
}

// Instantiate master controller when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  window.game = new GameController();
});
