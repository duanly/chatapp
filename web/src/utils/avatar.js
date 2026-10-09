/**
 * 文字头像生成工具
 * 根据名字生成带颜色背景的文字头像（SVG base64）
 */

// 预设背景色（柔和配色，从名字 hash 中选取）
const COLORS = [
  '#4FC3F7', // 蓝
  '#81C784', // 绿
  '#FFB74D', // 橙
  '#BA68C8', // 紫
  '#F06292', // 粉
  '#4DB6AC', // 青
  '#FF8A65', // 珊瑚
  '#7986CB', // 靛蓝
  '#AED581', // 黄绿
  '#FFD54F', // 琥珀
  '#90CAF9', // 浅蓝
  '#CE93D8', // 浅紫
];

/**
 * 简单的字符串 hash，用于稳定映射到颜色
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * 获取名字的前两个字符（中文算一个字，英文算一个字母）
 */
function getInitials(name) {
  if (!name) return '?';
  const trimmed = name.trim();
  if (!trimmed) return '?';

  // 取前两个字符
  let chars = [];
  let count = 0;
  // 使用 Array.from 正确处理多字节字符
  const arr = Array.from(trimmed);
  for (const ch of arr) {
    if (count >= 2) break;
    // 跳过空格
    if (ch === ' ') continue;
    chars.push(ch);
    count++;
  }
  return chars.join('') || '?';
}

/**
 * 根据名字生成文字头像（SVG data URL）
 * @param {string} name - 名字/昵称/群名称
 * @param {object} options - 选项
 * @param {number} options.size - 尺寸（默认 48）
 * @param {string} options.bgColor - 自定义背景色（不传则根据名字自动选）
 * @returns {string} SVG data URL
 */
export function generateTextAvatar(name, options = {}) {
  const size = options.size || 48;
  const text = getInitials(name);

  // 背景色
  let bgColor = options.bgColor;
  if (!bgColor) {
    const idx = hashString(name || '?') % COLORS.length;
    bgColor = COLORS[idx];
  }

  // 根据文字长度调整字号
  const fontSize = text.length >= 2 ? size * 0.38 : size * 0.45;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" x="0" y="0" fill="${bgColor}" />
  <text
    x="${size / 2}"
    y="${size / 2 + fontSize * 0.35}"
    font-size="${fontSize}"
    text-anchor="middle"
    fill="#ffffff"
    font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    font-weight="500"
  >${text}</text>
</svg>`;

  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
}

/**
 * 获取头像：有图片用图片，没有则用文字头像
 * @param {string} avatar - 头像图片 URL
 * @param {string} name - 名字/昵称
 * @param {object} options - 选项
 * @returns {string} 头像 URL
 */
export function getAvatar(avatar, name, options) {
  if (avatar && avatar.trim()) {
    return avatar;
  }
  return generateTextAvatar(name || '?', options);
}

export default {
  generateTextAvatar,
  getAvatar,
};
