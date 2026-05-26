import { useRef, useCallback } from 'react';
import { useGameLoop } from './useGameLoop.js';
import {
  drawBackground, drawGround, drawPipes,
  drawBird, drawScore, drawFlash, roundRect,
} from './renderer.js';
import {
  W, H,
  BIRD_X, BIRD_R, GRAVITY, JUMP, MAX_FALL, TILT_UP, TILT_DOWN,
  PIPE_W, GAP, PIPE_SPEED, SPAWN_MS, MIN_PIPE_H,
  GROUND_H, SCROLL_SPD,
} from './constants.js';

const GROUND_Y = H - GROUND_H;

// ── initial mutable state (plain object in a ref) ─────────────────────
function freshState(bestScore = 0) {
  return {
    phase:      'idle',   // 'idle' | 'playing' | 'dead'
    birdY:      GROUND_Y / 2 - 20,
    birdVy:     0,
    birdTilt:   0,
    wingAngle:  0,
    pipes:      [],
    score:      0,
    bestScore,
    pipeTimer:  0,
    scrollX:    0,
    flash:      0,
    // dead-panel slide-in (0 = fully off-screen above, 1 = settled)
    panelT:     0,
  };
}

export default function FlappyBird() {
  const canvasRef = useRef(null);
  const g         = useRef(freshState()); // single mutable game-state object

  // ── jump / restart ────────────────────────────────────────────────
  const handleInput = useCallback(() => {
    const s = g.current;
    if (s.phase === 'idle') {
      s.phase  = 'playing';
      s.birdVy = JUMP;
    } else if (s.phase === 'playing') {
      s.birdVy = JUMP;
    } else if (s.phase === 'dead' && s.panelT >= 0.92) {
      // only allow restart once the game-over panel has settled
      g.current = freshState(s.bestScore);
    }
  }, []);

  // ── keyboard ──────────────────────────────────────────────────────
  // Attached once via useGameLoop's effect; we use a stable ref so no
  // need to re-register on every render.
  const inputRef = useRef(handleInput);
  inputRef.current = handleInput;

  // Register key + touch listeners once alongside the canvas.
  // React (StrictMode) calls this with null on unmount — handle both cases.
  const canvasCallbackRef = useCallback((canvas) => {
    if (!canvas) {
      // unmount: clean up previous listeners
      if (canvasRef.current?._cleanup) canvasRef.current._cleanup();
      canvasRef.current = null;
      return;
    }
    canvasRef.current = canvas;

    const onClick = () => inputRef.current();
    const onKey   = (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        inputRef.current();
      }
    };
    const onTouch = (e) => { e.preventDefault(); inputRef.current(); };

    window.addEventListener('keydown', onKey);
    canvas.addEventListener('click',      onClick);
    canvas.addEventListener('touchstart', onTouch, { passive: false });

    canvas._cleanup = () => {
      window.removeEventListener('keydown', onKey);
      canvas.removeEventListener('click',      onClick);
      canvas.removeEventListener('touchstart', onTouch);
    };
  }, []);

  // ── game + draw tick ──────────────────────────────────────────────
  const tick = useCallback((delta, ts) => {
    const s  = g.current;
    const dt = Math.min(delta, 50); // cap spiral-of-death

    // always scroll background
    s.scrollX += SCROLL_SPD * dt / 16.67;

    if (s.phase === 'idle') {
      // gentle bob
      s.birdY     = GROUND_Y / 2 - 20 + Math.sin(ts / 380) * 8;
      s.wingAngle += 0.14 * dt / 16.67;

    } else if (s.phase === 'playing') {
      // ── physics ─────────────────────────────────────────────────
      s.birdVy = Math.min(s.birdVy + GRAVITY * dt / 16.67, MAX_FALL);
      s.birdY += s.birdVy * dt / 16.67;
      s.wingAngle += 0.22 * dt / 16.67;

      // tilt
      const target = s.birdVy < 0 ? TILT_UP : Math.min(TILT_DOWN, s.birdVy * 5);
      s.birdTilt  += (target - s.birdTilt) * 0.16;

      // ── pipe spawning ────────────────────────────────────────────
      s.pipeTimer += dt;
      if (s.pipeTimer >= SPAWN_MS) {
        const maxTop = GROUND_Y - GAP - MIN_PIPE_H;
        const topH   = Math.random() * (maxTop - MIN_PIPE_H) + MIN_PIPE_H;
        s.pipes.push({ x: W + 12, topH, scored: false });
        s.pipeTimer %= SPAWN_MS;
      }

      // ── move + cull pipes ────────────────────────────────────────
      const speed = PIPE_SPEED * dt / 16.67;
      s.pipes = s.pipes
        .map(p => ({ ...p, x: p.x - speed }))
        .filter(p => p.x + PIPE_W > -20);

      // ── scoring ──────────────────────────────────────────────────
      for (const p of s.pipes) {
        if (!p.scored && p.x + PIPE_W < BIRD_X - BIRD_R) {
          p.scored = true;
          s.score++;
        }
      }

      // ── collision detection ──────────────────────────────────────
      const hr = BIRD_R - 3; // slightly generous hitbox
      if (s.birdY + hr >= GROUND_Y || s.birdY - hr <= 0) {
        die(s);
      } else {
        for (const p of s.pipes) {
          if (BIRD_X + hr > p.x && BIRD_X - hr < p.x + PIPE_W) {
            if (s.birdY - hr < p.topH || s.birdY + hr > p.topH + GAP) {
              die(s);
              break;
            }
          }
        }
      }

    } else if (s.phase === 'dead') {
      // ── flash fade ───────────────────────────────────────────────
      if (s.flash > 0) s.flash = Math.max(0, s.flash - 0.045 * dt / 16.67);
      // ── panel slide-in (spring: t → 1) ──────────────────────────
      if (s.panelT < 1) s.panelT = Math.min(1, s.panelT + 0.04 * dt / 16.67);
    }

    // ── draw ──────────────────────────────────────────────────────
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, W, H);
    drawBackground(ctx, s.scrollX);
    drawPipes(ctx, s.pipes);
    drawGround(ctx, s.scrollX);
    drawBird(ctx, s.birdY, s.birdTilt, s.wingAngle);

    if (s.phase !== 'idle') drawScore(ctx, s.score);
    if (s.flash > 0)        drawFlash(ctx, s.flash);

    if (s.phase === 'idle')  drawIdleOverlay(ctx);
    if (s.phase === 'dead')  drawDeadOverlay(ctx, s.score, s.bestScore, s.panelT);
  }, []);

  useGameLoop(tick);

  return (
    <div className="game-wrapper">
      <div className="canvas-container">
        <canvas
          ref={canvasCallbackRef}
          width={W}
          height={H}
        />
      </div>
    </div>
  );
}

