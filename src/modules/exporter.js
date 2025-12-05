/**
 * MusicXML Exporter Module
 * 
 * 关键改进（解决播放节奏错乱问题）：
 * 1. 每个谱表的每个声部（voice）完全独立记谱
 * 2. 上下谱表音符必须在相同拍位对齐
 * 3. 不同声部绝不混写
 * 4. 使用 backup 元素正确处理多声部
 * 5. 【核心】保持每小节第一个音符的位置不变（方整性/非方整性结构保护）
 * 
 * MusicXML 输出规范：
 * - Staff 1 (上谱表): voice=1 (Soprano), voice=2 (Alto)
 * - Staff 2 (下谱表): voice=3 (Tenor), voice=4 (Bass)
 * 
 * 方整性结构保护：
 * - 弱起小节（anacrusis）保持原有结构
 * - 每小节第一个音符位置固定不变
 * - 只改变时值，不改变起始位置
 */

import JSZip from 'jszip'

/**
 * Export simplified score to MusicXML
 */
export async function exportScore(score, format = 'musicxml') {
  const xmlContent = generateMusicXML(score)
  
  if (format === 'mxl') {
    return await createMxlFile(xmlContent, score.metadata.title)
  }
  
  return new Blob([xmlContent], { type: 'application/vnd.recordare.musicxml+xml' })
}

/**
 * Generate MusicXML content
 */
