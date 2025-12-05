import { getStrongBeats } from '../knowledge/index.js'

export function applyLevel1(measure, timeSignature) {
  const notes = measure.notes.filter(n => !n.embellishment)
  if (notes.length === 0) return { ...measure, notes: [] }
  const sortedNotes = [...notes].sort((a, b) => a.startBeat - b.startBeat)
  const firstNote = sortedNotes[0]
  const measureDuration = timeSignature.beats * 1024
  return {
    ...measure,
    notes: [{
      ...firstNote,
      startBeat: 1,
      duration: { type: getDurationTypeFromTicks(measureDuration), ticks: measureDuration, dots: 0 }
    }],
    rests: []
  }
}

/**
 * Level 2: 强拍简化
 * 
 * 核心原则（方整性结构保护）：
 * 1. 弱起小节的第一个音符保持原位
 * 2. 其他音符移动到强拍位置
 * 3. 时值延长到下一个强拍
 */
export function applyLevel2(measure, timeSignature) {
  const notes = measure.notes.filter(n => !n.embellishment)
  if (notes.length === 0) return { ...measure, notes: [] }
  
  const strongBeats = getStrongBeats(timeSignature)
  const result = []
  const usedNotes = new Set()
  
  // 按起始拍位排序
  const sortedNotes = [...notes].sort((a, b) => a.startBeat - b.startBeat)
  
  // 检查第一个音符是否在第一拍之前（弱起）
  const firstNote = sortedNotes[0]
  const isFirstNoteAnacrusis = firstNote && firstNote.startBeat < 1
  
  strongBeats.forEach((strongBeat, idx) => {
    const noteAtBeat = findNoteAtBeatExcluding(sortedNotes, strongBeat, usedNotes)
    if (!noteAtBeat) return
    
    usedNotes.add(noteAtBeat.id)
    
    const nextStrongBeat = strongBeats[idx + 1] || (timeSignature.beats + 1)
    const durationTicks = (nextStrongBeat - strongBeat) * 1024
    
    // 【关键】音符移动到强拍位置，确保时值正确
    // 只有弱起小节的第一个音符保持原位
    const shouldKeepOriginalPosition = (idx === 0 && isFirstNoteAnacrusis && noteAtBeat === firstNote)
    
    result.push({
      ...noteAtBeat,
      startBeat: shouldKeepOriginalPosition ? noteAtBeat.startBeat : strongBeat,
      duration: { type: getDurationTypeFromTicks(durationTicks), ticks: durationTicks, dots: 0 }
    })
  })
  return { ...measure, notes: result, rests: [] }
}

export function applyLevel3(measure, timeSignature) {
  const notes = measure.notes.filter(n => !n.embellishment)
  if (notes.length === 0) return { ...measure, notes: [] }
  const result = []
  for (let beat = 1; beat <= timeSignature.beats; beat++) {
    const noteAtBeat = findNoteAtBeat(notes, beat)
    if (!noteAtBeat) continue
    result.push({
      ...noteAtBeat,
      startBeat: beat,
      duration: { type: 'quarter', ticks: 1024, dots: 0 }
    })
  }
  return { ...measure, notes: result, rests: [] }
}


export function applyLevel4(measure, timeSignature) {
  const result = []
  const processedPositions = new Set()
  const sortedNotes = [...measure.notes].sort((a, b) => a.startBeat - b.startBeat)
  
  // 分离装饰音和主音
  const mainNotes = sortedNotes.filter(n => !n.embellishment)
  const embellishments = sortedNotes.filter(n => n.embellishment)
  
  // 将装饰音合并到最近的LOCKED主音（如果有）
  embellishments.forEach(emb => {
    const nearestLocked = mainNotes
      .filter(n => n.isLocked)
      .reduce((nearest, n) => {
        const dist = Math.abs(n.startBeat - emb.startBeat)
        if (!nearest || dist < nearest.dist) return { note: n, dist }
        return nearest
      }, null)
    // 装饰音不独立保留，仅标记已处理
  })
  
  mainNotes.forEach(note => {
    if (note.isLocked) {
      result.push({ ...note })
      return
    }
    const ticks = note.duration.ticks
    if (ticks >= 512) {
      result.push({ ...note })
      return
    }
    if (note.duration.tuplet) {
      const { actual, normal } = note.duration.tuplet
      const tripletBeatUnit = 1 / actual
      const tripletPosition = Math.floor(note.startBeat / tripletBeatUnit) * tripletBeatUnit
      const posKey = 'triplet_' + tripletPosition.toFixed(3)
      if (!processedPositions.has(posKey)) {
        processedPositions.add(posKey)
        result.push({
          ...note,
          startBeat: tripletPosition,
          duration: { type: 'eighth', dots: 0, ticks: Math.round(512 * normal / actual), tuplet: { actual, normal } }
        })
      }
      return
    }
    const eighthBeatPosition = Math.floor(note.startBeat * 2) / 2
    const posKey = 'eighth_' + eighthBeatPosition.toFixed(2)
    if (!processedPositions.has(posKey)) {
      processedPositions.add(posKey)
      result.push({
        ...note,
        startBeat: eighthBeatPosition,
        duration: { type: 'eighth', dots: 0, ticks: 512 }
      })
    }
  })
  
  // 处理休止符：短于八分休止符的统一延长为八分休止符
  const simplifiedRests = (measure.rests || []).map(rest => {
    if (rest.duration.ticks < 512) {
      return {
        ...rest,
        duration: { type: 'eighth', dots: 0, ticks: 512 }
      }
    }
    return rest
  })
  
  return { ...measure, notes: result, rests: simplifiedRests }
}

