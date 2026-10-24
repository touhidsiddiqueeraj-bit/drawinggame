#!/usr/bin/env node
/* Exports the voice clip manifest from js/data.js to tools/voice_clips.json
 * so the audio generator scripts (edge-tts now, Gemini TTS later) share the
 * exact same texts and file names. */
'use strict';
const fs = require('fs');
const path = require('path');

const data = require(path.join(__dirname, '..', 'js', 'data.js'));
const out = path.join(__dirname, 'voice_clips.json');
fs.writeFileSync(out, JSON.stringify(data.VOICE_CLIPS, null, 2));
console.log('Wrote', out, 'with', data.VOICE_CLIPS.length, 'clips');
