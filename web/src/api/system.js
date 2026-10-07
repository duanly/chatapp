import request from './request';

// 获取系统设置
export function getSystemSettings() {
  return request.get('/system/settings');
}
