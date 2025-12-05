/**
 * Grand Staff Simplification Rules
 * Levels 1-5 for polyphonic instruments (piano)
 * 
 * 根据 ProjectBlueprint_MSS4.md 和 MSS模型组合架构方案1.md 规范：
 * 
 * 大谱表结构：
 * - 上谱表（高音谱号，右手，staff=1）：Soprano（最高音）+ Alto（中低音）
 * - 下谱表（低音谱号，左手，staff=2）：Tenor（中高音）+ Bass（最低音）
 * 
 * MusicXML输出规范（关键！避免播放节奏错乱）：
 * - Staff 1: voice=1 (Soprano, stem=up), voice=2 (Alto, stem=down)
 * - Staff 2: voice=1 (Tenor, stem=up), voice=2 (Bass, stem=down)
 * 
 * 同一行谱表的两个声部必须上下分开写，不能混在一起！
 * 
 * 声部分离采用三层决策架构：
 * 1. 规则引擎（快速筛选）
 * 2. MusicVAE + KNN（智能归属）
 * 3. K-means 验证（质量检查）
 */

import { getStrongBeats, pitchToMidi, DURATION_DEFINITIONS } from '../knowledge/index.js'
import { applySingleStaffSimplification } from './singleStaff.js'
import { separateVoicesWithAI, isVoiceAIAvailable } from '../ai/voiceSeparation.js'

/**
 * 按拍位分组音符（处理和弦）
 * @param {Array} notes - 音符数组
 * @returns {Map} 拍位 -> 音符数组
 */
function groupNotesByBeat(notes) {
  const groups = new Map()
  if (!notes || !Array.isArray(notes)) return groups
  
  notes.forEach(note => {
    if (!note) return
    // 使用更精确的分组（1/16拍精度）
    const beat = Math.round(note.startBeat * 4) / 4
    if (!groups.has(beat)) {
      groups.set(beat, [])
    }
    groups.get(beat).push(note)
  })
  
  return groups
}

/**
 * 核心声部分离算法（支持AI增强）
 * 
 * 三层决策架构：
 * 1. 规则引擎（快速筛选）- 基于音高的初步分离
 * 2. MusicVAE + KNN（智能归属）- AI辅助处理边界情况
 * 3. K-means 验证（质量检查）- 验证分离结果
 * 
 * 原则：
 * 1. Soprano = 上谱表每个拍位的最高音
 * 2. Alto = 上谱表除Soprano外的其他音符
 * 3. Bass = 下谱表每个拍位的最低音
 * 4. Tenor = 下谱表除Bass外的其他音符
 * 
 * @param {Array} upperStaff - 上谱表音符
 * @param {Array} lowerStaff - 下谱表音符
 * @param {Object} options - 配置选项 { useAI: boolean }
 * @returns {Object} { soprano, alto, tenor, bass }
 */
function separateVoices(upperStaff, lowerStaff, options = {}) {
  // 处理上谱表
  const upperLines = extractVoicesByPitch(upperStaff, false) // 高音优先
  const soprano = upperLines.primaryLine.map(n => ({ ...n, voicePart: 'soprano' }))
  const alto = upperLines.secondaryLine.map(n => ({ ...n, voicePart: 'alto' }))
  
  // 处理下谱表
  const lowerLines = extractVoicesByPitch(lowerStaff, true) // 低音优先
  const bass = lowerLines.primaryLine.map(n => ({ ...n, voicePart: 'bass' }))
  const tenor = lowerLines.secondaryLine.map(n => ({ ...n, voicePart: 'tenor' }))
  
  return { soprano, alto, tenor, bass }
}

/**
 * AI增强的声部分离（异步版本）
 * 使用 MusicVAE + KNN + K-Means 三层决策架构
 * 
 * @param {Array} upperStaff - 上谱表音符
 * @param {Array} lowerStaff - 下谱表音符
 * @returns {Promise<Object>} { soprano, alto, tenor, bass, metadata }
 */
async function separateVoicesAsync(upperStaff, lowerStaff) {
  // 如果AI可用，使用AI增强的声部分离
  if (isVoiceAIAvailable()) {
    try {
      const result = await separateVoicesWithAI(upperStaff, lowerStaff, { useAI: true })
      console.log('Voice separation using AI:', result.metadata?.method || 'ai-assisted')
      return result
    } catch (error) {
      console.warn('AI voice separation failed, falling back to rules:', error.message)
    }
  }
  
  // 降级到规则引擎
  return separateVoices(upperStaff, lowerStaff)
}

