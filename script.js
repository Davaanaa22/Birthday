"use strict";

// ════════════════════════════════════════════════════════
//  CANVAS & RESIZE
// ════════════════════════════════════════════════════════
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
let W, H, SC, DPR;

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = (W * DPR) | 0;
  canvas.height = (H * DPR) | 0;
  canvas.style.width = W + "px";
  canvas.style.height = H + "px";
  SC = Math.max(0.55, Math.min(1.4, Math.min(W, H) / 520));
  genWorld();
}
window.addEventListener("resize", resize);

// ════════════════════════════════════════════════════════
//  WORLD CONSTANTS
// ════════════════════════════════════════════════════════
const GRAVITY = 0.74;
const JUMP_V = -18.8;
const RUN_SPD = 4.6;
const isMobile = () => Math.min(W, H) < 600;
const GND = () => H * (isMobile() ? 0.7 : 0.72);
const KIT_SX = () => W * 0.18;
const MIN_OBS_GAP = 680;
const PREF_OBS_GAP = 900;
const APPLE_OBS_GAP = 520;
const APPLE_APPLE_GAP = 420;
const OBS_TEMPLATE = [
  ["rock", 900],
  ["puddle", 1900],
  ["rock", 2900],
  ["puddle", 3900],
  ["rock", 4900],
  ["puddle", 5900],
  ["rock", 6900],
  ["puddle", 7900],
];

let appleTotal = 5;
let apples = [];
let cakeWX = Infinity;
let allApplesGot = false;

// ════════════════════════════════════════════════════════
//  STATIC WORLD DATA
// ════════════════════════════════════════════════════════
let stars = [],
  nearTrees = [],
  flowers = [],
  clouds = [];

function genWorld() {
  const rng = (a, b) => a + Math.random() * (b - a);
  const ri = (n) => Math.floor(Math.random() * n);
  const FCOLS = [
    "#ffb7c5",
    "#ff8fab",
    "#ffd6a5",
    "#c7ceea",
    "#ffc8dd",
    "#b5ead7",
  ];
  const mobile = W && H && Math.min(W, H) < 600;
  stars = Array.from({ length: mobile ? 55 : 90 }, () => ({
    fx: Math.random(),
    fy: Math.random() * 0.42,
    r: 0.5 + Math.random() * 1.8,
    tk: Math.floor(Math.random() * 80),
  }));
  nearTrees = Array.from({ length: 52 }, (_, i) => ({
    wx: 80 + i * (60000 / 51) + rng(-90, 90),
    hF: rng(0.18, 0.33),
    ph: rng(0, Math.PI * 2),
    tW: rng(5, 10),
    cR: rng(24, 44),
  }));
  flowers = Array.from({ length: 80 }, () => ({
    wx: rng(0, 60000),
    col: FCOLS[ri(FCOLS.length)],
    sz: rng(3, 8),
    ph: rng(0, Math.PI * 2),
  }));
  clouds = Array.from({ length: 13 }, (_, i) => ({
    wx: i * (60000 / 12) + rng(-180, 180),
    yF: rng(0.05, 0.24),
    sc: rng(0.7, 1.35),
  }));
}
resize();

// ════════════════════════════════════════════════════════
//  GAME STATE
// ════════════════════════════════════════════════════════
let state = "start";
let worldX = 0,
  frame = 0,
  runCycle = 0;
let ky = 0,
  kvy = 0,
  grounded = true,
  squashT = 0,
  invTimer = 0,
  blinkTimer = 140,
  blinkState = 0;
let hearts = 3,
  collected = 0;
let obstacles = [];
let burstParticles = [],
  fireworksList = [],
  confettiList = [],
  pawPrints = [];
let hitFlash = 0,
  whiteFlash = 0,
  celebCounter = 0,
  score = 0;
let cakeReached = false;
let videoPlaying = false;

// Helper functions
function obsClash(wx, exceptIdx) {
  for (let i = 0; i < obstacles.length; i++) {
    if (i === exceptIdx) continue;
    if (Math.abs(obstacles[i].wx - wx) < MIN_OBS_GAP) return true;
  }
  return false;
}
function buildInitialObstacles() {
  const list = [];
  for (let i = 0; i < OBS_TEMPLATE.length; i++) {
    const [t, base] = OBS_TEMPLATE[i];
    let wx = base + (Math.random() - 0.5) * 360;
    if (list.length > 0 && wx - list[list.length - 1].wx < MIN_OBS_GAP) {
      wx = list[list.length - 1].wx + MIN_OBS_GAP + Math.random() * 200;
    }
    list.push({ t, wx, hit: false });
  }
  return list;
}
function getSafeAppleX(minX, maxX, selfApple) {
  for (let tries = 0; tries < 60; tries++) {
    const nx = minX + Math.random() * (maxX - minX);
    const obsOk = !obstacles.some((o) => Math.abs(o.wx - nx) < APPLE_OBS_GAP);
    const appleOk = !apples.some(
      (a) => a !== selfApple && Math.abs(a.wx - nx) < APPLE_APPLE_GAP,
    );
    if (obsOk && appleOk) return Math.round(nx);
  }
  return Math.round(minX + Math.random() * (maxX - minX));
}

function initGame() {
  state = "running";
  worldX = 0;
  frame = 0;
  runCycle = 0;
  ky = GND();
  kvy = 0;
  grounded = true;
  squashT = 0;
  invTimer = 0;
  blinkTimer = 140;
  blinkState = 0;
  hitFlash = 0;
  whiteFlash = 0;
  cakeReached = false;
  allApplesGot = false;
  cakeWX = Infinity;
  hearts = 3;
  collected = 0;
  obstacles = buildInitialObstacles();
  appleTotal = 4 + Math.floor(Math.random() * 4);
  const airSlots = new Set();
  while (airSlots.size < Math.max(1, Math.floor(appleTotal * 0.4))) {
    airSlots.add(Math.floor(Math.random() * appleTotal));
  }
  const minAX = 700,
    maxAX = 8200;
  const slot = (maxAX - minAX) / appleTotal;
  apples = [];
  for (let i = 0; i < appleTotal; i++) {
    const wx = getSafeAppleX(minAX + slot * i, minAX + slot * (i + 1), null);
    apples.push({ wx, done: false, bob: i * 1.3, air: airSlots.has(i) });
  }
  burstParticles = [];
  fireworksList = [];
  confettiList = [];
  celebCounter = 0;
  pawPrints = [];
  score = 0;
  videoPlaying = false;
  const video = document.getElementById("birthdayVideo");
  video.style.opacity = "0";
  video.pause();
  canvas.style.opacity = "1";
}

// ════════════════════════════════════════════════════════
//  INPUT
// ════════════════════════════════════════════════════════
function doJump() {
  if (videoPlaying) return;

  SFX.init();
  SFX.resume();
  // SFX.startBGM();  // still commented out

  if (state !== "running") {
    initGame();
    // Unlock audio on mobile by playing a silent sound
    SFX.resume()
      .then(() => {
        SFX.unlock();
      })
      .catch(() => {});
    return;
  }

  if (grounded) {
    kvy = JUMP_V;
    grounded = false;
    squashT = 0;
    SFX.mew();
  }
}
document.addEventListener("keydown", (e) => {
  if (["Space", "ArrowUp", "KeyW"].includes(e.code)) {
    e.preventDefault();
    doJump();
  }
});
canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  doJump();
});

