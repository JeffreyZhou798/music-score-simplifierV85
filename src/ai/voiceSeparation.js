/**
 * AI-Assisted Voice Separation Module
 * 
 * 三层决策架构：
 * 1. 规则引擎（快速筛选）
 * 2. MusicVAE + KNN（智能归属）
 * 3. K-means 验证（质量检查）
 */

import { pitchToMidi } from '../knowledge/index.js'

// AI 模块引用
let mm = null
let musicVAE = null
let isAIReady = false
let aiInitPromise = null

// Embedding 缓存
const embeddingCache = new Map()

// 配置
const CONFIG = {
  CHUNK_SIZE: 8,           // 每次处理的音符数
  KNN_K: 5,                // KNN 的 K 值
  KMEANS_K: 4,             // K-means 聚类数（4个声部）
  CONFIDENCE_THRESHOLD: 0.6, // 置信度阈值
  AI_TIMEOUT: 3000,        // AI 超时时间（毫秒）
  ANOMALY_THRESHOLD: 2.0   // 异常检测阈值（标准差倍数）
}

/**
 * 初始化 AI 模型（延迟加载）
 */
export async function initVoiceSeparationAI() {
  if (isAIReady) return true
  if (aiInitPromise) return aiInitPromise
  
  aiInitPromise = (async () => {
    try {
      console.log('Loading MusicVAE for voice separation...')
      mm = await import('@magenta/music')
      
      musicVAE = new mm.MusicVAE(
        'https://storage.googleapis.com/magentadata/js/checkpoints/music_vae/mel_4bar_small_q2'
      )
      await musicVAE.initialize()
      
      isAIReady = true
      console.log('Voice separation AI ready')
      return true
    } catch (error) {
      console.warn('Voice separation AI failed to load:', error)
      isAIReady = false
      return false
    }
  })()
  
  return aiInitPromise
}

/**
 * 检查 AI 是否可用
 */
export function isVoiceAIAvailable() {
  return isAIReady && musicVAE !== null
}


/**
 * 主入口：AI 辅助声部分离
 * @param {Array} upperStaff - 上谱表音符
 * @param {Array} lowerStaff - 下谱表音符
 * @param {Object} options - 配置选项
 * @returns {Promise<Object>} { soprano, alto, tenor, bass, metadata }
 */
export async function separateVoicesWithAI(upperStaff, lowerStaff, options = {}) {
  const startTime = Date.now()
  const metadata = {
    method: 'rule-only',
    aiUsed: false,
    confidence: 1.0,
    anomalies: []
  }
  
  // 第一层：规则引擎预处理
  const ruleResult = applyRuleBasedSeparation(upperStaff, lowerStaff)
  
  // 如果没有待判断的音符，直接返回规则结果
  if (ruleResult.pending.length === 0) {
    return {
      ...ruleResult.voices,
      metadata: { ...metadata, method: 'rule-only' }
    }
  }
  
  // 尝试使用 AI
  const useAI = options.useAI !== false && isVoiceAIAvailable()
  
  if (useAI) {
    try {
      // 设置超时
      const aiResult = await Promise.race([
        applyAISeparation(ruleResult, upperStaff, lowerStaff),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('AI timeout')), CONFIG.AI_TIMEOUT)
        )
      ])
      
      metadata.method = 'ai-assisted'
      metadata.aiUsed = true
      metadata.confidence = aiResult.confidence
      
      // 第三层：K-means 验证
      const validation = validateWithKmeans(aiResult.voices)
      metadata.anomalies = validation.anomalies
      
      return {
        ...aiResult.voices,
        metadata
      }
    } catch (error) {
      console.warn('AI separation failed, using rule fallback:', error.message)
    }
  }
  
  // 降级：使用纯规则处理待判断音符
  const fallbackResult = assignPendingByRules(ruleResult)
  metadata.method = 'rule-fallback'
  
  return {
    ...fallbackResult,
    metadata
  }
}

/**
 * 第一层：规则引擎预处理
 */
