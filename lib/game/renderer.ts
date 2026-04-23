// ============================
// CANDY PIXEL - Renderer (Canvas 2D)
// ============================

import type {
  GameState,
  Player,
  Enemy,
  Platform,
  Projectile,
  Collectible,
  BackgroundBuilding,
} from "./types";
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GROUND_Y,
  COLORS,
  PLAYER_START_AMMO,
} from "./constants";
import { getCameraShakeOffset } from "./camera";
import { renderParticles } from "./particles";
import {
  loadSettings,
  getKeyDisplayName,
  ACTION_LABELS,
  type GameAction,
} from "./settings";

// ---------- Main Render ----------
export function render(ctx: CanvasRenderingContext2D, state: GameState) {
  const { sx, sy } = getCameraShakeOffset(state.camera);
  const camX = state.camera.x + sx;
  const camY = state.camera.y + sy;

  ctx.save();

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  grad.addColorStop(0, COLORS.backgroundGradientTop);
  grad.addColorStop(1, COLORS.backgroundGradientBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Background buildings (parallax)
  renderBackground(ctx, state.backgroundBuildings, camX, camY, state.time);

  // Platforms
  for (const platform of state.platforms) {
    renderPlatform(ctx, platform, camX, camY);
  }

  // Collectibles
  for (const col of state.collectibles) {
    if (!col.collected) {
      renderCollectible(ctx, col, camX, camY, state.time);
    }
  }

  // Enemies
  for (const enemy of state.enemies) {
    if (enemy.alive) {
      renderEnemy(ctx, enemy, camX, camY, state.time);
    }
  }

  // Projectiles
  for (const proj of state.projectiles) {
    if (proj.alive) {
      renderProjectile(ctx, proj, camX, camY);
    }
  }

  // Player
  if (state.player.alive) {
    renderPlayer(ctx, state.player, camX, camY, state.time);
  }

  // Particles
  renderParticles(ctx, state.particles, camX, camY);

  // HUD (drawn last, no camera offset)
  renderHUD(ctx, state);

  // Damage flash overlay
  if (state.damageFlashTimer > 0) {
    ctx.save();
    ctx.fillStyle = `rgba(255, 100, 120, ${(state.damageFlashTimer / 15) * 0.3})`;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.restore();
  }

  // Zone transition overlay
  if (state.zoneTransitionTimer > 0) {
    renderZoneTransition(
      ctx,
      state.zoneTransitionName,
      state.zoneTransitionTimer,
    );
  }

  // Ready overlay (tutorial de controles)
  if (state.screen === "ready") {
    renderReadyOverlay(ctx, state.time);
  }

  // Pause overlay
  if (state.screen === "paused") {
    renderPauseOverlay(ctx);
  }

  ctx.restore();
}

// ---------- Background ----------
function renderBackground(
  ctx: CanvasRenderingContext2D,
  buildings: BackgroundBuilding[],
  camX: number,
  _camY: number,
  time: number,
) {
  // === CAMADA 1: Nuvens de algodão-doce distantes (parallax 0.05x) ===
  for (let i = 0; i < 7; i++) {
    const cloudX =
      ((i * 350 + time * 0.08) % (CANVAS_WIDTH + 400)) - 200 - camX * 0.05;
    const cloudY = 40 + i * 18 + Math.sin(time * 0.004 + i) * 8;
    const cloudW = 90 + i * 20;
    ctx.fillStyle = "#FFF0F8";
    ctx.globalAlpha = 0.6;
    // Nuvem: 3 elipses sobrepostas
    ctx.beginPath();
    ctx.ellipse(cloudX, cloudY, cloudW * 0.45, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(
      cloudX + cloudW * 0.28,
      cloudY + 4,
      cloudW * 0.35,
      11,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(
      cloudX - cloudW * 0.25,
      cloudY + 5,
      cloudW * 0.3,
      10,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Sprinkles flutuando no céu (como estrelas mas coloridos)
  const sprinkleColors = [
    COLORS.magenta,
    COLORS.cyan,
    COLORS.yellow,
    COLORS.purple,
    COLORS.neonGreen,
  ];
  for (let i = 0; i < 35; i++) {
    const sx =
      ((i * 193 + 50) % (CANVAS_WIDTH + 100)) -
      50 -
      ((camX * 0.05) % (CANVAS_WIDTH + 100));
    const sy = (i * 67) % (CANVAS_HEIGHT * 0.55);
    const visible = Math.sin(time * 0.02 + i * 2.5) > 0.2;
    if (visible) {
      ctx.fillStyle = sprinkleColors[i % sprinkleColors.length] + "50";
      // Sprinkle: retângulo pequeno rotacionado
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(i * 0.8);
      ctx.fillRect(-3, -1, 6, 2);
      ctx.restore();
    }
  }

  // === CAMADA 2: Casinhas de gengibre (parallax 0.3x) ===
  const parallax = 0.3;
  // Distribuir 5 casinhas fixas espaçadas ao longo do nível (não dependem de buildings)
  const housePositions = [400, 900, 1500, 2200, 2900];
  const houseWidths = [90, 80, 100, 85, 95];
  const houseHeights = [100, 90, 110, 95, 105];
  const sprinkleDropColors = [
    "#FF6B9D",
    "#FFD93D",
    "#6BCBFF",
    "#A78BFA",
    "#4ADE80",
  ];

  for (let hi = 0; hi < housePositions.length; hi++) {
    const houseBaseX = housePositions[hi];
    const houseW = houseWidths[hi];
    const houseH = houseHeights[hi];
    const screenX = houseBaseX - camX * parallax;

    if (screenX + houseW < -50 || screenX > CANVAS_WIDTH + 50) continue;

    const groundY = GROUND_Y;
    // Corpo da casinha: retângulo marrom gengibre
    const bodyH = houseH * 0.58;
    const bodyY = groundY - bodyH;

    ctx.save();
    ctx.globalAlpha = 0.82;

    // --- Corpo retangular marrom ---
    ctx.fillStyle = "#D4956B";
    ctx.fillRect(screenX, bodyY, houseW, bodyH);

    // Contorno do corpo
    ctx.strokeStyle = "#9B6340";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(screenX, bodyY, houseW, bodyH);

    // --- Telhado triangular branco (glacê) ---
    const roofPeakX = screenX + houseW / 2;
    const roofPeakY = bodyY - houseH * 0.42;
    const roofOverhang = 8;

    ctx.fillStyle = "#F5F0E8";
    ctx.beginPath();
    ctx.moveTo(roofPeakX, roofPeakY);
    ctx.lineTo(screenX + houseW + roofOverhang, bodyY);
    ctx.lineTo(screenX - roofOverhang, bodyY);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#CCBFA8";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Pingos de glacê pendurados na beirada do telhado (sprinkles)
    const dropCount = 5 + (hi % 2);
    for (let d = 0; d < dropCount; d++) {
      const dropT = (d + 0.5) / dropCount;
      // Interpola ao longo da borda inferior do telhado
      const leftX = screenX - roofOverhang;
      const rightX = screenX + houseW + roofOverhang;
      const dropX = leftX + (rightX - leftX) * dropT;
      const dropLen = 5 + (d % 3) * 3;

      ctx.fillStyle = sprinkleDropColors[d % sprinkleDropColors.length];
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.ellipse(
        dropX,
        bodyY + dropLen / 2,
        2.5,
        dropLen / 2,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }

    ctx.globalAlpha = 0.82;

    // --- Porta central roxa escura ---
    const doorW = houseW * 0.22;
    const doorH = bodyH * 0.45;
    const doorX = screenX + houseW / 2 - doorW / 2;
    const doorY = groundY - doorH;

    ctx.fillStyle = "#4A1A6B";
    ctx.beginPath();
    ctx.roundRect(doorX, doorY, doorW, doorH, [doorW / 2, doorW / 2, 0, 0]);
    ctx.fill();
    ctx.strokeStyle = "#6B2E9A";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Maçaneta da porta
    ctx.fillStyle = "#FFD93D";
    ctx.beginPath();
    ctx.arc(doorX + doorW * 0.75, doorY + doorH * 0.55, 2, 0, Math.PI * 2);
    ctx.fill();

    // --- 2 janelas iluminadas em amarelo pastel ---
    const winW = houseW * 0.18;
    const winH = bodyH * 0.28;
    const winY = bodyY + bodyH * 0.2;
    const winOffsets = [houseW * 0.12, houseW * 0.7];

    for (const wo of winOffsets) {
      const winX = screenX + wo;
      // Fundo iluminado
      ctx.fillStyle = "#FFF5B0";
      ctx.shadowColor = "#FFE066";
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.roundRect(winX, winY, winW, winH, 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      // Cruz da janela
      ctx.strokeStyle = "#9B6340";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(winX + winW / 2, winY);
      ctx.lineTo(winX + winW / 2, winY + winH);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(winX, winY + winH / 2);
      ctx.lineTo(winX + winW, winY + winH / 2);
      ctx.stroke();
    }

    // --- Chaminé pequena no lado direito do telhado ---
    const chimneyW = houseW * 0.1;
    const chimneyH = houseH * 0.25;
    // Posição ao longo do telhado, lado direito (~70% do pico para a direita)
    const chimneyRatio = 0.7;
    const chimneyBaseX =
      roofPeakX +
      (screenX + houseW + roofOverhang - roofPeakX) * chimneyRatio -
      chimneyW / 2;
    // Altura na inclinação do telhado
    const chimneyBottomY =
      bodyY +
      ((screenX + houseW + roofOverhang - chimneyBaseX - chimneyW / 2) /
        (screenX + houseW + roofOverhang - roofPeakX)) *
        (bodyY - roofPeakY) *
        -1;
    const chimneyTopY = chimneyBottomY - chimneyH;

    ctx.fillStyle = "#B5703A";
    ctx.fillRect(chimneyBaseX, chimneyTopY, chimneyW, chimneyH);
    ctx.strokeStyle = "#9B6340";
    ctx.lineWidth = 1;
    ctx.strokeRect(chimneyBaseX, chimneyTopY, chimneyW, chimneyH);
    // Tampa da chaminé
    ctx.fillStyle = "#9B6340";
    ctx.fillRect(chimneyBaseX - 2, chimneyTopY, chimneyW + 4, 3);

    ctx.restore();
  }

  // Referência mantida para evitar lint warning (buildings ainda usado pelas outras camadas se necessário)
  void buildings;

  // Linha do chão: faixa de caramelo
  ctx.save();
  ctx.fillStyle = "#E8C49C40";
  ctx.fillRect(0, GROUND_Y + 18, CANVAS_WIDTH, 4);
  ctx.restore();

  // === CAMADA 3: Detalhes do primeiro plano (parallax 0.6x) — pirulitos decorativos ===
  const fgParallax = 0.6;
  for (let i = 0; i < 12; i++) {
    const poleBaseX = i * 600 + 300;
    const screenX = poleBaseX - camX * fgParallax;
    if (screenX < -30 || screenX > CANVAS_WIDTH + 30) continue;

    // Palito do pirulito
    ctx.fillStyle = "#C8A0B8";
    ctx.fillRect(screenX - 2, GROUND_Y - 70, 4, 70);

    // Círculo do pirulito
    const pirColor = sprinkleColors[i % sprinkleColors.length];
    ctx.fillStyle = pirColor + "80";
    ctx.shadowColor = pirColor;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(screenX, GROUND_Y - 75, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Espiral do pirulito
    ctx.strokeStyle = "#FFFFFF60";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(screenX, GROUND_Y - 75, 8, -Math.PI * 0.5, Math.PI * 1.2);
    ctx.stroke();
  }
}

// ---------- Platform ----------
function renderPlatform(
  ctx: CanvasRenderingContext2D,
  platform: Platform,
  camX: number,
  camY: number,
) {
  const x = platform.x - camX;
  const y = platform.y - camY;

  if (x + platform.width < -10 || x > CANVAS_WIDTH + 10) return;

  const isGround = platform.y >= GROUND_Y;

  ctx.save();

  if (isGround) {
    // Chão — waffle grande de caramelo
    ctx.fillStyle = "#C8834A";
    ctx.fillRect(x, y, platform.width, platform.height);

    // Grade de waffle no chão
    ctx.strokeStyle = "#A0622A60";
    ctx.lineWidth = 1;
    const gridSize = 16;
    for (let gx = 0; gx < platform.width; gx += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x + gx, y);
      ctx.lineTo(x + gx, y + platform.height);
      ctx.stroke();
    }
    for (let gy = 0; gy < platform.height; gy += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, y + gy);
      ctx.lineTo(x + platform.width, y + gy);
      ctx.stroke();
    }

    // Borda superior (glacê derramado)
    ctx.fillStyle = "#F0E0C8";
    ctx.fillRect(x, y, platform.width, 3);
  } else {
    // Plataformas flutuantes — biscoitos/waffles individuais
    const baseColor = "#E8C49C";
    const borderColor = "#C8834A";

    // Corpo do biscoito
    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.roundRect(x, y, platform.width, platform.height, 4);
    ctx.fill();

    // Grade de waffle (quadradinhos)
    ctx.strokeStyle = "#C8834A50";
    ctx.lineWidth = 1;
    const gridStep = 10;
    for (let gx = gridStep; gx < platform.width; gx += gridStep) {
      ctx.beginPath();
      ctx.moveTo(x + gx, y + 1);
      ctx.lineTo(x + gx, y + platform.height - 1);
      ctx.stroke();
    }
    for (let gy = gridStep; gy < platform.height; gy += gridStep) {
      ctx.beginPath();
      ctx.moveTo(x + 1, y + gy);
      ctx.lineTo(x + platform.width - 1, y + gy);
      ctx.stroke();
    }

    // Borda marrom assada
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, platform.width, platform.height, 4);
    ctx.stroke();

    // Sombra suave abaixo (profundidade)
    ctx.fillStyle = "#A0622A30";
    ctx.fillRect(x + 2, y + platform.height, platform.width - 2, 3);
  }

  ctx.restore();
}

// ---------- Player ----------
function renderPlayer(
  ctx: CanvasRenderingContext2D,
  player: Player,
  camX: number,
  camY: number,
  time: number,
) {
  const x = player.x - camX;
  // Pulo/animação de andar: sutil offset Y
  const walkBounce = player.isGrounded ? Math.sin(time * 0.2) * 1.5 : 0;
  const y = player.y - camY + walkBounce;

  // Invincibility blink
  if (player.invincible && Math.floor(time * 0.5) % 2 === 0) return;

  ctx.save();

  const facingRight = player.direction === "right";
  const pw = player.width;
  const ph = player.height;

  // === Forminha do cupcake (trapézio invertido, parte de baixo) ===
  const cupTopW = pw * 0.75;
  const cupBotW = pw * 0.9;
  const cupH = ph * 0.42;
  const cupTopX = x + (pw - cupTopW) / 2;
  const cupBotX = x + (pw - cupBotW) / 2;
  const cupY = y + ph - cupH;

  ctx.fillStyle = "#D4956B"; // marrom biscoito da forminha
  ctx.beginPath();
  ctx.moveTo(cupTopX, cupY);
  ctx.lineTo(cupTopX + cupTopW, cupY);
  ctx.lineTo(cupBotX + cupBotW, y + ph);
  ctx.lineTo(cupBotX, y + ph);
  ctx.closePath();
  ctx.fill();

  // Listras verticais na forminha
  ctx.strokeStyle = "#A0622A60";
  ctx.lineWidth = 1;
  const stripeCount = 5;
  for (let s = 1; s < stripeCount; s++) {
    const ratio = s / stripeCount;
    const tx = cupTopX + cupTopW * ratio;
    const bx = cupBotX + cupBotW * ratio;
    ctx.beginPath();
    ctx.moveTo(tx, cupY);
    ctx.lineTo(bx, y + ph);
    ctx.stroke();
  }

  // === Glacê (semicírculo rosa no topo) ===
  const icingCx = x + pw / 2;
  const icingR = pw * 0.48;
  const icingY = cupY;

  ctx.fillStyle = COLORS.playerBody; // rosa cupcake
  ctx.shadowColor = COLORS.playerGlow;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(icingCx, icingY, icingR, Math.PI, 0);
  ctx.lineTo(icingCx + icingR, icingY);
  ctx.lineTo(icingCx - icingR, icingY);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;

  // Swirl do glacê
  ctx.strokeStyle = "#FFD0E860";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(
    icingCx,
    icingY - icingR * 0.3,
    icingR * 0.45,
    Math.PI * 0.1,
    Math.PI * 1.2,
  );
  ctx.stroke();

  // === Cereja no topo ===
  ctx.fillStyle = COLORS.turretBody;
  ctx.shadowColor = COLORS.turretBody;
  ctx.shadowBlur = 4;
  ctx.beginPath();
  ctx.arc(icingCx, icingY - icingR - 3, 5, 0, Math.PI * 2);
  ctx.fill();
  // Pezinho da cereja
  ctx.strokeStyle = "#3D7A2E";
  ctx.lineWidth = 1.5;
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.moveTo(icingCx, icingY - icingR - 3);
  ctx.lineTo(icingCx + 3, icingY - icingR - 9);
  ctx.stroke();

  // === Olhinhos no glacê ===
  const eyeOffsetX = facingRight ? 5 : -5;
  const eyeY = icingY - icingR * 0.45;

  // Olho esquerdo
  ctx.fillStyle = COLORS.black;
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.arc(icingCx - 6 + eyeOffsetX * 0.3, eyeY, 3, 0, Math.PI * 2);
  ctx.fill();
  // Reflexo
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.arc(icingCx - 5 + eyeOffsetX * 0.3, eyeY - 1, 1, 0, Math.PI * 2);
  ctx.fill();

  // Olho direito
  ctx.fillStyle = COLORS.black;
  ctx.beginPath();
  ctx.arc(icingCx + 6 + eyeOffsetX * 0.3, eyeY, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.arc(icingCx + 7 + eyeOffsetX * 0.3, eyeY - 1, 1, 0, Math.PI * 2);
  ctx.fill();

  // === Bracinhos (linhas marrons curtas nas laterais) ===
  ctx.strokeStyle = "#D4956B";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";

  if (facingRight) {
    // Bracinho direito (com lançador)
    ctx.beginPath();
    ctx.moveTo(x + pw * 0.85, cupY + 6);
    ctx.lineTo(x + pw + 8, cupY + 2);
    ctx.stroke();
    // Ponta do lançador (círculo pequeno — boca do lançador de bombons)
    ctx.fillStyle = COLORS.yellow;
    ctx.beginPath();
    ctx.arc(x + pw + 9, cupY + 2, 3, 0, Math.PI * 2);
    ctx.fill();
    // Bracinho esquerdo decorativo
    ctx.strokeStyle = "#D4956B";
    ctx.beginPath();
    ctx.moveTo(x + pw * 0.15, cupY + 6);
    ctx.lineTo(x - 6, cupY + 10);
    ctx.stroke();
  } else {
    // Bracinho esquerdo (com lançador)
    ctx.beginPath();
    ctx.moveTo(x + pw * 0.15, cupY + 6);
    ctx.lineTo(x - 8, cupY + 2);
    ctx.stroke();
    ctx.fillStyle = COLORS.yellow;
    ctx.beginPath();
    ctx.arc(x - 9, cupY + 2, 3, 0, Math.PI * 2);
    ctx.fill();
    // Bracinho direito decorativo
    ctx.strokeStyle = "#D4956B";
    ctx.beginPath();
    ctx.moveTo(x + pw * 0.85, cupY + 6);
    ctx.lineTo(x + pw + 6, cupY + 10);
    ctx.stroke();
  }

  ctx.lineCap = "butt";
  ctx.restore();
}

// ---------- Enemy ----------
function renderEnemy(
  ctx: CanvasRenderingContext2D,
  enemy: Enemy,
  camX: number,
  camY: number,
  time: number,
) {
  const x = enemy.x - camX;
  const y = enemy.y - camY;

  if (x + enemy.width < -50 || x > CANVAS_WIDTH + 50) return;

  ctx.save();

  switch (enemy.type) {
    case "drone":
      renderDrone(ctx, x, y, enemy, time);
      break;
    case "tracker":
      renderTracker(ctx, x, y, enemy, time);
      break;
    case "turret":
      renderTurret(ctx, x, y, enemy, time);
      break;
    case "boss":
      renderBoss(ctx, x, y, enemy, time);
      break;
  }

  // Barra de HP acima do inimigo (exceto boss que tem HUD próprio, e drones de 1 HP)
  if (
    enemy.type !== "boss" &&
    enemy.maxHealth > 1 &&
    enemy.health < enemy.maxHealth
  ) {
    const barW = enemy.width;
    const barH = 3;
    const barX = x;
    const barY = y - 8;
    const ratio = enemy.health / enemy.maxHealth;

    ctx.fillStyle = "#C8A4B830";
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle =
      ratio > 0.5
        ? COLORS.neonGreen
        : ratio > 0.25
          ? COLORS.yellow
          : COLORS.red;
    ctx.fillRect(barX, barY, barW * ratio, barH);
  }

  ctx.restore();
}

function renderDrone(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  enemy: Enemy,
  time: number,
) {
  // Alface Voador — folha verde com ondulações nas bordas e nervuras
  const cx = x + enemy.width / 2;
  const cy = y + enemy.height / 2;
  const rx = enemy.width / 2;
  const ry = enemy.height / 2;

  ctx.shadowColor = COLORS.droneGlow;
  ctx.shadowBlur = 6;

  // Corpo: folha com borda ondulada (pontos ao longo da elipse + seno)
  ctx.fillStyle = COLORS.droneBody;
  ctx.beginPath();
  const steps = 48;
  for (let i = 0; i <= steps; i++) {
    const angle = (Math.PI * 2 * i) / steps;
    const wobble = 1 + Math.sin(angle * 5 + time * 0.3) * 0.08;
    const px = cx + Math.cos(angle) * rx * wobble;
    const py = cy + Math.sin(angle) * ry * wobble;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;

  // Nervura central branca
  ctx.strokeStyle = COLORS.white + "cc";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx, y + 2);
  ctx.lineTo(cx, y + enemy.height - 2);
  ctx.stroke();

  // Nervuras laterais
  ctx.strokeStyle = COLORS.white + "60";
  ctx.lineWidth = 1;
  for (let i = 1; i <= 3; i++) {
    const ny = cy - ry * 0.15 + i * (ry * 0.28);
    const halfW = rx * (1 - Math.abs(ny - cy) / ry) * 0.8;
    ctx.beginPath();
    ctx.moveTo(cx, ny);
    ctx.lineTo(cx - halfW, ny + 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, ny);
    ctx.lineTo(cx + halfW, ny + 2);
    ctx.stroke();
  }

  // Olhinhos verdes fofinhos
  ctx.fillStyle = COLORS.black;
  ctx.beginPath();
  ctx.arc(cx - 4, cy - 2, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + 4, cy - 2, 2, 0, Math.PI * 2);
  ctx.fill();
  // Reflexos
  ctx.fillStyle = COLORS.white;
  ctx.beginPath();
  ctx.arc(cx - 3, cy - 3, 0.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + 5, cy - 3, 0.8, 0, Math.PI * 2);
  ctx.fill();

  // Flutter: brilho lateral oscilante (asinha)
  const flutter = Math.sin(time * 0.5) * 2;
  ctx.fillStyle = COLORS.droneGlow + "30";
  ctx.beginPath();
  ctx.ellipse(cx + flutter, cy, rx * 0.55, ry * 0.3, 0.3, 0, Math.PI * 2);
  ctx.fill();
}

function renderTracker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  enemy: Enemy,
  time: number,
) {
  // Cenoura Rastreadora — cone invertido laranja com topinho verde
  const isChasing = enemy.trackingPlayer;
  const cx = x + enemy.width / 2;
  const bodyTop = y + enemy.height * 0.3;
  const bodyBottom = y + enemy.height;

  ctx.shadowColor = COLORS.trackerGlow;
  ctx.shadowBlur = isChasing ? 12 : 5;

  // Corpo: gradiente laranja (mais claro no topo, escuro na ponta)
  const coneGrad = ctx.createLinearGradient(cx, bodyTop, cx, bodyBottom);
  coneGrad.addColorStop(0, COLORS.trackerBody);
  coneGrad.addColorStop(1, "#C06830");
  ctx.fillStyle = coneGrad;
  ctx.beginPath();
  ctx.moveTo(x + 2, bodyTop);
  ctx.lineTo(x + enemy.width - 2, bodyTop);
  ctx.lineTo(cx, bodyBottom);
  ctx.closePath();
  ctx.fill();

  // Listras horizontais de cenoura
  ctx.strokeStyle = "#C06830A0";
  ctx.lineWidth = 1;
  ctx.shadowBlur = 0;
  for (let i = 1; i <= 3; i++) {
    const sy = bodyTop + (bodyBottom - bodyTop) * (i * 0.22);
    const halfW = ((enemy.width - 4) * (1 - i * 0.22)) / 2;
    ctx.beginPath();
    ctx.moveTo(cx - halfW, sy);
    ctx.lineTo(cx + halfW, sy);
    ctx.stroke();
  }

  // Topinho verde (folhas de cenoura) — balançam mais rápido quando perseguindo
  const leafSpeed = isChasing ? 0.35 : 0.12;
  const leafSway = Math.sin(time * leafSpeed) * (isChasing ? 4 : 2);

  ctx.shadowColor = COLORS.droneGlow;
  ctx.shadowBlur = 4;
  ctx.fillStyle = "#3D7A2E";

  // Folha esquerda
  ctx.save();
  ctx.translate(cx - 5, y + 8);
  ctx.rotate(-0.4 + leafSway * 0.03);
  ctx.beginPath();
  ctx.ellipse(0, 0, 4, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Folha central
  ctx.save();
  ctx.translate(cx, y + 5);
  ctx.rotate(leafSway * 0.04);
  ctx.beginPath();
  ctx.ellipse(0, 0, 3, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Folha direita
  ctx.save();
  ctx.translate(cx + 5, y + 8);
  ctx.rotate(0.4 + leafSway * 0.03);
  ctx.beginPath();
  ctx.ellipse(0, 0, 4, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Olho — pisca vermelho quando perseguindo
  const eyeSize = isChasing ? 4 + Math.sin(time * 0.3) * 1.5 : 3;
  ctx.fillStyle = isChasing ? COLORS.red : COLORS.yellow;
  ctx.shadowColor = isChasing ? COLORS.red : COLORS.yellow;
  ctx.shadowBlur = isChasing ? 8 : 3;
  ctx.beginPath();
  ctx.arc(cx, bodyTop + (bodyBottom - bodyTop) * 0.28, eyeSize, 0, Math.PI * 2);
  ctx.fill();
  // Reflexo no olho
  ctx.fillStyle = COLORS.white;
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.arc(
    cx + 1,
    bodyTop + (bodyBottom - bodyTop) * 0.28 - 1,
    eyeSize * 0.3,
    0,
    Math.PI * 2,
  );
  ctx.fill();
}

function renderTurret(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  enemy: Enemy,
  time: number,
) {
  // Tomate Atirador — círculo vermelho com cabinho verde no topo
  const cx = x + enemy.width / 2;
  const r = enemy.width / 2 - 2;
  const tomatoY = y + enemy.height * 0.38 + r;

  // Corpo: gradiente radial (mais claro no canto superior-esquerdo)
  const bodyGrad = ctx.createRadialGradient(
    cx - r * 0.3,
    tomatoY - r * 0.3,
    r * 0.1,
    cx,
    tomatoY,
    r,
  );
  bodyGrad.addColorStop(0, "#FF9090");
  bodyGrad.addColorStop(1, COLORS.turretBody);
  ctx.fillStyle = bodyGrad;
  ctx.shadowColor = COLORS.turretGlow;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(cx, tomatoY, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Sulcos do tomate (2 curvas verticais)
  ctx.strokeStyle = "#C04040A0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx - r * 0.25, tomatoY, r * 0.7, -Math.PI * 0.7, Math.PI * 0.7);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx + r * 0.25, tomatoY, r * 0.7, Math.PI * 0.3, Math.PI * 1.7);
  ctx.stroke();

  // Cabinho verde (estrela de 5 pontas no topo)
  ctx.fillStyle = "#3D7A2E";
  ctx.shadowColor = COLORS.neonGreen;
  ctx.shadowBlur = 4;
  const stemCx = cx;
  const stemCy = y + enemy.height * 0.1;
  const petals = 5;
  for (let p = 0; p < petals; p++) {
    const angle = (Math.PI * 2 * p) / petals - Math.PI / 2;
    ctx.save();
    ctx.translate(stemCx, stemCy);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.ellipse(0, -7, 3, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // Pezinho central
  ctx.fillStyle = "#3D7A2E";
  ctx.fillRect(stemCx - 2, stemCy, 4, tomatoY - r - stemCy);
  ctx.shadowBlur = 0;

  // Olhinhos do tomate
  ctx.fillStyle = COLORS.black;
  ctx.beginPath();
  ctx.arc(cx - 5, tomatoY - 2, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + 5, tomatoY - 2, 2.5, 0, Math.PI * 2);
  ctx.fill();
  // Sobrancelhas carrancudas
  ctx.strokeStyle = COLORS.black;
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx - 8, tomatoY - 6);
  ctx.lineTo(cx - 3, tomatoY - 5);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + 3, tomatoY - 5);
  ctx.lineTo(cx + 8, tomatoY - 6);
  ctx.stroke();
  ctx.lineCap = "butt";

  // Cano do atirador
  ctx.fillStyle = "#C04040";
  const barrelY = tomatoY - 3;
  if (enemy.direction === "right") {
    ctx.fillRect(cx + r - 2, barrelY, 12, 6);
    // Ponta do cano
    ctx.fillStyle = COLORS.turretGlow;
    const eyePulse = 3 + Math.sin(time * 0.1) * 1;
    ctx.beginPath();
    ctx.arc(cx + r + 10, barrelY + 3, eyePulse, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillRect(cx - r - 10, barrelY, 12, 6);
    ctx.fillStyle = COLORS.turretGlow;
    const eyePulse = 3 + Math.sin(time * 0.1) * 1;
    ctx.beginPath();
    ctx.arc(cx - r - 10, barrelY + 3, eyePulse, 0, Math.PI * 2);
    ctx.fill();
  }
}

function renderBoss(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  enemy: Enemy,
  time: number,
) {
  const cx = x + enemy.width / 2;
  const cy = y + enemy.height / 2;

  // Feedback visual de transição de fase — aparece quando HP está em 10 ou 5
  const isPhaseTransition = enemy.health === 10 || enemy.health === 5;
  if (isPhaseTransition) {
    // Folhinhas verdes caindo abaixo do boss
    const leafCount = 4;
    for (let i = 0; i < leafCount; i++) {
      const leafAngle = time * 0.08 + (i * Math.PI * 2) / leafCount;
      const leafX = cx + Math.cos(leafAngle + i) * (enemy.width * 0.3 + i * 8);
      const leafY =
        y + enemy.height + 8 + Math.sin(time * 0.06 + i * 1.3) * 6 + i * 6;
      ctx.save();
      ctx.translate(leafX, leafY);
      ctx.rotate(leafAngle + time * 0.04);
      ctx.fillStyle = "#4CAF50";
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.ellipse(0, 0, 5, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      // Nervura da folhinha
      ctx.strokeStyle = "#2E7D32";
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(0, 8);
      ctx.stroke();
      ctx.restore();
    }

    // Texto flutuante "MAIS MOLHO VERDE!" acima do boss
    // Pulsa e sobe levemente com o tempo
    const textFloatY = y - 20 - Math.sin(time * 0.1) * 4;
    const textAlpha = 0.75 + Math.sin(time * 0.15) * 0.25;
    ctx.save();
    ctx.globalAlpha = textAlpha;
    ctx.font = "bold 13px monospace";
    ctx.textAlign = "center";
    ctx.strokeStyle = "#7B1A1A";
    ctx.lineWidth = 3;
    ctx.strokeText("MAIS MOLHO VERDE!", cx, textFloatY);
    ctx.fillStyle = "#FF3333";
    ctx.fillText("MAIS MOLHO VERDE!", cx, textFloatY);
    ctx.restore();
  }

  // Alface Gigante — camadas concêntricas de folhas verdes com cara malvada e coroa
  const phase = enemy.bossPhase || 1;
  const pulseSpeed = phase === 3 ? 0.1 : phase === 2 ? 0.07 : 0.05;
  const pulseScale = 1 + Math.sin(time * pulseSpeed) * (0.03 + phase * 0.02);

  const glowColor =
    phase === 3 ? COLORS.yellow : phase === 2 ? COLORS.red : COLORS.bossGlow;
  const leafColors = ["#2A5C1E", COLORS.bossBody, "#5A9A3A", COLORS.bossGlow];

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(pulseScale, pulseScale);
  ctx.translate(-cx, -cy);

  // Anel de brilho externo
  ctx.strokeStyle = glowColor + "50";
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = phase === 3 ? 28 : 16;
  ctx.lineWidth = phase === 3 ? 4 : 2;
  ctx.beginPath();
  ctx.arc(cx, cy, enemy.width / 2 + 14, 0, Math.PI * 2);
  ctx.stroke();

  if (phase === 3) {
    ctx.strokeStyle = COLORS.red + "35";
    ctx.shadowColor = COLORS.red;
    ctx.shadowBlur = 12;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(
      cx,
      cy,
      enemy.width / 2 + 26 + Math.sin(time * 0.12) * 5,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
  }

  // Camadas de folhas (círculos concêntricos com bordas onduladas)
  const layerCount = 4;
  for (let layer = layerCount - 1; layer >= 0; layer--) {
    const layerR = (enemy.width / 2) * (0.4 + layer * 0.18);
    const colorIdx = layer % leafColors.length;
    ctx.fillStyle = leafColors[colorIdx];
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = layer === 0 ? 8 : 0;

    // Borda ondulada via pontos
    ctx.beginPath();
    const wSteps = 36;
    const rotOffset = time * 0.008 * (layer % 2 === 0 ? 1 : -1);
    for (let i = 0; i <= wSteps; i++) {
      const angle = (Math.PI * 2 * i) / wSteps + rotOffset;
      const wobble = 1 + Math.sin(angle * 6 + time * 0.04 * (layer + 1)) * 0.07;
      const px = cx + Math.cos(angle) * layerR * wobble;
      const py = cy + Math.sin(angle) * layerR * wobble;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  ctx.shadowBlur = 0;

  // Nervuras radiais (linhas brancas das folhas)
  ctx.strokeStyle = COLORS.white + "25";
  ctx.lineWidth = 1;
  for (let n = 0; n < 8; n++) {
    const angle = (Math.PI * 2 * n) / 8;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(
      cx + Math.cos(angle) * enemy.width * 0.42,
      cy + Math.sin(angle) * enemy.height * 0.42,
    );
    ctx.stroke();
  }

  // Coroa no topo (rei das verduras)
  const crownY = cy - enemy.height * 0.46;
  ctx.fillStyle = COLORS.yellow;
  ctx.shadowColor = COLORS.yellow;
  ctx.shadowBlur = 8;
  // Base da coroa
  ctx.fillRect(cx - 18, crownY, 36, 8);
  // 3 pontas da coroa
  const crownPoints = [-14, 0, 14];
  for (const cp of crownPoints) {
    ctx.beginPath();
    ctx.moveTo(cx + cp - 6, crownY);
    ctx.lineTo(cx + cp, crownY - 10);
    ctx.lineTo(cx + cp + 6, crownY);
    ctx.closePath();
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  // Olhos malvados (sobrancelhas para baixo)
  const eyeY = cy - 5;
  ctx.fillStyle = COLORS.white;
  ctx.beginPath();
  ctx.ellipse(cx - 15, eyeY, 8, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + 15, eyeY, 8, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  const eyeIrisColor =
    phase === 3 ? COLORS.red : phase === 2 ? COLORS.orange : COLORS.black;
  ctx.fillStyle = eyeIrisColor;
  ctx.beginPath();
  ctx.arc(cx - 14, eyeY, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + 16, eyeY, 5, 0, Math.PI * 2);
  ctx.fill();

  // Sobrancelhas carrancudas (para baixo no meio)
  ctx.strokeStyle = COLORS.black;
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx - 22, eyeY - 9);
  ctx.lineTo(cx - 8, eyeY - 5);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + 22, eyeY - 9);
  ctx.lineTo(cx + 8, eyeY - 5);
  ctx.stroke();
  ctx.lineCap = "butt";

  // Boca malvada (sorriso curvado para baixo = carranca)
  const mouthY = cy + 12;
  ctx.strokeStyle = COLORS.black;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, mouthY + 8, 14, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();

  ctx.restore();
}

// ---------- Projectile ----------
function renderProjectile(
  ctx: CanvasRenderingContext2D,
  proj: Projectile,
  camX: number,
  camY: number,
) {
  const isPlayer = proj.color === COLORS.bulletPlayer;

  // Rastro
  ctx.save();
  for (let i = 0; i < proj.trail.length; i++) {
    const t = proj.trail[i];
    const alpha = (i / proj.trail.length) * 0.4;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = proj.color;
    const size = proj.width * (i / proj.trail.length) * 0.7;
    ctx.fillRect(t.x - camX, t.y - camY, size, proj.height * 0.7);
  }
  ctx.restore();

  ctx.save();
  const px = proj.x - camX;
  const py = proj.y - camY;

  if (isPlayer) {
    // Projétil do player: bombom embrulhado (~O~)
    const bx = px + proj.width / 2;
    const by = py + proj.height / 2;

    ctx.fillStyle = COLORS.bulletPlayer;
    ctx.shadowColor = COLORS.bulletPlayer;
    ctx.shadowBlur = 6;
    // Corpo redondo
    ctx.beginPath();
    ctx.arc(bx, by, proj.height * 0.7, 0, Math.PI * 2);
    ctx.fill();
    // Pontinhas laterais (embrulho)
    ctx.fillStyle = "#FFC060";
    ctx.beginPath();
    ctx.arc(bx - proj.width * 0.45, by, proj.height * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(bx + proj.width * 0.45, by, proj.height * 0.35, 0, Math.PI * 2);
    ctx.fill();
    // Brilho no bombom
    ctx.fillStyle = "#FFF8F060";
    ctx.beginPath();
    ctx.arc(bx - 1, by - 1, proj.height * 0.28, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Projétil inimigo: gota verde (semente cuspida)
    const bx = px + proj.width / 2;
    const by = py + proj.height / 2;
    const speedDir = proj.vx > 0 ? 1 : -1;

    ctx.fillStyle = proj.color;
    ctx.shadowColor = proj.color;
    ctx.shadowBlur = 5;
    // Gota: elipse ligeiramente alongada na direção do movimento
    ctx.beginPath();
    ctx.ellipse(
      bx,
      by,
      proj.width * 0.55,
      proj.height * 0.55,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    // Ponta da gota
    ctx.beginPath();
    ctx.moveTo(bx + speedDir * proj.width * 0.5, by);
    ctx.lineTo(bx + speedDir * proj.width * 0.9, by - proj.height * 0.3);
    ctx.lineTo(bx + speedDir * proj.width * 0.9, by + proj.height * 0.3);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

// ---------- Collectible ----------
function renderCollectible(
  ctx: CanvasRenderingContext2D,
  col: Collectible,
  camX: number,
  camY: number,
  time: number,
) {
  const x = col.x - camX;
  const y = col.y - camY + Math.sin((time + col.animTimer) * 0.06) * 4;

  if (x + col.width < -10 || x > CANVAS_WIDTH + 10) return;

  ctx.save();

  const cx = x + col.width / 2;
  const cy = y + col.height / 2;
  const s = col.width / 2;

  if (col.type === "health") {
    // Cupcake mini (mesma lógica do player mas bem menor)
    const miniCupH = s * 0.9;
    const miniCupTopW = s * 1.1;
    const miniCupBotW = s * 1.4;
    const cupYTop = cy;

    ctx.fillStyle = "#D4956B";
    ctx.beginPath();
    ctx.moveTo(cx - miniCupTopW / 2, cupYTop);
    ctx.lineTo(cx + miniCupTopW / 2, cupYTop);
    ctx.lineTo(cx + miniCupBotW / 2, cy + miniCupH);
    ctx.lineTo(cx - miniCupBotW / 2, cy + miniCupH);
    ctx.closePath();
    ctx.fill();

    // Glacê
    ctx.fillStyle = COLORS.healthPickup;
    ctx.shadowColor = COLORS.healthPickup;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(cx, cupYTop, s * 0.85, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    // Cerejinha
    ctx.fillStyle = COLORS.turretBody;
    ctx.beginPath();
    ctx.arc(cx, cupYTop - s * 0.8, s * 0.22, 0, Math.PI * 2);
    ctx.fill();
  } else if (col.type === "ammo") {
    // Embalagem de bombom dourada (retângulo + nós nas pontas)
    ctx.fillStyle = COLORS.ammoPickup;
    ctx.shadowColor = COLORS.ammoPickup;
    ctx.shadowBlur = 8;
    // Corpo central
    ctx.fillRect(cx - s * 0.7, cy - s * 0.4, s * 1.4, s * 0.8);
    // Nó esquerdo
    ctx.beginPath();
    ctx.arc(cx - s * 0.7, cy, s * 0.4, 0, Math.PI * 2);
    ctx.fill();
    // Nó direito
    ctx.beginPath();
    ctx.arc(cx + s * 0.7, cy, s * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // Brilho
    ctx.fillStyle = "#FFF8F060";
    ctx.beginPath();
    ctx.ellipse(
      cx - s * 0.1,
      cy - s * 0.15,
      s * 0.35,
      s * 0.18,
      -0.3,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  } else {
    // data_chip: pirulito (círculo lavanda no palitinho)
    // Palitinho
    ctx.strokeStyle = "#C8A0B8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy + s);
    ctx.stroke();

    // Círculo do pirulito
    ctx.fillStyle = COLORS.dataChip;
    ctx.shadowColor = COLORS.dataChip;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(cx, cy - s * 0.2, s * 0.85, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Espiral do pirulito
    ctx.strokeStyle = COLORS.white + "80";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy - s * 0.2, s * 0.5, -Math.PI * 0.4, Math.PI * 1.1);
    ctx.stroke();
  }

  ctx.restore();
}

// ---------- HUD ----------
function renderHUD(ctx: CanvasRenderingContext2D, state: GameState) {
  const player = state.player;

  ctx.save();
  ctx.shadowBlur = 0;

  // === Vida: ícones de cupcake mini ===
  for (let i = 0; i < player.maxHealth; i++) {
    const hx = 16 + i * 30;
    const hy = 14;
    const filled = i < player.health;

    if (filled) {
      // Forminha
      ctx.fillStyle = "#D4956B";
      ctx.beginPath();
      ctx.moveTo(hx + 5, hy + 11);
      ctx.lineTo(hx + 15, hy + 11);
      ctx.lineTo(hx + 17, hy + 20);
      ctx.lineTo(hx + 3, hy + 20);
      ctx.closePath();
      ctx.fill();
      // Glacê
      ctx.fillStyle = COLORS.hudHealth;
      ctx.shadowColor = COLORS.hudHealth;
      ctx.shadowBlur = 5;
      ctx.beginPath();
      ctx.arc(hx + 10, hy + 11, 8, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      // Cerejinha
      ctx.fillStyle = COLORS.turretBody;
      ctx.beginPath();
      ctx.arc(hx + 10, hy + 3, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Cupcake vazio (cinza)
      ctx.fillStyle = COLORS.gray + "60";
      ctx.beginPath();
      ctx.moveTo(hx + 5, hy + 11);
      ctx.lineTo(hx + 15, hy + 11);
      ctx.lineTo(hx + 17, hy + 20);
      ctx.lineTo(hx + 3, hy + 20);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = COLORS.gray + "40";
      ctx.beginPath();
      ctx.arc(hx + 10, hy + 11, 8, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
    }
  }

  // === Munição: ícone de bombom + número ===
  const ammoLow = player.ammo <= 3;
  const ammoBlink = ammoLow && Math.floor(state.time * 0.15) % 2 === 0;
  const ammoColor = ammoBlink ? COLORS.red : COLORS.hudAmmo;

  // Ícone de bombom pequeno
  ctx.fillStyle = ammoColor;
  if (ammoBlink) {
    ctx.shadowColor = COLORS.red;
    ctx.shadowBlur = 8;
  }
  ctx.beginPath();
  ctx.arc(16 + 5, 54, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(16 - 4, 54, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(16 + 14, 54, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(16 - 1, 49, 12, 10);
  ctx.shadowBlur = 0;

  ctx.fillStyle = ammoColor;
  ctx.font = "bold 14px 'Fredoka', 'Comic Sans MS', cursive, serif";
  ctx.textAlign = "left";
  ctx.fillText(`${player.ammo}`, 36, 59);

  // Barra de munição
  ctx.fillStyle = "#C8A4B830";
  ctx.beginPath();
  ctx.roundRect(16, 64, 100, 4, 2);
  ctx.fill();
  ctx.fillStyle = ammoLow ? COLORS.red : COLORS.hudAmmo;
  const ammoRatio = Math.min(1, player.ammo / PLAYER_START_AMMO);
  ctx.beginPath();
  ctx.roundRect(16, 64, 100 * ammoRatio, 4, 2);
  ctx.fill();

  // === Score: número grande em fonte arredondada ===
  ctx.fillStyle = COLORS.hudScore;
  ctx.shadowColor = COLORS.hudScore;
  ctx.shadowBlur = 4;
  ctx.font = "bold 18px 'Fredoka', 'Comic Sans MS', cursive, serif";
  ctx.textAlign = "right";
  ctx.fillText(`${player.score} pts`, CANVAS_WIDTH - 16, 28);
  ctx.shadowBlur = 0;

  // === Indicador de zona: caixinha estilo "pacote de doce" ===
  const section = getCurrentSection(state);
  const zoneLabel = section.toUpperCase();
  ctx.font = "10px 'Fredoka', 'Comic Sans MS', cursive, serif";
  const zoneW = ctx.measureText(zoneLabel).width + 20;
  const zoneX = CANVAS_WIDTH - 16 - zoneW;
  const zoneY = 34;

  ctx.fillStyle = COLORS.magenta + "30";
  ctx.beginPath();
  ctx.roundRect(zoneX, zoneY, zoneW, 16, 4);
  ctx.fill();
  ctx.strokeStyle = COLORS.magenta + "80";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(zoneX, zoneY, zoneW, 16, 4);
  ctx.stroke();

  ctx.fillStyle = COLORS.magenta;
  ctx.textAlign = "center";
  ctx.fillText(zoneLabel, zoneX + zoneW / 2, zoneY + 11);

  // === Boss HP bar ===
  const boss = state.enemies.find((e) => e.type === "boss" && e.alive);
  if (boss && state.player.x >= state.level.sections.boss.startX) {
    const barW = 300;
    const barH = 12;
    const barX = CANVAS_WIDTH / 2 - barW / 2;
    const barY = 16;
    const phase = boss.bossPhase || 1;
    const healthRatio = boss.health / boss.maxHealth;
    const barColor =
      phase === 3 ? COLORS.yellow : phase === 2 ? COLORS.red : COLORS.magenta;

    // Nome do boss em fonte lúdica
    ctx.fillStyle = COLORS.black;
    ctx.font = "bold 13px 'Fredoka', 'Comic Sans MS', cursive, serif";
    ctx.textAlign = "center";
    ctx.fillText(`Alface Gigante - Fase ${phase}`, CANVAS_WIDTH / 2, barY - 5);

    // Fundo da barra
    ctx.fillStyle = "#C8A4B830";
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 6);
    ctx.fill();

    // Barra de vida
    ctx.fillStyle = barColor;
    ctx.shadowColor = barColor;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW * healthRatio, barH, 6);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Borda
    ctx.strokeStyle = COLORS.darkPurple + "60";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 6);
    ctx.stroke();
  }

  ctx.restore();
}

// ---------- Ready Overlay (Tutorial) ----------
function renderReadyOverlay(ctx: CanvasRenderingContext2D, time: number) {
  ctx.save();

  // Fundo suave candy
  ctx.fillStyle = "rgba(58, 40, 64, 0.82)";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Decorações de cupcake nos cantos
  drawMiniCupcake(ctx, 80, 80, 28);
  drawMiniCupcake(ctx, CANVAS_WIDTH - 80, 80, 28);
  drawMiniCupcake(ctx, 80, CANVAS_HEIGHT - 80, 28);
  drawMiniCupcake(ctx, CANVAS_WIDTH - 80, CANVAS_HEIGHT - 80, 28);

  // Título em fonte cursiva com bounce
  const bounce = Math.sin(time * 0.05) * 4;
  ctx.fillStyle = COLORS.playerBody;
  ctx.shadowColor = COLORS.playerGlow;
  ctx.shadowBlur = 18;
  ctx.font = "bold 36px 'Fredoka', 'Comic Sans MS', cursive, serif";
  ctx.textAlign = "center";
  ctx.fillText("Preparado?", CANVAS_WIDTH / 2, 155 + bounce);
  ctx.shadowBlur = 0;

  // Subtítulo
  ctx.fillStyle = COLORS.white + "AA";
  ctx.font = "15px 'Fredoka', 'Comic Sans MS', cursive, serif";
  ctx.fillText(
    "Aprenda os controles antes de entrar na batalha",
    CANVAS_WIDTH / 2,
    192,
  );

  // Linha decorativa candy
  ctx.strokeStyle = COLORS.magenta + "50";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(CANVAS_WIDTH / 2 - 200, 212);
  ctx.lineTo(CANVAS_WIDTH / 2 + 200, 212);
  ctx.stroke();

  // Controles (lidos das configurações do jogador)
  const settings = loadSettings();
  const bindings = settings.keyBindings;
  const leftKeys = [bindings.left[0], bindings.left[1]]
    .filter(Boolean)
    .map((k) => getKeyDisplayName(k!));
  const rightKeys = [bindings.right[0], bindings.right[1]]
    .filter(Boolean)
    .map((k) => getKeyDisplayName(k!));
  const moveKey =
    leftKeys[0] +
    " / " +
    rightKeys[0] +
    (leftKeys[1] && rightKeys[1]
      ? "  ou  " + leftKeys[1] + " / " + rightKeys[1]
      : "");

  function formatKeys(action: GameAction): string {
    const keys = bindings[action];
    const parts = [keys[0], keys[1]]
      .filter(Boolean)
      .map((k) => getKeyDisplayName(k!));
    if (action === "shoot") parts.push("CLIQUE");
    return parts.join(" / ");
  }

  const controls = [
    { key: moveKey, desc: "Mover" },
    { key: formatKeys("jump"), desc: ACTION_LABELS.jump },
    { key: formatKeys("down"), desc: ACTION_LABELS.down },
    { key: formatKeys("shoot"), desc: ACTION_LABELS.shoot },
    { key: formatKeys("pause"), desc: ACTION_LABELS.pause },
  ];

  const startY = 240;
  const spacing = 42;

  controls.forEach((ctrl, i) => {
    const y = startY + i * spacing;

    // Pill da tecla
    ctx.fillStyle = COLORS.magenta + "30";
    const keyW = 220;
    ctx.beginPath();
    ctx.roundRect(CANVAS_WIDTH / 2 - keyW - 15, y - 14, keyW, 26, 8);
    ctx.fill();
    ctx.strokeStyle = COLORS.magenta + "60";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(CANVAS_WIDTH / 2 - keyW - 15, y - 14, keyW, 26, 8);
    ctx.stroke();

    // Tecla
    ctx.fillStyle = COLORS.magenta;
    ctx.font = "bold 13px 'Fredoka', 'Comic Sans MS', cursive, serif";
    ctx.textAlign = "right";
    ctx.fillText(ctrl.key, CANVAS_WIDTH / 2 - 22, y + 2);

    // Descrição
    ctx.fillStyle = COLORS.white + "CC";
    ctx.font = "14px 'Fredoka', 'Comic Sans MS', cursive, serif";
    ctx.textAlign = "left";
    ctx.fillText(ctrl.desc, CANVAS_WIDTH / 2 + 18, y + 2);
  });

  // Dica de objetivo
  ctx.fillStyle = COLORS.yellow + "CC";
  ctx.font = "13px 'Fredoka', 'Comic Sans MS', cursive, serif";
  ctx.textAlign = "center";
  const objY = startY + controls.length * spacing + 28;
  ctx.fillText(
    "Devore os doces e derrote o Alface Gigante!",
    CANVAS_WIDTH / 2,
    objY,
  );

  // Prompt piscante
  const blink = Math.sin(time * 0.08) > 0;
  if (blink) {
    ctx.fillStyle = COLORS.yellow;
    ctx.shadowColor = COLORS.yellow;
    ctx.shadowBlur = 10;
    ctx.font = "bold 18px 'Fredoka', 'Comic Sans MS', cursive, serif";
    ctx.fillText(
      "Pressione qualquer tecla para comecar",
      CANVAS_WIDTH / 2,
      objY + 58,
    );
  }

  ctx.restore();
}

// Helper: cupcake mini decorativo para overlays
function drawMiniCupcake(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
) {
  ctx.save();
  // Forminha
  ctx.fillStyle = "#D4956B80";
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.4, cy);
  ctx.lineTo(cx + size * 0.4, cy);
  ctx.lineTo(cx + size * 0.5, cy + size * 0.7);
  ctx.lineTo(cx - size * 0.5, cy + size * 0.7);
  ctx.closePath();
  ctx.fill();
  // Glacê
  ctx.fillStyle = COLORS.playerBody + "90";
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.4, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  // Cereja
  ctx.fillStyle = COLORS.turretBody + "90";
  ctx.beginPath();
  ctx.arc(cx, cy - size * 0.38, size * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function getCurrentSection(state: GameState): string {
  const px = state.player.x;
  if (px < state.level.sections.streets.endX) return "As Ruas";
  if (px < state.level.sections.ducts.endX) return "Estruturas Elevadas";
  return "Confronto Final";
}

// ---------- Zone Transition — placa de confeitaria ----------
function renderZoneTransition(
  ctx: CanvasRenderingContext2D,
  zoneName: string,
  timer: number,
) {
  ctx.save();

  // Fade in nos primeiros 30 frames, fade out nos últimos 30
  let alpha = 1;
  if (timer > 90) alpha = (120 - timer) / 30;
  else if (timer < 30) alpha = timer / 30;

  // Fundo suave cobrindo a tela inteira
  ctx.fillStyle = `rgba(42, 10, 58, ${0.5 * alpha})`;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Placa de confeitaria central
  const plateW = 720;
  const plateH = 200;
  const plateX = (CANVAS_WIDTH - plateW) / 2;
  const plateY = (CANVAS_HEIGHT - plateH) / 2;

  ctx.globalAlpha = alpha;

  // Fita dourada superior (arco)
  ctx.fillStyle = "#FFB347";
  ctx.beginPath();
  ctx.moveTo(plateX + 40, plateY);
  ctx.quadraticCurveTo(
    CANVAS_WIDTH / 2,
    plateY - 38,
    plateX + plateW - 40,
    plateY,
  );
  ctx.lineTo(plateX + plateW - 40, plateY + 28);
  ctx.quadraticCurveTo(CANVAS_WIDTH / 2, plateY - 10, plateX + 40, plateY + 28);
  ctx.closePath();
  ctx.fill();

  // Placa principal (branca com borda rosa dupla)
  const plateGrad = ctx.createLinearGradient(0, plateY, 0, plateY + plateH);
  plateGrad.addColorStop(0, "#FFF8F0");
  plateGrad.addColorStop(1, "#FFE8F0");
  ctx.fillStyle = plateGrad;
  ctx.shadowColor = "#00000040";
  ctx.shadowBlur = 24;
  ctx.beginPath();
  ctx.roundRect(plateX, plateY, plateW, plateH, 24);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Borda externa magenta
  ctx.strokeStyle = COLORS.magenta;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(plateX, plateY, plateW, plateH, 24);
  ctx.stroke();

  // Borda interna dourada
  ctx.strokeStyle = "#FFB347";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(plateX + 10, plateY + 10, plateW - 20, plateH - 20, 18);
  ctx.stroke();

  // Pregos decorativos nos 4 cantos
  for (const [bx, by] of [
    [plateX + 22, plateY + 22],
    [plateX + plateW - 22, plateY + 22],
    [plateX + 22, plateY + plateH - 22],
    [plateX + plateW - 22, plateY + plateH - 22],
  ] as const) {
    ctx.fillStyle = "#FFB347";
    ctx.beginPath();
    ctx.arc(bx, by, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#FFD86B";
    ctx.beginPath();
    ctx.arc(bx - 1.5, by - 1.5, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // "BEM-VINDO A" pequeno no topo
  ctx.fillStyle = COLORS.magenta;
  ctx.font = "bold 18px 'Fredoka', 'Comic Sans MS', cursive, serif";
  ctx.textAlign = "center";
  ctx.fillText("★  BEM-VINDO A  ★", CANVAS_WIDTH / 2, plateY + 55);

  // Nome da zona grande (gradient candy via fallback — não usamos drawCandyTitle aqui pra controlar alpha)
  const titleGrad = ctx.createLinearGradient(
    plateX + 40,
    0,
    plateX + plateW - 40,
    0,
  );
  titleGrad.addColorStop(0, "#FF5FA8");
  titleGrad.addColorStop(0.5, "#FFB347");
  titleGrad.addColorStop(1, "#B08BE8");
  ctx.fillStyle = titleGrad;
  ctx.shadowColor = COLORS.magenta + "80";
  ctx.shadowBlur = 12;
  ctx.font = "bold 48px 'Fredoka', 'Comic Sans MS', cursive, serif";
  ctx.fillText(zoneName, CANVAS_WIDTH / 2, plateY + 115);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#FFFFFF80";
  ctx.lineWidth = 1.2;
  ctx.strokeText(zoneName, CANVAS_WIDTH / 2, plateY + 115);

  // Linha decorativa com estrelinhas
  ctx.strokeStyle = COLORS.magenta + "80";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(plateX + 120, plateY + 145);
  ctx.lineTo(plateX + plateW - 120, plateY + 145);
  ctx.stroke();
  ctx.fillStyle = "#FFB347";
  for (const sx of [plateX + 120, plateX + plateW - 120]) {
    ctx.beginPath();
    ctx.arc(sx, plateY + 145, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Subtítulo incentivo
  ctx.fillStyle = COLORS.darkPurple + "BB";
  ctx.font = "14px 'Fredoka', 'Comic Sans MS', cursive, serif";
  ctx.fillText(
    "Prepare-se para a proxima area!",
    CANVAS_WIDTH / 2,
    plateY + 172,
  );

  ctx.restore();
}

// ---------- Pause Overlay ----------
function renderPauseOverlay(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.fillStyle = "rgba(58, 40, 64, 0.72)";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Ícone de cupcake ao lado do texto
  drawMiniCupcake(ctx, CANVAS_WIDTH / 2 - 130, CANVAS_HEIGHT / 2 - 22, 32);
  drawMiniCupcake(ctx, CANVAS_WIDTH / 2 + 130, CANVAS_HEIGHT / 2 - 22, 32);

  // "PAUSADO" em fonte cursiva grande
  ctx.fillStyle = COLORS.playerBody;
  ctx.shadowColor = COLORS.playerGlow;
  ctx.shadowBlur = 16;
  ctx.font = "bold 40px 'Fredoka', 'Comic Sans MS', cursive, serif";
  ctx.textAlign = "center";
  ctx.fillText("Pausado", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 8);
  ctx.shadowBlur = 0;

  // Instruções
  ctx.fillStyle = COLORS.neonGreen + "DD";
  ctx.font = "bold 16px 'Fredoka', 'Comic Sans MS', cursive, serif";
  ctx.fillText("P  —  Continuar", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 28);

  ctx.fillStyle = COLORS.red + "DD";
  ctx.font = "bold 16px 'Fredoka', 'Comic Sans MS', cursive, serif";
  ctx.fillText(
    "ESC  —  Sair ao Menu",
    CANVAS_WIDTH / 2,
    CANVAS_HEIGHT / 2 + 56,
  );

  ctx.restore();
}
