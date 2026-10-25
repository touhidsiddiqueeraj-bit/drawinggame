/*
 * Draw & Learn — data.js
 * Single source of truth for:
 *  - The 113 traceable glyphs (26 big + 26 small letters, 10 numbers,
 *    14 shapes, 21 animals, 16 objects)
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
    // "magic C" letters (c, g, o, q, 0) sweep COUNTERclockwise from the
    // top-right — the handwriting direction toddlers are taught.
    c: [arc(50, 50, 34, 38, 315, 35, 34)],
    d: [[[22, 12], [22, 88]],
        [[22, 12], [52, 12], [74, 26], [78, 42], [78, 58], [74, 74], [52, 88], [22, 88]]],
    e: [[[78, 12], [22, 12], [22, 88], [78, 88]], [[22, 50], [68, 50]]],
    f: [[[78, 12], [22, 12], [22, 88]], [[22, 50], [68, 50]]],
    g: [arc(50, 50, 34, 38, 320, 14, 46).concat([[50, 58]])],
    h: [[[22, 12], [22, 88]], [[78, 12], [78, 88]], [[22, 50], [78, 50]]],
    i: [[[32, 12], [68, 12]], [[50, 12], [50, 88]], [[32, 88], [68, 88]]],
    j: [[[66, 12], [66, 56]].concat(arc(50, 56, 16, 32, 0, 180, 24))],
    k: [[[22, 12], [22, 88]], [[76, 12], [22, 56]], [[38, 42], [78, 88]]],
    l: [[[24, 12], [24, 88], [78, 88]]],
    m: [[[16, 88], [16, 12], [50, 62], [84, 12], [84, 88]]],
    n: [[[20, 88], [20, 12], [80, 88], [80, 12]]],
    o: [arc(50, 50, 36, 38, 270, -90, 44)],
    p: [[[24, 12], [24, 88]],
        [[24, 12], [58, 12], [74, 24], [74, 38], [58, 50], [24, 50]]],
    q: [arc(50, 48, 36, 36, 270, -90, 44), [[60, 60], [84, 90]]],
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

  /* ---------- small letters ---------- */

  // Lowercase design rules (toddler handwriting style):
  //   x-height band y = 46..86  (small letters live here)
  //   ascenders reach up to y = 14, descenders drop to y ~ 96
  //   same stroke directions as the capitals: stems go top -> bottom,
  //   "magic c" bowls (a c d g o q) sweep counterclockwise from the top.
  var LOWERCASE = {
    a: [arc(56, 66, 18, 20, 270, -90, 36), [[74, 46], [74, 86]]],
    b: [[[28, 14], [28, 86]], arc(28, 66, 26, 20, -90, 90, 32)],
    c: [arc(52, 66, 24, 21, 315, 45, 30)],
    d: [[[74, 14], [74, 86]], arc(74, 66, 26, 20, 270, 90, 32)],
    e: [arc(50, 66, 20, 20, 349, 22, 60), [[31, 62], [70, 62]]],
    f: [arc(48, 27, 15, 10, 180, 268, 16), [[50, 15], [50, 86]], [[33, 51], [67, 51]]],
    g: [arc(50, 66, 21, 20, 270, -90, 40),
        arc(52, 71, 22, 25, -43, 120, 34)],
    h: [[[28, 14], [28, 86]], arc(51, 56, 23, 10, 180, 360, 24).concat([[74, 86]])],
    i: [[[50, 46], [50, 86]], [[50, 27], [50, 32]]],
    j: [[[62, 46], [62, 76]].concat(arc(50, 80, 12, 12, 0, 150, 16)), [[62, 27], [62, 32]]],
    k: [[[28, 14], [28, 86]], [[74, 46], [28, 68]], [[40, 58], [74, 86]]],
    l: [[[50, 14], [50, 86]]],
    m: [[[26, 46], [26, 86]],
        arc(39, 56, 13, 10, 180, 360, 16).concat([[52, 86]]),
        arc(65, 56, 13, 10, 180, 360, 16).concat([[78, 86]])],
    n: [[[28, 46], [28, 86]], arc(51, 56, 23, 10, 180, 360, 24).concat([[74, 86]])],
    o: [arc(52, 66, 24, 21, 270, -90, 40)],
    p: [[[30, 46], [30, 96]], arc(30, 66, 26, 20, -90, 90, 32)],
    q: [arc(48, 66, 22, 20, 270, -90, 38), [[69, 60], [69, 91], [76, 96]]],
    r: [[[30, 46], [30, 86]], [[30, 62], [44, 50], [56, 45]]],
    s: [[[69, 50], [54, 46], [42, 49], [36, 57], [40, 64], [52, 68],
         [63, 72], [69, 80], [64, 88], [50, 90], [38, 87]]],
    t: [[[50, 28], [50, 74], [62, 84]], [[33, 52], [67, 52]]],
    u: [[[28, 46], [28, 60]].concat(arc(50, 60, 22, 26, 180, 0, 26), [[72, 60], [72, 46]])],
    v: [[[26, 46], [50, 86], [74, 46]]],
    w: [[[18, 46], [34, 86], [50, 52], [66, 86], [82, 46]]],
    x: [[[28, 46], [72, 86]], [[72, 46], [28, 86]]],
    y: [[[28, 46], [52, 86]], [[74, 46], [52, 86]], [[52, 86], [46, 90], [40, 96]]],
    z: [[[30, 46], [72, 46], [30, 86], [72, 86]]]
  };

  /* ---------- numbers ---------- */

  var NUMBER_WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];

  var NUMBERS = {
    0: [arc(50, 50, 30, 38, 270, -90, 40)],
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

  /* ---------- animals ---------- */

  // Fluffy wool cloud for the sheep: a circle whose radius wobbles gently,
  // traced counterclockwise (top -> left -> bottom -> right) like the O.
  // Optional a0/a1 (degrees, y-up param space) clip the cloud to an open arc —
  // the sheep's wool skips the bottom-center so it never cuts across the face.
  function cloudPts(cx, cy, rx, ry, bumps, amp, a0, a1) {
    if (typeof a0 !== 'number') { a0 = 0; a1 = 360; }
    var pts = [];
    for (var i = 0; i <= 96; i++) {
      var t = ((a0 + (a1 - a0) * i / 96) * Math.PI) / 180;
      var w = 1 + amp * Math.sin(bumps * t);
      pts.push([cx + rx * w * Math.cos(t), cy - ry * w * Math.sin(t)]);
    }
    return pts;
  }

  // Egg outline (narrow at the top, wider at the bottom — chibi critter head).
  // Same angle convention as arc(); rx interpolates rxTop→rxBottom.
  function eggPts(cx, cy, rxTop, rxBottom, ry, a0, a1, n) {
    var pts = [];
    for (var i = 0; i <= n; i++) {
      var t = ((a0 + (a1 - a0) * i / n) * Math.PI) / 180;
      var rx = rxBottom + (rxTop - rxBottom) * (1 - Math.sin(t)) / 2;
      pts.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]);
    }
    return pts;
  }

  // Snail shell: an inward spiral (radius eases r0 -> r1 over `turns` turns).
  function spiralPts(cx, cy, r0, r1, turns, n) {
    var pts = [];
    for (var i = 0; i <= n; i++) {
      var t = 2 * Math.PI * turns * i / n;
      var r = r0 + (r1 - r0) * (i / n);
      pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]);
    }
    return pts;
  }

  // Each animal: traceable outline strokes + its very own sound (see audio.js)
  // PLUS the things that make a critter readable BEFORE it is traced:
  //   fill — soft pre-applied color regions: [{ c: '#hex', p: [closed pts], a: alpha }]
  //   eyes — decorative (non-traceable) eyes: [x, y, radius] or [x, y, radius, 'w']
  //          ('w' = white sclera + pupil, for dark faces)
  //   mouth — decorative smile: [cx, cy, halfWidth, depth, 'arc'|'cat']
  //          ('arc' = single smile curve, 'cat' = classic ω double bump)
  //   decor — thin decorative lines (NOT traced, drawn over the fills):
  //          [{ p: points, c: '#hex', w: width-in-glyph-units }]
  //   color — the road/card color, tuned to the animal's natural hue.
  var DUCK_BODY = [[48, 40], [58, 44], [68, 49], [79, 44], [75, 58], [68, 66],
                   [56, 72], [42, 72], [30, 66], [23, 56], [22, 46], [30, 39], [42, 36]];

  var ANIMALS = [
    { id: 'cat', name: 'Cat', emoji: '\uD83D\uDC31', sound: 'meow', color: '#FB8C00',
      say: 'A cat! Can you draw the cat?',
      fill: [{ c: '#FFC66E', p: arc(50, 58, 30, 28, 270, 630, 40) },
             { c: '#F06292', a: 0.8, p: [[46.5, 58], [53.5, 58], [50, 63]] },
             { c: '#FF9E80', a: 0.35, p: arc(33, 60, 4.5, 3, 270, 630, 16) },
             { c: '#FF9E80', a: 0.35, p: arc(67, 60, 4.5, 3, 270, 630, 16) }],
      eyes: [[41, 52, 3.4], [59, 52, 3.4]],
      mouth: [50, 65, 5.5, 4.5, 'cat'],
      strokes: [arc(50, 58, 30, 28, 270, -90, 40),
                [[29, 40], [21, 14], [41, 33]],
                [[71, 40], [79, 14], [59, 33]]] },
    { id: 'dog', name: 'Dog', emoji: '\uD83D\uDC36', sound: 'woof', color: '#8D6E63',
      say: 'A dog! Can you draw the dog?',
      fill: [{ c: '#E3B47E', p: arc(50, 55, 30, 27, 270, 630, 40) },
             { c: '#F5DDB8', p: arc(50, 70, 13, 10, 270, 630, 26) },
             { c: '#4E342E', a: 0.5, p: arc(50, 67, 4, 3, 270, 630, 16) }],
      eyes: [[42, 48, 3.2], [58, 48, 3.2]],
      strokes: [arc(50, 55, 30, 27, 270, -90, 40),
                [[37, 30], [14, 34], [9, 58], [19, 73]],
                [[63, 30], [86, 34], [91, 58], [81, 73]],
                arc(50, 70, 13, 10, 270, -90, 26)] },
    { id: 'rabbit', name: 'Rabbit', emoji: '\uD83D\uDC30', sound: 'boing', color: '#EC7FA9',
      say: 'A rabbit! Can you draw the rabbit?',
      fill: [{ c: '#FCE4EC', p: arc(50, 70, 24, 19, 270, 630, 36) },
             { c: '#FFC1D8', a: 0.4, p: arc(38, 34, 4, 14, 270, 630, 20) },
             { c: '#FFC1D8', a: 0.4, p: arc(62, 34, 4, 14, 270, 630, 20) },
             { c: '#F06292', a: 0.8, p: [[46.5, 67], [53.5, 67], [50, 72]] },
             { c: '#F8BBD0', a: 0.45, p: arc(37, 72, 4, 3, 270, 630, 14) },
             { c: '#F8BBD0', a: 0.45, p: arc(63, 72, 4, 3, 270, 630, 14) }],
      eyes: [[43, 64, 3.2], [57, 64, 3.2]],
      mouth: [50, 76, 5, 3.5, 'arc'],
      strokes: [arc(38, 34, 8, 20, 270, -90, 28),
                arc(62, 34, 8, 20, 270, -90, 28),
                arc(50, 70, 24, 19, 270, -90, 36)] },
    { id: 'duck', name: 'Duck', emoji: '\uD83E\uDD86', sound: 'quack', color: '#FFB300',
      say: 'A duck! Can you draw the duck?',
      fill: [{ c: '#FFE66D', p: arc(36, 30, 15, 14, 270, 630, 32) },
             { c: '#FFE66D', p: DUCK_BODY },
             { c: '#FF9F43', a: 0.45, p: [[22, 28], [8, 32], [22, 36]] }],
      eyes: [[30, 26, 2.6]],
      strokes: [arc(36, 30, 15, 14, 270, -90, 32),
                DUCK_BODY.slice(),
                [[22, 28], [8, 32], [22, 36]]] },
    { id: 'chick', name: 'Chick', emoji: '\uD83D\uDC24', sound: 'cheep', color: '#F57F17',
      say: 'A little chick! Can you draw the chick?',
      fill: [{ c: '#FFD93B', a: 0.5, p: arc(50, 54, 26, 24, 270, 630, 40) },
             { c: '#FFA000', a: 0.85, p: [[45, 53], [50, 48], [55, 53], [50, 58]] },
             { c: '#FFAB40', a: 0.35, p: arc(34, 51, 3.5, 2.8, 270, 630, 14) },
             { c: '#FFAB40', a: 0.35, p: arc(66, 51, 3.5, 2.8, 270, 630, 14) }],
      eyes: [[41, 46, 3.2], [59, 46, 3.2]],
      strokes: [arc(50, 54, 26, 24, 270, -90, 40),
                [[45, 53], [50, 48], [55, 53], [50, 58], [45, 53]],
                [[44, 31], [40, 22]],
                [[56, 31], [60, 22]],
                arc(41, 63, 11, 9, 120, 240, 14),
                arc(59, 63, 11, 9, -60, 60, 14),
                [[42, 78], [37, 93]],
                [[56, 78], [61, 93]]] },
    { id: 'cow', name: 'Cow', emoji: '\uD83D\uDC2E', sound: 'moo', color: '#6D4C41',
      say: 'A cow! Can you draw the cow?',
      fill: [{ c: '#FDF3E7', p: arc(50, 56, 38, 24, 270, 630, 44) },
             { c: '#FFD9E0', p: arc(50, 68, 20, 10, 270, 630, 28) },
             { c: '#4E342E', a: 0.45, p: arc(42, 68, 2.2, 1.7, 270, 630, 12) },
             { c: '#4E342E', a: 0.45, p: arc(58, 68, 2.2, 1.7, 270, 630, 12) },
             { c: '#6D4C41', a: 0.38, p: cloudPts(26, 54, 5.5, 4, 5, 0.22) },
             { c: '#6D4C41', a: 0.38, p: cloudPts(75, 60, 4.5, 3.5, 4, 0.28) }],
      eyes: [[40, 49, 3.2], [60, 49, 3.2]],
      strokes: [arc(50, 56, 38, 24, 270, -90, 44),
                [[37, 33], [29, 19], [44, 29]],
                [[63, 33], [71, 19], [56, 29]],
                [[19, 42], [10, 44], [5, 50], [12, 56]],
                [[81, 42], [90, 44], [95, 50], [88, 56]],
                arc(50, 68, 20, 10, 270, -90, 28)] },
    { id: 'sheep', name: 'Sheep', emoji: '\uD83D\uDC11', sound: 'baa', color: '#8D6E63',
      say: 'A sheep! Can you draw the sheep?',
      // Chibi head-only sheep (classic clipart look): big soft face, woolly
      // "hat" cloud with a scalloped brim, leaf ears, ω nose marks.
      fill: [{ c: '#FBF3E3', a: 0.95, p: eggPts(50, 58, 19, 27, 31, 270, 630, 44) },
             { c: '#EFE5D0', a: 0.92, p: cloudPts(50, 25, 26, 15, 7, 0.11) },
             { c: '#F8BBD0', a: 0.6, p: arc(17, 60, 4.5, 5, 270, 630, 16) },
             { c: '#F8BBD0', a: 0.6, p: arc(83, 60, 4.5, 5, 270, 630, 16) },
             { c: '#F48FB1', a: 0.4, p: arc(36, 61, 4, 3, 270, 630, 14) },
             { c: '#F48FB1', a: 0.4, p: arc(64, 61, 4, 3, 270, 630, 14) }],
      eyes: [[42, 51, 3.4], [58, 51, 3.4]],
      mouth: [50, 65, 5.5, 4, 'cat'],
      strokes: [cloudPts(50, 25, 26, 15, 7, 0.11, 0, 360),
                eggPts(50, 58, 19, 27, 31, 180, 0, 30),
                [[26, 53], [18, 52], [10, 55], [7, 60], [10, 65], [18, 68], [26, 68]],
                [[74, 53], [82, 52], [90, 55], [93, 60], [90, 65], [82, 68], [74, 68]]] },
    { id: 'fish', name: 'Fish', emoji: '\uD83D\uDC1F', sound: 'blub', color: '#FF7043',
      say: 'A fish! Can you draw the fish?',
      fill: [{ c: '#FFAB91', p: arc(44, 50, 30, 21, 270, 630, 44) },
             { c: '#FFAB91', p: [[74, 50], [88, 34], [82, 50], [88, 66]] }],
      eyes: [[30, 46, 3]],
      strokes: [arc(44, 50, 30, 21, 180, 0, 26).concat(arc(44, 50, 30, 21, 360, 180, 26)),
                [[74, 50], [88, 34], [82, 50], [88, 66], [74, 50]]] },
    { id: 'bee', name: 'Bee', emoji: '\uD83D\uDC1D', sound: 'buzz', color: '#FFA000',
      say: 'A buzzy bee! Can you draw the bee?',
      // Yellow face zone on top (eyes + smile + rosy cheeks), dark stripes below.
      fill: [{ c: '#FFE66D', a: 0.45, p: arc(50, 60, 26, 17, 270, 630, 40) },
             { c: '#6D4C41', a: 0.35, p: [[38, 59], [44, 59], [44, 73], [38, 73]] },
             { c: '#6D4C41', a: 0.35, p: [[56, 59], [62, 59], [62, 73], [56, 73]] },
             { c: '#D7ECFF', a: 0.5, p: arc(36, 32, 14, 11, 270, 630, 28) },
             { c: '#D7ECFF', a: 0.5, p: arc(64, 32, 14, 11, 270, 630, 28) },
             { c: '#F48FB1', a: 0.4, p: arc(37, 53, 3.5, 2.5, 270, 630, 14) },
             { c: '#F48FB1', a: 0.4, p: arc(63, 53, 3.5, 2.5, 270, 630, 14) }],
      eyes: [[44, 50, 3.2], [56, 50, 3.2]],
      mouth: [50, 56, 4.5, 3, 'arc'],
      strokes: [arc(50, 60, 26, 17, 270, -90, 40),
                [[41, 59], [41, 73]],
                [[61, 59], [61, 73]],
                arc(36, 32, 14, 11, 270, -90, 28),
                arc(64, 32, 14, 11, 270, -90, 28),
                [[76, 60], [86, 55], [76, 65]]] },
    { id: 'butterfly', name: 'Butterfly', emoji: '\uD83E\uDD8B', sound: 'flutter', color: '#AB47BC',
      say: 'A butterfly! Can you draw the butterfly?',
      fill: [{ c: '#CE93D8', p: arc(33, 40, 16, 14, 270, 630, 32) },
             { c: '#CE93D8', p: arc(67, 40, 16, 14, 270, 630, 32) },
             { c: '#F48FB1', p: arc(35, 66, 11, 11, 270, 630, 28) },
             { c: '#F48FB1', p: arc(65, 66, 11, 11, 270, 630, 28) },
             { c: '#795548', a: 0.4, p: [[47, 32], [53, 32], [53, 74], [47, 74]] }],
      eyes: [[47, 29, 2], [53, 29, 2]],
      strokes: [arc(33, 40, 16, 14, 270, -90, 32),
                arc(67, 40, 16, 14, 270, -90, 32),
                arc(35, 66, 11, 11, 270, -90, 28),
                arc(65, 66, 11, 11, 270, -90, 28),
                [[50, 30], [50, 82]],
                [[47, 30], [40, 14]],
                [[53, 30], [60, 14]]] },
    { id: 'owl', name: 'Owl', emoji: '\uD83E\uDD89', sound: 'hoot', color: '#795548',
      say: 'An owl! Can you draw the owl?',
      fill: [{ c: '#C8A284', p: arc(50, 52, 29, 31, 270, 630, 44) },
             { c: '#FFF7E8', p: arc(39, 40, 10, 10, 270, 630, 26) },
             { c: '#FFF7E8', p: arc(61, 40, 10, 10, 270, 630, 26) },
             { c: '#E8D3BC', a: 0.5, p: arc(50, 68, 14, 10, 270, 630, 28) },
             { c: '#FF9F43', a: 0.45, p: [[50, 52], [45, 61], [55, 61]] }],
      eyes: [[39, 40, 4.2], [61, 40, 4.2]],
      strokes: [arc(50, 52, 29, 31, 270, -90, 44),
                [[30, 30], [20, 13], [38, 24]],
                [[70, 30], [80, 13], [62, 24]],
                arc(39, 40, 10, 10, 270, -90, 26),
                arc(61, 40, 10, 10, 270, -90, 26),
                [[50, 52], [45, 61], [55, 61]],
                [[24, 46], [15, 60], [24, 74]],
                [[76, 46], [85, 60], [76, 74]]] },
    { id: 'lion', name: 'Lion', emoji: '\uD83E\uDD81', sound: 'roar', color: '#F9A825',
      say: 'A lion! Can you draw the lion?',
      fill: [{ c: '#FFB74D', p: cloudPts(50, 50, 34, 32, 11, 0.13) },
             { c: '#FFE0B2', p: arc(50, 50, 21, 19, 270, 630, 36) },
             { c: '#8D5A2B', a: 0.85, p: [[45, 48], [55, 48], [50, 54]] }],
      eyes: [[41, 44, 3.2], [59, 44, 3.2]],
      mouth: [50, 58, 5.5, 4, 'cat'],
      strokes: [cloudPts(50, 50, 34, 32, 11, 0.13),
                arc(50, 50, 21, 19, 270, -90, 36),
                [[45, 48], [55, 48], [50, 54], [45, 48]],
                [[30, 48], [16, 44]], [[30, 54], [16, 56]],
                [[70, 48], [84, 44]], [[70, 54], [84, 56]]] },
    { id: 'elephant', name: 'Elephant', emoji: '\uD83D\uDC18', sound: 'trumpet', color: '#78909C',
      say: 'An elephant! Can you draw the elephant?',
      // full side view facing left: heavy rounded body, huge fan ear with
      // pink inner, trunk curling down with an upturned tip, white tusk,
      // two pillar legs, skinny tail (refs: cute cartoon elephant clipart)
      fill: [{ c: '#B0BEC5', p: [[20, 34], [36, 26], [58, 26], [76, 33], [86, 48],
                                 [85, 62], [75, 71], [56, 75], [38, 74], [26, 68],
                                 [18, 52], [20, 34]] },
             { c: '#90A4AE', p: [[30, 33], [19, 37], [15, 50], [20, 62], [33, 63],
                                  [38, 50], [36, 37], [30, 33]] },
             { c: '#F8BBD0', a: 0.8, p: [[29, 38], [22, 41], [20, 50], [24, 58],
                                         [32, 58], [34, 49], [33, 41], [29, 38]] },
             { c: '#B0BEC5', p: [[36, 71], [45, 71], [43, 89], [34, 89]] },
             { c: '#B0BEC5', p: [[66, 71], [75, 71], [73, 89], [64, 89]] },
             { c: '#FFFFFF', a: 0.95, p: [[19, 53], [25, 56], [21, 62], [15, 58]] }],
      eyes: [[14, 46, 2.6]],
      strokes: [[[20, 34], [36, 26], [58, 26], [76, 33], [86, 48], [85, 62],
                 [75, 71], [56, 75], [38, 74], [26, 68], [18, 52], [20, 34]],
                [[30, 33], [19, 37], [15, 50], [20, 62], [33, 63], [38, 50],
                 [36, 37], [30, 33]],
                [[16, 44], [9, 53], [7, 63], [12, 72], [21, 76], [27, 72]],
                [[40, 72], [40, 89]],
                [[70, 72], [70, 89]],
                [[85, 46], [92, 58], [88, 68]]] },
    { id: 'monkey', name: 'Monkey', emoji: '\uD83D\uDC35', sound: 'chatter', color: '#8D6E63',
      say: 'A monkey! Can you draw the monkey?',
      fill: [{ c: '#A1887F', p: arc(50, 52, 25, 23, 270, 630, 36) },
             { c: '#A1887F', p: arc(22, 52, 9, 11, 270, 630, 24) },
             { c: '#A1887F', p: arc(78, 52, 9, 11, 270, 630, 24) },
             { c: '#D7CCC8', a: 0.9, p: arc(22, 52, 5, 6.5, 270, 630, 18) },
             { c: '#D7CCC8', a: 0.9, p: arc(78, 52, 5, 6.5, 270, 630, 18) },
             { c: '#FFE0B2', p: arc(50, 56, 16, 15, 270, 630, 32) },
             { c: '#6D4C41', a: 0.7, p: arc(46, 52, 1.6, 1.2, 270, 630, 10) },
             { c: '#6D4C41', a: 0.7, p: arc(54, 52, 1.6, 1.2, 270, 630, 10) }],
      eyes: [[43, 47, 3], [57, 47, 3]],
      mouth: [50, 62, 6, 4, 'cat'],
      strokes: [arc(50, 52, 25, 23, 270, -90, 36),
                arc(22, 52, 9, 11, 270, -90, 24),
                arc(78, 52, 9, 11, 270, -90, 24),
                [[46, 30], [44, 21]],
                [[50, 29], [50, 19]],
                [[54, 30], [56, 21]]] },
    { id: 'penguin', name: 'Penguin', emoji: '\uD83D\uDC27', sound: 'honk', color: '#37474F',
      say: 'A penguin! Can you draw the penguin?',
      fill: [{ c: '#455A64', p: eggPts(50, 50, 22, 28, 34, 270, 630, 44) },
             { c: '#FFFFFF', p: eggPts(50, 57, 13, 19, 24, 270, 630, 36) },
             { c: '#FFA000', a: 0.9, p: [[45, 44], [50, 40], [55, 44], [50, 48], [45, 44]] },
             { c: '#FFA000', a: 0.7, p: arc(40, 84, 7, 4, 0, 180, 14) },
             { c: '#FFA000', a: 0.7, p: arc(60, 84, 7, 4, 0, 180, 14) }],
      eyes: [[43, 36, 3.2, 'w'], [57, 36, 3.2, 'w']],
      strokes: [eggPts(50, 50, 22, 28, 34, 270, -90, 44),
                [[28, 42], [15, 58], [24, 68]],
                [[72, 42], [85, 58], [76, 68]],
                [[45, 44], [50, 40], [55, 44], [50, 48], [45, 44]],
                arc(40, 84, 7, 4, 0, 180, 14),
                arc(60, 84, 7, 4, 0, 180, 14)] },
    { id: 'frog', name: 'Frog', emoji: '\uD83D\uDC38', sound: 'ribbit', color: '#43A047',
      say: 'A frog! Can you draw the frog?',
      fill: [{ c: '#66BB6A', p: arc(50, 60, 32, 24, 270, 630, 40) },
             { c: '#66BB6A', p: arc(34, 40, 9, 9, 270, 630, 22) },
             { c: '#66BB6A', p: arc(66, 40, 9, 9, 270, 630, 22) },
             { c: '#F8BBD0', a: 0.5, p: arc(30, 64, 4.5, 3, 270, 630, 14) },
             { c: '#F8BBD0', a: 0.5, p: arc(70, 64, 4.5, 3, 270, 630, 14) },
             { c: '#2E7D32', a: 0.6, p: arc(46, 52, 1.8, 1.4, 270, 630, 10) },
             { c: '#2E7D32', a: 0.6, p: arc(54, 52, 1.8, 1.4, 270, 630, 10) }],
      eyes: [[34, 40, 3.2], [66, 40, 3.2]],
      mouth: [50, 64, 11, 5, 'cat'],
      strokes: [arc(50, 60, 32, 24, 270, -90, 40),
                arc(34, 40, 9, 9, 180, 360, 20),
                arc(66, 40, 9, 9, 180, 360, 20)] },
    { id: 'turtle', name: 'Turtle', emoji: '\uD83D\uDC22', sound: 'chomp', color: '#2E7D32',
      say: 'A turtle! Can you draw the turtle?',
      // classic side view: big domed shell with scute lines, cream rim,
      // green head + legs + little tail (refs: cute cartoon turtle clipart)
      fill: [{ c: '#FFB74D', p: arc(48, 58, 33, 36, 180, 360, 36) },
             { c: '#FFF3E0', p: [[17, 58], [79, 58], [75, 68], [21, 68]] },
             { c: '#81C784', p: arc(12, 58, 11, 11, 270, 630, 28) },
             { c: '#81C784', p: [[25, 66], [33, 66], [31, 80], [23, 80]] },
             { c: '#81C784', p: [[63, 66], [71, 66], [69, 80], [61, 80]] },
             { c: '#81C784', p: [[79, 60], [90, 54], [92, 61], [82, 65]] }],
      decor: [{ p: [[36, 28], [32, 56]], c: '#E65100', w: 1.4 },
              { p: [[48, 23], [48, 56]], c: '#E65100', w: 1.4 },
              { p: [[60, 28], [64, 56]], c: '#E65100', w: 1.4 }],
      eyes: [[8, 54, 2.6]],
      mouth: [8, 63, 3.5, 2.5, 'arc'],
      strokes: [arc(48, 58, 33, 36, 180, 360, 36),
                [[21, 68], [75, 68]],
                arc(12, 58, 11, 11, 270, -90, 28),
                [[29, 66], [27, 80]],
                [[67, 66], [69, 80]],
                [[80, 62], [90, 56]]] },
    { id: 'snail', name: 'Snail', emoji: '\uD83D\uDC0C', sound: 'squelch', color: '#A1887F',
      say: 'A snail! Can you draw the snail?',
      // big round spiral shell (spiral drawn as decor ON the shell fill),
      // long slug body along the ground, head + ball-tipped eyestalks
      fill: [{ c: '#FFCC80', p: [[17, 62], [10, 70], [11, 80], [20, 87], [36, 89],
                                 [54, 89], [71, 86], [85, 78], [90, 70], [58, 71], [28, 68]] },
             { c: '#FFB74D', p: arc(52, 50, 26, 26, 270, 630, 40) },
             { c: '#FFE0B2', a: 0.95, p: arc(12, 47, 4, 4, 270, 630, 14) },
             { c: '#FFE0B2', a: 0.95, p: arc(23, 42, 4, 4, 270, 630, 14) }],
      decor: [{ p: spiralPts(52, 50, 20, 3.5, 2.25, 96), c: '#E65100', w: 1.4 }],
      eyes: [[12, 47, 2.2], [23, 42, 2.2]],
      mouth: [13, 77, 3, 2, 'arc'],
      strokes: [[[17, 62], [10, 70], [11, 80], [20, 87], [36, 89], [54, 89],
                 [71, 86], [85, 78], [90, 70]],
                arc(52, 50, 26, 26, 270, -90, 40),
                [[17, 63], [12, 51]],
                [[25, 62], [23, 46]]] },
    { id: 'ladybug', name: 'Ladybug', emoji: '\uD83D\uDC1E', sound: 'tinkle', color: '#E53935',
      say: 'A ladybug! Can you draw the ladybug?',
      // classic top view: big round red body, small dark head bump on top
      fill: [{ c: '#EF5350', p: arc(50, 62, 28, 26, 270, 630, 40) },
             { c: '#37474F', p: arc(50, 38, 12, 9, 180, 360, 20) },
             { c: '#37474F', a: 0.85, p: arc(38, 55, 5, 5, 270, 630, 16) },
             { c: '#37474F', a: 0.85, p: arc(62, 55, 5, 5, 270, 630, 16) },
             { c: '#37474F', a: 0.85, p: arc(42, 72, 4, 4, 270, 630, 14) },
             { c: '#37474F', a: 0.85, p: arc(58, 72, 4, 4, 270, 630, 14) }],
      eyes: [[46, 34, 2.2, 'w'], [54, 34, 2.2, 'w']],
      strokes: [arc(50, 62, 28, 26, 270, -90, 40),
                arc(50, 38, 12, 9, 180, 360, 20),
                [[50, 41], [50, 88]],
                [[45, 31], [40, 20]], [[55, 31], [60, 20]],
                [[24, 58], [14, 52]], [[22, 66], [12, 66]], [[26, 74], [16, 80]],
                [[76, 58], [86, 52]], [[78, 66], [88, 66]], [[74, 74], [84, 80]]] },
    { id: 'bear', name: 'Bear', emoji: '\uD83D\uDC3B', sound: 'growl', color: '#8D6E63',
      say: 'A bear! Can you draw the bear?',
      fill: [{ c: '#A1887F', p: arc(50, 56, 27, 25, 270, 630, 40) },
             { c: '#A1887F', p: arc(30, 32, 9, 9, 270, 630, 22) },
             { c: '#A1887F', p: arc(70, 32, 9, 9, 270, 630, 22) },
             { c: '#D7CCC8', a: 0.9, p: arc(30, 32, 5, 5, 270, 630, 16) },
             { c: '#D7CCC8', a: 0.9, p: arc(70, 32, 5, 5, 270, 630, 16) },
             { c: '#D7CCC8', p: arc(50, 64, 11, 8, 270, 630, 24) },
             { c: '#4E342E', p: [[46, 61], [54, 61], [50, 66]] }],
      eyes: [[41, 50, 3.2], [59, 50, 3.2]],
      mouth: [50, 70, 4, 2.5, 'arc'],
      strokes: [arc(50, 56, 27, 25, 270, -90, 40),
                arc(30, 32, 9, 9, 270, -90, 22),
                arc(70, 32, 9, 9, 270, -90, 22)] },
    { id: 'mouse', name: 'Mouse', emoji: '\uD83D\uDC2D', sound: 'squeak', color: '#90A4AE',
      say: 'A little mouse! Can you draw the mouse?',
      fill: [{ c: '#B0BEC5', p: eggPts(50, 58, 26, 18, 24, 270, 630, 40) },
             { c: '#B0BEC5', p: arc(28, 32, 13, 13, 270, 630, 28) },
             { c: '#B0BEC5', p: arc(72, 32, 13, 13, 270, 630, 28) },
             { c: '#F8BBD0', a: 0.85, p: arc(28, 32, 7.5, 7.5, 270, 630, 20) },
             { c: '#F8BBD0', a: 0.85, p: arc(72, 32, 7.5, 7.5, 270, 630, 20) },
             { c: '#F06292', p: arc(50, 79, 3, 2.4, 270, 630, 12) }],
      eyes: [[43, 52, 3], [57, 52, 3]],
      mouth: [50, 72, 3.5, 2.5, 'arc'],
      strokes: [eggPts(50, 58, 26, 18, 24, 270, -90, 40),
                arc(28, 32, 13, 13, 270, -90, 28),
                arc(72, 32, 13, 13, 270, -90, 28),
                [[37, 62], [22, 56]], [[37, 67], [22, 68]],
                [[63, 62], [78, 56]], [[63, 67], [78, 68]]] }
  ];

  /* ---------- objects ---------- */

  // Everyday things from toddler first-word flashcards. Same schema as
  // animals: traceable strokes + soft fills + a fun little sound each.
  var OBJECTS = [
    { id: 'ball', name: 'Ball', emoji: '\u26BD', sound: 'bounce', color: '#E53935',
      say: 'A ball! Can you draw the ball?',
      fill: [{ c: '#EF5350', p: arc(50, 50, 34, 34, 270, 630, 44) }],
      strokes: [arc(50, 50, 34, 34, 270, -90, 44),
                arc(50, 50, 14, 34, 90, 270, 24),
                arc(50, 50, 14, 34, -90, 90, 24)] },
    { id: 'house', name: 'House', emoji: '\uD83C\uDFE1', sound: 'knock', color: '#F4511E',
      say: 'A house! Can you draw the house?',
      fill: [{ c: '#FFE0B2', p: [[26, 54], [74, 54], [74, 88], [26, 88]] },
             { c: '#EF5350', p: [[22, 54], [50, 20], [78, 54]] },
             { c: '#8D6E63', p: [[44, 88], [44, 68], [56, 68], [56, 88]] }],
      strokes: [[[22, 54], [50, 20], [78, 54], [22, 54]],
                [[26, 54], [74, 54], [74, 88], [26, 88], [26, 54]],
                [[44, 88], [44, 68], [56, 68], [56, 88]]] },
    { id: 'tree', name: 'Tree', emoji: '\uD83C\uDF33', sound: 'rustle', color: '#2E7D32',
      say: 'A tree! Can you draw the tree?',
      fill: [{ c: '#81C784', p: cloudPts(50, 38, 25, 17, 7, 0.12) },
             { c: '#8D6E63', p: [[41, 54], [59, 54], [59, 90], [41, 90]] }],
      strokes: [cloudPts(50, 38, 25, 17, 7, 0.12),
                [[42, 52], [42, 88], [58, 88], [58, 52]]] },
    { id: 'flower', name: 'Flower', emoji: '\uD83C\uDF38', sound: 'twinkle', color: '#D81B60',
      say: 'A flower! Can you draw the flower?',
      fill: [{ c: '#F8BBD0', p: arc(50, 25, 8, 8, 270, 630, 22) },
             { c: '#F8BBD0', p: arc(62, 34, 8, 8, 270, 630, 22) },
             { c: '#F8BBD0', p: arc(58, 49, 8, 8, 270, 630, 22) },
             { c: '#F8BBD0', p: arc(42, 49, 8, 8, 270, 630, 22) },
             { c: '#F8BBD0', p: arc(38, 34, 8, 8, 270, 630, 22) },
             { c: '#FFD54F', p: arc(50, 38, 7.5, 7.5, 270, 630, 20) },
             { c: '#66BB6A', p: [[47, 46], [53, 46], [53, 86], [47, 86]] }],
      strokes: [arc(50, 25, 8, 8, 270, -90, 22),
                arc(62, 34, 8, 8, 270, -90, 22),
                arc(58, 49, 8, 8, 270, -90, 22),
                arc(42, 49, 8, 8, 270, -90, 22),
                arc(38, 34, 8, 8, 270, -90, 22),
                arc(50, 38, 7.5, 7.5, 270, -90, 20),
                [[50, 46], [50, 90]]] },
    { id: 'car', name: 'Car', emoji: '\uD83D\uDE97', sound: 'vroom', color: '#E53935',
      say: 'A car! Can you draw the car?',
      // classic side-view sedan facing left: sloping hood, roof + windows,
      // chunky dark wheels with light hubs, yellow headlight, door line
      fill: [{ c: '#EF5350', p: [[12, 62], [14, 54], [26, 50], [34, 38], [58, 38],
                                 [66, 50], [86, 54], [88, 63], [79, 70], [20, 70], [12, 62]] },
             { c: '#B3E5FC', p: [[36, 41], [56, 41], [62, 50], [36, 50]] },
             { c: '#37474F', p: arc(28, 71, 10, 10, 270, 630, 24) },
             { c: '#37474F', p: arc(70, 71, 10, 10, 270, 630, 24) },
             { c: '#ECEFF1', p: arc(28, 71, 3.5, 3.5, 270, 630, 14) },
             { c: '#ECEFF1', p: arc(70, 71, 3.5, 3.5, 270, 630, 14) },
             { c: '#FFD54F', p: arc(14, 57, 2.6, 2.6, 270, 630, 12) }],
      decor: [{ p: [[52, 52], [52, 68]], c: '#B71C1C', w: 1.3 }],
      strokes: [[[12, 62], [14, 54], [26, 50], [34, 38], [58, 38], [66, 50],
                 [86, 54], [88, 63], [79, 70], [20, 70], [12, 62]],
                [[36, 41], [56, 41], [62, 50], [36, 50], [36, 41]],
                arc(28, 71, 10, 10, 270, -90, 24),
                arc(70, 71, 10, 10, 270, -90, 24)] },
    { id: 'boat', name: 'Boat', emoji: '\u26F5', sound: 'toot', color: '#00897B',
      say: 'A boat! Can you draw the boat?',
      fill: [{ c: '#A1887F', p: [[20, 66], [30, 84], [70, 84], [80, 66]] },
             { c: '#FFB74D', p: [[50, 22], [50, 60], [78, 60]] }],
      strokes: [[[20, 66], [30, 84], [70, 84], [80, 66], [20, 66]],
                [[50, 66], [50, 20]],
                [[50, 24], [50, 62], [80, 62], [50, 24]]] },
    { id: 'rocket', name: 'Rocket', emoji: '\uD83D\uDE80', sound: 'blast', color: '#5E35B1',
      say: 'A rocket! Can you draw the rocket?',
      fill: [{ c: '#ECEFF1', p: [[38, 64], [38, 34], [50, 18], [62, 34], [62, 64]] },
             { c: '#EF5350', p: [[38, 34], [50, 18], [62, 34]] },
             { c: '#EF5350', a: 0.85, p: [[38, 64], [26, 82], [38, 78]] },
             { c: '#EF5350', a: 0.85, p: [[62, 64], [74, 82], [62, 78]] },
             { c: '#B3E5FC', p: arc(50, 46, 7, 7, 270, 630, 20) }],
      strokes: [[[38, 64], [38, 34]].concat(arc(50, 34, 12, 16, 180, 360, 20), [[62, 64]]),
                [[38, 64], [26, 82], [38, 78]],
                [[62, 64], [74, 82], [62, 78]],
                arc(50, 46, 7, 7, 270, -90, 20),
                [[38, 64], [62, 64]]] },
    { id: 'kite', name: 'Kite', emoji: '\uD83E\uDE81', sound: 'wind', color: '#8E24AA',
      say: 'A kite! Can you draw the kite?',
      fill: [{ c: '#CE93D8', p: [[50, 12], [74, 42], [50, 72], [26, 42]] },
             { c: '#F48FB1', a: 0.6, p: [[50, 12], [74, 42], [50, 42]] }],
      strokes: [[[50, 12], [74, 42], [50, 72], [26, 42], [50, 12]],
                [[50, 12], [50, 72]],
                [[26, 42], [74, 42]],
                [[50, 72], [44, 82], [56, 88], [48, 96]]] },
    { id: 'balloon', name: 'Balloon', emoji: '\uD83C\uDF88', sound: 'pop', color: '#E53935',
      say: 'A balloon! Can you draw the balloon?',
      fill: [{ c: '#EF5350', p: arc(50, 36, 23, 27, 270, 630, 40) }],
      strokes: [arc(50, 36, 23, 27, 270, -90, 40),
                [[44, 66], [50, 62], [56, 66]],
                [[50, 66], [46, 78], [54, 88], [48, 97]]] },
    { id: 'icecream', name: 'Ice cream', emoji: '\uD83C\uDF66', sound: 'slurp', color: '#F06292',
      say: 'An ice cream! Can you draw the ice cream?',
      fill: [{ c: '#D7A86E', p: [[36, 58], [64, 58], [50, 92]] },
             { c: '#F8BBD0', p: arc(50, 44, 20, 16, 270, 630, 36) }],
      strokes: [arc(50, 44, 20, 16, 270, -90, 36),
                [[36, 58], [50, 92], [64, 58]]] },
    { id: 'umbrella', name: 'Umbrella', emoji: '\u2602\uFE0F', sound: 'rain', color: '#00ACC1',
      say: 'An umbrella! Can you draw the umbrella?',
      fill: [{ c: '#4DD0E1', p: arc(50, 44, 32, 26, 180, 360, 32) }],
      strokes: [arc(50, 44, 32, 26, 180, 360, 32),
                [[50, 26], [50, 72]].concat(arc(43, 74, 7, 7, 0, 180, 14))] },
    { id: 'apple', name: 'Apple', emoji: '\uD83C\uDF4E', sound: 'crunch', color: '#E53935',
      say: 'An apple! Can you draw the apple?',
      fill: [{ c: '#EF5350', p: arc(50, 56, 26, 24, 270, 630, 44) }],
      strokes: [arc(50, 56, 26, 24, 270, -90, 44),
                [[50, 34], [54, 20]],
                arc(60, 24, 9, 5, 180, 360, 14)] },
    { id: 'banana', name: 'Banana', emoji: '\uD83C\uDF4C', sound: 'splat', color: '#F9A825',
      say: 'A banana! Can you draw the banana?',
      // thick crescent (outer + inner curve), brown stem nub on the upper
      // end, dark tip on the other (refs: cartoon banana clipart)
      fill: [{ c: '#FFE082', p: [[22, 30], [18, 43], [24, 57], [36, 68], [52, 72],
                                 [68, 67], [79, 55], [82, 38],
                                 [78, 39], [74, 50], [65, 58], [53, 61],
                                 [40, 59], [30, 51], [25, 41], [27, 31]] },
             { c: '#8D6E63', p: [[20, 30], [27, 28], [23, 19], [15, 20]] },
             { c: '#6D4C41', p: [[79, 33], [86, 29], [89, 36], [82, 40]] }],
      strokes: [[[22, 30], [18, 43], [24, 57], [36, 68], [52, 72], [68, 67],
                 [79, 55], [82, 38]],
                [[27, 31], [25, 41], [30, 51], [40, 59], [53, 61],
                 [65, 58], [74, 50], [78, 39]],
                [[22, 30], [16, 22], [22, 15]]] },
    { id: 'cake', name: 'Cake', emoji: '\uD83C\uDF82', sound: 'party', color: '#F06292',
      say: 'A birthday cake! Can you draw the cake?',
      fill: [{ c: '#F8BBD0', p: [[28, 58], [72, 58], [72, 86], [28, 86]] },
             { c: '#FFF3E0', p: [[28, 58], [35, 52], [42, 58], [50, 52], [58, 58], [65, 52], [72, 58]] },
             { c: '#4FC3F7', p: [[47, 52], [53, 52], [53, 36], [47, 36]] },
             { c: '#FFA000', p: [[50, 26], [53, 31], [50, 34], [47, 31]] }],
      strokes: [[[28, 58], [72, 58], [72, 86], [28, 86], [28, 58]],
                [[28, 58], [35, 52], [42, 58], [50, 52], [58, 58], [65, 52], [72, 58]],
                [[50, 52], [50, 36]],
                [[50, 26], [53, 31], [50, 34], [47, 31], [50, 26]]] },
    { id: 'cup', name: 'Cup', emoji: '\uD83E\uDD64', sound: 'glug', color: '#1E88E5',
      say: 'A cup! Can you draw the cup?',
      fill: [{ c: '#64B5F6', p: [[34, 40], [37, 60], [41, 82], [59, 82], [63, 60], [66, 40]] }],
      strokes: [[[34, 38], [37, 60], [41, 84], [59, 84], [63, 60], [66, 38]],
                [[29, 38], [71, 38]],
                arc(63, 56.5, 14, 11.5, 280, 100, 18)] },
    { id: 'pencil', name: 'Pencil', emoji: '\u270F\uFE0F', sound: 'scribble', color: '#FB8C00',
      say: 'A pencil! Can you draw the pencil?',
      fill: [{ c: '#FFB74D', p: [[40, 30], [60, 30], [60, 78], [40, 78]] },
             { c: '#FFE0B2', p: [[40, 30], [50, 8], [60, 30]] },
             { c: '#4E342E', p: [[46.4, 16], [53.6, 16], [50, 8]] },
             { c: '#F48FB1', p: [[40, 78], [60, 78], [60, 88], [40, 88]] }],
      strokes: [[[40, 30], [60, 30], [60, 88], [40, 88], [40, 30]],
                [[40, 30], [50, 8], [60, 30]],
                [[46.4, 16], [53.6, 16]],
                [[40, 78], [60, 78]]] }
  ];

  /* ---------- build glyph list ---------- */

  var GLYPHS = [];
  var LETTER_IDS = 'abcdefghijklmnopqrstuvwxyz'.split('');

  LETTER_IDS.forEach(function (id, i) {
    var upper = id.toUpperCase();
    var word = LETTER_WORDS[id];
    GLYPHS.push({
      id: id,
      cat: 'letters',
      letterCase: 'big',
      name: upper,
      caption: word[0],
      emoji: word[1],
      color: ITEM_COLORS[i % ITEM_COLORS.length],
      say: 'Big ' + upper + ' is for ' + word[0] + '! Can you draw the big ' + upper + '?',
      strokes: LETTERS[id]
    });
  });

  LETTER_IDS.forEach(function (id, i) {
    var word = LETTER_WORDS[id];
    GLYPHS.push({
      id: 'sm-' + id,
      cat: 'letters',
      letterCase: 'small',
      name: id,
      caption: word[0].toLowerCase(),
      emoji: word[1],
      color: ITEM_COLORS[i % ITEM_COLORS.length],
      say: 'Small ' + id + ' is for ' + word[0].toLowerCase() + '! Can you draw the small ' + id + '?',
      strokes: LOWERCASE[id]
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

  ANIMALS.forEach(function (a, i) {
    GLYPHS.push({
      id: a.id,
      cat: 'animals',
      name: a.name,
      caption: a.name,
      emoji: a.emoji,
      sound: a.sound,
      color: a.color,
      fill: a.fill,
      eyes: a.eyes,
      mouth: a.mouth,
      decor: a.decor,
      say: a.say,
      strokes: a.strokes
    });
  });

  OBJECTS.forEach(function (o) {
    GLYPHS.push({
      id: o.id,
      cat: 'objects',
      name: o.name,
      caption: o.name,
      emoji: o.emoji,
      sound: o.sound,
      color: o.color,
      fill: o.fill,
      eyes: o.eyes,
      mouth: o.mouth,
      decor: o.decor,
      say: o.say,
      strokes: o.strokes
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
    ['almost-there', 'Almost there!'],
    ['tap-done', 'Tap the green check when you are done!'],
    ['more-stars', 'You did it! Keep tracing to earn more stars!'],
    ['one-star', 'You earned one star!'],
    ['two-stars', 'You earned two stars!'],
    ['three-stars', 'Wow! Three stars! You are a super star!'],
    ['big-letters', 'Big letters!'],
    ['small-letters', 'Small letters!']
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
    { id: 'animals', name: 'Animals', emoji: '\uD83D\uDC3E', color: '#EC407A', blurb: 'Meow! Roar! Moo!' },
    { id: 'objects', name: 'Objects', emoji: '\uD83D\uDE97', color: '#26A69A', blurb: 'Balls, cars & houses' },
    { id: 'shapes',  name: 'Shapes',  emoji: '\u2B50', color: '#FF9800', blurb: 'Stars, hearts & more' },
    { id: 'letters', name: 'Letters', emoji: '\uD83D\uDC24', color: '#43A047', blurb: 'Big A and small a' },
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
