<template>
  <div class="home-page">
    <van-nav-bar title="消息" fixed>
      <template #right>
        <van-icon name="plus" size="20" @click="showPlusMenu = true" />
      </template>
    </van-nav-bar>

    <!-- 连接状态提示 -->
    <div v-if="socketStore.status !== 'connected'" class="conn-bar" :class="socketStore.status" @click="handleConnClick">
      <span v-if="socketStore.status === 'connecting'">正在连接...</span>
      <span v-else-if="socketStore.status === 'reconnecting'">连接断开，正在重连 ({{ socketStore.reconnectAttempts }})</span>
      <span v-else-if="socketStore.status === 'disconnected'">已断开连接，点击重连</span>
      <span v-else-if="socketStore.status === 'failed'">连接失败，点击重试</span>
    </div>

    <!-- 搜索用户 -->
    <div v-if="showSearch" class="search-bar">
      <van-search
        v-model="searchKeyword"
        placeholder="搜索手机号/昵称/UID"
        show-action
        @search="doSearch"
        @cancel="showSearch = false; searchKeyword = ''; searchResults = []"
      />
      <div v-if="searching" class="search-loading">搜索中...</div>
      <div v-else-if="searchResults.length > 0" class="search-results">
        <div
          v-for="u in searchResults"
          :key="u.uid"
          class="search-item"
          @click="startSingleChat(u)"
        >
          <van-image round width="40" height="40" :src="u.avatar || defaultAvatar" />
          <div class="search-info">
            <div class="search-name">{{ u.nickname }}</div>
            <div class="search-phone">{{ u.phone }}</div>
          </div>
        </div>
      </div>
      <div v-else-if="searchKeyword && !searching" class="search-empty">
        没有找到相关用户
      </div>
    </div>

    <!-- 消息列表（群聊 + 单聊 合并） -->
    <div class="chat-list">
      <van-empty v-if="allConversations.length === 0 && !loading" description="暂无消息" />

      <div
        v-for="item in allConversations"
        :key="item.key"
        class="chat-item"
        :class="{ pinned: item.is_pinned }"
        @click="openConversation(item)"
        @contextmenu.prevent="showActionMenu(item)"
      >
        <div class="avatar-wrap">
          <van-image :src="item.avatar || defaultAvatar" round width="48" height="48" />
          <span v-if="item.unread > 0" class="badge">
            {{ item.unread > 99 ? '99+' : item.unread }}
          </span>
          <van-icon v-if="item.is_stared" name="star-o" class="star-icon" color="#ff976a" />
        </div>
        <div class="info">
          <div class="name-row">
            <span class="name">
              {{ item.name }}
              <van-tag v-if="item.is_public" type="success" size="mini" style="margin-left: 4px">公共</van-tag>
            </span>
            <div class="right-col">
              <span v-if="item.mentionCount > 0" class="mention-dot">@</span>
              <span class="time">{{ formatTime(item.last_msg_at) }}</span>
            </div>
          </div>
          <div class="last-msg">{{ item.last_msg || '暂无消息' }}</div>
        </div>
      </div>
    </div>

    <!-- 会话操作菜单 -->
    <van-action-sheet
      v-model:show="actionMenuVisible"
      :actions="actionMenuActions"
      cancel-text="取消"
      @select="onActionSelect"
    />

    <!-- + 号下拉菜单 -->
    <van-popup
      v-model:show="showPlusMenu"
      position="top-right"
      :style="{ marginRight: '12px', marginTop: '50px' }"
      round
    >
      <div class="plus-menu">
        <div class="plus-menu-item" @click="onPlusMenu('scan')">
          <van-icon name="scan" size="18" color="#fff" />
          <span>扫一扫</span>
        </div>
        <div class="plus-menu-item" @click="onPlusMenu('add')">
          <van-icon name="add-o" size="18" color="#fff" />
          <span>加好友/群</span>
        </div>
      </div>
    </van-popup>

    <!-- 扫一扫弹窗 -->
    <van-dialog
      v-model:show="showScanDialog"
      title="扫一扫"
      :show-cancel-button="false"
      :show-confirm-button="false"
      width="90%"
      @close="stopScan"
    >
      <div class="scan-container">
        <video ref="videoRef" class="scan-video" autoplay playsinline muted></video>
        <canvas ref="canvasRef" class="scan-canvas"></canvas>
        <div class="scan-frame">
          <div class="scan-line"></div>
        </div>
        <div class="scan-tip">将二维码放入框内，自动识别</div>
        <div class="scan-manual">
          <span @click="showManualInput = !showManualInput">手动输入邀请码</span>
        </div>
        <div v-if="showManualInput" class="manual-input">
          <van-field
            v-model="manualCode"
            placeholder="请输入邀请码"
            clearable
            style="border-radius: 8px"
          />
          <van-button type="primary" block @click="joinByCode" :loading="joining">加入群聊</van-button>
        </div>
      </div>
    </van-dialog>

    <van-tabbar v-model="active" active-color="#1989fa">
      <van-tabbar-item icon="chat-o">
        消息
        <template #dot v-if="totalUnread > 0">
          <span class="tabbar-badge">{{ totalUnread > 99 ? '99+' : totalUnread }}</span>
        </template>
      </van-tabbar-item>
      <van-tabbar-item icon="friends-o" @click="$router.push('/contacts')">联系人</van-tabbar-item>
      <van-tabbar-item icon="user-o" @click="$router.push('/profile')">我的</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { getMyGroups, getGroupByInviteCode, joinGroupByInviteCode } from '@/api/group';
