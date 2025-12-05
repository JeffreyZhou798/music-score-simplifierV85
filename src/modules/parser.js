/**
 * MusicXML Parser Module
 * Handles parsing of .mxl and .musicxml files
 */

import JSZip from 'jszip'
import { DURATION_DEFINITIONS, pitchToMidi } from '../knowledge/index.js'

let noteIdCounter = 0
const generateNoteId = () => `note_${++noteIdCounter}`

/**
 * Parse a MusicXML file (either .mxl or .musicxml)
 * @param {File} file - The uploaded file
 * @returns {Promise<Object>} Parsed score object
 */
export async function parseFile(file) {
  noteIdCounter = 0
  const fileName = file.name.toLowerCase()
  
  let xmlContent
  if (fileName.endsWith('.mxl')) {
    xmlContent = await parseMxlFile(file)
  } else if (fileName.endsWith('.musicxml') || fileName.endsWith('.xml')) {
    xmlContent = await file.text()
  } else {
    throw new Error('INVALID_FILE_FORMAT')
  }
  
  return parseXmlContent(xmlContent)
}

/**
 * Parse compressed .mxl file
 * @param {File} file - The .mxl file
 * @returns {Promise<string>} XML content
 */
async function parseMxlFile(file) {
  const zip = new JSZip()
  const contents = await zip.loadAsync(file)
  
  // Find the root file from META-INF/container.xml
  const containerFile = contents.file('META-INF/container.xml')
  let rootFilePath = null
  
  if (containerFile) {
    const containerXml = await containerFile.async('string')
    const parser = new DOMParser()
    const containerDoc = parser.parseFromString(containerXml, 'text/xml')
    const rootFile = containerDoc.querySelector('rootfile')
    if (rootFile) {
      rootFilePath = rootFile.getAttribute('full-path')
    }
  }
  
  // Fallback: look for any .xml file
  if (!rootFilePath) {
    const xmlFiles = Object.keys(contents.files).filter(
      name => name.endsWith('.xml') && !name.startsWith('META-INF')
    )
    rootFilePath = xmlFiles[0]
  }
  
  if (!rootFilePath || !contents.file(rootFilePath)) {
    throw new Error('PARSE_ERROR')
  }
  
  return await contents.file(rootFilePath).async('string')
}

/**
 * Parse XML content into score structure
 * @param {string} xmlContent - Raw XML string
 * @returns {Object} Parsed score
 */
function parseXmlContent(xmlContent) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlContent, 'text/xml')
  
  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    throw new Error('PARSE_ERROR')
  }
  
  const metadata = parseMetadata(doc)
  const measures = parseMeasures(doc, metadata.timeSignature)
  
  return {
    metadata,
    measures,
    rawXml: xmlContent
  }
}


/**
 * Parse score metadata
 * @param {Document} doc - XML document
 * @returns {Object} Metadata object
 */
