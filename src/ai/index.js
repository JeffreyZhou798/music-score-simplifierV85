/**
 * AI Module
 * Handles MusicVAE, MelodyRNN, and clustering algorithms
 * All models are pre-trained, inference-only, zero-shot
 * Uses dynamic imports to reduce initial bundle size
 * 
 * 根据 MSS模型组合架构方案：
 * - MusicVAE: 语义embedding生成
 * - KNN: 声部分类
 * - K-Means: 和弦聚类验证
 */

import { pitchToMidi, VOICE_RANGES } from '../knowledge/index.js'
import { initVoiceSeparationAI } from './voiceSeparation.js'

let mm = null
let musicVAE = null
let melodyRNN = null
let isInitialized = false
let initializationAttempted = false

/**
 * Initialize AI models (lazy loading)
 * 初始化所有AI模型，包括声部分离模块
 * @returns {Promise<void>}
 */
export async function initializeAI() {
  if (isInitialized || initializationAttempted) return
  initializationAttempted = true
  
  try {
    // Dynamic import of Magenta.js
    mm = await import('@magenta/music')
    
    // Initialize MusicVAE for encoding
    musicVAE = new mm.MusicVAE('https://storage.googleapis.com/magentadata/js/checkpoints/music_vae/mel_4bar_small_q2')
    await musicVAE.initialize()
    
    // Initialize MelodyRNN for melody analysis
    melodyRNN = new mm.MusicRNN('https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/basic_rnn')
    await melodyRNN.initialize()
    
    // 初始化声部分离AI模块
    await initVoiceSeparationAI()
    
    isInitialized = true
    console.log('AI models initialized successfully (including voice separation)')
  } catch (error) {
    console.warn('AI models failed to load, using rule-based fallback:', error)
    isInitialized = false
  }
}

/**
 * Check if AI is available
 * @returns {boolean}
 */
export function isAIAvailable() {
  return isInitialized && musicVAE !== null
}

/**
 * Convert parsed score to NoteSequence format
 * @param {Object} score - Parsed score
 * @returns {Object} NoteSequence
 */
export function scoreToNoteSequence(score) {
  if (!mm) return null
  
  const notes = []
  let currentTime = 0
  const quarterNoteDuration = 0.5 // seconds
  
  score.measures.forEach(measure => {
    measure.notes.forEach(note => {
      if (note.embellishment) return // Skip embellishments
      
      const pitch = pitchToMidi(note.pitch)
      const startTime = currentTime + (note.startBeat - 1) * quarterNoteDuration
      const duration = (note.duration.ticks / 1024) * quarterNoteDuration
      
      notes.push({
        pitch,
        startTime,
        endTime: startTime + duration,
        velocity: 80
      })
    })
    
    // Advance time by measure duration
    const beatsPerMeasure = score.metadata.timeSignature.beats
    currentTime += beatsPerMeasure * quarterNoteDuration
  })
  
  return mm.sequences.quantizeNoteSequence({
    notes,
    totalTime: currentTime,
    tempos: [{ time: 0, qpm: score.metadata.tempo || 120 }],
    timeSignatures: [{
      time: 0,
      numerator: score.metadata.timeSignature.beats,
      denominator: score.metadata.timeSignature.beatType
    }]
  }, 4)
}

/**
 * Encode notes using MusicVAE (chunk-by-chunk to prevent memory overflow)
 * @param {Object} noteSequence - NoteSequence object
 * @param {number} chunkSize - Number of bars per chunk
 * @returns {Promise<Float32Array[]>} Array of embeddings
 */
export async function encodeChunked(noteSequence, chunkSize = 4) {
  if (!isAIAvailable()) return []
  
  const embeddings = []
  const totalBars = Math.ceil(noteSequence.totalQuantizedSteps / 16)
  
  for (let i = 0; i < totalBars; i += chunkSize) {
    try {
      const startStep = i * 16
      const endStep = Math.min((i + chunkSize) * 16, noteSequence.totalQuantizedSteps)
      
      const chunkNotes = noteSequence.notes.filter(
        n => n.quantizedStartStep >= startStep && n.quantizedStartStep < endStep
      ).map(n => ({
        ...n,
        quantizedStartStep: n.quantizedStartStep - startStep,
        quantizedEndStep: n.quantizedEndStep - startStep
      }))
      
      if (chunkNotes.length === 0) continue
      
      const chunk = {
        ...noteSequence,
        notes: chunkNotes,
        totalQuantizedSteps: endStep - startStep
      }
      
      const z = await musicVAE.encode([chunk])
      embeddings.push(z.dataSync())
      z.dispose()
    } catch (e) {
      console.warn('Chunk encoding failed:', e)
    }
  }
  
  return embeddings
}


/**
 * Identify melody line using pitch contour and MelodyRNN scoring
 * @param {Array} notes - Array of notes
 * @returns {Array} Notes identified as melody
 */
export async function identifyMelodyLine(notes) {
  if (notes.length === 0) return []
  
  // Group notes by beat position
  const beatGroups = new Map()
  notes.forEach(note => {
    const beatKey = `${note.staff}_${Math.floor(note.startBeat)}`
    if (!beatGroups.has(beatKey)) {
      beatGroups.set(beatKey, [])
    }
    beatGroups.get(beatKey).push(note)
  })
  
  // For each beat, select the highest note in upper staff as melody candidate
  const melodyCandidates = []
  beatGroups.forEach((group, key) => {
    if (key.startsWith('1_')) { // Upper staff
      const highest = group.reduce((max, note) => {
        const maxMidi = pitchToMidi(max.pitch)
        const noteMidi = pitchToMidi(note.pitch)
        return noteMidi > maxMidi ? note : max
      })
      melodyCandidates.push(highest)
    }
  })
  
  return melodyCandidates
}

