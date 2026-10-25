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

  /* ================= Animal sounds ================= */

  /*
   * Every animal gets a tiny signature sound, synthesized live with WebAudio
   * (same philosophy as the SFX — zero downloads, zero latency). Routing all
   * through sfxGain keeps them under the master volume.
   */

  function lfo(t0, dur, rate, depth, param) {
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = rate;
    g.gain.value = depth;
    o.connect(g);
    g.connect(param);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  // one rich note: osc -> filter -> gain env -> sfxGain
  function voice(t0, dur, type, f0, f1, vol, filter, fType) {
    var o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    var dest = sfxGain;
    if (filter) {
      var flt = ctx.createBiquadFilter();
      flt.type = fType || 'bandpass';
      flt.frequency.value = filter[0];
      flt.Q.value = filter[1] || 1;
      flt.connect(sfxGain);
      dest = flt;
    }
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.05, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(dest);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
    return g;
  }

  var ANIMAL_SFX = {
    // "meee-oww": pitch rises then falls through a sweeping formant
    meow: function (t) {
      var o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(330, t);
      o.frequency.exponentialRampToValueAtTime(640, t + 0.16);
      o.frequency.exponentialRampToValueAtTime(280, t + 0.55);
      var f = ctx.createBiquadFilter();
      f.type = 'bandpass'; f.Q.value = 2.2;
      f.frequency.setValueAtTime(950, t);
      f.frequency.exponentialRampToValueAtTime(1750, t + 0.16);
      f.frequency.exponentialRampToValueAtTime(720, t + 0.55);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.5, t + 0.07);
      g.gain.setValueAtTime(0.5, t + 0.32);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      o.connect(f); f.connect(g); g.connect(sfxGain);
      o.start(t); o.stop(t + 0.65);
    },

    // two sharp barks: saw pitch drop + throat noise
    woof: function (t) {
      [0, 0.24].forEach(function (dt, i) {
        var t0 = t + dt;
        voice(t0, 0.12, 'sawtooth', i ? 380 : 330, 100, 0.5, [900, 0.7], 'lowpass');
        noise(t0, 0.08, 0.16, 'lowpass', 750);
      });
    },

    // long low moo with vibrato
    moo: function (t) {
      var o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(138, t);
      o.frequency.exponentialRampToValueAtTime(92, t + 0.8);
      lfo(t, 0.85, 5.5, 6, o.frequency); // gentle vibrato
      var f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 460; f.Q.value = 0.8;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.42, t + 0.1);
      g.gain.setValueAtTime(0.42, t + 0.62);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      o.connect(f); f.connect(g); g.connect(sfxGain);
      o.start(t); o.stop(t + 0.95);
    },

    // bleating baa: strong tremolo = woolly "ba-a-a"
    baa: function (t) {
      var o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.value = 290;
      var trem = ctx.createGain();
      trem.gain.value = 0.22;
      var l = ctx.createOscillator();
      l.frequency.value = 8.5;
      var lg = ctx.createGain();
      lg.gain.value = 0.18;
      l.connect(lg); lg.connect(trem.gain);   // amplitude wobble
      var vib = ctx.createGain();
      vib.gain.value = 9;
      l.connect(vib); vib.connect(o.frequency); // pitch wobble
      var f = ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 880; f.Q.value = 1.2;
      var env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(1, t + 0.04);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
      o.connect(f); f.connect(env); env.connect(trem); trem.connect(sfxGain);
      o.start(t); o.stop(t + 0.6);
      l.start(t); l.stop(t + 0.6);
    },

    // quack-quack: nasal buzzy quack, twice
    quack: function (t) {
      [0, 0.22].forEach(function (dt) {
        var t0 = t + dt;
        voice(t0, 0.15, 'sawtooth', 470, 290, 0.42, [1150, 3.5]);
        voice(t0, 0.13, 'square', 235, 150, 0.1, [600, 1]);
      });
    },

    // cheep-cheep-cheep: tiny high chirps
    cheep: function (t) {
      [0, 0.13, 0.26].forEach(function (dt, i) {
        voice(t + dt, 0.07, 'sine', 2700 - i * 120, 2100, 0.26);
        voice(t + dt, 0.05, 'sine', 5400 - i * 240, 4200, 0.07);
      });
    },

    // blub-blub: underwater bubbles
    blub: function (t) {
      [0, 0.16].forEach(function (dt, i) {
        voice(t + dt, 0.13, 'sine', 230 - i * 40, 85, 0.4);
        noise(t + dt, 0.1, 0.1, 'lowpass', 260);
      });
    },

    // buzzy bee: two detuned saws with a fast tremolo
    buzz: function (t) {
      var env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(0.3, t + 0.06);
      env.gain.setValueAtTime(0.3, t + 0.55);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.78);
      var trem = ctx.createGain();
      trem.gain.value = 0.55;
      var l = ctx.createOscillator();
      l.frequency.value = 23;
      var lg = ctx.createGain();
      lg.gain.value = 0.4;
      l.connect(lg); lg.connect(trem.gain);
      var f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 780;
      [165, 169.5].forEach(function (fr) {
        var o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = fr;
        o.connect(f);
        o.start(t); o.stop(t + 0.8);
      });
      f.connect(trem); trem.connect(env); env.connect(sfxGain);
      l.start(t); l.stop(t + 0.8);
    },

    // butterfly wings: soft flutters of air
    flutter: function (t) {
      for (var i = 0; i < 5; i++) {
        noise(t + i * 0.11, 0.07, i % 2 ? 0.13 : 0.2, 'bandpass', 1750, 900, 1.4);
      }
    },

    // hoo-hooo: two soft owl notes
    hoot: function (t) {
      voice(t, 0.26, 'sine', 400, 372, 0.32);
      voice(t, 0.26, 'sine', 800, 744, 0.05);
      voice(t + 0.4, 0.5, 'sine', 385, 340, 0.34);
      voice(t + 0.4, 0.5, 'sine', 770, 680, 0.05);
    },

    // boing: springy bounce with decaying hops
    boing: function (t) {
      [0, 0.13, 0.24].forEach(function (dt, i) {
        var v = [0.42, 0.26, 0.15][i];
        voice(t + dt, 0.16 - i * 0.03, 'triangle', 560 - i * 60, 175, v);
      });
    },

    /* ---- new animals (v1.2.0) ---- */

    // lion: low raspy roar — saw glide down + growl wobble + breath
    roar: function (t) {
      var o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(115, t);
      o.frequency.exponentialRampToValueAtTime(70, t + 0.75);
      lfo(t, 0.8, 21, 14, o.frequency);
      var f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 650; f.Q.value = 1.1;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.5, t + 0.12);
      g.gain.setValueAtTime(0.5, t + 0.55);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
      o.connect(f); f.connect(g); g.connect(sfxGain);
      o.start(t); o.stop(t + 0.85);
      noise(t + 0.05, 0.6, 0.09, 'bandpass', 300, 200, 0.8);
    },

    // elephant: brassy trumpet — rising square with vibrato
    trumpet: function (t) {
      var o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.setValueAtTime(210, t);
      o.frequency.exponentialRampToValueAtTime(392, t + 0.28);
      o.frequency.setValueAtTime(392, t + 0.5);
      o.frequency.exponentialRampToValueAtTime(300, t + 0.75);
      lfo(t, 0.78, 7, 9, o.frequency);
      var f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 1400; f.Q.value = 2;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.38, t + 0.06);
      g.gain.setValueAtTime(0.38, t + 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.78);
      o.connect(f); f.connect(g); g.connect(sfxGain);
      o.start(t); o.stop(t + 0.82);
    },

    // monkey: two quick "oo-oo" pitch hops
    chatter: function (t) {
      [0, 0.17].forEach(function (dt) {
        voice(t + dt, 0.11, 'sine', 430, 610, 0.4);
        voice(t + dt, 0.11, 'triangle', 860, 1220, 0.12);
      });
      voice(t + 0.36, 0.16, 'sine', 520, 380, 0.36);
    },

    // penguin: goose-style braying honk (two nasal notes)
    honk: function (t) {
      [0, 0.28].forEach(function (dt, i) {
        voice(t + dt, 0.2, 'square', i ? 250 : 300, i ? 235 : 285, 0.3, [1100, 1.6], 'bandpass');
        noise(t + dt, 0.06, 0.05, 'bandpass', 1600, 1200, 1.5);
      });
    },

    // frog: two croaks — pulsed low saw gliss
    ribbit: function (t) {
      [0, 0.3].forEach(function (dt) {
        var o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(150, t + dt);
        o.frequency.exponentialRampToValueAtTime(95, t + dt + 0.2);
        var g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t + dt);
        g.gain.exponentialRampToValueAtTime(0.4, t + dt + 0.04);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.22);
        var f = ctx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = 500;
        o.connect(f); f.connect(g); g.connect(sfxGain);
        o.start(t + dt); o.stop(t + dt + 0.25);
      });
    },

    // turtle: two slow, deep chomps
    chomp: function (t) {
      [0, 0.4].forEach(function (dt) {
        voice(t + dt, 0.13, 'sine', 120, 62, 0.5);
        noise(t + dt, 0.07, 0.1, 'lowpass', 400, 200);
      });
    },

    // snail: bubbly squelch — slippery gliss with pops
    squelch: function (t) {
      voice(t, 0.5, 'sine', 160, 420, 0.3, [700, 2], 'bandpass');
      voice(t + 0.1, 0.4, 'triangle', 300, 130, 0.14);
      [0.22, 0.34, 0.48].forEach(function (dt, i) {
        osc('sine', 500 + i * 190, t + dt, 0.05, 0.16);
      });
    },

    // ladybug: delicate high chimes
    tinkle: function (t) {
      [1046, 1318, 1568, 2093].forEach(function (fr, i) {
        osc('sine', fr, t + i * 0.09, 0.22, 0.18);
        osc('sine', fr * 1.5, t + i * 0.09, 0.1, 0.05);
      });
    },

    // bear: slow low growl with throat wobble
    growl: function (t) {
      var o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(85, t);
      o.frequency.exponentialRampToValueAtTime(62, t + 0.85);
      lfo(t, 0.9, 16, 10, o.frequency);
      var f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 420; f.Q.value = 1.4;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.42, t + 0.15);
      g.gain.setValueAtTime(0.42, t + 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      o.connect(f); f.connect(g); g.connect(sfxGain);
      o.start(t); o.stop(t + 0.95);
    },

    // mouse: two tiny high squeaks
    squeak: function (t) {
      [0, 0.16].forEach(function (dt, i) {
        voice(t + dt, 0.1, 'sine', 1750 + i * 250, 2450 + i * 250, 0.22);
      });
    },

    /* ---- objects (v1.2.0) ---- */

    // ball: three bounces, each lower and quieter
    bounce: function (t) {
      [0, 0.26, 0.46].forEach(function (dt, i) {
        var v = [0.4, 0.28, 0.16][i];
        voice(t + dt, 0.13, 'sine', 330 - i * 55, 150 - i * 25, v);
        noise(t + dt, 0.03, 0.07, 'lowpass', 900, 500);
      });
    },

    // house: knock knock
    knock: function (t) {
      [0, 0.22].forEach(function (dt) {
        voice(t + dt, 0.07, 'triangle', 195, 140, 0.5);
        noise(t + dt, 0.05, 0.2, 'bandpass', 850, 500, 1.2);
      });
    },

    // tree: leaves rustling in the breeze
    rustle: function (t) {
      noise(t, 0.35, 0.16, 'bandpass', 2400, 1500, 0.7);
      noise(t + 0.24, 0.4, 0.19, 'bandpass', 2000, 2800, 0.7);
    },

    // flower: twinkly shimmer
    twinkle: function (t) {
      var notes = [1318, 1568, 2093, 2637];
      notes.forEach(function (fr, i) {
        osc('sine', fr, t + i * 0.06, 0.3, 0.14);
      });
    },

    // car: engine vroom — low saw revving up and settling
    vroom: function (t) {
      var o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(65, t);
      o.frequency.exponentialRampToValueAtTime(155, t + 0.45);
      o.frequency.setValueAtTime(155, t + 0.6);
      o.frequency.exponentialRampToValueAtTime(110, t + 0.95);
      var f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 520; f.Q.value = 1.2;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.42, t + 0.1);
      g.gain.setValueAtTime(0.42, t + 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1);
      o.connect(f); f.connect(g); g.connect(sfxGain);
      o.start(t); o.stop(t + 1.05);
      noise(t, 0.9, 0.06, 'lowpass', 400, 700);
    },

    // boat: two soft steam-whistle toots
    toot: function (t) {
      voice(t, 0.24, 'square', 233, 226, 0.24, [900, 1.2], 'lowpass');
      voice(t, 0.24, 'triangle', 466, 452, 0.1);
      voice(t + 0.36, 0.34, 'square', 196, 190, 0.26, [760, 1.2], 'lowpass');
      voice(t + 0.36, 0.34, 'triangle', 392, 380, 0.1);
    },

    // rocket: blast-off — noise swell + rising pitch
    blast: function (t) {
      noise(t, 0.9, 0.22, 'bandpass', 250, 1800, 0.6);
      voice(t, 0.85, 'sawtooth', 90, 400, 0.2, [700, 1], 'lowpass');
      voice(t + 0.5, 0.5, 'triangle', 500, 700, 0.12);
    },

    // kite: wind whistling past
    wind: function (t) {
      noise(t, 0.4, 0.18, 'bandpass', 700, 1400, 1.8);
      noise(t + 0.2, 0.45, 0.2, 'bandpass', 1400, 600, 1.8);
      osc('sine', 900, t + 0.15, 0.3, 0.05, 1250);
    },

    // balloon: squeaky rub then a pop
    pop: function (t) {
      voice(t, 0.3, 'sine', 500, 1100, 0.14);
      voice(t + 0.02, 0.28, 'triangle', 505, 1150, 0.06);
      noise(t + 0.34, 0.06, 0.5, 'lowpass', 3000, 800);
      osc('sine', 240, t + 0.34, 0.1, 0.3, 90);
    },

    // ice cream: long slurp with a happy finish
    slurp: function (t) {
      voice(t, 0.55, 'sawtooth', 190, 480, 0.2, [900, 2.5], 'bandpass');
      [0.18, 0.32, 0.46].forEach(function (dt, i) {
        noise(t + dt, 0.05, 0.08, 'bandpass', 1200 + i * 300, 900, 2);
      });
      voice(t + 0.6, 0.14, 'sine', 520, 780, 0.2);
    },

    // umbrella: light rain patter
    rain: function (t) {
      for (var i = 0; i < 9; i++) {
        noise(t + i * 0.09 + (i % 3) * 0.02, 0.04, 0.11, 'bandpass',
          2600 + (i % 4) * 500, 1800, 3);
      }
      noise(t, 0.85, 0.045, 'highpass', 5000, 6000);
    },

    // apple: two crunchy bites
    crunch: function (t) {
      [0, 0.3].forEach(function (dt) {
        noise(t + dt, 0.09, 0.34, 'bandpass', 2000, 700, 0.9);
        noise(t + dt + 0.04, 0.06, 0.22, 'bandpass', 1400, 500, 1);
      });
    },

    // banana: soft low splat
    splat: function (t) {
      voice(t, 0.14, 'sine', 170, 65, 0.4);
      noise(t, 0.12, 0.2, 'lowpass', 900, 300);
      noise(t + 0.05, 0.09, 0.12, 'bandpass', 500, 250, 1);
    },

    // cake: party horn — two cheery notes
    party: function (t) {
      voice(t, 0.18, 'square', 392, 396, 0.22, [1000, 1.5], 'lowpass');
      voice(t + 0.2, 0.32, 'square', 523, 530, 0.24, [1100, 1.5], 'lowpass');
      voice(t + 0.2, 0.3, 'triangle', 1046, 1060, 0.08);
    },

    // cup: water glug-glugging
    glug: function (t) {
      [0, 0.18, 0.33].forEach(function (dt, i) {
        voice(t + dt, 0.1, 'sine', 420 - i * 70, 190 - i * 35, 0.32);
        noise(t + dt, 0.05, 0.06, 'lowpass', 700, 400);
      });
    },

    // pencil: scratchy scribbles
    scribble: function (t) {
      [0, 0.16, 0.32].forEach(function (dt, i) {
        noise(t + dt, 0.11, 0.16, 'bandpass', 2200 - i * 250, 2600 - i * 200, 2.2);
      });
    }
  };

  var Animal = {
    play: function (name) {
      if (!ensureCtx() || !unlocked) return;
      var fn = ANIMAL_SFX[name];
      if (fn) { try { fn(ctx.currentTime + 0.02); } catch (e) { /* noop */ } }
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
    Animal: Animal,
    unlock: unlock,
    isMusicOn: function () { return musicOn; },
    setMusic: setMusic
  };

  // unlock audio on the very first interaction anywhere
  window.addEventListener('pointerdown', unlock, { capture: true, passive: true });
  window.addEventListener('touchstart', unlock, { capture: true, passive: true });
  window.addEventListener('keydown', unlock, { capture: true });
})();
