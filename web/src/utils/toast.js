import { showToast as vanShowToast, showLoadingToast as vanShowLoadingToast, closeToast as vanCloseToast } from 'vant';
import 'vant/es/toast/style';

// 统一的 toast 样式
const COMMON_OPTIONS = {
  position: 'middle',
  className: 'app-toast',
  duration: 2000,
  wordBreak: 'break-all',
};

/**
 * 普通提示
 * @param {string|object} messageOrOptions 提示内容或配置对象
 * @param {object} [options] 额外选项（当第一个参数是字符串时）
 */
export function showToast(messageOrOptions, options = {}) {
  let opts;
  if (typeof messageOrOptions === 'object' && messageOrOptions !== null) {
    opts = {
      ...COMMON_OPTIONS,
      ...messageOrOptions,
    };
  } else {
    opts = {
      message: messageOrOptions,
      ...COMMON_OPTIONS,
      ...options,
    };
  }
  return vanShowToast(opts);
}

/**
 * 成功提示
 * @param {string} message
 */
export function showSuccessToast(message) {
  return vanShowToast({
    type: 'success',
    message,
    ...COMMON_OPTIONS,
  });
}

/**
 * 失败提示
 * @param {string} message
 */
export function showFailToast(message) {
  return vanShowToast({
    type: 'fail',
    message,
    ...COMMON_OPTIONS,
  });
}

/**
 * 加载中提示
 * @param {string|object} messageOrOptions 提示文字或配置对象
 * @param {object} [options] 额外选项（当第一个参数是字符串时）
 */
export function showLoadingToast(messageOrOptions = '加载中...', options = {}) {
  let opts;
  if (typeof messageOrOptions === 'object' && messageOrOptions !== null) {
    opts = {
      forbidClick: true,
      duration: 0,
      className: 'app-toast app-toast-loading',
      ...messageOrOptions,
    };
  } else {
    opts = {
      message: messageOrOptions,
      forbidClick: true,
      duration: 0,
      className: 'app-toast app-toast-loading',
      ...options,
    };
  }
  return vanShowLoadingToast(opts);
}

/**
 * 关闭 toast
 */
export function closeToast() {
  return vanCloseToast();
}

export default {
  show: showToast,
  success: showSuccessToast,
  fail: showFailToast,
  loading: showLoadingToast,
  close: closeToast,
};