/**
 * 按音高分离声部
 * @param {Array} notes - 音符数组
 * @param {boolean} bassFirst - true=低音优先（Bass），false=高音优先（Soprano）
 * @returns {Object} { primaryLine, secondaryLine }
 */
function extractVoicesByPitch(notes, bassFirst = false) {
  if (!notes || notes.length === 0) {
    return { primaryLine: [], secondaryLine: [] }
  }
  
  // 过滤装饰音
  const mainNotes = notes.filter(n => !n.embellishment)
  if (mainNotes.length === 0) {
    return { primaryLine: [], secondaryLine: [] }
  }
  
  // 按拍位分组
  const beatGroups = groupNotesByBeat(mainNotes)
  const sortedBeats = Array.from(beatGroups.keys()).sort((a, b) => a - b)
  
  const primaryLine = []
  const secondaryLine = []
  
  sortedBeats.forEach(beat => {
    const notesAtBeat = beatGroups.get(beat)
    if (!notesAtBeat || notesAtBeat.length === 0) return
    
    // 按音高排序
    const sorted = [...notesAtBeat].sort((a, b) => {
      const pitchA = pitchToMidi(a.pitch)
      const pitchB = pitchToMidi(b.pitch)
      return bassFirst ? pitchA - pitchB : pitchB - pitchA
    })
    
    // 第一个音符是主声部
    primaryLine.push({ ...sorted[0] })
    
    // 其余音符是副声部
    for (let i = 1; i < sorted.length; i++) {
      secondaryLine.push({ ...sorted[i] })
    }
  })
  
  return { primaryLine, secondaryLine }
}

/**
 * 强拍简化：只保留强拍位置的音符
 * 
 * 核心原则（方整性结构保护）：
 * 1. 每小节第一个音符的位置固定不变（保持弱起结构）
 * 2. 其他音符移动到强拍位置
 * 3. 时值延长到下一个强拍
 * 
 * @param {Array} notes - 音符数组
 * @param {Object} timeSignature - 拍号
 * @returns {Array} 简化后的音符
 */
function applyStrongBeatOnly(notes, timeSignature) {
  if (!notes || notes.length === 0) return []
  
  const mainNotes = notes.filter(n => !n.embellishment)
  if (mainNotes.length === 0) return []
  
  const strongBeats = getStrongBeats(timeSignature)
  const result = []
  const usedNotes = new Set()
  
  // 按起始拍位排序
  const sortedNotes = [...mainNotes].sort((a, b) => a.startBeat - b.startBeat)
  
  // 检查第一个音符是否在第一拍之前（弱起）
  const firstNote = sortedNotes[0]
  const isFirstNoteAnacrusis = firstNote && firstNote.startBeat < 1
  
  strongBeats.forEach((strongBeat, idx) => {
    // 查找该强拍位置或之前最近的音符
    let noteAtBeat = sortedNotes.find(n => !usedNotes.has(n.id) && Math.abs(n.startBeat - strongBeat) < 0.25)
    
    // 如果没找到，找覆盖该强拍的音符
    if (!noteAtBeat) {
      noteAtBeat = sortedNotes.find(n => {
        if (usedNotes.has(n.id)) return false
        const endBeat = n.startBeat + (n.duration.ticks / 1024)
        return n.startBeat <= strongBeat && endBeat > strongBeat
      })
    }
    
    // 如果还没找到，找最近的音符
    if (!noteAtBeat) {
      let minDistance = Infinity
      sortedNotes.forEach(n => {
        if (usedNotes.has(n.id)) return
        const distance = Math.abs(n.startBeat - strongBeat)
        if (distance < minDistance && distance < 2) {
          minDistance = distance
          noteAtBeat = n
        }
      })
    }
    
    if (!noteAtBeat) return
    
    usedNotes.add(noteAtBeat.id)
    
    // 计算到下一个强拍的时值
    const nextStrongBeat = strongBeats[idx + 1] || (timeSignature.beats + 1)
    const durationBeats = nextStrongBeat - strongBeat
    const durationTicks = durationBeats * 1024
    
    // 【关键】音符移动到强拍位置，确保时值正确
    // 只有弱起小节的第一个音符保持原位
    const shouldKeepOriginalPosition = (idx === 0 && isFirstNoteAnacrusis && noteAtBeat === firstNote)
    
    result.push({
      ...noteAtBeat,
      startBeat: shouldKeepOriginalPosition ? noteAtBeat.startBeat : strongBeat,
      duration: {
        type: getDurationTypeFromTicks(durationTicks),
        dots: 0,
        ticks: durationTicks
      }
    })
  })
  
  return result
}

