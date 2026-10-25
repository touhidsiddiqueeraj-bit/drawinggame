/*
 * Draw & Learn — game.js
 * The tracing engine.
 *
 * - Guides: pastel "road" + colored line + marching candy dots,
 *   pulsing start stars, numbered stroke badges.
 * - Paths: CORNER-PRESERVING smoothing — points where the stroke
 *   turns sharper than ~50° are drawn as crisp lineTo corners
 *   (rectangles, polygons, letters like M V W Z A), everything
 *   else keeps the soft midpoint quadratic smoothing (S, O, 3,
 *   hearts, moons). Best of both worlds for tracing.
 * - Brush: fat rounded crayon (opaque single-pass = no joint artifacts),
 *   rainbow mode cycles hue along the line.
 * - Coverage: guide is resampled every ~5px; a sample counts as "hit"
 *   when the finger comes within a generous radius. 80% = complete.
 * - Hint: a glowing orb travels the guide path with a sparkle trail.
 * - Everything rescales on resize/orientation change (strokes replayed).
 */
(function () {
  'use strict';

  function DrawEngine(canvas, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.opts = opts || {};
    this.onProgress = this.opts.onProgress || function () {};
    this.onComplete = this.opts.onComplete || function () {};

    this.userCanvas = document.createElement('canvas');
    this.userCtx = this.userCanvas.getContext('2d');

    this.glyph = null;
    this.color = { id: 'red', hex: '#FF4753' };
    this.samples = [];       // {x, y, hit}
    this.totalSamples = 0;
    this.hitCount = 0;
    this.progress = 0;
    this.completed = false;
    this.strokesNorm = [];   // [[{x,y,color,hue}...]] normalized 0..1 for replay
    this.pointers = {};      // pointerId -> {x, y, dist}
    this.box = { x: 0, y: 0, size: 100, s: 1 }; // glyph->screen mapping
    this.paths = [];         // Path2D per stroke (screen coords)
    this.strokePathsPts = []; // resampled pts per stroke (screen coords)
    this.hintState = null;
    this.demoState = null;
    this.raf = 0;
    this.time = 0;
    this.rect = { left: 0, top: 0 };
    this.destroyed = false;

    var self = this;
    this._loop = function (t) { self._frame(t); };
    this.raf = requestAnimationFrame(this._loop);

    this._bindInput();
    this.resize();
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(function () { self.resize(); });
      this.ro.observe(canvas.parentElement || canvas);
    } else {
      window.addEventListener('resize', function () { self.resize(); });
      window.addEventListener('orientationchange', function () { setTimeout(function () { self.resize(); }, 250); });
    }
  }

  /* ================= mapping & setup ================= */

  DrawEngine.prototype.resize = function () {
    var parent = this.canvas.parentElement;
    var w = parent ? parent.clientWidth : window.innerWidth;
    var h = parent ? parent.clientHeight : window.innerHeight;
    if (w < 10 || h < 10) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = w; this.h = h; this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.userCanvas.width = this.canvas.width;
    this.userCanvas.height = this.canvas.height;
    this.userCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.rect = this.canvas.getBoundingClientRect();

    if (this.glyph) this._layout(true);
  };

  // map glyph (0..100) into a centered box
  DrawEngine.prototype._layout = function (replay) {
    var size = Math.min(this.w, this.h) * 0.94;
    var ox = (this.w - size) / 2;
    var oy = (this.h - size) / 2;
    this.box = { x: ox, y: oy, size: size, s: size / 100 };
    this.guideW = Math.max(9, size / 30);
    this.brushW = this.guideW * 1.5;
    this.coverR = this.guideW * 2.1;

    // build screen-space paths + resampled points
    this.paths = [];
    this.strokePathsPts = [];
    var self = this;
    this.glyph.strokes.forEach(function (stroke) {
      var pts = stroke.map(function (p) { return [ox + p[0] * self.box.s, oy + p[1] * self.box.s]; });
      var path = new Path2D();
      _pathThrough(path, pts);
      self.paths.push(path);
      self.strokePathsPts.push(_resample(pts, 5));
    });

    // rebuild coverage samples (silent)
    this.samples = [];
    var self2 = this;
    this.strokePathsPts.forEach(function (pts) {
      pts.forEach(function (p) { self2.samples.push({ x: p[0], y: p[1], hit: false }); });
    });
    this.totalSamples = this.samples.length;
    this.hitCount = 0;

    if (replay && this.strokesNorm.length) this._replay();
    this._updateProgress(true);
  };

  DrawEngine.prototype.setItem = function (glyph) {
    this.glyph = glyph;
    this.completed = false;
    this.progress = 0;
    this.strokesNorm = [];
    this.hintState = null;
    this.demoState = null;
    this._layout(false);
    this._clearUser();
    // auto-hint shortly after the item appears
    var self = this;
    setTimeout(function () { if (self.glyph === glyph && !self.destroyed) self.hint(); }, 650);
  };

  DrawEngine.prototype.setColor = function (color) { this.color = color; };

  DrawEngine.prototype._clearUser = function () {
    this.userCtx.clearRect(0, 0, this.w, this.h);
  };

  DrawEngine.prototype.clear = function () {
    this._clearUser();
    this.strokesNorm = [];
    this.samples.forEach(function (s) { s.hit = false; });
    this.hitCount = 0;
    this.completed = false;
    this._updateProgress(true);
  };

  /* ================= geometry helpers ================= */

  // Turn threshold: sharper than this = keep the point as a crisp corner.
  // 50° sits safely between the gentlest polygon corner (hexagon, 60°)
  // and the sharpest hand-authored curve joint (letter S, ~45°).
  var CORNER_TURN = 50 * Math.PI / 180;
  // Fraction of the guide that must be covered before the win fires.
  var COMPLETE_AT = 0.80;

  function _isCorner(prev, cur, next) {
    var ax = cur[0] - prev[0], ay = cur[1] - prev[1];
    var bx = next[0] - cur[0], by = next[1] - cur[1];
    var la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
    if (la < 0.001 || lb < 0.001) return false; // duplicate/junction point
    var cos = (ax * bx + ay * by) / (la * lb);
    cos = Math.max(-1, Math.min(1, cos));
    return Math.acos(cos) > CORNER_TURN;
  }

  // Soft midpoint quadratics from pts[s] to pts[e], straight arrival at pts[e].
  function _smoothRun(path, pts, s, e) {
    if (e - s === 1) { path.lineTo(pts[e][0], pts[e][1]); return; }
    for (var j = s + 1; j < e; j++) {
      var mx = (pts[j][0] + pts[j + 1][0]) / 2;
      var my = (pts[j][1] + pts[j + 1][1]) / 2;
      path.quadraticCurveTo(pts[j][0], pts[j][1], mx, my);
    }
    path.lineTo(pts[e][0], pts[e][1]);
  }

  // Corner-preserving path builder: split the point list into runs at
  // sharp corners; corners are joined with straight lines, runs between
  // them get the soft quadratic smoothing.
  function _pathThrough(path, pts) {
    path.moveTo(pts[0][0], pts[0][1]);
    if (pts.length === 2) { path.lineTo(pts[1][0], pts[1][1]); return; }
    var n = pts.length;
    var runStart = 0;
    for (var i = 1; i < n; i++) {
      var atEnd = (i === n - 1);
      if (!atEnd && !_isCorner(pts[i - 1], pts[i], pts[i + 1])) continue;
      _smoothRun(path, pts, runStart, i);
      runStart = i;
    }
  }

  function _resample(pts, step) {
    var out = [pts[0]];
    var carry = 0;
    for (var i = 0; i < pts.length - 1; i++) {
      var ax = pts[i][0], ay = pts[i][1];
      var bx = pts[i + 1][0], by = pts[i + 1][1];
      var segLen = Math.hypot(bx - ax, by - ay);
      if (segLen < 0.001) continue;
      var t = carry;
      while (t < segLen) {
        out.push([ax + (bx - ax) * (t / segLen), ay + (by - ay) * (t / segLen)]);
        t += step;
      }
      carry = t - segLen;
    }
    out.push(pts[pts.length - 1]);
    return out;
  }

  /* ================= input ================= */

  DrawEngine.prototype._bindInput = function () {
    var self = this;
    var c = this.canvas;

    function pos(e) {
      var r = self.rect;
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    if (window.PointerEvent) {
      c.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        try { c.setPointerCapture(e.pointerId); } catch (err) {}
        var p = pos(e);
        self.pointers[e.pointerId] = { x: p.x, y: p.y, dist: 0 };
        self._stamp(p.x, p.y, null, 0);
        self._drawTo(p.x, p.y, e.pointerId);
        window.SoundKit.SFX.pop(1.25);
      });
      c.addEventListener('pointermove', function (e) {
        if (!(e.pointerId in self.pointers)) return;
        e.preventDefault();
        var evs = (typeof e.getCoalescedEvents === 'function') ? e.getCoalescedEvents() : null;
        if (evs && evs.length) {
          for (var i = 0; i < evs.length; i++) {
            var pc = pos(evs[i]);
            self._drawTo(pc.x, pc.y, e.pointerId);
          }
        } else {
          var p = pos(e);
          self._drawTo(p.x, p.y, e.pointerId);
        }
      });
      function end(e) {
        delete self.pointers[e.pointerId];
      }
      c.addEventListener('pointerup', end);
      c.addEventListener('pointercancel', end);
    } else {
      // legacy fallback: mouse + touch
      c.addEventListener('touchstart', function (e) {
        e.preventDefault();
        for (var i = 0; i < e.changedTouches.length; i++) {
          var t = e.changedTouches[i];
          var p = pos(t);
          self.pointers[t.identifier] = { x: p.x, y: p.y, dist: 0 };
          self._stamp(p.x, p.y, null, 0);
          self._drawTo(p.x, p.y, t.identifier);
        }
        window.SoundKit.SFX.pop(1.25);
      }, { passive: false });
      c.addEventListener('touchmove', function (e) {
        e.preventDefault();
        for (var i = 0; i < e.changedTouches.length; i++) {
          var t = e.changedTouches[i];
          if (!(t.identifier in self.pointers)) continue;
          var p = pos(t);
          self._drawTo(p.x, p.y, t.identifier);
        }
      }, { passive: false });
      function tEnd(e) {
        for (var i = 0; i < e.changedTouches.length; i++) delete self.pointers[e.changedTouches[i].identifier];
      }
      c.addEventListener('touchend', tEnd);
      c.addEventListener('touchcancel', tEnd);
      c.addEventListener('mousedown', function (e) {
        var p = pos(e);
        self.pointers['mouse'] = { x: p.x, y: p.y, dist: 0 };
        self._stamp(p.x, p.y, null, 0);
        self._drawTo(p.x, p.y, 'mouse');
      });
      window.addEventListener('mousemove', function (e) {
        if (!('mouse' in self.pointers)) return;
        var p = pos(e);
        self._drawTo(p.x, p.y, 'mouse');
      });
      window.addEventListener('mouseup', function () { delete self.pointers['mouse']; });
    }
  };

  /* ================= drawing ================= */

  DrawEngine.prototype._brushStyle = function (ptr, norm) {
    if (this.color.id === 'rainbow') {
      return 'hsl(' + ((ptr.dist * 0.9) % 360) + ', 92%, 55%)';
    }
    return this.color.hex;
  };

  DrawEngine.prototype._drawTo = function (x, y, pointerId) {
    var ptr = this.pointers[pointerId];
    if (!ptr) return;
    var ctx = this.userCtx;
    var dx = x - ptr.x, dy = y - ptr.y;
    var d = Math.hypot(dx, dy);
    if (d < 1.2) return;

    ctx.strokeStyle = this._brushStyle(ptr);
    ctx.lineWidth = this.brushW;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(ptr.x, ptr.y);
    ctx.lineTo(x, y);
    ctx.stroke();

    ptr.dist += d;
    ptr.x = x; ptr.y = y;

    // record normalized for resize replay
    if (!ptr.stroke) ptr.stroke = [];
    ptr.stroke.push({ x: x / this.w, y: y / this.h, color: this.color.id, hex: this.color.hex, dist: ptr.dist });
    if (ptr.stroke.length === 1) this.strokesNorm.push(ptr.stroke);

    // sparkles at finger
    if (Math.random() < 0.55) {
      window.FX.spark(this.rect.left + x, this.rect.top + y);
    }
    window.SoundKit.SFX.swish();

    this._markCoverage(x, y);
  };

  DrawEngine.prototype._stamp = function (x, y) {
    // little round dab for a tap without movement
    var ctx = this.userCtx;
    ctx.fillStyle = this._brushStyle({ dist: 0 });
    ctx.beginPath();
    ctx.arc(x, y, this.brushW / 2, 0, Math.PI * 2);
    ctx.fill();
  };

  DrawEngine.prototype._markCoverage = function (x, y) {
    if (this.completed || !this.totalSamples) return;
    var r2 = this.coverR * this.coverR;
    var newly = 0;
    for (var i = 0; i < this.samples.length; i++) {
      var s = this.samples[i];
      if (s.hit) continue;
      var dx = s.x - x, dy = s.y - y;
      if (dx * dx + dy * dy <= r2) { s.hit = true; newly++; }
    }
    if (newly) {
      this.hitCount += newly;
      this._updateProgress(false);
    }
  };

  DrawEngine.prototype._updateProgress = function (silent) {
    var p = this.totalSamples ? this.hitCount / this.totalSamples : 0;
    this.progress = p;
    this.onProgress(p, silent);
    if (!this.completed && p >= COMPLETE_AT) {
      this.completed = true;
      this.onComplete();
    }
  };

  DrawEngine.prototype._replay = function () {
    // redraw stored strokes after a resize
    this._clearUser();
    var ctx = this.userCtx;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = this.brushW;
    var self = this;
    this.strokesNorm.forEach(function (stroke) {
      for (var i = 1; i < stroke.length; i++) {
        var a = stroke[i - 1], b = stroke[i];
        if (a.color === 'rainbow') ctx.strokeStyle = 'hsl(' + ((b.dist * 0.9) % 360) + ', 92%, 55%)';
        else ctx.strokeStyle = a.hex;
        ctx.beginPath();
        ctx.moveTo(a.x * self.w, a.y * self.h);
        ctx.lineTo(b.x * self.w, b.y * self.h);
        ctx.stroke();
      }
    });
    // re-evaluate coverage from replayed strokes
    var r2 = this.coverR * this.coverR;
    this.samples.forEach(function (s) { s.hit = false; });
    var hit = 0;
    this.strokesNorm.forEach(function (stroke) {
      stroke.forEach(function (q) {
        var x = q.x * self.w, y = q.y * self.h;
        for (var i = 0; i < self.samples.length; i++) {
          var s = self.samples[i];
          if (s.hit) continue;
          var dx = s.x - x, dy = s.y - y;
          if (dx * dx + dy * dy <= r2) { s.hit = true; hit++; }
        }
      });
    });
    this.hitCount = hit;
  };

  /* ================= hint animation ================= */

  DrawEngine.prototype.hint = function () {
    if (!this.glyph || this.destroyed) return;
    this.hintState = { stroke: 0, t: 0 };
    window.SoundKit.SFX.sparkle();
  };

  DrawEngine.prototype._stepHint = function (dt) {
    var hs = this.hintState;
    if (!hs) return;
    var pts = this.strokePathsPts[hs.stroke];
    if (!pts) { this.hintState = null; return; }
    hs.t += dt * 1.15; // ~0.9s per stroke
    var idx = Math.min(pts.length - 1, Math.floor(hs.t * pts.length));
    var p = pts[idx];
    if (Math.random() < 0.7) window.FX.spark(this.rect.left + p[0], this.rect.top + p[1]);
    hs.last = p;
    if (idx >= pts.length - 1) {
      hs.stroke++;
      hs.t = 0;
      if (hs.stroke >= this.strokePathsPts.length) this.hintState = null;
    }
  };

  /* ================= demo mode (testing / attract) ================= */

  DrawEngine.prototype.demo = function (speed) {
    if (!this.glyph || this.destroyed) return;
    this.demoState = { stroke: 0, i: 0, speed: speed || 2.2 };
    this.color = { id: 'rainbow', hex: null };
  };

  DrawEngine.prototype._stepDemo = function () {
    var ds = this.demoState;
    if (!ds) return;
    var pts = this.strokePathsPts[ds.stroke];
    if (!pts) { this.demoState = null; return; }
    for (var k = 0; k < ds.speed && ds; k++) {
      if (ds.i >= pts.length) {
        ds.stroke++; ds.i = 0;
        if (ds.stroke >= this.strokePathsPts.length) { this.demoState = null; return; }
        pts = this.strokePathsPts[ds.stroke];
        this.pointers['demo'] = { x: pts[0][0], y: pts[0][1], dist: 0 };
        this._stamp(pts[0][0], pts[0][1]);
      }
      var p = pts[ds.i];
      if (!this.pointers['demo']) this.pointers['demo'] = { x: p[0], y: p[1], dist: 0 };
      this._drawTo(p[0], p[1], 'demo');
      ds.i++;
    }
  };

  /* ================= render loop ================= */

  DrawEngine.prototype._frame = function (t) {
    if (this.destroyed) return;
    this.time = t / 1000;
    this.raf = requestAnimationFrame(this._loop);

    var ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);
    if (!this.glyph) return;

    var color = this.glyph.color;
    var gw = this.guideW;
    var dashOffset = (t / 34) % 40;

    // 1. pastel road
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = 0.17;
    ctx.strokeStyle = color;
    ctx.lineWidth = gw * 2.5;
    this.paths.forEach(function (p) { ctx.stroke(p); });

    // 2. road edge hint
    ctx.globalAlpha = 0.34;
    ctx.lineWidth = gw * 2.5;
    ctx.setLineDash([]);
    // (already stroked above; border effect via slightly wider under-stroke)
    ctx.restore();

    // 3. colored guide line
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = 0.88;
    ctx.strokeStyle = color;
    ctx.lineWidth = gw * 0.62;
    this.paths.forEach(function (p) { ctx.stroke(p); });

    // 4. marching candy dots
    ctx.globalAlpha = 0.95;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = gw * 0.62;
    ctx.setLineDash([0.1, 15]);
    ctx.lineDashOffset = -dashOffset;
    this.paths.forEach(function (p) { ctx.stroke(p); });
    ctx.setLineDash([]);
    ctx.restore();

    // 5. start stars + stroke badges
    var self = this;
    var pulse = 1 + 0.14 * Math.sin(this.time * 4.2);
    this.glyph.strokes.forEach(function (stroke, si) {
      var p0 = stroke[0];
      var sx = self.box.x + p0[0] * self.box.s;
      var sy = self.box.y + p0[1] * self.box.s;
      // badge circle
      ctx.save();
      ctx.translate(sx, sy);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = color;
      ctx.lineWidth = gw * 0.28;
      var br = gw * 1.15;
      ctx.beginPath();
      ctx.arc(0, 0, br, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (self.glyph.strokes.length > 1) {
        ctx.fillStyle = color;
        ctx.font = '700 ' + (gw * 1.15) + 'px Fredoka, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(si + 1), 0, gw * 0.08);
      } else {
        ctx.fillStyle = color;
        _tinyStar(ctx, 0, 0, gw * 0.62);
      }
      ctx.restore();
    });

    // 6. hint orb
    this._stepHint(1 / 60);
    if (this.hintState && this.hintState.last) {
      var hp = this.hintState.last;
      ctx.save();
      ctx.globalAlpha = 0.85;
      var glow = ctx.createRadialGradient(hp[0], hp[1], 0, hp[0], hp[1], gw * 2.2);
      glow.addColorStop(0, 'rgba(255,255,255,.95)');
      glow.addColorStop(0.5, 'rgba(255,255,255,.45)');
      glow.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(hp[0], hp[1], gw * 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 7. demo auto-draw
    this._stepDemo();

    // 8. user drawing on top
    ctx.drawImage(this.userCanvas, 0, 0, this.w, this.h);
  };

  function _tinyStar(ctx, cx, cy, r) {
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var rr = i % 2 === 0 ? r : r * 0.45;
      var a = (Math.PI / 5) * i - Math.PI / 2;
      var px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  DrawEngine.prototype.destroy = function () {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    if (this.ro) this.ro.disconnect();
  };

  window.DrawEngine = DrawEngine;
})();
