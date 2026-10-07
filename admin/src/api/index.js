import request from './request';

export function adminLogin(username, password) {
  return request.post('/login', { username, password });
}

export function getUserList(params) {
  return request.get('/users', { params });
}

export function setUserStatus(uid, status) {
  return request.post(`/users/${uid}/status`, { status });
}

export function createUser(data) {
  return request.post('/users', data);
}

export function batchCreateUsers(users) {
  return request.post('/users/batch', { users });
}

export function updateUserRemark(uid, remark) {
  return request.put(`/users/${uid}/remark`, { remark });
}

export function getUserDetail(uid) {
  return request.get(`/users/${uid}`);
}

export function setUserDeviceLock(uid, deviceLock) {
  return request.post(`/users/${uid}/device-lock`, { deviceLock });
}

export function getGroupList(params) {
  return request.get('/groups', { params });
}

export function createGroup(data) {
  return request.post('/groups', data);
}

export function updateGroupStatus(id, status) {
  return request.post(`/groups/${id}/status`, { status });
}

export function setGroupPublic(id, isPublic) {
  return request.post(`/groups/${id}/public`, { isPublic });
}

export function disbandGroup(id) {
  return request.delete(`/groups/${id}`);
}

export function setUserPublic(uid, isPublic) {
  return request.post(`/users/${uid}/public`, { isPublic });
}

export function getMessageList(params) {
  return request.get('/messages', { params });
}

export function getRobotList() {
  return request.get('/robots');
}

export function createRobot(data) {
  return request.post('/robots', data);
}

export function updateRobot(id, data) {
  return request.put(`/robots/${id}`, data);
}

export function bindRobotGroup(id, groupId) {
  return request.post(`/robots/${id}/bind`, { groupId });
}

export function unbindRobotGroup(id, groupId) {
  return request.delete(`/robots/${id}/unbind/${groupId}`);
}

export function getRobotMessageLogs(params) {
  return request.get('/robots/messages/logs', { params });
}

export function uploadFile(type, formData) {
  return request.post(`/upload/${type}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

export function getSystemSettings() {
  return request.get('/settings');
}

export function updateSystemSettings(data) {
  return request.put('/settings', data);
}

export function importTsddUsers(users) {
  return request.post('/users/import/tsdd', { users });
}
