/**
 * CURSOR TRAIL + CLICK SOUND FX
 * Respects Tweaks state: reads data-cursor-trail + data-sfx from <html>.
 * Draws a soft fading particle trail in the accent color.
 * Clicks: short synthesized bleep (Web Audio, no asset).
 */

let canvas, ctx;
const particles = [];
let mouseX = -999, mouseY = -999;
let enabled = true;

function initCanvas() {
  canvas = document.getElementById("cursor-trail");
  if (!canvas) return;
  ctx = canvas.getContext("2d");
  resize();
  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", onMove);
  requestAnimationFrame(frame);
  // Reflect theme toggles
  const obs = new MutationObserver(() => {
    enabled = document.documentElement.getAttribute("data-cursor-trail") !== "off";
  });
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-cursor-trail"] });
  enabled = document.documentElement.getAttribute("data-cursor-trail") !== "off";
}

function resize() {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = window.innerWidth + "px";
  canvas.style.height = window.innerHeight + "px";
  ctx.scale(dpr, dpr);
}

function onMove(e) {
  mouseX = e.clientX; mouseY = e.clientY;
  if (!enabled) return;
  const motion = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--motion")) || 1;
  if (motion === 0) return;
  for (let i = 0; i < Math.ceil(2 * motion); i++) {
    particles.push({
      x: mouseX + (Math.random() - 0.5) * 4,
      y: mouseY + (Math.random() - 0.5) * 4,
      vx: (Math.random() - 0.5) * 0.6,
      vy: (Math.random() - 0.5) * 0.6 - 0.2,
      life: 1,
      size: 3 + Math.random() * 4,
    });
  }
  if (particles.length > 300) particles.splice(0, particles.length - 300);
}

function frame() {
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (enabled) {
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#fff";
    for (const p of particles) {
      p.x += p.vx; p.y += p.vy; p.life -= 0.03;
      if (p.life <= 0) continue;
      ctx.globalAlpha = p.life * 0.6;
      ctx.fillStyle = accent;
      const s = p.size * p.life;
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
    for (let i = particles.length - 1; i >= 0; i--) {
      if (particles[i].life <= 0) particles.splice(i, 1);
    }
  } else {
    particles.length = 0;
  }
  requestAnimationFrame(frame);
}

/* -------- SOUND FX -------- */
let audioCtx = null;
function beep(freq = 880, dur = 0.07, type = "square", vol = 0.04) {
  try {
    if (document.documentElement.getAttribute("data-sfx") !== "on") return;
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = vol;
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + dur);
  } catch (e) { /* ignore */ }
}

function installClickSfx() {
  document.addEventListener("click", (e) => {
    const el = e.target.closest("button, a, .proj, .post-card, .roster__cell, .tweaks__swatch, .cmdk__item, .nav__link, .nav__tool");
    if (!el) return;
    const cls = el.className || "";
    if (cls.includes && cls.includes("tweaks__swatch")) beep(1200, 0.06, "sine", 0.05);
    else if (cls.includes && cls.includes("proj")) beep(660, 0.08, "square", 0.035);
    else beep(880, 0.05, "triangle", 0.03);
  });
}

export function initFx() {
  initCanvas();
  installClickSfx();
}

window.initCursorFx = initFx;
