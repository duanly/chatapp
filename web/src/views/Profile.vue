<template>
  <div class="profile-page">
    <van-nav-bar title="我的" fixed />

    <div class="profile">
      <div class="user-card" @click="onAvatarClick">
        <van-image
          :src="userInfo?.avatar || defaultAvatar"
          round
          width="60px"
          height="60px"
        />
        <div class="user-info">
          <div class="nickname">{{ userInfo?.nickname || '未设置' }}</div>
          <div class="phone">
            ID：{{ userInfo?.short_no || '暂无' }}
          </div>
        </div>
        <van-icon name="arrow" size="16" color="#ccc" />
      </div>

      <!-- 隐藏的文件选择器 -->
      <input
        ref="avatarInput"
        type="file"
        accept="image/*"
        style="display: none"
        @change="onAvatarChange"
      />

      <van-cell-group inset style="margin-top: 12px">
        <van-cell title="修改昵称" is-link @click="showNicknameDialog = true" />
        <van-cell title="显示快捷浮窗">
          <template #right-icon>
            <van-switch v-model="floatBtnEnabled" size="20" />
          </template>
        </van-cell>
      </van-cell-group>

      <van-cell-group inset style="margin-top: 12px">
        <van-cell title="退出登录" @click="logout" style="color: #ee0a24" />
      </van-cell-group>
    </div>

    <van-tabbar v-model="active" active-color="#07c160">
      <van-tabbar-item icon="chat-o" @click="$router.push('/')">消息</van-tabbar-item>
      <van-tabbar-item icon="friends-o" @click="$router.push('/contacts')">联系人</van-tabbar-item>
      <van-tabbar-item icon="user-o">我的</van-tabbar-item>
    </van-tabbar>

    <van-dialog
      v-model:show="showNicknameDialog"
      title="修改昵称"
      show-cancel-button
      @confirm="updateNickname"
    >
      <van-field v-model="newNickname" label="昵称" placeholder="请输入昵称" />
    </van-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { showToast, showDialog, showLoadingToast, closeToast } from 'vant';
import { updateUserInfo, getUserInfo as fetchUserInfo } from '@/api/user';
import { uploadFile } from '@/api/upload';
import { useUserStore } from '@/store/user';
import { useSocketStore } from '@/store/socket';

const router = useRouter();
const userStore = useUserStore();
const socketStore = useSocketStore();

const active = ref(2);
const userInfo = computed(() => userStore.userInfo);
const showNicknameDialog = ref(false);
const newNickname = ref('');
const avatarInput = ref(null);
const defaultAvatar = '/avatars/cat.svg';

// 快捷浮窗开关
const floatBtnEnabled = ref(localStorage.getItem('float_btn_enabled') !== 'false');
watch(floatBtnEnabled, (val) => {
  localStorage.setItem('float_btn_enabled', val ? 'true' : 'false');
});

function onAvatarClick() {
  avatarInput.value?.click();
}

async function onAvatarChange(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  // 校验大小
  if (file.size > 10 * 1024 * 1024) {
    showToast('图片不能超过 10MB');
    return;
  }

  try {
    showLoadingToast({ message: '上传中...', forbidClick: true });
    const result = await uploadFile('avatar', file);
    closeToast();

    // 更新用户信息
    await updateUserInfo({ avatar: result.url });
    userStore.setUserInfo({ ...userStore.userInfo, avatar: result.url });
    showToast('头像更新成功');
  } catch (err) {
    closeToast();
    showToast(err.message || '上传失败');
  } finally {
    // 清空 input，允许重复选择同一文件
    e.target.value = '';
  }
}

async function updateNickname() {
  if (!newNickname.value.trim()) {
    showToast('昵称不能为空');
    return;
  }

  const data = await updateUserInfo({ nickname: newNickname.value.trim() });
  userStore.setUserInfo({ ...userStore.userInfo, ...data });
  showToast('修改成功');
  showNicknameDialog.value = false;
}

function logout() {
  showDialog({
    title: '提示',
    message: '确定退出登录吗？',
    showCancelButton: true,
  }).then(() => {
    socketStore.disconnect();
    userStore.logout();
    router.push('/login');
  }).catch(() => {});
}

onMounted(async () => {
  if (!userStore.isLogin) {
    router.push('/login');
    return;
  }
  // 主动拉取最新用户信息（确保 short_no 等字段最新）
  try {
    const info = await fetchUserInfo();
    if (info) {
      userStore.setUserInfo({ ...userStore.userInfo, ...info });
    }
  } catch (e) {}
});
</script>

<style scoped>
.profile-page {
  min-height: 100vh;
  min-height: 100dvh;
  background: #ededed;
  padding-top: 46px;
  padding-bottom: 56px;
  box-sizing: border-box;
}

.profile {
  padding: 0;
}

.user-card {
  display: flex;
  align-items: center;
  padding: 24px 16px;
  background: #fff;
  border-bottom: none;
  margin-bottom: 8px;
  cursor: pointer;
}

.user-card:active {
  background: #f7f7f7;
}

.user-info {
  margin-left: 14px;
  flex: 1;
}

.nickname {
  font-size: 18px;
  font-weight: 600;
  color: #111;
  margin-bottom: 6px;
}

.phone {
  font-size: 14px;
  color: #999;
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
