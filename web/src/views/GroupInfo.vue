<template>
  <div class="group-info-page">
    <van-nav-bar title="群详情" left-text="返回" left-arrow @click-left="$router.back()" fixed />

    <div class="page-scroll">
      <div class="page-body">
        <!-- 群信息 -->
        <div class="group-header">
        <div class="group-avatar-wrap" @click="onAvatarClick">
          <van-image round width="64" height="64" :src="getAvatar(groupAvatarUrl, groupInfo?.name)" />
          <div v-if="isOwner" class="avatar-edit-badge">
            <van-icon name="camera-o" size="14" color="#fff" />
          </div>
        </div>
        <div class="group-basic" @click="onNameClick">
          <div class="group-name">
            {{ groupInfo?.name || '加载中...' }}
            <van-icon v-if="isOwner" name="edit" size="14" color="#999" style="margin-left:4px" />
          </div>
          <div class="group-count">{{ groupInfo?.member_count || 0 }} 人</div>
        </div>
        <!-- 隐藏的头像文件选择框 -->
        <input
          ref="avatarInput"
          type="file"
          accept="image/*"
          style="display:none"
          @change="onAvatarFileChange"
        />
      </div>

      <!-- 群成员 -->
      <van-cell-group inset class="member-section">
        <div class="section-title">
          <span>群成员</span>
          <div class="member-title-right">
            <span class="member-count">{{ members.length }} 人</span>
            <van-button v-if="isOwner" size="mini" type="primary" plain @click="showAddMemberDialog = true">
              + 添加
            </van-button>
          </div>
        </div>
        <div class="member-grid">
          <div
            v-for="m in members"
            :key="m.uid"
            class="member-item"
            @click="onMemberClick(m)"
          >
            <van-image round width="48" height="48" :src="getAvatar(m.avatar, m.nickname)" />
            <div class="member-name">{{ m.nickname }}</div>
            <div v-if="m.role === 2" class="member-tag">群主</div>
            <div v-else-if="m.short_no" class="member-shortno">{{ m.short_no }}</div>
          </div>
        </div>
      </van-cell-group>

      <!-- 群二维码 -->
      <van-cell-group inset class="qr-section">
        <van-cell title="群二维码" is-link @click="showQrDialog = true">
          <template #icon>
            <van-icon name="qr" size="20" color="#07c160" />
          </template>
        </van-cell>
        <van-cell :title="groupInfo?.status === 0 ? '群状态：开门中' : '群状态：已关门'">
          <template #icon>
            <van-icon :name="groupInfo?.status === 0 ? 'unlock' : 'lock'" size="20" :color="groupInfo?.status === 0 ? '#07c160' : '#ff976a'" />
          </template>
        </van-cell>
      </van-cell-group>

      <!-- 退出群 -->
      <van-cell-group inset style="margin-top: 20px">
        <van-cell title="退出群聊" center style="color: #ee0a24" @click="handleLeaveGroup" />
      </van-cell-group>
      </div>
    </div>

    <!-- 二维码弹窗 -->
    <van-dialog v-model:show="showQrDialog" title="群二维码" :show-cancel-button="false" :show-confirm-button="false" width="320px">
      <div class="qr-dialog">
        <div class="qr-name">{{ groupInfo?.name }}</div>
        <div class="qr-count">{{ groupInfo?.member_count }} 人</div>
        <div class="qr-code">
          <img :src="qrCodeUrl" alt="群二维码" />
        </div>
        <div class="qr-tip">扫描二维码加入群聊</div>
        <div class="qr-code-text">邀请码: {{ groupInfo?.invite_code }}</div>
      </div>
    </van-dialog>

    <!-- 添加成员弹窗 -->
    <van-dialog
      v-model:show="showAddMemberDialog"
      title="添加成员"
      show-cancel-button
      :close-on-click-overlay="false"
      @confirm="onAddMemberConfirm"
    >
      <div style="padding: 16px 8px">
        <van-field
          v-model="addMemberInput"
          label="UID/短号"
          placeholder="请输入用户UID或短号"
        />
      </div>
    </van-dialog>

    <!-- 修改群名称弹窗 -->
    <van-dialog
      v-model:show="showEditNameDialog"
      title="修改群名称"
      show-cancel-button
      :close-on-click-overlay="false"
      @confirm="onEditNameConfirm"
    >
      <div style="padding: 16px 8px">
        <van-field
          v-model="editNameInput"
          label="群名称"
          placeholder="请输入群名称"
          maxlength="20"
        />
      </div>
    </van-dialog>

    <!-- 成员操作底部菜单（用 ActionSheet 组件） -->
    <van-action-sheet
      v-model:show="showMemberAction"
      :actions="memberActions"
      cancel-text="取消"
      @select="onMemberActionSelect"
    />

    <!-- 头像选择菜单 -->
    <van-action-sheet
      v-model:show="showAvatarAction"
      :actions="avatarActions"
      cancel-text="取消"
      @select="onAvatarActionSelect"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onActivated } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showConfirmDialog } from 'vant';
