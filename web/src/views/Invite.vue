<template>
  <div class="invite-page">
    <van-nav-bar title="加入群聊" left-text="返回" left-arrow @click-left="$router.back()" fixed />

    <div class="invite-body" v-loading="loading">
      <div v-if="groupInfo" class="group-card">
        <van-image round width="80" height="80" :src="groupInfo.avatar || defaultAvatar" />
        <div class="group-name">{{ groupInfo.name }}</div>
        <div class="group-count">{{ groupInfo.member_count }} 人</div>
      </div>

      <div v-if="groupInfo?.is_member" class="already-in">
        <van-icon name="success" size="32" color="#07c160" />
        <p>你已经在群里了</p>
        <van-button type="primary" round @click="goToChat">进入群聊</van-button>
      </div>

      <div v-else-if="groupInfo?.status === 1" class="closed">
        <van-icon name="warning" size="32" color="#ff976a" />
        <p>群已关门，暂不能加入</p>
      </div>

      <div v-else-if="groupInfo" class="join-section">
        <p class="join-tip">扫码加入群聊</p>
        <van-button type="primary" size="large" round block @click="handleJoin" :loading="joining">
          加入群聊
        </van-button>
      </div>

      <div v-if="error" class="error">
        <van-icon name="failure" size="32" color="#ee0a24" />
        <p>{{ error }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showToast } from 'vant';
import { getGroupByInviteCode, joinGroupByInviteCode } from '@/api/group';
import { useUserStore } from '@/store/user';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();

const code = route.params.code;
const groupInfo = ref(null);
const loading = ref(true);
const joining = ref(false);
const error = ref('');
const defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0OCA0OCI+PGRlZnM+PHN0eWxlPi5he2ZpbGw6I2VlZTt9PC9zdHlsZT48L2RlZnM+PHJlY3QgY2xhc3M9ImEiIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCIgcng9IjgiLz48dGV4dCB4PSIyNCIgeT0iMzAiIGZvbnQtc2l6ZT0iMjAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiM5OTkiPu+4lTwvdGV4dD48L3N2Zz4=';

async function loadGroupInfo() {
  loading.value = true;
  error.value = '';
  try {
    groupInfo.value = await getGroupByInviteCode(code);
  } catch (e) {
    error.value = e.message || '群不存在或邀请码无效';
  } finally {
    loading.value = false;
  }
}

async function handleJoin() {
  if (!userStore.isLogin) {
    showToast('请先登录');
    router.push('/login');
    return;
  }

  joining.value = true;
  try {
    const res = await joinGroupByInviteCode(code);
    showToast('加入成功');
    goToChat();
  } catch (e) {
    showToast(e.message || '加入失败');
  } finally {
    joining.value = false;
  }
}

function goToChat() {
  router.replace({ path: `/chat/${groupInfo.value.id}`, query: { type: 'group' } });
}

onMounted(() => {
  if (!userStore.isLogin) {
    router.push('/login');
    return;
  }
  loadGroupInfo();
});
</script>

<style scoped>
.invite-page {
  min-height: 100vh;
  background: #fff;
  padding-top: 46px;
}

.invite-body {
  padding: 40px 20px;
  text-align: center;
}

.group-card {
  margin-bottom: 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.group-name {
  margin-top: 16px;
  font-size: 20px;
  font-weight: 600;
  color: #111;
}

.group-count {
  margin-top: 6px;
  font-size: 14px;
  color: #999;
}

.already-in,
.closed,
.error {
  margin-top: 40px;
}

.already-in p,
.closed p,
.error p {
  margin: 12px 0 20px;
  font-size: 16px;
  color: #333;
}

.join-section {
  margin-top: 40px;
}

.join-tip {
  font-size: 14px;
  color: #666;
  margin-bottom: 20px;
}
</style>
