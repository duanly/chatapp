import { defineStore } from 'pinia';
import { getUserInfo } from '@/api/user';

export const useUserStore = defineStore('user', {
  state: () => ({
    token: localStorage.getItem('token') || '',
    userInfo: JSON.parse(localStorage.getItem('userInfo') || 'null'),
  }),

  getters: {
    isLogin: (state) => !!state.token,
  },

  actions: {
    setToken(token) {
      this.token = token;
      localStorage.setItem('token', token);
    },

    setUserInfo(info) {
      this.userInfo = info;
      localStorage.setItem('userInfo', JSON.stringify(info));
    },

    async fetchUserInfo() {
      const info = await getUserInfo();
      this.userInfo = info;
      localStorage.setItem('userInfo', JSON.stringify(info));
      return info;
    },

    logout() {
      // 清除所有消息缓存
      try {
        const myUid = this.userInfo?.uid || '';
        const prefix = `msg_cache_${myUid}_`;
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(prefix)) keys.push(k);
        }
        keys.forEach(k => localStorage.removeItem(k));
      } catch (e) {}
      // 清除群列表缓存
      localStorage.removeItem('groups_list');
      // 清除单聊列表缓存
      localStorage.removeItem('single_list');
      // 清除未读数缓存
      localStorage.removeItem('unread_map');
      localStorage.removeItem('mention_map');

      this.token = '';
      this.userInfo = null;
      localStorage.removeItem('token');
      localStorage.removeItem('userInfo');
    },
  },
});
