/**
 * main.js - Master Game Controller & State Machine
 * Coordinates input, game loop, entity interactions, audio, level progression,
 * completion summaries, persistent records, and UI transitions.
 */

const STATE = {
  MENU: 'MENU',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  GAMEOVER: 'GAMEOVER',
  VICTORY: 'VICTORY',
  AI_REVEAL: 'AI_REVEAL'
};

const RECORDS_STORAGE_KEY = 'maze_runner_records_v1';

/**
 * Default empty records data structure
 */
function getDefaultRecords() {
  return {
    version: 1,
    highestLevel: 1,
    totalCompletedLevels: 0,
    bestRunScore: 0,
    bestTimes: {},  // { [level]: timeMs }
    bestScores: {}  // { [level]: score }
  };
}

/**
 * Validate and sanitize loaded record data
 */
function validateAndNormalizeRecords(data) {
  if (typeof data !== 'object' || data === null || data.version !== 1) {
    return getDefaultRecords();
  }
  const clean = {
    version: 1,
    highestLevel: Number.isInteger(data.highestLevel) && data.highestLevel >= 1 ? data.highestLevel : 1,
    totalCompletedLevels: Number.isInteger(data.totalCompletedLevels) && data.totalCompletedLevels >= 0 ? data.totalCompletedLevels : 0,
    bestRunScore: Number.isInteger(data.bestRunScore) && data.bestRunScore >= 0 ? data.bestRunScore : 0,
    bestTimes: {},
    bestScores: {}
  };

  if (typeof data.bestTimes === 'object' && data.bestTimes !== null) {
    for (const [k, v] of Object.entries(data.bestTimes)) {
      const lvl = parseInt(k, 10);
      if (Number.isInteger(lvl) && lvl >= 1 && typeof v === 'number' && v > 0) {
        clean.bestTimes[lvl] = Math.round(v);
      }
    }
  }

  if (typeof data.bestScores === 'object' && data.bestScores !== null) {
    for (const [k, v] of Object.entries(data.bestScores)) {
      const lvl = parseInt(k, 10);
      if (Number.isInteger(lvl) && lvl >= 1 && typeof v === 'number' && v >= 0) {
        clean.bestScores[lvl] = Math.round(v);
      }
    }
  }

  return clean;
}

class GameController {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.state = STATE.MENU;

    // Subsystems
    const MazeClass = (typeof window !== 'undefined' && window.Maze) ? window.Maze : require('./maze.js').Maze;
    const PlayerClass = (typeof window !== 'undefined' && window.Player) ? window.Player : require('./player.js');
    const EnemyClass = (typeof window !== 'undefined' && window.Enemy) ? window.Enemy : require('./enemy.js');
    const RendererClass = (typeof window !== 'undefined' && window.GameRenderer) ? window.GameRenderer : require('./renderer.js');

    this.maze = new MazeClass();
    this.player = new PlayerClass(this.maze.playerStart.x, this.maze.playerStart.y);
    this.enemy = new EnemyClass(this.maze.enemyStart.x, this.maze.enemyStart.y);
    this.renderer = this.canvas ? new RendererClass(this.canvas) : null;

    // Gameplay Statistics
    this.score = 0;
    this.lives = 3;
    this.maxLives = 3;
    this.timer = 0;
    this.level = 1;
    this.currentSeed = null;

    // Encounter and Proximity telemetry
    this.hunterEncounters = 0;
    this._inProximityZone = false;
    this.isLevelTransitioning = false;

    // AI Hunter Level 4 Reveal session tracking
    this.hasShownAiActivation = false;
    this.revealTimer = 0;
    this.revealDuration = 2.0;

