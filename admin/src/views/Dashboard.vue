<template>
  <div class="dashboard">
    <el-row :gutter="20">
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-label">用户总数</div>
          <div class="stat-value">{{ stats.userCount }}</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-label">群聊数量</div>
          <div class="stat-value">{{ stats.groupCount }}</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-label">在线用户</div>
          <div class="stat-value">{{ stats.onlineCount }}</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-label">消息总数</div>
          <div class="stat-value">{{ stats.msgCount }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-card style="margin-top: 20px">
      <template #header>快速操作</template>
      <el-button type="primary" @click="$router.push('/users')">用户管理</el-button>
      <el-button @click="$router.push('/groups')">群聊管理</el-button>
      <el-button @click="$router.push('/messages')">消息记录</el-button>
      <el-button @click="$router.push('/robots')">机器人管理</el-button>
    </el-card>
  </div>
</template>

<script setup>
import { reactive, onMounted } from 'vue';
import { getUserList, getGroupList, getMessageList } from '@/api';

const stats = reactive({
  userCount: 0,
  groupCount: 0,
  onlineCount: 0,
  msgCount: 0,
});

async function loadStats() {
  try {
    const users = await getUserList({ pageSize: 1 });
    stats.userCount = users.total || 0;
  } catch (e) {}
  try {
    const groups = await getGroupList({ pageSize: 1 });
    stats.groupCount = groups.total || 0;
  } catch (e) {}
  try {
    const msgs = await getMessageList({ pageSize: 1 });
    stats.msgCount = msgs.total || 0;
  } catch (e) {}
}

onMounted(() => {
  loadStats();
});
</script>

<style scoped>
.stat-card {
  text-align: center;
}

.stat-label {
  color: #999;
  font-size: 14px;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #333;
}
</style>