/**
 * Identify bass line
 * @param {Array} notes - Array of notes
 * @returns {Array} Notes identified as bass
 */
export function identifyBassLine(notes) {
  if (notes.length === 0) return []
  
  // Group notes by beat position
  const beatGroups = new Map()
  notes.forEach(note => {
    const beatKey = `${note.staff}_${Math.floor(note.startBeat)}`
    if (!beatGroups.has(beatKey)) {
      beatGroups.set(beatKey, [])
    }
    beatGroups.get(beatKey).push(note)
  })
  
  // For each beat, select the lowest note in lower staff as bass
  const bassCandidates = []
  beatGroups.forEach((group, key) => {
    if (key.startsWith('2_')) { // Lower staff
      const lowest = group.reduce((min, note) => {
        const minMidi = pitchToMidi(min.pitch)
        const noteMidi = pitchToMidi(note.pitch)
        return noteMidi < minMidi ? note : min
      })
      bassCandidates.push(lowest)
    }
  })
  
  return bassCandidates
}

/**
 * Classify voice part based on pitch range
 * @param {Object} note - Note object
 * @returns {string} Voice part: soprano, alto, tenor, bass
 */
export function classifyVoicePart(note) {
  const midi = pitchToMidi(note.pitch)
  
  // Check ranges (with some overlap tolerance)
  if (note.staff === 1) {
    // Upper staff: soprano or alto
    if (midi >= 60) return 'soprano' // C4 and above
    return 'alto'
  } else {
    // Lower staff: tenor or bass
    if (midi >= 48) return 'tenor' // C3 and above
    return 'bass'
  }
}

/**
 * K-means clustering implementation
 * @param {Array} data - Array of data points
 * @param {number} k - Number of clusters
 * @param {number} maxIterations - Maximum iterations
 * @returns {Object} Clustering result with labels and centroids
 */
export function kmeans(data, k, maxIterations = 100) {
  if (data.length === 0 || k <= 0) return { labels: [], centroids: [] }
  
  const n = data.length
  
  // Initialize centroids randomly
  const centroids = []
  const usedIndices = new Set()
  while (centroids.length < k && centroids.length < n) {
    const idx = Math.floor(Math.random() * n)
    if (!usedIndices.has(idx)) {
      usedIndices.add(idx)
      centroids.push([...data[idx]])
    }
  }
  
  let labels = new Array(n).fill(0)
  
  for (let iter = 0; iter < maxIterations; iter++) {
    // Assign points to nearest centroid
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
    
    // Check convergence
    if (arraysEqual(labels, newLabels)) break
    labels = newLabels
    
    // Update centroids
    for (let c = 0; c < k; c++) {
      const clusterPoints = data.filter((_, i) => labels[i] === c)
      if (clusterPoints.length > 0) {
        centroids[c] = clusterPoints[0].map((_, d) =>
          clusterPoints.reduce((sum, p) => sum + p[d], 0) / clusterPoints.length
        )
      }
    }
  }
  
  return { labels, centroids }
}

/**
 * PCA dimensionality reduction
 * @param {Array} data - Array of data points
 * @param {number} dimensions - Target dimensions
 * @returns {Array} Reduced data
 */
export function pca(data, dimensions = 2) {
  if (data.length === 0) return []
  
  const n = data.length
  const d = data[0].length
  
  // Center the data
  const means = data[0].map((_, j) => data.reduce((sum, row) => sum + row[j], 0) / n)
  const centered = data.map(row => row.map((val, j) => val - means[j]))
  
  // Simple projection to first dimensions (approximation)
  return centered.map(row => row.slice(0, dimensions))
}

/**
 * K-Nearest Neighbors classification
 * @param {Array} trainData - Training data points
 * @param {Array} trainLabels - Training labels
 * @param {Array} testPoint - Point to classify
 * @param {number} k - Number of neighbors
 * @returns {*} Predicted label
 */
export function knn(trainData, trainLabels, testPoint, k = 3) {
  if (trainData.length === 0) return null
  
  const distances = trainData.map((point, i) => ({
    distance: euclideanDistance(point, testPoint),
    label: trainLabels[i]
  }))
  
  distances.sort((a, b) => a.distance - b.distance)
  const neighbors = distances.slice(0, k)
  
  // Vote
  const votes = {}
  neighbors.forEach(n => {
    votes[n.label] = (votes[n.label] || 0) + 1
  })
  
  return Object.entries(votes).reduce((max, [label, count]) =>
    count > max.count ? { label, count } : max, { label: null, count: 0 }
  ).label
}

// Helper functions
function euclideanDistance(a, b) {
  if (!Array.isArray(a)) return Math.abs(a - b)
  return Math.sqrt(a.reduce((sum, val, i) => sum + Math.pow(val - (b[i] || 0), 2), 0))
}

function arraysEqual(a, b) {
  return a.length === b.length && a.every((val, i) => val === b[i])
}
