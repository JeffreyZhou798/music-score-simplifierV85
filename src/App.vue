<template>
  <div class="app-container">
    <header class="app-header">
      <h1>🎵 Music Score Simplifier</h1>
      <p class="subtitle">Graded simplification for music beginners</p>
    </header>

    <NotificationManager 
      :notifications="notifications" 
      @dismiss="removeNotification" 
    />

    <main class="app-main">
      <!-- Step 1: File Upload -->
      <section class="step-section" :class="{ active: currentStep >= 1 }">
        <h2>Step 1: Upload Score</h2>
        <FileUploader 
          @upload="handleFileUpload" 
          :disabled="isProcessing"
        />
      </section>

      <!-- Step 2: Score Type Selection -->
      <section v-if="currentStep >= 2" class="step-section" :class="{ active: currentStep >= 2 }">
        <h2>Step 2: Select Score Type</h2>
        <ScoreTypeSelector 
          :selected="scoreType"
          @select="handleScoreTypeSelect"
        />
      </section>

      <!-- Step 3: Level Selection -->
      <section v-if="currentStep >= 3" class="step-section" :class="{ active: currentStep >= 3 }">
        <h2>Step 3: Select Simplification Level</h2>
        <LevelSelector
          :scoreType="scoreType"
          :selectedLevel="selectedLevel"
          :sopranoLevel="sopranoLevel"
          :bassLevel="bassLevel"
          @levelSelect="handleLevelSelect"
          @sopranoLevelChange="handleSopranoLevelChange"
          @bassLevelChange="handleBassLevelChange"
        />
      </section>

      <!-- Simplify Button with Progress Bar -->
      <section v-if="currentStep >= 3 && selectedLevel" class="step-section action-section">
        <!-- Progress Bar -->
        <div v-if="isProcessing || progress > 0" class="progress-container">
          <div class="progress-bar">
            <div 
              class="progress-fill" 
              :style="{ width: progress + '%' }"
              :class="{ complete: progress >= 100 }"
            ></div>
          </div>
          <div class="progress-text">
            {{ progressText }}
          </div>
        </div>
        
        <button 
          class="btn btn-primary btn-large"
          :class="{ active: simplifiedScore }"
          :disabled="isProcessing"
          @click="handleSimplify"
        >
          {{ isProcessing ? 'Processing...' : 'Simplify Score' }}
        </button>
      </section>

      <!-- Step 4: Preview -->
      <section v-if="simplifiedScore" class="step-section" :class="{ active: currentStep >= 4 }">
        <h2>Step 4: Preview Result</h2>
        <ScorePreview 
          :score="simplifiedScore"
          :metadata="parsedScore?.metadata"
          @returnToAnalysis="returnToAnalysis"
          @returnToSimplification="returnToSimplification"
        />
      </section>

      <!-- Download Button -->
      <section v-if="simplifiedScore" class="step-section action-section">
        <button 
          class="btn btn-success btn-large"
          :disabled="isProcessing"
          @click="handleDownload"
        >
          Download Simplified Score
        </button>
        <div class="download-options">
          <label>
            <input type="radio" v-model="downloadFormat" value="musicxml" /> .musicxml
          </label>
          <label>
            <input type="radio" v-model="downloadFormat" value="mxl" /> .mxl (compressed)
          </label>
        </div>
      </section>
    </main>

    <footer class="app-footer">
      <p>MusicScoreSimplifier - Pure Frontend Application</p>
      <p>Powered by TensorFlow.js & Magenta.js</p>
    </footer>
  </div>
</template>

<script>
// Vue imports (using Options API)
import FileUploader from './components/FileUploader.vue'
import ScoreTypeSelector from './components/ScoreTypeSelector.vue'
import LevelSelector from './components/LevelSelector.vue'
import ScorePreview from './components/ScorePreview.vue'
import NotificationManager from './components/NotificationManager.vue'
import { parseFile } from './modules/parser.js'
import { analyzeScore } from './modules/analyzer.js'
import { simplifyScore, simplifyScoreAsync } from './modules/simplifier.js'
import { exportScore } from './modules/exporter.js'
import { initializeAI } from './ai/index.js'

