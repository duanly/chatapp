<template>
  <div class="login-page">
    <div class="logo">
      <div class="logo-icon">
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
          <defs>
            <linearGradient id="logoBg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#07c160"/>
              <stop offset="100%" style="stop-color:#06ad56"/>
            </linearGradient>
          </defs>
          <rect width="64" height="64" rx="14" fill="url(#logoBg)"/>
          <path d="M32 12l5.5 12.5L50 26l-10 9 2.5 13L32 41.5 21.5 48 24 35 14 26l12.5-1.5z" fill="#fff"/>
        </svg>
      </div>
      <h2>轻聊</h2>
      <p>简单好用的聊天工具</p>
    </div>

    <van-form @submit="onLogin">
      <van-cell-group inset class="login-form">
        <van-field
          v-model="phone"
          type="tel"
          label="手机号"
          placeholder="请输入手机号"
          maxlength="11"
        />
        <van-field
          v-model="password"
          type="password"
          label="密码"
          placeholder="请输入密码"
        />
      </van-cell-group>

      <div class="login-btn">
        <van-button block type="primary" native-type="submit" :loading="loading" round>
          登录
        </van-button>
      </div>
    </van-form>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from '@/utils/toast';
import { loginByPassword } from '@/api/user';
import { useUserStore } from '@/store/user';
import { useSocketStore } from '@/store/socket';

const router = useRouter();
const userStore = useUserStore();
const socketStore = useSocketStore();

const phone = ref('');
const password = ref('');
const loading = ref(false);

async function onLogin() {
  if (!phone.value || !password.value) {
    showToast('请输入手机号和密码');
    return;
  }

  loading.value = true;
  try {
    const data = await loginByPassword(phone.value, password.value);
    userStore.setToken(data.token);
    userStore.setUserInfo(data.user);

    // 连接 socket
    socketStore.connect();

    showToast('登录成功');
    router.push('/');
  } catch (err) {
    // error handled by interceptor
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-page {
  padding: 80px 24px;
  background: #fff;
  min-height: 100vh;
  box-sizing: border-box;
}

.logo {
  text-align: center;
  margin-bottom: 48px;
}

.logo-icon {
  margin-bottom: 16px;
  display: flex;
  justify-content: center;
}

.logo h2 {
  color: #111;
  font-size: 28px;
  font-weight: 600;
  margin: 0 0 8px 0;
}

.logo p {
  color: #999;
  font-size: 14px;
  margin: 0;
}

.login-form {
  margin-bottom: 32px;
}

.login-btn {
  margin-top: 32px;
  padding: 0 4px;
}
</style>
