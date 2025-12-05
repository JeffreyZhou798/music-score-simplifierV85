/**
 * @typedef {'single-staff' | 'grand-staff'} ScoreType
 */

/**
 * @typedef {1 | 2 | 3 | 4 | 5} SimplificationLevel
 */

/**
 * @typedef {Object} SimplificationConfig
 * @property {SimplificationLevel} mainLevel
 * @property {SimplificationLevel} [sopranoLevel]
 * @property {SimplificationLevel} [bassLevel]
 */

/**
 * @typedef {Object} TimeSignature
 * @property {number} beats
 * @property {number} beatType
 * @property {'simple' | 'compound'} type
 */

/**
 * @typedef {Object} KeySignature
 * @property {number} fifths - -7 to 7 (flats to sharps)
 * @property {'major' | 'minor'} mode
 */

/**
 * @typedef {Object} Pitch
 * @property {'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'} step
 * @property {number} octave
 * @property {-1 | 0 | 1} [alter]
 */

/**
 * @typedef {Object} Duration
 * @property {'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth' | '32nd'} type
 * @property {number} dots
 * @property {Object} [tuplet]
 * @property {number} ticks
 */

/**
 * @typedef {'grace_note' | 'trill' | 'turn' | 'mordent_upper' | 'mordent_lower' | 'glissando' | 'tremolo' | 'arpeggio'} EmbellishmentType
 */

/**
 * @typedef {'syncopation' | 'dotted_rhythm' | 'cross_beat_tie' | 'cross_measure_tie' | 'melodic_turning_point' | 'phrase_ending' | 'off_beat_start'} LockReason
 */

/**
 * @typedef {Object} Note
 * @property {string} id
 * @property {Pitch} pitch
 * @property {Duration} duration
 * @property {number} startBeat
 * @property {number} voice
 * @property {1 | 2} staff
 * @property {string} [tiedTo]
 * @property {string[]} [slurredWith]
 * @property {boolean} isLocked
 * @property {LockReason} [lockReason]
 * @property {EmbellishmentType} [embellishment]
 * @property {'soprano' | 'alto' | 'tenor' | 'bass'} [voicePart]
 */

/**
 * @typedef {Object} Rest
 * @property {string} id
 * @property {Duration} duration
 * @property {number} startBeat
 * @property {number} voice
 * @property {1 | 2} staff
 */

/**
 * @typedef {Object} Measure
 * @property {number} number
 * @property {Note[]} notes
 * @property {Rest[]} rests
 */

/**
 * @typedef {Object} ScoreMetadata
 * @property {string} title
 * @property {string} composer
 * @property {number} tempo
 * @property {TimeSignature} timeSignature
 * @property {KeySignature} keySignature
 * @property {string[]} clefs
 * @property {string[]} textAnnotations
 */

/**
 * @typedef {Object} ParsedScore
 * @property {ScoreMetadata} metadata
 * @property {Measure[]} measures
 * @property {string} rawXml
 */

/**
 * @typedef {Object} AnalyzedScore
 * @property {ScoreMetadata} metadata
 * @property {Measure[]} measures
 * @property {Object} voices
 * @property {Note[]} lockedNotes
 * @property {number[]} strongBeats
 */

/**
 * @typedef {Object} SimplifiedScore
 * @property {ScoreMetadata} metadata
 * @property {Measure[]} measures
 * @property {SimplificationLevel} simplificationLevel
 * @property {ScoreType} scoreType
 */

/**
 * @typedef {Object} Notification
 * @property {string} id
 * @property {'success' | 'error' | 'info'} type
 * @property {string} message
 */

export const DURATION_TICKS = {
  'whole': 4096,
  'half': 2048,
  'quarter': 1024,
  'eighth': 512,
  'sixteenth': 256,
  '32nd': 128
}

export const DURATION_ORDER = ['whole', 'half', 'quarter', 'eighth', 'sixteenth', '32nd']
