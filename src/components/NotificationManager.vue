<template>
  <div class="notification-container">
    <transition-group name="notification">
      <div 
        v-for="notification in notifications" 
        :key="notification.id"
        class="notification"
        :class="notification.type"
      >
        <span class="notification-icon">
          {{ getIcon(notification.type) }}
        </span>
        <span class="notification-message">{{ notification.message }}</span>
        <button 
          class="notification-close"
          @click="dismiss(notification.id)"
        >
          ❌
        </button>
      </div>
    </transition-group>
  </div>
</template>

<script setup>
import { watch, onUnmounted } from 'vue'

const props = defineProps({
  notifications: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['dismiss'])

// 存储定时器
const timers = new Map()

// 监听通知变化，为新通知设置自动关闭定时器
watch(() => props.notifications, (newNotifications) => {
  newNotifications.forEach(notification => {
    // 如果这个通知还没有定时器，设置一个
    if (!timers.has(notification.id)) {
      const timer = setTimeout(() => {
        emit('dismiss', notification.id)
        timers.delete(notification.id)
      }, 15000) // 15秒后自动关闭
      
      timers.set(notification.id, timer)
    }
  })
  
  // 清理已经不存在的通知的定时器
  const currentIds = new Set(newNotifications.map(n => n.id))
  timers.forEach((timer, id) => {
    if (!currentIds.has(id)) {
      clearTimeout(timer)
      timers.delete(id)
    }
  })
}, { deep: true, immediate: true })

// 组件卸载时清理所有定时器
onUnmounted(() => {
  timers.forEach(timer => clearTimeout(timer))
  timers.clear()
})

function getIcon(type) {
  const icons = {
    success: '✅',
    error: '❌',
    info: 'ℹ️'
  }
  return icons[type] || 'ℹ️'
}

function dismiss(id) {
  // 清除该通知的定时器
  if (timers.has(id)) {
    clearTimeout(timers.get(id))
    timers.delete(id)
  }
  emit('dismiss', id)
}
</script>

<style scoped>
.notification-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 400px;
}

.notification {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 15px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  background: white;
  animation: slideIn 0.3s ease;
}

.notification.success {
  background: #e8f5e9;
  border-left: 4px solid #4CAF50;
}

.notification.error {
  background: #ffebee;
  border-left: 4px solid #f44336;
}

.notification.info {
  background: #e3f2fd;
  border-left: 4px solid #2196F3;
}

.notification-icon {
  font-size: 1.2rem;
}

.notification-message {
  flex: 1;
  color: #333;
  font-size: 0.95rem;
}

.notification-close {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.8rem;
  opacity: 0.6;
  transition: opacity 0.2s;
  padding: 5px;
}

.notification-close:hover {
  opacity: 1;
}

/* Transitions */
.notification-enter-active,
.notification-leave-active {
  transition: all 0.3s ease;
}

.notification-enter-from {
  opacity: 0;
  transform: translateX(100px);
}

.notification-leave-to {
  opacity: 0;
  transform: translateX(100px);
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(100px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
</style>
