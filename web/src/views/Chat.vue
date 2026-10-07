<template>
  <div class="chat-page">
    <van-nav-bar
      :title="chatTitle"
      left-text="返回"
      left-arrow
      @click-left="goBack"
      fixed
    >
      <template #right>
        <template v-if="chatType === 'group'">
          <van-icon name="more-o" size="22" @click="goToGroupInfo" />
        </template>
        <span v-if="socketStore.status === 'connecting'" class="conn-status connecting">连接中...</span>
        <span v-else-if="socketStore.status === 'reconnecting'" class="conn-status reconnecting">重连中 {{ socketStore.reconnectAttempts }}</span>
        <span v-else-if="socketStore.status === 'disconnected'" class="conn-status disconnected">已断开</span>
        <span v-else-if="socketStore.status === 'failed'" class="conn-status failed" @click="socketStore.reconnect()">重连失败，点击重试</span>
      </template>
    </van-nav-bar>

    <div class="chat-body">
      <!-- 右侧 @ 提示 -->
      <div
        v-if="chatType === 'group' && mentionCount > 0"
        class="mention-float-btn"
        @click="jumpToNextMention"
      >
        <div class="mention-icon">@</div>
        <div class="mention-count">{{ mentionCount }}</div>
      </div>

      <div class="messages" ref="messagesRef" @scroll="handleScroll">
        <div v-if="loadingMore" class="load-more-tip">加载中...</div>
        <div v-else-if="!hasMoreMessages && messages.length > 0" class="load-more-tip">没有更早的消息了</div>
        <div
          v-for="msg in messages"
          :key="msg.id"
          class="msg-item"
          :class="{ 'msg-self': isSelf(msg) }"
        >
          <div class="msg-avatar" v-if="!isSelf(msg)" @click="showUserCard(msg.from_uid)">
            <van-image
              :src="msg.from_avatar || defaultAvatar"
              round
              width="40px"
              height="40px"
              radius="6"
            />
          </div>
          <div class="msg-bubble">
            <div class="msg-name" v-if="!isSelf(msg) && chatType === 'group'">
              {{ msg.from_nickname }}
            </div>
            <template v-if="msg.withdrawn">
              <div class="msg-content msg-withdrawn">
                {{ isSelf(msg) ? '你' : (msg.from_nickname || '对方') }}撤回了一条消息
              </div>
            </template>
            <template v-else>
              <div
                class="msg-content"
                :class="{ 'msg-sending': msg._sending, 'msg-failed': msg._failed, 'msg-mention': isMentionMe(msg) }"
                :id="'msg-' + msg.id"
                v-if="msg.type === 1"
                @contextmenu.prevent="onMsgLongPress(msg)"
                @touchstart="onMsgTouchStart(msg)"
                @touchend="onMsgTouchEnd"
                @mousedown="onMsgMouseDown(msg)"
                @mouseup="onMsgTouchEnd"
                @mouseleave="onMsgTouchEnd"
              >
                <span v-for="(part, idx) in parseMsgContent(msg)" :key="idx" :class="part.type === 'mention' ? 'mention-tag' : ''">
                  {{ part.text }}
                </span>
              </div>
              <div
                class="msg-content msg-image"
                :class="{ 'msg-sending': msg._sending, 'msg-failed': msg._failed }"
                v-else-if="msg.type === 2"
                @click="previewImage(msg.content)"
              >
                <img :src="msg.content" />
              </div>
              <div v-if="isSelf(msg)" class="msg-status">
                <span v-if="msg._sending" class="sending">发送中...</span>
                <span v-else-if="msg._failed" class="failed" @click="resendMessage(msg)">
                  <van-icon name="warning" size="12" /> 发送失败，点击重发
                </span>
                <span v-else-if="chatType === 'single' && isLastSelfMsg(msg) && peerRead" class="read">已读</span>
                <span v-else class="unread">已发送</span>
              </div>
            </template>
            <div class="msg-time">{{ formatMsgTime(msg.created_at) }}</div>
          </div>
        </div>
        <div ref="bottomRef" class="msg-bottom"></div>
      </div>
    </div>

    <!-- 快捷数字按钮 -->
    <div
      v-show="floatBtnEnabled"
      class="quick-btns"
      :style="{ top: quickBtnsPos.y + 'px', left: quickBtnsPos.x + 'px' }"
      :class="{ collapsed: !quickBtnsVisible }"
    >
      <!-- 顶部操作栏：整行可拖动，左侧折叠按钮 -->
      <div
        class="quick-header"
        @touchstart="onDragStart"
        @touchmove="onDragMove"
        @touchend="onDragEnd"
        @mousedown="onDragStart"
      >
        <div class="quick-collapse" @click.stop="toggleQuickBtns">
          <van-icon :name="quickBtnsVisible ? 'arrow-down' : 'arrow-up'" size="14" color="#666" />
        </div>
        <div class="quick-handle">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 11l-4 4 4 4"/>
            <path d="M15 11l4 4-4 4"/>
            <path d="M11 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>
            <path d="M11 16a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>
          </svg>
        </div>
      </div>

      <!-- 数字按钮 -->
      <div v-show="quickBtnsVisible" class="quick-btns-list">
        <div
          v-for="(item, idx) in quickBtns"
          :key="idx"
          class="quick-btn"
          :class="{ cooling: quickBtnCooling[idx] }"
          @click="sendQuickNumber(item, idx)"
          @touchstart.stop="onBtnTouchStart(idx)"
          @touchend.stop="onBtnTouchEnd"
          @mousedown.stop="onBtnMouseDown(idx)"
          @mouseup.stop="onBtnTouchEnd"
          @mouseleave="onBtnTouchEnd"
        >
          {{ item.label }}
        </div>
        <!-- 跳转到微信 -->
        <div class="quick-btn quick-btn-wechat" @click="jumpToWechat">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="#07c160">
            <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 01.213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 00.167-.054l1.903-1.114a.864.864 0 01.717-.098 10.16 10.16 0 002.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.92-6.344 1.327-1.033 3.091-1.622 4.852-1.622.159 0 .318.008.475.016C15.59 5.164 12.48 2.188 8.691 2.188zm-2.72 3.955a.805.805 0 11 0 1.61.805.805 0 01 0-1.61zm5.543 0a.805.805 0 11 0 1.61.805.805 0 01 0-1.61z"/>
            <path d="M24 14.62c0-3.16-3.098-5.72-6.903-5.72-3.805 0-6.902 2.56-6.902 5.72 0 3.16 3.097 5.72 6.902 5.72.697 0 1.37-.1 2.004-.284a.688.688 0 01 .573.08l1.524.893a.26.26 0 00 .132.043.23.23 0 00 .233-.236c0-.058-.023-.114-.039-.17l-.312-1.184a.47.47 0 01 .17-.53C23.004 18.11 24 16.454 24 14.62zm-9.204-.65a.643.643 0 11 0-1.286.643.643 0 01 0 1.286zm4.598 0a.643.643 0 11 0-1.286.643.643 0 01 0 1.286z"/>
          </svg>
        </div>
      </div>
    </div>

    <div class="input-bar">
      <!-- @ 候选成员栏 -->
      <div v-if="chatType === 'group' && showMentionCandidates" class="mention-candidates">
        <div
          v-for="m in mentionCandidates"
          :key="m.uid"
          class="mention-candidate-item"
          @click="insertMention(m)"
        >
          <van-image round width="28" height="28" :src="m.avatar || defaultAvatar" />
          <span class="mention-candidate-name">{{ m.nickname }}</span>
        </div>
        <div v-if="mentionCandidates.length === 0" class="mention-candidate-empty">没有匹配的成员</div>
      </div>
      <div class="chat-input-wrap">
        <div class="chat-input-icons">
          <div class="chat-icon-btn" @click.stop="toggleEmojiPanel">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#666" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
              <line x1="9" y1="9" x2="9.01" y2="9"/>
              <line x1="15" y1="9" x2="15.01" y2="9"/>
            </svg>
          </div>
          <div class="chat-icon-btn" @click.stop="chooseImage">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#666" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          </div>
          <div
            v-if="chatType === 'group'"
            class="chat-icon-btn"
            @click.stop="showMentionPicker = true"
          >
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#666" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="4"/>
              <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/>
            </svg>
          </div>
        </div>
        <van-field
          v-model="inputText"
          placeholder="输入消息..."
          :border="false"
          class="chat-input"
          @keyup.enter="sendText"
          @input="onInputChange"
          @focus="showEmojiPanel = false"
        >
          <template #button>
            <van-button size="small" type="primary" @click="sendText" :disabled="!inputText.trim()">
              发送
            </van-button>
          </template>
        </van-field>
      </div>
      <input
        ref="imageInput"
        type="file"
        accept="image/*"
        style="display: none"
        @change="onImageChange"
      />
    </div>

    <!-- 表情面板（fixed 定位，不影响输入框布局） -->
    <div v-show="showEmojiPanel" class="emoji-panel">
      <div class="emoji-list">
        <span
          v-for="(emoji, idx) in emojiList"
          :key="idx"
          class="emoji-item"
          @click="insertEmoji(emoji)"
        >
          {{ emoji }}
        </span>
      </div>
      <div class="emoji-panel-footer">
        <span class="emoji-backspace" @click="deleteLastChar">⌫ 删除</span>
      </div>
    </div>

    <!-- @ 成员选择弹窗 -->
    <van-popup
      v-model:show="showMentionPicker"
      position="bottom"
      round
      :style="{ height: '60%' }"
    >
      <div class="mention-picker">
        <div class="mention-picker-header">
          <span>选择要 @ 的人</span>
          <van-icon name="cross" size="20" @click="showMentionPicker = false" />
        </div>
        <div class="mention-picker-search">
          <van-search
            v-model="mentionSearchKeyword"
            placeholder="搜索成员"
            shape="round"
            :show-action="false"
          />
        </div>
        <div class="mention-picker-list">
          <div
            v-for="m in filteredMembers"
            :key="m.uid"
            class="mention-picker-item"
            @click="selectMention(m)"
          >
            <van-image round width="36" height="36" :src="m.avatar || defaultAvatar" />
            <div class="mention-picker-name">{{ m.nickname }}</div>
          </div>
          <van-empty v-if="filteredMembers.length === 0" description="没有找到成员" />
        </div>
      </div>
    </van-popup>

    <!-- 用户信息卡片 -->
    <van-popup
      v-model:show="showUserCardPopup"
      round
      position="bottom"
      :style="{ padding: '0' }"
    >
      <div class="user-card-popup" v-if="cardUser">
        <div class="user-card-header">
          <van-image
            :src="cardUser.avatar || defaultAvatar"
            round
            width="64"
            height="64"
          />
          <div class="user-card-info">
            <div class="user-card-name">{{ cardUser.nickname }}</div>
            <div class="user-card-shortno">ID：{{ cardUser.short_no || '暂无' }}</div>
          </div>
        </div>
        <div class="user-card-actions" v-if="cardUser.is_public">
          <van-button type="primary" block round @click="startChatWithUser">
            发消息
          </van-button>
        </div>
      </div>
    </van-popup>

    <!-- 编辑快捷按钮弹窗 -->
    <van-dialog
      v-model:show="showQuickEditDialog"
      title="编辑快捷按钮"
      show-cancel-button
      @confirm="confirmQuickEdit"
    >
      <van-field
        v-model="quickEditValue"
        label="内容"
        placeholder="请输入快捷内容"
        @keyup.enter.stop
      />
    </van-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, computed, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showToast, showImagePreview, showConfirmDialog, showLoadingToast, closeToast } from 'vant';
