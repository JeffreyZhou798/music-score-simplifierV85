/**
 * 测试导出功能
 * 验证上下谱表对齐问题是否修复
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { JSDOM } from 'jsdom'
import JSZip from 'jszip'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>')
global.DOMParser = dom.window.DOMParser

async function parseMxlDirect(filePath) {
  const fileBuffer = fs.readFileSync(filePath)
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
  
  return await contents.file(rootFilePath).async('string')
}

async function testExport(filePath, fileName, outputName) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`测试导出: ${fileName}`)
  console.log('='.repeat(60))
  
  const parser = await import('./src/modules/parser.js')
  const analyzer = await import('./src/modules/analyzer.js')
  const simplifier = await import('./src/modules/simplifier.js')
  const exporter = await import('./src/modules/exporter.js')
  
  if (!fs.existsSync(filePath)) {
    console.log('文件不存在:', filePath)
    return
  }
  
  try {
    const xmlContent = await parseMxlDirect(filePath)
    const parseResult = parser.parseXmlContent(xmlContent)
    console.log(`解析成功: ${parseResult.measures.length} 小节`)
    
    const analysisResult = await analyzer.analyzeScore(parseResult, 'grand-staff')
    
    // 测试 Level 3
    console.log('\n--- 导出 Level 3 ---')
    const simplified = simplifier.simplifyScore(analysisResult, {
      mainLevel: 3,
      sopranoLevel: 5,
      bassLevel: 2
    })
    
    // 生成 MusicXML
    const blob = await exporter.exportScore(simplified, 'musicxml')
    const xmlOutput = await blob.text()
    
    // 保存到文件
    const outputPath = path.join(__dirname, 'test-output', `${outputName}_L3.musicxml`)
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    fs.writeFileSync(outputPath, xmlOutput)
    console.log(`已保存: ${outputPath}`)
    
    // 验证输出的 XML
    console.log('\n验证输出 XML 的前3个小节:')
    const outputDoc = new DOMParser().parseFromString(xmlOutput, 'text/xml')
    const measures = outputDoc.querySelectorAll('measure')
    
    for (let i = 0; i < Math.min(3, measures.length); i++) {
      const measure = measures[i]
      const measureNum = measure.getAttribute('number')
      const notes = measure.querySelectorAll('note')
      const backups = measure.querySelectorAll('backup')
      const forwards = measure.querySelectorAll('forward')
      
      console.log(`\n  小节 ${measureNum}:`)
      console.log(`    音符数: ${notes.length}, backup: ${backups.length}, forward: ${forwards.length}`)
      
      // 检查每个声部的时值
      let staff1Duration = 0
      let staff2Duration = 0
      
      notes.forEach(note => {
        const staff = note.querySelector('staff')?.textContent || '1'
        const duration = parseInt(note.querySelector('duration')?.textContent || '0')
        const isChord = note.querySelector('chord') !== null
        
        if (!isChord) {
          if (staff === '1') staff1Duration += duration
          else staff2Duration += duration
        }
      })
      
      // 计算 backup 和 forward
      backups.forEach(b => {
        const dur = parseInt(b.querySelector('duration')?.textContent || '0')
        // backup 不影响总时值计算
      })
      
      console.log(`    上谱表累计时值: ${staff1Duration}`)
      console.log(`    下谱表累计时值: ${staff2Duration}`)
    }
    
    console.log('\n✅ 导出测试完成')
    
  } catch (error) {
    console.error(`❌ 错误: ${error.message}`)
    console.error(error.stack)
  }
}

async function main() {
  console.log('MusicXML 导出测试')
  
  const mozartPath = path.join(__dirname, '../CompositionExamples/Mozart Piano Sonata No. 9 First Movement/Mozart_Sonata_in_D_K._311_-_I._Allegro_con_spirito.mxl')
  await testExport(mozartPath, 'Mozart K.311', 'Mozart_K311')
  
  const chopinPath = path.join(__dirname, '../CompositionExamples/Chopin Piano Etude No. 3 in E, Op. 10/etude-opus-10-no-3-in-e-major.mxl')
  await testExport(chopinPath, 'Chopin Op.10 No.3', 'Chopin_Op10_No3')
}

main().catch(console.error)