function applyRuleBasedSeparation(upperStaff, lowerStaff) {
  const voices = {
    soprano: [],
    alto: [],
    tenor: [],
    bass: []
  }
  const pending = []
  
  // 处理上谱表
  const upperGroups = groupNotesByBeat(upperStaff)
  upperGroups.forEach((notes, beat) => {
    const mainNotes = notes.filter(n => !n.embellishment)
    if (mainNotes.length === 0) return
    
    // 按音高排序（高到低）
    mainNotes.sort((a, b) => getMidi(b) - getMidi(a))
    
    if (mainNotes.length >= 2) {
      // 多音符：最高音是 Soprano，其余是 Alto
      voices.soprano.push({ ...mainNotes[0], voicePart: 'soprano', beat })
      mainNotes.slice(1).forEach(n => {
        voices.alto.push({ ...n, voicePart: 'alto', beat })
      })
    } else {
      // 单音符：标记为待判断
      pending.push({
        note: mainNotes[0],
        staff: 'upper',
        beat,
        candidates: ['soprano', 'alto']
      })
    }
  })
  
  // 处理下谱表
  const lowerGroups = groupNotesByBeat(lowerStaff)
  lowerGroups.forEach((notes, beat) => {
    const mainNotes = notes.filter(n => !n.embellishment)
    if (mainNotes.length === 0) return
    
    // 按音高排序（低到高）
    mainNotes.sort((a, b) => getMidi(a) - getMidi(b))
    
    if (mainNotes.length >= 2) {
      // 多音符：最低音是 Bass，其余是 Tenor
      voices.bass.push({ ...mainNotes[0], voicePart: 'bass', beat })
      mainNotes.slice(1).forEach(n => {
        voices.tenor.push({ ...n, voicePart: 'tenor', beat })
      })
    } else {
      // 单音符：标记为待判断
      pending.push({
        note: mainNotes[0],
        staff: 'lower',
        beat,
        candidates: ['tenor', 'bass']
      })
    }
  })
  
  return { voices, pending }
}


/**
 * 第二层：MusicVAE + KNN 智能归属
 */
async function applyAISeparation(ruleResult, upperStaff, lowerStaff) {
  const { voices, pending } = ruleResult
  let totalConfidence = 0
  let processedCount = 0
  
  // 为已确定的声部生成 embedding
  const embeddings = {
    soprano: await getVoiceEmbedding(voices.soprano),
    alto: await getVoiceEmbedding(voices.alto),
    tenor: await getVoiceEmbedding(voices.tenor),
    bass: await getVoiceEmbedding(voices.bass)
  }
  
  // 处理每个待判断的音符
  for (const item of pending) {
    const { note, staff, beat, candidates } = item
    
    // 获取音符上下文（前后各2个音符）
    const context = getContextNotes(
      staff === 'upper' ? upperStaff : lowerStaff,
      beat,
      2
    )
    
    // 生成待判断音符的 embedding
    const noteEmbedding = await getNoteEmbedding(note, context)
    
    if (noteEmbedding && embeddings[candidates[0]] && embeddings[candidates[1]]) {
      // KNN 投票
      const result = knnVote(noteEmbedding, embeddings, candidates)
      
      voices[result.label].push({ ...note, voicePart: result.label, beat })
      totalConfidence += result.confidence
      processedCount++
    } else {
      // 无法获取 embedding，使用音高规则
      const assigned = assignByPitchRange(note, staff)
      voices[assigned].push({ ...note, voicePart: assigned, beat })
      totalConfidence += 0.5 // 低置信度
      processedCount++
    }
  }
  
  const avgConfidence = processedCount > 0 ? totalConfidence / processedCount : 1.0
  
  return {
    voices,
    confidence: avgConfidence
  }
}

/**
 * 获取声部的 embedding
 */
async function getVoiceEmbedding(notes) {
  if (!notes || notes.length < 4) return null
  
  // 生成缓存键
  const cacheKey = notes.map(n => `${getMidi(n)}_${n.beat}`).join('|')
  if (embeddingCache.has(cacheKey)) {
    return embeddingCache.get(cacheKey)
  }
  
  try {
    // 转换为 NoteSequence 格式
    const noteSequence = notesToNoteSequence(notes.slice(0, CONFIG.CHUNK_SIZE))
    
    // 编码
    const z = await musicVAE.encode([noteSequence])
    const embedding = Array.from(z.dataSync())
    z.dispose()
    
    // 缓存
    embeddingCache.set(cacheKey, embedding)
    
    return embedding
  } catch (error) {
    console.warn('Failed to encode voice:', error)
    return null
  }
}

/**
 * 获取单个音符的 embedding（含上下文）
 */
async function getNoteEmbedding(note, context) {
  const notes = [...context.before, note, ...context.after]
  if (notes.length < 3) return null
  
  return getVoiceEmbedding(notes)
}

/**
 * 获取音符的上下文
 */
function getContextNotes(allNotes, targetBeat, range) {
  const sorted = [...allNotes]
    .filter(n => !n.embellishment)
    .sort((a, b) => a.startBeat - b.startBeat)
  
  const targetIdx = sorted.findIndex(n => 
    Math.abs(n.startBeat - targetBeat) < 0.1
  )
  
  if (targetIdx === -1) {
    return { before: [], after: [] }
  }
  
  return {
    before: sorted.slice(Math.max(0, targetIdx - range), targetIdx),
    after: sorted.slice(targetIdx + 1, targetIdx + 1 + range)
  }
}

/**
 * KNN 投票
 */