/**
 * 根据 ticks 获取时值类型
 */
function getDurationTypeFromTicks(ticks) {
  if (ticks >= 4096) return 'whole'
  if (ticks >= 2048) return 'half'
  if (ticks >= 1024) return 'quarter'
  if (ticks >= 512) return 'eighth'
  if (ticks >= 256) return 'sixteenth'
  return '32nd'
}

/**
 * Level 1: 双声部骨架（最简化）
 * 右手：Soprano（可选L1-5，默认L4）
 * 左手：Bass（每小节首音，可选L1-5）
 */
export function applyGrandStaffLevel1(measure, timeSignature, config = {}) {
  const sopranoLevel = config.sopranoLevel || 4
  const bassLevel = config.bassLevel || 1
  
  const upperStaff = (measure.notes || []).filter(n => n && n.staff === 1)
  const lowerStaff = (measure.notes || []).filter(n => n && n.staff === 2)
  
  const { soprano, bass } = separateVoices(upperStaff, lowerStaff)
  
  const simplifiedSoprano = soprano.length > 0 
    ? applySingleStaffSimplification({ ...measure, notes: soprano }, sopranoLevel, timeSignature)
    : { notes: [] }
  
  const simplifiedBass = bass.length > 0
    ? applySingleStaffSimplification({ ...measure, notes: bass }, bassLevel, timeSignature)
    : { notes: [] }
  
  // 关键：正确设置 voice 编号
  const resultNotes = [
    ...simplifiedSoprano.notes.map(n => ({ ...n, staff: 1, voicePart: 'soprano', voice: 1 })),
    ...simplifiedBass.notes.map(n => ({ ...n, staff: 2, voicePart: 'bass', voice: 2 }))
  ]
  
  return { ...measure, notes: resultNotes, rests: [] }
}

/**
 * Level 2: 三声部（右手加强）
 * 右手：Soprano（可选L2-5，默认L4）+ Alto（强拍）
 * 左手：Bass（强拍，可选L2-5）
 */
export function applyGrandStaffLevel2(measure, timeSignature, config = {}) {
  const sopranoLevel = config.sopranoLevel || 4
  const bassLevel = config.bassLevel || 2
  
  const upperStaff = (measure.notes || []).filter(n => n && n.staff === 1)
  const lowerStaff = (measure.notes || []).filter(n => n && n.staff === 2)
  
  const { soprano, alto, bass } = separateVoices(upperStaff, lowerStaff)
  
  const simplifiedSoprano = soprano.length > 0
    ? applySingleStaffSimplification({ ...measure, notes: soprano }, sopranoLevel, timeSignature)
    : { notes: [] }
  
  const simplifiedAlto = alto.length > 0 
    ? applyStrongBeatOnly(alto, timeSignature)
    : []
  
  const simplifiedBass = bass.length > 0
    ? applySingleStaffSimplification({ ...measure, notes: bass }, bassLevel, timeSignature)
    : { notes: [] }
  
  const resultNotes = [
    ...simplifiedSoprano.notes.map(n => ({ ...n, staff: 1, voicePart: 'soprano', voice: 1 })),
    ...simplifiedAlto.map(n => ({ ...n, staff: 1, voicePart: 'alto', voice: 2 })),
    ...simplifiedBass.notes.map(n => ({ ...n, staff: 2, voicePart: 'bass', voice: 2 }))
  ]
  
  return { ...measure, notes: resultNotes, rests: [] }
}

/**
 * Level 3: 三声部（左手加强）
 * 右手：Soprano（可选L2-5，默认L5）
 * 左手：Tenor（强拍）+ Bass（强拍，可选L2-5）
 */
