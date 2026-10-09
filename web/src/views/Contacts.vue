<template>
  <div class="contacts-page">
    <van-nav-bar title="联系人" fixed />

    <div class="search-wrap">
      <van-search
        v-model="keyword"
        :placeholder="isPublicAccount ? '搜索用户/群' : '搜索公众号/群'"
        shape="round"
        @search="loadList"
        @clear="loadList"
      />
    </div>

    <div class="user-list">
      <van-empty v-if="allItems.length === 0 && !loading" description="暂无联系人" />

      <!-- 公共群 -->
      <template v-if="publicGroups.length > 0">
        <div class="section-title">公共群</div>
        <div
          v-for="g in publicGroups"
          :key="`group_${g.id}`"
          class="user-item"
          @click="openGroup(g)"
        >
          <van-image round width="44" height="44" :src="groupAvatar(g)" />
          <div class="user-info">
            <div class="user-name">
              {{ g.name }}
              <van-tag type="success" size="mini">公共群</van-tag>
            </div>
            <div class="user-phone">{{ g.member_count }} 人</div>
          </div>
          <van-icon name="chat-o" size="20" color="#1989fa" />
        </div>
      </template>

      <!-- 公共用户/公众号 -->
      <template v-if="publicUsers.length > 0">
        <div class="section-title">公众号</div>
        <div
          v-for="u in publicUsers"
          :key="`public_${u.uid}`"
          class="user-item"
          @click="startChat(u)"
        >
          <van-image round width="44" height="44" :src="userAvatar(u)" />
          <div class="user-info">
            <div class="user-name">
              {{ u.nickname }}
              <van-tag type="success" size="mini">公众号</van-tag>
            </div>
            <div class="user-phone">{{ u.short_no || u.phone || '' }}</div>
          </div>
          <van-icon name="chat-o" size="20" color="#1989fa" />
        </div>
      </template>

      <!-- 全部用户（仅公众号账号可见） -->
      <template v-if="isPublicAccount && normalUsers.length > 0">
        <div class="section-title">全部联系人</div>
        <div
          v-for="user in normalUsers"
          :key="user.uid"
          class="user-item"
          @click="startChat(user)"
        >
          <van-image round width="44" height="44" :src="userAvatar(user)" />
          <div class="user-info">
            <div class="user-name">
              {{ user.nickname }}
              <span v-if="user.short_no" class="user-shortno">{{ user.short_no }}</span>
            </div>
            <div class="user-phone">{{ user.phone || '' }}</div>
          </div>
          <van-icon name="chat-o" size="20" color="#1989fa" />
        </div>
      </template>
    </div>

    <van-tabbar route active-color="#07c160">
      <van-tabbar-item icon="chat-o" to="/">消息</van-tabbar-item>
      <van-tabbar-item icon="friends-o" to="/contacts">联系人</van-tabbar-item>
      <van-tabbar-item icon="user-o" to="/profile">我的</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onActivated } from 'vue';
import { useRouter } from 'vue-router';
import { searchUsers, getAllUsers, getPublicUsers } from '@/api/user';
import { getMyGroups } from '@/api/group';
import { useUserStore } from '@/store/user';
import { getAvatar } from '@/utils/avatar';

const router = useRouter();
const userStore = useUserStore();

defineOptions({ name: 'Contacts' });

// 当前用户是否是公众号/公开用户
const isPublicAccount = computed(() => !!userStore.userInfo?.is_public);

const active = ref(1);
const keyword = ref('');
const allUsers = ref([]);
const publicUsers = ref([]);
const publicGroups = ref([]);
const loading = ref(false);

function userAvatar(u) {
  return getAvatar(u?.avatar, u?.nickname);
}
function groupAvatar(g) {
  return getAvatar(g?.avatar, g?.name);
}

// 普通用户（公众号账号能看到，排除公共用户和自己）
const normalUsers = computed(() => {
  const myUid = userStore.userInfo?.uid;
  return allUsers.value.filter(u => u.uid !== myUid && !u.is_public);
});

const allItems = computed(() => {
  return [...publicGroups.value, ...publicUsers.value, ...normalUsers.value];
});