import {
  searchUsers,
  getPublicUsers,
  getConversationSettings,
  pinConversation,
  starConversation
} from '@/api/user';
import { useSocketStore } from '@/store/socket';
import { useUserStore } from '@/store/user';
import { showToast, showConfirmDialog } from 'vant';
import jsQR from 'jsqr';

const router = useRouter();
const socketStore = useSocketStore();
const userStore = useUserStore();

const active = ref(0);
const groups = ref([]);
const singleList = ref([]);
const publicUsers = ref([]); // 公共用户列表
const convSettings = ref([]); // 会话设置列表
const loading = ref(false);
const defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0OCA0OCI+PGRlZnM+PHN0eWxlPi5he2ZpbGw6I2VlZTt9PC9zdHlsZT48L2RlZnM+PHJlY3QgY2xhc3M9ImEiIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCIgcng9IjgiLz48dGV4dCB4PSIyNCIgeT0iMzAiIGZvbnQtc2l6ZT0iMjAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiM5OTkiPu+4lTwvdGV4dD48L3N2Zz4=';

const showSearch = ref(false);
const searchKeyword = ref('');
const searchResults = ref([]);
const searching = ref(false);

// + 号菜单
const showPlusMenu = ref(false);

function onPlusMenu(type) {
  showPlusMenu.value = false;
  if (type === 'scan') {
    openScan();
  } else if (type === 'add') {
    showSearch.value = true;
  }
}

// 扫一扫
const showScanDialog = ref(false);
const videoRef = ref(null);
const canvasRef = ref(null);
let scanStream = null;
let scanAnimationId = null;
const showManualInput = ref(false);
const manualCode = ref('');
const joining = ref(false);

async function openScan() {
  showScanDialog.value = true;
  showManualInput.value = false;
  manualCode.value = '';
  await nextTick();
  startScan();
}

async function startScan() {
  try {
    scanStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    });
    if (videoRef.value) {
      videoRef.value.srcObject = scanStream;
      tickScan();
    }
  } catch (e) {
    showToast('无法访问摄像头，请手动输入邀请码');
    showManualInput.value = true;
  }
}

function tickScan() {
  const video = videoRef.value;
  const canvas = canvasRef.value;
  if (!video || !canvas || !scanStream) return;

  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);

    if (code && code.data) {
      handleScanResult(code.data);
      return;
    }
  }

  scanAnimationId = requestAnimationFrame(tickScan);
}

function handleScanResult(data) {
  stopScan();
  // 尝试提取邀请码：支持 URL 形式 或 直接是邀请码
  let code = data;
  const match = data.match(/\/invite\/([A-Z0-9]+)/i);
  if (match) {
    code = match[1];
  }

  if (/^[A-Z0-9]{8}$/i.test(code)) {
    joinByInviteCode(code.toUpperCase());
  } else {
    showConfirmDialog({
      title: '扫描结果',
      message: data,
      showCancelButton: false,
    }).catch(() => {});
    showScanDialog.value = false;
  }
}