import 'vant/es/dialog/style';
import { showToast } from '@/utils/toast';
import { getAvatar } from '@/utils/avatar';
import {
  getGroupInfo,
  getGroupMembers,
  leaveGroup,
  addGroupMember,
  removeGroupMember,
  updateGroup,
} from '@/api/group';
import { uploadFile } from '@/api/upload';
import { useUserStore } from '@/store/user';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();

defineOptions({ name: 'GroupInfo' });

const groupId = route.params.id;
const groupInfo = ref(null);
const members = ref([]);

// 弹窗状态
const showQrDialog = ref(false);
const showAddMemberDialog = ref(false);
const showEditNameDialog = ref(false);
const showMemberAction = ref(false);
const showAvatarAction = ref(false);

// 表单数据
const addMemberInput = ref('');
const editNameInput = ref('');

// 当前操作的成员
const currentMember = ref(null);

const avatarInput = ref(null);


// 是否是群主
const isOwner = computed(() => {
  return groupInfo.value?.owner_uid === userStore.userInfo?.uid;
});

// 群头像 URL（兼容字符串 URL 和 JSON 对象格式）
const groupAvatarUrl = computed(() => {
  const a = groupInfo.value?.avatar;
  if (!a) return '';
  if (typeof a === 'string') {
    // 尝试解析 JSON
    try {
      const obj = JSON.parse(a);
      if (obj.url) return obj.url;
    } catch (e) {}
    return a; // 纯 URL 字符串
  }
  if (typeof a === 'object' && a.url) return a.url;
  return '';
});

