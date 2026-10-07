const config = require('../config');

// 如果没有配置 redis host，用内存模拟（开发环境）
const useMock = !config.redis.host;

// 内存存储
const memoryStore = new Map();
const memoryTimers = new Map();

function setWithExpire(key, value, expireSeconds) {
  memoryStore.set(key, value);
  if (memoryTimers.has(key)) clearTimeout(memoryTimers.get(key));
  if (expireSeconds) {
    const timer = setTimeout(() => {
      memoryStore.delete(key);
      memoryTimers.delete(key);
    }, expireSeconds * 1000);
    memoryTimers.set(key, timer);
  }
}

const mockRedis = {
  async connect() {
    console.log('Using in-memory store (Redis mock)');
  },
  async get(key) {
    return memoryStore.get(key) || null;
  },
  async set(key, value, mode, expire) {
    const expireSeconds = mode === 'EX' ? expire : null;
    setWithExpire(key, value, expireSeconds);
    return 'OK';
  },
  async del(key) {
    const existed = memoryStore.has(key);
    memoryStore.delete(key);
    if (memoryTimers.has(key)) {
      clearTimeout(memoryTimers.get(key));
      memoryTimers.delete(key);
    }
    return existed ? 1 : 0;
  },
};

let client = null;

async function connect() {
  if (useMock) {
    client = mockRedis;
    await client.connect();
    return client;
  }

  const { createClient } = require('redis');
  const redisConfig = {
    url: `redis://${config.redis.host}:${config.redis.port}`,
  };
  if (config.redis.password) {
    redisConfig.password = config.redis.password;
  }

  client = createClient(redisConfig);
  client.on('error', (err) => console.error('Redis Client Error', err));
  client.on('connect', () => console.log('Redis connected'));

  await client.connect();
  return client;
}

function getClient() {
  if (!client) {
    throw new Error('Redis not connected');
  }
  return client;
}

// 在线状态
const ONLINE_KEY = 'chatapp:online:';
const SOCKET_UID_KEY = 'chatapp:socket:uid:';

async function setOnline(uid, socketId) {
  const r = getClient();
  await r.set(`${ONLINE_KEY}${uid}`, socketId, 'EX', 86400);
  await r.set(`${SOCKET_UID_KEY}${socketId}`, uid, 'EX', 86400);
}

async function setOffline(uid, socketId) {
  const r = getClient();
  await r.del(`${ONLINE_KEY}${uid}`);
  if (socketId) {
    await r.del(`${SOCKET_UID_KEY}${socketId}`);
  }
}

async function getSocketIdByUid(uid) {
  const r = getClient();
  return r.get(`${ONLINE_KEY}${uid}`);
}

async function getUidBySocketId(socketId) {
  const r = getClient();
  return r.get(`${SOCKET_UID_KEY}${socketId}`);
}

async function isOnline(uid) {
  const r = getClient();
  const socketId = await r.get(`${ONLINE_KEY}${uid}`);
  return !!socketId;
}

// 机器人
const ROBOT_SOCKET_KEY = 'chatapp:robot:socket:';

async function setRobotSocket(socketId, robotId) {
  const r = getClient();
  await r.set(`${ROBOT_SOCKET_KEY}${robotId}`, socketId, 'EX', 86400);
}

async function getRobotSocket(robotId) {
  const r = getClient();
  return r.get(`${ROBOT_SOCKET_KEY}${robotId}`);
}

async function removeRobotSocket(robotId, socketId) {
  const r = getClient();
  const current = await r.get(`${ROBOT_SOCKET_KEY}${robotId}`);
  if (current === socketId) {
    await r.del(`${ROBOT_SOCKET_KEY}${robotId}`);
  }
}

module.exports = {
  connect,
  getClient,
  setOnline,
  setOffline,
  getSocketIdByUid,
  getUidBySocketId,
  isOnline,
  setRobotSocket,
  getRobotSocket,
  removeRobotSocket,
};