export function applyGrandStaffLevel3(measure, timeSignature, config = {}) {
  const sopranoLevel = config.sopranoLevel || 5
  const bassLevel = config.bassLevel || 2
  
  const upperStaff = (measure.notes || []).filter(n => n && n.staff === 1)
  const lowerStaff = (measure.notes || []).filter(n => n && n.staff === 2)
  
  const { soprano, tenor, bass } = separateVoices(upperStaff, lowerStaff)
  
  const simplifiedSoprano = soprano.length > 0
    ? applySingleStaffSimplification({ ...measure, notes: soprano }, sopranoLevel, timeSignature)
    : { notes: [] }
  
  const simplifiedTenor = tenor.length > 0
    ? applyStrongBeatOnly(tenor, timeSignature)
    : []
  
  const simplifiedBass = bass.length > 0
    ? applySingleStaffSimplification({ ...measure, notes: bass }, bassLevel, timeSignature)
    : { notes: [] }
  
  const resultNotes = [
    ...simplifiedSoprano.notes.map(n => ({ ...n, staff: 1, voicePart: 'soprano', voice: 1 })),
    ...simplifiedTenor.map(n => ({ ...n, staff: 2, voicePart: 'tenor', voice: 1 })),
    ...simplifiedBass.notes.map(n => ({ ...n, staff: 2, voicePart: 'bass', voice: 2 }))
  ]
  
  return { ...measure, notes: resultNotes, rests: [] }
}

/**
 * Level 4: 四声部完整和声（强拍简化）
 * 右手：Soprano（可选L2-5，默认L4）+ Alto（强拍）
 * 左手：Tenor（强拍）+ Bass（强拍，可选L2-5）
 */
export function applyGrandStaffLevel4(measure, timeSignature, config = {}) {
  const sopranoLevel = config.sopranoLevel || 4
  const bassLevel = config.bassLevel || 2
  
  const upperStaff = (measure.notes || []).filter(n => n && n.staff === 1)
  const lowerStaff = (measure.notes || []).filter(n => n && n.staff === 2)
  
  const { soprano, alto, tenor, bass } = separateVoices(upperStaff, lowerStaff)
  
  const simplifiedSoprano = soprano.length > 0
    ? applySingleStaffSimplification({ ...measure, notes: soprano }, sopranoLevel, timeSignature)
    : { notes: [] }
  
  const simplifiedAlto = alto.length > 0
    ? applyStrongBeatOnly(alto, timeSignature)
    : []
  
  const simplifiedTenor = tenor.length > 0
    ? applyStrongBeatOnly(tenor, timeSignature)
    : []
  
  const simplifiedBass = bass.length > 0
    ? applySingleStaffSimplification({ ...measure, notes: bass }, bassLevel, timeSignature)
    : { notes: [] }
  
  const resultNotes = [
    ...simplifiedSoprano.notes.map(n => ({ ...n, staff: 1, voicePart: 'soprano', voice: 1 })),
    ...simplifiedAlto.map(n => ({ ...n, staff: 1, voicePart: 'alto', voice: 2 })),
    ...simplifiedTenor.map(n => ({ ...n, staff: 2, voicePart: 'tenor', voice: 1 })),
    ...simplifiedBass.notes.map(n => ({ ...n, staff: 2, voicePart: 'bass', voice: 2 }))
  ]
  
  return { ...measure, notes: resultNotes, rests: [] }
}

/**
 * Level 5: 四声部基本还原原谱
 * 右手：Soprano（可选L4-5，默认L5）+ Alto（L5，只移除装饰音）
 * 左手：Tenor（L5）+ Bass（可选L4-5，默认L5）
 */
