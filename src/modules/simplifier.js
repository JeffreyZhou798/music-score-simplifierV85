/**
 * Simplification Engine
 * Orchestrates the simplification process
 * 
 * 支持两种模式：
 * 1. 同步模式（simplifyScore）- 使用规则引擎
 * 2. 异步模式（simplifyScoreAsync）- 使用AI增强的声部分离
 */

import { applySingleStaffSimplification } from '../rules/singleStaff.js'
import { applyGrandStaffSimplification, applyGrandStaffSimplificationAsync } from '../rules/grandStaff.js'
import { isAnacrusis } from './analyzer.js'

/**
 * Simplify an analyzed score (同步版本，使用规则引擎)
 * @param {Object} analyzedScore - Analyzed score from analyzer
 * @param {Object} config - Simplification configuration
 * @returns {Object} Simplified score
 */
export function simplifyScore(analyzedScore, config) {
  const { metadata, measures, scoreType } = analyzedScore
  const { mainLevel, sopranoLevel, bassLevel } = config
  
  // Check for anacrusis in first measure
  const hasAnacrusis = measures.length > 0 && isAnacrusis(measures[0], metadata.timeSignature)
  
  const simplifiedMeasures = measures.map((measure, index) => {
    // Preserve anacrusis (pickup measure) as-is
    if (hasAnacrusis && index === 0) {
      return preserveAnacrusis(measure)
    }
    
    if (scoreType === 'single-staff') {
      return applySingleStaffSimplification(measure, mainLevel, metadata.timeSignature)
    } else {
      return applyGrandStaffSimplification(measure, mainLevel, metadata.timeSignature, {
        sopranoLevel: sopranoLevel || getDefaultSopranoLevel(mainLevel),
        bassLevel: bassLevel || getDefaultBassLevel(mainLevel)
      })
    }
  })
  
  return {
    metadata,
    measures: simplifiedMeasures,
    simplificationLevel: mainLevel,
    scoreType
  }
}

/**
 * Simplify an analyzed score (异步版本，支持AI声部分离)
 * 
 * 使用三层决策架构进行声部分离：
 * 1. 规则引擎（快速筛选）
 * 2. MusicVAE + KNN（智能归属）
 * 3. K-means 验证（质量检查）
 * 
 * @param {Object} analyzedScore - Analyzed score from analyzer
 * @param {Object} config - Simplification configuration
 * @param {Function} onProgress - Progress callback (optional)
 * @returns {Promise<Object>} Simplified score
 */
export async function simplifyScoreAsync(analyzedScore, config, onProgress = null) {
  const { metadata, measures, scoreType } = analyzedScore
  const { mainLevel, sopranoLevel, bassLevel } = config
  
  // Check for anacrusis in first measure
  const hasAnacrusis = measures.length > 0 && isAnacrusis(measures[0], metadata.timeSignature)
  
  const simplifiedMeasures = []
  const totalMeasures = measures.length
  
  for (let index = 0; index < measures.length; index++) {
    const measure = measures[index]
    
    // Report progress
    if (onProgress) {
      onProgress(Math.round((index / totalMeasures) * 100))
    }
    
    // Preserve anacrusis (pickup measure) as-is
    if (hasAnacrusis && index === 0) {
      simplifiedMeasures.push(preserveAnacrusis(measure))
      continue
    }
    
    if (scoreType === 'single-staff') {
      simplifiedMeasures.push(
        applySingleStaffSimplification(measure, mainLevel, metadata.timeSignature)
      )
    } else {
      // 使用AI增强的异步声部分离
      const simplified = await applyGrandStaffSimplificationAsync(
        measure, 
        mainLevel, 
        metadata.timeSignature, 
        {
          sopranoLevel: sopranoLevel || getDefaultSopranoLevel(mainLevel),
          bassLevel: bassLevel || getDefaultBassLevel(mainLevel)
        }
      )
      simplifiedMeasures.push(simplified)
    }
  }
  
  if (onProgress) {
    onProgress(100)
  }
  
  return {
    metadata,
    measures: simplifiedMeasures,
    simplificationLevel: mainLevel,
    scoreType
  }
}

