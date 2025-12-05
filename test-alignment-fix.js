/**
 * 测试上下谱表对齐修复
 * 使用 Mozart K.311 和 Chopin Op.10 No.3 进行测试
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { JSDOM } from 'jsdom'
import JSZip from 'jszip'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 设置 DOM 环境
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>')
global.DOMParser = dom.window.DOMParser

async function loadModules() {
  const parser = await import('./src/modules/parser.js')
  const analyzer = await import('./src/modules/analyzer.js')
  const simplifier = await import('./src/modules/simplifier.js')
  const exporter = await import('./src/modules/exporter.js')
  return { parser, analyzer, simplifier, exporter }
}

/**
 * 直接解析 MXL 文件（绕过 File API）
 */
async function parseMxlDirect(filePath) {
  const fileBuffer = fs.readFileSync(filePath)
  const zip = new JSZip()
  const contents = await zip.loadAsync(fileBuffer)
  
  // 查找 XML 文件
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
  
  return await contents.file(rootFilePath).async('string')
}

async function testFile(filePath, fileName) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`测试文件: ${fileName}`)
  console.log('='.repeat(60))
  
  const { parser, analyzer, simplifier, exporter } = await loadModules()
  
  if (!fs.existsSync(filePath)) {
    console.log('文件不存在:', filePath)
    return
  }
  
  try {
    // 直接解析 MXL 文件
    const xmlContent = await parseMxlDirect(filePath)
    
    // 使用 parseXmlContent 解析
    const parseResult = parser.parseXmlContent(xmlContent)
    console.log(`解析成功: ${parseResult.measures.length} 小节`)
    console.log(`拍号: ${parseResult.metadata.timeSignature.beats}/${parseResult.metadata.timeSignature.beatType}`)
    
    // 分析
    const analysisResult = await analyzer.analyzeScore(parseResult, 'grand-staff')
    
    // 检测弱起小节
    const firstMeasure = parseResult.measures[0]
    const expectedBeats = parseResult.metadata.timeSignature.beats
    const firstMeasureDuration = firstMeasure.notes.reduce((sum, n) => sum + (n.duration?.ticks || 0), 0)
    const actualBeats = firstMeasureDuration / 1024
    const hasAnacrusis = actualBeats < expectedBeats
    
    console.log(`\n弱起小节检测:`)
    console.log(`  第一小节时值: ${actualBeats} 拍 (期望: ${expectedBeats} 拍)`)
    console.log(`  是否弱起: ${hasAnacrusis ? '是' : '否'}`)
    
    // 测试不同级别
    for (const level of [1, 3, 5]) {
      console.log(`\n--- Level ${level} 测试 ---`)
      
      const simplified = simplifier.simplifyScore(analysisResult, {
        mainLevel: level,
        sopranoLevel: level === 1 ? 4 : level,
        bassLevel: level === 1 ? 1 : level
      })
      
      // 检查前3个小节的对齐情况
      console.log('\n前3个小节对齐检查:')
      for (let i = 0; i < Math.min(3, simplified.measures.length); i++) {
        const measure = simplified.measures[i]
        const notes = measure.notes || []
        
        const staff1Notes = notes.filter(n => n.staff === 1)
        const staff2Notes = notes.filter(n => n.staff === 2)
        
        console.log(`\n  小节 ${measure.number}:`)
        
        // 检查第一个音符的位置
        if (staff1Notes.length > 0) {
          const firstUpper = staff1Notes.sort((a, b) => a.startBeat - b.startBeat)[0]
          console.log(`    上谱表第一音: ${firstUpper.pitch.step}${firstUpper.pitch.octave} @ beat ${firstUpper.startBeat.toFixed(2)}`)
        }
        
        if (staff2Notes.length > 0) {
          const firstLower = staff2Notes.sort((a, b) => a.startBeat - b.startBeat)[0]
          console.log(`    下谱表第一音: ${firstLower.pitch.step}${firstLower.pitch.octave} @ beat ${firstLower.startBeat.toFixed(2)}`)
        }
        
        // 检查上下谱表是否在相同拍位有音符
        const upperBeats = new Set(staff1Notes.map(n => Math.round(n.startBeat * 4) / 4))
        const lowerBeats = new Set(staff2Notes.map(n => Math.round(n.startBeat * 4) / 4))
        
        const commonBeats = [...upperBeats].filter(b => lowerBeats.has(b))
        const upperOnly = [...upperBeats].filter(b => !lowerBeats.has(b))
        const lowerOnly = [...lowerBeats].filter(b => !upperBeats.has(b))
        
        if (commonBeats.length > 0) {
          console.log(`    对齐拍位: ${commonBeats.join(', ')}`)
        }
        if (upperOnly.length > 0) {
          console.log(`    仅上谱表: ${upperOnly.join(', ')}`)
        }
        if (lowerOnly.length > 0) {
          console.log(`    仅下谱表: ${lowerOnly.join(', ')}`)
        }
      }
    }
    
    console.log('\n✅ 测试完成')
    
  } catch (error) {
    console.error(`❌ 错误: ${error.message}`)
    console.error(error.stack)
  }
}

async function main() {
  console.log('上下谱表对齐修复测试')
  console.log('测试方整性结构与非方整性结构的处理')
  
  // 测试 Mozart K.311 (方整性结构)
  const mozartPath = path.join(__dirname, '../CompositionExamples/Mozart Piano Sonata No. 9 First Movement/Mozart_Sonata_in_D_K._311_-_I._Allegro_con_spirito.mxl')
  await testFile(mozartPath, 'Mozart K.311 (方整性结构)')
  
  // 测试 Chopin Op.10 No.3 (非方整性结构)
  const chopinPath = path.join(__dirname, '../CompositionExamples/Chopin Piano Etude No. 3 in E, Op. 10/etude-opus-10-no-3-in-e-major.mxl')
  await testFile(chopinPath, 'Chopin Op.10 No.3 (非方整性结构)')
}

main().catch(console.error)