function stopScan() {
  if (scanAnimationId) {
    cancelAnimationFrame(scanAnimationId);
    scanAnimationId = null;
  }
  if (scanStream) {
    scanStream.getTracks().forEach(track => track.stop());
    scanStream = null;
  }
}

async function joinByCode() {
  if (!manualCode.value.trim()) {
    showToast('请输入邀请码');
    return;
  }
  await joinByInviteCode(manualCode.value.trim().toUpperCase());
}

async function joinByInviteCode(code) {
  joining.value = true;
  try {
    const res = await joinGroupByInviteCode(code);
    showToast('加入成功');
    showScanDialog.value = false;
    loadGroups();
    // 跳转到群聊
    if (res?.group_id) {
      router.push({ path: `/chat/${res.group_id}`, query: { type: 'group' } });
    }
  } catch (e) {
    showToast(e?.message || '加入失败');
  } finally {
    joining.value = false;
  }
}

// 操作菜单
const actionMenuVisible = ref(false);
const currentConv = ref(null);
const actionMenuActions = computed(() => {
  if (!currentConv.value) return [];
  const isPinned = currentConv.value.is_pinned;
  const isStared = currentConv.value.is_stared;
  return [
    { name: isPinned ? '取消置顶' : '置顶', key: 'pin' },
    { name: isStared ? '取消标星' : '标星', key: 'star' },
  ];
});

// 未读数 { key: count }
const unreadMap = ref({});
// @ 我未读数 { key: count }
const mentionMap = ref({});
let notificationPermission = 'default';

// 合并所有会话，按置顶 > 时间排序
const allConversations = computed(() => {
  const list = [];

  // 群聊（包含公共群）
  groups.value.forEach(g => {
    const key = `group_${g.id}`;
    const setting = getConvSetting(2, String(g.id));
    list.push({
      key,
      type: 'group',
      id: g.id,
      name: g.name,
      avatar: g.avatar,
      last_msg: g.last_msg || '',
      last_msg_at: g.last_msg_at || g.created_at,
      unread: unreadMap.value[key] || 0,
      mentionCount: mentionMap.value[key] || 0,
      is_pinned: setting?.is_pinned || false,
      is_stared: setting?.is_stared || false,
      is_public: g.is_public || false,
    });
  });

  // 单聊（手动聊过的 + 公共用户）
  const singleMap = new Map();

  // 先加手动聊过的
  singleList.value.forEach(s => {
    singleMap.set(s.uid, {
      uid: s.uid,
      nickname: s.nickname,
      avatar: s.avatar,
      last_msg: s.last_msg || '',
      last_msg_at: s.last_msg_at || '',
      is_public: false,
    });
  });

  // 再加公共用户（已聊过的不覆盖）
  publicUsers.value.forEach(u => {
    if (!singleMap.has(u.uid)) {
      singleMap.set(u.uid, {
        uid: u.uid,
        nickname: u.nickname,
        avatar: u.avatar,
        last_msg: '',
        last_msg_at: '',
        is_public: true,
      });
    } else {
      // 已聊过的也标记上公共
      singleMap.get(u.uid).is_public = true;
    }
  });

  // 转成数组
  singleMap.forEach(s => {
    const key = `single_${s.uid}`;
    const setting = getConvSetting(1, s.uid);
    list.push({
      key,
      type: 'single',
      id: s.uid,
      name: s.nickname,
      avatar: s.avatar,
      last_msg: s.last_msg || '',
      last_msg_at: s.last_msg_at || '',
      unread: unreadMap.value[key] || 0,
      mentionCount: mentionMap.value[key] || 0,
      is_pinned: setting?.is_pinned || false,
      is_stared: setting?.is_stared || false,
      is_public: s.is_public || false,
    });
  });

  // 排序：置顶优先，然后按时间倒序
  list.sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) {
      return a.is_pinned ? -1 : 1;
    }
    const ta = new Date(a.last_msg_at || 0).getTime();
    const tb = new Date(b.last_msg_at || 0).getTime();
    return tb - ta;
  });

  return list;
});

// 获取会话设置
function getConvSetting(convType, convId) {
  return convSettings.value.find(
    s => s.conv_type === convType && String(s.conv_id) === String(convId)
  );
}

const totalUnread = computed(() => {
  return Object.values(unreadMap.value).reduce((sum, n) => sum + n, 0);
});

function addUnread(key) {
  if (!unreadMap.value[key]) {
    unreadMap.value[key] = 0;
  }
  unreadMap.value[key]++;
  saveUnread();
}