export function applyLevel5(measure, timeSignature) {
  // Level 5: 移除装饰音，其他按原谱保留
  // 装饰音不得独立保留，可合并到最近的LOCKED主音
  const mainNotes = measure.notes.filter(n => !n.embellishment)
  const embellishments = measure.notes.filter(n => n.embellishment)
  
  // 装饰音处理：找到最近的主音并标记（用于演奏提示，但不改变音符本身）
  embellishments.forEach(emb => {
    const nearestMain = mainNotes.reduce((nearest, n) => {
      const dist = Math.abs(n.startBeat - emb.startBeat)
      if (!nearest || dist < nearest.dist) return { note: n, dist }
      return nearest
    }, null)
    if (nearestMain && nearestMain.note) {
      // 可选：标记该主音曾有装饰音
      nearestMain.note.hadEmbellishment = emb.embellishment
    }
  })
  
  return { ...measure, notes: mainNotes, rests: measure.rests }
}

function findNoteAtBeat(notes, beat) {
  if (!notes || notes.length === 0) return null
  let note = notes.find(n => Math.abs(n.startBeat - beat) < 0.1)
  if (!note) {
    note = notes.find(n => {
      const endBeat = n.startBeat + (n.duration.ticks / 1024)
      return n.startBeat <= beat && endBeat > beat
    })
  }
  if (!note) {
    let minDistance = Infinity
    notes.forEach(n => {
      const distance = Math.abs(n.startBeat - beat)
      if (distance < minDistance) {
        minDistance = distance
        note = n
      }
    })
  }
  return note
}

/**
 * 查找指定拍位的音符，排除已使用的音符
 */
function findNoteAtBeatExcluding(notes, beat, usedNotes) {
  if (!notes || notes.length === 0) return null
  
  // 首先查找精确匹配
  let note = notes.find(n => !usedNotes.has(n.id) && Math.abs(n.startBeat - beat) < 0.1)
  
  // 查找覆盖该拍位的音符
  if (!note) {
    note = notes.find(n => {
      if (usedNotes.has(n.id)) return false
      const endBeat = n.startBeat + (n.duration.ticks / 1024)
      return n.startBeat <= beat && endBeat > beat
    })
  }
  
  // 查找最近的音符
  if (!note) {
    let minDistance = Infinity
    notes.forEach(n => {
      if (usedNotes.has(n.id)) return
      const distance = Math.abs(n.startBeat - beat)
      if (distance < minDistance && distance < 2) {
        minDistance = distance
        note = n
      }
    })
  }
  
  return note
}

function getDurationTypeFromTicks(ticks) {
  if (ticks >= 4096) return 'whole'
  if (ticks >= 2048) return 'half'
  if (ticks >= 1024) return 'quarter'
  if (ticks >= 512) return 'eighth'
  if (ticks >= 256) return 'sixteenth'
  return '32nd'
}

export function applySingleStaffSimplification(measure, level, timeSignature) {
  switch (level) {
    case 1: return applyLevel1(measure, timeSignature)
    case 2: return applyLevel2(measure, timeSignature)
    case 3: return applyLevel3(measure, timeSignature)
    case 4: return applyLevel4(measure, timeSignature)
    case 5: return applyLevel5(measure, timeSignature)
    default: return measure
  }
}
