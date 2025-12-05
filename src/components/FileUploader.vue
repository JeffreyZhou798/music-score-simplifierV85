<template>
  <div class="file-uploader">
    <div 
      class="upload-area"
      :class="{ 'drag-over': isDragOver, 'disabled': disabled }"
      @dragover.prevent="handleDragOver"
      @dragleave="handleDragLeave"
      @drop.prevent="handleDrop"
      @click="triggerFileInput"
    >
      <div class="upload-icon">📁</div>
      <p class="upload-text">
        Drag & drop your score file here<br>
        or click to browse
      </p>
      <p class="upload-formats">Supported formats: .mxl, .musicxml</p>
      <p class="upload-limit">Maximum file size: 5MB</p>
    </div>
    
    <input 
      ref="fileInput"
      type="file"
      accept=".mxl,.musicxml,.xml"
      @change="handleFileSelect"
      hidden
    />
    
    <button 
      class="btn btn-upload"
      :class="{ active: hasFile }"
      :disabled="disabled"
      @click="triggerFileInput"
    >
      {{ hasFile ? '✓ File Selected' : 'Upload File' }}
    </button>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  disabled: Boolean
})

const emit = defineEmits(['upload'])

const fileInput = ref(null)
const isDragOver = ref(false)
const hasFile = ref(false)

function triggerFileInput() {
  if (!props.disabled) {
    fileInput.value?.click()
  }
}

function handleDragOver(e) {
  if (!props.disabled) {
    isDragOver.value = true
  }
}

function handleDragLeave() {
  isDragOver.value = false
}

function handleDrop(e) {
  isDragOver.value = false
  if (props.disabled) return
  
  const files = e.dataTransfer?.files
  if (files?.length > 0) {
    processFile(files[0])
  }
}

function handleFileSelect(e) {
  const files = e.target?.files
  if (files?.length > 0) {
    processFile(files[0])
  }
}

function processFile(file) {
  // Validate file format
  const validExtensions = ['.mxl', '.musicxml', '.xml']
  const fileName = file.name.toLowerCase()
  const isValidFormat = validExtensions.some(ext => fileName.endsWith(ext))
  
  if (!isValidFormat) {
    emit('upload', null)
    return
  }
  
  // Validate file size (5MB max)
  const maxSize = 5 * 1024 * 1024
  if (file.size > maxSize) {
    emit('upload', null)
    return
  }
  
  hasFile.value = true
  emit('upload', file)
}
</script>

<style scoped>
.file-uploader {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
}

.upload-area {
  width: 100%;
  padding: 40px 20px;
  border: 2px dashed #ccc;
  border-radius: 12px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  background: #fafafa;
}

.upload-area:hover:not(.disabled) {
  border-color: #667eea;
  background: #f0f4ff;
}

.upload-area.drag-over {
  border-color: #667eea;
  background: #e8edff;
}

.upload-area.disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.upload-icon {
  font-size: 3rem;
  margin-bottom: 10px;
}

.upload-text {
  color: #333;
  margin: 0 0 10px;
  line-height: 1.5;
}

.upload-formats {
  color: #666;
  font-size: 0.9rem;
  margin: 5px 0;
}

.upload-limit {
  color: #999;
  font-size: 0.8rem;
  margin: 0;
}

.btn-upload {
  padding: 12px 30px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-upload:hover:not(:disabled) {
  background: #5a6fd6;
}

.btn-upload.active {
  background: #4CAF50;
}

.btn-upload:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