    // Versioned Persistent Records
    this.records = this.loadRecords();
    this.bestScore = Math.max(
      this.records.bestRunScore || 0,
      parseInt(this.getLegacyStorage('maze_runner_best_score') || '1240', 10)
    );
    this.records.bestRunScore = Math.max(this.records.bestRunScore, this.bestScore);
    this.saveRecords();

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
      pauseSeedTag: document.getElementById('pause-seed-tag'),
      gameOverScreen: document.getElementById('game-over-screen'),
      victoryScreen: document.getElementById('victory-screen'),
      transitionScreen: document.getElementById('level-transition-screen'),
      recordsScreen: document.getElementById('records-screen'),
      recHighestLevel: document.getElementById('rec-highest-level'),
      recTotalCleared: document.getElementById('rec-total-cleared'),
      recBestRunScore: document.getElementById('rec-best-run-score'),
      aiActivationScreen: document.getElementById('ai-activation-screen'),
      aiLabScreen: document.getElementById('ai-lab-screen'),
      howToPlayScreen: document.getElementById('how-to-play-screen'),
      settingsScreen: document.getElementById('settings-screen'),
      crtOverlay: document.getElementById('crt-overlay'),
      telemetrySeed: document.getElementById('telemetry-seed')
    };

    this.init();
  }

  getLegacyStorage(key) {
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(key);
      }
    } catch (e) {}
    return null;
  }

  loadRecords() {
    try {
      if (typeof localStorage === 'undefined') return getDefaultRecords();
      const raw = localStorage.getItem(RECORDS_STORAGE_KEY);
      if (!raw) return getDefaultRecords();
      return validateAndNormalizeRecords(JSON.parse(raw));
    } catch (e) {
      return getDefaultRecords();
    }
  }

  saveRecords() {
    try {
      if (typeof localStorage === 'undefined') return false;
      localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(this.records));
      return true;
    } catch (e) {
      console.warn('Failed to save records to localStorage:', e);
      return false;
    }
  }

  init() {
    this.updateBestScoreDisplay();
    this.bindEvents();
    this.bindButtons();

    // Start requestAnimationFrame loop if canvas and rAF present
    if (this.canvas && typeof requestAnimationFrame === 'function') {
      this.lastTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      requestAnimationFrame(this.gameLoop.bind(this));
    }
  }

  updateBestScoreDisplay() {
    if (this.ui.menuBestScore) {
      this.ui.menuBestScore.textContent = this.bestScore.toString();
    }
  }

  saveBestScore() {
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('maze_runner_best_score', this.bestScore.toString());
        }
      } catch (e) {}
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
    let activeDir = null;
    for (const code of this.keysHeld) {
      const dir = this.getDirectionFromCode(code);
      if (dir) activeDir = dir;
    }
    this.player.setHeldDirection(activeDir);
  }

  bindEvents() {
    this.keysHeld = new Set();
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;

    window.addEventListener('keydown', e => {
      if (window.sound) window.sound.ensureContext();

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
        } else if (e.code === 'KeyR') {
          e.preventDefault();
          this.restartLevel();
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
        } else if (e.code === 'KeyR') {
          e.preventDefault();
          this.replayLevel();
        } else if (e.code === 'Escape' || e.code === 'KeyM') {
          e.preventDefault();
          this.returnToMenu();
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
    document.getElementById('btn-play')?.addEventListener('click', () => {
      if (window.sound) window.sound.playClick();
      this.startGame();
    });

    document.getElementById('btn-records')?.addEventListener('click', () => {
      if (window.sound) window.sound.playClick();
      this.openRecordsScreen();
    });

    document.getElementById('btn-ai-lab')?.addEventListener('click', () => {
      if (window.sound) window.sound.playClick();
      this.updateAiLabTelemetry();
      this.ui.aiLabScreen?.classList.remove('hidden');
    });

    document.getElementById('btn-how-to-play')?.addEventListener('click', () => {
      if (window.sound) window.sound.playClick();
      this.ui.howToPlayScreen?.classList.remove('hidden');
    });

    document.getElementById('btn-settings')?.addEventListener('click', () => {
      if (window.sound) window.sound.playClick();
      this.ui.settingsScreen?.classList.remove('hidden');
    });

    // Close buttons for modals
    document.getElementById('btn-close-records')?.addEventListener('click', () => {
      if (window.sound) window.sound.playClick();
      this.ui.recordsScreen?.classList.add('hidden');
    });
    document.getElementById('btn-back-records')?.addEventListener('click', () => {
      if (window.sound) window.sound.playClick();
      this.ui.recordsScreen?.classList.add('hidden');
    });
    document.getElementById('btn-reset-records')?.addEventListener('click', () => {
      if (window.sound) window.sound.playClick();
      this.resetAllRecords();
    });

    document.getElementById('btn-close-ai-lab')?.addEventListener('click', () => {
      if (window.sound) window.sound.playClick();
      this.ui.aiLabScreen?.classList.add('hidden');
    });
    document.getElementById('btn-back-ai-lab')?.addEventListener('click', () => {
      if (window.sound) window.sound.playClick();
      this.ui.aiLabScreen?.classList.add('hidden');
    });

    document.getElementById('btn-close-how')?.addEventListener('click', () => {
      if (window.sound) window.sound.playClick();
      this.ui.howToPlayScreen?.classList.add('hidden');
    });
    document.getElementById('btn-back-how')?.addEventListener('click', () => {
      if (window.sound) window.sound.playClick();
      this.ui.howToPlayScreen?.classList.add('hidden');
    });

    document.getElementById('btn-close-settings')?.addEventListener('click', () => {
      if (window.sound) window.sound.playClick();
      this.ui.settingsScreen?.classList.add('hidden');
    });
    document.getElementById('btn-back-settings')?.addEventListener('click', () => {
      if (window.sound) window.sound.playClick();
      this.ui.settingsScreen?.classList.add('hidden');
    });

    // Pause screen buttons
    this.ui.hudPauseBtn?.addEventListener('click', () => this.togglePause());
    document.getElementById('btn-resume')?.addEventListener('click', () => this.togglePause());
    document.getElementById('btn-pause-restart')?.addEventListener('click', () => this.restartLevel());
    document.getElementById('btn-pause-menu')?.addEventListener('click', () => this.returnToMenu());

    // Game Over buttons
    document.getElementById('btn-game-over-restart')?.addEventListener('click', () => this.restartLevel());
    document.getElementById('btn-game-over-menu')?.addEventListener('click', () => this.returnToMenu());

    // Victory / Level Complete buttons
    document.getElementById('btn-victory-next')?.addEventListener('click', () => this.nextLevel());
    document.getElementById('btn-victory-replay')?.addEventListener('click', () => this.replayLevel());
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
        this.ui.crtOverlay?.classList.toggle('disabled', !this.settings.crt);
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
        this.resetAllRecords();
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
   * STATE TRANSITIONS & LEVEL FLOW
   * ------------------------------------------------------------- */
  updateAiLabTelemetry() {
    if (!this.enemy) return;
    const stats = this.enemy.aiStats;
    const trackEl = document.getElementById('telemetry-tracking');
    const nodesEl = document.getElementById('telemetry-nodes');
    const durEl = document.getElementById('telemetry-duration');
    const pathEl = document.getElementById('telemetry-path');
    const seedEl = document.getElementById('telemetry-seed');

    if (trackEl) {
      trackEl.textContent = this.enemy.hunterMode === 'basic'
        ? 'BASIC CORRIDOR PATROL'
        : `A* PATHFINDING AI (${stats ? stats.status : 'ACTIVE'})`;
    }
    if (nodesEl) nodesEl.textContent = (stats ? stats.exploredNodes : 0).toString();
    if (durEl) durEl.textContent = `${(stats ? stats.durationMs : 0).toFixed(2)} ms`;
    if (pathEl) pathEl.textContent = `${stats ? stats.pathLength : 0} steps`;
    if (seedEl) seedEl.textContent = this.maze.seed !== null ? `#${this.maze.seed}` : '#N/A';
  }

  updateSeedDisplay() {
    const seedVal = this.maze && this.maze.seed !== null ? `#${this.maze.seed}` : '#N/A';
    if (this.ui.pauseSeedTag) {
      this.ui.pauseSeedTag.textContent = `SECTOR SEED: ${seedVal}`;
    }
    if (this.ui.telemetrySeed) {
      this.ui.telemetrySeed.textContent = seedVal;
    }
  }

  loadLevelAndReset(level, customSeed) {
    this.currentSeed = (customSeed !== undefined && customSeed !== null)
      ? customSeed
      : ((level * 10007 + 42) >>> 0);

    this.maze.loadLevel(level, this.currentSeed);
    this.player.reset(this.maze.playerStart.x, this.maze.playerStart.y);
    this.enemy.setLevel(level);
    this.enemy.reset(this.maze.enemyStart.x, this.maze.enemyStart.y);

    this.timer = 0;
    this.hunterEncounters = 0;
    this._inProximityZone = false;
    this.isLevelTransitioning = false;

    if (this.keysHeld) this.keysHeld.clear();
    this.player.setHeldDirection(null);

    this.lastTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (this.enemy) {
      this.enemy.stepCooldown = Math.max(this.enemy.stepCooldown, 0.2);
    }

    this.updateHUD();
    this.updateSeedDisplay();
  }

  startGame() {
    document.activeElement?.blur();
    this.score = 0;
    this.lives = this.maxLives;
    this.timer = 0;
    this.hunterEncounters = 0;
    this._inProximityZone = false;
    this.isLevelTransitioning = false;
    
    // Support safe development query parameter ?level=N
    const urlParams = (typeof window !== 'undefined' && window.location) ? new URLSearchParams(window.location.search) : null;
    const paramLvl = urlParams ? parseInt(urlParams.get('level'), 10) : NaN;
    this.level = (Number.isFinite(paramLvl) && paramLvl > 0) ? paramLvl : 1;
    this.hasShownAiActivation = false; // Fresh game session allows reveal at Level 4

    this.loadLevelAndReset(this.level);

    this.hideAllModals();
    this.ui.menu?.classList.add('hidden');
    this.ui.hud?.classList.remove('hidden');

    this.updateHUD();
    
    if (this.level === 4 && !this.hasShownAiActivation) {
      this.triggerAiActivation();
    } else {
      this.state = STATE.PLAYING;
    }
  }

  restartLevel() {
    if (this.isLevelTransitioning) return;
    document.activeElement?.blur();
    
    // Reload same level layout & relics deterministically with exact same seed
    this.loadLevelAndReset(this.level, this.maze.seed);

    this.lives = this.maxLives;
    this.score = 0;

    this.hideAllModals();
    this.ui.hud?.classList.remove('hidden');
    this.updateHUD();

    this.state = STATE.PLAYING;
    if (window.sound) window.sound.playClick();
  }

  replayLevel() {
    if (this.isLevelTransitioning) return;
    document.activeElement?.blur();

    // Replay current level preserving its exact seed and layout
    this.loadLevelAndReset(this.level, this.maze.seed);

    this.hideAllModals();
    this.ui.hud?.classList.remove('hidden');
    this.updateHUD();

    this.state = STATE.PLAYING;
    if (window.sound) window.sound.playClick();
  }

  nextLevel() {
    if (this.isLevelTransitioning) return;
    if (this.state !== STATE.VICTORY && this.state !== STATE.PLAYING) return;
    this.isLevelTransitioning = true;
    document.activeElement?.blur();

    const targetLevel = this.level + 1;

    // Dismiss victory screen
    this.ui.victoryScreen?.classList.add('hidden');

    // Display transition overlay
    if (this.ui.transitionScreen) {
      const transTitle = document.getElementById('trans-title');
      const transTheme = document.getElementById('trans-theme');
      if (transTitle) transTitle.textContent = `PREPARING LEVEL ${targetLevel.toString().padStart(2, '0')}...`;
      if (transTheme) {
        const THEME_KEYS = Object.keys(window.MAZE_THEMES || {});
        const themeKey = THEME_KEYS[(targetLevel - 1) % THEME_KEYS.length];
        const themeName = window.MAZE_THEMES ? window.MAZE_THEMES[themeKey].name : 'ANCIENT RUINS';
        transTheme.textContent = `[${themeName.toUpperCase()}]`;
      }
      this.ui.transitionScreen.classList.remove('hidden');
    }

    if (window.sound) window.sound.playLevelTransition();

    // Responsive transition delay (600ms)
    setTimeout(() => {
      this.level = targetLevel;
      this.loadLevelAndReset(this.level);

      this.ui.transitionScreen?.classList.add('hidden');
      this.isLevelTransitioning = false;

      // Check one-time AI Hunter activation sequence on reaching Level 4
      if (this.level === 4 && !this.hasShownAiActivation) {
        this.triggerAiActivation();
      } else {
        this.state = STATE.PLAYING;
      }
    }, 600);
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
    if (this.settings.screenShake && this.renderer) {
      this.renderer.triggerShake(5, 0.4);
    }
  }

  returnToMenu() {
    document.activeElement?.blur();
    this.isLevelTransitioning = false;
    if (this.keysHeld) this.keysHeld.clear();
    this.hideAllModals();
    this.ui.hud?.classList.add('hidden');
    this.ui.menu?.classList.remove('hidden');
    this.updateBestScoreDisplay();
    this.state = STATE.MENU;
    if (window.sound) window.sound.playClick();
  }

  togglePause() {
    if (this.state === STATE.AI_REVEAL || this.isLevelTransitioning) return;
    document.activeElement?.blur();
    if (this.state === STATE.PLAYING) {
      this.state = STATE.PAUSED;
      this.updateSeedDisplay();
      this.ui.pauseScreen?.classList.remove('hidden');
      if (window.sound) window.sound.playClick();
    } else if (this.state === STATE.PAUSED) {
      this.state = STATE.PLAYING;
      this.lastTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      if (this.enemy) {
        this.enemy.stepCooldown = Math.max(this.enemy.stepCooldown, 0.15);
      }
      this.ui.pauseScreen?.classList.add('hidden');
      if (window.sound) window.sound.playClick();
    }
  }

  handleGameOver() {
    this.state = STATE.GAMEOVER;
    this.saveBestScore();

    if (window.sound) window.sound.playGameOver();

    // Populate Game Over stats
    const goScoreEl = document.getElementById('go-score');
    const goTimeEl = document.getElementById('go-time');
    const goRelicsEl = document.getElementById('go-relics');

    if (goScoreEl) goScoreEl.textContent = this.score.toString();
    if (goTimeEl) goTimeEl.textContent = this.formatTime(this.timer);
    if (goRelicsEl) goRelicsEl.textContent = `${this.maze.collectedCount}/${this.maze.totalRelics}`;

    this.ui.gameOverScreen?.classList.remove('hidden');
  }

  handleVictory() {
    if (this.state !== STATE.PLAYING) return;
    this.state = STATE.VICTORY;

    const levelTimeMs = Math.round(this.timer * 1000);
    const timeBonus = Math.max(0, 1000 - Math.floor(this.timer) * 12);
    const totalLevelScore = this.score + timeBonus;
    this.score = totalLevelScore;

    // Check records
    let isNewBestTime = false;
    const prevBestTime = this.records.bestTimes[this.level];
    if (prevBestTime === undefined || levelTimeMs < prevBestTime) {
      this.records.bestTimes[this.level] = levelTimeMs;
      isNewBestTime = true;
    }

    const prevBestScore = this.records.bestScores[this.level];
    if (prevBestScore === undefined || totalLevelScore > prevBestScore) {
      this.records.bestScores[this.level] = totalLevelScore;
    }

    this.records.highestLevel = Math.max(this.records.highestLevel || 1, this.level + 1);
    this.records.totalCompletedLevels = (this.records.totalCompletedLevels || 0) + 1;
    this.records.bestRunScore = Math.max(this.records.bestRunScore || 0, this.score);

    this.saveRecords();
    this.saveBestScore();

    if (window.sound) window.sound.playVictory();

    // Populate Level Complete screen UI
    const vicLevelEl = document.getElementById('vic-level');
    const vicRelicsEl = document.getElementById('vic-relics');
    const vicTimeEl = document.getElementById('vic-time');
    const vicBestTimeEl = document.getElementById('vic-best-time');
    const vicEncountersEl = document.getElementById('vic-encounters');
    const vicScoreEl = document.getElementById('vic-score');
    const vicBonusEl = document.getElementById('vic-bonus');
    const vicTotalEl = document.getElementById('vic-total');

    if (vicLevelEl) vicLevelEl.textContent = `LEVEL ${this.level.toString().padStart(2, '0')}`;
    if (vicRelicsEl) vicRelicsEl.textContent = `${this.maze.collectedCount}/${this.maze.totalRelics}`;
    if (vicTimeEl) vicTimeEl.textContent = this.formatTimeMs(levelTimeMs, true);
    if (vicBestTimeEl) {
      vicBestTimeEl.textContent = this.formatTimeMs(this.records.bestTimes[this.level], true) + (isNewBestTime ? ' (NEW RECORD!)' : '');
    }
    if (vicEncountersEl) vicEncountersEl.textContent = this.hunterEncounters.toString();
    if (vicScoreEl) vicScoreEl.textContent = (this.score - timeBonus).toString();
    if (vicBonusEl) vicBonusEl.textContent = `+${timeBonus}`;
    if (vicTotalEl) vicTotalEl.textContent = totalLevelScore.toString();

    this.ui.victoryScreen?.classList.remove('hidden');
  }

  openRecordsScreen() {
    this.records = this.loadRecords();
    this.populateRecordsTable();
    this.ui.recordsScreen?.classList.remove('hidden');
  }

  populateRecordsTable() {
    const highest = Math.max(5, this.records.highestLevel || 1);
    if (this.ui.recHighestLevel) this.ui.recHighestLevel.textContent = `LEVEL ${highest.toString().padStart(2, '0')}`;
    if (this.ui.recTotalCleared) this.ui.recTotalCleared.textContent = (this.records.totalCompletedLevels || 0).toString();
    if (this.ui.recBestRunScore) this.ui.recBestRunScore.textContent = (this.records.bestRunScore || 0).toString();

    const tbody = document.getElementById('records-table-body');
    if (!tbody) return;

    let html = '';
    const THEME_KEYS = Object.keys(window.MAZE_THEMES || {});

    for (let lvl = 1; lvl <= highest; lvl++) {
      const themeKey = THEME_KEYS.length > 0 ? THEME_KEYS[(lvl - 1) % THEME_KEYS.length] : 'ANCIENT_RUINS';
      const themeName = (window.MAZE_THEMES && window.MAZE_THEMES[themeKey]) ? window.MAZE_THEMES[themeKey].name : 'Ancient Ruins';
      const bestTimeMs = this.records.bestTimes[lvl];
      const bestScore = this.records.bestScores[lvl];

      const timeStr = bestTimeMs !== undefined ? this.formatTimeMs(bestTimeMs, true) : '--:--.---';
      const scoreStr = bestScore !== undefined ? bestScore.toString() : '--';

      html += `<tr>
        <td class="cyan-text">LEVEL ${lvl.toString().padStart(2, '0')}</td>
        <td>${themeName}</td>
        <td class="${bestTimeMs !== undefined ? 'highlight' : ''}">${timeStr}</td>
        <td class="amber-text">${scoreStr}</td>
      </tr>`;
    }
    tbody.innerHTML = html;
  }

  resetAllRecords() {
    this.records = getDefaultRecords();
    this.saveRecords();
    this.bestScore = 0;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('maze_runner_best_score', '0');
      }
    } catch (e) {}
    this.updateBestScoreDisplay();
    this.populateRecordsTable();
  }

  hideAllModals() {
    this.ui.pauseScreen?.classList.add('hidden');
    this.ui.gameOverScreen?.classList.add('hidden');
    this.ui.victoryScreen?.classList.add('hidden');
    this.ui.transitionScreen?.classList.add('hidden');
    this.ui.recordsScreen?.classList.add('hidden');
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

  formatTimeMs(ms, includeMs = false) {
    if (!Number.isFinite(ms) || ms < 0) return includeMs ? '00:00.000' : '00:00';
    const totalSec = ms / 1000;
    const mins = Math.floor(totalSec / 60);
    const secs = Math.floor(totalSec % 60);
    const millis = Math.floor(ms % 1000);
    if (includeMs) {
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
    }
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
      if (this.renderer) {
        this.renderer.renderMenuBackdrop(this.canvas.width, this.canvas.height, this.elapsedRealTime);
      }
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
          if (this.settings.screenShake && this.renderer) this.renderer.triggerShake(4, 0.25);
        }
        this.updateHUD();
      }

      // 3. Update Enemy AI Hunter
      this.enemy.update(dt, this.maze, this.player);

      // 3.5 Check hunter proximity for encounter telemetry
      const hunterDist = Math.abs(this.enemy.gridX - this.player.gridX) + Math.abs(this.enemy.gridY - this.player.gridY);
      if (hunterDist <= 2) {
        if (!this._inProximityZone) {
          this.hunterEncounters++;
          this._inProximityZone = true;
        }
      } else if (hunterDist > 3) {
        this._inProximityZone = false;
      }

      // 4. Check Player-Enemy collision
      if (this.enemy.checkCollision(this.player)) {
        const tookDmg = this.player.takeDamage();
        if (tookDmg) {
          this.lives--;
          if (!this._inProximityZone) {
            this.hunterEncounters++;
            this._inProximityZone = true;
          }
          if (this.settings.screenShake && this.renderer) this.renderer.triggerShake(9, 0.35);
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
      if (this.renderer) {
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
      }
    } else if (this.state === STATE.AI_REVEAL) {
      this.revealTimer += dt;

      if (this.renderer) {
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
      }

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
      if (this.renderer) {
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
    }

    if (this.canvas && typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(this.gameLoop.bind(this));
    }
  }
}

// Global browser & CommonJS exports
if (typeof window !== 'undefined') {
  window.GameController = GameController;
  window.STATE = STATE;
  window.RECORDS_STORAGE_KEY = RECORDS_STORAGE_KEY;
  window.getDefaultRecords = getDefaultRecords;
  window.validateAndNormalizeRecords = validateAndNormalizeRecords;

  if (typeof window.addEventListener === 'function') {
    window.addEventListener('DOMContentLoaded', () => {
      window.game = new GameController();
    });
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    GameController,
    STATE,
    RECORDS_STORAGE_KEY,
    getDefaultRecords,
    validateAndNormalizeRecords
  };
}
