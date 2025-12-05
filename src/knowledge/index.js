/**
 * Knowledge Base for Music Score Symbols
 * Contains definitions for clefs, time signatures, key signatures, durations, etc.
 */

// Clef Definitions
export const CLEF_DEFINITIONS = {
  treble: { name: 'Treble Clef', alias: 'G Clef', referencePitch: 'G4', referenceLine: 2 },
  bass: { name: 'Bass Clef', alias: 'F Clef', referencePitch: 'F3', referenceLine: 4 },
  alto: { name: 'Alto Clef', alias: 'C Clef', referencePitch: 'C4', referenceLine: 3 },
  tenor: { name: 'Tenor Clef', alias: 'C Clef', referencePitch: 'C4', referenceLine: 4 }
}

// Time Signature Definitions with Strong Beat Patterns
// 强拍位置定义（根据 ProjectBlueprint_MSS3.md）：
// - 2/4拍：第1拍为强拍
// - 3/4拍：第1拍为强拍
// - 4/4拍：第1拍和第3拍为强拍
// - 6/8拍：第1拍和第4拍为强拍（以八分音符为一拍）
export const TIME_SIGNATURE_DEFINITIONS = {
  '2/4': { beats: 2, beatType: 4, type: 'simple', strongBeats: [1], pattern: [1, 2] },
  '2/2': { beats: 2, beatType: 2, type: 'simple', strongBeats: [1], pattern: [1, 2] },
  '3/4': { beats: 3, beatType: 4, type: 'simple', strongBeats: [1], pattern: [1, 2, 3] },
  '3/8': { beats: 3, beatType: 8, type: 'simple', strongBeats: [1], pattern: [1, 2, 3] },
  '4/4': { beats: 4, beatType: 4, type: 'simple', strongBeats: [1, 3], pattern: [1, 2, 3, 4] },
  '4/2': { beats: 4, beatType: 2, type: 'simple', strongBeats: [1, 3], pattern: [1, 2, 3, 4] },
  '5/4': { beats: 5, beatType: 4, type: 'irregular', strongBeats: [1, 3], pattern: [1, 2, 3, 4, 5] },
  '6/4': { beats: 6, beatType: 4, type: 'compound', strongBeats: [1, 4], pattern: [1, 2, 3, 4, 5, 6] },
  '6/8': { beats: 6, beatType: 8, type: 'compound', strongBeats: [1, 4], pattern: [1, 2, 3, 4, 5, 6] },
  '7/8': { beats: 7, beatType: 8, type: 'irregular', strongBeats: [1, 4], pattern: [1, 2, 3, 4, 5, 6, 7] },
  '9/8': { beats: 9, beatType: 8, type: 'compound', strongBeats: [1, 4, 7], pattern: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
  '12/8': { beats: 12, beatType: 8, type: 'compound', strongBeats: [1, 4, 7, 10], pattern: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }
}

// Key Signature Definitions (fifths: -7 to 7)
export const KEY_SIGNATURE_DEFINITIONS = {
  0: { major: 'C', minor: 'A', accidentals: [] },
  1: { major: 'G', minor: 'E', accidentals: ['F#'] },
  2: { major: 'D', minor: 'B', accidentals: ['F#', 'C#'] },
  3: { major: 'A', minor: 'F#', accidentals: ['F#', 'C#', 'G#'] },
  4: { major: 'E', minor: 'C#', accidentals: ['F#', 'C#', 'G#', 'D#'] },
  5: { major: 'B', minor: 'G#', accidentals: ['F#', 'C#', 'G#', 'D#', 'A#'] },
  6: { major: 'F#', minor: 'D#', accidentals: ['F#', 'C#', 'G#', 'D#', 'A#', 'E#'] },
  7: { major: 'C#', minor: 'A#', accidentals: ['F#', 'C#', 'G#', 'D#', 'A#', 'E#', 'B#'] },
  '-1': { major: 'F', minor: 'D', accidentals: ['Bb'] },
  '-2': { major: 'Bb', minor: 'G', accidentals: ['Bb', 'Eb'] },
  '-3': { major: 'Eb', minor: 'C', accidentals: ['Bb', 'Eb', 'Ab'] },
  '-4': { major: 'Ab', minor: 'F', accidentals: ['Bb', 'Eb', 'Ab', 'Db'] },
  '-5': { major: 'Db', minor: 'Bb', accidentals: ['Bb', 'Eb', 'Ab', 'Db', 'Gb'] },
  '-6': { major: 'Gb', minor: 'Eb', accidentals: ['Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'] },
  '-7': { major: 'Cb', minor: 'Ab', accidentals: ['Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb', 'Fb'] }
}

// Note Duration Definitions (in ticks, where quarter = 1024)
export const DURATION_DEFINITIONS = {
  whole: { ticks: 4096, beats: 4, flags: 0, filled: false },
  half: { ticks: 2048, beats: 2, flags: 0, filled: false },
  quarter: { ticks: 1024, beats: 1, flags: 0, filled: true },
  eighth: { ticks: 512, beats: 0.5, flags: 1, filled: true },
  sixteenth: { ticks: 256, beats: 0.25, flags: 2, filled: true },
  '32nd': { ticks: 128, beats: 0.125, flags: 3, filled: true }
}


// SATB Voice Range Definitions
export const VOICE_RANGES = {
  soprano: { min: { step: 'C', octave: 4 }, max: { step: 'C', octave: 6 }, minMidi: 60, maxMidi: 84 },
  alto: { min: { step: 'G', octave: 3 }, max: { step: 'A', octave: 5 }, minMidi: 55, maxMidi: 81 },
  tenor: { min: { step: 'C', octave: 3 }, max: { step: 'G', octave: 4 }, minMidi: 48, maxMidi: 67 },
  bass: { min: { step: 'E', octave: 1 }, max: { step: 'E', octave: 3 }, minMidi: 28, maxMidi: 52 }
}

// Musical Embellishments Definitions
export const EMBELLISHMENT_DEFINITIONS = {
  grace_note: { name: 'Grace Note', types: ['acciaccatura', 'appoggiatura'], removable: true },
  trill: { name: 'Trill', symbol: 'tr', removable: true },
  turn: { name: 'Turn', symbol: '∽', removable: true },
  mordent_upper: { name: 'Upper Mordent', symbol: '∿', removable: true },
  mordent_lower: { name: 'Lower Mordent', symbol: '∿+', removable: true },
  glissando: { name: 'Glissando', symbol: 'gliss.', removable: true },
  tremolo: { name: 'Tremolo', removable: true },
  arpeggio: { name: 'Arpeggio', removable: true }
}

// Rhythm Pattern Definitions
// 根据 ProjectBlueprint_MSS3.md 规范定义节奏型
export const RHYTHM_PATTERNS = {
  // 基础拍内节奏型（Beat-level）
  isorhythmic: { name: 'Equal Division', locked: false, description: '等分节奏，整齐均匀' },
  beat_head: { name: 'Beat-head Pattern', locked: false, description: '拍头节奏，每拍第一个音强调' },
  
  // 切分节奏（Syncopation）- 极重要，必须 LOCKED
  syncopation: { name: 'Syncopation', locked: true, description: '弱拍起延到强拍' },
  continuous_syncopation: { name: 'Continuous Syncopation', locked: true, description: '连续切分' },
  
  // 附点节奏（Dotted Rhythms）- LOCKED
  dotted_quarter: { name: 'Dotted Quarter', locked: true, description: '附点四分音符' },
  dotted_eighth: { name: 'Dotted Eighth', locked: true, description: '附点八分音符' },
  double_dotted: { name: 'Double Dotted', locked: true, description: '双附点' },
  
  // 长短节奏
  scotch_snap: { name: 'Scotch Snap', locked: true, description: '短长节奏' },
  long_short: { name: 'Long-Short', locked: false, description: '长短节奏' },
  
  // 连音与分组型节奏
  triplet: { name: 'Triplet', locked: false, description: '三连音' },
  triplet_head: { name: 'Triplet Head', locked: true, description: '三连音首音' },
  swing: { name: 'Swing', locked: false, description: '摇摆节奏' },
  
  // 跨拍/跨小节节奏（Structural）- LOCKED
  tied: { name: 'Tied Rhythm', locked: true, description: '连线跨拍' },
  cross_bar_tie: { name: 'Cross-bar Tie', locked: true, description: '跨小节连线' },
  anacrusis: { name: 'Anacrusis/Pickup', locked: true, description: '弱起' },
  
  // 复合拍子特有节奏型
  compound_grouping: { name: 'Compound Grouping', locked: false, description: '复合强拍分组' },
  hemiola: { name: 'Hemiola', locked: true, description: '6/8切分（2+3或3+2）' }
}

// Compound Meter Beat Groupings
export const COMPOUND_METER_GROUPINGS = {
  '6/8': [[1, 2, 3], [4, 5, 6]],
  '9/8': [[1, 2, 3], [4, 5, 6], [7, 8, 9]],
  '12/8': [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12]]
}