import { getGroupInfo, getGroupMessages, joinGroup, getGroupMembers } from '@/api/group';
import { getSingleMessages, getUserByUid } from '@/api/user';
import { uploadFile } from '@/api/upload';
import { useSocketStore } from '@/store/socket';
import { useUserStore } from '@/store/user';

const route = useRoute();
const router = useRouter();
const socketStore = useSocketStore();
const userStore = useUserStore();

const chatType = ref(route.query.type === 'single' ? 'single' : 'group');
const targetId = ref(route.params.id);

const messagesRef = ref(null);
const bottomRef = ref(null);
const inputText = ref('');
const imageInput = ref(null);
const showEmojiPanel = ref(false);

// 常用 emoji 列表
const emojiList = [
  '😀','😃','😄','😁','😅','😂','🤣','😊','😇','🙂',
  '😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛',
  '😝','😜','🤪','🤨','🧐','🤓','😎','🤩','🥳','😏',
  '😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫',
  '😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳',
  '🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🤭',
  '🤫','🤥','😶','😐','😑','😬','🙄','😯','😦','😧',
  '😮','😲','🥱','😴','🤤','😪','😵','🤐','🥴','🤢',
  '🤮','🤧','😷','🤒','🤕','🤑','🤠','😈','👿','👹',
  '👺','🤡','💩','👻','💀','👽','👾','🤖','🎃','😺',
  '👍','👎','👌','✌️','🤞','🤟','🤘','🤙','👈','👉',
  '👆','👇','☝️','✋','🤚','🖐️','🖖','👋','🤝','🙏',
  '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔',
  '💕','💞','💓','💗','💖','💘','💝','💟','💯','💢',
  '🔥','✨','🌟','⭐','💫','🎉','🎊','🎁','🎂','🍰',
  '☕','🍵','🥤','🍺','🍻','🥂','🍷','🌹','🌸','🌺',
];
const groupInfo = ref(null);
const singleUser = ref(null);
const messages = ref([]);
const hasMoreMessages = ref(true); // 是否还有更早的消息
const loadingMore = ref(false);    // 是否正在加载更多
const PAGE_SIZE = 50;
const LOAD_MORE_SIZE = 30;
const peerRead = ref(false);