// ════════════════════════════════════════════════════════
//  UPDATE
// ════════════════════════════════════════════════════════
function update() {
  frame++;
  if (state === "running" && !videoPlaying) {
    worldX += RUN_SPD;
    if (grounded) runCycle += 0.19;
    if (grounded && frame % 14 === 0) SFX.footstep();
    if (grounded && frame % 18 === 0) {
      pawPrints.push({
        x: KIT_SX() - 10 * SC,
        y: GND() + 3 * SC,
        life: 70,
        maxLife: 70,
        flip: frame % 36 === 0,
      });
    }
    score = Math.floor(worldX * 0.04) + collected * 100;

    kvy += GRAVITY;
    ky += kvy;
    if (ky >= GND()) {
      if (!grounded) {
        squashT = 10;
        SFX.land();
      }
      ky = GND();
      kvy = 0;
      grounded = true;
    } else {
      grounded = false;
    }
    if (squashT > 0) squashT--;
    if (blinkTimer-- <= 0) {
      blinkState = 4;
      blinkTimer = 155 + Math.random() * 200;
    }
    if (blinkState > 0) blinkState--;
    if (invTimer > 0) invTimer--;

    const kwx = worldX + KIT_SX();

    // Recycle obstacles
    for (let i = 0; i < obstacles.length; i++) {
      const o = obstacles[i];
      if (o.wx < worldX - 300) {
        let candidate = worldX + W * 2.2 + Math.random() * (W * 3.3);
        let tries = 0;
        let clash;
        do {
          clash = false;
          for (let j = 0; j < obstacles.length; j++) {
            if (
              j !== i &&
              Math.abs(obstacles[j].wx - candidate) < PREF_OBS_GAP
            ) {
              clash = true;
              candidate += 200;
              break;
            }
          }
          tries++;
          if (tries > 50) break;
        } while (clash);
        o.wx = candidate;
        o.hit = false;
        o.t = Math.random() < 0.55 ? "rock" : "puddle";
      }
    }

    // Recycle apples
    apples.forEach((a) => {
      if (!a.done && a.wx < worldX - 200) {
        const left = worldX + KIT_SX() + 650;
        const right = worldX + KIT_SX() + 1600;
        a.wx = getSafeAppleX(left, right, a);
        a.bob = Math.random() * Math.PI * 2;
        a.air = Math.random() < 0.4;
      }
    });

    // Collect apples
    apples.forEach((a) => {
      if (a.done) return;
      if (Math.abs(a.wx - kwx) >= 46 * SC) return;
      const appleY = a.air ? GND() - 145 : GND() - 30;
      const yOk = a.air
        ? ky < GND() - 55 && Math.abs(ky - 38 - appleY) < 72
        : ky > GND() - 68;
      if (yOk) {
        a.done = true;
        collected++;
        SFX.collectApple();
        burst(KIT_SX() + 10 * SC, ky - 58 * SC, 20, [
          "#ff5252",
          "#ffd740",
          "#69f0ae",
          "#40c4ff",
          "#ff80ab",
        ]);
        if (collected >= appleTotal && !allApplesGot) {
          allApplesGot = true;
          cakeWX = kwx + W * 0.82 + 200;
          whiteFlash = 18;
          // No cake fanfare sound
          burst(KIT_SX(), ky - 80 * SC, 35, [
            "#ffd740",
            "#ff80ab",
            "#fff",
            "#ff5252",
            "#69f0ae",
          ]);
        } else {
          SFX.purr();
        }
      }
    });

    // Obstacle hits
    if (invTimer === 0) {
      obstacles.forEach((o) => {
        if (o.hit) return;
        const hb = o.t === "puddle" ? 44 : 30;
        if (Math.abs(o.wx - kwx) < hb * SC && ky > GND() - 32 * SC) {
          o.hit = true;
          hearts--;
          hitFlash = 20;
          invTimer = 105;
          if (o.t === "puddle") SFX.splash();
          else SFX.rockThud();
          setTimeout(() => SFX.hurt(), 60);
          if (kvy >= 0) {
            kvy = JUMP_V * 0.42;
            grounded = false;
          }
          if (hearts <= 0) {
            SFX.stopBGM();
            state = "gameover";
          }
        }
      });
    }

    // Reach cake (no celebration sounds)
    if (allApplesGot && !cakeReached && Math.abs(cakeWX - kwx) < 78 * SC) {
      cakeReached = true;
      state = "celebrate";
      whiteFlash = 32;
      // No victory jingle, no celebration music
      for (let i = 0; i < 10; i++) setTimeout(() => launchFW(true), i * 160);
      for (let i = 0; i < 140; i++) setTimeout(() => mkConfetti(), i * 28);
      setTimeout(() => startVideoOnly(), 2000);
    }
  }

  if (state === "celebrate" && !videoPlaying) {
    celebCounter++;
    runCycle += 0.17;
    if (celebCounter % 26 === 0) launchFW(false);
    if (celebCounter < 500 && Math.random() < 0.32) mkConfetti();
    fireworksList.forEach((fw) =>
      fw.pts.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.09;
        p.vx *= 0.97;
        p.life -= 1.2;
      }),
    );
    fireworksList = fireworksList.filter((fw) => {
      fw.pts = fw.pts.filter((p) => p.life > 0);
      return fw.pts.length;
    });
    confettiList.forEach((c) => {
      c.x += c.vx + Math.sin(c.x * 0.02 + celebCounter * 0.04) * 0.3;
      c.y += c.vy;
      c.vy += 0.06;
      c.rot += c.spin;
      c.life -= 0.42;
    });
    confettiList = confettiList.filter((c) => c.life > 0);
  }

  burstParticles.forEach((p) => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.22;
    p.life--;
  });
  burstParticles = burstParticles.filter((p) => p.life > 0);
  pawPrints.forEach((p) => p.life--);
  pawPrints = pawPrints.filter((p) => p.life > 0);
  if (hitFlash > 0) hitFlash--;
  if (whiteFlash > 0) whiteFlash--;
}

function burst(x, y, n, cols) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2,
      sp = 2 + Math.random() * 4;
    burstParticles.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 2.2,
      col: cols[i % cols.length],
      life: 45 + Math.random() * 20,
      r: 2.5 + Math.random() * 3,
    });
  }
}

function launchFW(big) {
  const x = W * 0.06 + Math.random() * W * 0.88;
  const y = H * 0.04 + Math.random() * H * 0.52;
  const h = Math.random() * 360;
  const cnt = big ? 90 : 58;
  const pts = [];
  for (let i = 0; i < cnt; i++) {
    const a = (i / cnt) * Math.PI * 2;
    const sp = big ? 2.8 + Math.random() * 5 : 1.6 + Math.random() * 3.2;
    pts.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      h: h + (Math.random() - 0.5) * 30,
      life: 75 + Math.random() * 55,
      sz: big ? 2.5 + Math.random() * 3.5 : 1.8 + Math.random() * 2.5,
    });
  }
  fireworksList.push({ pts });
}