function generateMusicXML(score) {
  const { metadata, measures, scoreType } = score
  const divisions = 256 // 每四分音符的分割数
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <work>
    <work-title>${escapeXml(metadata.title)}</work-title>
  </work>
  <identification>
    <creator type="composer">${escapeXml(metadata.composer)}</creator>
    <encoding>
      <software>MusicScoreSimplifier</software>
      <encoding-date>${new Date().toISOString().split('T')[0]}</encoding-date>
    </encoding>
  </identification>
  <part-list>
    <score-part id="P1">
      <part-name>${scoreType === 'grand-staff' ? 'Piano' : 'Part 1'}</part-name>
    </score-part>
  </part-list>
  <part id="P1">
`

  measures.forEach((measure, index) => {
    xml += generateMeasureXML(measure, index === 0, metadata, divisions, scoreType)
  })

  xml += `  </part>
</score-partwise>`

  return xml
}

/**
 * Generate XML for a single measure
 */
function generateMeasureXML(measure, isFirst, metadata, divisions, scoreType) {
  let xml = `    <measure number="${measure.number}">\n`
  
  if (isFirst) {
    xml += generateAttributesXML(metadata, divisions, scoreType)
    if (metadata.tempo) {
      xml += `      <direction placement="above">
        <direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${metadata.tempo}</per-minute></metronome></direction-type>
        <sound tempo="${metadata.tempo}"/>
      </direction>\n`
    }
  }
  
  const notes = measure.notes || []
  const timeSignature = metadata.timeSignature
  const measureDuration = timeSignature.beats * divisions
  
  if (scoreType === 'grand-staff') {
    xml += generateGrandStaffMeasureXML(notes, divisions, timeSignature, measureDuration)
  } else {
    xml += generateSingleStaffMeasureXML(notes, divisions, timeSignature, measureDuration)
  }
  
  xml += `    </measure>\n`
  return xml
}

/**
 * 生成大谱表小节的 XML
 * 
 * 关键修复：
 * 1. 上下谱表音符必须在相同拍位对齐
 * 2. 每小节第一个音符位置固定不变（方整性结构保护）
 * 3. 使用 backup 元素正确处理多声部
 * 4. 不添加不必要的休止符，避免破坏结构
 * 
 * MusicXML 规范：
 * - 所有声部必须从小节开头开始
 * - 使用 backup 回到小节开头
 * - 每个声部独立输出，时值必须填满整个小节
 */
function generateGrandStaffMeasureXML(notes, divisions, timeSignature, measureDuration) {
  let xml = ''
  
  // 按 voicePart 分离四个声部
  const soprano = notes.filter(n => n.voicePart === 'soprano' || (n.staff === 1 && n.voice === 1 && !n.voicePart))
  const alto = notes.filter(n => n.voicePart === 'alto' || (n.staff === 1 && n.voice === 2 && !n.voicePart))
  const tenor = notes.filter(n => n.voicePart === 'tenor' || (n.staff === 2 && n.voice === 1 && !n.voicePart))
  const bass = notes.filter(n => n.voicePart === 'bass' || (n.staff === 2 && n.voice === 2 && !n.voicePart))
  
  // 如果没有明确分离，按 staff 分离
  let upperNotes = soprano.length > 0 || alto.length > 0 
    ? [...soprano, ...alto] 
    : notes.filter(n => n.staff === 1)
  let lowerNotes = tenor.length > 0 || bass.length > 0 
    ? [...tenor, ...bass] 
    : notes.filter(n => n.staff === 2)
  
  // 处理上谱表
  const hasSoprano = soprano.length > 0 || (upperNotes.length > 0 && alto.length === 0)
  const hasAlto = alto.length > 0
  
  if (hasSoprano || hasAlto) {
    // Voice 1: Soprano - 输出完整小节（包含休止符填充）
    if (hasSoprano) {
      const sopranoNotes = soprano.length > 0 ? soprano : upperNotes
      const result = generateVoiceXMLAligned(sopranoNotes, 1, 1, divisions, measureDuration, hasAlto ? 'up' : null)
      xml += result.xml
    }
    
    // Voice 2: Alto
    if (hasAlto) {
      // 回到小节开头
      xml += `      <backup><duration>${measureDuration}</duration></backup>\n`
      const result = generateVoiceXMLAligned(alto, 2, 1, divisions, measureDuration, 'down')
      xml += result.xml
    }
  } else {
    // 上谱表没有音符，添加全小节休止符
    xml += generateFullMeasureRest(1, 1, measureDuration)
  }
  
  // 回到小节开头，准备处理下谱表
  xml += `      <backup><duration>${measureDuration}</duration></backup>\n`
  
  // 处理下谱表
  const hasTenor = tenor.length > 0
  const hasBass = bass.length > 0 || (lowerNotes.length > 0 && tenor.length === 0)
  
  if (hasTenor || hasBass) {
    // Voice 3: Tenor
    if (hasTenor) {
      const result = generateVoiceXMLAligned(tenor, 3, 2, divisions, measureDuration, hasBass ? 'up' : null)
      xml += result.xml
      
      if (hasBass) {
        // 回到小节开头
        xml += `      <backup><duration>${measureDuration}</duration></backup>\n`
      }
    }
    
    // Voice 4: Bass
    if (hasBass) {
      const bassNotes = bass.length > 0 ? bass : lowerNotes
      const result = generateVoiceXMLAligned(bassNotes, 4, 2, divisions, measureDuration, hasTenor ? 'down' : null)
      xml += result.xml
    }
  } else {
    // 下谱表没有音符，添加全小节休止符
    xml += generateFullMeasureRest(3, 2, measureDuration)
  }
  
  return xml
}

/**
 * 生成对齐的声部 XML
 * 
 * 核心原则：
 * 1. 每小节第一个音符的位置固定不变
 * 2. 所有空白都用休止符填充（确保播放器兼容性）
 * 3. 每个声部的时值必须精确等于小节时值
 * 
 * @param {Array} notes - 音符数组
 * @param {number} voice - 声部编号
 * @param {number} staff - 谱表编号
 * @param {number} divisions - 每四分音符的分割数
 * @param {number} measureDuration - 小节总时值
 * @param {string} stemDirection - 符干方向
 * @returns {Object} { xml, duration }
 */
function generateVoiceXMLAligned(notes, voice, staff, divisions, measureDuration, stemDirection) {
  let xml = ''
  let totalDuration = 0
  
  if (!notes || notes.length === 0) {
    return { 
      xml: generateFullMeasureRest(voice, staff, measureDuration),
      duration: measureDuration 
    }
  }
  
  // 按起始拍位排序
  const sortedNotes = [...notes].sort((a, b) => a.startBeat - b.startBeat)
  
  // 将音符按拍位分组（处理和弦）
  const noteGroups = groupNotesByPosition(sortedNotes, divisions)
  
  let currentPosition = 0
  
  noteGroups.forEach((group, groupIdx) => {
    // 计算音符在小节内的位置（基于 startBeat）
    // startBeat 从 1 开始，所以要减 1
    const notePosition = Math.round((group.startBeat - 1) * divisions)
    
    // 如果当前位置落后于音符位置，用休止符填充
    if (notePosition > currentPosition) {
      const gap = notePosition - currentPosition
      xml += generateRestsForDuration(gap, voice, staff, divisions)
      totalDuration += gap
      currentPosition = notePosition
    }
    
    // 获取音符的实际时值
    const noteDuration = Math.round((group.notes[0].duration?.ticks || 1024) / 1024 * divisions)
    
    // 输出和弦中的所有音符
    group.notes.forEach((note, noteIdx) => {
      const isChord = noteIdx > 0
      xml += generateNoteXML(note, divisions, voice, staff, isChord, stemDirection)
    })
    
    // 只有第一个音符（非和弦音）计入时值
    totalDuration += noteDuration
    currentPosition = notePosition + noteDuration
  })
  
  // 如果小节末尾还有空白，添加休止符填满
  if (currentPosition < measureDuration) {
    const restDuration = measureDuration - currentPosition
    xml += generateRestsForDuration(restDuration, voice, staff, divisions)
    totalDuration += restDuration
  }
  
  return { xml, duration: totalDuration }
}

/**
 * 生成单行谱小节的 XML
 */
function generateSingleStaffMeasureXML(notes, divisions, timeSignature, measureDuration) {
  if (!notes || notes.length === 0) {
    return generateFullMeasureRest(1, 1, measureDuration)
  }
  const result = generateVoiceXMLAligned(notes, 1, 1, divisions, measureDuration, null)
  return result.xml
}

/**
 * 将音符按位置分组（处理和弦）
 */
function groupNotesByPosition(notes, divisions) {
  const groups = []
  let currentGroup = null
  
  notes.forEach(note => {
    const position = Math.round((note.startBeat - 1) * divisions)
    
    if (!currentGroup || Math.abs(position - currentGroup.position) > divisions / 8) {
      currentGroup = {
        position,
        startBeat: note.startBeat,
        notes: [note]
      }
      groups.push(currentGroup)
    } else {
      currentGroup.notes.push(note)
    }
  })
  
  return groups
}

/**
 * 生成指定时值的休止符
 */
function generateRestsForDuration(totalDuration, voice, staff, divisions) {
  let xml = ''
  let remaining = totalDuration
  
  const restValues = [
    { duration: divisions * 4, type: 'whole' },
    { duration: divisions * 2, type: 'half' },
    { duration: divisions, type: 'quarter' },
    { duration: divisions / 2, type: 'eighth' },
    { duration: divisions / 4, type: '16th' },
    { duration: divisions / 8, type: '32nd' }
  ]
  
  while (remaining > 0.5) {
    let found = false
    for (const rv of restValues) {
      if (rv.duration <= remaining + 0.5) {
        xml += `      <note>
        <rest/>
        <duration>${Math.round(rv.duration)}</duration>
        <voice>${voice}</voice>
        <type>${rv.type}</type>
        <staff>${staff}</staff>
      </note>\n`
        remaining -= rv.duration
        found = true
        break
      }
    }
    if (!found) break
  }
  
  return xml
}

/**
 * 生成全小节休止符
 */
function generateFullMeasureRest(voice, staff, measureDuration) {
  return `      <note>
        <rest measure="yes"/>
        <duration>${measureDuration}</duration>
        <voice>${voice}</voice>
        <staff>${staff}</staff>
      </note>\n`
}

/**
 * Generate attributes XML
 */
function generateAttributesXML(metadata, divisions, scoreType) {
  const { timeSignature, keySignature } = metadata
  
  let xml = `      <attributes>
        <divisions>${divisions}</divisions>
        <key><fifths>${keySignature.fifths}</fifths></key>
        <time><beats>${timeSignature.beats}</beats><beat-type>${timeSignature.beatType}</beat-type></time>\n`
  
  if (scoreType === 'grand-staff') {
    xml += `        <staves>2</staves>
        <clef number="1"><sign>G</sign><line>2</line></clef>
        <clef number="2"><sign>F</sign><line>4</line></clef>\n`
  } else {
    xml += `        <clef><sign>G</sign><line>2</line></clef>\n`
  }
  
  xml += `      </attributes>\n`
  return xml
}

/**
 * Generate note XML
 */
function generateNoteXML(note, divisions, voice, staff, isChord = false, stemDirection = null) {
  let durationTicks = note.duration?.ticks || 1024
  const xmlDuration = Math.round((durationTicks / 1024) * divisions)
  
  let xml = `      <note>\n`
  
  if (isChord) {
    xml += `        <chord/>\n`
  }
  
  xml += `        <pitch>
          <step>${note.pitch.step}</step>
          ${note.pitch.alter ? `<alter>${note.pitch.alter}</alter>` : ''}
          <octave>${note.pitch.octave}</octave>
        </pitch>\n`
  
  xml += `        <duration>${xmlDuration}</duration>\n`
  
  if (note.tiedTo) {
    xml += `        <tie type="start"/>\n`
  }
  
  xml += `        <voice>${voice}</voice>\n`
  xml += `        <type>${durationToType(note.duration?.type || 'quarter')}</type>\n`
  
  for (let i = 0; i < (note.duration?.dots || 0); i++) {
    xml += `        <dot/>\n`
  }
  
  if (note.duration?.tuplet) {
    const { actual, normal } = note.duration.tuplet
    xml += `        <time-modification>
          <actual-notes>${actual}</actual-notes>
          <normal-notes>${normal}</normal-notes>
        </time-modification>\n`
  }
  
  if (stemDirection) {
    xml += `        <stem>${stemDirection}</stem>\n`
  }
  
  xml += `        <staff>${staff}</staff>\n`
  
  if (note.tiedTo) {
    xml += `        <notations><tied type="start"/></notations>\n`
  }
  
  xml += `      </note>\n`
  return xml
}

function durationToType(type) {
  const typeMap = {
    'whole': 'whole', 'half': 'half', 'quarter': 'quarter',
    'eighth': 'eighth', 'sixteenth': '16th', '32nd': '32nd'
  }
  return typeMap[type] || 'quarter'
}

async function createMxlFile(xmlContent, title) {
  const zip = new JSZip()
  
  const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container>
  <rootfiles>
    <rootfile full-path="score.xml"/>
  </rootfiles>
</container>`
  
  zip.file('META-INF/container.xml', containerXml)
  zip.file('score.xml', xmlContent)
  
  return await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.recordare.musicxml' })
}

function escapeXml(str) {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