// @ 功能
const showMentionPicker = ref(false);
const mentionSearchKeyword = ref('');
const mentionUids = ref([]); // 当前消息里要 @ 的 UID 列表
const groupMembers = ref([]); // 群成员列表
const mentionCount = ref(0); // 未读 @ 我的消息数
let mentionMsgIds = []; // @ 我的消息 ID 列表（已读的也保留，用于跳转）
let currentMentionIndex = -1;

// 用户信息卡片
const showUserCardPopup = ref(false);
const cardUser = ref(null);

// 输入 @ 时的候选成员
const showMentionCandidates = ref(false);
const mentionCandidates = ref([]);
let mentionStartPos = -1; // @ 符号在输入框中的位置

const userInfo = computed(() => userStore.userInfo);
const defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0OCA0OCI+PGRlZnM+PHN0eWxlPi5he2ZpbGw6I2VlZTt9PC9zdHlsZT48L2RlZnM+PHJlY3QgY2xhc3M9ImEiIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCIgcng9IjgiLz48dGV4dCB4PSIyNCIgeT0iMzAiIGZvbnQtc2l6ZT0iMjAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiM5OTkiPu+4lTwvdGV4dD48L3N2Zz4=';

// ========== 快捷数字按钮 ==========
const quickBtnsVisible = ref(true);
const quickBtnsPos = ref({ x: 10, y: 200 });
const quickBtns = ref(loadQuickBtns());

// 浮窗总开关（我的设置里控制）
const floatBtnEnabled = ref(localStorage.getItem('float_btn_enabled') !== 'false');

// 跳转到微信
function jumpToWechat() {
  // 微信 App URL Scheme
  window.location.href = 'weixin://';
}

