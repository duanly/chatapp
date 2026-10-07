import request from './request';

// 创建群
export function createGroup(data) {
  return request.post('/groups/', data);
}

// 我的群列表
export function getMyGroups() {
  return request.get('/groups/my');
}

// 群信息
export function getGroupInfo(id) {
  return request.get(`/groups/${id}`);
}

// 群成员
export function getGroupMembers(id) {
  return request.get(`/groups/${id}/members`);
}

// 群消息历史
export function getGroupMessages(id, beforeId, limit = 50, afterId = null) {
  return request.get(`/groups/${id}/messages`, { params: { beforeId, limit, afterId } });
}

// 添加成员
export function addGroupMember(id, uid) {
  return request.post(`/groups/${id}/members`, { uid });
}

// 移除成员（踢人）
export function removeGroupMember(id, uid) {
  return request.delete(`/groups/${id}/members/${uid}`);
}

// 更新群信息（名称、头像）
export function updateGroup(id, data) {
  return request.put(`/groups/${id}`, data);
}

// 退出群
export function leaveGroup(id) {
  return request.post(`/groups/${id}/leave`);
}

// 群开门/关门
export function setGroupStatus(id, status) {
  return request.post(`/groups/${id}/status`, { status });
}

// 邀请码：获取群信息
export function getGroupByInviteCode(code) {
  return request.get(`/groups/invite/${code}`);
}

// 邀请码：加入群
export function joinGroupByInviteCode(code) {
  return request.post(`/groups/invite/${code}/join`);
}

// 直接加入群（公共群）
export function joinGroup(id) {
  return request.post(`/groups/${id}/join`);
}

// 添加玩家（通知机器人）
export function addPlayer(groupId, uid) {
  return request.post(`/groups/${groupId}/add-player`, { uid });
}
