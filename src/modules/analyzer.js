/**
 * Score Analyzer Module
 * Performs Type A (deterministic) and Type B (AI-assisted) analysis
 * 
 * 根据 ProjectBlueprint_MSS3.md 规范：
 * - Type A（确定性解析）：谱表结构、符头符干符尾、休止符、谱号、拍号、调号、时值、音高、附点、装饰音、连音线
 * - Type B（感知性判断）：旋律线、Bass Line、强拍位置、结构重要音（LOCKED）、节奏型、终止式、声部
 */

import { 
  getStrongBeats, 
  isStrongBeat, 
  pitchToMidi,
  RHYTHM_PATTERNS
} from '../knowledge/index.js'
import { 
  identifyMelodyLine, 
  identifyBassLine, 
  classifyVoicePart,
  isAIAvailable 
} from '../ai/index.js'

/**
 * Analyze a parsed score
 * @param {Object} score - Parsed score
 * @param {string} scoreType - 'single-staff' or 'grand-staff'
 * @returns {Promise<Object>} Analyzed score
 */
export async function analyzeScore(score, scoreType) {
  const { metadata, measures } = score
  
  // Type A: Deterministic analysis
  const strongBeats = getStrongBeats(metadata.timeSignature)
  
  // Analyze each measure
  const analyzedMeasures = measures.map(measure => {
    const analyzedNotes = measure.notes.map(note => ({
      ...note,
      voicePart: scoreType === 'grand-staff' ? classifyVoicePart(note) : undefined,
      isLocked: false,
      lockReason: undefined
    }))
    
    return {
      ...measure,
      notes: analyzedNotes
    }
  })
  
  // Type B: AI-assisted analysis
  const allNotes = analyzedMeasures.flatMap(m => m.notes)
  
  // Identify LOCKED notes
  identifyLockedNotes(analyzedMeasures, metadata.timeSignature)
  
  // Identify voices for grand staff
  let voices = {}
  if (scoreType === 'grand-staff') {
    voices = await identifyVoices(allNotes)
  }
  
  // Get locked notes list
  const lockedNotes = allNotes.filter(n => n.isLocked)
  
  return {
    metadata,
    measures: analyzedMeasures,
    voices,
    lockedNotes,
    strongBeats,
    scoreType
  }
}

/**
 * Identify LOCKED notes that should not be modified
 * @param {Array} measures - Array of measures
 * @param {Object} timeSignature - Time signature
 */
function identifyLockedNotes(measures, timeSignature) {
  const strongBeats = getStrongBeats(timeSignature)
  
  measures.forEach((measure, measureIdx) => {
    // 按声部分组处理，确保旋律线的转折点正确识别
    const staff1Notes = measure.notes.filter(n => n.staff === 1)
    const staff2Notes = measure.notes.filter(n => n.staff === 2)
    
    measure.notes.forEach((note, noteIdx) => {
      // Skip embellishments - they should be removed, not locked
      if (note.embellishment) return
      
      // Check for syncopation: starts on weak beat, extends to strong beat
      const startBeat = note.startBeat
      const durationBeats = note.duration.ticks / 1024
      const endBeat = startBeat + durationBeats
      
      const startsOnWeakBeat = !isStrongBeat(startBeat, timeSignature)
      const extendsToStrongBeat = strongBeats.some(sb => startBeat < sb && endBeat >= sb)
      
      if (startsOnWeakBeat && extendsToStrongBeat) {
        note.isLocked = true
        note.lockReason = 'syncopation'
        return
      }
      
      // Check for dotted rhythm (duration >= eighth note)
      if (note.duration.dots > 0 && note.duration.ticks >= 512) {
        note.isLocked = true
        note.lockReason = 'dotted_rhythm'
        return
      }
      
      // Check for ties (cross-beat or cross-measure)
      if (note.tiedTo) {
        note.isLocked = true
        note.lockReason = 'cross_beat_tie'
        return
      }
      
      // Check for off-beat start (back half of beat) - important for syncopation
      const beatFraction = startBeat % 1
      if (beatFraction >= 0.5 && beatFraction < 1) {
        // Only lock if duration extends past the beat
        if (durationBeats >= 0.5) {
          note.isLocked = true
          note.lockReason = 'off_beat_start'
          return
        }
      }
      
      // Check for triplet notes - preserve triplet structure
      if (note.duration.tuplet) {
        // Lock the first note of each triplet group
        const tupletRatio = note.duration.tuplet.actual / note.duration.tuplet.normal
        const isFirstOfTriplet = Math.abs(startBeat % (1 / tupletRatio) - 0) < 0.01
        if (isFirstOfTriplet) {
          note.isLocked = true
          note.lockReason = 'triplet_head'
          return
        }
      }
      
      // Check for melodic turning points (within same staff)
      const sameStaffNotes = note.staff === 1 ? staff1Notes : staff2Notes
      const staffNoteIdx = sameStaffNotes.findIndex(n => n.id === note.id)
      if (staffNoteIdx >= 0 && isMelodicTurningPoint(sameStaffNotes, staffNoteIdx)) {
        note.isLocked = true
        note.lockReason = 'melodic_turning_point'
        return
      }
      
      // Check for phrase endings (last note of measure with longer duration)
      if (noteIdx === measure.notes.length - 1 && note.duration.ticks >= 1024) {
        note.isLocked = true
        note.lockReason = 'phrase_ending'
      }
    })
  })
}


