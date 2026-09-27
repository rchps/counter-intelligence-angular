// Ported from sales.html's launchConfetti(): a one-off burst of confetti drawn on a full-screen canvas
// that removes itself when it's done (about 3 seconds). Callers decide whether to play it at all, e.g.
// skipping it for people who ask for reduced motion.

// The page's own palette (Radix steps used elsewhere), so it looks like it belongs.
const COLORS = ['#46a758', '#0090ff', '#ffc53d', '#e5484d', '#6e56cf', '#12a594', '#d6409f'];
const PIECE_COUNT = 160;
const DURATION_MS = 3200;
const FADE_MS = 800;
const GRAVITY = 0.35;
const AIR_DRAG = 0.99;

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  spin: number;
  spinSpeed: number;
  color: string;
}

export function launchConfetti(): void {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.dataset['cy'] = 'confetti';
  canvas.style.cssText =
    'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:60';
  document.body.appendChild(canvas);

  // Draw at the screen's real pixel density so the pieces stay sharp on high-DPI displays.
  const ratio = window.devicePixelRatio || 1;
  canvas.width = innerWidth * ratio;
  canvas.height = innerHeight * ratio;
  const context = canvas.getContext('2d');
  if (!context) {
    canvas.remove();
    return;
  }
  context.scale(ratio, ratio);

  const pieces = Array.from({ length: PIECE_COUNT }, newPiece);
  const started = performance.now();

  const frame = (now: number): void => {
    const elapsed = now - started;
    context.clearRect(0, 0, innerWidth, innerHeight);
    context.globalAlpha = Math.max(0, 1 - Math.max(0, elapsed - DURATION_MS + FADE_MS) / FADE_MS);
    for (const piece of pieces) {
      movePiece(piece);
      drawPiece(context, piece);
    }
    if (elapsed < DURATION_MS) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}

// Thrown upward from around the middle of the screen, a little left or right of center.
function newPiece(): Piece {
  return {
    x: innerWidth / 2 + (Math.random() - 0.5) * innerWidth * 0.3,
    y: innerHeight * 0.35,
    vx: (Math.random() - 0.5) * 14,
    vy: -Math.random() * 14 - 6,
    size: 6 + Math.random() * 6,
    spin: Math.random() * Math.PI,
    spinSpeed: (Math.random() - 0.5) * 0.3,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  };
}

function movePiece(piece: Piece): void {
  piece.vy += GRAVITY;
  piece.vx *= AIR_DRAG;
  piece.x += piece.vx;
  piece.y += piece.vy;
  piece.spin += piece.spinSpeed;
}

function drawPiece(context: CanvasRenderingContext2D, piece: Piece): void {
  context.save();
  context.translate(piece.x, piece.y);
  context.rotate(piece.spin);
  context.fillStyle = piece.color;
  context.fillRect(-piece.size / 2, -piece.size / 4, piece.size, piece.size / 2);
  context.restore();
}