function knnVote(queryEmbedding, voiceEmbeddings, candidates) {
  const distances = []
  
  candidates.forEach(voice => {
    const embedding = voiceEmbeddings[voice]
    if (embedding) {
      const dist = cosineSimilarity(queryEmbedding, embedding)
      distances.push({ voice, similarity: dist })
    }
  })
  
  if (distances.length === 0) {
    return { label: candidates[0], confidence: 0.5 }
  }
  
  // 按相似度排序
  distances.sort((a, b) => b.similarity - a.similarity)
  
  const best = distances[0]
  const confidence = best.similarity
  
  return {
    label: best.voice,
    confidence: Math.max(0, Math.min(1, confidence))
  }
}


/**
 * 第三层：K-means 验证
 */
function validateWithKmeans(voices) {
  const anomalies = []
  
  // 收集所有音符的特征向量
  const allNotes = []
  const allLabels = []
  
  Object.entries(voices).forEach(([voiceName, notes]) => {
    notes.forEach(note => {
      const features = extractFeatures(note, notes)
      allNotes.push({ note, features, voice: voiceName })
      allLabels.push(voiceName)
    })
  })
  
  if (allNotes.length < CONFIG.KMEANS_K) {
    return { anomalies: [] }
  }
  
  // K-means 聚类
  const featureMatrix = allNotes.map(n => n.features)
  const { labels, centroids } = kmeans(featureMatrix, CONFIG.KMEANS_K)
  
  // 计算每个簇的标准差
  const clusterStats = computeClusterStats(featureMatrix, labels, centroids)
  
  // 检测异常
  allNotes.forEach((item, idx) => {
    const clusterIdx = labels[idx]
    const distance = euclideanDistance(item.features, centroids[clusterIdx])
    const stdDev = clusterStats[clusterIdx].stdDev
    
    if (distance > CONFIG.ANOMALY_THRESHOLD * stdDev) {
      anomalies.push({
        note: item.note,
        assignedVoice: item.voice,
        distance,
        threshold: CONFIG.ANOMALY_THRESHOLD * stdDev
      })
    }
  })
  
  return { anomalies }
}

/**
 * 提取音符特征向量
 */
function extractFeatures(note, voiceNotes) {
  const midi = getMidi(note)
  const duration = note.duration?.ticks || 1024
  const beat = note.beat || note.startBeat || 1
  
  // 计算与前后音符的音程
  const sorted = voiceNotes
    .filter(n => n !== note)
    .sort((a, b) => (a.beat || a.startBeat) - (b.beat || b.startBeat))
  
  const noteIdx = sorted.findIndex(n => 
    (n.beat || n.startBeat) > (note.beat || note.startBeat)
  )
  
  const prevNote = noteIdx > 0 ? sorted[noteIdx - 1] : null
  const nextNote = noteIdx >= 0 && noteIdx < sorted.length ? sorted[noteIdx] : null
  
  const intervalToPrev = prevNote ? midi - getMidi(prevNote) : 0
  const intervalToNext = nextNote ? getMidi(nextNote) - midi : 0
  
  return [
    midi / 127,                    // 归一化音高
    duration / 4096,               // 归一化时值
    (beat % 4) / 4,                // 拍位（0-1）
    intervalToPrev / 24,           // 与前音音程（归一化）
    intervalToNext / 24            // 与后音音程（归一化）
  ]
}

/**
 * K-means 聚类算法
 */
function kmeans(data, k, maxIterations = 50) {
  if (data.length === 0 || k <= 0) return { labels: [], centroids: [] }
  
  const n = data.length
  const dim = data[0].length
  
  // 初始化质心（K-means++）
  const centroids = initCentroidsKMeansPlusPlus(data, k)
  
  let labels = new Array(n).fill(0)
  
  for (let iter = 0; iter < maxIterations; iter++) {
    // 分配点到最近的质心
    const newLabels = data.map(point => {
      let minDist = Infinity
      let minIdx = 0
      centroids.forEach((centroid, idx) => {
        const dist = euclideanDistance(point, centroid)
        if (dist < minDist) {
          minDist = dist
          minIdx = idx
        }
      })
      return minIdx
    })
    
    // 检查收敛
    if (arraysEqual(labels, newLabels)) break
    labels = newLabels
    
    // 更新质心
    for (let c = 0; c < k; c++) {
      const clusterPoints = data.filter((_, i) => labels[i] === c)
      if (clusterPoints.length > 0) {
        centroids[c] = new Array(dim).fill(0).map((_, d) =>
          clusterPoints.reduce((sum, p) => sum + p[d], 0) / clusterPoints.length
        )
      }
    }
  }
  
  return { labels, centroids }
}

/**
 * K-means++ 初始化
 */
