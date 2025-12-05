/**
 * 全面测试脚本 - 测试所有核心功能
 * 
 * 根据 ProjectBlueprint_MSS4.md 规范测试：
 * 1. 单行谱 Level 1-5
 * 2. 大谱表 Level 1-5（含 Soprano Level 和 Bass Level 排列组合）
 * 3. 文件解析和导出
 * 4. 声部分离
 */

import { JSDOM } from 'jsdom'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 设置 DOM 环境
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>')
global.window = dom.window
global.document = dom.window.document
global.DOMParser = dom.window.DOMParser

// 导入模块
import JSZip from 'jszip'
const { parseXmlContent } = await import('./src/modules/parser.js')
const { analyzeScore } = await import('./src/modules/analyzer.js')
const { simplifyScore } = await import('./src/modules/simplifier.js')
const { exportScore } = await import('./src/modules/exporter.js')
const { getStrongBeats, pitchToMidi } = await import('./src/knowledge/index.js')

// 测试结果收集
const testResults = {
  passed: 0,
  failed: 0,
  errors: []
}

// 测试乐曲路径
const COMPOSITION_EXAMPLES = {
  // 钢琴曲（大谱表）
  beethoven: '../CompositionExamples/Beethoven Piano Sonata No. 8 Pathetique in C Minor, Op. 13, II. Adagio cantabile/score.xml',
  chopin: '../CompositionExamples/Chopin Piano Etude No. 3 in E, Op. 10/lg-68101093176023563.xml',
  mozartK545: '../CompositionExamples/Mozart Piano K.545  First Movement/lg-822369149725648854.xml',
  mozartK311: '../CompositionExamples/Mozart Piano Sonata No. 9 First Movement/score.xml',
  // 单音乐器（单行谱）
  cello: '../CompositionExamples/Solo Cello Sonata in G Major by Giuseppe Sammartini (G. Sammartini)/Cello_Sonata_in_G_Major_-_Berteau__Sammartini-_arr._for_Viola_2.xml',
  violinConcerto: '../CompositionExamples/Solo Mozart Violin Concerto No. 3 K.216 – Wolfgang Amadeus Mozart Mozart Cadenza/mozart-violin-concerto-no-3-k216-wolfgang-amadeus-mozart-mozart-cadenza.mxl',
}

// MXL 文件路径
const MXL_FILES = [
  '../CompositionExamples/Beethoven Piano Sonata No. 8 Pathetique in C Minor, Op. 13, II. Adagio cantabile/beethoven-piano-sonata-no-8-pathetique-in-c-minor-op-13-ii-adagio-cantabile.mxl',
  '../CompositionExamples/Chopin Piano Etude No. 3 in E, Op. 10/etude-opus-10-no-3-in-e-major.mxl',
  '../CompositionExamples/Mozart Piano K.545  First Movement/sonata-no-16-1st-movement-k-545.mxl',
  '../CompositionExamples/Mozart Piano Sonata No. 9 First Movement/Mozart_Sonata_in_D_K._311_-_I._Allegro_con_spirito.mxl',
  '../CompositionExamples/Solo Cello Sonata in G Major by Giuseppe Sammartini (G. Sammartini)/Cello_Sonata_in_G_Major_-_Berteau__Sammartini-_arr._for_Viola_2.mxl',
]

function log(msg, type = 'info') {
  const prefix = type === 'pass' ? '✅' : type === 'fail' ? '❌' : type === 'warn' ? '⚠️' : 'ℹ️'
  console.log(`${prefix} ${msg}`)
}

function assert(condition, message) {
  if (condition) {
    testResults.passed++
    log(message, 'pass')
    return true
  } else {
    testResults.failed++
    testResults.errors.push(message)
    log(message, 'fail')
    return false
  }
}

// 解析 .mxl 文件
async function parseMxlFile(filePath) {
  const fullPath = path.resolve(__dirname, filePath)
  const fileBuffer = fs.readFileSync(fullPath)
  const zip = new JSZip()
  const contents = await zip.loadAsync(fileBuffer)
  
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
  
  if (!rootFilePath) {
    const xmlFiles = Object.keys(contents.files).filter(
      name => name.endsWith('.xml') && !name.startsWith('META-INF')
    )
    rootFilePath = xmlFiles[0]
  }
  
  if (!rootFilePath || !contents.file(rootFilePath)) {
    throw new Error('Cannot find MusicXML content in .mxl file')
  }
  
  const xmlContent = await contents.file(rootFilePath).async('string')
  return parseXmlContent(xmlContent)
}