function loadQuickBtns() {
  try {
    const saved = localStorage.getItem('quick_btns');
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return [
    { label: '22', value: '22' },
    { label: '55', value: '55' },
    { label: '199', value: '199' },
  ];
}

function saveQuickBtns() {
  try {
    localStorage.setItem('quick_btns', JSON.stringify(quickBtns.value));
  } catch (e) {}
}

// 加载位置
try {
  const savedPos = localStorage.getItem('quick_btns_pos');
  if (savedPos) quickBtnsPos.value = JSON.parse(savedPos);
} catch (e) {}

// 加载展开/折叠状态（群聊记住状态，单聊默认折叠）
function loadQuickBtnsVisible() {
  if (chatType.value === 'single') {
    quickBtnsVisible.value = false; // 单聊默认折叠
    return;
  }
  // 群聊：按群ID记住状态
  try {
    const saved = localStorage.getItem('quick_btns_visible_' + targetId.value);
    if (saved !== null) {
      quickBtnsVisible.value = saved === 'true';
    } else {
      quickBtnsVisible.value = true; // 群聊默认展开
    }
  } catch (e) {
    quickBtnsVisible.value = true;
  }
}

// 保存展开/折叠状态（群聊才保存）
function saveQuickBtnsVisible() {
  if (chatType.value === 'group') {
    try {
      localStorage.setItem('quick_btns_visible_' + targetId.value, String(quickBtnsVisible.value));
    } catch (e) {}
  }
}

let dragStartPos = null;
let dragStartPoint = null;
let isDragging = false;
const DRAG_THRESHOLD = 5; // 移动超过 5px 才算拖动

// 桌面端鼠标事件（绑在 document 上，拖出元素也能继续拖）
function onDocMouseMove(e) {
  onDragMove(e);
}
function onDocMouseUp(e) {
  onDragEnd(e);
  document.removeEventListener('mousemove', onDocMouseMove);
  document.removeEventListener('mouseup', onDocMouseUp);
}

function onDragStart(e) {
  const point = e.touches ? e.touches[0] : e;
  dragStartPos = {
    x: point.clientX - quickBtnsPos.value.x,
    y: point.clientY - quickBtnsPos.value.y,
  };
  dragStartPoint = { x: point.clientX, y: point.clientY };
  isDragging = false; // 先不认为在拖动，移动超过阈值才算

  // 如果是鼠标事件，绑定 document 级别的移动和松开
  if (!e.touches) {
    document.addEventListener('mousemove', onDocMouseMove);
    document.addEventListener('mouseup', onDocMouseUp);
    e.preventDefault();
  }
}

function onDragMove(e) {
  if (!dragStartPos) return;
  const point = e.touches ? e.touches[0] : e;

  // 还没开始拖动，先判断是否超过阈值
  if (!isDragging && dragStartPoint) {
    const dx = Math.abs(point.clientX - dragStartPoint.x);
    const dy = Math.abs(point.clientY - dragStartPoint.y);
    if (dx < DRAG_THRESHOLD && dy < DRAG_THRESHOLD) {
      return; // 移动太小，不算拖动
    }
  }

  if (e.preventDefault) e.preventDefault();
  const newX = point.clientX - dragStartPos.x;
  const newY = point.clientY - dragStartPos.y;

  // 限制在可视区域内
  const maxX = window.innerWidth - 60;
  const maxY = window.innerHeight - 200;
  quickBtnsPos.value = {
    x: Math.max(0, Math.min(newX, maxX)),
    y: Math.max(60, Math.min(newY, maxY)),
  };
  isDragging = true;
}

function onDragEnd() {
  dragStartPos = null;
  dragStartPoint = null;
  try {
    if (isDragging) {
      localStorage.setItem('quick_btns_pos', JSON.stringify(quickBtnsPos.value));
    }
  } catch (e) {}
  // 不在这里重置 isDragging，留给 click 事件判断用
  setTimeout(() => { isDragging = false; }, 0);
}

function toggleQuickBtns() {
  quickBtnsVisible.value = !quickBtnsVisible.value;
  saveQuickBtnsVisible();
}

// 长按编辑
let longPressTimer = null;
let currentEditIndex = -1;
const showQuickEditDialog = ref(false);
const quickEditValue = ref('');

function onBtnTouchStart(idx) {
  currentEditIndex = idx;
  longPressTimer = setTimeout(() => {
    editQuickBtn(idx);
  }, 600);
}

function onBtnMouseDown(idx) {
  onBtnTouchStart(idx);
}

function onBtnTouchEnd() {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
}

function editQuickBtn(idx) {
  const item = quickBtns.value[idx];
  currentEditIndex = idx;
  quickEditValue.value = item.value;
  showQuickEditDialog.value = true;
}

function confirmQuickEdit() {
  if (currentEditIndex < 0 || !quickEditValue.value.trim()) return;
  const value = quickEditValue.value.trim();
  quickBtns.value[currentEditIndex] = { label: value, value };
  saveQuickBtns();
  showQuickEditDialog.value = false;
}

// 快捷发送限流：每个按钮单独 1 秒冷却
const QUICK_SEND_INTERVAL = 1000;
const quickBtnCooling = ref([false, false, false]);

function sendQuickNumber(item, idx) {
  // 如果正在拖动，不发送
  if (isDragging) {
    isDragging = false;
    return;
  }

  // 检查该按钮是否冷却中
  if (quickBtnCooling.value[idx]) {
    showToast('操作太频繁了');
    return;
  }

  // 进入冷却
  quickBtnCooling.value[idx] = true;
  setTimeout(() => {
    quickBtnCooling.value[idx] = false;
  }, QUICK_SEND_INTERVAL);

  // 模拟输入发送
  inputText.value = item.value;
  sendText();
}

const chatTitle = computed(() => {
  if (chatType.value === 'group') return groupInfo.value?.name || '聊天';
  return singleUser.value?.nickname || '聊天';
});

function isSelf(msg) {
  return msg.from_uid === userStore.userInfo?.uid;
}

function formatMsgTime(t) {
  if (!t) return '';
  const d = new Date(t);
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function isLastSelfMsg(msg) {
  const selfMsgs = messages.value.filter(m => isSelf(m));
  if (selfMsgs.length === 0) return false;
  const lastSelf = selfMsgs[selfMsgs.length - 1];
  return msg.id === lastSelf.id;
}

// 是否 @ 我
function isMentionMe(msg) {
  if (!msg?.mention_uids || msg.mention_uids.length === 0) return false;
  const myUid = userStore.userInfo?.uid;
  if (!myUid) return false;
  return msg.mention_uids.includes(myUid);
}

// 解析消息内容，把 @xxx 高亮
function parseMsgContent(msg) {
  const content = msg.content || '';
  if (!msg.mention_uids || msg.mention_uids.length === 0) {
    return [{ type: 'text', text: content }];
  }

  const parts = [];
  let lastIdx = 0;
  // 匹配 @昵称 格式
  const mentionRegex = /@(\S+?)(\s|$)/g;
  let match;
  while ((match = mentionRegex.exec(content)) !== null) {
    if (match.index > lastIdx) {
      parts.push({ type: 'text', text: content.slice(lastIdx, match.index) });
    }
    parts.push({ type: 'mention', text: '@' + match[1] });
    lastIdx = match.index + match[0].length - match[2].length;
  }
  if (lastIdx < content.length) {
    parts.push({ type: 'text', text: content.slice(lastIdx) });
  }
  if (parts.length === 0) {
    return [{ type: 'text', text: content }];
  }
  return parts;
}

// 过滤成员（搜索）
const filteredMembers = computed(() => {
  const keyword = mentionSearchKeyword.value.trim().toLowerCase();
  const myUid = userStore.userInfo?.uid;
  let list = groupMembers.value.filter(m => m.uid !== myUid);
  if (keyword) {
    list = list.filter(m =>
      m.nickname?.toLowerCase().includes(keyword) ||
      m.uid?.toLowerCase().includes(keyword) ||
      m.short_no?.toLowerCase().includes(keyword)
    );
  }
  return list;
});

// 输入框变化：检测 @ 触发成员候选
function onInputChange() {
  const text = inputText.value;
  const myUid = userStore.userInfo?.uid;

  // 找最后一个 @ 符号（后面不能有空格，空格表示 @ 完了）
  let atIdx = -1;
  for (let i = text.length - 1; i >= 0; i--) {
    if (text[i] === '@') {
      // 检查 @ 后面有没有空格（有空格表示这个 @ 已经结束了）
      const afterAt = text.slice(i + 1);
      if (!afterAt.includes(' ')) {
        atIdx = i;
        break;
      }
    }
    // 如果遇到空格，说明当前词结束了，停止往前找
    if (text[i] === ' ') break;
  }

  if (atIdx >= 0) {
    mentionStartPos = atIdx;
    const keyword = text.slice(atIdx + 1).toLowerCase();
    // 过滤成员
    mentionCandidates.value = groupMembers.value
      .filter(m => m.uid !== myUid)
      .filter(m => {
        if (!keyword) return true;
        return (
          m.nickname?.toLowerCase().includes(keyword) ||
          m.short_no?.toLowerCase().includes(keyword)
        );
      })
      .slice(0, 10); // 最多显示 10 个
    showMentionCandidates.value = true;
  } else {
    showMentionCandidates.value = false;
    mentionStartPos = -1;
  }
}

// 从候选栏插入 @
function insertMention(member) {
  if (mentionStartPos < 0) return;

  const text = inputText.value;
  const before = text.slice(0, mentionStartPos);
  // 找 @ 后面的空格位置
  const afterAt = text.slice(mentionStartPos + 1);
  const spaceIdx = afterAt.indexOf(' ');
  const after = spaceIdx >= 0 ? afterAt.slice(spaceIdx) : ' ';

  inputText.value = before + `@${member.nickname}` + after;

  if (!mentionUids.value.includes(member.uid)) {
    mentionUids.value.push(member.uid);
  }

  showMentionCandidates.value = false;
  mentionStartPos = -1;
}

// 选择 @ 某个人
function selectMention(member) {
  // 在输入框末尾加上 @昵称
  inputText.value = inputText.value + `@${member.nickname} `;
  if (!mentionUids.value.includes(member.uid)) {
    mentionUids.value.push(member.uid);
  }
  showMentionPicker.value = false;
  mentionSearchKeyword.value = '';
}

// 跳转到下一条 @ 我的消息
function jumpToNextMention() {
  const myUid = userStore.userInfo?.uid;
  if (!myUid) return;

  // 重新收集 @ 我的消息
  const mentionMsgs = messages.value.filter(m => isMentionMe(m) && !isSelf(m));
  if (mentionMsgs.length === 0) return;

  // 找到下一条
  currentMentionIndex++;
  if (currentMentionIndex >= mentionMsgs.length) {
    currentMentionIndex = 0;
  }

  const msg = mentionMsgs[currentMentionIndex];
  const el = document.getElementById('msg-' + msg.id);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // 高亮闪烁一下
    el.classList.add('mention-flash');
    setTimeout(() => el.classList.remove('mention-flash'), 1000);
  }

  // 清除 @ 未读计数
  if (mentionCount.value > 0) {
    mentionCount.value = 0;
    saveMentionRead();
  }
}

// 保存 @ 已读状态到 localStorage
function saveMentionRead() {
  try {
    const key = `mention_read_${targetId.value}`;
    // 记录最后一条消息 ID
    const lastMsg = messages.value[messages.value.length - 1];
    if (lastMsg?.id) {
      localStorage.setItem(key, String(lastMsg.id));
    }
  } catch (e) {}
}

// 加载 @ 未读数
function loadMentionUnread() {
  try {
    const key = `mention_read_${targetId.value}`;
    const lastReadId = localStorage.getItem(key);
    if (!lastReadId) return;

    const myUid = userStore.userInfo?.uid;
    if (!myUid) return;

    // 统计最后一条已读之后的 @ 我的消息数
    let count = 0;
    let found = false;
    for (const m of messages.value) {
      if (String(m.id) === lastReadId) {
        found = true;
        continue;
      }
      if (found && isMentionMe(m) && !isSelf(m)) {
        count++;
      }
    }
    // 如果没找到最后一条已读，说明消息加载不全，先按 0 算
    mentionCount.value = count;
  } catch (e) {}
}

async function loadChatInfo() {
  if (chatType.value === 'group') {
    groupInfo.value = await getGroupInfo(targetId.value);
    // 公共群：自动加入（如果还没加入的话）
    if (groupInfo.value?.is_public) {
      try {
        await joinGroup(targetId.value);
      } catch (e) {
        // 加入失败忽略（可能已经在群里了）
      }
    }
    // 加载群成员（用于 @）
    try {
      groupMembers.value = await getGroupMembers(targetId.value);
    } catch (e) {}
  } else {
    try {
      const list = await getUserByUid(targetId.value);
      if (list && list.length > 0) {
        singleUser.value = list[0];
      }
    } catch (e) {
      singleUser.value = { uid: targetId.value, nickname: targetId.value };
    }
  }
}

async function loadMessages() {
  hasMoreMessages.value = true;
  loadingMore.value = false;
  if (chatType.value === 'group') {
    messages.value = await getGroupMessages(targetId.value, null, PAGE_SIZE);
  } else {
    messages.value = await getSingleMessages(targetId.value, null, PAGE_SIZE);
  }
  // 如果返回的数量少于一页，说明没有更多了
  if (messages.value.length < PAGE_SIZE) {
    hasMoreMessages.value = false;
  }
  scrollToBottom(true);
}

// 加载更早的消息
async function loadMoreMessages() {
  if (!hasMoreMessages.value || loadingMore.value) return;
  if (messages.value.length === 0) return;

  loadingMore.value = true;
  const firstId = messages.value[0].id;

  let oldMessages = [];
  if (chatType.value === 'group') {
    oldMessages = await getGroupMessages(targetId.value, firstId, LOAD_MORE_SIZE);
  } else {
    oldMessages = await getSingleMessages(targetId.value, firstId, LOAD_MORE_SIZE);
  }

  if (oldMessages.length === 0 || oldMessages.length < LOAD_MORE_SIZE) {
    hasMoreMessages.value = false;
  }

  if (oldMessages.length > 0) {
    // 记录当前滚动位置和第一条消息的位置
    const container = messagesRef.value;
    const prevScrollHeight = container.scrollHeight;
    const prevScrollTop = container.scrollTop;

    // 插入旧消息到前面
    messages.value = [...oldMessages, ...messages.value];

    // 保持滚动位置不变（不让页面跳动）
    await nextTick();
    const newScrollHeight = container.scrollHeight;
    container.scrollTop = prevScrollTop + (newScrollHeight - prevScrollHeight);
  }

  loadingMore.value = false;
}

function scrollToBottom(smooth = false) {
  nextTick(() => {
    if (bottomRef.value) {
      bottomRef.value.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'end' });
    } else if (messagesRef.value) {
      messagesRef.value.scrollTop = messagesRef.value.scrollHeight;
    }
  });
}

