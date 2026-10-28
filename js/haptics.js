/*
 * Draw & Learn — haptics.js
 * Gentle phone vibrations (the "wiggle" toddlers love).
 * Uses navigator.vibrate under the hood — silent no-op on platforms
 * without it (iOS, desktop). Parents can turn the buzz off on the
 * home screen; the choice is remembered in localStorage.
 */
(function () {
  'use strict';

  var enabled = (function () {
    try { return localStorage.getItem('dl_haptics') !== 'off'; }
    catch (e) { return true; }
  })();

  function fire(pattern) {
    if (!enabled) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(pattern);
      }
    } catch (e) { /* some webviews throw when not permitted */ }
  }

  window.Hap = {
    supported: function () {
      return typeof navigator !== 'undefined' && !!navigator.vibrate;
    },
    isOn: function () { return enabled; },
    setOn: function (on) {
      enabled = !!on;
      try { localStorage.setItem('dl_haptics', enabled ? 'on' : 'off'); } catch (e) {}
      if (enabled) fire(25); // happy little confirmation buzz
    },
    tap: function () { fire(12); },                   // button taps
    stroke: function () { fire(8); },                 // finger down on the canvas
    star: function () { fire([16, 36, 16]); },        // star / milestone pop
    no: function () { fire([45, 70, 45]); },          // "not finished yet" shake
    win: function () { fire([40, 60, 40, 60, 110]); } // celebration fanfare
  };
})();