function mkConfetti() {
  const C2 = [
    "#ff80ab",
    "#f06292",
    "#ffd740",
    "#69f0ae",
    "#40c4ff",
    "#ce93d8",
    "#ff7043",
    "#26c6da",
    "#fff176",
    "#a5d6a7",
  ];
  confettiList.push({
    x: Math.random() * W,
    y: -14,
    vx: (Math.random() - 0.5) * 4,
    vy: 1.5 + Math.random() * 2.5,
    rot: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.16,
    col: C2[Math.floor(Math.random() * C2.length)],
    w: 7 + Math.random() * 10,
    h: 3 + Math.random() * 5,
    life: 145,
  });
}

function startVideoOnly() {
  // Stop background music gently
  if (SFX && SFX.fadeBGM) {
    SFX.fadeBGM(0.6);
  } else if (SFX && SFX.stopBGM) {
    SFX.stopBGM();
  }

  const video = document.getElementById("birthdayVideo");
  const canvasElem = document.getElementById("gameCanvas");
  video.currentTime = 0;
  video.playbackRate = 1;
  canvasElem.style.transition = "opacity 1s ease";
  canvasElem.style.opacity = "0";
  video.style.opacity = "1";
  video.play().catch((e) => console.log("Video play failed:", e));
  videoPlaying = true;
}

// ════════════════════════════════════════════════════════
//  DRAWING FUNCTIONS (full – same as before)
// ════════════════════════════════════════════════════════