function parseMetadata(doc) {
  // Title - try multiple sources in order of preference
  const workTitle = doc.querySelector('work-title')
  const movementTitle = doc.querySelector('movement-title')
  
  // Try credit-words for title (usually the first one with large font or centered)
  let creditTitle = null
  const creditWordsList = doc.querySelectorAll('credit-words')
  for (const cw of creditWordsList) {
    const fontSize = cw.getAttribute('font-size')
    const justify = cw.getAttribute('justify')
    // Title is usually the first credit-words with large font or centered
    if ((fontSize && parseInt(fontSize) >= 18) || justify === 'center') {
      creditTitle = cw.textContent?.trim()
      break
    }
  }
  
  const title = workTitle?.textContent || movementTitle?.textContent || creditTitle || 'Untitled'
  
  // Composer - try multiple sources
  const creator = doc.querySelector('creator[type="composer"]')
  const identification = doc.querySelector('identification creator')
  
  // Try credit-words for composer (usually contains composer name patterns)
  let creditComposer = null
  for (const cw of creditWordsList) {
    const text = cw.textContent?.trim() || ''
    // Look for common composer name patterns (dates in parentheses, or "right" justified)
    if (text.match(/\(\d{4}\s*-\s*\d{4}\)/) || cw.getAttribute('justify') === 'right') {
      // Extract name without dates
      creditComposer = text.replace(/\s*\(\d{4}\s*-\s*\d{4}\)/, '').trim()
      break
    }
  }
  
  const composer = creator?.textContent || identification?.textContent || creditComposer || 'Unknown'
  
  // Tempo
  const soundEl = doc.querySelector('sound[tempo]')
  const tempo = soundEl ? parseInt(soundEl.getAttribute('tempo')) : 120
  
  // Time Signature
  const timeEl = doc.querySelector('time')
  const timeSignature = {
    beats: parseInt(timeEl?.querySelector('beats')?.textContent || '4'),
    beatType: parseInt(timeEl?.querySelector('beat-type')?.textContent || '4'),
    type: 'simple'
  }
  // Determine if compound
  if ([6, 9, 12].includes(timeSignature.beats) && timeSignature.beatType === 8) {
    timeSignature.type = 'compound'
  }
  
  // Key Signature
  const keyEl = doc.querySelector('key')
  const keySignature = {
    fifths: parseInt(keyEl?.querySelector('fifths')?.textContent || '0'),
    mode: keyEl?.querySelector('mode')?.textContent || 'major'
  }
  
  // Clefs
  const clefEls = doc.querySelectorAll('clef')
  const clefs = Array.from(clefEls).map(clef => {
    const sign = clef.querySelector('sign')?.textContent || 'G'
    const line = clef.querySelector('line')?.textContent || '2'
    return `${sign}${line}`
  })
  
  // Text annotations
  const textEls = doc.querySelectorAll('words, direction-type > words')
  const textAnnotations = Array.from(textEls).map(el => el.textContent).filter(Boolean)
  
  return { title, composer, tempo, timeSignature, keySignature, clefs, textAnnotations }
}

/**
 * Parse all measures from the score
 * 
 * 关键修复：正确处理 MusicXML 的 backup 和 forward 元素
 * - backup: 回退时间位置（用于开始新声部）
 * - forward: 前进时间位置（用于跳过空白）
 * 
 * @param {Document} doc - XML document
 * @param {Object} timeSignature - Time signature for beat calculations
 * @returns {Array} Array of measure objects
 */
