<template>
  <div class="contacts-page">
    <van-nav-bar title="联系人" fixed />

    <div class="search-wrap">
      <van-search
        v-model="keyword"
        placeholder="搜索公众号/群"
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
          <van-image round width="44" height="44" :src="g.avatar || defaultGroupAvatar" />
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
          <van-image round width="44" height="44" :src="u.avatar || defaultAvatar" />
          <div class="user-info">
            <div class="user-name">
              {{ u.nickname }}
              <van-tag type="success" size="mini">公众号</van-tag>
            </div>
            <div class="user-phone">{{ u.short_no || '' }}</div>
          </div>
          <van-icon name="chat-o" size="20" color="#1989fa" />
        </div>
      </template>
    </div>

    <van-tabbar v-model="active" active-color="#1989fa">
      <van-tabbar-item icon="chat-o" @click="$router.push('/')">消息</van-tabbar-item>
      <van-tabbar-item icon="friends-o">联系人</van-tabbar-item>
      <van-tabbar-item icon="user-o" @click="$router.push('/profile')">我的</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { searchUsers, getPublicUsers } from '@/api/user';
import { getMyGroups } from '@/api/group';
import { useUserStore } from '@/store/user';

const router = useRouter();
const userStore = useUserStore();

const active = ref(1);
const keyword = ref('');
const publicUsers = ref([]);
const publicGroups = ref([]);
const loading = ref(false);
const defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0OCA0OCI+PGRlZnM+PHN0eWxlPi5he2ZpbGw6I2VlZTt9PC9zdHlsZT48L2RlZnM+PHJlY3QgY2xhc3M9ImEiIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCIgcng9IjgiLz48dGV4dCB4PSIyNCIgeT0iMzAiIGZvbnQtc2l6ZT0iMjAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiM5OTkiPu+4lTwvdGV4dD48L3N2Zz4=';
const defaultGroupAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0OCA0OCI+PGRlZnM+PHN0eWxlPi5he2ZpbGw6I2VlZTt9PC9zdHlsZT48L2RlZnM+PHJlY3QgY2xhc3M9ImEiIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCIgcng9IjgiLz48dGV4dCB4PSIyNCIgeT0iMzAiIGZvbnQtc2l6ZT0iMjAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiM5OTkiPv+4kTwvdGV4dD48L3N2Zz4=';

const allItems = computed(() => {
  return [...publicGroups.value, ...publicUsers.value];
});

async function loadList() {
  loading.value = true;
  try {
    if (keyword.value.trim()) {
      // 搜索模式：只搜公开用户
      const kw = keyword.value.trim();
      const [users, groups] = await Promise.all([
        searchUsers(kw),
        getMyGroups(),
      ]);
      publicUsers.value = users;
      publicGroups.value = groups.filter(g =>
        g.is_public && g.name.includes(kw)
      );
    } else {
      // 正常模式：加载公共群 + 公共用户
      const [pubUsers, groups] = await Promise.all([
        getPublicUsers(),
        getMyGroups(),
      ]);
      publicUsers.value = pubUsers;
      // 只显示公共群在联系人里
      publicGroups.value = groups.filter(g => g.is_public);
    }
  } catch (e) {} finally {
    loading.value = false;
  }
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
  padding-top: 100px;
  padding-bottom: 56px;
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