export function applyGrandStaffLevel5(measure, timeSignature, config = {}) {
  const sopranoLevel = config.sopranoLevel || 5
  const bassLevel = config.bassLevel || 5
  
  const upperStaff = (measure.notes || []).filter(n => n && n.staff === 1)
  const lowerStaff = (measure.notes || []).filter(n => n && n.staff === 2)
  
  const { soprano, alto, tenor, bass } = separateVoices(upperStaff, lowerStaff)
  
  const simplifiedSoprano = soprano.length > 0
    ? applySingleStaffSimplification({ ...measure, notes: soprano }, sopranoLevel, timeSignature)
    : { notes: [] }
  
  const simplifiedAlto = alto.length > 0
    ? applySingleStaffSimplification({ ...measure, notes: alto }, 5, timeSignature)
    : { notes: [] }
  
  const simplifiedTenor = tenor.length > 0
    ? applySingleStaffSimplification({ ...measure, notes: tenor }, 5, timeSignature)
    : { notes: [] }
  
  const simplifiedBass = bass.length > 0
    ? applySingleStaffSimplification({ ...measure, notes: bass }, bassLevel, timeSignature)
    : { notes: [] }
  
  const resultNotes = [
    ...simplifiedSoprano.notes.map(n => ({ ...n, staff: 1, voicePart: 'soprano', voice: 1 })),
    ...simplifiedAlto.notes.map(n => ({ ...n, staff: 1, voicePart: 'alto', voice: 2 })),
    ...simplifiedTenor.notes.map(n => ({ ...n, staff: 2, voicePart: 'tenor', voice: 1 })),
    ...simplifiedBass.notes.map(n => ({ ...n, staff: 2, voicePart: 'bass', voice: 2 }))
  ]
  
  return { ...measure, notes: resultNotes, rests: [] }
}

/**
 * 应用大谱表简化（同步版本，使用规则引擎）
 */
export function applyGrandStaffSimplification(measure, level, timeSignature, config = {}) {
  switch (level) {
    case 1: return applyGrandStaffLevel1(measure, timeSignature, config)
    case 2: return applyGrandStaffLevel2(measure, timeSignature, config)
    case 3: return applyGrandStaffLevel3(measure, timeSignature, config)
    case 4: return applyGrandStaffLevel4(measure, timeSignature, config)
    case 5: return applyGrandStaffLevel5(measure, timeSignature, config)
    default: return measure
  }
}

/**
 * 应用大谱表简化（异步版本，支持AI声部分离）
 * 
 * 使用三层决策架构：
 * 1. 规则引擎（快速筛选）
 * 2. MusicVAE + KNN（智能归属）
 * 3. K-means 验证（质量检查）
 */
export async function applyGrandStaffSimplificationAsync(measure, level, timeSignature, config = {}) {
  const upperStaff = (measure.notes || []).filter(n => n && n.staff === 1)
  const lowerStaff = (measure.notes || []).filter(n => n && n.staff === 2)
  
  // 使用AI增强的声部分离
  const voices = await separateVoicesAsync(upperStaff, lowerStaff)
  
  // 根据Level应用简化规则
  return applySimplificationWithVoices(measure, level, timeSignature, voices, config)
}

/**
 * 使用已分离的声部应用简化规则
 */