// 滚动监听：滚到顶部加载更多
function handleScroll() {
  const container = messagesRef.value;
  if (!container) return;
  // 距离顶部小于 50px 时加载更多
  if (container.scrollTop < 50 && hasMoreMessages.value && !loadingMore.value) {
    loadMoreMessages();
  }
}

function sendText() {
  if (!inputText.value.trim()) return;

  const content = inputText.value.trim();
  const myUid = userStore.userInfo?.uid;

  // 生成临时 ID（本地乐观显示用）
  const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);

  // 构造本地消息，立即显示
  const localMsg = {
    id: tempId,
    _tempId: tempId,
    _sending: true,
    _failed: false,
    group_id: chatType.value === 'group' ? targetId.value : null,
    from_uid: myUid,
    from_nickname: userStore.userInfo?.nickname,
    from_avatar: userStore.userInfo?.avatar,
    from_short_no: userStore.userInfo?.short_no,
    to_uid: chatType.value === 'single' ? targetId.value : null,
    type: 1,
    content,
    mention_uids: [...mentionUids.value],
    created_at: new Date().toISOString(),
  };

  messages.value.push(localMsg);
  scrollToBottom();
  inputText.value = '';
  showEmojiPanel.value = false;
  mentionUids.value = [];

  const msgData = chatType.value === 'group'
    ? { groupId: targetId.value, type: 1, content, mentionUids: mentionUids.value }
    : { toUid: targetId.value, type: 1, content };

  // 记录发送开始时间，确保"发送中"至少显示 300ms
  const startTime = Date.now();
  const minDisplayTime = 300;

  socketStore.sendMessage(msgData, (res) => {
    const idx = messages.value.findIndex(m => m._tempId === tempId);
    if (idx < 0) return;

    // 计算还需要等多久才够 300ms
    const elapsed = Date.now() - startTime;
    const waitTime = Math.max(0, minDisplayTime - elapsed);

    setTimeout(() => {
      if (res.code === 0) {
        messages.value.splice(idx, 1, { ...res.data, _sending: false, _failed: false });
      } else {
        messages.value[idx]._sending = false;
        messages.value[idx]._failed = true;
        showToast(res.message || '发送失败');
      }
    }, waitTime);
  });
}

// 选择图片
// ========== 表情面板 ==========
function toggleEmojiPanel() {
  showEmojiPanel.value = !showEmojiPanel.value;
}

function insertEmoji(emoji) {
  inputText.value += emoji;
}

function deleteLastChar() {
  inputText.value = inputText.value.slice(0, -1);
}

function chooseImage() {
  imageInput.value?.click();
}