function rrect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
function starPath(cx, cy, pts, outer, inner) {
  ctx.beginPath();
  for (let i = 0; i < pts * 2; i++) {
    const a = (i * Math.PI) / pts - Math.PI / 2;
    const r = i % 2 === 0 ? outer : inner;
    if (i === 0) ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
    else ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  ctx.closePath();
}

function drawSky() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0.0, "#0d0230");
  g.addColorStop(0.18, "#3d1060");
  g.addColorStop(0.38, "#7a206e");
  g.addColorStop(0.58, "#c44030");
  g.addColorStop(0.76, "#e87838");
  g.addColorStop(0.9, "#f5c040");
  g.addColorStop(1.0, "#fde07a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}
function drawSun() {
  const sx = W * 0.78,
    sy = GND() - H * 0.03;
  [
    [190, "rgba(255,170,50,0.05)"],
    [140, "rgba(255,140,30,0.09)"],
    [95, "rgba(255,120,20,0.15)"],
    [62, "rgba(255,200,80,0.26)"],
    [40, "rgba(255,235,150,0.58)"],
    [24, "#fffacc"],
  ].forEach(([r, c]) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(sx, sy, r * SC, 0, Math.PI * 2);
    ctx.fill();
  });
}
function drawStars() {
  ctx.fillStyle = "#fffde7";
  stars.forEach((s) => {
    ctx.globalAlpha = (frame + s.tk) % 90 > 20 ? 0.75 : 0.25;
    ctx.beginPath();
    ctx.arc(s.fx * W, s.fy * H * 0.55, s.r * SC, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}
function drawMountains() {
  [0, 1].forEach((lyr) => {
    const px = 0.04 + lyr * 0.03,
      off = -(worldX * px) % (260 * SC);
    const bY = GND() - H * (0.13 + lyr * 0.04);
    ctx.fillStyle = lyr === 0 ? "rgba(24,8,58,0.88)" : "rgba(12,4,26,0.92)";
    ctx.beginPath();
    ctx.moveTo(-10, GND() + 10);
    let x = -220 + off;
    const sp = 260 * SC;
    while (x < W + 230) {
      const mh = (55 + Math.sin(x * 0.009 + lyr * 2.1) * 42) * SC;
      ctx.lineTo(x, bY);
      ctx.lineTo(x + sp * 0.5, bY - mh);
      ctx.lineTo(x + sp, bY);
      x += sp;
    }
    ctx.lineTo(W + 10, GND() + 10);
    ctx.closePath();
    ctx.fill();
  });
}
function drawSilTrees() {
  const px = 0.12,
    sp = 40 * SC,
    off = -(worldX * px) % sp;
  const bY = GND() - 2 * SC,
    gY = GND() + 6;
  ctx.fillStyle = "#060010";
  ctx.beginPath();
  ctx.moveTo(-10, gY);
  let x = -sp * 2 + off;
  while (x < W + sp) {
    const th = (18 + Math.abs(Math.sin(x * 0.048 + 1.8)) * 28) * SC;
    const tw = (11 + Math.abs(Math.sin(x * 0.063)) * 10) * SC;
    ctx.arc(x, bY - th, tw, Math.PI, 0, false);
    x += sp;
  }
  ctx.lineTo(W + 10, gY);
  ctx.closePath();
  ctx.fill();
}
function drawNearTrees() {
  nearTrees.forEach((t) => {
    const sx = t.wx - worldX * 0.46;
    if (sx < -80 * SC || sx > W + 80 * SC) return;
    const th = t.hF * H,
      by = GND();
    const sw = isMobile() ? 0 : Math.sin(frame * 0.015 + t.ph) * 0.028;
    ctx.save();
    ctx.translate(sx, by);
    if (sw) ctx.rotate(sw);
    ctx.fillStyle = "#3c2200";
    ctx.fillRect(-t.tW * SC * 0.5, -th * 0.38, t.tW * SC, th * 0.41);
    const cr = t.cR * SC,
      cy = -th * 0.3;
    ctx.fillStyle = "#142908";
    ctx.beginPath();
    ctx.arc(0, cy, cr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1e3e0e";
    ctx.beginPath();
    ctx.arc(-cr * 0.15, cy - cr * 0.16, cr * 0.82, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(225,110,45,0.20)";
    ctx.beginPath();
    ctx.arc(-cr * 0.1, cy - cr * 0.36, cr * 0.54, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}
function drawGround() {
  const by = GND();
  const g = ctx.createLinearGradient(0, by, 0, H);
  g.addColorStop(0, "#c27c38");
  g.addColorStop(0.12, "#9e5e24");
  g.addColorStop(1, "#693a14");
  ctx.fillStyle = g;
  ctx.fillRect(0, by, W, H - by);
  ctx.fillStyle = "rgba(235,155,75,0.38)";
  ctx.fillRect(0, by - 1, W, 7 * SC);
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  const ds = 27 * SC,
    doff = -worldX % ds;
  for (let x = doff; x < W; x += ds) {
    ctx.beginPath();
    ctx.arc(x, by + 14 * SC, 2 * SC, 0, Math.PI * 2);
    ctx.fill();
  }
}
function drawClouds() {
  clouds.forEach((cl) => {
    const sx =
      (((cl.wx - worldX * 0.23) % (60000 * 0.23)) / (60000 * 0.23)) *
        (W + 260) -
      130;
    const sy = cl.yF * H * 0.55,
      s = cl.sc;
    ctx.fillStyle = "rgba(255,195,145,0.50)";
    [
      [0, 0, 56 * SC * s],
      [50 * SC * s, -9 * SC * s, 42 * SC * s],
      [-42 * SC * s, -5 * SC * s, 36 * SC * s],
      [24 * SC * s, 17 * SC * s, 30 * SC * s],
    ].forEach(([px, py, pr]) => {
      ctx.beginPath();
      ctx.arc(sx + px, sy + py, pr, 0, Math.PI * 2);
      ctx.fill();
    });
  });
}
function drawFlowers() {
  flowers.forEach((f) => {
    const sx = f.wx - worldX * 0.89;
    if (sx < -20 || sx > W + 20) return;
    const by = GND() - 3 * SC;
    ctx.strokeStyle = "#587a3a";
    ctx.lineWidth = 1.5 * SC;
    ctx.beginPath();
    ctx.moveTo(sx, by);
    ctx.lineTo(sx, by - f.sz * 2.7 * SC);
    ctx.stroke();
    ctx.fillStyle = f.col;
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2 + frame * 0.007 + f.ph;
      ctx.beginPath();
      ctx.arc(
        sx + Math.cos(a) * f.sz * 0.86 * SC,
        by - f.sz * 2.7 * SC + Math.sin(a) * f.sz * 0.86 * SC,
        f.sz * 0.52 * SC,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.fillStyle = "#fff59d";
    ctx.beginPath();
    ctx.arc(sx, by - f.sz * 2.7 * SC, f.sz * 0.47 * SC, 0, Math.PI * 2);
    ctx.fill();
  });
}
function drawObs(o, sx) {
  const s = SC,
    by = GND();
  if (o.t === "rock") {
    ctx.fillStyle = "rgba(255,80,0,0.22)";
    ctx.beginPath();
    ctx.ellipse(sx, by, 62 * s, 24 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.ellipse(sx, by + 4 * s, 36 * s, 7 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    const rg = ctx.createRadialGradient(
      sx - 8 * s,
      by - 28 * s,
      2,
      sx,
      by - 20 * s,
      38 * s,
    );
    rg.addColorStop(0, "#bdbdbd");
    rg.addColorStop(0.45, "#757575");
    rg.addColorStop(1, "#2d2d2d");
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.moveTo(sx - 38 * s, by);
    ctx.quadraticCurveTo(sx - 44 * s, by - 22 * s, sx - 18 * s, by - 48 * s);
    ctx.quadraticCurveTo(sx, by - 58 * s, sx + 20 * s, by - 44 * s);
    ctx.quadraticCurveTo(sx + 44 * s, by - 16 * s, sx + 38 * s, by);
    ctx.closePath();
    ctx.fill();
    const rg2 = ctx.createRadialGradient(
      sx + 30 * s,
      by - 14 * s,
      1,
      sx + 30 * s,
      by - 10 * s,
      18 * s,
    );
    rg2.addColorStop(0, "#9e9e9e");
    rg2.addColorStop(1, "#424242");
    ctx.fillStyle = rg2;
    ctx.beginPath();
    ctx.moveTo(sx + 16 * s, by);
    ctx.quadraticCurveTo(sx + 14 * s, by - 16 * s, sx + 26 * s, by - 26 * s);
    ctx.quadraticCurveTo(sx + 40 * s, by - 20 * s, sx + 46 * s, by);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.beginPath();
    ctx.ellipse(sx - 12 * s, by - 36 * s, 13 * s, 7 * s, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,120,20,0.38)";
    ctx.lineWidth = 1.5 * s;
    ctx.beginPath();
    ctx.moveTo(sx - 6 * s, by - 44 * s);
    ctx.lineTo(sx + 4 * s, by - 28 * s);
    ctx.lineTo(sx - 2 * s, by - 14 * s);
    ctx.stroke();
    ctx.fillStyle = "#ff1744";
    ctx.font = `900 ${22 * s}px 'Noto Sans TC',sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("！", sx, by - 68 * s);
  } else {
    ctx.fillStyle = "rgba(0,100,255,0.18)";
    ctx.beginPath();
    ctx.ellipse(sx, by, 85 * s, 28 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    const pg = ctx.createRadialGradient(
      sx,
      by - 4 * s,
      4,
      sx,
      by - 4 * s,
      68 * s,
    );
    pg.addColorStop(0, "rgba(130,230,255,0.98)");
    pg.addColorStop(0.4, "rgba(30,150,255,0.95)");
    pg.addColorStop(0.8, "rgba(0,80,220,0.88)");
    pg.addColorStop(1, "rgba(0,40,160,0.70)");
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.ellipse(sx, by - 5 * s, 68 * s, 13 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let r = 0; r < 3; r++) {
      const rph = (frame * 0.06 + r * 2.1) % (Math.PI * 2);
      const rscale = 0.4 + 0.6 * (rph / (Math.PI * 2));
      ctx.globalAlpha = 0.55 * (1 - rscale);
      ctx.strokeStyle = "rgba(200,240,255,0.9)";
      ctx.lineWidth = 1.5 * s;
      ctx.beginPath();
      ctx.ellipse(
        sx,
        by - 5 * s,
        68 * s * rscale,
        13 * s * rscale,
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    const sr = ctx.createRadialGradient(
      sx + 16 * s,
      by - 6 * s,
      0,
      sx + 16 * s,
      by - 6 * s,
      22 * s,
    );
    sr.addColorStop(0, "rgba(255,240,160,0.62)");
    sr.addColorStop(1, "rgba(255,240,160,0)");
    ctx.fillStyle = sr;
    ctx.beginPath();
    ctx.ellipse(sx + 16 * s, by - 6 * s, 22 * s, 6 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 1.2 * s;
    ctx.beginPath();
    ctx.moveTo(sx - 28 * s, by - 6 * s);
    ctx.lineTo(sx - 10 * s, by - 7 * s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(sx + 8 * s, by - 5 * s);
    ctx.lineTo(sx + 24 * s, by - 6 * s);
    ctx.stroke();
    ctx.fillStyle = "#0288d1";
    ctx.font = `700 ${18 * s}px 'Noto Sans TC',sans-serif`;
    ctx.fillText("〜", sx, by - 22 * s);
  }
}
function drawApple(sx, rawY, bob, isAir) {
  const ay = rawY - Math.sin(frame * 0.06 + bob) * 7;
  if (isAir) {
    ctx.save();
    ctx.setLineDash([5 * SC, 6 * SC]);
    ctx.strokeStyle = "rgba(100,210,255,0.35)";
    ctx.lineWidth = 1.5 * SC;
    ctx.beginPath();
    ctx.moveTo(sx, ay + 22 * SC);
    ctx.lineTo(sx, GND());
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    for (let w = 0; w < 2; w++) {
      const wa = w === 0 ? -1 : 1;
      const wOff = Math.sin(frame * 0.12 + w * Math.PI) * 5;
      ctx.fillStyle = "rgba(160,230,255,0.65)";
      ctx.beginPath();
      ctx.ellipse(
        sx + wa * 18 * SC,
        ay + wOff,
        12 * SC,
        5 * SC,
        wa * 0.5,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }
  ctx.fillStyle = "rgba(0,0,0,0.11)";
  if (!isAir) {
    ctx.beginPath();
    ctx.ellipse(sx, GND() + 3, 16 * SC, 4 * SC, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const gr = ctx.createRadialGradient(
    sx - 6 * SC,
    ay - 8 * SC,
    1,
    sx,
    ay,
    19 * SC,
  );
  gr.addColorStop(0, "#ff7961");
  gr.addColorStop(0.45, "#e53935");
  gr.addColorStop(1, "#b71c1c");
  ctx.fillStyle = gr;
  ctx.beginPath();
  ctx.arc(sx, ay, 19 * SC, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(76,175,80,0.38)";
  ctx.beginPath();
  ctx.arc(sx + 8 * SC, ay, 13 * SC, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.beginPath();
  ctx.ellipse(sx - 6 * SC, ay - 7 * SC, 5 * SC, 3 * SC, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#5d4037";
  ctx.lineWidth = 3 * SC;
  ctx.beginPath();
  ctx.moveTo(sx, ay - 18 * SC);
  ctx.quadraticCurveTo(sx + 9 * SC, ay - 30 * SC, sx + 6 * SC, ay - 34 * SC);
  ctx.stroke();
  ctx.fillStyle = "#4caf50";
  ctx.beginPath();
  ctx.ellipse(sx + 9 * SC, ay - 27 * SC, 8 * SC, 4 * SC, -0.7, 0, Math.PI * 2);
  ctx.fill();
}
function drawPawPrints() {
  pawPrints.forEach((p) => {
    const alpha = (p.life / p.maxLife) * 0.45;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#c27c38";
    const s = SC,
      x = p.x,
      y = p.y,
      fl = p.flip ? -1 : 1;
    ctx.beginPath();
    ctx.ellipse(x, y, 5 * s, 4 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    [
      [fl * -5 * s, -5 * s],
      [fl * -2 * s, -7 * s],
      [fl * 2 * s, -7 * s],
      [fl * 5 * s, -5 * s],
    ].forEach(([tx, ty]) => {
      ctx.beginPath();
      ctx.arc(x + tx, y + ty, 2.5 * s, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  });
}
function drawSpeedLines(kitX, kitY) {
  if (!grounded) return;
  ctx.save();
  for (let i = 0; i < 5; i++) {
    const ly = kitY - (25 + i * 18) * SC;
    const len = (40 + i * 12) * SC;
    const alpha = (0.28 - i * 0.04) * (0.6 + 0.4 * Math.sin(frame * 0.3 + i));
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = (1.8 - i * 0.25) * SC;
    ctx.beginPath();
    ctx.moveTo(kitX - 52 * SC, ly);
    ctx.lineTo(kitX - 52 * SC - len, ly);
    ctx.stroke();
  }
  ctx.restore();
}
function leg(ox, oy, ang, len, w, col) {
  ctx.save();
  ctx.translate(ox, oy);
  ctx.rotate((ang * Math.PI) / 180);
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.ellipse(0, len * 0.5, w * 0.55, len * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fce4ec";
  ctx.beginPath();
  ctx.ellipse(0, len, w * 0.65, len * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
function drawKitten(sx, sy) {
  const s = SC;
  let sY = 1;
  if (squashT > 0) sY = 0.72 + (1 - squashT / 10) * 0.28;
  else if (!grounded) sY = 1 + Math.abs(kvy) * 0.017;
  const sX = sY > 1 ? 1 : 1 / Math.max(sY, 0.85);
  if (invTimer > 0 && Math.floor(invTimer / 5) % 2 === 1)
    ctx.globalAlpha = 0.28;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(sX, sY);
  const rc = runCycle,
    bob = grounded ? Math.sin(rc) * 2.6 * s : 0;
  const tw = Math.sin(rc * 0.95) * 0.52;
  ctx.strokeStyle = "#e0e0e0";
  ctx.lineWidth = 12 * s;
  ctx.beginPath();
  ctx.moveTo(-18 * s, -10 * s);
  ctx.quadraticCurveTo(-64 * s + tw * 22, 12 * s, -58 * s, 40 * s + tw * 20);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 7 * s;
  ctx.stroke();
  leg(-15 * s, -6 * s, Math.sin(rc) * 32, 12 * s, 10 * s, "#e8e8e8");
  leg(15 * s, -6 * s, Math.sin(rc + Math.PI) * 32, 12 * s, 10 * s, "#e0e0e0");
  const bg = ctx.createRadialGradient(
    -4 * s,
    -16 * s,
    3 * s,
    0,
    -8 * s,
    35 * s,
  );
  bg.addColorStop(0, "#ffffff");
  bg.addColorStop(0.7, "#f6f6f6");
  bg.addColorStop(1, "#e8e8e8");
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.ellipse(0, -10 * s + bob, 32 * s, 27 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.beginPath();
  ctx.arc(10 * s, -6 * s + bob, 20 * s, 0, Math.PI * 2);
  ctx.fill();
  leg(
    13 * s,
    -4 * s + bob,
    Math.sin(rc + Math.PI) * 28,
    13 * s,
    11 * s,
    "#f5f5f5",
  );
  leg(4 * s, -2 * s + bob, Math.sin(rc) * 28, 12 * s, 10 * s, "#efefef");
  const hY = -52 * s + bob;
  ctx.fillStyle = "#f0f0f0";
  ctx.beginPath();
  ctx.arc(6 * s, hY + 22 * s, 17 * s, 0, Math.PI * 2);
  ctx.fill();
  const hg = ctx.createRadialGradient(0, hY - 4 * s, 4 * s, 0, hY, 29 * s);
  hg.addColorStop(0, "#ffffff");
  hg.addColorStop(0.75, "#f8f8f8");
  hg.addColorStop(1, "#ebebeb");
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.arc(0, hY, 29 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  [
    [-19, -9],
    [-23, 4],
    [-18, 17],
    [-7, 22],
    [8, 22],
    [20, 14],
    [24, 1],
    [20, -11],
    [12, -22],
    [0, -26],
    [-12, -22],
  ].forEach(([px, py]) => {
    ctx.beginPath();
    ctx.arc(px * s, hY + py * s, 9 * s, 0, Math.PI * 2);
    ctx.fill();
  });
  [
    { ox: -20, oy: -20, flip: -1 },
    { ox: 20, oy: -20, flip: 1 },
  ].forEach(({ ox, oy, flip }) => {
    ctx.save();
    ctx.translate(ox * s, hY + oy * s);
    ctx.rotate(flip * (grounded ? 0 : 0.28));
    ctx.fillStyle = "#eeeeee";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(flip * -10 * s, -27 * s);
    ctx.lineTo(flip * 10 * s, -8 * s);
    ctx.fill();
    ctx.fillStyle = "#f8bbd0";
    ctx.beginPath();
    ctx.moveTo(0, -2 * s);
    ctx.lineTo(flip * -7 * s, -20 * s);
    ctx.lineTo(flip * 7 * s, -8 * s);
    ctx.fill();
    ctx.restore();
  });
  [
    [-11, 4],
    [11, 4],
  ].forEach(([ex, ey]) => {
    const ex2 = ex * s,
      ey2 = hY - ey * s;
    if (blinkState > 0) {
      ctx.strokeStyle = "#5d4037";
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.arc(ex2, ey2, 7 * s, 0.08 * Math.PI, 0.92 * Math.PI);
      ctx.stroke();
    } else {
      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.ellipse(ex2, ey2, 9 * s, 11 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      const ig = ctx.createRadialGradient(
        ex2 - s,
        ey2 - 2 * s,
        1,
        ex2,
        ey2,
        8 * s,
      );
      ig.addColorStop(0, "#a1887f");
      ig.addColorStop(0.45, "#795548");
      ig.addColorStop(1, "#4e342e");
      ctx.fillStyle = ig;
      ctx.beginPath();
      ctx.ellipse(ex2, ey2, 7 * s, 9 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1a1a1a";
      ctx.beginPath();
      ctx.ellipse(ex2, ey2 + 0.5 * s, 4 * s, 5.5 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.96)";
      ctx.beginPath();
      ctx.arc(ex2 - 2.5 * s, ey2 - 4 * s, 3 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.beginPath();
      ctx.arc(ex2 + 3 * s, ey2 + s, 1.5 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#3e2723";
      ctx.lineWidth = 1.2 * s;
      for (let l = 0; l < 4; l++) {
        const lx = ex2 - 5 * s + l * 3.5 * s;
        ctx.beginPath();
        ctx.moveTo(lx, ey2 - 10 * s);
        ctx.lineTo(lx + (l - 1.5) * 0.4 * s, ey2 - 14 * s);
        ctx.stroke();
      }
    }
  });
  ctx.fillStyle = "rgba(255,135,160,0.30)";
  ctx.beginPath();
  ctx.ellipse(-18 * s, hY + 10 * s, 12 * s, 7 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(18 * s, hY + 10 * s, 12 * s, 7 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f48fb1";
  ctx.beginPath();
  ctx.ellipse(0, hY + 13 * s, 5 * s, 3.5 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#e57373";
  ctx.lineWidth = 1.6 * s;
  ctx.beginPath();
  ctx.moveTo(0, hY + 17 * s);
  ctx.quadraticCurveTo(-5 * s, hY + 21 * s, -8 * s, hY + 19 * s);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, hY + 17 * s);
  ctx.quadraticCurveTo(5 * s, hY + 21 * s, 8 * s, hY + 19 * s);
  ctx.stroke();
  ctx.strokeStyle = "rgba(188,188,188,0.72)";
  ctx.lineWidth = 0.9 * s;
  [1.0, 0.4, 1.6].forEach((yo) => {
    const cy2 = hY + 9 * s + yo * 4 * s;
    ctx.beginPath();
    ctx.moveTo(-5 * s, cy2);
    ctx.lineTo(-31 * s, hY + 7 * s + yo * 4.5 * s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(5 * s, cy2);
    ctx.lineTo(31 * s, hY + 7 * s + yo * 4.5 * s);
    ctx.stroke();
  });
  const bx = 17 * s,
    bby = hY - 30 * s;
  ctx.fillStyle = "#f48fb1";
  ctx.beginPath();
  ctx.ellipse(bx - 11 * s, bby, 12 * s, 8 * s, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(bx + 11 * s, bby, 12 * s, 8 * s, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#ec407a";
  ctx.lineWidth = 0.8 * s;
  ctx.beginPath();
  ctx.ellipse(bx - 11 * s, bby, 12 * s, 8 * s, -0.4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(bx + 11 * s, bby, 12 * s, 8 * s, 0.4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#f06292";
  ctx.beginPath();
  ctx.arc(bx, bby, 5.5 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.36)";
  ctx.beginPath();
  ctx.ellipse(bx - 13 * s, bby - 3 * s, 4 * s, 2.5 * s, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(bx + 13 * s, bby - 3 * s, 4 * s, 2.5 * s, 0.4, 0, Math.PI * 2);
  ctx.fill();
  if (collected > 0) {
    ctx.font = `${10 * s}px serif`;
    ctx.textAlign = "center";
    for (let i = 0; i < collected; i++) {
      const ix = -22 * s + i * 13 * s;
      const iy = hY - 56 * s + Math.sin(frame * 0.07 + i) * 4;
      ctx.fillText("🍎", ix, iy);
    }
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}
function drawCake(sx, cel) {
  const s = SC * 1.1,
    by = GND();
  if (sx < -160 * s || sx > W + 160 * s) return;
  const bnc = cel ? Math.sin(celebCounter * 0.13) * 10 * SC : 0;
  const by2 = by + bnc;
  ctx.fillStyle = "rgba(0,0,0,0.16)";
  ctx.beginPath();
  ctx.ellipse(
    sx,
    by + 8 * s,
    64 * s * (1 + Math.abs(bnc) * 0.003),
    12 * s,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.fillStyle = "#f48fb1";
  rrect(sx - 53 * s, by2 - 68 * s, 106 * s, 68 * s, 10 * s);
  ctx.fill();
  ctx.fillStyle = "#fce4ec";
  rrect(sx - 53 * s, by2 - 82 * s, 106 * s, 19 * s, 9 * s);
  ctx.fill();
  ctx.fillStyle = "#fff9c4";
  [-33, -18, -3, 13, 28].forEach((ox) => {
    ctx.beginPath();
    ctx.ellipse(sx + ox * s, by2 - 74 * s, 4.5 * s, 12 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.arc(sx - 44 * s + i * 14.5 * s, by2 - 39 * s, 3.5 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  const tbnc = cel ? Math.sin(celebCounter * 0.13 + 0.45) * 6 * SC : 0;
  const t2y = by2 - tbnc;
  ctx.fillStyle = "#f06292";
  rrect(sx - 36 * s, t2y - 135 * s, 72 * s, 53 * s, 9 * s);
  ctx.fill();
  ctx.fillStyle = "#fce4ec";
  rrect(sx - 36 * s, t2y - 148 * s, 72 * s, 16 * s, 7 * s);
  ctx.fill();
  ctx.fillStyle = "#ffd740";
  starPath(sx - 20 * s, t2y - 115 * s, 5, 9 * s, 4 * s);
  ctx.fill();
  starPath(sx + 20 * s, t2y - 115 * s, 5, 9 * s, 4 * s);
  ctx.fill();
  const CC = ["#f44336", "#ffb300", "#4caf50", "#2196f3", "#9c27b0"];
  for (let i = 0; i < 5; i++) {
    const cx = sx - 24 * s + i * 12 * s,
      cy = t2y - 148 * s;
    const fl = Math.sin(frame * 0.22 + i * 1.4);
    const fb = cel ? 1.9 + Math.abs(fl) * 0.7 : 1.0;
    ctx.fillStyle = CC[i];
    rrect(cx - 3.5 * s, cy - 25 * s, 7 * s, 27 * s, 3 * s);
    ctx.fill();
    if (cel) {
      ctx.fillStyle = "rgba(255,200,80,0.15)";
      ctx.beginPath();
      ctx.arc(cx, cy - 28 * s, 22 * s * fb, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(255,224,130,0.95)";
    ctx.beginPath();
    ctx.ellipse(
      cx,
      cy - 31 * s + fl * 2,
      5 * s * fb,
      10 * s * fb,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.fillStyle = "#ff8f00";
    ctx.beginPath();
    ctx.ellipse(
      cx,
      cy - 29 * s + fl * 2,
      3 * s * fb,
      7 * s * fb,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.fillStyle = "#c2185b";
  ctx.font = `700 ${13 * s}px 'Noto Sans TC',sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("生日快樂！", sx, by2 - 162 * s);
  if (cel) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + celebCounter * 0.058;
      const rx = sx + Math.cos(a) * 76 * SC;
      const ry = by - 84 * SC + Math.sin(a) * 42 * SC;
      ctx.fillStyle = [
        "#ffd740",
        "#ff80ab",
        "#40c4ff",
        "#69f0ae",
        "#ff7043",
        "#ce93d8",
      ][i];
      starPath(rx, ry, 5, 10 * SC, 4.5 * SC);
      ctx.fill();
    }
  }
}
function drawHUD() {
  const s = SC;
  const pillH = Math.max(38, 44 * s),
    pillY = 10;
  const hSz = Math.max(22, 28 * s);
  ctx.font = `${hSz}px serif`;
  ctx.textAlign = "left";
  for (let i = 0; i < 3; i++) {
    ctx.globalAlpha = i < hearts ? 1 : 0.2;
    ctx.fillText("❤️", 12 + i * hSz * 1.3, pillY + pillH * 0.72);
  }
  ctx.globalAlpha = 1;
  const pillW1 = Math.max(120, 130 * s);
  ctx.fillStyle = "rgba(0,0,0,0.42)";
  rrect(W - pillW1 - 10, pillY, pillW1, pillH, pillH / 2);
  ctx.fill();
  ctx.fillStyle = "white";
  ctx.font = `bold ${Math.max(14, 18 * s)}px 'Noto Sans TC',sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(
    `🍎 ${collected} / ${appleTotal}`,
    W - pillW1 / 2 - 10,
    pillY + pillH * 0.68,
  );
  const pillW2 = Math.max(110, 130 * s);
  ctx.fillStyle = "rgba(0,0,0,0.42)";
  rrect(W / 2 - pillW2 / 2, pillY, pillW2, pillH, pillH / 2);
  ctx.fill();
  ctx.fillStyle = "#ffd740";
  ctx.font = `bold ${Math.max(14, 18 * s)}px 'Noto Sans TC',sans-serif`;
  ctx.fillText(`⭐ ${score}`, W / 2, pillY + pillH * 0.68);
  if (frame < 210) {
    ctx.fillStyle = `rgba(255,255,255,${Math.max(0, 1 - frame / 210)})`;
    ctx.font = `${Math.max(13, 14 * s)}px 'Noto Sans TC',sans-serif`;
    ctx.fillText("點擊 跳躍！", W / 2, pillY + pillH + 18);
  }
}
function drawStart() {
  ctx.fillStyle = "rgba(8,0,22,0.72)";
  ctx.fillRect(0, 0, W, H);
  const cx = W / 2;
  ctx.textAlign = "center";
  const f1 = Math.max(24, Math.min(46, W * 0.055));
  ctx.fillStyle = "#fff0f5";
  ctx.font = `900 ${f1}px 'Noto Sans TC',sans-serif`;
  ctx.fillText("🐱  小貓的生日跑！  🎂", cx, H * 0.26);
  ctx.fillStyle = "rgba(255,215,230,0.92)";
  ctx.font = `${Math.max(15, Math.min(20, W * 0.038))}px 'Noto Sans TC',sans-serif`;
  ctx.fillText("收集所有蘋果 🍎 然後到達生日蛋糕！", cx, H * 0.4);
  ctx.fillText("跳過 🪨 石頭  和  💧 水坑", cx, H * 0.5);
  const p = 1 + Math.sin(frame * 0.09) * 0.04;
  const btnW = Math.max(220, Math.min(280, W * 0.55)),
    btnH = Math.max(48, 56 * SC);
  ctx.save();
  ctx.translate(cx, H * 0.75);
  ctx.scale(p, p);
  ctx.fillStyle = "#e91e63";
  rrect(-btnW / 2, -btnH / 2, btnW, btnH, btnH / 2);
  ctx.fill();
  ctx.fillStyle = "white";
  ctx.font = `700 ${Math.max(16, 20 * SC)}px 'Noto Sans TC',sans-serif`;
  ctx.fillText("🐾  點擊開始！", 0, btnH * 0.22);
  ctx.restore();
}
function drawGameOver() {
  ctx.fillStyle = "rgba(6,0,18,0.80)";
  ctx.fillRect(0, 0, W, H);
  const cx = W / 2;
  ctx.textAlign = "center";
  ctx.fillStyle = "#ff8a80";
  ctx.font = `900 ${Math.max(26, Math.min(48, W * 0.06))}px 'Noto Sans TC',sans-serif`;
  ctx.fillText("😿  遊戲結束！", cx, H * 0.36);
  ctx.fillStyle = "rgba(255,210,225,0.92)";
  ctx.font = `${Math.max(14, Math.min(18, W * 0.034))}px 'Noto Sans TC',sans-serif`;
  ctx.fillText(
    `分數：${score}  •  收集了 ${collected}/${appleTotal} 個蘋果`,
    cx,
    H * 0.48,
  );
  const p = 1 + Math.sin(frame * 0.1) * 0.04;
  const btnW = Math.max(180, 220 * SC),
    btnH = Math.max(44, 52 * SC);
  ctx.save();
  ctx.translate(cx, H * 0.74);
  ctx.scale(p, p);
  ctx.fillStyle = "#ff1744";
  rrect(-btnW / 2, -btnH / 2, btnW, btnH, btnH / 2);
  ctx.fill();
  ctx.fillStyle = "white";
  ctx.font = `700 ${Math.max(15, 20 * SC)}px 'Noto Sans TC',sans-serif`;
  ctx.fillText("🔄  再試一次！", 0, btnH * 0.22);
  ctx.restore();
}
function drawCelebrate() {
  fireworksList.forEach((fw) =>
    fw.pts.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life / 125);
      ctx.fillStyle = `hsl(${p.h},88%,65%)`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.sz, 0, Math.PI * 2);
      ctx.fill();
    }),
  );
  ctx.globalAlpha = 1;
  confettiList.forEach((c) => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, c.life / 145);
    ctx.fillStyle = c.col;
    ctx.translate(c.x, c.y);
    ctx.rotate(c.rot);
    ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
    ctx.restore();
  });
  const cx = W / 2;
  const cW = Math.min(W * 0.92, Math.max(300, 560 * SC));
  const cH = Math.min(H * 0.8, Math.max(280, 580 * SC));
  const cX = cx - cW / 2,
    cY = H * 0.1;
  ctx.fillStyle = "rgba(255,252,255,0.97)";
  rrect(cX, cY, cW, cH, Math.min(36 * SC, 28));
  ctx.fill();
  ctx.strokeStyle = "#f48fb1";
  ctx.lineWidth = 3;
  rrect(cX, cY, cW, cH, Math.min(36 * SC, 28));
  ctx.stroke();
  const cc = (f) => cY + cH * f;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + celebCounter * 0.02;
    const rx = cx + Math.cos(a) * (cW * 0.5 + 14);
    const ry = cY + cH * 0.5 + Math.sin(a) * (cH * 0.5 + 10);
    ctx.fillStyle = [
      "#ffd740",
      "#ff80ab",
      "#40c4ff",
      "#69f0ae",
      "#ff7043",
      "#ce93d8",
      "#fff176",
      "#a5d6a7",
    ][i];
    starPath(rx, ry, 5, Math.max(8, 10 * SC), Math.max(4, 5 * SC));
    ctx.fill();
  }
  ctx.textAlign = "center";
  const f1 = Math.max(22, Math.min(38, cW * 0.09));
  const RC = ["#e53935", "#fb8c00", "#fdd835", "#43a047", "#1e88e5", "#8e24aa"];
  ctx.font = `900 ${f1}px 'Noto Sans TC',sans-serif`;
  ctx.fillStyle = RC[Math.floor(celebCounter / 7) % RC.length];
  ctx.fillText("🎂  生日快樂！  🎂", cx, cc(0.14));
  ctx.fillStyle = "#c2185b";
  ctx.font = `700 ${Math.max(14, Math.min(18, cW * 0.042))}px 'Noto Sans TC',sans-serif`;
  ctx.fillText(
    `⭐ 分數：${score}  •  收集了 ${collected}/${appleTotal} 個蘋果！`,
    cx,
    cc(0.27),
  );
  ctx.fillStyle = "#ad1457";
  ctx.font = `${Math.max(12, Math.min(15, cW * 0.034))}px 'Noto Sans TC',sans-serif`;
  ctx.fillText("🌟 願你的每一天都甜蜜快樂", cx, cc(0.52));
  ctx.fillText("就像小貓奔向生日蛋糕一樣！🌟", cx, cc(0.61));
  const p = 1 + Math.sin(celebCounter * 0.1) * 0.04;
  const btnW = Math.max(180, 210 * SC),
    btnH = Math.max(42, 50 * SC);
  ctx.save();
  ctx.translate(cx, cc(0.88));
  ctx.scale(p, p);
  ctx.fillStyle = "#e91e63";
  rrect(-btnW / 2, -btnH / 2, btnW, btnH, btnH / 2);
  ctx.fill();
  ctx.fillStyle = "white";
  ctx.font = `700 ${Math.max(14, 18 * SC)}px 'Noto Sans TC',sans-serif`;
  ctx.fillText("🐾  再玩一次！", 0, btnH * 0.22);
  ctx.restore();
}

// ════════════════════════════════════════════════════════
//  MAIN LOOP
// ════════════════════════════════════════════════════════
let lastT = 0;
function loop(ts) {
  const dt = Math.min(ts - lastT, 33);
  lastT = ts;
  const steps = dt > 20 ? 2 : 1;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, W, H);
  drawSky();
  drawStars();
  drawSun();
  drawMountains();
  drawClouds();
  drawSilTrees();
  drawNearTrees();
  drawGround();
  drawFlowers();

  if (state === "start") {
    drawCake(W * 0.76, false);
    drawKitten(KIT_SX(), GND());
    drawStart();
  } else if (state === "running") {
    drawPawPrints();
    apples.forEach((a) => {
      if (!a.done) {
        const sx = a.wx - worldX;
        if (sx > -60 * SC && sx < W + 80 * SC)
          drawApple(sx, a.air ? GND() - 145 : GND() - 30, a.bob, a.air);
      }
    });
    obstacles.forEach((o) => {
      if (!o.hit) {
        const sx = o.wx - worldX;
        if (sx > -90 * SC && sx < W + 90 * SC) drawObs(o, sx);
      }
    });
    if (allApplesGot) drawCake(cakeWX - worldX, false);
    drawSpeedLines(KIT_SX(), ky);
    drawKitten(KIT_SX(), ky);
    burstParticles.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life / 65);
      ctx.fillStyle = p.col;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * SC, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    drawHUD();
    if (!allApplesGot) {
      const rem = appleTotal - collected;
      ctx.globalAlpha = 0.75 + 0.25 * Math.sin(frame * 0.12);
      ctx.fillStyle = "#fff9c4";
      ctx.font = `700 ${Math.max(13, 16 * SC)}px 'Noto Sans TC',sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(`還剩 ${rem} 個蘋果 🍎 集齊後蛋糕出現！`, W / 2, H - 28);
      ctx.globalAlpha = 1;
    } else {
      const csx = cakeWX - worldX;
      if (csx > W * 0.85) {
        ctx.globalAlpha = 0.7 + 0.3 * Math.sin(frame * 0.18);
        ctx.fillStyle = "#ffd740";
        ctx.font = `${Math.max(18, 24 * SC)}px serif`;
        ctx.textAlign = "right";
        ctx.fillText("🎂 ▶", W - 14, H - 20);
        ctx.globalAlpha = 1;
      }
    }
  } else if (state === "gameover") {
    drawPawPrints();
    apples.forEach((a) => {
      if (!a.done) {
        const sx = a.wx - worldX;
        if (sx > -60 && sx < W + 80)
          drawApple(sx, a.air ? GND() - 145 : GND() - 30, a.bob, a.air);
      }
    });
    obstacles.forEach((o) => {
      if (!o.hit) {
        const sx = o.wx - worldX;
        if (sx > -90 && sx < W + 90) drawObs(o, sx);
      }
    });
    if (allApplesGot) drawCake(cakeWX - worldX, false);
    drawKitten(KIT_SX(), ky);
    drawHUD();
    drawGameOver();
  } else if (state === "celebrate" && !videoPlaying) {
    drawCake(cakeWX - worldX, true);
    drawKitten(KIT_SX(), GND() + Math.sin(celebCounter * 0.15) * 12 * SC);
    drawCelebrate();
  }

  if (hitFlash > 0) {
    ctx.fillStyle = `rgba(255,28,28,${(hitFlash / 20) * 0.42})`;
    ctx.fillRect(0, 0, W, H);
  }
  if (whiteFlash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${(whiteFlash / 32) * 0.92})`;
    ctx.fillRect(0, 0, W, H);
  }
  for (let i = 0; i < steps; i++) update();
  requestAnimationFrame(loop);
}

initGame();
state = "start";
loop(0);
