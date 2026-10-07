// 默认头像列表（卡通动物 SVG）
const DEFAULT_AVATARS = [
  '/avatars/cat.svg',
  '/avatars/dog.svg',
  '/avatars/frog.svg',
  '/avatars/bear.svg',
  '/avatars/unicorn.svg',
  '/avatars/pig.svg',
  '/avatars/chick.svg',
  '/avatars/dinosaur.svg',
];

// 随机获取一个默认头像
function getRandomAvatar() {
  const idx = Math.floor(Math.random() * DEFAULT_AVATARS.length);
  return DEFAULT_AVATARS[idx];
}

// 根据 uid 哈希分配固定头像（同一个 uid 每次都一样）
function getAvatarByUid(uid) {
  if (!uid) return DEFAULT_AVATARS[0];
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = uid.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % DEFAULT_AVATARS.length;
  return DEFAULT_AVATARS[idx];
}

module.exports = {
  DEFAULT_AVATARS,
  getRandomAvatar,
  getAvatarByUid,
};
