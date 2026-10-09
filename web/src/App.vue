<template>
  <router-view v-slot="{ Component, route }">
    <transition name="fade" mode="out-in">
      <keep-alive :include="['Home', 'Contacts', 'Profile', 'GroupInfo']" :max="10">
        <component :is="Component" :key="route.fullPath" />
      </keep-alive>
    </transition>
  </router-view>
</template>

<script setup>
import { onMounted } from 'vue';
import { getSystemSettings } from '@/api/system';

// 加载系统设置，动态设置标题和图标
async function loadAppSettings() {
  try {
    const res = await getSystemSettings();
    if (res.code === 0 && res.data) {
      const { app_name, app_logo, app_description } = res.data;

      // 设置页面标题
      if (app_name) {
        document.title = app_name;
      }

      // 设置 favicon
      if (app_logo) {
        let link = document.querySelector("link[rel~='icon']");
        if (!link) {
          link = document.createElement('link');
          link.rel = 'icon';
          document.head.appendChild(link);
        }
        link.href = app_logo;

        // 设置 apple touch icon（添加到主屏幕时的图标）
        let appleIcon = document.querySelector("link[rel~='apple-touch-icon']");
        if (!appleIcon) {
          appleIcon = document.createElement('link');
          appleIcon.rel = 'apple-touch-icon';
          document.head.appendChild(appleIcon);
        }
        appleIcon.href = app_logo;

        // 修改 apple-mobile-web-app-title
        let metaTitle = document.querySelector("meta[name='apple-mobile-web-app-title']");
        if (!metaTitle) {
          metaTitle = document.createElement('meta');
          metaTitle.name = 'apple-mobile-web-app-title';
          document.head.appendChild(metaTitle);
        }
        metaTitle.content = app_name;
      }

      // 设置描述
      if (app_description) {
        let metaDesc = document.querySelector("meta[name='description']");
        if (!metaDesc) {
          metaDesc = document.createElement('meta');
          metaDesc.name = 'description';
          document.head.appendChild(metaDesc);
        }
        metaDesc.content = app_description;
      }
    }
  } catch (e) {
    // 忽略加载失败，用默认值
  }
}

onMounted(() => {
  loadAppSettings();
});
</script>

<style>
/* 页面切换淡入淡出 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