// 发送图片
async function onImageChange(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  if (file.size > 10 * 1024 * 1024) {
    showToast('图片不能超过 10MB');
    return;
  }

  const myUid = userStore.userInfo?.uid;
  const tempId = 'temp_img_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  const localUrl = URL.createObjectURL(file);

  const localMsg = {
    id: tempId,
    _tempId: tempId,
    _sending: true,
    _failed: false,
    group_id: chatType.value === 'group' ? targetId.value : null,
    from_uid: myUid,
    from_nickname: userStore.userInfo?.nickname,
    from_avatar: userStore.userInfo?.avatar,
    from_short_no: userStore.userInfo?.short_no,
    to_uid: chatType.value === 'single' ? targetId.value : null,
    type: 2,
    content: localUrl,
    created_at: new Date().toISOString(),
  };

  messages.value.push(localMsg);
  scrollToBottom();
  e.target.value = '';

  const startTime = Date.now();
  const minDisplayTime = 300;

  try {
    showLoadingToast({ message: '发送中...', forbidClick: true, duration: 0 });

    const result = await uploadFile('chat', file);
    closeToast();

    const imageUrl = result.url;
    const msgData = chatType.value === 'group'
      ? { groupId: targetId.value, type: 2, content: imageUrl }
      : { toUid: targetId.value, type: 2, content: imageUrl };

    socketStore.sendMessage(msgData, (res) => {
      const idx = messages.value.findIndex(m => m._tempId === tempId);
      if (idx < 0) return;

      const elapsed = Date.now() - startTime;
      const waitTime = Math.max(0, minDisplayTime - elapsed);

      setTimeout(() => {
        if (res.code === 0) {
          messages.value.splice(idx, 1, { ...res.data, _sending: false, _failed: false });
        } else {
          messages.value[idx]._sending = false;
          messages.value[idx]._failed = true;
          showToast(res.message || '发送失败');
        }
      }, waitTime);
    });
  } catch (err) {
    closeToast();
    const idx = messages.value.findIndex(m => m._tempId === tempId);
    if (idx >= 0) {
      messages.value[idx]._sending = false;
      messages.value[idx]._failed = true;
    }
    showToast(err.message || '上传失败');
  }
}

// 重发消息
function resendMessage(msg) {
  if (!msg._failed) return;

  const tempId = msg._tempId;
  msg._sending = true;
  msg._failed = false;

  const startTime = Date.now();
  const minDisplayTime = 300;

  const msgData = chatType.value === 'group'
    ? { groupId: targetId.value, type: msg.type, content: msg.content }
    : { toUid: targetId.value, type: msg.type, content: msg.content };

  socketStore.sendMessage(msgData, (res) => {
    const idx = messages.value.findIndex(m => m._tempId === tempId);
    if (idx < 0) return;

    const elapsed = Date.now() - startTime;
    const waitTime = Math.max(0, minDisplayTime - elapsed);

    setTimeout(() => {
      if (res.code === 0) {
        messages.value.splice(idx, 1, { ...res.data, _sending: false, _failed: false });
      } else {
        messages.value[idx]._sending = false;
        messages.value[idx]._failed = true;
        showToast(res.message || '发送失败');
      }
    }, waitTime);
  });
}

function previewImage(url) {
  showImagePreview([url]);
}

function goToGroupInfo() {
  router.push(`/group/${targetId.value}`);
}

function goBack() {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push('/');
  }
}

// ========== 用户信息卡片 ==========
async function showUserCard(uid) {
  if (!uid) return;
  // 先从群成员里找
  const member = groupMembers.value.find(m => m.uid === uid);
  if (member) {
    cardUser.value = member;
    showUserCardPopup.value = true;
    return;
  }
  // 找不到再请求接口
  try {
    showLoadingToast({ message: '加载中...', forbidClick: true });
    const list = await getUserByUid(uid);
    closeToast();
    if (list && list.length > 0) {
      cardUser.value = list[0];
      showUserCardPopup.value = true;
    } else {
      showToast('用户不存在');
    }
  } catch (e) {
    closeToast();
    showToast('获取用户信息失败');
  }
}

function startChatWithUser() {
  if (!cardUser.value) return;
  showUserCardPopup.value = false;
  router.push(`/chat/${cardUser.value.uid}?type=single`);
}

// ========== 消息长按 & 撤回 ==========
let msgLongPressTimer = null;
let longPressMsg = null;

function onMsgTouchStart(msg) {
  // 不是自己的消息不能撤回
  if (!isSelf(msg) || msg.withdrawn || msg._sending || msg._failed) return;
  longPressMsg = msg;
  msgLongPressTimer = setTimeout(() => {
    showMsgActionSheet(msg);
  }, 500);
}

function onMsgMouseDown(msg) {
  onMsgTouchStart(msg);
}

function onMsgTouchEnd() {
  if (msgLongPressTimer) {
    clearTimeout(msgLongPressTimer);
    msgLongPressTimer = null;
  }
}

function onMsgLongPress(msg) {
  // 右键也弹出菜单
  if (!isSelf(msg) || msg.withdrawn || msg._sending || msg._failed) return;
  showMsgActionSheet(msg);
}

function showMsgActionSheet(msg) {
  showConfirmDialog({
    title: '提示',
    message: '确定撤回这条消息吗？',
    confirmButtonText: '撤回',
    cancelButtonText: '取消',
  }).then(() => {
    doWithdraw(msg);
  }).catch(() => {});
}

function doWithdraw(msg) {
  socketStore.withdrawMessage(msg.id, (res) => {
    if (res.code === 0) {
      showToast('已撤回');
    } else {
      showToast(res.message || '撤回失败');
    }
  });
}

function onMessageWithdrawn(data) {
  // 更新本地消息列表
  const idx = messages.value.findIndex(m => m.id == data.id);
  if (idx >= 0) {
    messages.value[idx].withdrawn = true;
  }
}

function onNewMessage(msg) {
  const myUid = userStore.userInfo?.uid;
  const isSelfMsg = msg.from_uid === myUid;

  // 判断是不是当前会话的消息
  let isCurrentChat = false;
  if (chatType.value === 'group') {
    isCurrentChat = msg.group_id == targetId.value;
  } else {
    isCurrentChat = msg.group_id == null && (
      (msg.from_uid === targetId.value && msg.to_uid === myUid) ||
      (msg.from_uid === myUid && msg.to_uid === targetId.value)
    );
  }

  if (!isCurrentChat) return;

  // 如果是自己发的消息，检查有没有临时消息（发送中的），有就替换掉，避免重复
  if (isSelfMsg) {
    // 先按 id 精确匹配（已经替换过的情况）
    const existIdx = messages.value.findIndex(m => m.id === msg.id);
    if (existIdx >= 0) return;

    // 再找发送中的同类型消息（图片可能 content 不一样，用 type 匹配）
    const tempIdx = messages.value.findIndex(m => m._sending && m.type === msg.type);
    if (tempIdx >= 0) {
      messages.value.splice(tempIdx, 1, { ...msg, _sending: false, _failed: false });
      scrollToBottom();
      return;
    }
  }

  messages.value.push(msg);
  scrollToBottom();

  // @ 我：增加未读数
  if (chatType.value === 'group' && !isSelfMsg && isMentionMe(msg)) {
    mentionCount.value++;
  }

  if (chatType.value === 'single') {
    updateSingleList(msg);

    if (msg.from_uid === targetId.value) {
      sendReadReceipt();
    }

    if (isSelfMsg) {
      peerRead.value = false;
    }
  }
}

