import request from './request';

// 生成/获取设备 ID
function getDeviceId() {
  let deviceId = localStorage.getItem('device_id');
  if (!deviceId) {
    deviceId = 'web_' + Math.random().toString(36).slice(2, 18) + '_' + Date.now().toString(36);
    localStorage.setItem('device_id', deviceId);
  }
  return deviceId;
}

// 手机号+密码登录
export function loginByPassword(phone, password) {
  const deviceId = getDeviceId();
  const deviceInfo = `${navigator.platform || ''} ${navigator.userAgent.slice(0, 100)}`;
  return request.post('/user/login', { phone, password, device_id: deviceId, device_info: deviceInfo });
}

// 获取用户信息
export function getUserInfo() {
  return request.get('/user/info');
}

// 更新用户信息
export function updateUserInfo(data) {
  return request.put('/user/info', data);
}

// 搜索用户
export function searchUsers(keyword) {
  return request.get('/users/search', { params: { keyword } });
}

// 获取所有用户（前200）
export function getAllUsers() {
  return request.get('/users/list', { params: { pageSize: 200 } });
}

// 通过 uid 获取用户（用搜索接口模拟）
export function getUserByUid(uid) {
  return request.get('/users/search', { params: { keyword: uid, pageSize: 1 } });
}

// 单聊消息历史
export function getSingleMessages(uid, beforeId, limit = 50, afterId = null) {
  return request.get(`/user/messages/${uid}`, { params: { beforeId, limit, afterId } });
}

// 公共用户列表
export function getPublicUsers() {
  return request.get('/users/public');
}

// 获取我的会话设置
export function getConversationSettings() {
  return request.get('/conversation/settings');
}

// 置顶/取消置顶会话
export function pinConversation(convType, convId, isPinned) {
  return request.post('/conversation/pin', { convType, convId, isPinned });
}

// 标星/取消标星会话
export function starConversation(convType, convId, isStared) {
  return request.post('/conversation/star', { convType, convId, isStared });
}
