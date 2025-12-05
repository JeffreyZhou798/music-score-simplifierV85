<template>
  <div class="level-selector">
    <!-- Main Level Selection -->
    <div class="level-buttons">
      <button 
        v-for="level in 5" 
        :key="level"
        class="level-btn"
        :class="{ active: selectedLevel === level }"
        @click="selectLevel(level)"
      >
        Level {{ level }}
      </button>
    </div>
    
    <!-- Level Description -->
    <div v-if="selectedLevel" class="level-description">
      <h4>{{ levelInfo.title }}</h4>
      <p>{{ levelInfo.description }}</p>
    </div>
    
    <!-- Voice-specific options for Grand Staff -->
    <div v-if="scoreType === 'grand-staff' && selectedLevel" class="voice-options">
      <div class="voice-option">
        <label>Soprano (Right Hand) Level:</label>
        <div class="voice-buttons">
          <button 
            v-for="lvl in sopranoOptions" 
            :key="'s' + lvl"
            class="voice-btn"
            :class="{ active: currentSopranoLevel === lvl }"
            @click="setSopranoLevel(lvl)"
          >
            {{ lvl }}
          </button>
        </div>
      </div>
      
      <div class="voice-option">
        <label>Bass (Left Hand) Level:</label>
        <div class="voice-buttons">
          <button 
            v-for="lvl in bassOptions" 
            :key="'b' + lvl"
            class="voice-btn"
            :class="{ active: currentBassLevel === lvl }"
            @click="setBassLevel(lvl)"
          >
            {{ lvl }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  scoreType: String,
  selectedLevel: Number,
  sopranoLevel: Number,
  bassLevel: Number
})

const emit = defineEmits(['levelSelect', 'sopranoLevelChange', 'bassLevelChange'])

const SINGLE_STAFF_DESCRIPTIONS = {
  1: { title: 'Level 1 - Skeleton', description: 'Keeps only the first note of each measure, extended to fill the entire measure. Simplest version for absolute beginners.' },
  2: { title: 'Level 2 - Strong Beats', description: 'Keeps notes on strong beat positions only. Each note extends to cover weak beats until the next strong beat.' },
  3: { title: 'Level 3 - Beat Heads', description: 'Keeps the first note of each beat (beat-head notes). Removes subdivisions within beats while preserving the basic pulse.' },
  4: { title: 'Level 4 - Rhythmic Core', description: 'Preserves quarter and eighth notes. Converts shorter notes to eighths. Maintains syncopation, dotted rhythms, and tied notes.' },
  5: { title: 'Level 5 - Near Original', description: 'Removes ornaments (grace notes, trills, turns) only. All other musical elements preserved as in the original score.' }
}

const GRAND_STAFF_DESCRIPTIONS = {
  1: { title: 'Level 1 - Two-Voice Skeleton', description: 'Right hand: Soprano melody (customizable L1-5). Left hand: Bass note per measure (customizable L1-5). Two-part harmony for beginners.' },
  2: { title: 'Level 2 - Three-Voice (RH Enhanced)', description: 'Right hand: Soprano (customizable L2-5) + Alto on strong beats. Left hand: Bass on strong beats (customizable L2-5). Three-part harmony.' },
  3: { title: 'Level 3 - Three-Voice (LH Enhanced)', description: 'Right hand: Soprano only (customizable L2-5). Left hand: Tenor + Bass on strong beats (customizable L2-5). Three-part harmony with fuller bass.' },
  4: { title: 'Level 4 - Four-Voice Harmony', description: 'Right hand: Soprano (customizable L2-5) + Alto (L4). Left hand: Tenor (L4) + Bass (customizable L2-5). Full SATB with rhythmic simplification.' },
  5: { title: 'Level 5 - Near Original', description: 'Right hand: Soprano (customizable L4-5) + Alto (L5). Left hand: Tenor (L5) + Bass (customizable L4-5). Ornaments removed, all else preserved.' }
}

const levelInfo = computed(() => {
  if (!props.selectedLevel) return { title: '', description: '' }
  const descriptions = props.scoreType === 'grand-staff' ? GRAND_STAFF_DESCRIPTIONS : SINGLE_STAFF_DESCRIPTIONS
  return descriptions[props.selectedLevel]
})

// Voice options based on main level
const sopranoOptions = computed(() => {
  if (props.selectedLevel === 1) return [1, 2, 3, 4, 5]
  if (props.selectedLevel === 5) return [4, 5]
  return [2, 3, 4, 5]
})

const bassOptions = computed(() => {
  if (props.selectedLevel === 1) return [1, 2, 3, 4, 5]
  if (props.selectedLevel === 5) return [4, 5]
  return [2, 3, 4, 5]
})

const currentSopranoLevel = computed(() => {
  return props.sopranoLevel || getDefaultSopranoLevel(props.selectedLevel)
})

const currentBassLevel = computed(() => {
  return props.bassLevel || getDefaultBassLevel(props.selectedLevel)
})

function getDefaultSopranoLevel(level) {
  const defaults = { 1: 4, 2: 4, 3: 5, 4: 4, 5: 5 }
  return defaults[level] || 4
}

function getDefaultBassLevel(level) {
  const defaults = { 1: 1, 2: 2, 3: 2, 4: 2, 5: 5 }
  return defaults[level] || 2
}

function selectLevel(level) {
  emit('levelSelect', level)
}

function setSopranoLevel(level) {
  emit('sopranoLevelChange', level)
}

function setBassLevel(level) {
  emit('bassLevelChange', level)
}
</script>


<style scoped>
.level-selector {
  width: 100%;
}

.level-buttons {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.level-btn {
  flex: 1;
  min-width: 100px;
  padding: 15px 20px;
  background: #f0f0f0;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.level-btn:hover {
  background: #e8edff;
  border-color: #667eea;
}

.level-btn.active {
  background: #4CAF50;
  border-color: #4CAF50;
  color: white;
}

.level-description {
  background: #f8f9fa;
  padding: 15px 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  border-left: 4px solid #667eea;
}

.level-description h4 {
  margin: 0 0 8px;
  color: #333;
}

.level-description p {
  margin: 0;
  color: #666;
  line-height: 1.5;
}

.voice-options {
  background: #fff8e1;
  padding: 20px;
  border-radius: 8px;
  border: 1px solid #ffe082;
}

.voice-option {
  margin-bottom: 15px;
}

.voice-option:last-child {
  margin-bottom: 0;
}

.voice-option label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #333;
}

.voice-buttons {
  display: flex;
  gap: 8px;
}

.voice-btn {
  width: 40px;
  height: 40px;
  background: #fff;
  border: 2px solid #ddd;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.voice-btn:hover {
  border-color: #667eea;
  background: #f0f4ff;
}

.voice-btn.active {
  background: #4CAF50;
  border-color: #4CAF50;
  color: white;
}
</style>