function parseMeasures(doc, timeSignature) {
  const measureEls = doc.querySelectorAll('measure')
  const measures = []
  
  // 获取 divisions（每四分音符的分割数）
  const divisionsEl = doc.querySelector('divisions')
  let globalDivisions = parseInt(divisionsEl?.textContent || '1')
  
  measureEls.forEach((measureEl, index) => {
    const measureNum = parseInt(measureEl.getAttribute('number') || (index + 1))
    const notes = []
    const rests = []
    
    // 检查小节内是否有 divisions 定义
    const localDivisionsEl = measureEl.querySelector('attributes > divisions')
    if (localDivisionsEl) {
      globalDivisions = parseInt(localDivisionsEl.textContent)
    }
    const divisions = globalDivisions
    
    let currentBeat = 1
    let lastNonChordBeat = 1
    
    // 遍历小节内的所有子元素（按顺序处理 note, backup, forward）
    const children = measureEl.children
    for (let i = 0; i < children.length; i++) {
      const child = children[i]
      const tagName = child.tagName.toLowerCase()
      
      if (tagName === 'backup') {
        // backup 元素：回退时间位置
        const backupDuration = parseInt(child.querySelector('duration')?.textContent || '0')
        const backupBeats = backupDuration / divisions
        currentBeat -= backupBeats
        lastNonChordBeat = currentBeat
      } else if (tagName === 'forward') {
        // forward 元素：前进时间位置
        const forwardDuration = parseInt(child.querySelector('duration')?.textContent || '0')
        const forwardBeats = forwardDuration / divisions
        currentBeat += forwardBeats
        lastNonChordBeat = currentBeat
      } else if (tagName === 'note') {
        const noteEl = child
        const isRest = noteEl.querySelector('rest') !== null
        const isChord = noteEl.querySelector('chord') !== null
        const isGrace = noteEl.querySelector('grace') !== null
        
        // 装饰音（grace notes）没有 duration，不推进时间
        const durationEl = noteEl.querySelector('duration')
        const duration = durationEl ? parseInt(durationEl.textContent) : 0
        const durationBeats = duration / divisions
        
        // 和弦音符使用与前一个音符相同的起始拍
        const noteStartBeat = isChord ? lastNonChordBeat : currentBeat
        
        if (isRest) {
          rests.push({
            id: generateNoteId(),
            duration: parseDuration(noteEl, divisions),
            startBeat: noteStartBeat,
            voice: parseInt(noteEl.querySelector('voice')?.textContent || '1'),
            staff: parseInt(noteEl.querySelector('staff')?.textContent || '1')
          })
          // 休止符也推进时间（非和弦）
          if (!isChord) {
            lastNonChordBeat = noteStartBeat
            currentBeat += durationBeats
          }
        } else {
          const note = parseNote(noteEl, noteStartBeat, divisions)
          if (note) notes.push(note)
          
          // 只有非和弦、非装饰音才推进拍位
          if (!isChord && !isGrace && durationBeats > 0) {
            lastNonChordBeat = noteStartBeat
            currentBeat += durationBeats
          }
        }
      }
    }
    
    measures.push({ number: measureNum, notes, rests })
  })
  
  return measures
}


/**
 * Parse a single note element
 * @param {Element} noteEl - Note XML element
 * @param {number} startBeat - Starting beat position
 * @param {number} divisions - Divisions per quarter note
 * @returns {Object|null} Note object
 */
function parseNote(noteEl, startBeat, divisions) {
  const pitchEl = noteEl.querySelector('pitch')
  if (!pitchEl) return null
  
  const pitch = {
    step: pitchEl.querySelector('step')?.textContent || 'C',
    octave: parseInt(pitchEl.querySelector('octave')?.textContent || '4'),
    alter: parseInt(pitchEl.querySelector('alter')?.textContent || '0')
  }
  
  const duration = parseDuration(noteEl, divisions)
  const voice = parseInt(noteEl.querySelector('voice')?.textContent || '1')
  const staff = parseInt(noteEl.querySelector('staff')?.textContent || '1')
  
  // Check for ties
  const tieEls = noteEl.querySelectorAll('tie')
  const tiedTo = Array.from(tieEls).some(t => t.getAttribute('type') === 'start') ? 'pending' : null
  
  // Check for slurs
  const slurEls = noteEl.querySelectorAll('slur')
  const slurredWith = Array.from(slurEls)
    .filter(s => s.getAttribute('type') === 'start')
    .map(() => 'pending')
  
  // Check for embellishments
  const embellishment = parseEmbellishment(noteEl)
  
  // Check if grace note
  const isGrace = noteEl.querySelector('grace') !== null
  
  return {
    id: generateNoteId(),
    pitch,
    duration,
    startBeat,
    voice,
    staff,
    tiedTo,
    slurredWith: slurredWith.length > 0 ? slurredWith : undefined,
    isLocked: false,
    embellishment: isGrace ? 'grace_note' : embellishment
  }
}

/**
 * Parse duration from note element
 * @param {Element} noteEl - Note XML element
 * @param {number} divisions - Divisions per quarter note
 * @returns {Object} Duration object
 */