/**
 * Check if a note is a melodic turning point
 * @param {Array} notes - Notes in measure
 * @param {number} index - Note index
 * @returns {boolean}
 */
function isMelodicTurningPoint(notes, index) {
  if (index === 0 || index === notes.length - 1) return false
  
  const prev = notes[index - 1]
  const curr = notes[index]
  const next = notes[index + 1]
  
  // Skip if any note is an embellishment
  if (prev.embellishment || curr.embellishment || next.embellishment) return false
  
  const prevMidi = pitchToMidi(prev.pitch)
  const currMidi = pitchToMidi(curr.pitch)
  const nextMidi = pitchToMidi(next.pitch)
  
  // Local maximum or minimum
  const isLocalMax = currMidi > prevMidi && currMidi > nextMidi
  const isLocalMin = currMidi < prevMidi && currMidi < nextMidi
  
  return isLocalMax || isLocalMin
}

/**
 * Identify SATB voices for grand staff
 * @param {Array} notes - All notes
 * @returns {Promise<Object>} Voice identification result
 */
async function identifyVoices(notes) {
  const voices = {
    soprano: [],
    alto: [],
    tenor: [],
    bass: []
  }
  
  // Separate by staff first
  const upperStaff = notes.filter(n => n.staff === 1)
  const lowerStaff = notes.filter(n => n.staff === 2)
  
  // Use AI if available, otherwise use rule-based
  if (isAIAvailable()) {
    voices.soprano = await identifyMelodyLine(upperStaff)
    voices.bass = identifyBassLine(lowerStaff)
  } else {
    // Rule-based: highest in upper staff is soprano
    voices.soprano = getHighestVoice(upperStaff)
    voices.bass = getLowestVoice(lowerStaff)
  }
  
  // Alto: remaining upper staff notes
  const sopranoIds = new Set(voices.soprano.map(n => n.id))
  voices.alto = upperStaff.filter(n => !sopranoIds.has(n.id))
  
  // Tenor: remaining lower staff notes
  const bassIds = new Set(voices.bass.map(n => n.id))
  voices.tenor = lowerStaff.filter(n => !bassIds.has(n.id))
  
  // Assign voice parts to notes
  voices.soprano.forEach(n => n.voicePart = 'soprano')
  voices.alto.forEach(n => n.voicePart = 'alto')
  voices.tenor.forEach(n => n.voicePart = 'tenor')
  voices.bass.forEach(n => n.voicePart = 'bass')
  
  return voices
}

/**
 * Get highest voice from notes (rule-based)
 * @param {Array} notes - Notes array
 * @returns {Array} Highest notes per beat
 */
function getHighestVoice(notes) {
  const beatGroups = groupByBeat(notes)
  const result = []
  
  beatGroups.forEach(group => {
    const highest = group.reduce((max, note) => {
      const maxMidi = pitchToMidi(max.pitch)
      const noteMidi = pitchToMidi(note.pitch)
      return noteMidi > maxMidi ? note : max
    })
    result.push(highest)
  })
  
  return result
}

/**
 * Get lowest voice from notes (rule-based)
 * @param {Array} notes - Notes array
 * @returns {Array} Lowest notes per beat
 */
function getLowestVoice(notes) {
  const beatGroups = groupByBeat(notes)
  const result = []
  
  beatGroups.forEach(group => {
    const lowest = group.reduce((min, note) => {
      const minMidi = pitchToMidi(min.pitch)
      const noteMidi = pitchToMidi(note.pitch)
      return noteMidi < minMidi ? note : min
    })
    result.push(lowest)
  })
  
  return result
}

/**
 * Group notes by beat position
 * @param {Array} notes - Notes array
 * @returns {Map} Map of beat -> notes
 */