function onMessageRead(data) {
  if (chatType.value !== 'single') return;
  if (data.fromUid === targetId.value) {
    peerRead.value = true;
  }
}

function sendReadReceipt() {
  if (chatType.value !== 'single') return;
  if (!socketStore.socket || !socketStore.connected) return;

  const lastMsg = messages.value[messages.value.length - 1];
  if (!lastMsg) return;

  socketStore.socket.emit('read_message', {
    fromUid: targetId.value,
    lastMsgId: lastMsg.id,
  });
}

function updateSingleList(msg) {
  try {
    const saved = localStorage.getItem('single_list');
    if (!saved) return;
    const list = JSON.parse(saved);
    const otherUid = msg.from_uid === userStore.userInfo?.uid ? msg.to_uid : msg.from_uid;
    const idx = list.findIndex(i => i.uid === otherUid);
    if (idx >= 0) {
      list[idx].last_msg = msg.type === 1 ? msg.content : '[图片]';
      localStorage.setItem('single_list', JSON.stringify(list));
    }
  } catch (e) {}
}

// 处理键盘弹起（移动端输入时），确保消息可见
function handleResize() {
  scrollToBottom();
}

onMounted(() => {
  // 确保 socket 已连接
  if (!socketStore.socket) {
    socketStore.connect();
  }

  const unreadKey = chatType.value === 'group' ? `group_${targetId.value}` : `single_${targetId.value}`;
  try {
    const saved = localStorage.getItem('unread_map');
    if (saved) {
      const map = JSON.parse(saved);
      if (map[unreadKey]) {
        map[unreadKey] = 0;
        localStorage.setItem('unread_map', JSON.stringify(map));
      }
    }
  } catch (e) {}

  loadChatInfo();
  loadQuickBtnsVisible(); // 加载快捷按钮展开状态
  loadMessages().then(() => {
    if (chatType.value === 'single') {
      const hasPeerMsg = messages.value.some(m => m.from_uid === targetId.value);
      if (hasPeerMsg) {
        sendReadReceipt();
      }
    }
  });

  window.addEventListener('resize', handleResize);

  // 用 store 统一的监听方式，自动处理 socket 连接时机
  offNewMessage = socketStore.onNewMessage(onNewMessage);
  offMessageRead = socketStore.onMessageRead(onMessageRead);
  offMessageWithdrawn = socketStore.onMessageWithdrawn(onMessageWithdrawn);
});

let offNewMessage = null;
let offMessageRead = null;
let offMessageWithdrawn = null;

// 监听路由变化（切换群聊/单聊时重新加载）
watch(() => route.params.id, (newId) => {
  if (!newId || newId === targetId.value) return;
  chatType.value = route.query.type === 'single' ? 'single' : 'group';
  targetId.value = newId;
  // 重置状态
  messages.value = [];
  groupInfo.value = null;
  singleUser.value = null;
  groupMembers.value = [];
  mentionUids.value = [];
  mentionCount.value = 0;
  mentionMsgIds = [];
  currentMentionIndex = -1;
  peerRead.value = false;
  // 清除未读
  const unreadKey = chatType.value === 'group' ? `group_${targetId.value}` : `single_${targetId.value}`;
  try {
    const saved = localStorage.getItem('unread_map');
    if (saved) {
      const map = JSON.parse(saved);
      if (map[unreadKey]) {
        map[unreadKey] = 0;
        localStorage.setItem('unread_map', JSON.stringify(map));
      }
    }
  } catch (e) {}
  // 重新加载
  loadChatInfo();
  loadQuickBtnsVisible(); // 重新加载快捷按钮展开状态
  loadMessages();
});

onUnmounted(() => {
  offNewMessage?.();
  offMessageRead?.();
  offMessageWithdrawn?.();
  window.removeEventListener('resize', handleResize);
});
</script>

<style scoped>
.chat-page {
  height: 100vh;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  background: #ededed;
  overflow: hidden;
}

.chat-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding-top: 46px;
  padding-bottom: 56px;
  box-sizing: border-box;
}

.messages {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overflow-x: hidden;
  padding: 12px;
  box-sizing: border-box;
  will-change: transform;
}

.load-more-tip {
  text-align: center;
  color: #999;
  font-size: 12px;
  padding: 10px 0;
}

.msg-bottom {
  height: 1px;
  flex-shrink: 0;
}

.msg-item {
  display: flex;
  margin-bottom: 16px;
  align-items: flex-start;
}

.msg-item.msg-self {
  flex-direction: row-reverse;
}

.msg-avatar {
  margin: 0 8px;
  flex-shrink: 0;
}

.msg-bubble {
  max-width: 72%;
  display: flex;
  flex-direction: column;
}

.msg-self .msg-bubble {
  align-items: flex-end;
}

.msg-name {
  font-size: 12px;
  color: #999;
  margin: 0 0 4px 4px;
}

.msg-time {
  font-size: 11px;
  color: #bbb;
  margin-top: 4px;
  padding: 0 4px;
  text-align: right;
}

.msg-self .msg-time {
  text-align: right;
}

.msg-content {
  background: #fff;
  padding: 10px 14px;
  border-radius: 6px;
  font-size: 16px;
  line-height: 1.5;
  word-break: break-all;
  word-wrap: break-word;
  position: relative;
  color: #111;
  max-width: 100%;
}

.msg-self .msg-content {
  background: #95ec69;
  color: #000;
}

.msg-content.msg-sending {
  opacity: 0.6;
}

.msg-content.msg-failed {
  background: #ffecec !important;
  color: #ee0a24 !important;
  border: 1px solid #ffcccc;
}

.msg-content.msg-withdrawn {
  background: transparent;
  color: #b2b2b2;
  font-size: 13px;
  font-style: italic;
  padding: 4px 0;
  text-align: center;
}

.msg-status {
  font-size: 11px;
  margin-top: 4px;
  padding-right: 4px;
}

.msg-status .read {
  color: #07c160;
}

.msg-status .unread {
  color: #999;
}

.msg-status .sending {
  color: #c9c9c9;
}

.msg-status .failed {
  color: #ee0a24;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.msg-image {
  padding: 4px;
  background: transparent;
}

.msg-image img {
  max-width: 200px;
  max-height: 240px;
  border-radius: 6px;
  display: block;
}

.input-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #f7f7f7;
  border-top: 1px solid #e0e0e0;
  padding: 8px 12px;
  padding-bottom: calc(8px + env(safe-area-inset-bottom));
  z-index: 100;
}

.chat-input-wrap {
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 6px;
}

.chat-input-icons {
  display: flex;
  align-items: center;
  padding: 0 4px 0 10px;
  gap: 10px;
  flex-shrink: 0;
}

.chat-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 4px;
}

.chat-icon-btn:active {
  opacity: 0.6;
}

.chat-input {
  flex: 1;
  min-width: 0;
}