export default {
  components: {
    FileUploader,
    ScoreTypeSelector,
    LevelSelector,
    ScorePreview,
    NotificationManager
  },
  
  data() {
    return {
      currentStep: 1,
      parsedScore: null,
      analyzedScore: null,
      simplifiedScore: null,
      scoreType: null,
      selectedLevel: null,
      sopranoLevel: null,
      bassLevel: null,
      isProcessing: false,
      notifications: [],
      downloadFormat: 'musicxml',
      progress: 0,
      progressText: ''
    }
  },
  
  async mounted() {
    this.addNotification('info', 'Initializing AI models...')
    try {
      await initializeAI()
      this.addNotification('success', 'AI models loaded successfully')
    } catch (e) {
      this.addNotification('info', 'AI models unavailable, using rule-based analysis')
    }
  },
  
  methods: {
    addNotification(type, message) {
      const id = Date.now().toString()
      this.notifications.push({ id, type, message })
    },
    
    removeNotification(id) {
      this.notifications = this.notifications.filter(n => n.id !== id)
    },
    
    async handleFileUpload(file) {
      if (!file) {
        this.addNotification('error', 'Invalid file. Please upload .mxl or .musicxml files only (max 5MB).')
        return
      }
      
      this.isProcessing = true
      try {
        this.parsedScore = await parseFile(file)
        this.addNotification('success', `File "${file.name}" uploaded successfully`)
        this.currentStep = 2
      } catch (error) {
        const message = error.message === 'INVALID_FILE_FORMAT' 
          ? 'Invalid file format. Please upload .mxl or .musicxml files only.'
          : 'Failed to parse file. Please check the file format.'
        this.addNotification('error', message)
      } finally {
        this.isProcessing = false
      }
    },
    
    handleScoreTypeSelect(type) {
      this.scoreType = type
      this.currentStep = 3
    },
    
    handleLevelSelect(level) {
      this.selectedLevel = level
    },
    
    handleSopranoLevelChange(level) {
      this.sopranoLevel = level
    },
    
    handleBassLevelChange(level) {
      this.bassLevel = level
    },
    
    async handleSimplify() {
      this.isProcessing = true
      this.progress = 0
      this.progressText = 'Initializing...'
      
      try {
        // Step 1: Analyzing (0-40%)
        this.progress = 10
        this.progressText = 'Analyzing score structure...'
        await this.delay(100)
        
        this.progress = 20
        this.progressText = 'Identifying voice parts...'
        await this.delay(100)
        
        this.analyzedScore = await analyzeScore(this.parsedScore, this.scoreType)
        
        this.progress = 40
        this.progressText = 'Analysis complete'
        await this.delay(100)
        
        // Step 2: Simplifying (40-90%)
        this.progress = 50
        this.progressText = 'Applying simplification rules...'
        await this.delay(100)
        
        // 使用异步版本支持AI声部分离（三层决策架构）
        // 1. 规则引擎（快速筛选）
        // 2. MusicVAE + KNN（智能归属）
        // 3. K-means 验证（质量检查）
        const useAsyncMode = this.scoreType === 'grand-staff'
        
        if (useAsyncMode) {
          this.progressText = 'AI-assisted voice separation...'
          this.simplifiedScore = await simplifyScoreAsync(
            this.analyzedScore, 
            {
              mainLevel: this.selectedLevel,
              sopranoLevel: this.sopranoLevel,
              bassLevel: this.bassLevel
            },
            (progress) => {
              // 映射进度到 50-90 范围
              this.progress = 50 + Math.round(progress * 0.4)
              if (progress < 50) {
                this.progressText = 'AI voice separation in progress...'
              } else {
                this.progressText = 'Applying simplification rules...'
              }
            }
          )
        } else {
          this.simplifiedScore = simplifyScore(this.analyzedScore, {
            mainLevel: this.selectedLevel,
            sopranoLevel: this.sopranoLevel,
            bassLevel: this.bassLevel
          })
        }
        
        this.progress = 90
        this.progressText = 'Finalizing...'
        await this.delay(100)
        
        // Step 3: Complete (100%)
        this.progress = 100
        this.progressText = 'Complete!'
        
        this.addNotification('success', 'Score simplified successfully!')
        this.currentStep = 4
        
        // Reset progress after a short delay
        setTimeout(() => {
          this.progress = 0
          this.progressText = ''
        }, 1500)
        
      } catch (error) {
        console.error('Simplification error:', error)
        this.addNotification('error', 'Simplification failed: ' + error.message)
        this.progress = 0
        this.progressText = ''
      } finally {
        this.isProcessing = false
      }
    },
    
    delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms))
    },
    
    async handleDownload() {
      this.isProcessing = true
      try {
        const blob = await exportScore(this.simplifiedScore, this.downloadFormat)
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${this.simplifiedScore.metadata.title}_simplified.${this.downloadFormat}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        this.addNotification('success', 'File downloaded successfully!')
      } catch (error) {
        this.addNotification('error', 'Download failed: ' + error.message)
      } finally {
        this.isProcessing = false
      }
    },
    
    returnToAnalysis() {
      this.simplifiedScore = null
      this.analyzedScore = null
      this.currentStep = 3
    },
    
    returnToSimplification() {
      this.simplifiedScore = null
      this.currentStep = 3
    }
  }
}
</script>


<style scoped>
.app-container {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.app-header {
  text-align: center;
  margin-bottom: 30px;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  color: white;
}

.app-header h1 {
  margin: 0;
  font-size: 2rem;
}

.subtitle {
  margin: 10px 0 0;
  opacity: 0.9;
}

.app-main {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.step-section {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  transition: all 0.3s ease;
}

.step-section.active {
  border-left: 4px solid #667eea;
}

.step-section h2 {
  margin: 0 0 15px;
  color: #333;
  font-size: 1.2rem;
}

.action-section {
  text-align: center;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-large {
  padding: 16px 32px;
  font-size: 1.1rem;
}

.btn-primary {
  background: #667eea;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #5a6fd6;
}

.btn-primary.active {
  background: #4CAF50;
}

.btn-success {
  background: #4CAF50;
  color: white;
}

.btn-success:hover:not(:disabled) {
  background: #45a049;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Progress Bar Styles */
.progress-container {
  margin-bottom: 20px;
  width: 100%;
  max-width: 400px;
  margin-left: auto;
  margin-right: auto;
}

.progress-bar {
  width: 100%;
  height: 12px;
  background: #e0e0e0;
  border-radius: 6px;
  overflow: hidden;
  box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  border-radius: 6px;
  transition: width 0.3s ease;
}

.progress-fill.complete {
  background: linear-gradient(90deg, #4CAF50 0%, #45a049 100%);
}

.progress-text {
  margin-top: 8px;
  font-size: 0.9rem;
  color: #666;
  text-align: center;
}

.download-options {
  margin-top: 15px;
  display: flex;
  gap: 20px;
  justify-content: center;
}

.download-options label {
  cursor: pointer;
}

.app-footer {
  text-align: center;
  margin-top: 30px;
  padding: 20px;
  color: #666;
  font-size: 0.9rem;
}

@media (max-width: 768px) {
  .app-container {
    padding: 10px;
  }
  
  .app-header h1 {
    font-size: 1.5rem;
  }
  
  .btn-large {
    padding: 12px 24px;
    font-size: 1rem;
  }
}
</style>
