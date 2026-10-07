// 机器人客户端配置
// 支持环境变量覆盖（方便 Docker 部署）
module.exports = {
  // ===== 轻聊服务器 =====
  serverUrl: process.env.SERVER_URL || 'http://localhost:3000',
  // 机器人 API Key
  apiKey: process.env.API_KEY || 'e4204c3a318ec60788cf341b04b5a335ac7ab5a52ef3d8974657b86838fb376a',

  // ===== 群绑定 =====
  // 监控哪些群的消息（数组，可配置群ID列表）
  // 留空则监控所有绑定的群
  watchGroupIds: [],

  // ===== 外部业务服务器 =====
  // 外部业务服务器 IP（WS端口固定8011，HTTP端口固定9011）
  bizServerIp: process.env.BIZ_SERVER_IP || '38.60.253.114',
  enableBizWs: process.env.ENABLE_BIZ_WS !== 'false',

  // 是否启用群消息转发
  enableMessageForward: process.env.ENABLE_MESSAGE_FORWARD !== 'false',
  // 转发接口路径
  forwardChatApi: process.env.FORWARD_CHAT_API || '/api/chat',
  // 撤回消息接口
  forwardRecallApi: process.env.FORWARD_RECALL_API || '/api/recallmsg',
  // 添加玩家接口
  addPaochatApi: process.env.ADD_PAOCHAT_API || '/api/addpaochatuser',
  // 新成员入群时自动调用 addpaochatuser
  enableAddPaochatUser: process.env.ENABLE_ADD_PAOCHAT_USER === 'true',

  // ===== 本地控制面板 =====
  // 本地 Web 面板端口，浏览器打开 http://localhost:7777
  panelPort: parseInt(process.env.PANEL_PORT || '7777', 10),

  // ===== 文件夹监控 =====
  watchFolder: process.env.WATCH_FOLDER || '/Users/lyelsa/Downloads',
  enableFolderWatch: process.env.ENABLE_FOLDER_WATCH === 'true',
  imageExtensions: [".png",".jpg",".jpeg",".gif",".webp",".bmp"],

  // ===== OSS 配置（可选，不配置则用 base64 发图） =====
  oss: {
    region: process.env.OSS_REGION || '',
    bucket: process.env.OSS_BUCKET || '',
    accessKeyId: process.env.OSS_ACCESS_KEY_ID || '',
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || '',
    domain: process.env.OSS_DOMAIN || '',
    prefix: process.env.OSS_PREFIX || 'robot',
  },
};
