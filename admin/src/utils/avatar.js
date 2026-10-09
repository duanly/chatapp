/**
 * 文字头像生成工具
 * 根据名字生成带颜色背景的文字头像（SVG base64）
 */

const COLORS = [
  '#4FC3F7', '#81C784', '#FFB74D', '#BA68C8',
  '#F06292', '#4DB6AC', '#FF8A65', '#7986CB',
  '#AED581', '#FFD54F', '#90CAF9', '#CE93D8',
];

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function getInitials(name) {
  if (!name) return '?';
  const trimmed = name.trim();
  if (!trimmed) return '?';
  let chars = [];
  let count = 0;
  const arr = Array.from(trimmed);
  for (const ch of arr) {
    if (count >= 2) break;
    if (ch === ' ') continue;
    chars.push(ch);
    count++;
  }
  return chars.join('') || '?';
}

export function generateTextAvatar(name, options = {}) {
  const size = options.size || 48;
  const text = getInitials(name);
  let bgColor = options.bgColor;
  if (!bgColor) {
    const idx = hashString(name || '?') % COLORS.length;
    bgColor = COLORS[idx];
  }
  const fontSize = text.length >= 2 ? size * 0.38 : size * 0.45;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" x="0" y="0" fill="${bgColor}" rx="4"/>
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
