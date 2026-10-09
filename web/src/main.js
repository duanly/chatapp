// 必须在最前面：初始化带命名空间的 localStorage（多账号隔离）
import './utils/storage';

import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import DualApp from './DualApp.vue';
import router from './router';
import './assets/main.css';

// 禁止 iOS 双击缩放（CSS 不够时的兜底）
let lastTouchEnd = 0;
document.addEventListener('touchend', function (e) {
  const now = Date.now();
  if (now - lastTouchEnd <= 300) {
    e.preventDefault();
  }
  lastTouchEnd = now;
}, { passive: false });

// 判断是否显示双开模式：
// 1. 屏幕宽度 >= 900px（PC 宽屏）
// 2. URL 中没有 sid 参数（不是 iframe 子实例）
// 3. 用户开启了双开模式
function shouldUseDualMode() {
  if (window.innerWidth < 1000) return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get('sid')) return false; // 子实例不嵌套
  const dualMode = localStorage.getItem('dual_mode');
  return dualMode === '1';
}

const rootComponent = shouldUseDualMode() ? DualApp : App;

// 双开模式下给 body 加标记类，让 CSS 知道不要限制 #app 宽度
if (shouldUseDualMode()) {
  document.body.classList.add('dual-mode');
}

const app = createApp(rootComponent);
const pinia = createPinia();

app.use(pinia);
app.use(router);

app.mount('#app');