// 二维码
const qrCodeUrl = computed(() => {
  if (!groupInfo.value?.invite_code) return '';
  const inviteUrl = `${window.location.origin}/invite/${groupInfo.value.invite_code}`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(inviteUrl)}`;
});

// 成员操作菜单（仅群主可见操作）
const memberActions = computed(() => {
  if (!currentMember.value) return [];
  const m = currentMember.value;
  const actions = [
    { name: 'ID: ' + (m.short_no || m.uid || '暂无'), disabled: true },
  ];
  // 群主可以移除成员（不能移除群主自己）
  if (isOwner.value && m.role !== 2) {
    actions.push({ name: '移除成员', id: 'remove_member', color: '#ee0a24' });
  }
  return actions;
});

// 头像操作菜单
const avatarActions = [
  { name: '从相册选择', id: 'choose_image' },
  { name: '查看大图', id: 'view_image' },
];

async function loadGroupInfo() {
  try {
    groupInfo.value = await getGroupInfo(groupId);
  } catch (e) {}
}

async function loadMembers() {
  try {
    members.value = await getGroupMembers(groupId);
  } catch (e) {}
}

// 点击头像
function onAvatarClick() {
  if (isOwner.value) {
    showAvatarAction.value = true;
  }
}

// 头像操作选择
function onAvatarActionSelect(action) {
  if (action.id === 'choose_image') {
    avatarInput.value?.click();
  } else if (action.id === 'view_image') {
    if (groupAvatarUrl.value) {
      window.open(groupAvatarUrl.value, '_blank');
    }
  }
}

// 头像文件选择
async function onAvatarFileChange(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const result = await uploadFile('avatar', file);
    const fileUrl = result?.url || result; // 兼容对象和字符串
    await updateGroup(groupId, { avatar: fileUrl });
    showToast('头像更新成功');
    loadGroupInfo();
  } catch (err) {
    showToast(err.message || '更新失败');
  } finally {
    e.target.value = '';
  }
}

// 点击群名称
function onNameClick() {
  if (!isOwner.value) return;
  editNameInput.value = groupInfo.value?.name || '';
  showEditNameDialog.value = true;
}

// 修改群名称确认
async function onEditNameConfirm() {
  const name = editNameInput.value.trim();
  if (!name) {
    showToast('群名称不能为空');
    // 失败时保持弹窗打开
    showEditNameDialog.value = true;
    return;
  }
  try {
    await updateGroup(groupId, { name });
    showToast('修改成功');
    loadGroupInfo();
  } catch (err) {
    showToast(err.message || '修改失败');
    showEditNameDialog.value = true;
  }
}

// 成员点击
function onMemberClick(member) {
  // 只有群主且被点击的不是群主自己，才弹出操作菜单
  if (isOwner.value && member.role !== 2) {
    currentMember.value = member;
    showMemberAction.value = true;
  }
}

// 成员操作选择
function onMemberActionSelect(action) {
  if (!currentMember.value) return;
  const m = currentMember.value;
  if (action.id === 'remove_member') {
    handleRemoveMember(m);
  }
}

async function handleRemoveMember(member) {
  try {
    await showConfirmDialog({
      title: '确认移除',
      message: `确定将「${member.nickname}」移出群聊？`,
      confirmButtonColor: '#ee0a24',
    });
    await removeGroupMember(groupId, member.uid);
    showToast('已移除');
    loadMembers();
    loadGroupInfo();
  } catch (e) {
    if (e !== 'cancel') {
      showToast(e.message || '操作失败');
    }
  }
}

// 添加成员确认
async function onAddMemberConfirm() {
  const input = addMemberInput.value.trim();
  if (!input) {
    showToast('请输入UID或短号');
    showAddMemberDialog.value = true;
    return;
  }
  try {
    await addGroupMember(groupId, input);
    showToast('添加成功');
    addMemberInput.value = '';
    loadMembers();
    loadGroupInfo();
  } catch (err) {
    showToast(err.message || '添加失败');
    showAddMemberDialog.value = true;
  }
}

async function handleLeaveGroup() {
  try {
    await showConfirmDialog({
      title: '提示',
      message: '确定退出该群聊吗？',
      confirmButtonColor: '#ee0a24',
    });
    await leaveGroup(groupId);
    showToast('已退出群聊');
    router.replace('/');
  } catch (e) {
    if (e !== 'cancel') {
      showToast(e.message || '操作失败');
    }
  }
}

onMounted(() => {
  loadGroupInfo();
  loadMembers();
});

// 从缓存激活时，后台静默刷新（60秒内不重复刷新）
let lastRefreshTime = 0;
onActivated(() => {
  const now = Date.now();
  if (now - lastRefreshTime < 60 * 1000) return;
  lastRefreshTime = now;
  loadGroupInfo();
  loadMembers();
});
</script>

<style scoped>
.group-info-page {
  height: 100vh;
  background: #ededed;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.page-scroll {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding-top: 68px;
  padding-bottom: calc(20px + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.page-body {
  padding: 12px 0;
}

.group-header {
  display: flex;
  align-items: center;
  padding: 20px 16px;
  background: #fff;
  margin-bottom: 12px;
  position: relative;
}

.group-avatar-wrap {
  position: relative;
  cursor: pointer;
}

.avatar-edit-badge {
  position: absolute;
  right: -4px;
  bottom: -4px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #1890ff;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #fff;
  box-sizing: border-box;
}

.group-basic {
  margin-left: 14px;
  flex: 1;
  cursor: pointer;
}

.group-name {
  font-size: 18px;
  font-weight: 600;
  color: #111;
  margin-bottom: 6px;
}

.group-count {
  font-size: 13px;
  color: #999;
}

.member-section {
  padding: 16px;
}

.section-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  font-size: 14px;
  color: #333;
}

.member-title-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.member-count {
  font-size: 13px;
  color: #999;
  font-weight: normal;
}

.member-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 16px 8px;
}

.member-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  text-align: center;
  cursor: pointer;
}

.member-name {
  margin-top: 4px;
  font-size: 12px;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.member-tag {
  position: absolute;
  top: -4px;
  right: -2px;
  font-size: 10px;
  padding: 1px 4px;
  background: #ff976a;
  color: #fff;
  border-radius: 4px;
}

.member-shortno {
  position: absolute;
  top: -4px;
  right: -2px;
  font-size: 9px;
  padding: 1px 3px;
  background: #07c160;
  color: #fff;
  border-radius: 3px;
}

.qr-section {
  margin-top: 12px;
}

.qr-dialog {
  padding: 10px 20px 20px;
  text-align: center;
}

.qr-name {
  font-size: 18px;
  font-weight: 600;
  color: #111;
  margin-bottom: 4px;
}

.qr-count {
  font-size: 13px;
  color: #999;
  margin-bottom: 16px;
}

.qr-code {
  padding: 16px;
  background: #fff;
  display: inline-block;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.qr-code img {
  width: 200px;
  height: 200px;
  display: block;
}

.qr-tip {
  margin-top: 16px;
  font-size: 14px;
  color: #666;
}

.qr-code-text {
  margin-top: 8px;
  font-size: 13px;
  color: #999;
  font-family: monospace;
}
</style>
