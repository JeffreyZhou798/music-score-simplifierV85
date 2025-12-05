/**
 * Memory Manager Module
 * 内存管理器 - 用于缓存管理和内存优化
 * 
 * 根据 MSS模型组合架构方案：
 * - 缓存上限: 50MB
 * - 使用LRU算法淘汰
 * - 支持IndexedDB存储已处理chunk
 */

const CONFIG = {
  MAX_CACHE_SIZE: 50 * 1024 * 1024, // 50MB
  EVICTION_RATIO: 0.2               // 淘汰最老的20%
}

/**
 * 内存管理器类
 */
class MemoryManager {
  constructor() {
    this.cache = new Map()
    this.currentSize = 0
    this.accessOrder = [] // LRU追踪
  }
  
  /**
   * 缓存数据
   * @param {string} key - 缓存键
   * @param {*} data - 数据
   * @param {number} size - 数据大小（字节）
   */
  set(key, data, size = 0) {
    // 估算大小
    if (size === 0) {
      size = this.estimateSize(data)
    }
    
    // 检查是否需要淘汰
    while (this.currentSize + size > CONFIG.MAX_CACHE_SIZE && this.cache.size > 0) {
      this.evictOldest()
    }
    
    // 如果已存在，先删除旧的
    if (this.cache.has(key)) {
      const oldEntry = this.cache.get(key)
      this.currentSize -= oldEntry.size
      this.accessOrder = this.accessOrder.filter(k => k !== key)
    }
    
    // 添加新条目
    this.cache.set(key, {
      data,
      size,
      timestamp: Date.now()
    })
    this.currentSize += size
    this.accessOrder.push(key)
  }
  
  /**
   * 获取缓存数据
   * @param {string} key - 缓存键
   * @returns {*} 缓存的数据或null
   */
  get(key) {
    const entry = this.cache.get(key)
    if (!entry) return null
    
    // 更新访问顺序（LRU）
    this.accessOrder = this.accessOrder.filter(k => k !== key)
    this.accessOrder.push(key)
    entry.timestamp = Date.now()
    
    return entry.data
  }
  
  /**
   * 检查是否存在
   * @param {string} key - 缓存键
   * @returns {boolean}
   */
  has(key) {
    return this.cache.has(key)
  }
  
  /**
   * 删除缓存
   * @param {string} key - 缓存键
   */
  delete(key) {
    const entry = this.cache.get(key)
    if (entry) {
      this.currentSize -= entry.size
      this.cache.delete(key)
      this.accessOrder = this.accessOrder.filter(k => k !== key)
    }
  }
  
  /**
   * 淘汰最老的条目
   */
  evictOldest() {
    const toRemove = Math.ceil(this.cache.size * CONFIG.EVICTION_RATIO)
    
    for (let i = 0; i < toRemove && this.accessOrder.length > 0; i++) {
      const oldestKey = this.accessOrder.shift()
      const entry = this.cache.get(oldestKey)
      if (entry) {
        this.currentSize -= entry.size
        this.cache.delete(oldestKey)
      }
    }
  }
  
  /**
   * 清空缓存
   */
  clear() {
    this.cache.clear()
    this.currentSize = 0
    this.accessOrder = []
  }
  
  /**
   * 估算数据大小
   * @param {*} data - 数据
   * @returns {number} 估算的字节数
   */
  estimateSize(data) {
    if (data === null || data === undefined) return 0
    
    if (typeof data === 'string') {
      return data.length * 2 // UTF-16
    }
    
    if (typeof data === 'number') {
      return 8
    }
    
    if (typeof data === 'boolean') {
      return 4
    }
    
    if (Array.isArray(data)) {
      if (data.length === 0) return 0
      // 采样估算
      const sampleSize = Math.min(10, data.length)
      let sampleTotal = 0
      for (let i = 0; i < sampleSize; i++) {
        sampleTotal += this.estimateSize(data[i])
      }
      return (sampleTotal / sampleSize) * data.length
    }
    
    if (data instanceof Float32Array || data instanceof Float64Array) {
      return data.length * data.BYTES_PER_ELEMENT
    }
    
    if (typeof data === 'object') {
      let size = 0
      for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          size += key.length * 2 + this.estimateSize(data[key])
        }
      }
      return size
    }
    
    return 64 // 默认估算
  }
  
  /**
   * 获取缓存统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    return {
      entries: this.cache.size,
      currentSize: this.currentSize,
      maxSize: CONFIG.MAX_CACHE_SIZE,
      usagePercent: Math.round((this.currentSize / CONFIG.MAX_CACHE_SIZE) * 100)
    }
  }
}

// 单例实例
const memoryManager = new MemoryManager()

export default memoryManager

export {
  MemoryManager,
  memoryManager
}
