/**
 * 带命名空间的 localStorage 封装
 * 根据 URL 参数 sid 自动给所有 key 加前缀，实现多账号隔离
 *
 * 使用方式：在 main.js 最前面 import './utils/storage' 即可
 * 业务代码继续用 localStorage，完全透明
 */

// 从 URL 中获取 sid（实例 ID）
function getSidFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const sid = params.get('sid');
  return sid || ''; // 默认空 = 单账号模式，不加前缀
}

const SID = getSidFromUrl();
const PREFIX = SID ? `s${SID}:` : '';

// 保存原始方法
const _setItem = Storage.prototype.setItem;
const _getItem = Storage.prototype.getItem;
const _removeItem = Storage.prototype.removeItem;
const _clear = Storage.prototype.clear;

function pKey(key) {
  return PREFIX ? PREFIX + key : String(key);
}

Storage.prototype.setItem = function(key, value) {
  return _setItem.call(this, pKey(key), value);
};

Storage.prototype.getItem = function(key) {
  return _getItem.call(this, pKey(key));
};

Storage.prototype.removeItem = function(key) {
  return _removeItem.call(this, pKey(key));
};

Storage.prototype.clear = function() {
  if (!PREFIX) return _clear.call(this);
  // 只清当前前缀的 key
  const toRemove = [];
  for (let i = 0; i < this.length; i++) {
    const k = this.key(i);
    if (k && k.startsWith(PREFIX)) toRemove.push(k);
  }
  toRemove.forEach(k => _removeItem.call(this, k));
};

// 导出当前 sid
export const sid = SID;
export const storagePrefix = PREFIX;
export const isMultiInstance = !!SID;

export default {
  sid,
  storagePrefix,
  isMultiInstance,
};
