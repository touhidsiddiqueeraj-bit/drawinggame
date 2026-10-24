/*
 * Draw & Learn — app.js
 * Screen flow, item pickers, palette, progress, celebration, persistence.
 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  var state = {
    screen: 'home',
    category: null,
    item: null,
    color: window.BRUSH_COLORS[0],
    completed: loadCompleted()
  };

  var engine = null;
  var milestones = {};
  var almostSpoken = false;
  var autoAdvanceTimer = null;
  var demoMode = /[?&]demo=1/.test(location.search);

  /* ================= persistence ================= */

  function loadCompleted() {
    try { return JSON.parse(localStorage.getItem('dl_completed') || '[]'); }
    catch (e) { return []; }
  }
  function saveCompleted() {
    try { localStorage.setItem('dl_completed', JSON.stringify(state.completed)); } catch (e) {}
  }
  function markCompleted(id) {
    if (state.completed.indexOf(id) === -1) {
      state.completed.push(id);
      saveCompleted();
    }
  }

  /* ================= screens ================= */

  function showScreen(name) {
    document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('active'); });
    $('screen-' + name).classList.add('active');
    state.screen = name;
  }

  /* ================= HOME ================= */

  function buildHome() {
    var list = $('category-list');
    list.innerHTML = '';
    window.CATEGORIES.forEach(function (cat, i) {
      var count = window.GLYPHS.filter(function (g) { return g.cat === cat.id; }).length;
      var done = window.GLYPHS.filter(function (g) { return g.cat === cat.id && state.completed.indexOf(g.id) !== -1; }).length;
      var btn = document.createElement('button');
      btn.className = 'cat-btn';
      btn.style.setProperty('--cc', cat.color);
      btn.style.setProperty('--wd', (i * 0.45) + 's');
      btn.innerHTML =
        '<span class="cat-emoji">' + cat.emoji + '</span>' +
        '<span><span class="cat-name">' + cat.name + '</span>' +
        '<span class="cat-blurb">' + cat.blurb + ' \u2022 ' + done + '/' + count + ' \u2B50</span></span>' +
        '<span class="cat-arrow">\u27A1\uFE0F</span>';
      btn.addEventListener('click', function () {
        window.SoundKit.SFX.pop();
        openPicker(cat.id);
      });
      list.appendChild(btn);
    });
    refreshMusicButtons();
  }

  /* ================= PICKER ================= */

  function openPicker(catId) {
    state.category = catId;
    var cat = window.CATEGORIES.filter(function (c) { return c.id === catId; })[0];
    $('picker-title').textContent = cat.emoji + ' ' + cat.name;
    var grid = $('picker-grid');
    grid.innerHTML = '';

    var items = window.GLYPHS.filter(function (g) { return g.cat === catId; });
    items.forEach(function (g, i) {
      var card = document.createElement('button');
      card.className = 'item-card';
      card.style.setProperty('--cc', g.color);
      card.style.setProperty('--pd', Math.min(i * 0.035, 0.7) + 's');
      var cv = document.createElement('canvas');
      card.appendChild(cv);
      var label = document.createElement('span');
      label.className = 'card-label';
      label.textContent = g.caption;
      card.appendChild(label);
      if (state.completed.indexOf(g.id) !== -1) {
        var star = document.createElement('span');
        star.className = 'card-star';
        star.textContent = '\u2B50';
        card.appendChild(star);
      }
      card.addEventListener('click', function () {
        window.SoundKit.SFX.pop();
        openDraw(g);
      });
      grid.appendChild(card);
      requestAnimationFrame(function () { renderCardGlyph(cv, g); });
    });

    showScreen('picker');
    window.SoundKit.Voice.play('tap-a-picture');
  }

  function renderCardGlyph(canvas, glyph) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = canvas.parentElement.clientWidth - 8 || 80;
    var h = 62;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.height = h + 'px';
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var size = Math.min(w, h) * 1.28;
    var ox = (w - size) / 2, oy = (h - size) / 2, s = size / 100;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = glyph.color;
    ctx.lineWidth = size / 26;
    glyph.strokes.forEach(function (stroke) {
      ctx.beginPath();
      _pathOn(ctx, stroke, ox, oy, s);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
    ctx.lineWidth = size / 62;
    glyph.strokes.forEach(function (stroke) {
      ctx.beginPath();
      _pathOn(ctx, stroke, ox, oy, s);
      ctx.stroke();
    });
  }

  function _pathOn(ctx, pts, ox, oy, s) {
    ctx.moveTo(ox + pts[0][0] * s, oy + pts[0][1] * s);
    for (var i = 1; i < pts.length; i++) {
      ctx.lineTo(ox + pts[i][0] * s, oy + pts[i][1] * s);
    }
  }

  /* ================= DRAW ================= */

  function openDraw(glyph) {
    state.item = glyph;
    milestones = { 25: false, 50: false, 75: false };
    almostSpoken = false;
    hideCelebration();
    if (autoAdvanceTimer) { clearTimeout(autoAdvanceTimer); autoAdvanceTimer = null; }

    var nameEl = $('draw-name');
    nameEl.textContent = glyph.cat === 'letters' ? (glyph.name + ' is for ' + glyph.caption) : (glyph.cat === 'numbers' ? glyph.caption : glyph.name);

    if (!engine) {
      engine = new window.DrawEngine($('draw-canvas'), {
        onProgress: onProgress,
        onComplete: onComplete
      });
    }
    engine.setColor(state.color);
    engine.setItem(glyph);
    showScreen('draw');
    buildPalette();

    window.SoundKit.SFX.whoosh();
    window.SoundKit.Voice.play(glyph.id);
    window.SoundKit.Voice.preload(nextItemsIds(glyph, 2));

    if (demoMode) setTimeout(function () { engine.demo(); }, 1400);
  }

  function nextItemsIds(glyph, n) {
    var items = window.GLYPHS.filter(function (g) { return g.cat === glyph.cat; });
    var idx = items.indexOf(glyph);
    var out = [];
    for (var i = 1; i <= n; i++) out.push(items[(idx + i) % items.length].id);
    return out;
  }

  function onProgress(p, silent) {
    var pct = Math.min(100, Math.round(p * 100));
    $('progress-fill').style.width = pct + '%';
    $('progress-star').style.left = pct + '%';
    if (silent) return;
    [25, 50, 75].forEach(function (m) {
      if (pct >= m && !milestones[m]) {
        milestones[m] = true;
        window.SoundKit.SFX.bell();
        var star = $('progress-star');
        star.classList.remove('pop');
        void star.offsetWidth;
        star.classList.add('pop');
      }
    });
    if (pct >= 45 && pct < 72 && !almostSpoken) {
      almostSpoken = true;
      window.SoundKit.Voice.play('almost-there');
    }
  }

  function onComplete() {
    markCompleted(state.item.id);
    window.SoundKit.SFX.fanfare();
    var glyph = state.item;
    var praises = ['great-job', 'amazing', 'wonderful', 'perfect', 'you-did-it', 'super-star', 'fantastic', 'beautiful'];
    window.SoundKit.Voice.play(praises[(Math.random() * praises.length) | 0]);

    // confetti + star bursts
    window.FX.confetti({ count: 150, power: 1.15 });
    setTimeout(function () { window.FX.starBurst(window.innerWidth / 2, window.innerHeight * 0.4, 12); }, 250);
    setTimeout(function () { window.FX.confetti({ count: 60, power: 0.8, y: window.innerHeight * 0.3 }); }, 600);

    // celebration card
    $('celebrate-emoji').textContent = glyph.emoji;
    $('celebrate-caption').textContent = glyph.cat === 'letters'
      ? glyph.name + ' is for ' + glyph.caption + '!'
      : 'You drew the ' + glyph.caption.toLowerCase() + '!';
    var praiseTexts = { 'great-job': 'Great job!', 'amazing': 'Amazing!', 'wonderful': 'Wonderful!',
      'perfect': 'Perfect!', 'you-did-it': 'You did it!', 'super-star': 'Super star!',
      'fantastic': 'Fantastic!', 'beautiful': 'So beautiful!' };
    var picked = praises[(Math.random() * praises.length) | 0];
    $('celebrate-text').textContent = praiseTexts[picked] || 'Great job!';
    showCelebration();

    autoAdvanceTimer = setTimeout(function () {
      autoAdvanceTimer = null;
      goNext();
    }, 4600);
  }

  function showCelebration() {
    var c = $('celebration');
    c.classList.remove('hidden');
    c.setAttribute('aria-hidden', 'false');
    var card = $('celebrate-card');
    card.style.animation = 'none';
    void card.offsetWidth;
    card.style.animation = '';
  }
  function hideCelebration() {
    var c = $('celebration');
    c.classList.add('hidden');
    c.setAttribute('aria-hidden', 'true');
  }

  function goNext() {
    if (!state.item) return;
    var items = window.GLYPHS.filter(function (g) { return g.cat === state.item.cat; });
    var idx = items.indexOf(state.item);
    openDraw(items[(idx + 1) % items.length]);
  }

  /* ================= palette ================= */

  function buildPalette() {
    var bar = $('palette-bar');
    bar.innerHTML = '';
    window.BRUSH_COLORS.forEach(function (c, i) {
      var sw = document.createElement('button');
      sw.className = 'swatch' + (c.id === 'rainbow' ? ' rainbow-swatch' : '') + (state.color.id === c.id ? ' selected' : '');
      if (c.hex) sw.style.setProperty('--sc', c.hex);
      sw.setAttribute('aria-label', c.name);
      sw.addEventListener('click', function () {
        state.color = c;
        if (engine) engine.setColor(c);
        bar.querySelectorAll('.swatch').forEach(function (s) { s.classList.remove('selected'); });
        sw.classList.add('selected');
        window.SoundKit.SFX.colorPop(i);
        window.SoundKit.Voice.play(c.id);
      });
      bar.appendChild(sw);
    });
  }

  /* ================= music toggle ================= */

  function refreshMusicButtons() {
    var on = window.SoundKit.isMusicOn();
    [$('btn-music-home'), $('btn-music-draw')].forEach(function (b) {
      if (b) b.classList.toggle('off', !on);
    });
  }
  function toggleMusic() {
    window.SoundKit.setMusic(!window.SoundKit.isMusicOn());
    refreshMusicButtons();
    window.SoundKit.SFX.pop(0.7);
  }

  /* ================= wire up ================= */

  function init() {
    buildHome();

    $('btn-back-picker').addEventListener('click', function () {
      window.SoundKit.SFX.whoosh();
      buildHome();
      showScreen('home');
    });
    $('btn-back-draw').addEventListener('click', function () {
      window.SoundKit.SFX.whoosh();
      hideCelebration();
      if (autoAdvanceTimer) { clearTimeout(autoAdvanceTimer); autoAdvanceTimer = null; }
      openPicker(state.category);
    });
    $('btn-replay').addEventListener('click', function () {
      window.SoundKit.SFX.pop(1.1);
      if (state.item) window.SoundKit.Voice.play(state.item.id);
      if (engine) engine.hint();
    });
    $('btn-hint').addEventListener('click', function () {
      window.SoundKit.SFX.pop(1.3);
      if (engine) engine.hint();
    });
    $('btn-clear').addEventListener('click', function () {
      window.SoundKit.SFX.whoosh();
      if (engine) engine.clear();
      milestones = { 25: false, 50: false, 75: false };
      almostSpoken = false;
    });
    $('btn-next').addEventListener('click', function () {
      window.SoundKit.SFX.pop(1.4);
      goNext();
    });
    $('btn-music-home').addEventListener('click', toggleMusic);
    $('btn-music-draw').addEventListener('click', toggleMusic);

    // welcome voice once interaction is possible (autoplay-safe)
    var welcomed = false;
    var welcomeOnce = function () {
      if (welcomed) return;
      welcomed = true;
      setTimeout(function () { window.SoundKit.Voice.play('welcome'); }, 350);
      window.removeEventListener('pointerdown', welcomeOnce);
      window.removeEventListener('touchstart', welcomeOnce);
    };
    window.addEventListener('pointerdown', welcomeOnce);
    window.addEventListener('touchstart', welcomeOnce);

    // picker hint voice when arriving at picker
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) window.SoundKit.Voice.stop();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
