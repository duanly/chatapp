// 机器人客户端配置
module.exports = {
  // ===== 轻聊服务器 =====
  serverUrl: 'http://localhost:3000',
  // 机器人 API Key
  apiKey: 'e4204c3a318ec60788cf341b04b5a335ac7ab5a52ef3d8974657b86838fb376a',

  // ===== 群绑定 =====
  // 监控哪些群的消息（数组，可配置群ID列表）
  // 留空则监控所有绑定的群
  watchGroupIds: [],

  // ===== 外部业务服务器 =====
  // 外部业务服务器 IP（WS端口固定8011，HTTP端口固定9011）
  bizServerIp: '38.60.253.114',
  enableBizWs: true,

  // 是否启用群消息转发
  enableMessageForward: true,
  // 转发接口路径
  forwardChatApi: '/api/chat',
  // 撤回消息接口
  forwardRecallApi: '/api/recallmsg',
  // 添加玩家接口
  addPaochatApi: '/api/addpaochatuser',
  // 新成员入群时自动调用 addpaochatuser
  enableAddPaochatUser: false,

  // ===== 本地控制面板 =====
  // 本地 Web 面板端口，浏览器打开 http://localhost:7777
  panelPort: 7777,

  // ===== 文件夹监控 =====
  watchFolder: '/Users/lyelsa/Downloads',  // 本地文件夹路径
  enableFolderWatch: false,
  imageExtensions: [".png",".jpg",".jpeg",".gif",".webp",".bmp"],
};
