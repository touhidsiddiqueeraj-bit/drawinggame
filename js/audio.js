/*
 * Draw & Learn — audio.js
 * All sound effects are synthesized live with WebAudio (zero downloads,
 * zero latency, punchy). Voice overs are pre-generated MP3s from the
 * assets/audio folder; speechSynthesis is the last-resort fallback.
 * Background music is a gentle generative pentatonic loop.
 */
(function () {
  'use strict';

  /* ================= WebAudio setup ================= */

  var ctx = null;
  var masterGain = null;
  var sfxGain = null;
  var musicGain = null;
  var unlocked = false;

  function ensureCtx() {
    if (ctx) return true;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.9;
    masterGain.connect(ctx.destination);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = 1;
    sfxGain.connect(masterGain);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0;
    musicGain.connect(masterGain);
    return true;
  }

  function unlock() {
    if (unlocked) return;
    if (!ensureCtx()) return;
    if (ctx.state === 'suspended') ctx.resume();
    // play a silent buffer to satisfy autoplay policies on iOS
    try {
      var b = ctx.createBuffer(1, 1, 22050);
      var s = ctx.createBufferSource();
      s.buffer = b;
      s.connect(ctx.destination);
      s.start(0);
    } catch (e) { /* noop */ }
    unlocked = true;
    applyMusicPreference();
  }

  // ---------- tiny synth helpers ----------

  function osc(type, freq, t0, dur, vol, freqEnd, dest) {
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(dest || sfxGain);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  function noise(t0, dur, vol, filterType, f0, f1, q) {
    var len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var flt = ctx.createBiquadFilter();
    flt.type = filterType || 'bandpass';
    flt.frequency.setValueAtTime(f0 || 1200, t0);
    if (f1) flt.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    flt.Q.value = q || 1;
    var g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(flt); flt.connect(g); g.connect(sfxGain);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  /* ================= SFX ================= */

  var lastSwish = 0;

  var SFX = {
    ready: function () { return !!ctx && unlocked; },

    // big juicy pop for button taps (randomized pitch = livelier)
    pop: function (pitch) {
      if (!ensureCtx() || !unlocked) return;
      var t = ctx.currentTime;
      var f = (pitch || 1) * (420 + Math.random() * 120);
      osc('sine', f, t, 0.09, 0.5, f * 2.2);
      noise(t, 0.03, 0.12, 'highpass', 2500);
    },

    // soft brush sound while drawing (throttled)
    swish: function () {
      if (!ensureCtx() || !unlocked) return;
      var now = performance.now();
      if (now - lastSwish < 95) return;
      lastSwish = now;
      var t = ctx.currentTime;
      noise(t, 0.08, 0.045, 'bandpass', 900 + Math.random() * 700, 2400, 0.8);
    },

    // two-note blip for progress milestones
    tick: function () {
      if (!ensureCtx() || !unlocked) return;
      var t = ctx.currentTime;
      osc('sine', 880, t, 0.09, 0.35);
      osc('sine', 1318, t + 0.09, 0.12, 0.35);
    },

    // bell for milestones
    bell: function () {
      if (!ensureCtx() || !unlocked) return;
      var t = ctx.currentTime;
      osc('sine', 1568, t, 0.5, 0.28);
      osc('sine', 2349, t, 0.35, 0.12);
      osc('sine', 3136, t, 0.22, 0.06);
    },

    // sparkle arpeggio (color pick / hint)
    sparkle: function () {
      if (!ensureCtx() || !unlocked) return;
      var t = ctx.currentTime;
      var notes = [1046, 1318, 1568, 2093];
      for (var i = 0; i < notes.length; i++) {
        osc('triangle', notes[i], t + i * 0.045, 0.14, 0.22);
      }
    },

    // screen transition whoosh
    whoosh: function () {
      if (!ensureCtx() || !unlocked) return;
      var t = ctx.currentTime;
      noise(t, 0.28, 0.16, 'bandpass', 300, 2200, 0.7);
    },

    // completion fanfare: rising arpeggio + chord + sparkle
    fanfare: function () {
      if (!ensureCtx() || !unlocked) return;
      var t = ctx.currentTime + 0.02;
      var seq = [523.25, 659.25, 783.99, 1046.5];
      for (var i = 0; i < seq.length; i++) {
        osc('triangle', seq[i], t + i * 0.11, 0.22, 0.4);
        osc('square', seq[i] / 2, t + i * 0.11, 0.18, 0.07);
      }
      // final chord
      osc('triangle', 1046.5, t + 0.46, 0.65, 0.34);
      osc('triangle', 1318.5, t + 0.46, 0.65, 0.26);
      osc('triangle', 1568.0, t + 0.46, 0.65, 0.22);
      osc('sine', 523.25, t + 0.46, 0.7, 0.25);
      // glitter
      for (var k = 0; k < 6; k++) {
        osc('sine', 1800 + Math.random() * 1600, t + 0.5 + k * 0.07, 0.1, 0.08);
      }
    },

    // color pick pop with per-color pitch
    colorPop: function (index) {
      SFX.pop(0.8 + index * 0.09);
    }
  };

  /* ================= Background music ================= */

  var musicOn = (function () {
    try { return localStorage.getItem('dl_music') !== 'off'; } catch (e) { return true; }
  })();
  var musicTimer = null;
  var musicStep = 0;

  // gentle pentatonic (C major pent) loop — soft plucks over a bouncy bass
  var MELODY = [
    0, 4, 7, 4, 9, 4, 7, 4,
    0, 4, 7, 12, 9, 7, 4, 2,
    0, 4, 7, 4, 9, 12, 9, 7,
    4, 2, 0, 2, 4, 7, 4, 2
  ];
  var BASS = [0, -1, 7, -1, 5, -1, 7, -1]; // -1 = rest

  function noteFreq(semitonesFromC4) {
    return 261.63 * Math.pow(2, semitonesFromC4 / 12);
  }

  function scheduleMusicStep() {
    if (!ctx || !musicOn) return;
    var t = ctx.currentTime + 0.03;
    var m = MELODY[musicStep % MELODY.length];
    if (m !== null && Math.random() > 0.12) { // tiny humanization: occasional rest
      var f = noteFreq(m + 12); // lead an octave up
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(g); g.connect(musicGain);
      o.start(t); o.stop(t + 0.35);
    }
    if (musicStep % 4 === 0) {
      var b = BASS[(musicStep / 4) % BASS.length];
      if (b >= 0) {
        var ob = ctx.createOscillator();
        var gb = ctx.createGain();
        ob.type = 'sine';
        ob.frequency.value = noteFreq(b - 12);
        gb.gain.setValueAtTime(0.0001, t);
        gb.gain.exponentialRampToValueAtTime(0.22, t + 0.03);
        gb.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
        ob.connect(gb); gb.connect(musicGain);
        ob.start(t); ob.stop(t + 0.55);
      }
    }
    musicStep++;
  }

  function startMusic() {
    if (!ensureCtx() || musicTimer || !musicOn) return;
    musicGain.gain.cancelScheduledValues(ctx.currentTime);
    musicGain.gain.setTargetAtTime(0.34, ctx.currentTime, 0.6); // gentle fade in
    musicTimer = setInterval(scheduleMusicStep, 250); // 120bpm 8th notes
    scheduleMusicStep();
  }

  function stopMusic() {
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    if (ctx && musicGain) musicGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.3);
  }

  function applyMusicPreference() {
    if (musicOn) startMusic(); else stopMusic();
  }

  function setMusic(on) {
    musicOn = on;
    try { localStorage.setItem('dl_music', on ? 'on' : 'off'); } catch (e) { /* noop */ }
    applyMusicPreference();
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { stopMusic(); }
    else if (unlocked) { applyMusicPreference(); }
  });

  /* ================= Voice overs ================= */

  var AUDIO_BASE = 'assets/audio/';
  var voiceCache = {};   // id -> {el, tried}
  var currentVoice = null;

  function clipPath(id) {
    var groups = { items: 1, praise: 1, colors: 1, ui: 1 };
    // ids are unique across groups, search manifest
    var clip = null;
    for (var i = 0; i < (window.VOICE_CLIPS || []).length; i++) {
      if (window.VOICE_CLIPS[i].id === id) { clip = window.VOICE_CLIPS[i]; break; }
    }
    return clip ? AUDIO_BASE + clip.file : null;
  }

  function clipText(id) {
    for (var i = 0; i < (window.VOICE_CLIPS || []).length; i++) {
      if (window.VOICE_CLIPS[i].id === id) return window.VOICE_CLIPS[i].text;
    }
    return '';
  }

  function getVoiceEl(id) {
    if (voiceCache[id]) return voiceCache[id].el;
    var path = clipPath(id);
    if (!path) return null;
    var el = new Audio();
    el.preload = 'auto';
    el.src = path + '.mp3';
    // fallback chain: mp3 -> wav -> speechSynthesis
    el.addEventListener('error', function () {
      if (!voiceCache[id]) return;
      if (!voiceCache[id].triedWav) {
        voiceCache[id].triedWav = true;
        el.src = path + '.wav';
        el.load();
      } else if (!voiceCache[id].triedTts) {
        voiceCache[id].triedTts = true;
        speakFallback(id);
      }
    });
    voiceCache[id] = { el: el };
    return el;
  }

  function speakFallback(id) {
    try {
      if (!window.speechSynthesis) return;
      var u = new SpeechSynthesisUtterance(clipText(id));
      u.rate = 0.95;
      u.pitch = 1.5;
      u.volume = 1;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch (e) { /* noop */ }
  }

  var Voice = {
    play: function (id, opts) {
      var el = getVoiceEl(id);
      if (!el) { speakFallback(id); return; }
      try {
        if (currentVoice && currentVoice !== el) { currentVoice.pause(); currentVoice.currentTime = 0; }
        currentVoice = el;
        el.currentTime = 0;
        var p = el.play();
        if (p && p.catch) p.catch(function () { /* retried on next gesture */ });
      } catch (e) { speakFallback(id); }
    },
    stop: function () {
      if (currentVoice) { try { currentVoice.pause(); } catch (e) {} }
      try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {}
    },
    preload: function (ids) {
      (ids || []).forEach(function (id) { getVoiceEl(id); });
    }
  };

  /* ================= exports ================= */

  window.SoundKit = {
    SFX: SFX,
    Voice: Voice,
    unlock: unlock,
    isMusicOn: function () { return musicOn; },
    setMusic: setMusic
  };

  // unlock audio on the very first interaction anywhere
  window.addEventListener('pointerdown', unlock, { capture: true, passive: true });
  window.addEventListener('touchstart', unlock, { capture: true, passive: true });
  window.addEventListener('keydown', unlock, { capture: true });
})();
