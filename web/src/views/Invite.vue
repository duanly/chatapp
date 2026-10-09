<template>
  <div class="invite-page">
    <van-nav-bar title="加入群聊" left-text="返回" left-arrow @click-left="$router.back()" fixed />

    <div class="invite-body" v-loading="loading">
      <div v-if="groupInfo" class="group-card">
        <van-image round width="80" height="80" :src="getAvatar(groupInfo.avatar, groupInfo.name)" />
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
import { showToast } from '@/utils/toast';
import { getAvatar } from '@/utils/avatar';
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
