<template>
  <el-container class="layout">
    <el-aside width="220px" class="sidebar">
      <div class="logo">💬 聊天管理</div>
      <el-menu
        :default-active="activeMenu"
        router
        background-color="#001529"
        text-color="#fff"
        active-text-color="#409eff"
      >
        <el-menu-item index="/dashboard">
          <el-icon><DataAnalysis /></el-icon>
          <span>概览</span>
        </el-menu-item>
        <el-menu-item index="/users">
          <el-icon><User /></el-icon>
          <span>用户管理</span>
        </el-menu-item>
        <el-menu-item index="/groups">
          <el-icon><ChatDotRound /></el-icon>
          <span>群聊管理</span>
        </el-menu-item>
        <el-menu-item index="/messages">
          <el-icon><Document /></el-icon>
          <span>消息记录</span>
        </el-menu-item>
        <el-menu-item index="/robots">
          <el-icon><Cpu /></el-icon>
          <span>机器人管理</span>
        </el-menu-item>
        <el-menu-item index="/settings">
          <el-icon><Setting /></el-icon>
          <span>系统设置</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="header">
        <div class="header-title">{{ $route.meta.title || '管理后台' }}</div>
        <el-dropdown @command="handleCommand">
          <span class="user-info">
            {{ adminInfo?.nickname || adminInfo?.username || '管理员' }}
            <el-icon><ArrowDown /></el-icon>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="logout">退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </el-header>

      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  DataAnalysis, User, ChatDotRound, Document, Cpu, Setting, ArrowDown
} from '@element-plus/icons-vue';

const route = useRoute();
const router = useRouter();

const activeMenu = computed(() => route.path);
const adminInfo = computed(() => {
  try {
    return JSON.parse(localStorage.getItem('admin_info') || '{}');
  } catch {
    return {};
  }
});

function handleCommand(command) {
  if (command === 'logout') {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_info');
    router.push('/login');
  }
}
</script>

<style scoped>
.layout {
  height: 100vh;
}

.sidebar {
  background: #001529;
  color: #fff;
}

.logo {
  height: 60px;
  line-height: 60px;
  text-align: center;
  font-size: 18px;
  font-weight: bold;
  color: #fff;
  border-bottom: 1px solid #1f3a5a;
}

:deep(.el-menu) {
  border-right: none;
}

.header {
  background: #fff;
  border-bottom: 1px solid #e8e8e8;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-title {
  font-size: 16px;
  font-weight: 500;
}

.user-info {
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  color: #666;
}

.main {
  background: #f0f2f5;
  padding: 20px;
}
</style>
