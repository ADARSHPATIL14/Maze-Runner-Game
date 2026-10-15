/**
 * renderer.js - Atmospheric Pixel-Art Rendering Engine
 * Generates custom procedural 32x32 pixel sprites, tiles, animated particles,
 * and renders both the gameplay maze and the cinematic main menu backdrop.
 */

class GameRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // Ensure nearest-neighbor pixel-crisp rendering
    this.ctx.imageSmoothingEnabled = false;

    this.tileSize = 32;
    this.animTime = 0;

    // Screen shake state
    this.shakeDuration = 0;
    this.shakeIntensity = 0;

    // Ambient particles (twilight dust motes / fireflies)
    this.ambientMotes = [];
    this.initAmbientMotes(45);

    // AI Hunter holographic trajectory visualization overlay
    this.showAiPath = true;

    // Dynamic sprite sheet canvas
    this.sprites = {};
    this.generatePixelAssets();
  }

  initAmbientMotes(count) {
    this.ambientMotes = [];
    for (let i = 0; i < count; i++) {
      this.ambientMotes.push({
        x: Math.random() * 800,
        y: Math.random() * 600,
        vx: (Math.random() - 0.5) * 8,
        vy: -4 - Math.random() * 8,
        size: Math.random() < 0.6 ? 1 : 2,
        alpha: 0.2 + Math.random() * 0.7,
        pulseSpeed: 1 + Math.random() * 2,
        color: Math.random() < 0.65 ? '#ffe082' : '#80deea' // Gold or cyan
      });
    }
  }

  triggerShake(intensity = 6, duration = 0.3) {
    this.shakeIntensity = intensity;
    this.shakeDuration = duration;
  }

  /* -------------------------------------------------------------
   * PROCEDURAL PIXEL-ART SPRITE GENERATOR (32x32 crisp tiles)
   * ------------------------------------------------------------- */
  generatePixelAssets() {
    const size = this.tileSize;

    // Helper to create an offscreen canvas
    const createTileCanvas = () => {
      const c = document.createElement('canvas');
      c.width = size;
      c.height = size;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      return { canvas: c, ctx };
    };

    // 1. STANDARD MOSSY STONE WALL
    {
      const { canvas, ctx } = createTileCanvas();
      // Base dark stone
      ctx.fillStyle = '#1b232c';
      ctx.fillRect(0, 0, size, size);

      // Stone blocks masonry pattern
      const stones = [
        // Top block row
        { x: 1, y: 1, w: 14, h: 9, c: '#2b3642' },
        { x: 16, y: 1, w: 15, h: 9, c: '#2e3a47' },
        // Middle block row
        { x: 1, y: 11, w: 8, h: 10, c: '#26313d' },
        { x: 10, y: 11, w: 13, h: 10, c: '#313e4c' },
        { x: 24, y: 11, w: 7, h: 10, c: '#283440' },
        // Bottom block row
        { x: 1, y: 22, w: 15, h: 9, c: '#222c37' },
        { x: 17, y: 22, w: 14, h: 9, c: '#2a3643' }
      ];

      stones.forEach(s => {
        ctx.fillStyle = s.c;
        ctx.fillRect(s.x, s.y, s.w, s.h);
        // Highlight top & left
        ctx.fillStyle = '#425263';
        ctx.fillRect(s.x, s.y, s.w, 1);
        ctx.fillRect(s.x, s.y, 1, s.h);
        // Shadow bottom & right
        ctx.fillStyle = '#12171d';
        ctx.fillRect(s.x, s.y + s.h - 1, s.w, 1);
        ctx.fillRect(s.x + s.w - 1, s.y, 1, s.h);
      });

      // Mortar grooves
      ctx.fillStyle = '#0f141a';
      ctx.fillRect(0, 10, size, 1);
      ctx.fillRect(0, 21, size, 1);
      ctx.fillRect(15, 0, 1, 10);
      ctx.fillRect(9, 11, 1, 10);
      ctx.fillRect(23, 11, 1, 10);
      ctx.fillRect(16, 22, 1, 10);

      // Hanging moss & vines from top edges
      const mossPixels = [
        [0,0],[1,0],[2,0],[3,0],[4,0],[7,0],[8,0],[9,0],[14,0],[15,0],[16,0],[20,0],[21,0],[22,0],[28,0],[29,0],[30,0],[31,0],
        [1,1],[2,1],[3,1],[8,1],[9,1],[15,1],[21,1],[29,1],[30,1],
        [2,2],[8,2],[9,2],[15,2],[21,2],[22,2],[30,2],
        [2,3],[9,3],[22,3],
        [5,10],[6,10],[12,11],[13,11],[13,12],[25,10],[26,10]
      ];
      ctx.fillStyle = '#1e4835'; // Deep moss
      mossPixels.forEach(([px, py]) => ctx.fillRect(px, py, 1, 1));

      const mossHighlights = [
        [1,0],[2,0],[8,0],[15,0],[21,0],[29,0],[2,1],[8,1],[15,1],[22,2]
      ];
      ctx.fillStyle = '#3a875f'; // Vivid moss highlight
      mossHighlights.forEach(([px, py]) => ctx.fillRect(px, py, 1, 1));

      this.sprites['wall_standard'] = canvas;
    }

    // 2. RUNIC WALL (Ancient circular seal on stone, inspired by reference image)
    {
      const { canvas, ctx } = createTileCanvas();
      ctx.drawImage(this.sprites['wall_standard'], 0, 0);

      // Carve ancient circular emblem in center
      const cx = 16, cy = 16;
      ctx.strokeStyle = '#12171d'; // Deep groove
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, 7, 0, Math.PI * 2);
      ctx.stroke();

      // Runic spokes and central star
      ctx.beginPath();
      ctx.moveTo(cx - 7, cy); ctx.lineTo(cx + 7, cy);
      ctx.moveTo(cx, cy - 7); ctx.lineTo(cx, cy + 7);
      ctx.moveTo(cx - 5, cy - 5); ctx.lineTo(cx + 5, cy + 5);
      ctx.moveTo(cx - 5, cy + 5); ctx.lineTo(cx + 5, cy - 5);
      ctx.stroke();

      // Subtle ancient teal luminescence inside rune
      ctx.fillStyle = 'rgba(74, 182, 172, 0.28)';
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fill();

      // Additional moss draping over the ancient rune
      ctx.fillStyle = '#23583f';
      ctx.fillRect(cx - 4, cy - 8, 2, 3);
      ctx.fillRect(cx + 3, cy - 8, 3, 2);

      this.sprites['wall_runic'] = canvas;
    }

    // 3. CRACKED WALL
    {
      const { canvas, ctx } = createTileCanvas();
      ctx.drawImage(this.sprites['wall_standard'], 0, 0);

      // Deep fissure running through stone
      ctx.fillStyle = '#080c10';
      const crack = [
        [6, 3], [7, 4], [8, 5], [8, 6], [9, 7], [10, 8], [11, 9],
        [11, 10], [12, 11], [13, 12], [14, 13], [14, 14], [15, 15],
        [16, 16], [16, 17], [17, 18], [18, 19], [19, 20], [19, 21],
        [18, 22], [18, 23], [17, 24], [16, 25], [15, 26]
      ];
      crack.forEach(([px, py]) => {
        ctx.fillRect(px, py, 1, 1);
        ctx.fillRect(px + 1, py, 1, 1);
      });

      // Highlight on edge of fracture
      ctx.fillStyle = '#51657a';
      crack.forEach(([px, py]) => {
        if (px > 0 && Math.random() < 0.4) ctx.fillRect(px - 1, py, 1, 1);
      });

      this.sprites['wall_cracked'] = canvas;
    }

    // 4. STANDARD WORN STONE FLOOR
    {
      const { canvas, ctx } = createTileCanvas();
      // Dark ancient stone base
      ctx.fillStyle = '#141b22';
      ctx.fillRect(0, 0, size, size);

      // Uneven flagstones
      const slabs = [
        { x: 1, y: 1, w: 14, h: 14, c: '#1c242e' },
        { x: 16, y: 1, w: 15, h: 14, c: '#202934' },
        { x: 1, y: 16, w: 14, h: 15, c: '#1f2732' },
        { x: 16, y: 16, w: 15, h: 15, c: '#1a222c' }
      ];

      slabs.forEach(s => {
        ctx.fillStyle = s.c;
        ctx.fillRect(s.x, s.y, s.w, s.h);

        // Slab edge highlights
        ctx.fillStyle = '#2c3744';
        ctx.fillRect(s.x, s.y, s.w, 1);
        ctx.fillRect(s.x, s.y, 1, s.h);

        // Subtle texture grain
        ctx.fillStyle = '#161d25';
        ctx.fillRect(s.x + 3, s.y + 4, 3, 2);
        ctx.fillRect(s.x + 8, s.y + 7, 2, 2);
        ctx.fillRect(s.x + 4, s.y + 10, 4, 1);
      });

      // Mortar grooves between floor slabs
      ctx.fillStyle = '#0a0d12';
      ctx.fillRect(0, 15, size, 1);
      ctx.fillRect(15, 0, 1, size);

      this.sprites['floor_standard'] = canvas;
    }

    // 5. MOSSY STONE FLOOR
    {
      const { canvas, ctx } = createTileCanvas();
      ctx.drawImage(this.sprites['floor_standard'], 0, 0);

      // Overgrown moss in joints and corners
      const mossSpots = [
        [0, 14], [1, 14], [2, 14], [1, 15], [2, 15], [3, 15], [4, 15],
        [14, 0], [14, 1], [15, 0], [15, 1], [15, 2], [16, 1],
        [13, 14], [14, 14], [15, 14], [16, 14], [14, 15], [15, 15], [16, 15], [17, 15],
        [22, 20], [23, 20], [22, 21], [23, 21], [24, 21], [23, 22]
      ];
      ctx.fillStyle = '#1e4835';
      mossSpots.forEach(([px, py]) => ctx.fillRect(px, py, 1, 1));

      ctx.fillStyle = '#3a875f';
      const mossHighlights = [[1, 15], [15, 1], [15, 14], [23, 21]];
      mossHighlights.forEach(([px, py]) => ctx.fillRect(px, py, 1, 1));

      this.sprites['floor_mossy'] = canvas;
    }

    // 6. FLOOR GLYPH
    {
      const { canvas, ctx } = createTileCanvas();
      ctx.drawImage(this.sprites['floor_standard'], 0, 0);

      // Ancient inlaid sanctuary circle
      ctx.strokeStyle = '#2d4b52';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(16, 16, 10, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = '#1b343a';
      ctx.beginPath();
      ctx.arc(16, 16, 6, 0, Math.PI * 2);
      ctx.stroke();

      this.sprites['floor_glyph'] = canvas;
    }
  }

  /* -------------------------------------------------------------
   * DYNAMIC SPRITE DRAWING (Player, Enemy, Collectible, Exit)
   * ------------------------------------------------------------- */

  // CYAN PLAYER CHARACTER (with explorer backpack!)
  drawPlayer(ctx, x, y, size, direction, walkFrame, isMoving) {
    const cx = x + size / 2;
    const cy = y + size / 2;
    const bob = isMoving ? (walkFrame === 1 ? -1 : 1) : 0;

    // Drop shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(cx, y + size - 4, 7, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Explorer Legs / Boots (Dark charcoal/navy)
    ctx.fillStyle = '#0d1a24';
    if (direction === 'left' || direction === 'right') {
      const legOffset = isMoving && walkFrame === 1 ? 2 : -2;
      ctx.fillRect(cx - 3 + legOffset, cy + 5 + bob, 3, 6);
      ctx.fillRect(cx - 1 - legOffset, cy + 5 + bob, 3, 6);
    } else {
      const stride = isMoving ? (walkFrame === 1 ? 1 : -1) : 0;
      ctx.fillRect(cx - 4, cy + 6 + stride, 3, 5);
      ctx.fillRect(cx + 1, cy + 6 - stride, 3, 5);
    }

    // Cyan Adventurer Tunic / Coat
    ctx.fillStyle = '#00a8cc'; // Rich cyan base
    ctx.fillRect(cx - 5, cy - 3 + bob, 10, 9);

    // Cyan tunic highlight
    ctx.fillStyle = '#00f0ff'; // Vibrant cyan
    if (direction === 'left') {
      ctx.fillRect(cx - 5, cy - 3 + bob, 3, 9);
    } else if (direction === 'right') {
      ctx.fillRect(cx + 2, cy - 3 + bob, 3, 9);
    } else {
      ctx.fillRect(cx - 2, cy - 3 + bob, 4, 9);
    }

    // Explorer Backpack (Grey-brown survival pack)
    ctx.fillStyle = '#423c34'; // Pack base
    if (direction === 'up') {
      // Facing away: Backpack is clearly visible on back
      ctx.fillRect(cx - 4, cy - 2 + bob, 8, 8);
      ctx.fillStyle = '#655d52';
      ctx.fillRect(cx - 3, cy - 1 + bob, 6, 3);
      // Backpack bedroll/straps
      ctx.fillStyle = '#264653';
      ctx.fillRect(cx - 4, cy - 4 + bob, 8, 2);
    } else if (direction === 'down') {
      // Facing forward: Straps visible over shoulders
      ctx.fillStyle = '#2d2822';
      ctx.fillRect(cx - 4, cy - 2 + bob, 2, 7);
      ctx.fillRect(cx + 2, cy - 2 + bob, 2, 7);
    } else if (direction === 'left') {
      // Side view facing left: Backpack visible on right side
      ctx.fillRect(cx + 2, cy - 2 + bob, 4, 7);
      ctx.fillStyle = '#655d52';
      ctx.fillRect(cx + 3, cy - 1 + bob, 3, 5);
    } else if (direction === 'right') {
      // Side view facing right: Backpack visible on left side
      ctx.fillRect(cx - 6, cy - 2 + bob, 4, 7);
      ctx.fillStyle = '#655d52';
      ctx.fillRect(cx - 6, cy - 1 + bob, 3, 5);
    }

    // Head / Hair (Dark brown rugged hair)
    ctx.fillStyle = '#1b1410';
    ctx.fillRect(cx - 4, cy - 10 + bob, 8, 7);

    // Face / Skin tone
    ctx.fillStyle = '#e0a96d';
    if (direction === 'down') {
      ctx.fillRect(cx - 3, cy - 7 + bob, 6, 4);
      // Visor / Eyes (Glowing cyan HUD visor)
      ctx.fillStyle = '#b6ffff';
      ctx.fillRect(cx - 3, cy - 6 + bob, 2, 2);
      ctx.fillRect(cx + 1, cy - 6 + bob, 2, 2);
    } else if (direction === 'left') {
      ctx.fillRect(cx - 4, cy - 7 + bob, 4, 4);
      ctx.fillStyle = '#b6ffff';
      ctx.fillRect(cx - 4, cy - 6 + bob, 2, 2);
    } else if (direction === 'right') {
      ctx.fillRect(cx, cy - 7 + bob, 4, 4);
      ctx.fillStyle = '#b6ffff';
      ctx.fillRect(cx + 2, cy - 6 + bob, 2, 2);
    } else {
      // Facing up: back of head hair
      ctx.fillStyle = '#120d0a';
      ctx.fillRect(cx - 3, cy - 8 + bob, 6, 5);
    }

    // Ambient Cyan Light Pulse around player
    const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, size * 1.3);
    grad.addColorStop(0, 'rgba(0, 240, 255, 0.18)');
    grad.addColorStop(1, 'rgba(0, 240, 255, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 1.3, 0, Math.PI * 2);
    ctx.fill();
  }

  // RED AI HUNTER (Crimson Stalker Drone)
  drawEnemy(ctx, x, y, size, enemy) {
    const cx = x + size / 2;
    const cy = y + size / 2;
    const hover = Math.sin(enemy.pulseTimer) * 2;

    // Drop shadow (red-tinted shadow)
    ctx.fillStyle = 'rgba(20, 0, 0, 0.55)';
    ctx.beginPath();
    ctx.ellipse(cx, y + size - 3, 8, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Directional scanner threat beam
    const dir = enemy.direction;
    let beamAngle = 0;
    if (dir === 'right') beamAngle = 0;
    else if (dir === 'down') beamAngle = Math.PI / 2;
    else if (dir === 'left') beamAngle = Math.PI;
    else if (dir === 'up') beamAngle = -Math.PI / 2;

    ctx.save();
    ctx.translate(cx, cy + hover);
    ctx.rotate(beamAngle);
    const beamGrad = ctx.createRadialGradient(0, 0, 2, 28, 0, 28);
    beamGrad.addColorStop(0, 'rgba(255, 23, 68, 0.45)');
    beamGrad.addColorStop(1, 'rgba(255, 23, 68, 0)');
    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 28, -0.4, 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Outer Mechanical Chassis / Thrusters (Dark Crimson/Obsidian)
    ctx.fillStyle = '#260408';
    ctx.fillRect(cx - 8, cy - 8 + hover, 16, 16);

    // Armor Plates (Ruby Red)
    ctx.fillStyle = '#99182c';
    ctx.fillRect(cx - 6, cy - 6 + hover, 12, 12);

    // Corner Thrusters / Hover Pylons
    ctx.fillStyle = '#ff1744';
    ctx.fillRect(cx - 7, cy - 7 + hover, 2, 2);
    ctx.fillRect(cx + 5, cy - 7 + hover, 2, 2);
    ctx.fillRect(cx - 7, cy + 5 + hover, 2, 2);
    ctx.fillRect(cx + 5, cy + 5 + hover, 2, 2);

    // Central Cyclopean Crimson Sensor / Eye
    const eyeBrightness = enemy.eyeGlow || 1;
    ctx.fillStyle = '#d50000';
    ctx.beginPath();
    ctx.arc(cx, cy + hover, 4, 0, Math.PI * 2);
    ctx.fill();

    // Bright optical core
    ctx.fillStyle = `rgba(255, 235, 238, ${eyeBrightness})`;
    ctx.beginPath();
    ctx.arc(cx, cy + hover, 2, 0, Math.PI * 2);
    ctx.fill();

    // Threat Halo
    const threatGrad = ctx.createRadialGradient(cx, cy + hover, 2, cx, cy + hover, size * 1.2);
    threatGrad.addColorStop(0, `rgba(255, 23, 68, ${0.25 * eyeBrightness})`);
    threatGrad.addColorStop(1, 'rgba(255, 23, 68, 0)');
    ctx.fillStyle = threatGrad;
    ctx.beginPath();
    ctx.arc(cx, cy + hover, size * 1.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // AI HUNTER HOLOGRAPHIC TRAJECTORY (Dynamic A* / BFS Path Visualization)
  drawEnemyPath(ctx, enemy, tileSize, time) {
    if (
      !this.showAiPath ||
      !enemy ||
      enemy.hunterMode === 'basic' ||
      (enemy.aiStats && enemy.aiStats.status === 'UNREACHABLE') ||
      !enemy.currentRoute ||
      enemy.currentRoute.length === 0
    ) {
      return;
    }

    const route = enemy.currentRoute;
    const startIndex = Math.max(0, enemy.routeIndex);
    if (startIndex >= route.length) return;

    ctx.save();

    // 1. Glowing connecting trajectory spline
    ctx.beginPath();
    const enemyCx = enemy.renderX * tileSize + tileSize / 2;
    const enemyCy = enemy.renderY * tileSize + tileSize / 2;
    ctx.moveTo(enemyCx, enemyCy);

    for (let i = startIndex; i < route.length; i++) {
      const node = route[i];
      const cx = node.x * tileSize + tileSize / 2;
      const cy = node.y * tileSize + tileSize / 2;
      ctx.lineTo(cx, cy);
    }

    // Outer soft glow line
    ctx.strokeStyle = 'rgba(255, 23, 68, 0.22)';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Inner bright laser line with animated directional dash pulse
    ctx.strokeStyle = 'rgba(255, 82, 82, 0.75)';
    ctx.lineWidth = 1.6;
    if (ctx.setLineDash) ctx.setLineDash([4, 4]);
    ctx.lineDashOffset = -time * 26; // Continuous forward flow
    ctx.stroke();

    if (ctx.setLineDash) ctx.setLineDash([]); // Reset line dash

    // 2. Waypoint node runic diamonds
    const pulse = 0.5 + Math.sin(time * 6) * 0.35;
    for (let i = startIndex; i < route.length; i++) {
      const node = route[i];
      const cx = node.x * tileSize + tileSize / 2;
      const cy = node.y * tileSize + tileSize / 2;

      ctx.fillStyle = `rgba(255, 23, 68, ${0.45 + pulse * 0.3})`;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 2.5);
      ctx.lineTo(cx + 2.5, cy);
      ctx.lineTo(cx, cy + 2.5);
      ctx.lineTo(cx - 2.5, cy);
      ctx.closePath();
      ctx.fill();
    }

    // 3. Cybernetic targeting reticle at route terminus (tracked target)
    const targetNode = route[route.length - 1];
    const tcx = targetNode.x * tileSize + tileSize / 2;
    const tcy = targetNode.y * tileSize + tileSize / 2;
    const reticleDist = 8 + Math.sin(time * 7) * 1.5;

    ctx.strokeStyle = `rgba(255, 23, 68, ${0.7 + pulse * 0.3})`;
    ctx.lineWidth = 1.4;

    // 4 Corner Brackets
    const d = reticleDist;
    const b = 3.5;
    // Top-left
    ctx.beginPath();
    ctx.moveTo(tcx - d, tcy - d + b);
    ctx.lineTo(tcx - d, tcy - d);
    ctx.lineTo(tcx - d + b, tcy - d);
    // Top-right
    ctx.moveTo(tcx + d - b, tcy - d);
    ctx.lineTo(tcx + d, tcy - d);
    ctx.lineTo(tcx + d, tcy - d + b);
    // Bottom-right
    ctx.moveTo(tcx + d, tcy + d - b);
    ctx.lineTo(tcx + d, tcy + d);
    ctx.lineTo(tcx + d - b, tcy + d);
    // Bottom-left
    ctx.moveTo(tcx - d + b, tcy + d);
    ctx.lineTo(tcx - d, tcy + d);
    ctx.lineTo(tcx - d, tcy + d - b);
    ctx.stroke();

    ctx.restore();
  }

  // AMBER COLLECTIBLE RELIC (Rotating, floating ancient power crystal)
  drawRelic(ctx, x, y, size, time) {
    const cx = x + size / 2;
    const cy = y + size / 2;
    const floatOffset = Math.sin(time * 3 + x + y) * 2.5;
    const pulse = 0.8 + Math.sin(time * 5) * 0.2;

    // Amber Floor Glow
    const glow = ctx.createRadialGradient(cx, cy + 6, 2, cx, cy + 6, 14);
    glow.addColorStop(0, 'rgba(255, 160, 0, 0.4)');
    glow.addColorStop(1, 'rgba(255, 160, 0, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy + 6, 14, 0, Math.PI * 2);
    ctx.fill();

    // Crystal Shard (Rotating rhombus)
    const cw = 4 + Math.abs(Math.cos(time * 2.5)) * 3;
    const ch = 7;

    ctx.fillStyle = '#b35300'; // Dark amber
    ctx.beginPath();
    ctx.moveTo(cx, cy - ch + floatOffset);
    ctx.lineTo(cx + cw, cy + floatOffset);
    ctx.lineTo(cx, cy + ch + floatOffset);
    ctx.lineTo(cx - cw, cy + floatOffset);
    ctx.closePath();
    ctx.fill();

    // Bright Amber Highlight
    ctx.fillStyle = '#ffb300';
    ctx.beginPath();
    ctx.moveTo(cx, cy - ch + floatOffset);
    ctx.lineTo(cx + cw * 0.7, cy + floatOffset);
    ctx.lineTo(cx, cy + ch + floatOffset);
    ctx.closePath();
    ctx.fill();

    // Central Glint
    ctx.fillStyle = '#fff9c4';
    ctx.fillRect(cx - 1, cy - 1 + floatOffset, 2, 2);
  }

  // GREEN EXIT PORTAL (Ancient monolith gateway with emerald vortex)
  drawExit(ctx, x, y, size, isOpen, time) {
    const cx = x + size / 2;
    const cy = y + size / 2;

    // Stone Archway Pillars
    ctx.fillStyle = '#16221c';
    ctx.fillRect(x + 2, y + 2, 5, size - 4);
    ctx.fillRect(x + size - 7, y + 2, 5, size - 4);
    // Lintel
    ctx.fillRect(x + 2, y + 2, size - 4, 5);

    // Stone Pillar Runes
    ctx.fillStyle = isOpen ? '#00e676' : '#2b4737';
    ctx.fillRect(x + 4, y + 8, 2, 3);
    ctx.fillRect(x + 4, y + 16, 2, 3);
    ctx.fillRect(x + size - 6, y + 8, 2, 3);
    ctx.fillRect(x + size - 6, y + 16, 2, 3);

    if (isOpen) {
      // Active Portal: Glowing emerald vortex
      const portalPulse = 0.8 + Math.sin(time * 6) * 0.2;
      const vortex = ctx.createRadialGradient(cx, cy, 2, cx, cy, size / 2 - 2);
      vortex.addColorStop(0, 'rgba(232, 245, 233, 0.95)');
      vortex.addColorStop(0.3, 'rgba(105, 240, 174, 0.8)');
      vortex.addColorStop(0.7, 'rgba(0, 200, 83, 0.6)');
      vortex.addColorStop(1, 'rgba(0, 200, 83, 0)');

      ctx.fillStyle = vortex;
      ctx.beginPath();
      ctx.arc(cx, cy, size / 2 - 2, 0, Math.PI * 2);
      ctx.fill();

      // Swirling runic sparks
      for (let i = 0; i < 4; i++) {
        const ang = time * 4 + (i * Math.PI) / 2;
        const rad = 6 + Math.sin(time * 3 + i) * 3;
        const sx = cx + Math.cos(ang) * rad;
        const sy = cy + Math.sin(ang) * rad;
        ctx.fillStyle = '#b9f6ca';
        ctx.fillRect(Math.floor(sx), Math.floor(sy), 2, 2);
      }
    } else {
      // Inactive / Locked Portal: Dark dormant emerald threshold
      ctx.fillStyle = '#0a1410';
      ctx.fillRect(x + 7, y + 7, size - 14, size - 11);

      // Dormant center sigil
      ctx.strokeStyle = '#1e382b';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 10, y + 10, size - 20, size - 17);
    }
  }

  /* -------------------------------------------------------------
   * MAZE SCENE RENDERER
   * ------------------------------------------------------------- */
  renderMaze(maze, player, enemy, score, lives, timer, level, isPaused, time) {
    this.animTime = time;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Handle screen shake
    ctx.save();
    if (this.shakeDuration > 0) {
      const sx = (Math.random() - 0.5) * this.shakeIntensity;
      const sy = (Math.random() - 0.5) * this.shakeIntensity;
      ctx.translate(sx, sy);
    }

    // Clear background with deepest ruin stone color
    ctx.fillStyle = '#090e13';
    ctx.fillRect(0, 0, w, h);

    // Calculate centering offset and scale
    const mazePixelW = maze.cols * this.tileSize;
    const mazePixelH = maze.rows * this.tileSize;
    const offsetX = Math.floor((w - mazePixelW) / 2);
    const offsetY = Math.floor((h - mazePixelH) / 2) + 12; // Extra room for top HUD

    ctx.save();
    ctx.translate(offsetX, offsetY);

    // 1. Draw Floor Tiles
    for (let y = 0; y < maze.rows; y++) {
      for (let x = 0; x < maze.cols; x++) {
        const t = maze.getTile(x, y);
        const px = x * this.tileSize;
        const py = y * this.tileSize;

        if (t === window.TILE.FLOOR_MOSSY) {
          ctx.drawImage(this.sprites['floor_mossy'], px, py);
        } else if (t === window.TILE.FLOOR_GLYPH) {
          ctx.drawImage(this.sprites['floor_glyph'], px, py);
        } else if (!maze.isWall(x, y)) {
          ctx.drawImage(this.sprites['floor_standard'], px, py);
        }
      }
    }

    // 2. Draw Exit Portal
    const isExitOpen = maze.isExitOpen();
    this.drawExit(
      ctx,
      maze.exitPortal.x * this.tileSize,
      maze.exitPortal.y * this.tileSize,
      this.tileSize,
      isExitOpen,
      time
    );

    // 3. Draw Amber Relics
    maze.collectibles.forEach(relic => {
      if (!relic.collected) {
        this.drawRelic(ctx, relic.x * this.tileSize, relic.y * this.tileSize, this.tileSize, time);
      }
    });

    // 4. Draw Walls (with 2.5D top-down ruin depth and autotiled south edge shadows)
    for (let y = 0; y < maze.rows; y++) {
      for (let x = 0; x < maze.cols; x++) {
        const t = maze.getTile(x, y);
        const px = x * this.tileSize;
        const py = y * this.tileSize;

        if (maze.isWall(x, y)) {
          let sprite = this.sprites['wall_standard'];
          if (t === window.TILE.WALL_RUNIC) sprite = this.sprites['wall_runic'];
          else if (t === window.TILE.WALL_CRACKED) sprite = this.sprites['wall_cracked'];

          ctx.drawImage(sprite, px, py);

          // Cast ambient shadow on floor tile immediately below wall (if walkable)
          if (y + 1 < maze.rows && !maze.isWall(x, y + 1)) {
            ctx.fillStyle = 'rgba(5, 8, 12, 0.45)';
            ctx.fillRect(px, py + this.tileSize, this.tileSize, 4);
          }
        }
      }
    }

    // 4.5. Draw AI Hunter Trajectory Route Hologram
    if (enemy) {
      this.drawEnemyPath(ctx, enemy, this.tileSize, time);
    }

    // 5. Draw Cyan Player
    if (player && player.shouldDraw()) {
      this.drawPlayer(
        ctx,
        player.renderX * this.tileSize,
        player.renderY * this.tileSize,
        this.tileSize,
        player.direction,
        player.walkFrame,
        player.isMoving
      );
    }

    // 6. Draw Red AI Hunter
    if (enemy) {
      this.drawEnemy(
        ctx,
        enemy.renderX * this.tileSize,
        enemy.renderY * this.tileSize,
        this.tileSize,
        enemy
      );
    }

    ctx.restore(); // Restore maze translate

    // Atmospheric Ruin Vignette / Fog Overlay
    const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.72);
    vig.addColorStop(0, 'rgba(9, 14, 19, 0)');
    vig.addColorStop(1, 'rgba(4, 7, 10, 0.65)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);

    // Update and draw ambient motes in maze
    this.renderAmbientMotes(ctx, w, h, time);

    ctx.restore(); // Restore shake

    // Update screen shake timer
    if (this.shakeDuration > 0) {
      this.shakeDuration -= 0.016;
    }
  }

  /* -------------------------------------------------------------
   * CINEMATIC MAIN MENU BACKDROP
   * Directly inspired by the reference artwork:
   * Sunset sky, distant stone maze towers, foreground ruined monolith
   * with moss, vines, circular stone seal, and explorer overlooking maze.
   * ------------------------------------------------------------- */
  renderMenuBackdrop(w, h, time) {
    const ctx = this.ctx;

    // 1. Dusky Sunset Sky Gradient
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.75);
    sky.addColorStop(0.0, '#0f1a26'); // Deep night teal/navy
    sky.addColorStop(0.35, '#20394c'); // Twilight slate
    sky.addColorStop(0.65, '#6a473e'); // Dusky rose/copper
    sky.addColorStop(0.85, '#b96636'); // Warm sunset amber
    sky.addColorStop(1.0, '#ebb067'); // Bright horizon glow
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // 2. Pixel Sunset Clouds
    ctx.fillStyle = 'rgba(235, 176, 103, 0.25)';
    ctx.fillRect(w * 0.45, h * 0.28, 140, 6);
    ctx.fillRect(w * 0.50, h * 0.29, 180, 8);
    ctx.fillRect(w * 0.60, h * 0.33, 110, 6);
    ctx.fillRect(w * 0.35, h * 0.38, 220, 10);

    ctx.fillStyle = 'rgba(106, 71, 62, 0.4)';
    ctx.fillRect(w * 0.42, h * 0.35, 170, 7);
    ctx.fillRect(w * 0.58, h * 0.41, 140, 8);

    // 3. Radiant Setting Sun on Horizon
    const sunX = w * 0.72;
    const sunY = h * 0.42;
    const sunGlow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 70);
    sunGlow.addColorStop(0, '#fff4cc');
    sunGlow.addColorStop(0.3, 'rgba(255, 204, 102, 0.7)');
    sunGlow.addColorStop(1, 'rgba(235, 176, 103, 0)');
    ctx.fillStyle = sunGlow;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 70, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff9db';
    ctx.beginPath();
    ctx.arc(sunX, sunY, 20, 0, Math.PI * 2);
    ctx.fill();

    // 4. Distant Layer 3: Colossal Labyrinth Towers Silhouette & Bridges
    ctx.fillStyle = '#1e2c38';
    // Tower pillars in distant haze
    const distantTowers = [
      { x: w * 0.45, w: 26, h: h * 0.35 },
      { x: w * 0.52, w: 34, h: h * 0.42 },
      { x: w * 0.61, w: 28, h: h * 0.32 },
      { x: w * 0.70, w: 40, h: h * 0.28 },
      { x: w * 0.78, w: 30, h: h * 0.38 },
      { x: w * 0.86, w: 45, h: h * 0.44 }
    ];
    distantTowers.forEach(t => {
      ctx.fillRect(t.x, h * 0.48 - (t.h - h * 0.25), t.w, t.h);
      // Crenellated stone ruin tops
      ctx.fillRect(t.x + 3, h * 0.48 - (t.h - h * 0.25) - 4, 6, 4);
      ctx.fillRect(t.x + t.w - 9, h * 0.48 - (t.h - h * 0.25) - 4, 6, 4);
    });
    // Ancient stone aqueduct / bridge span across towers
    ctx.fillRect(w * 0.61, h * 0.42, w * 0.18, 8);
    // Bridge arches
    ctx.fillStyle = sky;
    ctx.beginPath();
    ctx.arc(w * 0.66, h * 0.45, 6, Math.PI, 0);
    ctx.arc(w * 0.73, h * 0.45, 6, Math.PI, 0);
    ctx.fill();

    // 5. Midground Layer 2: Vast Sprawling Maze Canyons & Overgrown Walls
    ctx.fillStyle = '#141e26';
    const mazeTowers = [
      { x: w * 0.38, w: 45, y: h * 0.38 },
      { x: w * 0.46, w: 55, y: h * 0.44 },
      { x: w * 0.54, w: 42, y: h * 0.40 },
      { x: w * 0.63, w: 60, y: h * 0.46 },
      { x: w * 0.74, w: 50, y: h * 0.38 },
      { x: w * 0.83, w: 70, y: h * 0.42 }
    ];
    mazeTowers.forEach(t => {
      ctx.fillRect(t.x, t.y, t.w, h - t.y);
      // Wall edge highlights
      ctx.fillStyle = '#2b3b47';
      ctx.fillRect(t.x, t.y, t.w, 3);
      ctx.fillRect(t.x, t.y, 2, h - t.y);

      // Overgrown moss on tower crowns
      ctx.fillStyle = '#1c3d2c';
      ctx.fillRect(t.x - 2, t.y, t.w + 4, 4);
      ctx.fillRect(t.x + 4, t.y + 4, 8, 5);
      ctx.fillRect(t.x + t.w - 12, t.y + 4, 7, 6);

      ctx.fillStyle = '#141e26';
    });

    // Atmospheric valley mist
    const mist = ctx.createLinearGradient(0, h * 0.55, 0, h * 0.75);
    mist.addColorStop(0, 'rgba(32, 57, 76, 0)');
    mist.addColorStop(0.5, 'rgba(40, 68, 85, 0.45)');
    mist.addColorStop(1, 'rgba(15, 26, 36, 0.7)');
    ctx.fillStyle = mist;
    ctx.fillRect(w * 0.3, h * 0.52, w * 0.7, h * 0.3);

    // 6. Foreground Layer 1: Massive Ancient Ruined Stone Monolith (Left side)
    const monoW = w * 0.34;
    ctx.fillStyle = '#0a1017'; // Deep shadow
    ctx.fillRect(0, 0, monoW, h);

    // Carved masonry blocks with depth
    ctx.fillStyle = '#16202a';
    for (let by = 0; by < h; by += 28) {
      ctx.fillRect(0, by, monoW - 8, 26);
      ctx.fillStyle = '#253442';
      ctx.fillRect(0, by, monoW - 8, 2); // Block highlight
      ctx.fillStyle = '#0a1017';
      ctx.fillRect(0, by + 26, monoW, 2); // Mortar groove
      ctx.fillStyle = '#16202a';
    }

    // Ancient circular runic seal carved into the giant monolith
    const glyphX = monoW * 0.65;
    const glyphY = h * 0.44;
    ctx.strokeStyle = '#090e14';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(glyphX, glyphY, 26, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#324a52';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(glyphX, glyphY, 26, 0, Math.PI * 2);
    ctx.stroke();

    // Runic spokes inside circular seal
    ctx.beginPath();
    ctx.moveTo(glyphX - 26, glyphY); ctx.lineTo(glyphX + 26, glyphY);
    ctx.moveTo(glyphX, glyphY - 26); ctx.lineTo(glyphX, glyphY + 26);
    ctx.moveTo(glyphX - 18, glyphY - 18); ctx.lineTo(glyphX + 18, glyphY + 18);
    ctx.moveTo(glyphX - 18, glyphY + 18); ctx.lineTo(glyphX + 18, glyphY - 18);
    ctx.stroke();

    // Heavy ivy, hanging moss, and creeping vines on the monolith
    ctx.fillStyle = '#132e20';
    for (let vy = 0; vy < h; vy += 6) {
      const vineReach = 18 + Math.sin(vy * 0.08) * 12 + Math.cos(vy * 0.15) * 8;
      ctx.fillRect(monoW - 14 - vineReach, vy, vineReach + 18, 5);
    }
    // Bright moss highlight fronds
    ctx.fillStyle = '#2e6b4d';
    for (let vy = 10; vy < h; vy += 14) {
      const vineReach = 14 + Math.sin(vy * 0.08) * 10;
      ctx.fillRect(monoW - 14 - vineReach, vy, 6, 4);
    }

    // 7. Foreground Balcony / Overlook Flagstones (Bottom Center & Right)
    const ledgeY = h * 0.72;
    ctx.fillStyle = '#0a1017';
    ctx.fillRect(monoW * 0.8, ledgeY, w - monoW * 0.8, h - ledgeY);

    // Weathered flagstone steps leading down
    for (let sy = ledgeY; sy < h; sy += 22) {
      const stepIdx = Math.floor((sy - ledgeY) / 22);
      ctx.fillStyle = stepIdx % 2 === 0 ? '#1b2530' : '#141d26';
      ctx.fillRect(monoW * 0.85 + stepIdx * 12, sy, w, 20);
      // Sunset rim light on flagstones
      ctx.fillStyle = '#d98b4c';
      ctx.fillRect(monoW * 0.85 + stepIdx * 12, sy, w, 2);
      // Moss in floor crevices
      ctx.fillStyle = '#1e4835';
      ctx.fillRect(monoW * 0.9 + stepIdx * 16, sy + 4, 16, 3);
    }

    // 8. Lone Explorer Looking Out Over the Maze (Iconic silhouette from reference art!)
    const heroX = w * 0.62;
    const heroY = ledgeY - 2;

    // Explorer long shadow cast forward towards viewer
    ctx.fillStyle = 'rgba(6, 10, 14, 0.75)';
    ctx.beginPath();
    ctx.moveTo(heroX - 8, heroY + 8);
    ctx.lineTo(heroX + 12, heroY + 8);
    ctx.lineTo(heroX + 24, heroY + 65);
    ctx.lineTo(heroX - 18, heroY + 65);
    ctx.closePath();
    ctx.fill();

    // Explorer Silhouette (Legs, Boots)
    ctx.fillStyle = '#0d151c';
    ctx.fillRect(heroX - 4, heroY - 14, 4, 16);
    ctx.fillRect(heroX + 2, heroY - 14, 4, 16);

    // Explorer Body & Cyan Tunic (with warm sunset rim highlight on shoulders)
    ctx.fillStyle = '#0e2b38';
    ctx.fillRect(heroX - 6, heroY - 32, 14, 19);

    // Sunset rim lighting on the right side of the explorer
    ctx.fillStyle = '#ebb067';
    ctx.fillRect(heroX + 7, heroY - 32, 2, 18);
    ctx.fillRect(heroX + 5, heroY - 14, 2, 16);

    // Explorer Backpack (Detailed straps & gear)
    ctx.fillStyle = '#1d1916';
    ctx.fillRect(heroX - 8, heroY - 30, 6, 15);
    ctx.fillStyle = '#3a332c';
    ctx.fillRect(heroX - 8, heroY - 30, 2, 15);

    // Explorer Head & Hair
    ctx.fillStyle = '#120d09';
    ctx.fillRect(heroX - 4, heroY - 43, 9, 11);
    // Sunset rim on hair
    ctx.fillStyle = '#ebb067';
    ctx.fillRect(heroX + 4, heroY - 43, 2, 8);

    // 9. Floating Twilight Dust Motes / Fireflies
    this.renderAmbientMotes(ctx, w, h, time);

    // 10. Atmospheric Left-Side Gradient Mask for Ultra-Clean Menu Legibility
    const menuLegibilityMask = ctx.createLinearGradient(0, 0, w * 0.52, 0);
    menuLegibilityMask.addColorStop(0.0, 'rgba(6, 10, 14, 0.92)');
    menuLegibilityMask.addColorStop(0.55, 'rgba(8, 14, 20, 0.84)');
    menuLegibilityMask.addColorStop(0.85, 'rgba(8, 14, 20, 0.4)');
    menuLegibilityMask.addColorStop(1.0, 'rgba(8, 14, 20, 0)');
    ctx.fillStyle = menuLegibilityMask;
    ctx.fillRect(0, 0, w * 0.55, h);
  }

  renderAmbientMotes(ctx, w, h, time) {
    this.ambientMotes.forEach(m => {
      m.y += m.vy * 0.05;
      m.x += m.vx * 0.05 + Math.sin(time + m.y * 0.02) * 0.3;

      if (m.y < 0) {
        m.y = h + 10;
        m.x = Math.random() * w;
      }
      if (m.x < 0) m.x = w;
      if (m.x > w) m.x = 0;

      const pAlpha = m.alpha * (0.6 + Math.sin(time * m.pulseSpeed) * 0.4);
      ctx.fillStyle = m.color;
      ctx.globalAlpha = Math.max(0, Math.min(1, pAlpha));
      ctx.fillRect(Math.floor(m.x), Math.floor(m.y), m.size, m.size);
    });
    ctx.globalAlpha = 1.0;
  }
}

window.GameRenderer = GameRenderer;
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GameRenderer;
}