// Pitch to MIDI conversion helpers
export const PITCH_TO_SEMITONE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

/**
 * Convert pitch to MIDI number
 * @param {Object} pitch - Pitch object with step, octave, alter
 * @returns {number} MIDI note number
 */
export function pitchToMidi(pitch) {
  if (!pitch || !pitch.step) return 60 // Default to C4
  const semitone = PITCH_TO_SEMITONE[pitch.step] || 0
  const alter = pitch.alter || 0
  const octave = pitch.octave || 4
  return (octave + 1) * 12 + semitone + alter
}

/**
 * Get strong beats for a time signature
 * @param {Object} timeSignature - Time signature object
 * @returns {number[]} Array of strong beat positions
 */
export function getStrongBeats(timeSignature) {
  const key = `${timeSignature.beats}/${timeSignature.beatType}`
  const def = TIME_SIGNATURE_DEFINITIONS[key]
  return def ? def.strongBeats : [1]
}

/**
 * Check if a beat position is a strong beat
 * @param {number} beat - Beat position (1-indexed)
 * @param {Object} timeSignature - Time signature object
 * @returns {boolean}
 */
export function isStrongBeat(beat, timeSignature) {
  const strongBeats = getStrongBeats(timeSignature)
  return strongBeats.includes(Math.floor(beat))
}

/**
 * Get duration in ticks with dots
 * @param {string} type - Duration type
 * @param {number} dots - Number of dots
 * @returns {number} Total ticks
 */
export function getDurationTicks(type, dots = 0) {
  const baseTicks = DURATION_DEFINITIONS[type]?.ticks || 1024
  let total = baseTicks
  let addition = baseTicks / 2
  for (let i = 0; i < dots; i++) {
    total += addition
    addition /= 2
  }
  return total
}
