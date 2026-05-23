/**
 * MONSTER RENDERER
 * Draws pixel monsters onto <canvas> elements, with idle animations.
 * Usage:
 *   <canvas data-monster="crystalith" data-size="96" data-mood="idle"></canvas>
 *   MonsterRenderer.mount(el)    // binds one canvas
 *   MonsterRenderer.mountAll(root)  // scans subtree, binds all
 *
 * Animation presets:
 *   breathe — vertical squish
 *   blink   — periodic eye close
 *   bob     — gentle y offset
 *   wag     — small rotation
 *   pulse   — palette highlight cycling
 *
 * Hover support: call MonsterRenderer.hover(canvas, true/false) or add data-hover="1"
 *   -> monster looks up at cursor and emits accent sparkles
 */

import { MONSTERS } from "../data/monsters.js";

const INDEX = Object.fromEntries(MONSTERS.map(m => [m.id, m]));
const GRID = 16;

const active = new Set(); // canvases being ticked

function hexOrVar(c) { return c; }

function drawMonster(ctx, monster, t, hover, pxSize) {
  const { palette, pixels, idleAnim } = monster;
  const grid = GRID;
  ctx.save();
  ctx.clearRect(0, 0, grid * pxSize, grid * pxSize);

  // Transform based on idle animation
  let scaleY = 1, offsetY = 0, rot = 0, brightness = 1;
  const motion = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--motion")) || 1;

  if (motion > 0) {
    if (idleAnim === "breathe") {
      scaleY = 1 + Math.sin(t * 0.002 * motion) * 0.04;
    } else if (idleAnim === "bob") {
      offsetY = Math.sin(t * 0.0024 * motion) * 1.5;
    } else if (idleAnim === "wag") {
      rot = Math.sin(t * 0.003 * motion) * 0.05;
    } else if (idleAnim === "pulse") {
      brightness = 0.9 + 0.15 * (0.5 + 0.5 * Math.sin(t * 0.0028 * motion));
    }
  }

  // Hover lift
  if (hover) offsetY -= 4;

  const cx = grid * pxSize / 2;
  ctx.translate(cx, cx);
  if (rot) ctx.rotate(rot);
  ctx.scale(1, scaleY);
  ctx.translate(-cx, -cx + offsetY);

  // Blink: override eyes to line color briefly every ~3s
  let blink = false;
  if (motion > 0 && (idleAnim === "blink" || (t % 3200 < 140 && idleAnim !== "pulse"))) {
    if (idleAnim === "blink") blink = ((t % 3000) < 160);
    else blink = true;
  }

  for (let y = 0; y < grid; y++) {
    const row = pixels[y] || "";
    for (let x = 0; x < grid; x++) {
      const ch = row[x];
      if (!ch || ch === ".") continue;
      let color = palette[ch];
      if (!color) continue;
      if (blink && ch === "E") color = palette.L;
      if (brightness !== 1 && ch === "H") {
        // simple brightness mod — draw an overlay tint
        color = palette.H;
      }
      ctx.fillStyle = hexOrVar(color);
      ctx.fillRect(x * pxSize, y * pxSize, pxSize, pxSize);
    }
  }

  // Hover sparkles
  if (hover && motion > 0) {
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#fff";
    ctx.fillStyle = accent;
    for (let i = 0; i < 3; i++) {
      const sx = (Math.sin(t * 0.005 + i * 2) * 0.5 + 0.5) * grid * pxSize;
      const sy = ((t * 0.08 + i * 300) % (grid * pxSize * 1.2)) - pxSize * 2;
      const s = pxSize * (i === 1 ? 1.2 : 0.8);
      ctx.globalAlpha = 0.7;
      ctx.fillRect(Math.floor(sx), Math.floor(sy), s, s);
    }
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

function tick(now) {
  for (const canvas of active) {
    if (!document.contains(canvas)) { active.delete(canvas); continue; }
    const id = canvas.dataset.monster;
    const monster = INDEX[id];
    if (!monster) continue;
    const ctx = canvas.__ctx;
    const pxSize = canvas.__px;
    const hover = canvas.__hover;
    drawMonster(ctx, monster, now, hover, pxSize);
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

function mount(canvas) {
  const id = canvas.dataset.monster;
  const monster = INDEX[id];
  if (!monster) {
    // fallback: draw a placeholder box
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#333";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }
  const size = parseInt(canvas.dataset.size || canvas.getAttribute("width") || "96", 10);
  const pxSize = Math.max(1, Math.floor(size / GRID));
  const dim = pxSize * GRID;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = dim * dpr;
  canvas.height = dim * dpr;
  canvas.style.width = dim + "px";
  canvas.style.height = dim + "px";
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.scale(dpr, dpr);
  canvas.__ctx = ctx;
  canvas.__px = pxSize;
  canvas.__hover = false;

  // Hover handlers
  canvas.addEventListener("mouseenter", () => { canvas.__hover = true; });
  canvas.addEventListener("mouseleave", () => { canvas.__hover = false; });

  active.add(canvas);
}

function mountAll(root = document) {
  root.querySelectorAll("canvas[data-monster]").forEach(mount);
}

export const MonsterRenderer = { mount, mountAll, MONSTERS, INDEX };
window.MonsterRenderer = MonsterRenderer;