/**
 * Preserve anacrusis measure
 * @param {Object} measure - Anacrusis measure
 * @returns {Object} Preserved measure
 */
function preserveAnacrusis(measure) {
  // Remove embellishments but preserve structure
  const notes = measure.notes.filter(n => !n.embellishment)
  return { ...measure, notes }
}

/**
 * Get default soprano level for grand staff
 * @param {number} mainLevel - Main simplification level
 * @returns {number} Default soprano level
 */
function getDefaultSopranoLevel(mainLevel) {
  const defaults = { 1: 4, 2: 4, 3: 5, 4: 4, 5: 5 }
  return defaults[mainLevel] || 4
}

/**
 * Get default bass level for grand staff
 * @param {number} mainLevel - Main simplification level
 * @returns {number} Default bass level
 */
function getDefaultBassLevel(mainLevel) {
  const defaults = { 1: 1, 2: 2, 3: 2, 4: 2, 5: 5 }
  return defaults[mainLevel] || 2
}

/**
 * Get level description for UI
 * @param {number} level - Level number
 * @param {string} scoreType - Score type
 * @returns {Object} Level description
 */
export function getLevelDescription(level, scoreType) {
  if (scoreType === 'single-staff') {
    return SINGLE_STAFF_DESCRIPTIONS[level]
  }
  return GRAND_STAFF_DESCRIPTIONS[level]
}

const SINGLE_STAFF_DESCRIPTIONS = {
  1: {
    title: 'Level 1 - Skeleton',
    description: 'Keeps only the first note of each measure, extended to fill the entire measure. Simplest version for absolute beginners.'
  },
  2: {
    title: 'Level 2 - Strong Beats',
    description: 'Keeps notes on strong beat positions only. Each note extends to cover weak beats until the next strong beat.'
  },
  3: {
    title: 'Level 3 - Beat Heads',
    description: 'Keeps the first note of each beat (beat-head notes). Removes subdivisions within beats while preserving the basic pulse.'
  },
  4: {
    title: 'Level 4 - Rhythmic Core',
    description: 'Preserves quarter and eighth notes. Converts shorter notes to eighths. Maintains syncopation, dotted rhythms, and tied notes.'
  },
  5: {
    title: 'Level 5 - Near Original',
    description: 'Removes ornaments (grace notes, trills, turns) only. All other musical elements preserved as in the original score.'
  }
}

const GRAND_STAFF_DESCRIPTIONS = {
  1: {
    title: 'Level 1 - Two-Voice Skeleton',
    description: 'Right hand: Soprano melody (customizable L1-5). Left hand: Bass note per measure (customizable L1-5). Two-part harmony for beginners.'
  },
  2: {
    title: 'Level 2 - Three-Voice (RH Enhanced)',
    description: 'Right hand: Soprano (customizable L2-5) + Alto on strong beats. Left hand: Bass on strong beats (customizable L2-5). Three-part harmony.'
  },
  3: {
    title: 'Level 3 - Three-Voice (LH Enhanced)',
    description: 'Right hand: Soprano only (customizable L2-5). Left hand: Tenor + Bass on strong beats (customizable L2-5). Three-part harmony with fuller bass.'
  },
  4: {
    title: 'Level 4 - Four-Voice Harmony',
    description: 'Right hand: Soprano (customizable L2-5) + Alto (L4). Left hand: Tenor (L4) + Bass (customizable L2-5). Full SATB with rhythmic simplification.'
  },
  5: {
    title: 'Level 5 - Near Original',
    description: 'Right hand: Soprano (customizable L4-5) + Alto (L5). Left hand: Tenor (L5) + Bass (customizable L4-5). Ornaments removed, all else preserved.'
  }
}