function initCentroidsKMeansPlusPlus(data, k) {
  const centroids = []
  const n = data.length
  
  // 随机选择第一个质心
  centroids.push([...data[Math.floor(Math.random() * n)]])
  
  while (centroids.length < k) {
    // 计算每个点到最近质心的距离
    const distances = data.map(point => {
      let minDist = Infinity
      centroids.forEach(centroid => {
        const dist = euclideanDistance(point, centroid)
        if (dist < minDist) minDist = dist
      })
      return minDist * minDist // 距离平方
    })
    
    // 按距离概率选择下一个质心
    const totalDist = distances.reduce((a, b) => a + b, 0)
    let random = Math.random() * totalDist
    
    for (let i = 0; i < n; i++) {
      random -= distances[i]
      if (random <= 0) {
        centroids.push([...data[i]])
        break
      }
    }
  }
  
  return centroids
}

/**
 * 计算簇统计信息
 */
function computeClusterStats(data, labels, centroids) {
  const k = centroids.length
  const stats = []
  
  for (let c = 0; c < k; c++) {
    const clusterPoints = data.filter((_, i) => labels[i] === c)
    
    if (clusterPoints.length === 0) {
      stats.push({ mean: 0, stdDev: 1 })
      continue
    }
    
    const distances = clusterPoints.map(p => euclideanDistance(p, centroids[c]))
    const mean = distances.reduce((a, b) => a + b, 0) / distances.length
    const variance = distances.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / distances.length
    
    stats.push({
      mean,
      stdDev: Math.sqrt(variance) || 1
    })
  }
  
  return stats
}


/**
 * 辅助函数：按规则分配待判断音符（降级方案）
 */
function assignPendingByRules(ruleResult) {
  const { voices, pending } = ruleResult
  
  pending.forEach(item => {
    const { note, staff, beat } = item
    const assigned = assignByPitchRange(note, staff)
    voices[assigned].push({ ...note, voicePart: assigned, beat })
  })
  
  return voices
}

/**
 * 根据音高范围分配声部
 */
function assignByPitchRange(note, staff) {
  const midi = getMidi(note)
  
  if (staff === 'upper') {
    // 上谱表：C5(72) 以上是 Soprano，以下是 Alto
    return midi >= 72 ? 'soprano' : 'alto'
  } else {
    // 下谱表：C3(48) 以下是 Bass，以上是 Tenor
    return midi < 48 ? 'bass' : 'tenor'
  }
}

/**
 * 按拍位分组音符
 */
function groupNotesByBeat(notes) {
  const groups = new Map()
  
  if (!notes || !Array.isArray(notes)) return groups
  
  notes.forEach(note => {
    if (!note) return
    const beat = Math.round((note.startBeat || 1) * 2) / 2
    if (!groups.has(beat)) {
      groups.set(beat, [])
    }
    groups.get(beat).push(note)
  })
  
  return groups
}

/**
 * 获取 MIDI 音高
 */
function getMidi(note) {
  if (!note) return 60
  if (note.midi) return note.midi
  if (!note.pitch) return 60
  
  const semitones = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
  return (note.pitch.octave + 1) * 12 + 
         (semitones[note.pitch.step] || 0) + 
         (note.pitch.alter || 0)
}

/**
 * 转换音符为 NoteSequence 格式
 */
function notesToNoteSequence(notes) {
  const quarterNoteDuration = 0.5
  
  const seqNotes = notes.map((note, idx) => ({
    pitch: getMidi(note),
    startTime: idx * quarterNoteDuration,
    endTime: (idx + 1) * quarterNoteDuration,
    velocity: 80
  }))
  
  return {
    notes: seqNotes,
    totalTime: notes.length * quarterNoteDuration,
    tempos: [{ time: 0, qpm: 120 }],
    quantizationInfo: { stepsPerQuarter: 4 }
  }
}

/**
 * 余弦相似度
 */
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0
  
  let dotProduct = 0
  let normA = 0
  let normB = 0
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  
  const denominator = Math.sqrt(normA) * Math.sqrt(normB)
  return denominator === 0 ? 0 : dotProduct / denominator
}

/**
 * 欧氏距离
 */
function euclideanDistance(a, b) {
  if (!Array.isArray(a)) return Math.abs(a - b)
  return Math.sqrt(a.reduce((sum, val, i) => sum + Math.pow(val - (b[i] || 0), 2), 0))
}

/**
 * 数组相等判断
 */
function arraysEqual(a, b) {
  return a.length === b.length && a.every((val, i) => val === b[i])
}

/**
 * 清除 embedding 缓存
 */
export function clearEmbeddingCache() {
  embeddingCache.clear()
}

/**
 * 获取 AI 状态信息
 */
export function getAIStatus() {
  return {
    isReady: isAIReady,
    cacheSize: embeddingCache.size,
    config: CONFIG
  }
}
