/**
 * Chunk Processor Module
 * 分块处理器 - 用于大型乐谱的分块并行处理
 * 
 * 根据 MSS模型组合架构方案：
 * - chunkSize: 8小节
 * - overlapSize: 1小节（避免边界问题）
 * - maxConcurrency: 4（最多并行Worker数量）
 */

const CONFIG = {
  CHUNK_SIZE: 8,        // 每次处理的小节数
  OVERLAP_SIZE: 1,      // 重叠区域避免边界问题
  MAX_CONCURRENCY: 4    // 最多并行处理数量
}

/**
 * 将小节数组分割成块
 * @param {Array} measures - 小节数组
 * @returns {Array} 分块后的数组
 */
export function splitIntoChunks(measures) {
  const chunks = []
  
  for (let i = 0; i < measures.length; i += CONFIG.CHUNK_SIZE) {
    const startIdx = Math.max(0, i - CONFIG.OVERLAP_SIZE)
    const endIdx = Math.min(measures.length, i + CONFIG.CHUNK_SIZE + CONFIG.OVERLAP_SIZE)
    
    chunks.push({
      id: Math.floor(i / CONFIG.CHUNK_SIZE),
      measures: measures.slice(startIdx, endIdx),
      startIndex: i,
      originalStartIndex: startIdx,
      originalEndIndex: endIdx,
      isFirst: i === 0,
      isLast: i + CONFIG.CHUNK_SIZE >= measures.length
    })
  }
  
  return chunks
}

/**
 * 合并处理后的块
 * @param {Array} processedChunks - 处理后的块数组
 * @returns {Array} 合并后的小节数组
 */
export function mergeChunks(processedChunks) {
  const merged = []
  
  // 按ID排序
  processedChunks.sort((a, b) => a.id - b.id)
  
  processedChunks.forEach((chunk, index) => {
    if (index === 0) {
      // 第一个chunk完整保留
      merged.push(...chunk.measures)
    } else {
      // 后续chunk跳过重叠部分
      const skipCount = CONFIG.OVERLAP_SIZE
      merged.push(...chunk.measures.slice(skipCount))
    }
  })
  
  // 边界平滑处理
  smoothChunkBoundaries(merged)
  
  return merged
}

/**
 * 边界平滑处理
 * 检查chunk交界处的连线和声部连续性
 * @param {Array} measures - 合并后的小节数组
 */
function smoothChunkBoundaries(measures) {
  for (let i = CONFIG.CHUNK_SIZE - 1; i < measures.length; i += CONFIG.CHUNK_SIZE) {
    if (i >= measures.length - 1) continue
    
    const prevMeasure = measures[i]
    const nextMeasure = measures[i + 1]
    
    if (!prevMeasure?.notes || !nextMeasure?.notes) continue
    
    // 检查跨小节连线
    prevMeasure.notes.forEach(note => {
      if (note.tiedTo === 'pending') {
        // 查找下一小节中匹配的音符
        const matchingNote = nextMeasure.notes.find(n => 
          n.pitch?.step === note.pitch?.step &&
          n.pitch?.octave === note.pitch?.octave &&
          n.staff === note.staff
        )
        if (matchingNote) {
          note.tiedTo = matchingNote.id
        }
      }
    })
  }
}

/**
 * 并行处理块（使用Promise.all限制并发）
 * @param {Array} chunks - 块数组
 * @param {Function} processFn - 处理函数
 * @param {Function} onProgress - 进度回调
 * @returns {Promise<Array>} 处理后的块数组
 */
export async function processChunksParallel(chunks, processFn, onProgress = null) {
  const results = []
  let completed = 0
  
  // 分批处理，每批最多 MAX_CONCURRENCY 个
  for (let i = 0; i < chunks.length; i += CONFIG.MAX_CONCURRENCY) {
    const batch = chunks.slice(i, i + CONFIG.MAX_CONCURRENCY)
    
    const batchResults = await Promise.all(
      batch.map(async (chunk) => {
        const result = await processFn(chunk)
        completed++
        if (onProgress) {
          onProgress(Math.round((completed / chunks.length) * 100))
        }
        return result
      })
    )
    
    results.push(...batchResults)
  }
  
  return results
}

/**
 * 获取分块配置
 */
export function getChunkConfig() {
  return { ...CONFIG }
}

/**
 * 更新分块配置
 * @param {Object} newConfig - 新配置
 */
export function updateChunkConfig(newConfig) {
  Object.assign(CONFIG, newConfig)
}
