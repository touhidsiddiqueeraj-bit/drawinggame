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
    completed: loadCompleted(),
    stars: loadStars(),
    mode: loadMode(),          // 'auto' (hop on at 80%) | 'stars' (Done button + 1-3 stars)
    letterCase: loadCase()     // 'big' | 'small' (letters picker toggle)
  };

  var engine = null;
  var milestones = {};
  var almostSpoken = false;
  var autoAdvanceTimer = null;
  var starReady = false;      // star mode: has the 80% "more stars" cue fired?
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
  function loadStars() {
    try { return JSON.parse(localStorage.getItem('dl_stars') || '{}'); }
    catch (e) { return {}; }
  }
  // keep the BEST star count per glyph (re-tracing can only improve it)
  function saveStars(id, n) {
    if ((state.stars[id] || 0) >= n) return;
    state.stars[id] = n;
    try { localStorage.setItem('dl_stars', JSON.stringify(state.stars)); } catch (e) {}
  }
  function loadMode() {
    return localStorage.getItem('dl_mode') === 'stars' ? 'stars' : 'auto';
  }
  function loadCase() {
    return localStorage.getItem('dl_case') === 'small' ? 'small' : 'big';
  }
  // 1 star at 80%, 2 at 90%, 3 at (almost) perfect
  function starsFor(p) {
    return p >= 0.995 ? 3 : p >= 0.9 ? 2 : p >= 0.8 ? 1 : 0;
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
    refreshModeToggle();
    refreshMusicButtons();
  }

  /* ================= pass-mode setting ================= */

  function refreshModeToggle() {
    document.querySelectorAll('#mode-toggle .mode-btn').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-mode') === state.mode);
    });
  }
  function refreshDoneButton() {
    var b = $('btn-done');
    if (b) b.classList.toggle('hidden', state.mode !== 'stars');
  }
  function setMode(m) {
    if (state.mode === m) return;
    state.mode = m;
    try { localStorage.setItem('dl_mode', m); } catch (e) {}
    refreshModeToggle();
    refreshDoneButton();
    if (engine) engine.setAutoWin(m === 'auto');
    window.SoundKit.SFX.pop(m === 'stars' ? 0.8 : 1.2);
  }

  /* ================= letters case toggle ================= */

  function refreshCaseButtons() {
    var b = $('case-big'), s = $('case-small');
    if (b) b.classList.toggle('active', state.letterCase === 'big');
    if (s) s.classList.toggle('active', state.letterCase === 'small');
  }
  function setLetterCase(c) {
    if (state.letterCase === c) return;
    state.letterCase = c;
    try { localStorage.setItem('dl_case', c); } catch (e) {}
    window.SoundKit.SFX.pop(1.15);
    window.SoundKit.Voice.play(c === 'small' ? 'small-letters' : 'big-letters');
    openPicker('letters');
  }

  // items of a category — the letters picker only shows the active case
  function categoryItems(cat) {
    return window.GLYPHS.filter(function (g) {
      if (g.cat !== cat) return false;
      if (cat === 'letters') return (g.letterCase || 'big') === state.letterCase;
      return true;
    });
  }

  /* ================= PICKER ================= */

  function openPicker(catId) {
    state.category = catId;
    var cat = window.CATEGORIES.filter(function (c) { return c.id === catId; })[0];
    $('picker-title').textContent = cat.emoji + ' ' + cat.name;
    var toggle = $('case-toggle');
    if (toggle) toggle.classList.toggle('hidden', catId !== 'letters');
    refreshCaseButtons();
    var grid = $('picker-grid');
    grid.innerHTML = '';

    var items = categoryItems(catId);
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
      var starCount = state.stars[g.id] ||
        (state.completed.indexOf(g.id) !== -1 ? 1 : 0); // legacy: done pre-stars
      if (starCount > 0) {
        var star = document.createElement('span');
        star.className = 'card-star';
        star.textContent = new Array(starCount + 1).join('\u2B50');
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
    // pre-applied animal colors + decorative eyes (recognizability)
    if (glyph.fill) {
      ctx.save();
      glyph.fill.forEach(function (f) {
        ctx.globalAlpha = (typeof f.a === 'number') ? f.a : 0.32;
        ctx.fillStyle = f.c;
        ctx.beginPath();
        _pathOn(ctx, f.p, ox, oy, s);
        ctx.closePath();
        ctx.fill();
      });
      ctx.restore();
    }
    if (glyph.eyes) _drawEyes(ctx, glyph, ox, oy, s);
    if (glyph.mouth) _drawMouth(ctx, glyph, ox, oy, s);
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

  // Decorative smile for picker cards (same look as the engine's).
  function _drawMouth(ctx, glyph, ox, oy, s) {
    var m = glyph.mouth;
    var x = ox + m[0] * s, y = oy + m[1] * s, hw = m[2] * s, d = m[3] * s;
    ctx.save();
    ctx.strokeStyle = '#2B2B33';
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = Math.max(1.5, 2.0 * s);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - hw, y);
    if (m[4] === 'cat') {
      ctx.quadraticCurveTo(x - hw / 2, y + d, x, y);
      ctx.quadraticCurveTo(x + hw / 2, y + d, x + hw, y);
    } else {
      ctx.quadraticCurveTo(x, y + d, x + hw, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function _pathOn(ctx, pts, ox, oy, s) {
    ctx.moveTo(ox + pts[0][0] * s, oy + pts[0][1] * s);
    for (var i = 1; i < pts.length; i++) {
      ctx.lineTo(ox + pts[i][0] * s, oy + pts[i][1] * s);
    }
  }

  // Decorative animal eyes for picker cards (same look as the engine's).
  function _drawEyes(ctx, glyph, ox, oy, s) {
    ctx.save();
    ctx.globalAlpha = 0.92;
    glyph.eyes.forEach(function (e) {
      var x = ox + e[0] * s, y = oy + e[1] * s, r = Math.max(1.4, e[2] * s);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      if (e[3] === 'w') {
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + r * 0.18, y, r * 0.52, 0, Math.PI * 2);
        ctx.fillStyle = '#2B2B33';
        ctx.fill();
      } else {
        ctx.fillStyle = '#2B2B33';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x - r * 0.32, y - r * 0.36, r * 0.34, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,.95)';
        ctx.fill();
      }
    });
    ctx.restore();
  }

  /* ================= DRAW ================= */

  function openDraw(glyph) {
    state.item = glyph;
    milestones = { 25: false, 50: false, 75: false };
    almostSpoken = false;
    starReady = false;
    hideCelebration();
    if (autoAdvanceTimer) { clearTimeout(autoAdvanceTimer); autoAdvanceTimer = null; }

    var nameEl = $('draw-name');
    nameEl.textContent = glyph.cat === 'letters' ? (glyph.name + ' is for ' + glyph.caption) : (glyph.cat === 'numbers' ? glyph.caption : glyph.name);

    // sound button: animals & objects with a sound (shows the thing itself)
    var soundBtn = $('btn-sound');
    if (soundBtn) {
      soundBtn.classList.toggle('hidden', !glyph.sound);
      if (glyph.sound) soundBtn.textContent = glyph.emoji;
    }

    // star mode: show the big green Done button
    var doneBtn = $('btn-done');
    if (doneBtn) {
      doneBtn.classList.toggle('hidden', state.mode !== 'stars');
      doneBtn.classList.remove('ready');
    }

    if (!engine) {
      engine = new window.DrawEngine($('draw-canvas'), {
        onProgress: onProgress,
        onComplete: onComplete
      });
    }
    engine.setColor(state.color);
    engine.setAutoWin(state.mode === 'auto');
    engine.setItem(glyph);
    showScreen('draw');
    buildPalette();

    window.SoundKit.SFX.whoosh();
    // animals: their sound plays first (the hook!), then the voice
    if (glyph.sound) {
      window.SoundKit.Animal.play(glyph.sound);
      setTimeout(function () {
        if (state.item === glyph) window.SoundKit.Voice.play(glyph.id);
      }, 1000);
    } else {
      window.SoundKit.Voice.play(glyph.id);
    }
    window.SoundKit.Voice.preload(nextItemsIds(glyph, 2));

    if (demoMode) setTimeout(function () { engine.demo(); }, 1400);
  }

  function nextItemsIds(glyph, n) {
    var items = categoryItems(glyph.cat);
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
    if (pct >= 50 && pct < 80 && !almostSpoken) {
      almostSpoken = true;
      window.SoundKit.Voice.play('almost-there');
    }
    // star mode: at 80% the Done button wakes up and invites more tracing
    if (state.mode === 'stars' && pct >= 80 && !starReady) {
      starReady = true;
      window.SoundKit.Voice.play('more-stars');
      var db = $('btn-done');
      if (db) {
        db.classList.add('ready');
        db.classList.remove('wiggle');
        void db.offsetWidth;
        db.classList.add('wiggle');
      }
    }
  }

  function onComplete() {
    // fired by the engine in auto mode at >= 80% coverage
    finishWithStars(engine ? Math.max(engine.progress, 0.8) : 1);
  }

  function finishWithStars(p) {
    if (!state.item) return;
    var glyph = state.item;
    var stars = starsFor(p);
    markCompleted(glyph.id);
    if (stars > 0) saveStars(glyph.id, stars);
    window.SoundKit.SFX.fanfare();

    // voice: star count in star mode, classic praise in auto mode
    var praises = ['great-job', 'amazing', 'wonderful', 'perfect', 'you-did-it', 'super-star', 'fantastic', 'beautiful'];
    var pickedPraise = praises[(Math.random() * praises.length) | 0];
    if (state.mode === 'stars' && stars > 0) {
      window.SoundKit.Voice.play(stars >= 3 ? 'three-stars' : stars === 2 ? 'two-stars' : 'one-star');
    } else {
      window.SoundKit.Voice.play(pickedPraise);
    }

    // the animal / object says thanks in its own voice
    if (glyph.sound) {
      setTimeout(function () {
        if (state.item === glyph) window.SoundKit.Animal.play(glyph.sound);
      }, 1700);
    }

    // confetti + star bursts
    window.FX.confetti({ count: 150, power: 1.15 });
    setTimeout(function () { window.FX.starBurst(window.innerWidth / 2, window.innerHeight * 0.4, 12); }, 250);
    setTimeout(function () { window.FX.confetti({ count: 60, power: 0.8, y: window.innerHeight * 0.3 }); }, 600);

    // celebration card
    $('celebrate-emoji').textContent = glyph.emoji;
    $('celebrate-caption').textContent = glyph.cat === 'letters'
      ? glyph.name + ' is for ' + glyph.caption + '!'
      : 'You drew the ' + glyph.caption.toLowerCase() + '!';
    var starsHtml = '';
    for (var i = 1; i <= 3; i++) {
      starsHtml += '<span class="cstar' + (i <= stars ? ' on' : '') + '">\u2B50</span>';
    }
    $('celebrate-stars').innerHTML = starsHtml;
    var praiseTexts = { 'great-job': 'Great job!', 'amazing': 'Amazing!', 'wonderful': 'Wonderful!',
      'perfect': 'Perfect!', 'you-did-it': 'You did it!', 'super-star': 'Super star!',
      'fantastic': 'Fantastic!', 'beautiful': 'So beautiful!' };
    var starTexts = { 1: 'One star!', 2: 'Two stars!', 3: 'Three stars!' };
    $('celebrate-text').textContent = (state.mode === 'stars' && stars > 0)
      ? (starTexts[stars] || 'Great job!')
      : (praiseTexts[pickedPraise] || 'Great job!');
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
    var items = categoryItems(state.item.cat);
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
    var soundBtn = $('btn-sound');
    if (soundBtn) {
      soundBtn.addEventListener('click', function () {
        window.SoundKit.SFX.pop(1.2);
        if (state.item && state.item.sound) {
          window.SoundKit.Animal.play(state.item.sound);
          soundBtn.classList.remove('wiggle');
          void soundBtn.offsetWidth;
          soundBtn.classList.add('wiggle');
        }
      });
    }
    $('btn-hint').addEventListener('click', function () {
      window.SoundKit.SFX.pop(1.3);
      if (engine) engine.hint();
    });
    $('btn-clear').addEventListener('click', function () {
      window.SoundKit.SFX.whoosh();
      if (engine) engine.clear();
      milestones = { 25: false, 50: false, 75: false };
      almostSpoken = false;
      starReady = false;
      var db = $('btn-done');
      if (db) db.classList.remove('ready');
    });
    $('btn-next').addEventListener('click', function () {
      window.SoundKit.SFX.pop(1.4);
      goNext();
    });
    $('btn-music-home').addEventListener('click', toggleMusic);
    $('btn-music-draw').addEventListener('click', toggleMusic);

    // pass-mode setting (home) + letters case toggle (picker)
    document.querySelectorAll('#mode-toggle .mode-btn').forEach(function (b) {
      b.addEventListener('click', function () { setMode(b.getAttribute('data-mode')); });
    });
    var caseBig = $('case-big'), caseSmall = $('case-small');
    if (caseBig) caseBig.addEventListener('click', function () { setLetterCase('big'); });
    if (caseSmall) caseSmall.addEventListener('click', function () { setLetterCase('small'); });

    // star mode: the big green Done button
    var doneBtn = $('btn-done');
    if (doneBtn) {
      doneBtn.addEventListener('click', function () {
        window.SoundKit.SFX.pop(1.5);
        if (!engine || !state.item || autoAdvanceTimer) return; // already celebrating
        if (engine.progress < 0.8) {
          window.SoundKit.Voice.play('keep-going');
          engine.hint();
          doneBtn.classList.remove('wiggle');
          void doneBtn.offsetWidth;
          doneBtn.classList.add('wiggle');
          return;
        }
        finishWithStars(engine.progress);
      });
    }

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
