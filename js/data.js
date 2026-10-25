/*
 * Draw & Learn — data.js
 * Single source of truth for:
 *  - The 61 traceable glyphs (26 letters, 10 numbers, 14 shapes, 11 animals)
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

  // Each animal: traceable outline strokes + its very own sound (see audio.js)
  // PLUS the two things that make a critter readable BEFORE it is traced:
  //   fill — soft pre-applied color regions: [{ c: '#hex', p: [closed pts], a: alpha }]
  //   eyes — decorative (non-traceable) eyes: [x, y, radius] or [x, y, radius, 'w']
  //          ('w' = white sclera + pupil, for dark faces like the sheep's)
  //   color — the road/card color, tuned to the animal's natural hue.
  var DUCK_BODY = [[48, 40], [58, 44], [68, 49], [79, 44], [75, 58], [68, 66],
                   [56, 72], [42, 72], [30, 66], [23, 56], [22, 46], [30, 39], [42, 36]];

  var ANIMALS = [
    { id: 'cat', name: 'Cat', emoji: '\uD83D\uDC31', sound: 'meow', color: '#FB8C00',
      say: 'A cat! Can you draw the cat?',
      fill: [{ c: '#FFC66E', p: arc(50, 58, 30, 28, 270, 630, 40) }],
      eyes: [[41, 53, 3.4], [59, 53, 3.4]],
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
             { c: '#F06292', a: 0.5, p: arc(50, 71, 2.5, 1.8, 270, 630, 12) }],
      eyes: [[43, 66, 3], [57, 66, 3]],
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
      fill: [{ c: '#FFD93B', p: arc(48, 52, 27, 25, 270, 630, 40) },
             { c: '#FF9F43', a: 0.45, p: [[73, 46], [88, 53], [73, 60]] }],
      eyes: [[40, 46, 3.2], [56, 46, 3.2]],
      strokes: [arc(48, 52, 27, 25, 270, -90, 40),
                [[73, 46], [88, 53], [73, 60]],
                arc(45, 57, 11, 8, 150, 30, 18),
                [[44, 26], [40, 17]],
                [[54, 26], [58, 17]],
                [[42, 77], [37, 92]],
                [[56, 77], [61, 92]]] },
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
      fill: [{ c: '#F4EEE1', a: 0.5, p: cloudPts(50, 40, 34, 25, 7, 0.11) },
             { c: '#4E342E', a: 0.85, p: arc(50, 67, 14, 13, 270, 630, 32) }],
      eyes: [[44, 62, 3.4, 'w'], [56, 62, 3.4, 'w']],
      strokes: [cloudPts(50, 40, 34, 25, 7, 0.11, -55, 235),
                arc(50, 67, 14, 13, 270, -90, 32),
                [[38, 58], [25, 62], [38, 68]],
                [[62, 58], [75, 62], [62, 68]],
                [[40, 76], [37, 92]],
                [[60, 76], [63, 92]]] },
    { id: 'fish', name: 'Fish', emoji: '\uD83D\uDC1F', sound: 'blub', color: '#FF7043',
      say: 'A fish! Can you draw the fish?',
      fill: [{ c: '#FFAB91', p: arc(44, 50, 30, 21, 270, 630, 44) },
             { c: '#FFAB91', p: [[74, 50], [88, 34], [82, 50], [88, 66]] }],
      eyes: [[30, 46, 3]],
      strokes: [arc(44, 50, 30, 21, 180, 0, 26).concat(arc(44, 50, 30, 21, 360, 180, 26)),
                [[74, 50], [88, 34], [82, 50], [88, 66], [74, 50]]] },
    { id: 'bee', name: 'Bee', emoji: '\uD83D\uDC1D', sound: 'buzz', color: '#FFA000',
      say: 'A buzzy bee! Can you draw the bee?',
      fill: [{ c: '#FFE66D', p: arc(50, 60, 26, 17, 270, 630, 40) },
             { c: '#6D4C41', a: 0.35, p: [[38, 54], [44, 54], [44, 74], [38, 74]] },
             { c: '#6D4C41', a: 0.35, p: [[58, 54], [64, 54], [64, 74], [58, 74]] },
             { c: '#D7ECFF', a: 0.5, p: arc(36, 32, 14, 11, 270, 630, 28) },
             { c: '#D7ECFF', a: 0.5, p: arc(64, 32, 14, 11, 270, 630, 28) }],
      eyes: [[44, 50, 2.8], [56, 50, 2.8]],
      strokes: [arc(50, 60, 26, 17, 270, -90, 40),
                [[41, 54], [41, 74]],
                [[61, 54], [61, 74]],
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
                [[76, 46], [85, 60], [76, 74]]] }
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
      say: a.say,
      strokes: a.strokes
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
    { id: 'animals', name: 'Animals', emoji: '\uD83D\uDC3E', color: '#EC407A', blurb: 'Meow! Woof! Moo!' },
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