async function loadList() {
  loading.value = true;
  try {
    if (keyword.value.trim()) {
      // 搜索模式（不走缓存）
      const kw = keyword.value.trim();
      const [users, groups] = await Promise.all([
        searchUsers(kw),
        getMyGroups(),
      ]);
      publicUsers.value = users.filter(u => u.is_public);
      allUsers.value = users;
      publicGroups.value = groups.filter(g =>
        g.is_public && g.name.includes(kw)
      );
    } else {
      // 正常模式
      const tasks = [getPublicUsers(), getMyGroups()];
      if (isPublicAccount.value) {
        tasks.push(getAllUsers());
      }
      const [pubUsers, groups, allUserList] = await Promise.all(tasks);
      publicUsers.value = pubUsers;
      allUsers.value = allUserList || [];
      publicGroups.value = groups.filter(g => g.is_public);
      // 保存到本地缓存
      saveCache();
    }
  } catch (e) {} finally {
    loading.value = false;
  }
}

// 从本地缓存加载（秒显）
function loadFromCache() {
  try {
    const saved = localStorage.getItem('contacts_cache');
    if (saved) {
      const data = JSON.parse(saved);
      if (data.publicUsers) publicUsers.value = data.publicUsers;
      if (data.publicGroups) publicGroups.value = data.publicGroups;
      if (data.allUsers) allUsers.value = data.allUsers;
      return true;
    }
  } catch (e) {}
  return false;
}

// 保存到本地缓存
function saveCache() {
  try {
    const data = {
      publicUsers: publicUsers.value,
      publicGroups: publicGroups.value,
      allUsers: allUsers.value,
    };
    localStorage.setItem('contacts_cache', JSON.stringify(data));
  } catch (e) {}
}

function openGroup(g) {
  router.push({ path: `/chat/${g.id}`, query: { type: 'group' } });
}

function startChat(user) {
  // 单聊：存在本地会话列表里
  try {
    const saved = localStorage.getItem('single_list');
    const arr = saved ? JSON.parse(saved) : [];
    const idx = arr.findIndex(i => i.uid === user.uid);
    const item = {
      uid: user.uid,
      nickname: user.nickname,
      avatar: user.avatar,
      last_msg: arr[idx]?.last_msg || '',
    };
    if (idx >= 0) arr.splice(idx, 1);
    arr.unshift(item);
    localStorage.setItem('single_list', JSON.stringify(arr));
  } catch (e) {}

  router.push({ path: `/chat/${user.uid}`, query: { type: 'single' } });
}

onMounted(() => {
  if (!userStore.isLogin) {
    router.push('/login');
    return;
  }
  // 先从本地缓存加载，秒显
  loadFromCache();
  // 后台刷新
  requestAnimationFrame(() => {
    loadList();
  });
});

// 从缓存激活时，后台静默刷新（60秒节流）
let lastRefreshTime = 0;
onActivated(() => {
  const now = Date.now();
  if (now - lastRefreshTime < 60 * 1000) return;
  // 有搜索关键词时不刷新，避免干扰搜索结果
  if (keyword.value.trim()) return;
  lastRefreshTime = now;
  loadList();
});
</script>

<style scoped>
.contacts-page {
  height: 100vh;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  background: #fff;
  overflow: hidden;
}

.search-wrap {
  position: fixed;
  top: 46px;
  left: 0;
  right: 0;
  z-index: 10;
  background: #f7f7f7;
  padding: 8px 12px;
  border-bottom: none;
}

.user-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overflow-x: hidden;
  padding-top: 122px;
  padding-bottom: 75px;
  box-sizing: border-box;
  background: #fff;
  will-change: transform;
}

.user-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #f5f5f5;
  cursor: pointer;
  margin-left: 12px;
}

.user-item:active {
  background: #f7f7f7;
}

.user-info {
  flex: 1;
  margin-left: 12px;
  min-width: 0;
}

.user-name {
  font-size: 16px;
  color: #111;
  font-weight: 500;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-shortno {
  font-size: 11px;
  color: #07c160;
  background: #e8f8ef;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: normal;
}

.user-phone {
  font-size: 13px;
  color: #999;
}

.section-title {
  padding: 8px 16px;
  font-size: 13px;
  color: #999;
  background: #f7f7f7;
  font-weight: 500;
}
</style>
