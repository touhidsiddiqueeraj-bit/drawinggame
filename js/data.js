/*
 * Draw & Learn — data.js
 * Single source of truth for:
 *  - The 50 traceable glyphs (26 letters, 10 numbers, 14 shapes)
 *  - Brush color palette
 *  - Voice clip manifest (texts shared by the audio generator tools)
 *
 * Glyph coordinate space: 0..100 on both axes, y pointing DOWN (screen space).
 * Each glyph = array of strokes; each stroke = array of [x, y] points.
 */
(function () {
  'use strict';

  /* ---------- geometry helpers (all return arrays of [x,y]) ---------- */

  // Elliptical arc. Angles in degrees, y-down convention:
  // 0 = right, 90 = down, 180 = left, 270 = up. a1 may be < a0 (reverse sweep)
  // or a1 > a0 + 360 (full loop) — sampling is linear, so both work.
  function arc(cx, cy, rx, ry, a0, a1, n) {
    var pts = [];
    for (var i = 0; i <= n; i++) {
      var a = ((a0 + (a1 - a0) * i / n) * Math.PI) / 180;
      pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
    }
    return pts;
  }

  // Regular polygon with n vertices, first vertex at rot degrees.
  function polyPts(cx, cy, r, n, rot) {
    var pts = [];
    for (var i = 0; i < n; i++) {
      var a = ((rot + (360 / n) * i) * Math.PI) / 180;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    pts.push(pts[0].slice()); // close
    return pts;
  }

  // n-pointed star, first outer point at rot degrees.
  function starPts(cx, cy, rO, rI, n, rot) {
    var pts = [];
    for (var i = 0; i < n * 2; i++) {
      var r = (i % 2 === 0) ? rO : rI;
      var a = ((rot + (180 / n) * i) * Math.PI) / 180;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    pts.push(pts[0].slice()); // close
    return pts;
  }

  // Classic parametric heart, scaled to fit the 0..100 box.
  function heartPts(n) {
    var raw = [];
    for (var i = 0; i <= n; i++) {
      var t = (Math.PI * 2 * i) / n;
      var x = 16 * Math.pow(Math.sin(t), 3);
      var y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      raw.push([x, y]);
    }
    // fit bbox into [11, 89] x [12, 88]
    var minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    raw.forEach(function (p) {
      minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
      minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]);
    });
    var sx = 78 / (maxX - minX), sy = 76 / (maxY - minY);
    return raw.map(function (p) {
      return [11 + (p[0] - minX) * sx, 88 - (p[1] - minY) * sy];
    });
  }

  // Sun = circle + 8 rays (rays kept clear of the disc).
  function sunStrokes() {
    var s = [arc(50, 50, 24, 24, 270, 630, 40)];
    for (var k = 0; k < 8; k++) {
      var a = (k * 45 * Math.PI) / 180;
      s.push([
        [50 + 31 * Math.cos(a), 50 + 31 * Math.sin(a)],
        [50 + 46 * Math.cos(a), 50 + 46 * Math.sin(a)]
      ]);
    }
    return s;
  }

  /* ---------- palettes ---------- */

  var ITEM_COLORS = [
    '#FF5252', '#FF9800', '#F9A825', '#43A047', '#00ACC1', '#1E88E5',
    '#5E35B1', '#D81B60', '#00897B', '#6D4C41', '#F4511E', '#039BE5',
    '#8E24AA', '#C2185B'
  ];

  var BRUSH_COLORS = [
    { id: 'red',    name: 'Red',    hex: '#FF4753' },
    { id: 'orange', name: 'Orange', hex: '#FF9F1C' },
    { id: 'yellow', name: 'Yellow', hex: '#FFD32A' },
    { id: 'green',  name: 'Green',  hex: '#2ED573' },
    { id: 'blue',   name: 'Blue',   hex: '#3AA0FF' },
    { id: 'purple', name: 'Purple', hex: '#9C5CFF' },
    { id: 'pink',   name: 'Pink',   hex: '#FF7CE5' },
    { id: 'brown',  name: 'Brown',  hex: '#B26A45' },
    { id: 'black',  name: 'Black',  hex: '#3A3A3A' },
    { id: 'white',  name: 'White',  hex: '#FFFFFF' },
    { id: 'rainbow', name: 'Rainbow', hex: null } // special: hue-cycling brush
  ];

  /* ---------- letters ---------- */

  var LETTER_WORDS = {
    a: ['Apple', '\uD83C\uDF4E'],        b: ['Ball', '\u26BD'],
    c: ['Cat', '\uD83D\uDC31'],          d: ['Dog', '\uD83D\uDC15'],
    e: ['Elephant', '\uD83D\uDC18'],     f: ['Fish', '\uD83D\uDC20'],
    g: ['Grapes', '\uD83C\uDF47'],       h: ['Hat', '\uD83C\uDF62'],
    i: ['Ice cream', '\uD83C\uDF66'],    j: ['Juice', '\uD83E\uDDC3'],
    k: ['Kite', '\uD83E\uDE81'],         l: ['Lion', '\uD83E\uDD81'],
    m: ['Moon', '\uD83C\uDF19'],         n: ['Nest', '\uD83E\uDEBA'],
    o: ['Orange', '\uD83C\uDF4A'],       p: ['Panda', '\uD83D\uDC3C'],
    q: ['Queen', '\uD83D\uDC51'],        r: ['Rainbow', '\uD83C\uDF08'],
    s: ['Sun', '\u2600\uFE0F'],          t: ['Tiger', '\uD83D\uDC2F'],
    u: ['Umbrella', '\u2602\uFE0F'],     v: ['Van', '\uD83D\uDE90'],
    w: ['Watermelon', '\uD83C\uDF49'],   x: ['X-ray', '\uD83E\uDE7B'],
    y: ['Yo-yo', '\uD83E\uDE80'],        z: ['Zebra', '\uD83E\uDD93']
  };

  var LETTERS = {
    a: [[[16, 86], [50, 14], [84, 86]], [[30, 60], [70, 60]]],
    b: [[[22, 12], [22, 88]],
        [[22, 12], [60, 12], [74, 22], [74, 36], [60, 48], [22, 48]],
        [[22, 48], [64, 48], [79, 58], [79, 73], [64, 88], [22, 88]]],
    c: [arc(50, 50, 34, 38, 45, 315, 34)],
    d: [[[22, 12], [22, 88]],
        [[22, 12], [52, 12], [74, 26], [78, 42], [78, 58], [74, 74], [52, 88], [22, 88]]],
    e: [[[78, 12], [22, 12], [22, 88], [78, 88]], [[22, 50], [68, 50]]],
    f: [[[78, 12], [22, 12], [22, 88]], [[22, 50], [68, 50]]],
    g: [arc(50, 50, 34, 38, 45, 315, 34).concat([[74, 23], [74, 52], [50, 52]])],
    h: [[[22, 12], [22, 88]], [[78, 12], [78, 88]], [[22, 50], [78, 50]]],
    i: [[[32, 12], [68, 12]], [[50, 12], [50, 88]], [[32, 88], [68, 88]]],
    j: [[[66, 12], [66, 56]].concat(arc(50, 56, 16, 32, 0, 180, 24))],
    k: [[[22, 12], [22, 88]], [[76, 12], [22, 56]], [[38, 42], [78, 88]]],
    l: [[[24, 12], [24, 88], [78, 88]]],
    m: [[[16, 88], [16, 12], [50, 62], [84, 12], [84, 88]]],
    n: [[[20, 88], [20, 12], [80, 88], [80, 12]]],
    o: [arc(50, 50, 36, 38, 270, 630, 44)],
    p: [[[24, 12], [24, 88]],
        [[24, 12], [58, 12], [74, 24], [74, 38], [58, 50], [24, 50]]],
    q: [arc(50, 48, 36, 36, 270, 630, 44), [[60, 60], [84, 90]]],
    r: [[[24, 12], [24, 88]],
        [[24, 12], [58, 12], [74, 24], [74, 38], [58, 50], [24, 50]],
        [[42, 50], [78, 88]]],
    s: [[[70, 14], [52, 10], [36, 15], [28, 26], [32, 38], [46, 45], [62, 51],
         [72, 62], [73, 74], [63, 85], [46, 89], [29, 84]]],
    t: [[[22, 12], [78, 12]], [[50, 12], [50, 88]]],
    u: [[[20, 12], [20, 55]].concat(arc(50, 55, 30, 33, 180, 0, 32), [[80, 55], [80, 12]])],
    v: [[[16, 12], [50, 88], [84, 12]]],
    w: [[[12, 12], [32, 88], [50, 44], [68, 88], [88, 12]]],
    x: [[[20, 12], [80, 88]], [[80, 12], [20, 88]]],
    y: [[[18, 12], [50, 50], [82, 12]], [[50, 50], [50, 88]]],
    z: [[[20, 12], [80, 12], [20, 88], [80, 88]]]
  };

  /* ---------- numbers ---------- */

  var NUMBER_WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];

  var NUMBERS = {
    0: [arc(50, 50, 30, 38, 270, 630, 40)],
    1: [[[36, 26], [52, 12]], [[52, 12], [52, 88]], [[32, 88], [72, 88]]],
    2: [[[26, 26], [36, 14], [52, 10], [66, 14], [74, 26], [68, 40], [56, 52],
         [40, 64], [26, 78], [22, 88], [78, 88]]],
    3: [[[27, 18], [40, 10], [56, 11], [68, 18], [72, 30], [64, 42], [50, 47],
         [64, 53], [73, 64], [71, 78], [58, 87], [41, 86], [28, 78]]],
    4: [[[64, 10], [22, 56], [82, 56]], [[64, 10], [64, 88]]],
    5: [[[76, 12], [32, 12], [28, 40], [40, 34], [55, 33], [68, 40], [74, 54],
         [68, 70], [54, 80], [38, 78], [27, 70]]],
    6: [[[72, 16], [58, 9], [42, 16], [31, 32], [25, 52], [24, 68], [29, 81],
         [42, 88], [58, 85], [67, 74], [66, 60], [56, 52], [42, 51], [31, 57],
         [25, 66]]],
    7: [[[24, 12], [78, 12], [44, 88]]],
    8: [arc(50, 31, 25, 19, 270, 630, 36), arc(50, 69, 28, 20, 270, 630, 40)],
    9: [arc(50, 32, 26, 20, 270, 630, 36),
        [[75, 32], [75, 62], [64, 80], [48, 86], [35, 81]]]
  };

  /* ---------- shapes ---------- */

  var SHAPES = {
    circle:    { name: 'Circle',    emoji: '\u2B55', strokes: [arc(50, 50, 38, 38, 270, 630, 48)] },
    square:    { name: 'Square',    emoji: '\uD83D\uDD33', strokes: [[[20, 20], [80, 20], [80, 80], [20, 80], [20, 20]]] },
    triangle:  { name: 'Triangle',  emoji: '\uD83D\uDD3A', strokes: [[[50, 12], [88, 82], [12, 82], [50, 12]]] },
    star:      { name: 'Star',      emoji: '\u2B50', strokes: [starPts(50, 53, 38, 16, 5, -90)] },
    heart:     { name: 'Heart',     emoji: '\uD83D\uDC96', strokes: [heartPts(52)] },
    diamond:   { name: 'Diamond',   emoji: '\uD83D\uDC8E', strokes: [[[50, 10], [88, 50], [50, 90], [12, 50], [50, 10]]] },
    rectangle: { name: 'Rectangle', emoji: '\uD83C\uDF81', strokes: [[[12, 32], [88, 32], [88, 68], [12, 68], [12, 32]]] },
    oval:      { name: 'Oval',      emoji: '\uD83E\uDD5A', strokes: [arc(50, 50, 42, 26, 270, 630, 48)] },
    hexagon:   { name: 'Hexagon',   emoji: '\uD83C\uDF6F', strokes: [polyPts(50, 50, 38, 6, -90)] },
    pentagon:  { name: 'Pentagon',  emoji: '\uD83C\uDFE0', strokes: [polyPts(50, 53, 38, 5, -90)] },
    moon:      { name: 'Moon',      emoji: '\uD83C\uDF19', strokes: [arc(50, 50, 36, 36, 270, 90, 44).concat(arc(77, 50, 45, 45, 126.87, 233.13, 28))] },
    plus:      { name: 'Plus',      emoji: '\u2795', strokes: [[[50, 14], [50, 86]], [[14, 50], [86, 50]]] },
    arrow:     { name: 'Arrow',     emoji: '\u27A1\uFE0F', strokes: [[[12, 50], [74, 50]], [[56, 28], [78, 50], [56, 72]]] },
    sun:       { name: 'Sun',       emoji: '\u2600\uFE0F', strokes: sunStrokes() }
  };
  var SHAPE_ORDER = ['circle', 'square', 'triangle', 'star', 'heart', 'diamond',
                     'rectangle', 'oval', 'hexagon', 'pentagon', 'moon', 'plus', 'arrow', 'sun'];

  /* ---------- build glyph list ---------- */

  var GLYPHS = [];
  var LETTER_IDS = 'abcdefghijklmnopqrstuvwxyz'.split('');

  LETTER_IDS.forEach(function (id, i) {
    var upper = id.toUpperCase();
    var word = LETTER_WORDS[id];
    GLYPHS.push({
      id: id,
      cat: 'letters',
      name: upper,
      caption: word[0],
      emoji: word[1],
      color: ITEM_COLORS[i % ITEM_COLORS.length],
      say: upper + ' is for ' + word[0] + '! Can you draw the letter ' + upper + '?',
      strokes: LETTERS[id]
    });
  });

  NUMBER_WORDS.forEach(function (word, n) {
    GLYPHS.push({
      id: 'n' + n,
      cat: 'numbers',
      name: String(n),
      caption: word,
      emoji: String(n) + '\uFE0F\u20E3',
      color: ITEM_COLORS[n % ITEM_COLORS.length],
      say: word + '! Can you draw the number ' + word.toLowerCase() + '?',
      strokes: NUMBERS[n]
    });
  });

  SHAPE_ORDER.forEach(function (id, i) {
    var s = SHAPES[id];
    GLYPHS.push({
      id: id,
      cat: 'shapes',
      name: s.name,
      caption: s.name,
      emoji: s.emoji,
      color: ITEM_COLORS[(i + 4) % ITEM_COLORS.length],
      say: s.name + '! Can you draw a ' + s.name.toLowerCase() + '?',
      strokes: s.strokes
    });
  });

  /* ---------- voice clips (praise / colors / ui) ---------- */

  var PRAISE = [
    ['great-job', 'Great job!'],
    ['amazing', 'Amazing!'],
    ['wonderful', 'Wonderful!'],
    ['perfect', 'Perfect!'],
    ['you-did-it', 'You did it!'],
    ['super-star', 'Super star!'],
    ['fantastic', 'Fantastic!'],
    ['beautiful', 'So beautiful!']
  ];

  var UI_CLIPS = [
    ['welcome', 'Welcome to Draw and Learn! Tap a picture and let\u2019s play!'],
    ['lets-draw', 'Yay! Let\u2019s draw!'],
    ['tap-a-picture', 'Tap a picture to play!'],
    ['wow', 'Wow! So pretty!'],
    ['keep-going', 'Keep going! You can do it!'],
    ['almost-there', 'Almost there!']
  ];

  var VOICE_CLIPS = [];

  GLYPHS.forEach(function (g) {
    VOICE_CLIPS.push({ id: g.id, group: 'items', file: 'items/' + g.id, text: g.say });
  });
  PRAISE.forEach(function (p) {
    VOICE_CLIPS.push({ id: p[0], group: 'praise', file: 'praise/' + p[0], text: p[1] });
  });
  BRUSH_COLORS.forEach(function (c) {
    VOICE_CLIPS.push({ id: c.id, group: 'colors', file: 'colors/' + c.id,
      text: c.id === 'rainbow' ? 'Rainbow colors!' : c.name + '!' });
  });
  UI_CLIPS.forEach(function (u) {
    VOICE_CLIPS.push({ id: u[0], group: 'ui', file: 'ui/' + u[0], text: u[1] });
  });

  var CATEGORIES = [
    { id: 'shapes',  name: 'Shapes',  emoji: '\u2B50', color: '#FF9800', blurb: 'Stars, hearts & more' },
    { id: 'letters', name: 'Letters', emoji: '\uD83D\uDC24', color: '#43A047', blurb: 'A all the way to Z' },
    { id: 'numbers', name: 'Numbers', emoji: '\uD83D\uDD22', color: '#1E88E5', blurb: 'Zero to nine' }
  ];

  /* ---------- export ---------- */

  var root = (typeof window !== 'undefined') ? window : globalThis;
  root.GLYPHS = GLYPHS;
  root.BRUSH_COLORS = BRUSH_COLORS;
  root.CATEGORIES = CATEGORIES;
  root.VOICE_CLIPS = VOICE_CLIPS;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GLYPHS: GLYPHS, BRUSH_COLORS: BRUSH_COLORS, CATEGORIES: CATEGORIES, VOICE_CLIPS: VOICE_CLIPS };
  }
})();