// 加载乐谱文件（支持 .xml 和 .mxl）
async function loadScore(filePath) {
  const fullPath = path.resolve(__dirname, filePath)
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${fullPath}`)
  }
  
  if (filePath.endsWith('.mxl')) {
    return await parseMxlFile(filePath)
  } else {
    const xmlContent = fs.readFileSync(fullPath, 'utf-8')
    return parseXmlContent(xmlContent)
  }
}

// ============ 单行谱测试 ============
async function testSingleStaffLevels() {
  console.log('\n' + '='.repeat(60))
  console.log('单行谱 (Single-Staff) Level 1-5 测试')
  console.log('='.repeat(60))
  
  let score
  try {
    score = await loadScore(COMPOSITION_EXAMPLES.cello)
    log(`加载 Cello Sonata: ${score.metadata.title}`)
  } catch (e) {
    log(`无法加载 Cello 乐谱: ${e.message}`, 'fail')
    return
  }
  
  const analyzed = await analyzeScore(score, 'single-staff')
  const timeSignature = analyzed.metadata.timeSignature
  
  for (let level = 1; level <= 5; level++) {
    console.log(`\n--- Single-Staff Level ${level} ---`)
    
    try {
      const simplified = simplifyScore(analyzed, { mainLevel: level })
      
      // 验证基本结构
      assert(simplified.measures.length > 0, `Level ${level}: 有简化后的小节`)
      assert(simplified.scoreType === 'single-staff', `Level ${level}: 乐谱类型正确`)
      
      // 验证每个小节
      let totalNotes = 0
      simplified.measures.forEach((measure, idx) => {
        if (measure.notes) {
          totalNotes += measure.notes.length
          
          // Level 1: 每小节只有1个音符
          if (level === 1 && idx > 0) { // 跳过弱起小节
            assert(measure.notes.length <= 1, `Level 1 小节${idx+1}: 最多1个音符 (实际: ${measure.notes.length})`)
          }
          
          // Level 2: 只保留强拍音符
          if (level === 2 && idx > 0) {
            const strongBeats = getStrongBeats(timeSignature)
            assert(measure.notes.length <= strongBeats.length, 
              `Level 2 小节${idx+1}: 最多${strongBeats.length}个音符 (实际: ${measure.notes.length})`)
          }
        }
      })
      
      assert(totalNotes > 0, `Level ${level}: 总音符数 > 0 (实际: ${totalNotes})`)
      log(`Level ${level}: 总共 ${totalNotes} 个音符`)
      
    } catch (e) {
      log(`Level ${level} 测试失败: ${e.message}`, 'fail')
      testResults.failed++
      testResults.errors.push(`Single-Staff Level ${level}: ${e.message}`)
    }
  }
}


// ============ 大谱表测试 ============
async function testGrandStaffLevels() {
  console.log('\n' + '='.repeat(60))
  console.log('大谱表 (Grand-Staff) Level 1-5 测试')
  console.log('='.repeat(60))
  
  // 测试所有钢琴曲
  const pianoScores = ['beethoven', 'chopin', 'mozartK545', 'mozartK311']
  
  for (const scoreName of pianoScores) {
    let score
    try {
      score = await loadScore(COMPOSITION_EXAMPLES[scoreName])
      log(`\n加载 ${scoreName}: ${score.metadata.title}`)
    } catch (e) {
      log(`无法加载 ${scoreName}: ${e.message}`, 'warn')
      continue
    }
    
    const analyzed = await analyzeScore(score, 'grand-staff')
    
    for (let level = 1; level <= 5; level++) {
      console.log(`\n--- ${scoreName} Grand-Staff Level ${level} ---`)
      
      try {
        const simplified = simplifyScore(analyzed, { mainLevel: level })
        
        // 验证基本结构
        assert(simplified.measures.length > 0, `${scoreName} Level ${level}: 有简化后的小节`)
        
        // 验证声部分离
        let sopranoCount = 0, altoCount = 0, tenorCount = 0, bassCount = 0
        
        simplified.measures.forEach(measure => {
          if (measure.notes) {
            measure.notes.forEach(note => {
              if (note.voicePart === 'soprano') sopranoCount++
              else if (note.voicePart === 'alto') altoCount++
              else if (note.voicePart === 'tenor') tenorCount++
              else if (note.voicePart === 'bass') bassCount++
            })
          }
        })
        
        // 根据 Level 验证声部
        if (level === 1) {
          // Level 1: Soprano + Bass
          assert(sopranoCount > 0, `${scoreName} Level 1: 有 Soprano 声部`)
          assert(bassCount > 0, `${scoreName} Level 1: 有 Bass 声部`)
        } else if (level === 2) {
          // Level 2: Soprano + Alto + Bass
          assert(sopranoCount > 0, `${scoreName} Level 2: 有 Soprano 声部`)
          // Alto 可能为空（取决于原谱）
          assert(bassCount > 0, `${scoreName} Level 2: 有 Bass 声部`)
        } else if (level === 3) {
          // Level 3: Soprano + Tenor + Bass
          assert(sopranoCount > 0, `${scoreName} Level 3: 有 Soprano 声部`)
          assert(bassCount > 0, `${scoreName} Level 3: 有 Bass 声部`)
        } else if (level >= 4) {
          // Level 4-5: 四声部
          assert(sopranoCount > 0, `${scoreName} Level ${level}: 有 Soprano 声部`)
          assert(bassCount > 0, `${scoreName} Level ${level}: 有 Bass 声部`)
        }
        
        log(`声部统计: S=${sopranoCount}, A=${altoCount}, T=${tenorCount}, B=${bassCount}`)
        
      } catch (e) {
        log(`${scoreName} Level ${level} 测试失败: ${e.message}`, 'fail')
        testResults.failed++
        testResults.errors.push(`${scoreName} Grand-Staff Level ${level}: ${e.message}`)
      }
    }
  }
}

// ============ Soprano/Bass Level 排列组合测试 ============
async function testLevelCombinations() {
  console.log('\n' + '='.repeat(60))
  console.log('Soprano Level 和 Bass Level 排列组合测试')
  console.log('='.repeat(60))
  
  let score
  try {
    score = await loadScore(COMPOSITION_EXAMPLES.mozartK545)
    log(`加载测试乐谱: ${score.metadata.title}`)
  } catch (e) {
    log(`无法加载测试乐谱: ${e.message}`, 'fail')
    return
  }
  
  const analyzed = await analyzeScore(score, 'grand-staff')
  
  // 根据 ProjectBlueprint_MSS4.md 规范的组合
  const combinations = [
    // Level 1: Soprano L1-5, Bass L1-5
    { mainLevel: 1, sopranoLevels: [1, 2, 3, 4, 5], bassLevels: [1, 2, 3, 4, 5] },
    // Level 2: Soprano L2-5, Bass L2-5
    { mainLevel: 2, sopranoLevels: [2, 3, 4, 5], bassLevels: [2, 3, 4, 5] },
    // Level 3: Soprano L2-5, Bass L2-5
    { mainLevel: 3, sopranoLevels: [2, 3, 4, 5], bassLevels: [2, 3, 4, 5] },
    // Level 4: Soprano L2-5, Bass L2-5
    { mainLevel: 4, sopranoLevels: [2, 3, 4, 5], bassLevels: [2, 3, 4, 5] },
    // Level 5: Soprano L4-5, Bass L4-5
    { mainLevel: 5, sopranoLevels: [4, 5], bassLevels: [4, 5] },
  ]
  
  for (const combo of combinations) {
    console.log(`\n--- Grand-Staff Level ${combo.mainLevel} 组合测试 ---`)
    
    for (const sopranoLevel of combo.sopranoLevels) {
      for (const bassLevel of combo.bassLevels) {
        try {
          const config = {
            mainLevel: combo.mainLevel,
            sopranoLevel,
            bassLevel
          }
          
          const simplified = simplifyScore(analyzed, config)
          
          // 验证结果
          const hasNotes = simplified.measures.some(m => m.notes && m.notes.length > 0)
          assert(hasNotes, 
            `Level ${combo.mainLevel} (S:${sopranoLevel}, B:${bassLevel}): 有音符输出`)
          
        } catch (e) {
          log(`Level ${combo.mainLevel} (S:${sopranoLevel}, B:${bassLevel}) 失败: ${e.message}`, 'fail')
          testResults.failed++
          testResults.errors.push(`Combo L${combo.mainLevel} S${sopranoLevel} B${bassLevel}: ${e.message}`)
        }
      }
    }
  }
}


// ============ 导出功能测试 ============
async function testExportFunctionality() {
  console.log('\n' + '='.repeat(60))
  console.log('MusicXML 导出功能测试')
  console.log('='.repeat(60))
  
  // 确保输出目录存在
  const outputDir = path.resolve(__dirname, 'test-output')
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }
  
  // 测试大谱表导出
  let score
  try {
    score = await loadScore(COMPOSITION_EXAMPLES.mozartK545)
    log(`加载测试乐谱: ${score.metadata.title}`)
  } catch (e) {
    log(`无法加载测试乐谱: ${e.message}`, 'fail')
    return
  }
  
  const analyzed = await analyzeScore(score, 'grand-staff')
  
  for (let level = 1; level <= 5; level++) {
    try {
      const simplified = simplifyScore(analyzed, { mainLevel: level })
      const blob = await exportScore(simplified, 'musicxml')
      
      // 验证导出结果
      assert(blob instanceof Blob, `Level ${level}: 导出返回 Blob 对象`)
      assert(blob.size > 0, `Level ${level}: 导出文件大小 > 0 (${blob.size} bytes)`)
      
      // 保存到文件
      const arrayBuffer = await blob.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const outputPath = path.join(outputDir, `mozart_k545_level${level}.musicxml`)
      fs.writeFileSync(outputPath, buffer)
      log(`Level ${level}: 已保存到 ${outputPath}`)
      
      // 验证导出的 XML 结构
      const xmlContent = buffer.toString('utf-8')
      assert(xmlContent.includes('<?xml'), `Level ${level}: 有效的 XML 声明`)
      assert(xmlContent.includes('<score-partwise'), `Level ${level}: 有效的 MusicXML 结构`)
      assert(xmlContent.includes('<measure'), `Level ${level}: 包含小节`)
      assert(xmlContent.includes('<note>'), `Level ${level}: 包含音符`)
      
      // 验证声部分离（大谱表应有两个谱表）
      assert(xmlContent.includes('<staves>2</staves>'), `Level ${level}: 大谱表有两个谱表`)
      assert(xmlContent.includes('<staff>1</staff>'), `Level ${level}: 有上谱表音符`)
      assert(xmlContent.includes('<staff>2</staff>'), `Level ${level}: 有下谱表音符`)
      
    } catch (e) {
      log(`Level ${level} 导出测试失败: ${e.message}`, 'fail')
      testResults.failed++
      testResults.errors.push(`Export Level ${level}: ${e.message}`)
    }
  }
  
  // 测试单行谱导出
  console.log('\n--- 单行谱导出测试 ---')
  try {
    const celloScore = await loadScore(COMPOSITION_EXAMPLES.cello)
    const celloAnalyzed = await analyzeScore(celloScore, 'single-staff')
    
    for (let level = 1; level <= 5; level++) {
      const simplified = simplifyScore(celloAnalyzed, { mainLevel: level })
      const blob = await exportScore(simplified, 'musicxml')
      
      assert(blob.size > 0, `单行谱 Level ${level}: 导出成功`)
      
      const arrayBuffer = await blob.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const outputPath = path.join(outputDir, `cello_level${level}.musicxml`)
      fs.writeFileSync(outputPath, buffer)
    }
    log('单行谱 Level 1-5 导出完成')
  } catch (e) {
    log(`单行谱导出测试失败: ${e.message}`, 'fail')
    testResults.failed++
  }
}

// ============ 声部分离测试 ============
async function testVoiceSeparation() {
  console.log('\n' + '='.repeat(60))
  console.log('声部分离 (Voice Separation) 测试')
  console.log('='.repeat(60))
  
  let score
  try {
    score = await loadScore(COMPOSITION_EXAMPLES.beethoven)
    log(`加载测试乐谱: ${score.metadata.title}`)
  } catch (e) {
    log(`无法加载测试乐谱: ${e.message}`, 'fail')
    return
  }
  
  const analyzed = await analyzeScore(score, 'grand-staff')
  
  // 测试声部分离结果
  const simplified = simplifyScore(analyzed, { mainLevel: 5 })
  
  // 收集所有声部的音符
  const voices = { soprano: [], alto: [], tenor: [], bass: [] }
  
  simplified.measures.forEach(measure => {
    if (measure.notes) {
      measure.notes.forEach(note => {
        if (note.voicePart && voices[note.voicePart]) {
          voices[note.voicePart].push(note)
        }
      })
    }
  })
  
  // 验证声部音高范围
  console.log('\n--- 声部音高范围验证 ---')
  
  // Soprano 应该是上谱表最高音
  if (voices.soprano.length > 0) {
    const sopranoMidis = voices.soprano.map(n => pitchToMidi(n.pitch))
    const avgSoprano = sopranoMidis.reduce((a, b) => a + b, 0) / sopranoMidis.length
    log(`Soprano 平均音高: MIDI ${avgSoprano.toFixed(1)}`)
    assert(avgSoprano > 55, `Soprano 平均音高在合理范围 (>${55})`)
  }
  
  // Bass 应该是下谱表最低音
  if (voices.bass.length > 0) {
    const bassMidis = voices.bass.map(n => pitchToMidi(n.pitch))
    const avgBass = bassMidis.reduce((a, b) => a + b, 0) / bassMidis.length
    log(`Bass 平均音高: MIDI ${avgBass.toFixed(1)}`)
    assert(avgBass < 60, `Bass 平均音高在合理范围 (<60)`)
  }
  
  // 验证 staff 分配
  const staff1Notes = simplified.measures.flatMap(m => (m.notes || []).filter(n => n.staff === 1))
  const staff2Notes = simplified.measures.flatMap(m => (m.notes || []).filter(n => n.staff === 2))
  
  assert(staff1Notes.length > 0, '上谱表 (staff 1) 有音符')
  assert(staff2Notes.length > 0, '下谱表 (staff 2) 有音符')
  
  // 验证 voice 分配
  const voice1Staff1 = staff1Notes.filter(n => n.voice === 1).length
  const voice2Staff1 = staff1Notes.filter(n => n.voice === 2).length
  const voice1Staff2 = staff2Notes.filter(n => n.voice === 1).length
  const voice2Staff2 = staff2Notes.filter(n => n.voice === 2).length
  
  log(`Staff 1: voice1=${voice1Staff1}, voice2=${voice2Staff1}`)
  log(`Staff 2: voice1=${voice1Staff2}, voice2=${voice2Staff2}`)
  
  assert(voice1Staff1 > 0 || voice2Staff1 > 0, '上谱表有声部分配')
  assert(voice1Staff2 > 0 || voice2Staff2 > 0, '下谱表有声部分配')
}


// ============ LOCKED 音符测试 ============
async function testLockedNotes() {
  console.log('\n' + '='.repeat(60))
  console.log('LOCKED 音符 (切分、附点、连线) 测试')
  console.log('='.repeat(60))
  
  let score
  try {
    score = await loadScore(COMPOSITION_EXAMPLES.chopin)
    log(`加载测试乐谱: ${score.metadata.title}`)
  } catch (e) {
    log(`无法加载测试乐谱: ${e.message}`, 'fail')
    return
  }
  
  const analyzed = await analyzeScore(score, 'grand-staff')
  
  // 统计 LOCKED 音符
  const lockedNotes = analyzed.measures.flatMap(m => 
    (m.notes || []).filter(n => n.isLocked)
  )
  
  log(`总共识别出 ${lockedNotes.length} 个 LOCKED 音符`)
  
  // 按原因分类
  const lockReasons = {}
  lockedNotes.forEach(n => {
    const reason = n.lockReason || 'unknown'
    lockReasons[reason] = (lockReasons[reason] || 0) + 1
  })
  
  console.log('LOCKED 原因统计:')
  Object.entries(lockReasons).forEach(([reason, count]) => {
    log(`  ${reason}: ${count}`)
  })
  
  // 验证 Level 4 保留 LOCKED 音符
  const simplified = simplifyScore(analyzed, { mainLevel: 4 })
  
  const simplifiedLocked = simplified.measures.flatMap(m =>
    (m.notes || []).filter(n => n.isLocked)
  )
  
  assert(simplifiedLocked.length > 0, 'Level 4 保留了 LOCKED 音符')
  log(`Level 4 简化后保留 ${simplifiedLocked.length} 个 LOCKED 音符`)
}

// ============ 元数据保留测试 ============
async function testMetadataPreservation() {
  console.log('\n' + '='.repeat(60))
  console.log('元数据保留测试')
  console.log('='.repeat(60))
  
  const testScores = ['beethoven', 'mozartK545', 'cello']
  
  for (const scoreName of testScores) {
    try {
      const score = await loadScore(COMPOSITION_EXAMPLES[scoreName])
      const scoreType = scoreName === 'cello' ? 'single-staff' : 'grand-staff'
      const analyzed = await analyzeScore(score, scoreType)
      const simplified = simplifyScore(analyzed, { mainLevel: 3 })
      
      // 验证元数据保留
      assert(simplified.metadata.title === score.metadata.title, 
        `${scoreName}: 标题保留 "${simplified.metadata.title}"`)
      assert(simplified.metadata.composer === score.metadata.composer,
        `${scoreName}: 作曲家保留 "${simplified.metadata.composer}"`)
      assert(simplified.metadata.timeSignature.beats === score.metadata.timeSignature.beats,
        `${scoreName}: 拍号保留 ${simplified.metadata.timeSignature.beats}/${simplified.metadata.timeSignature.beatType}`)
      assert(simplified.metadata.keySignature.fifths === score.metadata.keySignature.fifths,
        `${scoreName}: 调号保留 (fifths: ${simplified.metadata.keySignature.fifths})`)
      
    } catch (e) {
      log(`${scoreName} 元数据测试失败: ${e.message}`, 'fail')
      testResults.failed++
    }
  }
}

// ============ 强拍位置测试 ============
async function testStrongBeats() {
  console.log('\n' + '='.repeat(60))
  console.log('强拍位置测试')
  console.log('='.repeat(60))
  
  // 测试不同拍号的强拍位置
  const testCases = [
    { beats: 2, beatType: 4, expected: [1] },
    { beats: 3, beatType: 4, expected: [1] },
    { beats: 4, beatType: 4, expected: [1, 3] },
    { beats: 6, beatType: 8, expected: [1, 4] },
  ]
  
  testCases.forEach(tc => {
    const strongBeats = getStrongBeats(tc)
    const match = JSON.stringify(strongBeats) === JSON.stringify(tc.expected)
    assert(match, `${tc.beats}/${tc.beatType} 强拍: ${JSON.stringify(strongBeats)} (期望: ${JSON.stringify(tc.expected)})`)
  })
}

// ============ 所有乐曲完整流程测试 ============
async function testAllCompositions() {
  console.log('\n' + '='.repeat(60))
  console.log('所有乐曲完整流程测试')
  console.log('='.repeat(60))
  
  const outputDir = path.resolve(__dirname, 'test-output')
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }
  
  for (const [name, filePath] of Object.entries(COMPOSITION_EXAMPLES)) {
    console.log(`\n--- 测试 ${name} ---`)
    
    try {
      const score = await loadScore(filePath)
      log(`标题: ${score.metadata.title}`)
      log(`作曲家: ${score.metadata.composer}`)
      log(`拍号: ${score.metadata.timeSignature.beats}/${score.metadata.timeSignature.beatType}`)
      log(`小节数: ${score.measures.length}`)
      
      // 判断乐谱类型
      const hasMultipleStaves = score.measures.some(m => 
        m.notes && m.notes.some(n => n.staff === 2)
      )
      const scoreType = hasMultipleStaves ? 'grand-staff' : 'single-staff'
      log(`乐谱类型: ${scoreType}`)
      
      // 分析
      const analyzed = await analyzeScore(score, scoreType)
      
      // 测试所有 Level
      for (let level = 1; level <= 5; level++) {
        const simplified = simplifyScore(analyzed, { mainLevel: level })
        const blob = await exportScore(simplified, 'musicxml')
        
        // 保存
        const safeName = name.replace(/[^a-zA-Z0-9]/g, '_')
        const outputPath = path.join(outputDir, `${safeName}_level${level}.musicxml`)
        const arrayBuffer = await blob.arrayBuffer()
        fs.writeFileSync(outputPath, Buffer.from(arrayBuffer))
      }
      
      assert(true, `${name}: 所有 Level 处理成功`)
      
    } catch (e) {
      log(`${name} 测试失败: ${e.message}`, 'fail')
      testResults.failed++
      testResults.errors.push(`${name}: ${e.message}`)
    }
  }
}

// ============ MXL 文件测试 ============
async function testMxlFiles() {
  console.log('\n' + '='.repeat(60))
  console.log('.mxl 压缩文件解析测试')
  console.log('='.repeat(60))
  
  for (const filePath of MXL_FILES) {
    const fileName = path.basename(filePath)
    try {
      const score = await loadScore(filePath)
      assert(score.measures.length > 0, `${fileName}: 解析成功 (${score.measures.length} 小节)`)
    } catch (e) {
      log(`${fileName}: 解析失败 - ${e.message}`, 'fail')
      testResults.failed++
      testResults.errors.push(`MXL ${fileName}: ${e.message}`)
    }
  }
}

// ============ Violin Concerto 测试 ============
async function testViolinConcerto() {
  console.log('\n' + '='.repeat(60))
  console.log('Mozart Violin Concerto (单音乐器 .mxl) 测试')
  console.log('='.repeat(60))
  
  try {
    const score = await loadScore(COMPOSITION_EXAMPLES.violinConcerto)
    log(`加载成功: ${score.metadata.title}`)
    log(`小节数: ${score.measures.length}`)
    
    const analyzed = await analyzeScore(score, 'single-staff')
    
    for (let level = 1; level <= 5; level++) {
      const simplified = simplifyScore(analyzed, { mainLevel: level })
      const totalNotes = simplified.measures.reduce((sum, m) => 
        sum + (m.notes ? m.notes.length : 0), 0)
      assert(totalNotes > 0, `Violin Concerto Level ${level}: ${totalNotes} 音符`)
    }
  } catch (e) {
    log(`Violin Concerto 测试失败: ${e.message}`, 'fail')
    testResults.failed++
  }
}

// ============ 主测试函数 ============
async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║     Music Score Simplifier 全面测试                        ║')
  console.log('║     根据 ProjectBlueprint_MSS4.md 规范                     ║')
  console.log('╚════════════════════════════════════════════════════════════╝')
  
  const startTime = Date.now()
  
  try {
    await testStrongBeats()
    await testSingleStaffLevels()
    await testGrandStaffLevels()
    await testLevelCombinations()
    await testVoiceSeparation()
    await testLockedNotes()
    await testMetadataPreservation()
    await testExportFunctionality()
    await testMxlFiles()
    await testViolinConcerto()
    await testAllCompositions()
  } catch (e) {
    log(`测试过程中发生错误: ${e.message}`, 'fail')
    console.error(e.stack)
  }
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2)
  
  // 输出测试结果摘要
  console.log('\n' + '═'.repeat(60))
  console.log('测试结果摘要')
  console.log('═'.repeat(60))
  console.log(`✅ 通过: ${testResults.passed}`)
  console.log(`❌ 失败: ${testResults.failed}`)
  console.log(`⏱️  耗时: ${duration}s`)
  
  if (testResults.errors.length > 0) {
    console.log('\n失败详情:')
    testResults.errors.forEach((err, idx) => {
      console.log(`  ${idx + 1}. ${err}`)
    })
  }
  
  // 返回退出码
  process.exit(testResults.failed > 0 ? 1 : 0)
}

// 运行测试
runAllTests()