function clearUnread(key) {
  if (unreadMap.value[key]) {
    unreadMap.value[key] = 0;
    saveUnread();
  }
}

function saveUnread() {
  localStorage.setItem('unread_map', JSON.stringify(unreadMap.value));
}

function loadUnread() {
  try {
    const saved = localStorage.getItem('unread_map');
    if (saved) unreadMap.value = JSON.parse(saved);
  } catch (e) {}
}

function saveMentions() {
  localStorage.setItem('mention_map', JSON.stringify(mentionMap.value));
}

function loadMentions() {
  try {
    const saved = localStorage.getItem('mention_map');
    if (saved) mentionMap.value = JSON.parse(saved);
  } catch (e) {}
}

function clearMention(key) {
  if (mentionMap.value[key]) {
    mentionMap.value[key] = 0;
    saveMentions();
  }
}

// 请求系统通知权限
function requestNotificationPermission() {
  if (!('Notification' in window)) return;
  notificationPermission = Notification.permission;
  if (notificationPermission === 'default') {
    Notification.requestPermission().then(perm => {
      notificationPermission = perm;
    });
  }
}

// 发送系统通知
function showNotification(title, body, data) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible') return;

  const n = new Notification(title, {
    body,
    icon: defaultAvatar,
    silent: false,
  });

  n.onclick = () => {
    window.focus();
    if (data?.type === 'single' && data?.uid) {
      router.push({ path: `/chat/${data.uid}`, query: { type: 'single' } });
    } else if (data?.type === 'group' && data?.groupId) {
      router.push({ path: `/chat/${data.groupId}`, query: { type: 'group' } });
    }
    n.close();
  };

  setTimeout(() => n.close(), 5000);
}