function parseDuration(noteEl, divisions) {
  const typeEl = noteEl.querySelector('type')
  const durationEl = noteEl.querySelector('duration')
  const dotEls = noteEl.querySelectorAll('dot')
  const isGrace = noteEl.querySelector('grace') !== null
  
  let type = 'quarter'
  if (typeEl) {
    const typeMap = {
      'whole': 'whole', 'half': 'half', 'quarter': 'quarter',
      'eighth': 'eighth', '16th': 'sixteenth', '32nd': '32nd', '64th': '64th'
    }
    type = typeMap[typeEl.textContent] || 'quarter'
  }
  
  const dots = dotEls.length
  
  // 装饰音没有 duration，时值为 0
  const durationValue = isGrace ? 0 : parseInt(durationEl?.textContent || divisions)
  
  // Calculate base ticks from duration value
  let ticks = (durationValue / divisions) * 1024
  
  // Check for tuplet (triplets, etc.)
  const timeModEl = noteEl.querySelector('time-modification')
  let tuplet = null
  if (timeModEl) {
    const actual = parseInt(timeModEl.querySelector('actual-notes')?.textContent || '3')
    const normal = parseInt(timeModEl.querySelector('normal-notes')?.textContent || '2')
    tuplet = { actual, normal }
    
    // Note: The duration value in MusicXML already accounts for tuplet modification
    // So we don't need to adjust ticks here, but we store the tuplet info for export
  }
  
  // Apply dots to ticks calculation
  if (dots > 0) {
    let addition = ticks / 2
    for (let i = 0; i < dots; i++) {
      ticks += addition
      addition /= 2
    }
  }
  
  return { type, dots, tuplet, ticks: Math.round(ticks) }
}

/**
 * Parse embellishment from note element
 * 根据 ProjectBlueprint_MSS3.md 规范识别以下装饰音：
 * - 倚音（Grace Note）：小音符（带/不带斜线）
 * - 颤音（Trill）：tr 或 tr~~~~
 * - 回音（Turn）：∽
 * - 波音（Mordent）：∿ 或 ∿+横线
 * - 滑音（Glissando）：斜线或"gliss."
 * - 震音（Tremolo）：音符间斜线
 * - 琶音（Arpeggio）：竖直波浪线
 * 
 * @param {Element} noteEl - Note XML element
 * @returns {string|undefined} Embellishment type
 */
function parseEmbellishment(noteEl) {
  const ornaments = noteEl.querySelector('ornaments')
  const notations = noteEl.querySelector('notations')
  
  // Check ornaments element
  if (ornaments) {
    if (ornaments.querySelector('trill-mark')) return 'trill'
    if (ornaments.querySelector('turn')) return 'turn'
    if (ornaments.querySelector('inverted-turn')) return 'inverted_turn'
    if (ornaments.querySelector('delayed-turn')) return 'delayed_turn'
    if (ornaments.querySelector('mordent')) return 'mordent_upper'
    if (ornaments.querySelector('inverted-mordent')) return 'mordent_lower'
    if (ornaments.querySelector('tremolo')) return 'tremolo'
    if (ornaments.querySelector('shake')) return 'shake'
    if (ornaments.querySelector('wavy-line')) return 'wavy_line'
    if (ornaments.querySelector('schleifer')) return 'schleifer'
  }
  
  // Check notations element for other embellishments
  if (notations) {
    if (notations.querySelector('arpeggiate')) return 'arpeggio'
    if (notations.querySelector('non-arpeggiate')) return 'non_arpeggio'
    if (notations.querySelector('glissando')) return 'glissando'
    if (notations.querySelector('slide')) return 'slide'
    
    // Check for ornaments within notations
    const innerOrnaments = notations.querySelector('ornaments')
    if (innerOrnaments) {
      if (innerOrnaments.querySelector('trill-mark')) return 'trill'
      if (innerOrnaments.querySelector('turn')) return 'turn'
      if (innerOrnaments.querySelector('mordent')) return 'mordent_upper'
      if (innerOrnaments.querySelector('inverted-mordent')) return 'mordent_lower'
    }
  }
  
  return undefined
}

export { parseXmlContent }
