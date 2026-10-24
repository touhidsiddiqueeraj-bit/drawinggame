/*
 * Draw & Learn — fx.js
 * Full-screen particle layer: finger sparkles, confetti cannons,
 * celebration star bursts. Own rAF loop that only runs while
 * particles exist (battery friendly).
 */
(function () {
  'use strict';

  var canvas = document.getElementById('fx-canvas');
  var ctx = canvas.getContext('2d');
  var dpr = 1;
  var particles = [];
  var running = false;
  var W = 0, H = 0;

  var CONFETTI_COLORS = ['#FF5252', '#FF9800', '#FFD32A', '#2ED573', '#3AA0FF',
                          '#9C5CFF', '#FF7CE5', '#00E5C3', '#FFFFFF'];
  var SPARKLE_COLORS = ['#FFD32A', '#FFF176', '#FFEA00', '#82B1FF', '#FF8FAB', '#A7FFEB'];

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  function rand(a, b) { return a + Math.random() * (b - a); }

  /* ---------------- particle factories ---------------- */

  function spawnSparkle(x, y) {
    if (particles.length > 260) return;
    particles.push({
      kind: 'spark',
      x: x + rand(-6, 6), y: y + rand(-6, 6),
      vx: rand(-40, 40), vy: rand(-70, 10),
      g: 160,
      life: rand(0.35, 0.6), age: 0,
      size: rand(2.5, 5.5),
      color: SPARKLE_COLORS[(Math.random() * SPARKLE_COLORS.length) | 0],
      star: Math.random() < 0.35
    });
  }

  function confettiBurst(opts) {
    opts = opts || {};
    var cx = opts.x !== undefined ? opts.x : W / 2;
    var cy = opts.y !== undefined ? opts.y : H * 0.42;
    var n = opts.count || 130;
    for (var i = 0; i < n; i++) {
      var ang = rand(0, Math.PI * 2);
      var speed = rand(150, 520) * (opts.power || 1);
      particles.push({
        kind: 'confetti',
        x: cx, y: cy,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed - rand(60, 260),
        g: 620,
        life: rand(1.6, 2.6), age: 0,
        size: rand(6, 12),
        rot: rand(0, Math.PI * 2),
        vr: rand(-9, 9),
        color: CONFETTI_COLORS[(Math.random() * CONFETTI_COLORS.length) | 0],
        flutter: rand(2, 6),
        wobble: rand(0, Math.PI * 2)
      });
    }
    // rain a few from the top corners too
    for (var k = 0; k < 26; k++) {
      var side = k % 2 === 0 ? 0 : W;
      particles.push({
        kind: 'confetti',
        x: side + rand(-30, 30), y: rand(-80, -10),
        vx: rand(30, 160) * (side === 0 ? 1 : -1),
        vy: rand(40, 140),
        g: 380,
        life: rand(2, 3.2), age: 0,
        size: rand(7, 13),
        rot: rand(0, Math.PI * 2),
        vr: rand(-8, 8),
        color: CONFETTI_COLORS[(Math.random() * CONFETTI_COLORS.length) | 0],
        flutter: rand(2, 5),
        wobble: rand(0, Math.PI * 2)
      });
    }
    ensureRunning();
  }

  function starBurst(x, y, count) {
    for (var i = 0; i < (count || 10); i++) {
      var ang = (Math.PI * 2 * i) / (count || 10) + rand(-0.15, 0.15);
      particles.push({
        kind: 'bigstar',
        x: x, y: y,
        vx: Math.cos(ang) * rand(120, 240),
        vy: Math.sin(ang) * rand(120, 240) - 60,
        g: 240,
        life: rand(0.8, 1.2), age: 0,
        size: rand(12, 22),
        color: CONFETTI_COLORS[(Math.random() * CONFETTI_COLORS.length) | 0],
        rot: rand(0, 6), vr: rand(-4, 4)
      });
    }
    ensureRunning();
  }

  /* ---------------- render loop ---------------- */

  function drawStar(size) {
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var r = i % 2 === 0 ? size : size * 0.45;
      var a = (Math.PI / 5) * i - Math.PI / 2;
      var px = Math.cos(a) * r, py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  function step(dt) {
    var alive = [];
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      p.age += dt;
      if (p.age >= p.life) continue;
      p.vy += p.g * dt;
      if (p.kind === 'confetti') {
        p.wobble += dt * p.flutter;
        p.x += (p.vx + Math.sin(p.wobble) * 60) * dt;
      } else {
        p.x += p.vx * dt;
      }
      p.y += p.vy * dt;
      if (p.vr) p.rot += p.vr * dt;
      p.vx *= (1 - 1.4 * dt);
      alive.push(p);
    }
    particles = alive;

    ctx.clearRect(0, 0, W, H);
    for (var j = 0; j < particles.length; j++) {
      var q = particles[j];
      var fade = 1 - Math.max(0, (q.age / q.life - 0.55) / 0.45);
      ctx.globalAlpha = Math.max(0, Math.min(1, fade));
      ctx.fillStyle = q.color;
      if (q.kind === 'confetti') {
        ctx.save();
        ctx.translate(q.x, q.y);
        ctx.rotate(q.rot);
        // ribbon effect: squash based on wobble
        ctx.scale(1, 0.55 + 0.45 * Math.abs(Math.sin(q.wobble * 2)));
        ctx.fillRect(-q.size / 2, -q.size / 3, q.size, q.size * 0.66);
        ctx.restore();
      } else if (q.kind === 'bigstar') {
        ctx.save();
        ctx.translate(q.x, q.y);
        ctx.rotate(q.rot);
        drawStar(q.size);
        ctx.restore();
      } else {
        if (q.star) {
          ctx.save();
          ctx.translate(q.x, q.y);
          drawStar(q.size);
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.arc(q.x, q.y, q.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  var lastT = 0;
  function loop(t) {
    if (!particles.length) { running = false; ctx.clearRect(0, 0, W, H); return; }
    var dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
    lastT = t;
    step(dt);
    requestAnimationFrame(loop);
  }

  function ensureRunning() {
    if (running) return;
    running = true;
    lastT = performance.now();
    requestAnimationFrame(loop);
  }

  window.FX = {
    spark: spawnSparkle,
    confetti: confettiBurst,
    starBurst: starBurst
  };
})();