function formatTime(t) {
  if (!t) return '';
  const d = new Date(t);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function handleConnClick() {
  if (socketStore.status === 'failed' || socketStore.status === 'disconnected') {
    socketStore.reconnect();
  }
}

async function loadGroups() {
  loading.value = true;
  try {
    groups.value = await getMyGroups();
    saveGroups();
  } catch (err) {
    console.error(err);
  } finally {
    loading.value = false;
  }
}

async function loadPublicUsers() {
  try {
    publicUsers.value = await getPublicUsers();
  } catch (e) {}
}

async function loadConvSettings() {
  try {
    convSettings.value = await getConversationSettings();
  } catch (e) {}
}

function openConversation(item) {
  clearUnread(item.key);
  clearMention(item.key);
  if (item.type === 'group') {
    router.push({ path: `/chat/${item.id}`, query: { type: 'group' } });
  } else {
    router.push({ path: `/chat/${item.id}`, query: { type: 'single' } });
  }
}

// 显示操作菜单（长按/右键）
function showActionMenu(item) {
  currentConv.value = item;
  actionMenuVisible.value = true;
}

// 操作菜单选择
async function onActionSelect(action) {
  if (!currentConv.value) return;
  const conv = currentConv.value;
  const convType = conv.type === 'group' ? 2 : 1;
  const convId = conv.id;

  if (action.key === 'pin') {
    try {
      const newPinned = !conv.is_pinned;
      await pinConversation(convType, convId, newPinned);
      // 更新本地设置
      const idx = convSettings.value.findIndex(
        s => s.conv_type === convType && String(s.conv_id) === String(convId)
      );
      if (idx >= 0) {
        convSettings.value[idx].is_pinned = newPinned;
      } else {
        convSettings.value.push({
          conv_type: convType,
          conv_id: convId,
          is_pinned: newPinned,
          is_stared: false,
        });
      }
      showToast(newPinned ? '已置顶' : '已取消置顶');
    } catch (e) {}
  } else if (action.key === 'star') {
    try {
      const newStared = !conv.is_stared;
      await starConversation(convType, convId, newStared);
      // 更新本地设置
      const idx = convSettings.value.findIndex(
        s => s.conv_type === convType && String(s.conv_id) === String(convId)
      );
      if (idx >= 0) {
        convSettings.value[idx].is_stared = newStared;
      } else {
        convSettings.value.push({
          conv_type: convType,
          conv_id: convId,
          is_pinned: false,
          is_stared: newStared,
        });
      }
      showToast(newStared ? '已标星' : '已取消标星');
    } catch (e) {}
  }
}

function startSingleChat(user) {
  const exist = singleList.value.find(s => s.uid === user.uid);
  if (!exist) {
    singleList.value.unshift({
      uid: user.uid,
      nickname: user.nickname,
      avatar: user.avatar,
      last_msg: '',
    });
    saveSingleList();
  }
  showSearch.value = false;
  searchKeyword.value = '';
  searchResults.value = [];
  clearUnread(`single_${user.uid}`);
  router.push({ path: `/chat/${user.uid}`, query: { type: 'single' } });
}

async function doSearch() {
  if (!searchKeyword.value.trim()) return;
  searching.value = true;
  try {
    const list = await searchUsers(searchKeyword.value.trim());
    searchResults.value = list.filter(u => u.uid !== userStore.userInfo?.uid);
  } catch (e) {} finally {
    searching.value = false;
  }
}

function saveSingleList() {
  localStorage.setItem('single_list', JSON.stringify(singleList.value));
}

function loadSingleList() {
  try {
    const saved = localStorage.getItem('single_list');
    if (saved) singleList.value = JSON.parse(saved);
  } catch (e) {}
}

function saveGroups() {
  localStorage.setItem('groups_list', JSON.stringify(groups.value));
}

function loadGroupsCache() {
  try {
    const saved = localStorage.getItem('groups_list');
    if (saved) groups.value = JSON.parse(saved);
  } catch (e) {}
}

// 收到新消息
function onNewMessage(msg) {
  const myUid = userStore.userInfo?.uid;
  const isSelf = msg.from_uid === myUid;
  if (isSelf) return;

  // 群聊
  if (msg.group_id) {
    addUnread(`group_${msg.group_id}`);
    // @ 我的计数
    if (msg.mention_uids && msg.mention_uids.includes(myUid)) {
      const key = `group_${msg.group_id}`;
      if (!mentionMap.value[key]) mentionMap.value[key] = 0;
      mentionMap.value[key]++;
      saveMentions();
    }
    // 更新群最后一条消息
    const g = groups.value.find(g => g.id == msg.group_id);
    if (g) {
      g.last_msg = msg.type === 1 ? msg.content : '[图片]';
      g.last_msg_at = msg.created_at;
    }
    showNotification(
      msg.from_nickname || '新消息',
      msg.type === 1 ? msg.content : '[图片]',
      { type: 'group', groupId: msg.group_id }
    );
  }
  // 单聊
  else if (msg.from_uid && msg.to_uid === myUid) {
    addUnread(`single_${msg.from_uid}`);

    // 更新单聊列表：置顶 + 更新最后一条消息
    const idx = singleList.value.findIndex(s => s.uid === msg.from_uid);
    const item = {
      uid: msg.from_uid,
      nickname: msg.from_nickname || msg.from_uid,
      avatar: msg.from_avatar || '',
      last_msg: msg.type === 1 ? msg.content : '[图片]',
      last_msg_at: msg.created_at,
    };
    if (idx >= 0) {
      singleList.value.splice(idx, 1);
    }
    singleList.value.unshift(item);
    saveSingleList();

    showNotification(
      msg.from_nickname || '新消息',
      msg.type === 1 ? msg.content : '[图片]',
      { type: 'single', uid: msg.from_uid }
    );
  }
}

onMounted(() => {
  if (!userStore.isLogin) {
    router.push('/login');
    return;
  }

  if (!socketStore.connected) {
    socketStore.connect();
  }

  loadGroupsCache(); // 先从本地缓存加载，秒显
  loadSingleList();
  loadUnread();
  loadMentions();
  loadPublicUsers();
  loadConvSettings();
  requestNotificationPermission();

  // 然后从服务端刷新
  loadGroups();

  // 用 store 统一的事件监听方式（不管 socket 什么时候连接都能收到）
  offNewMessage = socketStore.onNewMessage(onNewMessage);
});

let offNewMessage = null;

onUnmounted(() => {
  offNewMessage?.();
  stopScan();
});
</script>

<style scoped>
.home-page {
  height: 100vh;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  background: #fff;
  overflow: hidden;
}

.conn-bar {
  position: fixed;
  top: 46px;
  left: 0;
  right: 0;
  z-index: 50;
  padding: 8px 16px;
  font-size: 13px;
  text-align: center;
  z-index: 99;
}

.conn-bar.connecting,
.conn-bar.reconnecting {
  background: #fff7e6;
  color: #ff976a;
}

.conn-bar.disconnected,
.conn-bar.failed {
  background: #ffeded;
  color: #ee0a24;
  cursor: pointer;
}

.search-bar {
  position: fixed;
  top: 46px;
  left: 0;
  right: 0;
  z-index: 100;
  background: #fff;
  max-height: 70vh;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

/* 有连接状态条时，搜索栏往下挪一点 */
.conn-bar + .search-bar {
  top: 82px;
}

.search-results {
  padding: 0 16px;
}

.search-item {
  display: flex;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
}

.search-info {
  margin-left: 12px;
  flex: 1;
}

.search-name {
  font-size: 15px;
  color: #333;
  margin-bottom: 2px;
}

.search-phone {
  font-size: 12px;
  color: #999;
}

.search-loading,
.search-empty {
  padding: 20px;
  text-align: center;
  color: #999;
  font-size: 14px;
}

.chat-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overflow-x: hidden;
  padding-top: 46px;
  padding-bottom: 56px;
  box-sizing: border-box;
  background: #fff;
  will-change: transform;
}

.chat-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #f5f5f5;
  cursor: pointer;
  position: relative;
}

