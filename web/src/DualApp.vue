<template>
  <div class="dual-app">
    <!-- 顶部工具栏 -->
    <div class="dual-toolbar">
      <span class="dual-title">{{ appName }} · 双账号</span>
      <div class="dual-actions">
        <button class="dual-btn" @click="toggleMode">切换到单账号</button>
      </div>
    </div>

    <!-- 两个 App 窗口 -->
    <div class="dual-windows">
      <div class="dual-window">
        <div class="window-tag left-tag">账号 1</div>
        <iframe
          v-if="leftReady"
          :src="leftUrl"
          class="app-frame"
          frameborder="0"
        ></iframe>
      </div>
      <div class="dual-window">
        <div class="window-tag right-tag">账号 2</div>
        <iframe
          v-if="rightReady"
          :src="rightUrl"
          class="app-frame"
          frameborder="0"
        ></iframe>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const appName = ref('聊天');

// 左右两个 iframe 的 URL
const baseUrl = `${window.location.origin}${window.location.pathname}`;
const leftUrl = `${baseUrl}?sid=1${window.location.hash}`;
const rightUrl = `${baseUrl}?sid=2${window.location.hash}`;

// 延迟加载，避免闪烁
const leftReady = ref(false);
const rightReady = ref(false);

onMounted(() => {
  // 尝试从父窗口拿 app_name（如果有）
  try {
    const saved = localStorage.getItem('dual_app_name');
    if (saved) appName.value = saved;
  } catch (e) {}

  // 渐进式加载
  setTimeout(() => { leftReady.value = true; }, 50);
  setTimeout(() => { rightReady.value = true; }, 150);
});

function toggleMode() {
  // 关闭双开模式，跳回单账号
  localStorage.setItem('dual_mode', '0');
  window.location.href = `${baseUrl}${window.location.hash}`;
}
</script>

<style scoped>
.dual-app {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #e8e8e8;
  overflow: hidden;
}

.dual-toolbar {
  height: 36px;
  background: #f7f7f7;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  flex-shrink: 0;
}

.dual-title {
  font-size: 13px;
  color: #666;
  font-weight: 500;
}

.dual-btn {
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 4px 12px;
  font-size: 12px;
  color: #333;
  cursor: pointer;
  transition: all 0.2s;
}

.dual-btn:hover {
  background: #f0f0f0;
  border-color: #ccc;
}

.dual-windows {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  padding: 12px;
  min-height: 0;
}

.dual-window {
  position: relative;
  width: 520px;
  max-width: calc(50vw - 20px);
  height: 100%;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  flex-shrink: 0;
}

.window-tag {
  position: absolute;
  top: 6px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  font-size: 11px;
  padding: 2px 10px;
  border-radius: 10px;
  z-index: 10;
  pointer-events: none;
  opacity: 0.8;
}

.app-frame {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
}

/* 屏幕不够宽时，稍微缩一点 */
@media (max-width: 1100px) {
  .dual-window {
    width: 460px;
  }
}

@media (max-width: 960px) {
  .dual-window {
    width: 420px;
  }
}
</style>
