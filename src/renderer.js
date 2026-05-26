import { W, H, BIRD_X, BIRD_R, PIPE_W, GAP, GROUND_H } from './constants.js';

const GROUND_Y  = H - GROUND_H;
const SKY_TOP   = '#70c5ce';
const SKY_BOT   = '#c9e8ec';
const PIPE_MID  = '#73bf2e';
const PIPE_DARK = '#558c1f';
const PIPE_LITE = '#92d94a';

// ── helpers ──────────────────────────────────────────────────────────
export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ── background ───────────────────────────────────────────────────────
export function drawBackground(ctx, scrollX) {
  const grad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  grad.addColorStop(0, SKY_TOP);
  grad.addColorStop(1, SKY_BOT);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, GROUND_Y);
  drawClouds(ctx, scrollX);
}

const CLOUD_DEFS = [
  { bx: 55,  y: 82,  s: 1.0 },
  { bx: 220, y: 52,  s: 0.72 },
  { bx: 375, y: 105, s: 0.88 },
  { bx: 510, y: 68,  s: 0.62 },
];

function drawClouds(ctx, scrollX) {
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  const span = W + 140;
  for (const c of CLOUD_DEFS) {
    const rawX = c.bx - scrollX * 0.28;
    const x = ((rawX % span) + span) % span - 60;
    ctx.save();
    ctx.translate(x, c.y);
    ctx.scale(c.s, c.s);
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.arc(28, -8, 18, 0, Math.PI * 2);
    ctx.arc(-24, 4, 16, 0, Math.PI * 2);
    ctx.arc(10, -18, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ── ground ───────────────────────────────────────────────────────────
export function drawGround(ctx, scrollX) {
  const grad = ctx.createLinearGradient(0, GROUND_Y, 0, H);
  grad.addColorStop(0,   '#ded895');
  grad.addColorStop(0.3, '#c2a633');
  grad.addColorStop(1,   '#8b6914');
  ctx.fillStyle = grad;
  ctx.fillRect(0, GROUND_Y, W, GROUND_H);

  ctx.fillStyle = '#5cb85c';
  ctx.fillRect(0, GROUND_Y, W, 8);

  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  const dw = 42, gap = 28, step = dw + gap;
  const off = scrollX % step;
  for (let x = -step + off; x < W + step; x += step) {
    ctx.fillRect(x, GROUND_Y + 18, dw, 5);
  }
}

// ── pipes ─────────────────────────────────────────────────────────────
export function drawPipes(ctx, pipes) {
  for (const p of pipes) {
    const botH = GROUND_Y - p.topH - GAP;
    drawPipe(ctx, p.x, p.topH, true);
    drawPipe(ctx, p.x, botH,   false);
  }
}

function pipeGrad(ctx, x) {
  const g = ctx.createLinearGradient(x, 0, x + PIPE_W, 0);
  g.addColorStop(0,   PIPE_DARK);
  g.addColorStop(0.3, PIPE_MID);
  g.addColorStop(0.7, PIPE_LITE);
  g.addColorStop(1,   PIPE_DARK);
  return g;
}

function drawPipe(ctx, x, height, isTop) {
  const capH = 26;
  const capX = x - 5;
  const capW = PIPE_W + 10;

  if (isTop) {
    // body: from top of canvas down to just above the cap
    ctx.fillStyle = pipeGrad(ctx, x);
    ctx.fillRect(x, 0, PIPE_W, height - capH);
    // cap at bottom of top pipe (facing the gap)
    ctx.fillStyle = pipeGrad(ctx, capX);
    roundRect(ctx, capX, height - capH, capW, capH, 4);
    ctx.fill();
  } else {
    // cap at top of bottom pipe (facing the gap)
    const capY  = GROUND_Y - height;
    const bodyY = capY + capH;          // body starts BELOW the cap
    const bodyH = height - capH;        // body fills from below cap to ground
    ctx.fillStyle = pipeGrad(ctx, capX);
    roundRect(ctx, capX, capY, capW, capH, 4);
    ctx.fill();
    // body
    ctx.fillStyle = pipeGrad(ctx, x);
    ctx.fillRect(x, bodyY, PIPE_W, bodyH);
  }

  // outline
  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  ctx.lineWidth   = 1.5;
  if (isTop) {
    ctx.strokeRect(x, 0, PIPE_W, height - capH);
    roundRect(ctx, capX, height - capH, capW, capH, 4);
    ctx.stroke();
  } else {
    const capY  = GROUND_Y - height;
    const bodyY = capY + capH;
    const bodyH = height - capH;
    roundRect(ctx, capX, capY, capW, capH, 4);
    ctx.stroke();
    ctx.strokeRect(x, bodyY, PIPE_W, bodyH);
  }
}

// ── bird ──────────────────────────────────────────────────────────────
export function drawBird(ctx, birdY, tilt, wingAngle) {
  ctx.save();
  ctx.translate(BIRD_X, birdY);
  ctx.rotate((tilt * Math.PI) / 180);

  const r = BIRD_R;

  // wing (behind body)
  ctx.save();
  ctx.rotate(-0.3 + Math.sin(wingAngle) * 0.55);
  ctx.fillStyle = '#e8a000';
  ctx.beginPath();
  ctx.ellipse(-4, 2, r * 0.72, r * 0.38, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // body
  const bg = ctx.createRadialGradient(-4, -4, 2, 0, 0, r);
  bg.addColorStop(0,   '#ffe066');
  bg.addColorStop(0.6, '#f5c518');
  bg.addColorStop(1,   '#d4960a');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // eye white
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.arc(7, -6, 7, 0, Math.PI * 2);
  ctx.fill();
  // pupil
  ctx.fillStyle = '#1a1a2e';
  ctx.beginPath();
  ctx.arc(9, -5, 3.5, 0, Math.PI * 2);
  ctx.fill();
  // shine
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath();
  ctx.arc(10, -7, 1.5, 0, Math.PI * 2);
  ctx.fill();

  // beak
  ctx.fillStyle = '#ff7b00';
  ctx.beginPath();
  ctx.moveTo(r - 2, -3);
  ctx.lineTo(r + 11, 0);
  ctx.lineTo(r - 2, 5);
  ctx.closePath();
  ctx.fill();

  // body outline
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

// ── score ─────────────────────────────────────────────────────────────
export function drawScore(ctx, score) {
  ctx.save();
  ctx.textAlign  = 'center';
  ctx.font       = 'bold 52px "Segoe UI", Arial, sans-serif';
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth  = 5;
  ctx.strokeText(score, W / 2, 72);
  ctx.fillStyle  = 'white';
  ctx.fillText(score, W / 2, 72);
  ctx.restore();
}

// ── white flash on death ──────────────────────────────────────────────
export function drawFlash(ctx, alpha) {
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  ctx.fillRect(0, 0, W, H);
}