function groupByBeat(notes) {
  const groups = new Map()
  
  notes.forEach(note => {
    const beat = Math.floor(note.startBeat)
    if (!groups.has(beat)) {
      groups.set(beat, [])
    }
    groups.get(beat).push(note)
  })
  
  return groups
}

/**
 * Detect anacrusis (pickup measure)
 * 
 * 弱起小节检测：
 * - 弱起小节的实际时值小于完整小节的时值
 * - 需要按声部分别计算，取最大值（因为多声部同时发声）
 * 
 * @param {Object} measure - First measure
 * @param {Object} timeSignature - Time signature
 * @returns {boolean}
 */
export function isAnacrusis(measure, timeSignature) {
  const expectedBeats = timeSignature.beats
  
  if (!measure.notes || measure.notes.length === 0) {
    return false
  }
  
  // 按声部分组计算时值
  const voiceGroups = new Map()
  measure.notes.forEach(note => {
    const voiceKey = `${note.staff}_${note.voice}`
    if (!voiceGroups.has(voiceKey)) {
      voiceGroups.set(voiceKey, [])
    }
    voiceGroups.get(voiceKey).push(note)
  })
  
  // 计算每个声部的实际时值（考虑音符位置和时值）
  let maxActualBeats = 0
  voiceGroups.forEach(notes => {
    // 找到该声部的最后一个音符的结束位置
    let maxEndBeat = 0
    notes.forEach(note => {
      const endBeat = note.startBeat + (note.duration.ticks / 1024)
      if (endBeat > maxEndBeat) {
        maxEndBeat = endBeat
      }
    })
    // startBeat 从 1 开始，所以实际拍数是 maxEndBeat - 1
    const actualBeats = maxEndBeat - 1
    if (actualBeats > maxActualBeats) {
      maxActualBeats = actualBeats
    }
  })
  
  // 如果实际时值小于期望时值的 90%，认为是弱起小节
  return maxActualBeats < expectedBeats * 0.9
}

/**
 * Identify rhythm pattern for a note
 * 根据 ProjectBlueprint_MSS3.md 规范识别节奏型
 * @param {Object} note - Note object
 * @param {Object} timeSignature - Time signature
 * @param {Array} contextNotes - Surrounding notes for context
 * @returns {string} Rhythm pattern type
 */
export function identifyRhythmPattern(note, timeSignature, contextNotes = []) {
  const startBeat = note.startBeat
  const durationBeats = note.duration.ticks / 1024
  const endBeat = startBeat + durationBeats
  const strongBeats = getStrongBeats(timeSignature)
  
  // Check for syncopation
  const startsOnWeakBeat = !isStrongBeat(startBeat, timeSignature)
  const extendsToStrongBeat = strongBeats.some(sb => startBeat < sb && endBeat >= sb)
  if (startsOnWeakBeat && extendsToStrongBeat) {
    return 'syncopation'
  }
  
  // Check for dotted rhythm
  if (note.duration.dots > 0) {
    if (note.duration.type === 'quarter') return 'dotted_quarter'
    if (note.duration.type === 'eighth') return 'dotted_eighth'
    if (note.duration.dots >= 2) return 'double_dotted'
    return 'dotted'
  }
  
  // Check for triplet
  if (note.duration.tuplet) {
    return 'triplet'
  }
  
  // Check for tied rhythm
  if (note.tiedTo) {
    return 'tied'
  }
  
  // Check for off-beat start (back half of beat)
  const beatFraction = startBeat % 1
  if (beatFraction >= 0.5 && beatFraction < 1) {
    return 'off_beat'
  }
  
  // Check for beat-head pattern
  if (Math.abs(beatFraction) < 0.1) {
    return 'beat_head'
  }
  
  return 'isorhythmic'
}

/**
 * Analyze rhythm patterns in a measure
 * @param {Object} measure - Measure object
 * @param {Object} timeSignature - Time signature
 * @returns {Object} Rhythm analysis result
 */
export function analyzeRhythmPatterns(measure, timeSignature) {
  const patterns = {}
  
  measure.notes.forEach(note => {
    if (note.embellishment) return
    
    const pattern = identifyRhythmPattern(note, timeSignature, measure.notes)
    patterns[pattern] = (patterns[pattern] || 0) + 1
    
    // Assign pattern to note
    note.rhythmPattern = pattern
    
    // Check if this pattern should be LOCKED
    const patternDef = RHYTHM_PATTERNS[pattern]
    if (patternDef && patternDef.locked && !note.isLocked) {
      note.isLocked = true
      note.lockReason = pattern
    }
  })
  
  return patterns
}
