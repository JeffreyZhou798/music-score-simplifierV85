/**
 * 调试上下谱表对齐问题
 * 检查简化后的音符数据
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { JSDOM } from 'jsdom'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 设置 DOM 环境
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>')
global.DOMParser = dom.window.DOMParser

// 动态导入模块
async function loadModules() {
  const parser = await import('./src/modules/parser.js')
  const analyzer = await import('./src/modules/analyzer.js')
  const simplifier = await import('./src/modules/simplifier.js')
  return { parser, analyzer, simplifier }
}

async function debugAlignment() {
  console.log('='.repeat(60))
  console.log('调试上下谱表对齐问题')
  console.log('='.repeat(60))
  
  const { parser, analyzer, simplifier } = await loadModules()
  
  // 测试 Mozart K.545
  const filePath = path.join(__dirname, '../CompositionExamples/Mozart Piano K.545  First Movement/sonata-no-16-1st-movement-k-545.mxl')
  
  if (!fs.existsSync(filePath)) {
    console.log('文件不存在')
    return
  }
  
  try {
    // 读取文件
    const fileBuffer = fs.readFileSync(filePath)
    const file = new File([fileBuffer], path.basename(filePath), {
      type: 'application/vnd.recordare.musicxml'
    })
    
    // 解析
    const parseResult = await parser.parseFile(file)
    console.log(`\n解析成功: ${parseResult.measures.length} 小节`)
    
    // 分析
    const analysisResult = await analyzer.analyzeScore(parseResult, 'grand-staff')
    console.log(`分析成功: scoreType = ${analysisResult.scoreType}`)
    
    // 简化 Level 1
    console.log('\n--- Grand-Staff Level 1 (Soprano L4, Bass L1) ---')
    const simplified = simplifier.simplifyScore(analysisResult, {
      mainLevel: 1,
      sopranoLevel: 4,
      bassLevel: 1
    })
    
    // 检查前3个小节
    console.log('\n前3个小节详细信息:')
    for (let i = 0; i < Math.min(3, simplified.measures.length); i++) {
      const measure = simplified.measures[i]
      const notes = measure.notes || []
      
      console.log(`\n小节 ${measure.number}:`)
      console.log(`  总音符数: ${notes.length}`)
      
      const staff1Notes = notes.filter(n => n.staff === 1)
      const staff2Notes = notes.filter(n => n.staff === 2)
      
      console.log(`\n  上谱表 (Staff 1): ${staff1Notes.length} 个音符`)
      staff1Notes.forEach((n, idx) => {
        console.log(`    [${idx}] ${n.pitch.step}${n.pitch.octave} @ beat ${n.startBeat.toFixed(2)}, duration=${n.duration?.ticks || 'N/A'} ticks (${n.duration?.type || 'N/A'}), voice=${n.voice}, voicePart=${n.voicePart}`)
      })
      
      console.log(`\n  下谱表 (Staff 2): ${staff2Notes.length} 个音符`)
      staff2Notes.forEach((n, idx) => {
        console.log(`    [${idx}] ${n.pitch.step}${n.pitch.octave} @ beat ${n.startBeat.toFixed(2)}, duration=${n.duration?.ticks || 'N/A'} ticks (${n.duration?.type || 'N/A'}), voice=${n.voice}, voicePart=${n.voicePart}`)
      })
      
      // 检查时值总和
      const divisions = 256
      const measureDuration = parseResult.metadata.timeSignature.beats * divisions
      
      let staff1TotalTicks = 0
      staff1Notes.forEach(n => {
        staff1TotalTicks += (n.duration?.ticks || 0)
      })
      
      let staff2TotalTicks = 0
      staff2Notes.forEach(n => {
        staff2TotalTicks += (n.duration?.ticks || 0)
      })
      
      const staff1XmlDuration = Math.round(staff1TotalTicks / 1024 * divisions)
      const staff2XmlDuration = Math.round(staff2TotalTicks / 1024 * divisions)
      
      console.log(`\n  时值检查:`)
      console.log(`    小节应有时值: ${measureDuration} (${parseResult.metadata.timeSignature.beats} 拍)`)
      console.log(`    上谱表总 ticks: ${staff1TotalTicks} → XML duration: ${staff1XmlDuration}`)
      console.log(`    下谱表总 ticks: ${staff2TotalTicks} → XML duration: ${staff2XmlDuration}`)
      
      if (staff1XmlDuration !== measureDuration) {
        console.log(`    ⚠️  上谱表时值不匹配！差值: ${staff1XmlDuration - measureDuration}`)
      }
      if (staff2XmlDuration !== measureDuration) {
        console.log(`    ⚠️  下谱表时值不匹配！差值: ${staff2XmlDuration - measureDuration}`)
      }
    }
    
  } catch (error) {
    console.error(`错误: ${error.message}`)
    console.error(error.stack)
  }
}

// 运行调试
debugAlignment().catch(console.error)