.chat-item:active {
  background: #f7f7f7;
}

.chat-item.pinned {
  background: #f7faf7;
}

.chat-item.pinned::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: #07c160;
}

.avatar-wrap {
  position: relative;
  margin-right: 12px;
  flex-shrink: 0;
}

.badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  background: #fa5151;
  color: #fff;
  font-size: 11px;
  line-height: 18px;
  text-align: center;
  border-radius: 9px;
  box-sizing: border-box;
  font-weight: 500;
}

.star-icon {
  position: absolute;
  bottom: -2px;
  right: -2px;
  font-size: 14px;
  background: #fff;
  border-radius: 50%;
  padding: 1px;
}

.info {
  flex: 1;
  min-width: 0;
}

.name-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.right-col {
  display: flex;
  align-items: center;
  gap: 6px;
}

.mention-dot {
  background: #07c160;
  color: #fff;
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 8px;
  font-weight: 600;
  line-height: 1.4;
}

.name {
  font-size: 16px;
  font-weight: 500;
  color: #111;
}

.time {
  font-size: 12px;
  color: #b0b0b0;
}

.last-msg {
  font-size: 13px;
  color: #999;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tabbar-badge {
  position: absolute;
  top: 2px;
  right: 50%;
  transform: translateX(16px);
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  background: #fa5151;
  color: #fff;
  font-size: 10px;
  line-height: 16px;
  text-align: center;
  border-radius: 8px;
  box-sizing: border-box;
}

/* + 号菜单 */
.plus-menu {
  background: rgba(0, 0, 0, 0.75);
  border-radius: 8px;
  overflow: hidden;
  min-width: 120px;
}

.plus-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  color: #fff;
  font-size: 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.plus-menu-item:last-child {
  border-bottom: none;
}

.plus-menu-item:active {
  background: rgba(255, 255, 255, 0.1);
}

/* 扫一扫 */
.scan-container {
  position: relative;
  width: 100%;
  min-height: 360px;
  background: #000;
  overflow: hidden;
  border-radius: 8px;
}

.scan-video {
  width: 100%;
  height: 360px;
  object-fit: cover;
  display: block;
}

.scan-canvas {
  display: none;
}

.scan-frame {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 200px;
  height: 200px;
  border: 2px solid #07c160;
  border-radius: 12px;
  overflow: hidden;
}

.scan-line {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, #07c160, transparent);
  animation: scanLine 2s linear infinite;
}

@keyframes scanLine {
  0% { top: 0; }
  100% { top: 100%; }
}

.scan-tip {
  position: absolute;
  bottom: 60px;
  left: 0;
  right: 0;
  text-align: center;
  color: #fff;
  font-size: 13px;
  opacity: 0.8;
}

.scan-manual {
  position: absolute;
  bottom: 20px;
  left: 0;
  right: 0;
  text-align: center;
}

.scan-manual span {
  color: #07c160;
  font-size: 13px;
  text-decoration: underline;
}

.manual-input {
  padding: 12px;
  background: #fff;
}

.manual-input .van-field {
  margin-bottom: 12px;
}
</style>