// ── helpers ────────────────────────────────────────────────────────────
function die(s) {
  s.phase     = 'dead';
  s.flash     = 1;
  s.panelT    = 0;
  s.bestScore = Math.max(s.score, s.bestScore);
}

// ── idle overlay ───────────────────────────────────────────────────────
function drawIdleOverlay(ctx) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(0, 0, W, H);

  const px = W / 2 - 158, py = H / 2 - 105, pw = 316, ph = 200;
  ctx.fillStyle = 'rgba(255,255,255,0.93)';
  roundRect(ctx, px, py, pw, ph, 20);
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#1565c0';
  ctx.font      = 'bold 38px "Segoe UI",Arial,sans-serif';
  ctx.fillText('FLAPPY BIRD', W / 2, H / 2 - 52);

  ctx.fillStyle = '#546e7a';
  ctx.font      = '19px "Segoe UI",Arial,sans-serif';
  ctx.fillText('Press  Space  or  ↑  to fly', W / 2, H / 2 - 6);
  ctx.fillText('Tap or click to jump', W / 2, H / 2 + 26);

  ctx.restore();
}

// ── dead overlay ───────────────────────────────────────────────────────
// panelT: 0 (hidden above) → 1 (settled), eased with overshoot
function drawDeadOverlay(ctx, score, best, panelT) {
  // backdrop fades in with panel
  ctx.fillStyle = `rgba(0,0,0,${0.45 * easeOut(panelT)})`;
  ctx.fillRect(0, 0, W, H);

  // spring overshoot: panel drops in from above
  const ease    = springEase(panelT);
  const panelH  = 268;
  const panelW  = 304;
  const panelX  = W / 2 - panelW / 2;
  const panelY0 = H / 2 - panelH / 2;            // final Y
  const panelY  = panelY0 - (1 - ease) * (panelH + 80); // starts above viewport

  ctx.save();
  ctx.globalAlpha = Math.min(1, easeOut(panelT) * 1.4);

  // panel background
  ctx.fillStyle = 'rgba(255,248,230,0.97)';
  roundRect(ctx, panelX, panelY, panelW, panelH, 20);
  ctx.fill();
  ctx.strokeStyle = '#d4960a';
  ctx.lineWidth   = 4;
  roundRect(ctx, panelX, panelY, panelW, panelH, 20);
  ctx.stroke();

  // "GAME OVER"
  ctx.textAlign = 'center';
  ctx.fillStyle = '#c62828';
  ctx.font      = 'bold 36px "Segoe UI",Arial,sans-serif';
  ctx.fillText('GAME OVER', W / 2, panelY + 50);

  // score boxes
  const bx1 = panelX + 18, bx2 = panelX + panelW / 2 + 8;
  const boxW = panelW / 2 - 26, boxH = 72, boxY = panelY + 68;

  ctx.fillStyle = 'rgba(0,0,0,0.07)';
  roundRect(ctx, bx1, boxY, boxW, boxH, 12); ctx.fill();
  roundRect(ctx, bx2, boxY, boxW, boxH, 12); ctx.fill();

  ctx.fillStyle   = '#888';
  ctx.font        = 'bold 11px "Segoe UI",Arial,sans-serif';
  ctx.fillText('SCORE', bx1 + boxW / 2, boxY + 20);
  ctx.fillText('BEST',  bx2 + boxW / 2, boxY + 20);

  ctx.font      = 'bold 38px "Segoe UI",Arial,sans-serif';
  ctx.fillStyle = '#222';
  ctx.fillText(score, bx1 + boxW / 2, boxY + 57);
  ctx.fillStyle = '#d4960a';
  ctx.fillText(best,  bx2 + boxW / 2, boxY + 57);

  // "New Best" badge
  if (score > 0 && score === best) {
    ctx.fillStyle = '#ff8f00';
    ctx.font      = 'bold 14px "Segoe UI",Arial,sans-serif';
    ctx.fillText('✨ New Best!', bx2 + boxW / 2, boxY + 78);
  }

  // restart button
  const btnY = panelY + 158, btnH = 52, btnX = panelX + 28, btnW = panelW - 56;
  ctx.fillStyle = '#2e7d32';
  roundRect(ctx, btnX, btnY + 4, btnW, btnH, 14); ctx.fill();
  ctx.fillStyle = '#43a047';
  roundRect(ctx, btnX, btnY, btnW, btnH, 14); ctx.fill();

  ctx.fillStyle = 'white';
  ctx.font      = 'bold 20px "Segoe UI",Arial,sans-serif';
  ctx.fillText('▶  Play Again', W / 2, btnY + 33);

  ctx.fillStyle = '#78909c';
  ctx.font      = '13px "Segoe UI",Arial,sans-serif';
  ctx.fillText('Space / ↑ / click', W / 2, btnY + 62);

  ctx.globalAlpha = 1;
  ctx.restore();
}

// ease helpers
function easeOut(t) { return 1 - (1 - t) ** 2; }
function springEase(t) {
  // slight overshoot then settle
  const c4 = (2 * Math.PI) / 3;
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return 1 + Math.sin(-13 * c4 * (t + 1)) * (2 ** (-10 * t));
}