.chat-input :deep(.van-field__control) {
  background: #fff;
  border-radius: 6px;
  padding: 8px 12px;
  min-height: 36px;
  font-size: 15px;
}

.chat-input :deep(.van-field__body) {
  background: #fff;
  border-radius: 6px;
  padding-right: 8px;
}

/* 快捷数字按钮 */
.quick-btns {
  position: fixed;
  z-index: 200;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
  padding: 8px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 22px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  -webkit-user-select: none;
  user-select: none;
  transition: all 0.2s ease;
  min-width: 140px;
}

.quick-btns.collapsed {
  padding: 6px 8px;
  gap: 0;
  min-width: auto;
}

/* 顶部操作栏：折叠 + 拖动手柄 同一行 */
.quick-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2px;
  gap: 8px;
}

.quick-collapse {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 50%;
  background: #f0f0f0;
  flex-shrink: 0;
}

.quick-collapse:active {
  background: #e0e0e0;
}

/* 拖动手柄：右边、突出、手指形状、好选中 */
.quick-handle {
  width: 44px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  touch-action: none;
  border-radius: 18px;
  background: linear-gradient(135deg, #07c160 0%, #06ad56 100%);
  box-shadow: 0 2px 6px rgba(7, 193, 96, 0.4);
  flex-shrink: 0;
  transition: transform 0.1s ease, box-shadow 0.1s ease;
}

.quick-handle:active {
  cursor: grabbing;
  transform: scale(1.05);
  box-shadow: 0 3px 10px rgba(7, 193, 96, 0.5);
}

.quick-handle svg {
  stroke: #fff;
}

.quick-btns-list {
  display: flex;
  flex-direction: row;
  justify-content: center;
  gap: 8px;
  padding-top: 2px;
}

.quick-btn {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #07c160;
  color: #fff;
  border-radius: 50%;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  -webkit-user-select: none;
  user-select: none;
  touch-action: manipulation;
  position: relative;
  overflow: hidden;
}

.quick-btn:active {
  transform: scale(0.95);
}

/* 冷却动画：橙色从底部慢慢向上收回，露出绿色 */
.quick-btn.cooling {
  pointer-events: none;
  background: linear-gradient(to top, #07c160 50%, #ff976a 50%);
  background-size: 100% 200%;
  background-position: top;
  animation: cooling-down 1s ease-out forwards;
}

@keyframes cooling-down {
  0% {
    background-position: top;
  }
  100% {
    background-position: bottom;
  }
}

.quick-btn-wechat {
  background: #fff;
  border: 1px solid #e0e0e0;
}

.conn-status {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 10px;
  white-space: nowrap;
}

.conn-status.connecting {
  color: #ff976a;
  background: #fff7e6;
}

.conn-status.reconnecting {
  color: #ff976a;
  background: #fff7e6;
}

.conn-status.disconnected {
  color: #c9c9c9;
  background: #f7f8fa;
}

.conn-status.failed {
  color: #ee0a24;
  background: #ffeded;
  cursor: pointer;
}

.mention-tag {
  color: #07c160;
  font-weight: 500;
}

.msg-self .mention-tag {
  color: #1aad19;
}

/* @ 我的消息高亮 */
.msg-content.msg-mention {
  background: #fff5e6;
}

.msg-self .msg-content.msg-mention {
  background: #ffe9cc;
}

/* 跳转闪烁 */
@keyframes mentionFlash {
  0%, 100% { box-shadow: 0 0 0 0 rgba(7, 193, 96, 0); }
  50% { box-shadow: 0 0 0 4px rgba(7, 193, 96, 0.4); }
}

.mention-flash {
  animation: mentionFlash 1s ease-in-out;
}

/* 右侧 @ 悬浮按钮 */
.mention-float-btn {
  position: fixed;
  right: 12px;
  bottom: 100px;
  z-index: 100;
  width: 44px;
  height: 44px;
  background: #07c160;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  cursor: pointer;
}

.mention-float-btn:active {
  transform: scale(0.95);
}

.mention-icon {
  font-size: 16px;
  font-weight: 600;
  line-height: 1;
}

.mention-count {
  font-size: 10px;
  line-height: 1;
  margin-top: 2px;
}

/* @ 成员选择弹窗 */
.mention-picker {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.mention-picker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  font-size: 16px;
  font-weight: 600;
  border-bottom: 1px solid #f0f0f0;
}

.mention-picker-search {
  padding: 8px 16px;
  background: #f7f7f7;
}

.mention-picker-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px;
}

.mention-picker-item {
  display: flex;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f5f5f5;
  cursor: pointer;
}

.mention-picker-item:active {
  background: #f7f7f7;
}

.mention-picker-name {
  margin-left: 12px;
  font-size: 15px;
  color: #333;
}

/* 表情面板 */
.emoji-panel {
  position: fixed;
  bottom: 52px; /* 输入栏高度 */
  left: 0;
  right: 0;
  background: #fff;
  border-top: 1px solid #eee;
  height: 240px;
  display: flex;
  flex-direction: column;
  z-index: 150;
}

.emoji-list {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: 4px;
  padding: 8px 10px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.emoji-item {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  height: 38px;
  border-radius: 6px;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
}

.emoji-item:active {
  background: #f0f0f0;
}

.emoji-panel-footer {
  display: flex;
  justify-content: flex-end;
  padding: 6px 14px;
  border-top: 1px solid #f0f0f0;
  background: #fafafa;
}

.emoji-backspace {
  font-size: 13px;
  color: #666;
  padding: 4px 12px;
  border-radius: 4px;
  cursor: pointer;
}

.emoji-backspace:active {
  background: #eaeaea;
}

/* @ 候选成员栏 */
.mention-candidates {
  display: flex;
  overflow-x: auto;
  padding: 8px 12px;
  background: #f7f7f7;
  border-bottom: 1px solid #eee;
  gap: 12px;
  white-space: nowrap;
  -webkit-overflow-scrolling: touch;
}

.mention-candidate-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: #fff;
  border-radius: 16px;
  flex-shrink: 0;
  cursor: pointer;
}

.mention-candidate-item:active {
  background: #e8f8ef;
}

.mention-candidate-name {
  font-size: 13px;
  color: #333;
}

.mention-candidate-empty {
  font-size: 13px;
  color: #999;
  padding: 4px 10px;
}

.user-card-popup {
  padding: 24px 16px 32px;
}

.user-card-header {
  display: flex;
  align-items: center;
  margin-bottom: 24px;
}

.user-card-info {
  margin-left: 16px;
  flex: 1;
}

.user-card-name {
  font-size: 20px;
  font-weight: 600;
  color: #111;
  margin-bottom: 6px;
}

.user-card-shortno {
  font-size: 14px;
  color: #999;
}

.user-card-actions {
  padding: 0 8px;
}
</style>
