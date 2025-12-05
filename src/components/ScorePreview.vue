<template>
  <div class="score-preview">
    <div class="preview-header">
      <h3>{{ metadata?.title || 'Untitled' }}</h3>
      <p class="composer">{{ metadata?.composer || 'Unknown Composer' }}</p>
    </div>
    
    <div class="preview-info">
      <div class="info-item">
        <span class="info-label">Score Type:</span>
        <span class="info-value">{{ score.scoreType === 'grand-staff' ? 'Grand Staff' : 'Single Staff' }}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Simplification Level:</span>
        <span class="info-value">Level {{ score.simplificationLevel }}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Time Signature:</span>
        <span class="info-value">{{ metadata?.timeSignature?.beats }}/{{ metadata?.timeSignature?.beatType }}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Tempo:</span>
        <span class="info-value">{{ metadata?.tempo || 120 }} BPM</span>
      </div>
      <div class="info-item">
        <span class="info-label">Measures:</span>
        <span class="info-value">{{ score.measures?.length || 0 }}</span>
      </div>
    </div>
    
    <div class="preview-stats">
      <h4>Simplification Summary</h4>
      <div class="stats-grid">
        <div class="stat-item">
          <span class="stat-number">{{ totalNotes }}</span>
          <span class="stat-label">Notes</span>
        </div>
        <div v-if="score.scoreType === 'grand-staff'" class="stat-item">
          <span class="stat-number">{{ voiceCounts.soprano }}</span>
          <span class="stat-label">Soprano</span>
        </div>
        <div v-if="score.scoreType === 'grand-staff'" class="stat-item">
          <span class="stat-number">{{ voiceCounts.alto }}</span>
          <span class="stat-label">Alto</span>
        </div>
        <div v-if="score.scoreType === 'grand-staff'" class="stat-item">
          <span class="stat-number">{{ voiceCounts.tenor }}</span>
          <span class="stat-label">Tenor</span>
        </div>
        <div v-if="score.scoreType === 'grand-staff'" class="stat-item">
          <span class="stat-number">{{ voiceCounts.bass }}</span>
          <span class="stat-label">Bass</span>
        </div>
      </div>
    </div>
    
    <div class="preview-actions">
      <button class="btn btn-secondary" @click="$emit('returnToAnalysis')">
        ← Return to Analysis
      </button>
      <button class="btn btn-secondary" @click="$emit('returnToSimplification')">
        ← Adjust Settings
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  score: Object,
  metadata: Object
})

defineEmits(['returnToAnalysis', 'returnToSimplification'])

const totalNotes = computed(() => {
  if (!props.score?.measures) return 0
  return props.score.measures.reduce((sum, m) => sum + (m.notes?.length || 0), 0)
})

const voiceCounts = computed(() => {
  const counts = { soprano: 0, alto: 0, tenor: 0, bass: 0 }
  if (!props.score?.measures) return counts
  
  props.score.measures.forEach(m => {
    m.notes?.forEach(n => {
      if (n.voicePart && counts[n.voicePart] !== undefined) {
        counts[n.voicePart]++
      }
    })
  })
  
  return counts
})
</script>

<style scoped>
.score-preview {
  width: 100%;
}

.preview-header {
  text-align: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 2px solid #eee;
}

.preview-header h3 {
  margin: 0 0 5px;
  color: #333;
  font-size: 1.4rem;
}

.composer {
  margin: 0;
  color: #666;
  font-style: italic;
}

.preview-info {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
  margin-bottom: 20px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
}

.info-item {
  display: flex;
  flex-direction: column;
}

.info-label {
  font-size: 0.85rem;
  color: #666;
  margin-bottom: 3px;
}

.info-value {
  font-weight: 600;
  color: #333;
}

.preview-stats {
  margin-bottom: 20px;
}

.preview-stats h4 {
  margin: 0 0 15px;
  color: #333;
}

.stats-grid {
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
}

.stat-item {
  flex: 1;
  min-width: 80px;
  text-align: center;
  padding: 15px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
  color: white;
}

.stat-number {
  display: block;
  font-size: 1.8rem;
  font-weight: 700;
}

.stat-label {
  font-size: 0.85rem;
  opacity: 0.9;
}

.preview-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
  flex-wrap: wrap;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.95rem;
}

.btn-secondary {
  background: #e0e0e0;
  color: #333;
}

.btn-secondary:hover {
  background: #d0d0d0;
}
</style>
