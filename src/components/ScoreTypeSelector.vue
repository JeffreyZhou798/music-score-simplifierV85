<template>
  <div class="score-type-selector">
    <div class="type-options">
      <button 
        class="type-option"
        :class="{ active: selected === 'grand-staff' }"
        @click="selectType('grand-staff')"
      >
        <div class="type-icon">🎹</div>
        <div class="type-info">
          <h3>Grand Staff</h3>
          <p>Polyphonic Instruments</p>
          <span class="type-example">Piano, Organ, Harp</span>
        </div>
      </button>
      
      <button 
        class="type-option"
        :class="{ active: selected === 'single-staff' }"
        @click="selectType('single-staff')"
      >
        <div class="type-icon">🎻</div>
        <div class="type-info">
          <h3>Single-Staff</h3>
          <p>Monophonic Instruments</p>
          <span class="type-example">Violin, Flute, Trumpet</span>
        </div>
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  selected: String
})

const emit = defineEmits(['select'])

function selectType(type) {
  emit('select', type)
}
</script>

<style scoped>
.score-type-selector {
  width: 100%;
}

.type-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
}

.type-option {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 20px;
  background: #f8f9fa;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  text-align: left;
}

.type-option:hover {
  border-color: #667eea;
  background: #f0f4ff;
}

.type-option.active {
  border-color: #4CAF50;
  background: #e8f5e9;
}

.type-icon {
  font-size: 2.5rem;
}

.type-info h3 {
  margin: 0 0 5px;
  color: #333;
  font-size: 1.1rem;
}

.type-info p {
  margin: 0 0 5px;
  color: #666;
  font-size: 0.9rem;
}

.type-example {
  color: #999;
  font-size: 0.8rem;
}
</style>
