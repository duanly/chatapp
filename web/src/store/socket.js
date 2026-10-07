import { defineStore } from 'pinia';
import { io } from 'socket.io-client';
import { useUserStore } from './user';

// 生成/获取设备唯一ID（同一设备重连用同一个）
function getDeviceId() {
  let deviceId = localStorage.getItem('device_id');
  if (!deviceId) {
    deviceId = 'dev_' + Math.random().toString(36).slice(2, 18);
    localStorage.setItem('device_id', deviceId);
  }
  return deviceId;
}

export const useSocketStore = defineStore('socket', {
  state: () => ({
    socket: null,
    connected: false,
    connecting: false,
    reconnectAttempts: 0,
    status: 'disconnected', // disconnected / connecting / connected / reconnecting / failed
    messages: {}, // key -> [messages]
    pendingMessages: [], // 断线期间待发送的消息
    _listeners: { new_message: [], message_read: [], message_withdrawn: [], connect: [], disconnect: [] },
    _bound: false,
    _networkBound: false,
  }),

  actions: {
    connect() {
      const userStore = useUserStore();
      if (!userStore.token) return;
      if (this.socket && this.connected) return;
      if (this.connecting) return;
      if (this.status === 'reconnecting' && this.socket) return;

      const deviceId = getDeviceId();
      this.connecting = true;
      this.status = 'connecting';

      this.socket = io('/', {
        auth: {
          token: userStore.token,
          device_id: deviceId,
        },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 500,       // 第一次重连等 500ms
        reconnectionDelayMax: 10000,   // 最大重连间隔 10s
        randomizationFactor: 0.5,      // 随机抖动，避免风暴
        reconnectionAttempts: Infinity, // 无限重试
        timeout: 10000,                 // 连接超时 10s
      });

      // 绑定全局事件（只绑一次）
      this._bindEvents();
      // 绑定网络状态和可见性监听（只绑一次）
      this._bindNetworkListeners();

      return this.socket;
    },

    _bindNetworkListeners() {
      if (this._networkBound) return;
      this._networkBound = true;

      // 网络从离线变在线时，主动触发重连
      window.addEventListener('online', () => {
        console.log('[Socket] Network online, triggering reconnect');
        if (this.socket && !this.connected) {
          // socket.io 内部有重连机制，但在线时可以手动加速
          this.socket.io.connect();
        } else if (!this.socket) {
          this.connect();
        }
      });

      // 页面从后台切回前台时，检查连接状态
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          console.log('[Socket] Page visible, checking connection');
          if (this.socket && !this.connected) {
            this.socket.io.connect();
          } else if (!this.socket && useUserStore().token) {
            this.connect();
          }
        }
      });
    },

    _bindEvents() {
      if (this._bound || !this.socket) return;
      this._bound = true;
      const socket = this.socket;
      let isFirstConnect = true;

      socket.on('connect', () => {
        console.log('Socket connected:', socket.id);
        this.connected = true;
        this.connecting = false;
        this.status = 'connected';
        this.reconnectAttempts = 0;
        this.flushPendingMessages();

        if (isFirstConnect) {
          isFirstConnect = false;
          this._emit('connect');
        } else {
          // 重连成功，触发 reconnect 事件
          console.log('[Socket] Reconnected, syncing messages');
          this._emit('reconnect');
        }
      });

      socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        this.connected = false;
        this.connecting = false;
        if (reason === 'io server disconnect' || reason === 'io client disconnect') {
          this.status = 'disconnected';
        } else {
          // 异常断开，马上会自动重连，直接显示重连中
          this.status = 'reconnecting';
          this.reconnectAttempts = 1;
        }
        this._emit('disconnect', reason);
      });

      socket.on('connect_error', (err) => {
        console.error('Socket connect error:', err.message);
        this.connecting = false;
        this.status = 'reconnecting';
      });

      socket.on('reconnect_attempt', (attempt) => {
        console.log('Socket reconnect attempt:', attempt);
        this.reconnectAttempts = attempt;
        this.status = 'reconnecting';
        this.connecting = true;
      });

      socket.on('reconnect_error', () => {
        this.status = 'reconnecting';
      });

      socket.on('reconnect_failed', () => {
        console.error('Socket reconnect failed, will keep retrying');
        // 不进入 failed 状态，保持 reconnecting，让内部机制继续重试
        this.status = 'reconnecting';
        this.connecting = true;
      });

      socket.on('new_message', (msg) => {
        this.addMessage(msg);
        this._emit('new_message', msg);
      });

      socket.on('message_read', (data) => {
        this._emit('message_read', data);
      });

      socket.on('message_withdrawn', (data) => {
        // 更新本地消息标记为已撤回
        const key = data.group_id
          ? `group_${data.group_id}`
          : `single_${[data.from_uid, data.to_uid].sort().join('_')}`;
        const list = this.messages[key];
        if (list) {
          const msg = list.find(m => m.id == data.id);
          if (msg) {
            msg.withdrawn = true;
          }
        }
        this._emit('message_withdrawn', data);
      });

      socket.on('kick', (data) => {
        const userStore = useUserStore();
        if (data.reason === 'same_device') return;
        alert(data.message || '您的账号在其他设备登录');
        this.disconnect();
        userStore.logout();
        window.location.href = '/login';
      });
    },

    _emit(event, ...args) {
      const handlers = this._listeners[event] || [];
      for (const fn of handlers) {
        try { fn(...args); } catch (e) { console.error(e); }
      }
    },

    // 注册监听（自动处理连接时机）
    on(event, callback) {
      if (!this._listeners[event]) this._listeners[event] = [];
      this._listeners[event].push(callback);

      // 返回取消函数
      return () => {
        const arr = this._listeners[event];
        if (!arr) return;
        const idx = arr.indexOf(callback);
        if (idx >= 0) arr.splice(idx, 1);
      };
    },

    onNewMessage(callback) {
      return this.on('new_message', callback);
    },

    onMessageRead(callback) {
      return this.on('message_read', callback);
    },

    onMessageWithdrawn(callback) {
      return this.on('message_withdrawn', callback);
    },

    onReconnect(callback) {
      return this.on('reconnect', callback);
    },

    withdrawMessage(msgId, callback) {
      if (!this.socket || !this.connected) {
        return callback?.({ code: 500, message: '未连接' });
      }
      this.socket.emit('withdraw_message', { msgId }, callback);
    },

    disconnect() {
      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
        this._bound = false;
      }
      this.connected = false;
      this.connecting = false;
      this.status = 'disconnected';
      this.reconnectAttempts = 0;
    },

    // 手动重连
    reconnect() {
      this.disconnect();
      this.connect();
    },

    sendMessage(data, callback) {
      if (!this.socket || !this.connected) {
        this.pendingMessages.push({ data, callback });
        if (!this.connecting && this.status !== 'reconnecting') {
          this.connect();
        }
        return;
      }
      this.socket.emit('send_message', data, callback);
    },

    flushPendingMessages() {
      if (this.pendingMessages.length === 0) return;
      console.log(`Flushing ${this.pendingMessages.length} pending messages`);
      const pending = [...this.pendingMessages];
      this.pendingMessages = [];
      for (const { data, callback } of pending) {
        this.socket.emit('send_message', data, callback);
      }
    },

    addMessage(msg) {
      const key = this._getMessageKey(msg);
      if (!this.messages[key]) {
        this.messages[key] = [];
      }
      const exist = this.messages[key].find(m => m.id === msg.id);
      if (!exist) {
        this.messages[key].push(msg);
      }
    },

    _getMessageKey(msg) {
      if (msg.group_id) return `group_${msg.group_id}`;
      const uids = [msg.from_uid, msg.to_uid].sort();
      return `single_${uids[0]}_${uids[1]}`;
    },

    getMessages(key) {
      return this.messages[key] || [];
    },

    setMessages(key, list) {
      this.messages[key] = list;
    },
  },
});