function applySimplificationWithVoices(measure, level, timeSignature, voices, config) {
  const { soprano = [], alto = [], tenor = [], bass = [] } = voices
  const sopranoLevel = config.sopranoLevel || getDefaultSopranoLevel(level)
  const bassLevel = config.bassLevel || getDefaultBassLevel(level)
  
  let resultNotes = []
  
  switch (level) {
    case 1: {
      // Level 1: Soprano + Bass
      const simplifiedSoprano = soprano.length > 0 
        ? applySingleStaffSimplification({ ...measure, notes: soprano }, sopranoLevel, timeSignature)
        : { notes: [] }
      const simplifiedBass = bass.length > 0
        ? applySingleStaffSimplification({ ...measure, notes: bass }, bassLevel, timeSignature)
        : { notes: [] }
      resultNotes = [
        ...simplifiedSoprano.notes.map(n => ({ ...n, staff: 1, voicePart: 'soprano', voice: 1 })),
        ...simplifiedBass.notes.map(n => ({ ...n, staff: 2, voicePart: 'bass', voice: 2 }))
      ]
      break
    }
    case 2: {
      // Level 2: Soprano + Alto(强拍) + Bass
      const simplifiedSoprano = soprano.length > 0
        ? applySingleStaffSimplification({ ...measure, notes: soprano }, sopranoLevel, timeSignature)
        : { notes: [] }
      const simplifiedAlto = alto.length > 0 
        ? applyStrongBeatOnly(alto, timeSignature)
        : []
      const simplifiedBass = bass.length > 0
        ? applySingleStaffSimplification({ ...measure, notes: bass }, bassLevel, timeSignature)
        : { notes: [] }
      resultNotes = [
        ...simplifiedSoprano.notes.map(n => ({ ...n, staff: 1, voicePart: 'soprano', voice: 1 })),
        ...simplifiedAlto.map(n => ({ ...n, staff: 1, voicePart: 'alto', voice: 2 })),
        ...simplifiedBass.notes.map(n => ({ ...n, staff: 2, voicePart: 'bass', voice: 2 }))
      ]
      break
    }
    case 3: {
      // Level 3: Soprano + Tenor(强拍) + Bass
      const simplifiedSoprano = soprano.length > 0
        ? applySingleStaffSimplification({ ...measure, notes: soprano }, sopranoLevel, timeSignature)
        : { notes: [] }
      const simplifiedTenor = tenor.length > 0
        ? applyStrongBeatOnly(tenor, timeSignature)
        : []
      const simplifiedBass = bass.length > 0
        ? applySingleStaffSimplification({ ...measure, notes: bass }, bassLevel, timeSignature)
        : { notes: [] }
      resultNotes = [
        ...simplifiedSoprano.notes.map(n => ({ ...n, staff: 1, voicePart: 'soprano', voice: 1 })),
        ...simplifiedTenor.map(n => ({ ...n, staff: 2, voicePart: 'tenor', voice: 1 })),
        ...simplifiedBass.notes.map(n => ({ ...n, staff: 2, voicePart: 'bass', voice: 2 }))
      ]
      break
    }
    case 4: {
      // Level 4: 四声部完整和声
      const simplifiedSoprano = soprano.length > 0
        ? applySingleStaffSimplification({ ...measure, notes: soprano }, sopranoLevel, timeSignature)
        : { notes: [] }
      const simplifiedAlto = alto.length > 0
        ? applyStrongBeatOnly(alto, timeSignature)
        : []
      const simplifiedTenor = tenor.length > 0
        ? applyStrongBeatOnly(tenor, timeSignature)
        : []
      const simplifiedBass = bass.length > 0
        ? applySingleStaffSimplification({ ...measure, notes: bass }, bassLevel, timeSignature)
        : { notes: [] }
      resultNotes = [
        ...simplifiedSoprano.notes.map(n => ({ ...n, staff: 1, voicePart: 'soprano', voice: 1 })),
        ...simplifiedAlto.map(n => ({ ...n, staff: 1, voicePart: 'alto', voice: 2 })),
        ...simplifiedTenor.map(n => ({ ...n, staff: 2, voicePart: 'tenor', voice: 1 })),
        ...simplifiedBass.notes.map(n => ({ ...n, staff: 2, voicePart: 'bass', voice: 2 }))
      ]
      break
    }
    case 5: {
      // Level 5: 四声部基本还原
      const simplifiedSoprano = soprano.length > 0
        ? applySingleStaffSimplification({ ...measure, notes: soprano }, sopranoLevel, timeSignature)
        : { notes: [] }
      const simplifiedAlto = alto.length > 0
        ? applySingleStaffSimplification({ ...measure, notes: alto }, 5, timeSignature)
        : { notes: [] }
      const simplifiedTenor = tenor.length > 0
        ? applySingleStaffSimplification({ ...measure, notes: tenor }, 5, timeSignature)
        : { notes: [] }
      const simplifiedBass = bass.length > 0
        ? applySingleStaffSimplification({ ...measure, notes: bass }, bassLevel, timeSignature)
        : { notes: [] }
      resultNotes = [
        ...simplifiedSoprano.notes.map(n => ({ ...n, staff: 1, voicePart: 'soprano', voice: 1 })),
        ...simplifiedAlto.notes.map(n => ({ ...n, staff: 1, voicePart: 'alto', voice: 2 })),
        ...simplifiedTenor.notes.map(n => ({ ...n, staff: 2, voicePart: 'tenor', voice: 1 })),
        ...simplifiedBass.notes.map(n => ({ ...n, staff: 2, voicePart: 'bass', voice: 2 }))
      ]
      break
    }
    default:
      return measure
  }
  
  return { ...measure, notes: resultNotes, rests: [] }
}

/**
 * 获取默认Soprano级别
 */
function getDefaultSopranoLevel(level) {
  const defaults = { 1: 4, 2: 4, 3: 5, 4: 4, 5: 5 }
  return defaults[level] || 4
}

/**
 * 获取默认Bass级别
 */
function getDefaultBassLevel(level) {
  const defaults = { 1: 1, 2: 2, 3: 2, 4: 2, 5: 5 }
  return defaults[level] || 2
}
